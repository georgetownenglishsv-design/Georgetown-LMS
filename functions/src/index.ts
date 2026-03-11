
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
// Fix: Explicitly import Buffer for environments where it is not globally available in TypeScript types
import { Buffer } from 'buffer';

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// ... existing SCOPES and getAccessToken ...
const SCOPES = [
  "Team.Create",
  "TeamMember.ReadWrite.All",
  "Group.ReadWrite.All",
  "Calendars.ReadWrite",
  "OnlineMeetings.ReadWrite",
  "Directory.Read.All",
  "User.Read",
  "Files.ReadWrite.All",
  "offline_access"
];

const getAccessToken = async () => {
    const doc = await db.collection("system_secrets").doc("microsoft_auth").get();
    if (!doc.exists) throw new Error("NO_LINKED_ACCOUNT");
    const data = doc.data();
    const refreshToken = data?.refreshToken;
    if (!refreshToken) throw new Error("User not linked.");
    if (refreshToken === "mock_refresh_token") return "MOCK_TOKEN";

    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const tenant = process.env.MS_TENANT_ID || "common";

    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', clientId || '');
    tokenParams.append('client_secret', clientSecret || '');
    tokenParams.append('refresh_token', refreshToken);
    tokenParams.append('grant_type', 'refresh_token');
    tokenParams.append('scope', SCOPES.join(' '));

    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, { method: 'POST', body: tokenParams });
    const tokenJson = await tokenRes.json();
    if (tokenJson.error) throw new Error("Auth Failed: " + tokenJson.error_description);
    return tokenJson.access_token;
};

// ... existing getStreamTicket ...
export const getStreamTicket = functions.https.onCall(async (data: any) => {
    let sharingUrl = data.url || data.data?.url;
    if (!sharingUrl) throw new functions.https.HttpsError("invalid-argument", "Missing URL");

    try {
        const accessToken = await getAccessToken();
        if (accessToken === "MOCK_TOKEN") return { downloadUrl: sharingUrl };

        if (sharingUrl.includes('?')) {
            sharingUrl = sharingUrl.split('?')[0];
        }

        const base64Url = Buffer.from(sharingUrl).toString('base64')
            .replace(/\//g, '_')
            .replace(/\+/g, '-')
            .replace(/=/g, '');
        const shareId = "u!" + base64Url;

        console.log(`[getStreamTicket] Step 1: Resolving shareId...`);

        let res = await fetch(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem?$select=id,parentReference,@microsoft.graph.downloadUrl`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        let json = await res.json();

        if (!res.ok) {
            console.error("[getStreamTicket] MS API Step 1 Error:", JSON.stringify(json));
            throw new Error(`MS API Step 1: ${json.error?.message || "Unknown error"}`);
        }

        let downloadUrl = json["@microsoft.graph.downloadUrl"];
        const itemId = json.id;

        if (!downloadUrl && itemId) {
            console.log(`[getStreamTicket] Step 2: downloadUrl missing, fetching item by ID...`);
            const driveId = json.parentReference?.driveId;
            const itemFetchUrl = driveId 
                ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}?$select=@microsoft.graph.downloadUrl`
                : `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?$select=@microsoft.graph.downloadUrl`;

            const itemRes = await fetch(itemFetchUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const itemJson = await itemRes.json();
            
            if (itemRes.ok) {
                downloadUrl = itemJson["@microsoft.graph.downloadUrl"];
            }
        }
        
        if (!downloadUrl) {
            throw new Error("No se pudo extraer la URL de transmisión directa.");
        }

        try {
            console.log(`[getStreamTicket] Step 3: Resolving Redirect Chain for Low Latency...`);
            const redirectRes = await fetch(downloadUrl, {
                method: 'HEAD',
                redirect: 'follow'
            });
            const finalUrl = redirectRes.url;
            return { downloadUrl: finalUrl || downloadUrl };
        } catch (redirectErr) {
            console.warn("[getStreamTicket] Redirect resolution failed, falling back to original URL.", redirectErr);
            return { downloadUrl };
        }

    } catch (e: any) {
        console.error("[getStreamTicket] Final Error:", e.message);
        throw new functions.https.HttpsError("internal", e.message);
    }
});

/**
 * SHARED LOGIC: Master Sync
 * Scans OneDrive and overwrites DB session recordings.
 * This acts as both Sync and Garbage Collector.
 */
const processRecordingsSync = async (fullScan: boolean) => {
    try {
        const accessToken = await getAccessToken();
        if (accessToken === "MOCK_TOKEN") return { success: true, processed: 0, matches: 0, cleared: 0 };
        const headers: any = { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

        // 1. Locate Recordings Folder
        const rootRes = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,folder", { headers });
        const rootJson: any = await rootRes.json(); // Explicit any
        
        const folderVariants = ['recordings', 'grabaciones', '녹화물', '录音', 'grabaciones de reuniones'];
        const foundFolder = (rootJson.value || []).find((f: any) => folderVariants.includes(f.name?.toLowerCase()));

        if (!foundFolder) return { success: false, error: "No Recordings folder found", processed: 0, matches: 0, cleared: 0 };

        // 2. Fetch ALL Files (Pagination)
        const fileMap = new Map<string, any[]>(); // Key: "REFCODE_DATE", Value: [FileObj, ...]
        let totalFiles = 0;
        
        // FIX: Explicitly type nextLink to string | undefined
        let nextLink: string | undefined = `https://graph.microsoft.com/v1.0/me/drive/items/${foundFolder.id}/children?$select=id,name,webUrl,createdDateTime&$top=999`;
        
        if (!fullScan) {
            nextLink += "&$orderby=lastModifiedDateTime desc";
        }
        
        console.log("Starting OneDrive Scan...");
        
        let pageCount = 0;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7); 

        while (nextLink && pageCount < 50) { 
            // FIX: Explicitly cast 'res' and 'json' to 'any' to prevent TS7022 (circular inference error)
            const res: any = await fetch(nextLink, { headers });
            const json: any = await res.json();
            
            const files = json.value || [];
            
            if (files.length === 0) break;

            for (const file of files) {
                totalFiles++;
                
                // Extract RefCode: [GA-2024-05-1234]
                const refMatch = file.name.match(/GA-[a-zA-Z0-9-]+/i);
                if (refMatch && file.createdDateTime) {
                    const refCode = refMatch[0].toUpperCase();
                    // Calc Local Date from UTC (approx -6h for El Salvador)
                    const utcDate = new Date(file.createdDateTime);
                    const localDate = new Date(utcDate.getTime() - (6 * 60 * 60 * 1000));
                    const dateStr = localDate.toISOString().split('T')[0];
                    
                    const key = `${refCode}_${dateStr}`;
                    const existing = fileMap.get(key) || [];
                    existing.push({
                        url: file.webUrl,
                        label: `Grabación (${dateStr})`, 
                        id: file.id
                    });
                    fileMap.set(key, existing);
                }
            }

            // Update nextLink for loop
            nextLink = json["@odata.nextLink"];
            pageCount++;
            
            // Optimization
            if (!fullScan && pageCount < 3) nextLink = undefined; 
        }
        console.log(`Scan Complete. Found ${totalFiles} total files. Mapped keys: ${fileMap.size}`);

        // 3. Update Database (Batch)
        // Only target Active courses to save reads
        const coursesSnap = await db.collection('courses').where('status', '==', 'Active').get();
        const activeCourseIds = coursesSnap.docs.map(d => d.id);
        const refCodeMap = new Map<string, string>(); 
        coursesSnap.docs.forEach(d => {
            if (d.data().refCode) refCodeMap.set(d.id, d.data().refCode);
        });

        // 4. Iterate Sessions
        // Firestore 'in' limit is 30. We chunk it.
        const courseChunks = [];
        for (let i = 0; i < activeCourseIds.length; i += 30) {
            courseChunks.push(activeCourseIds.slice(i, i + 30));
        }

        const batch = db.batch();
        let updatedCount = 0;
        let clearedCount = 0;
        let operationCount = 0;

        for (const chunk of courseChunks) {
            if (!chunk || chunk.length === 0) continue;

            const sessionsSnap = await db.collection('class_sessions')
                .where('courseId', 'in', chunk)
                .get(); 

            for (const doc of sessionsSnap.docs) {
                const sess = doc.data();
                const refCode = refCodeMap.get(sess.courseId);
                if (!refCode) continue; // No refCode, skip

                const key = `${refCode}_${sess.date}`;
                const validFiles = fileMap.get(key);

                // --- MASTER SYNC LOGIC ---
                // Case A: OneDrive has files for this session
                if (validFiles && validFiles.length > 0) {
                    const newRecordings = validFiles.map(f => ({
                        label: f.label,
                        url: f.url
                    }));
                    
                    // Update if different
                    if (JSON.stringify(sess.recordings) !== JSON.stringify(newRecordings)) {
                        batch.update(doc.ref, { 
                            recordings: newRecordings,
                            recordingLink: newRecordings[0].url // Legacy support
                        });
                        updatedCount++;
                        operationCount++;
                    }
                } 
                // Case B: OneDrive has NO files, but DB has records (Dead Links)
                else if (sess.recordings && Array.isArray(sess.recordings) && sess.recordings.length > 0) {
                    // GARBAGE COLLECTION HAPPENS HERE
                    batch.update(doc.ref, { 
                        recordings: [],
                        recordingLink: admin.firestore.FieldValue.delete()
                    });
                    clearedCount++;
                    operationCount++;
                }

                // Batch Limit Guard
                if (operationCount >= 400) {
                    await batch.commit();
                    operationCount = 0;
                }
            }
        }

        if (operationCount > 0) await batch.commit();

        return { 
            success: true, 
            processed: totalFiles,
            matches: updatedCount, 
            cleared: clearedCount,
            error: null
        };

    } catch (e: any) {
        console.error("Master Sync Error:", e);
        return { success: false, error: e.message, processed: 0, matches: 0, cleared: 0 };
    }
};

/**
 * Unified Cleanup & Sync Function
 */
export const cleanupOrphanedRecordings = functions.https.onCall(async (data: any) => {
    // Force full scan
    const result = await processRecordingsSync(true);
    
    // Log result
    await db.collection('system_logs').add({
        type: 'MASTER_SYNC',
        trigger: 'MANUAL',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        summary: `Scanned ${result.processed} files. Updated ${result.matches}. Cleared ${result.cleared}.`,
        status: result.error ? 'ERROR' : 'SUCCESS'
    });

    if (result.error) return { success: false, error: result.error };

    return { 
        success: true, 
        stats: { 
            totalOneDriveFiles: result.processed, 
            updatedCount: result.matches, 
            clearedCount: result.cleared
        } 
    };
});

export const syncRecordingsManual = functions.https.onCall(async () => {
    return await processRecordingsSync(true);
});

// UPDATED SCHEDULE: Every hour from 7 AM to 11 PM (skip 12AM-6AM)
export const scheduledRecordingsSync = onSchedule({
    schedule: "0 7-23 * * *",
    timeZone: "America/El_Salvador"
}, async (event) => {
    console.log("⏰ Scheduled Sync Started (Business Hours)");
    const result = await processRecordingsSync(false);
    
    await db.collection('system_logs').add({
        type: 'RECORDING_SYNC',
        trigger: 'SCHEDULED',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        summary: `Processed: ${result.processed}, Updated: ${result.matches}, Cleared: ${result.cleared}`,
        status: result.error ? 'ERROR' : 'SUCCESS'
    });
    console.log("✅ Scheduled Sync Completed");
});

export const debugOneDrive = functions.https.onCall(async () => {
    try {
        const accessToken = await getAccessToken();
        if (accessToken === "MOCK_TOKEN") return { status: "mocked" };
        const headers = { 'Authorization': `Bearer ${accessToken}` };
        const rootRes = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,folder", { headers });
        const rootJson = await rootRes.json();
        const recordingsFolder = (rootJson.value || []).find((item: any) => 
            ['recordings', 'grabaciones', '녹화물', '录音', 'grabaciones de reuniones'].includes(item.name?.toLowerCase())
        );
        if (recordingsFolder) {
            const filesRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${recordingsFolder.id}/children?$top=20&$orderby=lastModifiedDateTime desc`, { headers });
            const filesJson = await filesRes.json();
            const filesWithDebugDate = (filesJson.value || []).map((f: any) => {
                let debugDate = "N/A";
                if(f.createdDateTime) {
                    const utcDate = new Date(f.createdDateTime);
                    const localDate = new Date(utcDate.getTime() - (6 * 60 * 60 * 1000));
                    debugDate = localDate.toISOString().split('T')[0];
                }
                return { ...f, debugTargetDate: debugDate };
            });
            return { success: true, method: "manual_search", folderName: recordingsFolder.name, recordingsFiles: filesWithDebugDate };
        }
        return { success: false, error: "No Recordings folder found" };
    } catch (e: any) { return { success: false, error: e.message }; }
});

export const getMSAuthUrl = functions.https.onCall(async (data: any) => {
    const redirectUrl = data.redirectUrl || data.data?.redirectUrl;
    const url = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || "common"}/oauth2/v2.0/authorize?client_id=${process.env.MS_CLIENT_ID}&response_type=code&redirect_uri=${redirectUrl}&response_mode=query&scope=${SCOPES.join('%20')}&state=12345&prompt=consent`;
    return { url };
});

export const exchangeMsToken = functions.https.onCall(async (data: any) => {
    const code = data.code || data.data?.code;
    const redirectUrl = data.redirectUrl || data.data?.redirectUrl;
    if (code === "MOCK_AUTH_CODE_FOR_DEMO") {
        await db.collection("system_secrets").doc("microsoft_auth").set({ refreshToken: "mock_refresh_token", userName: "Demo User", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return { success: true };
    }
    const params = new URLSearchParams();
    params.append('client_id', process.env.MS_CLIENT_ID || '');
    params.append('scope', SCOPES.join(' '));
    params.append('code', code);
    params.append('redirect_uri', redirectUrl);
    params.append('grant_type', 'authorization_code');
    params.append('client_secret', process.env.MS_CLIENT_SECRET || '');
    const response = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID || 'common' ? process.env.MS_TENANT_ID : 'common'}/oauth2/v2.0/token`, { method: 'POST', body: params });
    const tokens = await response.json();
    if (tokens.error) throw new Error(tokens.error_description);
    await db.collection("system_secrets").doc("microsoft_auth").set({ refreshToken: tokens.refresh_token, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
});

export const createMsTeam = functions.https.onCall(async (data: any) => {
    const payload = data.data || data;
    const accessToken = await getAccessToken();
    if (accessToken === "MOCK_TOKEN") return { teamId: "mock-team-id" };
    const teamRes = await fetch("https://graph.microsoft.com/v1.0/teams", { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "template@odata.bind": "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
            "displayName": `${payload.subject} [${payload.refCode}]`,
            "description": `Class Team for ${payload.subject}`
        })
    });
    const location = teamRes.headers.get('Content-Location');
    const teamId = location?.match(/teams\(['"]?([a-fA-F0-9\-]+)['"]?\)/)?.[1] || "";
    return { teamId };
});

export const createMsChannelMeeting = functions.https.onCall(async (data: any) => {
    const payload = data.data || data;
    const accessToken = await getAccessToken();
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "subject": `[${payload.refCode}] ${payload.subject}`,
            "start": { "dateTime": `${payload.startDate}T${payload.startTime}:00`, "timeZone": "Central America Standard Time" },
            "end": { "dateTime": `${payload.startDate}T${payload.endTime}:00`, "timeZone": "Central America Standard Time" },
            "isOnlineMeeting": true,
            "onlineMeetingProvider": "teamsForBusiness"
        })
    });
    const json = await res.json();
    const joinUrl = json.onlineMeeting?.joinUrl;

    if (joinUrl) {
        try {
            const filterUrl = `https://graph.microsoft.com/v1.0/me/onlineMeetings?$filter=JoinWebUrl eq '${joinUrl}'`;
            const getMeetingRes = await fetch(filterUrl, { 
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` } 
            });
            const getMeetingJson = await getMeetingRes.json();

            if (getMeetingJson.value && getMeetingJson.value.length > 0) {
                const meetingId = getMeetingJson.value[0].id;
                await fetch(`https://graph.microsoft.com/v1.0/me/onlineMeetings/${meetingId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        "recordAutomatically": true,
                        "allowedPresenters": "everyone"
                    })
                });
            }
        } catch (patchError) {
            console.error("❌ Failed to enable auto-recording:", patchError);
        }
    }

    return { success: true, joinWebUrl: joinUrl };
});

export const cleanupCalendarEvents = functions.https.onCall(async () => {
    const accessToken = await getAccessToken();
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events?$select=id,subject&$top=50`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const json = await res.json();
    let count = 0;
    for (const evt of (json.value || [])) {
        if (evt.subject?.startsWith("Clase Online:") || evt.subject?.startsWith("[")) {
            await fetch(`https://graph.microsoft.com/v1.0/me/events/${evt.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } });
            count++;
        }
    }
    return { success: true, count };
});

export const disconnectMicrosoft = functions.https.onCall(async () => {
    await db.collection("system_secrets").doc("microsoft_auth").delete();
    return { success: true };
});

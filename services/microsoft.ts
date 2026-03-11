import { functions } from '../firebase';

export const generateRefCode = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomStr = '';
    for (let i = 0; i < 4; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `GA-${year}${month}-${randomStr}`;
};

export interface TeamsMeetingResponse {
    joinWebUrl: string;
    teamId: string;
    channelId?: string;
    eventId?: string;
}

export const linkMicrosoftAccount = async (): Promise<void> => {
    const getAuthUrlFn = functions.httpsCallable('getMSAuthUrl');
    const origin = window.location.origin;
    const redirectUrl = `${origin}/portal/settings`;
    const result = await getAuthUrlFn({ redirectUrl: redirectUrl });
    const data = result.data as { url: string };
    if (data && data.url) {
        window.location.href = data.url;
    } else {
        throw new Error("No URL returned from backend");
    }
};

export const exchangeMsCode = async (code: string): Promise<boolean> => {
    const exchangeFn = functions.httpsCallable('exchangeMsToken');
    const origin = window.location.origin;
    const redirectUrl = `${origin}/portal/settings`;
    await exchangeFn({ code: code, redirectUrl: redirectUrl });
    return true;
};

// --- STEP 1: Create Team Only (Fast) ---
export const createTeamsTeam = async (subject: string, refCode: string): Promise<string> => {
    console.log("🔵 [Step 1] Creating Team...");
    const createTeamFn = functions.httpsCallable('createMsTeam');
    const teamRes = await createTeamFn({ subject, refCode });
    const { teamId } = teamRes.data as { teamId: string };
    return teamId;
};

// --- STEP 2: Create Schedule in Team (Delayed/Retried) ---
export const createTeamsChannelEvent = async (
    teamId: string,
    subject: string, 
    startTime: string,
    endTime: string,
    startDate: string,
    endDate: string,
    days: string[],
    refCode?: string
): Promise<string> => {
    console.log("🔵 [Step 2] Creating Event in Team:", teamId);
    
    const createMeetingFn = functions.httpsCallable('createMsChannelMeeting');
    const payload = { teamId, subject, startTime, endTime, startDate, endDate, days, refCode };

    // Retry logic is better handled by UI/Circuit Breaker, but we do one soft retry here
    try {
        const meetingRes = await createMeetingFn(payload);
        const response = meetingRes.data as any;
        
        if (response.success && response.joinWebUrl) {
            console.log("✅ Schedule Created!", response);
            return response.joinWebUrl;
        } else {
            throw new Error(response.error || "Failed to get join link");
        }
    } catch (e: any) {
        console.error("Event creation failed:", e);
        throw e;
    }
};

// --- LEGACY WRAPPER (For compatibility if needed) ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const createTeamsMeeting = async (
    subject: string, 
    refCode: string, 
    startTime: string,
    endTime: string,
    startDate: string,
    endDate: string,
    days: string[],
    category: string,
    categoryName: string
): Promise<TeamsMeetingResponse> => {
    // 1. Create Team
    const teamId = await createTeamsTeam(subject, refCode);
    
    // 2. Wait slightly
    await wait(2000); 

    // 3. Create Event
    const joinWebUrl = await createTeamsChannelEvent(teamId, subject, startTime, endTime, startDate, endDate, days, refCode);

    return {
        teamId,
        joinWebUrl,
        channelId: "auto-generated",
        eventId: "auto-generated"
    };
};

export const disconnectMicrosoftAccount = async (): Promise<void> => {
    const disconnectFn = functions.httpsCallable('disconnectMicrosoft');
    await disconnectFn();
}
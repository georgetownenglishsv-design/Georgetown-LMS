
import { db, firebase, functions } from '../firebase';
import { Student, Category, Course, AppUser, SystemSettings, Exam, ExamRegistration, Teacher, ClassSession, AttendanceRecord, CourseDetail, WebExamLanding, WebExamDetail, Testimonial, GlobalFAQ, WebStoreConfig, WebLandingConfig, BrandInfo, SystemLog, MessageTemplate, Question, PlacementResult, DailyQuiz, StudentPackage, PackageSlot } from '../types';
import { generateRefCode } from './microsoft';

// Re-export firebase instances
export { db, firebase, functions };

// --- DAILY QUIZ SERVICES ---
export const batchSaveDailyQuizzes = async (quizzes: DailyQuiz[]) => {
    const batch = db.batch();
    quizzes.forEach(q => {
        const ref = db.collection('daily_quizzes').doc(q.id);
        batch.set(ref, q);
    });
    await batch.commit();
};

export const updateDailyQuiz = async (id: string, data: Partial<DailyQuiz>) => {
    await db.collection('daily_quizzes').doc(id).update(data);
};

export const deleteDailyQuiz = async (id: string) => {
    await db.collection('daily_quizzes').doc(id).delete();
};

export const deleteAllDailyQuizzes = async () => {
    const snapshot = await db.collection('daily_quizzes').get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
};

export const getDailyQuizByDay = async (dayOfYear: number): Promise<DailyQuiz | null> => {
    try {
        const id = dayOfYear.toString();
        const doc = await db.collection('daily_quizzes').doc(id).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() } as DailyQuiz;
        }
        const snap = await db.collection('daily_quizzes').limit(1).get();
        if (!snap.empty) {
            return { id: snap.docs[0].id, ...snap.docs[0].data() } as DailyQuiz;
        }
        return null;
    } catch (e) {
        console.error("Error getting daily quiz", e);
        return null;
    }
};

export const getAllDailyQuizzes = async (): Promise<DailyQuiz[]> => {
    try {
        const snapshot = await db.collection('daily_quizzes').get();
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as DailyQuiz))
            .sort((a, b) => parseInt(a.id) - parseInt(b.id));
    } catch (e) {
        return [];
    }
};

export const getUsedQuizTopics = async (): Promise<string[]> => {
    try {
        const snapshot = await db.collection('quiz_history')
            .orderBy('date', 'desc')
            .limit(5) 
            .get();
        let topics: string[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (Array.isArray(data.topics)) {
                topics = [...topics, ...data.topics];
            }
        });
        return topics;
    } catch (e) {
        return [];
    }
};

export const saveUsedQuizTopics = async (topics: string[]) => {
    try {
        await db.collection('quiz_history').add({
            date: new Date().toISOString(),
            topics: topics,
            count: topics.length
        });
    } catch (e) {
        console.error("Failed to save history", e);
    }
};

// --- STUDENT SERVICES ---
export const getStudents = async (): Promise<Student[]> => { 
    try { 
        const snapshot = await db.collection('students').orderBy('date', 'desc').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)); 
    } catch (error) { 
        return []; 
    } 
};

export const addStudent = async (student: Omit<Student, 'id'>) => { 
    const initialData = { ...student, status: 'Pendiente', isArchived: false }; 
    const docRef = await db.collection('students').add(initialData); 
    return docRef.id; 
};

export const updateStudent = async (id: string, data: Partial<Student>) => { 
    await db.collection('students').doc(id).update(data); 
};

export const deleteStudent = async (id: string) => { 
    await db.collection('students').doc(id).delete(); 
};

export const authenticateStudent = async (email: string, lastNameInput: string): Promise<{ student: Student, token: string } | null> => {
    try {
        const snapshot = await db.collection('students').where('email', '==', email).where('status', 'in', ['Activo', 'Pagado', 'Graduado']).limit(1).get();
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        const student = { id: doc.id, ...doc.data() } as Student;
        const input = lastNameInput.trim().toLowerCase();
        
        // Robust check: match lastName if exists, otherwise fallback to check if name contains input
        if (student.lastName) { 
            if (student.lastName.toLowerCase().trim() !== input) return null; 
        } else { 
            if (!student.name.toLowerCase().includes(input)) return null; 
        }
        
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        await db.collection('students').doc(student.id).update({ sessionToken: token });
        return { student, token };
    } catch (e) { return null; }
};

export const verifyStudentSession = async (studentId: string, token: string): Promise<boolean> => { 
    try { 
        const doc = await db.collection('students').doc(studentId).get(); 
        if (!doc.exists) return false; 
        const data = doc.data() as Student; 
        return data.sessionToken === token; 
    } catch (e) { return false; } 
};

// [CRITICAL FIX] Use CourseIDs + Client-Side Sorting (No Index Required)
export const getStudentSchedule = async (courseIds: string[]): Promise<ClassSession[]> => { 
    try { 
        if (!courseIds || courseIds.length === 0) return []; 
        
        // 1. Fetch by courseId WITHOUT sorting in DB (Avoids "Missing Index" error)
        // Note: Firestore 'in' query supports up to 10 items. If courseIds > 10, needs chunking. 
        // Assuming student has few courses for now. Mapping promises for safety.
        const queries = courseIds.map(cId => 
            db.collection('class_sessions')
              .where('courseId', '==', cId)
              .limit(100) // Safety limit
              .get()
        ); 
        
        const snapshots = await Promise.all(queries); 
        let allSessions: ClassSession[] = []; 
        
        snapshots.forEach(snap => { 
            const courseSessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassSession)); 
            allSessions = [...allSessions, ...courseSessions]; 
        }); 
        
        // 2. Remove duplicates (just in case of overlapping queries, though unlikely here)
        const uniqueSessions = Array.from(new Map(allSessions.map(item => [item.id, item])).values()); 
        
        // 3. Sort in Memory (Safe & Robust against missing indexes)
        uniqueSessions.sort((a, b) => { 
            if (a.date !== b.date) return a.date.localeCompare(b.date); 
            return a.startTime.localeCompare(b.startTime); 
        }); 
        
        return uniqueSessions; 
    } catch (e) { 
        console.error("Schedule Fetch Error:", e);
        return []; 
    } 
};

export const logStudentEntry = async (studentId: string, classSessionId: string) => { 
    try { 
        await db.collection('student_entry_logs').add({ studentId, classSessionId, enteredAt: new Date().toISOString(), deviceInfo: navigator.userAgent }); 
    } catch (e) { console.error("Log entry failed", e); } 
};

// --- CATEGORY SERVICES ---
export const getCategories = async (): Promise<Category[]> => { 
    try { 
        const snapshot = await db.collection('categories').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)).sort((a, b) => (a.order || 999) - (b.order || 999)); 
    } catch (error) { return []; } 
};
export const addCategory = async (category: Omit<Category, 'id'>) => { 
    const docRef = await db.collection('categories').add(category); 
    return docRef.id; 
};
export const updateCategory = async (id: string, data: Partial<Category>) => { 
    await db.collection('categories').doc(id).update(data); 
};
export const deleteCategory = async (id: string) => { 
    await db.collection('categories').doc(id).delete(); 
};

// --- COURSE SERVICES ---
export const getCourses = async (includeArchived: boolean = false): Promise<Course[]> => { 
    try { 
        let query: any = db.collection('courses'); 
        if (!includeArchived) { 
            query = query.where('status', 'in', ['Active', 'Draft', 'Concluded']); 
        } 
        const snapshot = await query.get(); 
        return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Course)).sort((a: Course, b: Course) => (a.order || 999) - (b.order || 999)); 
    } catch (error) { return []; } 
};
export const getArchivedCourses = async (): Promise<Course[]> => { 
    try { 
        const snapshot = await db.collection('courses').where('status', '==', 'Archived').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)); 
    } catch(e) { return []; } 
};
export const getCourseById = async (id: string): Promise<Course | null> => { 
    try { 
        const doc = await db.collection('courses').doc(id).get(); 
        if (doc.exists) return { id: doc.id, ...doc.data() } as Course; 
        return null; 
    } catch (error) { return null; } 
};
export const addCourse = async (course: Omit<Course, 'id'>) => { 
    const docRef = await db.collection('courses').add(course); 
    return docRef.id; 
};
export const updateCourse = async (id: string, data: Partial<Course>) => { 
    await db.collection('courses').doc(id).update(data); 
};
export const restoreCourseToDraft = async (id: string) => { 
    await db.collection('courses').doc(id).update({ status: 'Draft' }); 
};

export const getStudentCountByCourse = async (courseId: string): Promise<number> => { 
    try { 
        // Use courseId for accurate count
        const snap = await db.collection('students').where('courseId', '==', courseId).get(); 
        return snap.size; 
    } catch (e) { return 0; } 
};

export const deleteCourseWithStudents = async (id: string, courseName: string, includeStudents: boolean) => { 
    const batch = db.batch(); 
    const courseRef = db.collection('courses').doc(id); 
    batch.delete(courseRef); 
    
    const sessions = await db.collection('class_sessions').where('courseId', '==', id).get(); 
    sessions.forEach(doc => batch.delete(doc.ref)); 
    
    const detailRef = db.collection('course_details').doc(id); 
    batch.delete(detailRef); 
    
    if (includeStudents) { 
        // Delete using courseId
        const studentsSnap = await db.collection('students').where('courseId', '==', id).get(); 
        studentsSnap.forEach(doc => { 
            const data = doc.data(); 
            if (!data.role) { batch.delete(doc.ref); } 
        }); 
    } 
    await batch.commit(); 
};

export const deleteCourse = async (id: string) => { await deleteCourseWithStudents(id, '', false); };

export const batchRolloverCourses = async (targetDateStart: string, targetDateEnd: string, courseIdsToClone: string[]): Promise<number> => { 
    try { 
        const batch = db.batch(); 
        let count = 0; 
        for (const courseId of courseIdsToClone) { 
            const courseDoc = await db.collection('courses').doc(courseId).get(); 
            if (!courseDoc.exists) continue; 
            const courseData = courseDoc.data() as Course; 
            const newCourseRef = db.collection('courses').doc(); 
            
            // FIX: Initialize with empty string instead of undefined to avoid Firestore error
            let newRefCode = ""; 
            if (courseData.mode === 'online') { 
                newRefCode = generateRefCode(); 
            } 
            
            const newCourse: Omit<Course, 'id'> = { 
                ...courseData, 
                startDate: targetDateStart, 
                endDate: targetDateEnd, 
                status: 'Draft', 
                rolloverParentId: courseId, 
                refCode: newRefCode, 
                meetingLink: "", 
                teamsProvisioningStatus: 'Ready', 
                teamsTeamId: "", 
                teamsCreatedAt: 0 
            }; 
            batch.set(newCourseRef, newCourse); 
            const detailDoc = await db.collection('course_details').doc(courseId).get(); 
            if (detailDoc.exists) { 
                const detailData = detailDoc.data() as CourseDetail; 
                const newDetailRef = db.collection('course_details').doc(newCourseRef.id); 
                const { id, ...detailContent } = detailData; 
                batch.set(newDetailRef, { ...detailContent, id: newCourseRef.id }); 
            } 
            count++; 
        } 
        await batch.commit(); 
        return count; 
    } catch (e) { throw e; } 
};

// --- CLASS SESSION SERVICES ---
export const getAllClassSessions = async (): Promise<ClassSession[]> => { 
    try { 
        const snapshot = await db.collection('class_sessions').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassSession)); 
    } catch (e) { return []; } 
};
export const getCourseSessions = async (courseId: string): Promise<ClassSession[]> => { 
    try { 
        const snapshot = await db.collection('class_sessions').where('courseId', '==', courseId).get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassSession)); 
    } catch (e) { return []; } 
};
export const getTeacherClasses = async (teacherId: string): Promise<ClassSession[]> => { 
    try { 
        const snapshot = await db.collection('class_sessions').where('teacherId', '==', teacherId).get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassSession)); 
    } catch (e) { return []; } 
};
export const getTeacherClassById = async (classId: string): Promise<ClassSession | null> => { 
    try { 
        const doc = await db.collection('class_sessions').doc(classId).get(); 
        if (doc.exists) return { id: doc.id, ...doc.data() } as ClassSession; 
        return null; 
    } catch (e) { return null; } 
};
export const addClassSession = async (session: Omit<ClassSession, 'id'>) => { 
    const ref = await db.collection('class_sessions').add(session); 
    return ref.id; 
};
export const updateClassSession = async (id: string, data: Partial<ClassSession>) => { 
    await db.collection('class_sessions').doc(id).update(data); 
};
export const deleteClassSession = async (id: string) => { 
    await db.collection('class_sessions').doc(id).delete(); 
};
export const batchCreateSessions = async (sessions: Omit<ClassSession, 'id'>[]) => { 
    const chunkSize = 400; 
    for (let i = 0; i < sessions.length; i += chunkSize) { 
        const chunk = sessions.slice(i, i + chunkSize); 
        const chunkBatch = db.batch(); 
        chunk.forEach(session => { 
            const ref = db.collection('class_sessions').doc(); 
            chunkBatch.set(ref, session); 
        }); 
        await chunkBatch.commit(); 
    } 
};
export const batchReassignTeacher = async (courseId: string, startDate: string, endDate: string, newTeacherId: string, newTeacherName: string, currentTeacherId?: string): Promise<number> => { 
    try { 
        let query = db.collection('class_sessions').where('courseId', '==', courseId); 
        if (currentTeacherId && currentTeacherId !== 'all') { 
            query = query.where('teacherId', '==', currentTeacherId); 
        } 
        const snapshot = await query.get(); 
        if (snapshot.empty) return 0; 
        const docsToUpdate = snapshot.docs.filter(doc => { 
            const data = doc.data(); 
            return data.date >= startDate && data.date <= endDate; 
        }); 
        if (docsToUpdate.length === 0) return 0; 
        const chunkSize = 400; 
        let updatedCount = 0; 
        for (let i = 0; i < docsToUpdate.length; i += chunkSize) { 
            const chunk = docsToUpdate.slice(i, i + chunkSize); 
            const batch = db.batch(); 
            chunk.forEach(doc => { 
                batch.update(doc.ref, { teacherId: newTeacherId, teacherName: newTeacherName }); 
            }); 
            await batch.commit(); 
            updatedCount += chunk.length; 
        } 
        return updatedCount; 
    } catch (e) { throw e; } 
};
export const batchDeleteSessions = async (courseId: string, startDate: string, endDate: string): Promise<number> => { 
    try { 
        const query = db.collection('class_sessions').where('courseId', '==', courseId); 
        const snapshot = await query.get(); 
        if (snapshot.empty) return 0; 
        const docsToDelete = snapshot.docs.filter(doc => { 
            const data = doc.data(); 
            return data.date >= startDate && data.date <= endDate; 
        }); 
        if (docsToDelete.length === 0) return 0; 
        const chunkSize = 400; 
        let deletedCount = 0; 
        for (let i = 0; i < docsToDelete.length; i += chunkSize) { 
            const chunk = docsToDelete.slice(i, i + chunkSize); 
            const batch = db.batch(); 
            chunk.forEach(doc => { 
                batch.delete(doc.ref); 
            }); 
            await batch.commit(); 
            deletedCount += chunk.length; 
        } 
        return deletedCount; 
    } catch (e) { throw e; } 
};
export const batchDeleteSessionsByIds = async (ids: string[]) => { 
    try { 
        const chunkSize = 400; 
        for (let i = 0; i < ids.length; i += chunkSize) { 
            const chunk = ids.slice(i, i + chunkSize); 
            const batch = db.batch(); 
            chunk.forEach(id => { 
                batch.delete(db.collection('class_sessions').doc(id)); 
            }); 
            await batch.commit(); 
        } 
    } catch (e) { throw e; } 
};
export const checkTeacherAvailability = async (teacherId: string, date: string, startTime: string, endTime: string, excludeSessionId?: string): Promise<boolean> => { 
    const snapshot = await db.collection('class_sessions').where('teacherId', '==', teacherId).where('date', '==', date).get(); 
    if (snapshot.empty) return true; 
    const newStart = parseInt(startTime.replace(':', '')); 
    const newEnd = parseInt(endTime.replace(':', '')); 
    for (const doc of snapshot.docs) { 
        if (excludeSessionId && doc.id === excludeSessionId) continue; 
        const existing = doc.data() as ClassSession; 
        if (existing.status === 'Cancelada') continue; 
        const existStart = parseInt(existing.startTime.replace(':', '')); 
        const existEnd = parseInt(existing.endTime.replace(':', '')); 
        if (newStart < existEnd && newEnd > existStart) { return false; } 
    } 
    return true; 
};

// --- ATTENDANCE SERVICES ---
export const getTeacherAttendanceHistory = async (teacherId: string): Promise<AttendanceRecord[]> => { 
    try { 
        const snapshot = await db.collection('attendance_records').where('teacherId', '==', teacherId).get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 
    } catch (e) { return []; } 
};
export const markAttendance = async (record: Omit<AttendanceRecord, 'id'>) => { 
    await db.collection('attendance_records').add(record); 
};
export const updateAttendanceRecord = async (id: string, record: Partial<AttendanceRecord>) => { 
    await db.collection('attendance_records').doc(id).update(record); 
};
export const deleteAttendanceRecord = async (id: string) => { 
    await db.collection('attendance_records').doc(id).delete(); 
};

// --- CMS & WEB SERVICES ---
export const getCourseDetail = async (courseId: string, baseCourse?: Course): Promise<CourseDetail | null> => { 
    try { 
        const doc = await db.collection('course_details').doc(courseId).get(); 
        if (doc.exists) return { id: doc.id, ...doc.data() } as CourseDetail; 
        if (baseCourse) { 
            return { 
                id: courseId, 
                heroImage: baseCourse.image || '', 
                longDescription: baseCourse.description || '', 
                level: 'General', 
                duration: '4 Semanas', 
                rating: 5.0, 
                reviewCount: 0, 
                learningPoints: ['Metodología comunicativa', 'Profesores certificados', 'Horarios flexibles'] 
            }; 
        } 
        return null; 
    } catch (e) { return null; } 
};
export const saveCourseDetail = async (courseId: string, detail: CourseDetail) => { 
    await db.collection('course_details').doc(courseId).set(detail, { merge: true }); 
};
export const getTestimonials = async (): Promise<Testimonial[]> => { 
    try { 
        const snapshot = await db.collection('testimonials').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Testimonial)); 
    } catch (e) { return []; } 
};
export const getTestimonialsByCategory = async (category: string): Promise<Testimonial[]> => { 
    try { 
        const snapshot = await db.collection('testimonials').where('category', '==', category).get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Testimonial)); 
    } catch (e) { return []; } 
};
export const addTestimonial = async (t: Omit<Testimonial, 'id'>) => { 
    await db.collection('testimonials').add(t); 
};
export const updateTestimonial = async (id: string, t: Partial<Testimonial>) => { 
    await db.collection('testimonials').doc(id).update(t); 
};
export const deleteTestimonial = async (id: string) => { 
    await db.collection('testimonials').doc(id).delete(); 
};
export const getFAQs = async (): Promise<GlobalFAQ[]> => { 
    try { 
        const snapshot = await db.collection('faqs').orderBy('order').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalFAQ)); 
    } catch (e) { return []; } 
};
export const getFAQsByCategory = async (category: string): Promise<GlobalFAQ[]> => { 
    try { 
        const snapshot = await db.collection('faqs').where('category', '==', category).get(); 
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GlobalFAQ)); 
        return list.sort((a, b) => a.order - b.order); 
    } catch (e) { return []; } 
};
export const addFAQ = async (f: Omit<GlobalFAQ, 'id'>) => { 
    await db.collection('faqs').add(f); 
};
export const updateFAQ = async (id: string, f: Partial<GlobalFAQ>) => { 
    await db.collection('faqs').doc(id).update(f); 
};
export const deleteFAQ = async (id: string) => { 
    await db.collection('faqs').doc(id).delete(); 
};
export const getWebExamLandings = async (): Promise<WebExamLanding[]> => { 
    try { 
        const snapshot = await db.collection('web_exam_landings').orderBy('order').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WebExamLanding)); 
    } catch (e) { return []; } 
};
export const saveWebExamLanding = async (data: Omit<WebExamLanding, 'id'> | WebExamLanding) => { 
    const { id, ...rest } = data as WebExamLanding; 
    if (id) { 
        await db.collection('web_exam_landings').doc(id).update(rest); 
    } else { 
        await db.collection('web_exam_landings').add(rest); 
    } 
};
export const deleteWebExamLanding = async (id: string) => { 
    await db.collection('web_exam_landings').doc(id).delete(); 
};
export const getWebExamDetails = async (): Promise<WebExamDetail[]> => { 
    try { 
        const snapshot = await db.collection('web_exam_details').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WebExamDetail)); 
    } catch (e) { return []; } 
};
export const getWebExamDetailById = async (id: string): Promise<WebExamDetail | null> => { 
    try { 
        const doc = await db.collection('web_exam_details').doc(id).get(); 
        if (doc.exists) return { id: doc.id, ...doc.data() } as WebExamDetail; 
        return null; 
    } catch (e) { return null; } 
};
export const saveWebExamDetail = async (data: Omit<WebExamDetail, 'id'> | WebExamDetail) => { 
    const { id, ...rest } = data as WebExamDetail; 
    if (id) { 
        await db.collection('web_exam_details').doc(id).set(rest, {merge: true}); 
    } else { 
        await db.collection('web_exam_details').add(rest); 
    } 
};
export const deleteWebExamDetail = async (id: string) => { 
    await db.collection('web_exam_details').doc(id).delete(); 
};
export const getWebStoreConfig = async (): Promise<WebStoreConfig> => { 
    try { 
        const doc = await db.collection('settings').doc('web_store_config').get(); 
        if (doc.exists) { 
            return doc.data() as WebStoreConfig; 
        } else { 
            return { 
                hero: { title: 'Prepárate para el Éxito', subtitle: '20% OFF en todos los paquetes este mes.', linkedItemId: '', linkedItemType: 'course' }, 
                featured: { 
                    slot1: { itemId: '', itemType: 'course' }, 
                    slot2: { itemId: '', itemType: 'course' }, 
                    slot3: { itemId: '', itemType: 'course' }, 
                    slot4: { itemId: '', itemType: 'course' }, 
                }, 
                privateClass: { title: 'Clases Privadas VIP', description: 'Pack de 10 sesiones personalizadas.', price: 300, linkedItemId: '', linkedItemType: 'course' } 
            }; 
        } 
    } catch (e) { 
        return { 
            hero: { title: 'Prepárate para el Éxito', subtitle: '20% OFF en todos los paquetes este mes.', linkedItemId: '', linkedItemType: 'course' }, 
            featured: { 
                slot1: { itemId: '', itemType: 'course' }, 
                slot2: { itemId: '', itemType: 'course' }, 
                slot3: { itemId: '', itemType: 'course' }, 
                slot4: { itemId: '', itemType: 'course' }, 
            }, 
            privateClass: { title: 'Clases Privadas VIP', description: 'Pack de 10 sesiones personalizadas.', price: 300, linkedItemId: '', linkedItemType: 'course' } 
        }; 
    } 
};
export const saveWebStoreConfig = async (config: WebStoreConfig) => { 
    await db.collection('settings').doc('web_store_config').set(config, { merge: true }); 
};
export const getWebLandingConfig = async (): Promise<WebLandingConfig> => { 
    try { 
        const doc = await db.collection('settings').doc('web_landing_config').get(); 
        if (doc.exists) { 
            return doc.data() as WebLandingConfig; 
        } else { 
            return { 
                slides: [ 
                    { id: 'slide-1', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPkw1Eh9Gn22m4067xKfUfCwTbzF3FuaXlxmNRmE7GqNpLBL1VZcKH8SRHAvoad0rR_tnuIrqwgB9QrD1DhiugSxMTk0gpPP_k9ySSH1gh1qyljV1kx6LYZEaJcPZKGOjJ_RyJlqnA26GGP-3RhkInwx4Kk5VcRgETerqiDei_CcTkS9AEoco3w4T3Od7-OZGDhkv-dSpIdI_QjfRJ48acn5MX7WJCMZWyt3cMHiE0gtCuGZmie7-QIFXhgh1wZdKeZMSJDJW8lFM', title: 'Domina el inglés con elegancia', subtitle: 'La academia de idiomas premier de El Salvador. Prepárate para el éxito internacional.', buttonText: 'Inicia tu viaje', link: '/enroll', order: 1 } 
                ] 
            }; 
        } 
    } catch (e) { 
        return { 
            slides: [ 
                { id: 'slide-1', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPkw1Eh9Gn22m4067xKfUfCwTbzF3FuaXlxmNRmE7GqNpLBL1VZcKH8SRHAvoad0rR_tnuIrqwgB9QrD1DhiugSxMTk0gpPP_k9ySSH1gh1qyljV1kx6LYZEaJcPZKGOjJ_RyJlqnA26GGP-3RhkInwx4Kk5VcRgETerqiDei_CcTkS9AEoco3w4T3Od7-OZGDhkv-dSpIdI_QjfRJ48acn5MX7WJCMZWyt3cMHiE0gtCuGZmie7-QIFXhgh1wZdKeZMSJDJW8lFM', title: 'Domina el inglés con elegancia', subtitle: 'La academia de idiomas premier de El Salvador. Prepárate para el éxito internacional.', buttonText: 'Inicia tu viaje', link: '/enroll', order: 1 } 
            ] 
        }; 
    } 
};
export const saveWebLandingConfig = async (config: WebLandingConfig) => { 
    await db.collection('settings').doc('web_landing_config').set(config, { merge: true }); 
};
export const getBrandInfo = async (): Promise<BrandInfo> => { 
    try { 
        const cached = localStorage.getItem('gtea_brand_info'); 
        if(cached) return JSON.parse(cached); 
    } catch(e) {} 
    try { 
        const doc = await db.collection('settings').doc('brand_info').get(); 
        if(doc.exists) { 
            const data = doc.data() as BrandInfo; 
            localStorage.setItem('gtea_brand_info', JSON.stringify(data)); 
            return data; 
        } 
    } catch(e) { } 
    return { name: 'Georgetown Academy', tagline: 'Language Institute', address: 'Centro Comercial Loma Linda, Local# 31D, San Benito, San Salvador, El Salvador', phonePrimary: '+503 2231-1790', phoneSecondary: '+503 7680-5577', email: 'info@GeorgeTownENGLISH.com', facebookUrl: 'https://www.facebook.com/georgetown.academy/', instagramUrl: 'https://www.instagram.com/georgetown.academy/', whatsappNumber: '50376805577', mapUrl: 'https://www.google.com/maps/search/?api=1&query=Georgetown+Academy,+Centro+Comercial+Loma+Linda', wazeUrl: 'https://waze.com/ul?q=Georgetown%20Academy%20El%20Salvador&navigate=yes' }; 
};
export const saveBrandInfo = async (info: BrandInfo) => { 
    await db.collection('settings').doc('brand_info').set(info); 
    localStorage.setItem('gtea_brand_info', JSON.stringify(info)); 
    window.dispatchEvent(new CustomEvent('brand-updated', { detail: info })); 
};
export const getMessageTemplates = async (): Promise<MessageTemplate[]> => { 
    try { 
        const snapshot = await db.collection('message_templates').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageTemplate)); 
    } catch (e) { return []; } 
};
export const saveMessageTemplate = async (template: MessageTemplate) => { 
    if (template.id && template.id.length > 5) { 
        await db.collection('message_templates').doc(template.id).set(template, { merge: true }); 
    } else { 
        await db.collection('message_templates').add(template); 
    } 
};

// --- EXAM SERVICES ---
export const getExams = async (): Promise<Exam[]> => { 
    try { 
        const snapshot = await db.collection('exams').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)).sort((a, b) => (a.order || 999) - (b.order || 999)); 
    } catch (error) { return []; } 
};
export const addExam = async (exam: Omit<Exam, 'id' | 'enrolled' | 'paidCount' | 'pendingCount'>) => { 
    const data = { ...exam, enrolled: 0, paidCount: 0, pendingCount: 0, status: exam.status || 'Active' }; 
    const docRef = await db.collection('exams').add(data); 
    return docRef.id; 
};
export const updateExam = async (id: string, data: Partial<Exam>) => { 
    await db.collection('exams').doc(id).update(data); 
};
export const deleteExam = async (id: string) => { 
    await db.collection('exams').doc(id).delete(); 
};
export const getExamRegistrations = async (examId: string): Promise<ExamRegistration[]> => { 
    const snapshot = await db.collection('exam_registrations').where('examId', '==', examId).get(); 
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamRegistration)); 
};
export const getAllGlobalExamRegistrations = async (): Promise<ExamRegistration[]> => { 
    const snapshot = await db.collection('exam_registrations').get(); 
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamRegistration)); 
};
export const addExamRegistration = async (registration: Omit<ExamRegistration, 'id'>) => { 
    const initialData = { ...registration, paymentStatus: 'Pendiente' }; 
    await db.runTransaction(async (transaction) => { 
        const regRef = db.collection('exam_registrations').doc(); 
        transaction.set(regRef, initialData); 
        const examRef = db.collection('exams').doc(registration.examId); 
        transaction.update(examRef, { enrolled: firebase.firestore.FieldValue.increment(1), pendingCount: firebase.firestore.FieldValue.increment(1) }); 
    }); 
    return true; 
};
export const updateExamRegistration = async (id: string, data: Partial<ExamRegistration>) => { 
    await db.runTransaction(async (transaction) => { 
        const regRef = db.collection('exam_registrations').doc(id); 
        const doc = await transaction.get(regRef); 
        if (!doc.exists) throw new Error("Document does not exist!"); 
        const currentData = doc.data() as ExamRegistration; 
        const newStatus = data.paymentStatus; 
        if (newStatus && newStatus !== currentData.paymentStatus) { 
            const examRef = db.collection('exams').doc(currentData.examId); 
            if (currentData.paymentStatus === 'Pendiente' && newStatus === 'Confirmado') { 
                transaction.update(examRef, { pendingCount: firebase.firestore.FieldValue.increment(-1), paidCount: firebase.firestore.FieldValue.increment(1) }); 
            } else if (currentData.paymentStatus === 'Confirmado' && newStatus === 'Pendiente') { 
                transaction.update(examRef, { pendingCount: firebase.firestore.FieldValue.increment(1), paidCount: firebase.firestore.FieldValue.increment(-1) }); 
            } 
        } 
        transaction.update(regRef, data); 
    }); 
};
export const toggleExamPaymentStatus = async (regId: string, examId: string) => { 
    await db.runTransaction(async (transaction) => { 
        const regRef = db.collection('exam_registrations').doc(regId); 
        const examRef = db.collection('exams').doc(examId); 
        const regDoc = await transaction.get(regRef); 
        if (!regDoc.exists) throw new Error("Registration not found"); 
        const currentData = regDoc.data() as ExamRegistration; 
        const currentStatus = currentData.paymentStatus; 
        const newStatus = currentStatus === 'Confirmado' ? 'Pendiente' : 'Confirmado'; 
        transaction.update(regRef, { paymentStatus: newStatus }); 
        if (newStatus === 'Confirmado') { 
            transaction.update(examRef, { pendingCount: firebase.firestore.FieldValue.increment(-1), paidCount: firebase.firestore.FieldValue.increment(1) }); 
        } else { 
            transaction.update(examRef, { pendingCount: firebase.firestore.FieldValue.increment(1), paidCount: firebase.firestore.FieldValue.increment(-1) }); 
        } 
    }); 
    return true; 
};
export const deleteExamRegistration = async (regId: string, examId: string) => { 
    await db.runTransaction(async (transaction) => { 
        const regRef = db.collection('exam_registrations').doc(regId); 
        const doc = await transaction.get(regRef); 
        if (!doc.exists) return; 
        const actualStatus = (doc.data() as ExamRegistration).paymentStatus; 
        transaction.delete(regRef); 
        const examRef = db.collection('exams').doc(examId); 
        const updatePayload: any = { enrolled: firebase.firestore.FieldValue.increment(-1) }; 
        if (actualStatus === 'Confirmado') updatePayload.paidCount = firebase.firestore.FieldValue.increment(-1); 
        else updatePayload.pendingCount = firebase.firestore.FieldValue.increment(-1); 
        transaction.update(examRef, updatePayload); 
    }); 
};
export const getRegistrationById = async (regId: string): Promise<ExamRegistration | undefined> => { 
    const doc = await db.collection('exam_registrations').doc(regId).get(); 
    if (doc.exists) return { id: doc.id, ...doc.data() } as ExamRegistration; 
    return undefined; 
};

// --- USER SERVICES ---
export const getUsers = async (): Promise<AppUser[]> => { 
    try { 
        const snapshot = await db.collection('users').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)); 
    } catch (error) { return []; } 
};
export const getTeachers = async (): Promise<Teacher[]> => { 
    try { 
        const snapshot = await db.collection('users').where('role', '==', 'Profesor').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), classCount: 0 } as unknown as Teacher)); 
    } catch (error) { return []; } 
};
export const getTeacherById = async (id: string): Promise<Teacher | null> => { 
    try { 
        const doc = await db.collection('users').doc(id).get(); 
        if (doc.exists) return { id: doc.id, ...doc.data() } as unknown as Teacher; 
        return null; 
    } catch (e) { return null; } 
};
export const getUserByEmail = async (email: string): Promise<AppUser | null> => { 
    try { 
        const snapshot = await db.collection('users').where('email', '==', email).limit(1).get(); 
        if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AppUser; 
        return null; 
    } catch (e) { return null; } 
};
export const addUser = async (user: Omit<AppUser, 'id'>) => { 
    const docRef = await db.collection('users').add(user); 
    return docRef.id; 
};
export const updateUser = async (id: string, data: Partial<AppUser>) => { 
    await db.collection('users').doc(id).update(data); 
};
export const deleteUser = async (id: string) => { 
    const sessions = await db.collection('class_sessions').where('teacherId', '==', id).get(); 
    if(!sessions.empty) throw new Error("Cannot delete user."); 
    await db.collection('users').doc(id).delete(); 
};
export const syncCurrentUserToFirestore = async (firebaseUser: any): Promise<AppUser | null> => { 
    if (!firebaseUser) return null; 
    const fetch = async () => { 
        const userRef = db.collection('users').where('email', '==', firebaseUser.email).limit(1); 
        const snapshot = await userRef.get(); 
        if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AppUser; 
        return null; 
    }; 
    let profile = await fetch(); 
    if (profile) return profile; 
    await new Promise(r => setTimeout(r, 1000)); 
    return await fetch(); 
};
export const validateFirestoreCredential = async (email: string, pass: string): Promise<boolean> => { 
    try { 
        const snapshot = await db.collection('users').where('email', '==', email).limit(1).get(); 
        if (snapshot.empty) return false; 
        return snapshot.docs[0].data().tempPassword === pass; 
    } catch (e) { return false; } 
};

// --- SYSTEM SERVICES ---
export const getSystemSettings = async (): Promise<SystemSettings> => { 
    try { 
        const snapshot = await db.collection('settings').limit(1).get(); 
        if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as SystemSettings; 
        return { emailAlerts: true, systemNotifications: true, paymentAlerts: false, language: 'Español', timezone: 'GMT-6', dateFormat: 'DD/MM/AAAA' }; 
    } catch (e: any) { 
        return { emailAlerts: true, systemNotifications: true, paymentAlerts: false, language: 'Español', timezone: 'GMT-6', dateFormat: 'DD/MM/AAAA' }; 
    } 
};
export const saveSystemSettings = async (settings: SystemSettings) => { 
    if (settings.id) await db.collection('settings').doc(settings.id).update(settings); 
    else await db.collection('settings').add(settings); 
};
export const getSystemLogs = async (): Promise<SystemLog[]> => { 
    try { 
        const snapshot = await db.collection('system_logs').orderBy('timestamp', 'desc').limit(10).get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemLog)); 
    } catch (e) { return []; } 
};
export const cleanupOrphanedRecordings = async (mode: 'scan' | 'delete' | 'master_sync', orphansToDelete?: any[]) => { 
    const cleanupFn = functions.httpsCallable('cleanupOrphanedRecordings'); 
    const result = await cleanupFn({ mode, orphans: orphansToDelete }); 
    return result.data; 
};

// --- PLACEMENT TEST SERVICES ---
export const getPlacementQuestions = async (): Promise<Question[]> => { 
    try { 
        const snapshot = await db.collection('questions').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)); 
    } catch (e) { return []; } 
};
export const savePlacementResult = async (result: Omit<PlacementResult, 'id'>) => { 
    await db.collection('placement_results').add(result); 
};
export const getPlacementResults = async (): Promise<PlacementResult[]> => { 
    try { 
        const snapshot = await db.collection('placement_results').orderBy('date', 'desc').get(); 
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlacementResult)); 
    } catch (e) { return []; } 
};
export const updatePlacementResult = async (id: string, data: Partial<PlacementResult>) => { 
    await db.collection('placement_results').doc(id).update(data); 
};
export const deletePlacementResult = async (id: string) => { 
    await db.collection('placement_results').doc(id).delete(); 
};
export const batchSaveQuestions = async (questions: Omit<Question, 'id'>[]) => { 
    const batch = db.batch(); 
    questions.forEach(q => { 
        const ref = db.collection('questions').doc(); 
        batch.set(ref, q); 
    }); 
    await batch.commit(); 
};
export const updateQuestion = async (id: string, data: Partial<Question>) => { 
    await db.collection('questions').doc(id).update(data); 
};
export const deleteQuestion = async (id: string) => { 
    await db.collection('questions').doc(id).delete(); 
};

// --- UTILS ---
export const getCurrentDateString = () => { 
    const now = new Date(); 
    const year = now.getFullYear(); 
    const month = String(now.getMonth() + 1).padStart(2, '0'); 
    const day = String(now.getDate()).padStart(2, '0'); 
    return `${year}-${month}-${day}`; 
};
export const runCourseLifecycleCheck = async (): Promise<number> => { 
    try { 
        const today = getCurrentDateString(); 
        const snapshot = await db.collection('courses').where('status', 'in', ['Active', 'Concluded']).get(); 
        if (snapshot.empty) return 0; 
        const batch = db.batch(); 
        let updateCount = 0; 
        for (const doc of snapshot.docs) { 
            const course = doc.data() as Course; 
            const { endDate, status, name } = course; 
            if (!endDate) continue; 
            const end = new Date(endDate); 
            const now = new Date(today); 
            const archiveDate = new Date(end); 
            archiveDate.setDate(end.getDate() + 30); 
            let newStatus: Course['status'] = status; 
            if (now <= end) { newStatus = 'Active'; } 
            else if (now > end && now <= archiveDate) { newStatus = 'Concluded'; } 
            else if (now > archiveDate) { newStatus = 'Archived'; } 
            if (newStatus !== status) { 
                batch.update(doc.ref, { status: newStatus }); 
                updateCount++; 
                if (newStatus === 'Archived') { 
                    const studentsSnap = await db.collection('students').where('course', '==', name).get(); 
                    studentsSnap.forEach(sDoc => { 
                        batch.update(sDoc.ref, { isArchived: true }); 
                    }); 
                } 
            } 
        } 
        if (updateCount > 0) { await batch.commit(); } 
        return updateCount; 
    } catch (e) { return 0; } 
};
export const seedDatabase = async () => { };
export const forceResetAdmin = async () => { return true; };
export const resetDatabase = async () => { 
    const collections = ['students', 'class_sessions', 'attendance_records', 'exam_registrations', 'exams', 'courses']; 
    const batch = db.batch(); 
    for (const col of collections) { 
        const snap = await db.collection(col).get(); 
        snap.forEach(doc => batch.delete(doc.ref)); 
    } 
    await batch.commit(); 
};
export const runBackgroundCleanup = async () => { return 0; };
export const verifyDataIntegrity = runBackgroundCleanup;

// --- MEMBERSHIPS / PACKAGES ---
export const getPackages = async (): Promise<StudentPackage[]> => {
    try {
        const snapshot = await db.collection('student_packages').orderBy('startDate', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentPackage));
    } catch (e) {
        console.error("Error fetching packages", e);
        return [];
    }
};

export const createPackageFromEnrollment = async (student: Student) => {
    if (!student.monthsIntended || student.monthsIntended < 2) return;
    const slots: PackageSlot[] = [];
    for (let i = 1; i <= student.monthsIntended; i++) {
        if (i === 1) {
            slots.push({ index: i, status: 'Used', courseName: student.course, usedDate: new Date().toISOString().split('T')[0] });
        } else {
            slots.push({ index: i, status: 'Pending', courseName: '' });
        }
    }
    const packageData: Omit<StudentPackage, 'id'> = {
        humanId: student.email || 'no-email',
        name: student.name,
        phone: student.phone,
        totalMonths: student.monthsIntended,
        startDate: new Date().toISOString().split('T')[0],
        notes: `Generado automáticamente por inscripción a: ${student.course}`,
        slots: slots
    };
    await db.collection('student_packages').add(packageData);
};

export const updatePackageSlot = async (packageId: string, slotIndex: number, courseName: string) => {
    const docRef = db.collection('student_packages').doc(packageId);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Package not found");
    const data = doc.data() as StudentPackage;
    const updatedSlots = data.slots.map(s => {
        if (s.index === slotIndex) {
            return { ...s, status: 'Used' as const, courseName: courseName, usedDate: new Date().toISOString().split('T')[0] };
        }
        return s;
    });
    // @ts-ignore
    await docRef.update({ slots: updatedSlots });
};

export const deletePackage = async (packageId: string) => {
    await db.collection('student_packages').doc(packageId).delete();
};

// --- TOEIC MOCK TEST SERVICES ---
import { MockTest, MockTestTicket, MockTestResult } from '../types';

export const getMockTests = async (): Promise<MockTest[]> => {
    const snapshot = await db.collection('mock_tests').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MockTest));
};

export const getActiveMockTests = async (): Promise<MockTest[]> => {
    const snapshot = await db.collection('mock_tests').where('status', '==', 'Active').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MockTest));
};

export const saveMockTest = async (test: Omit<MockTest, 'id'> | MockTest): Promise<string> => {
    if ('id' in test && test.id) {
        await db.collection('mock_tests').doc(test.id).set(test);
        return test.id;
    } else {
        const docRef = await db.collection('mock_tests').add({ ...test, createdAt: new Date().toISOString() });
        return docRef.id;
    }
};

export const deleteMockTest = async (id: string) => {
    await db.collection('mock_tests').doc(id).delete();
};

export const getMockTestTickets = async (): Promise<MockTestTicket[]> => {
    const snapshot = await db.collection('mock_test_tickets').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MockTestTicket));
};

export const generateMockTestTickets = async (count: number): Promise<string[]> => {
    const batch = db.batch();
    const generatedIds: string[] = [];
    
    for (let i = 0; i < count; i++) {
        // Generate GT-MOCK-XXXX format
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const id = `GT-MOCK-${randomStr}`;
        generatedIds.push(id);
        
        const ref = db.collection('mock_test_tickets').doc(id);
        batch.set(ref, {
            id,
            status: 'Unused',
            createdAt: new Date().toISOString()
        });
    }
    
    await batch.commit();
    return generatedIds;
};

export const validateMockTestTicket = async (ticketId: string): Promise<MockTestTicket | null> => {
    const doc = await db.collection('mock_test_tickets').doc(ticketId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as MockTestTicket;
};

export const startMockTest = async (ticketId: string, studentName: string, studentPhone: string, testId: string): Promise<void> => {
    await db.collection('mock_test_tickets').doc(ticketId).update({
        status: 'In-Progress',
        studentName,
        studentPhone,
        testId,
        startedAt: new Date().toISOString(),
        remainingSeconds: 7200 // 120 minutes
    });
};

export const updateMockTestProgress = async (ticketId: string, savedAnswers: Record<string, number>, remainingSeconds: number): Promise<void> => {
    await db.collection('mock_test_tickets').doc(ticketId).update({
        savedAnswers,
        remainingSeconds
    });
};

export const submitMockTest = async (ticketId: string, result: Omit<MockTestResult, 'id'>): Promise<string> => {
    // 1. Save result
    const resultRef = await db.collection('mock_test_results').add(result);
    
    // 2. Mark ticket as completed
    await db.collection('mock_test_tickets').doc(ticketId).update({
        status: 'Completed',
        completedAt: new Date().toISOString()
    });
    
    return resultRef.id;
};

export const createIndividualMockTicket = async (ticketId: string, studentName?: string, studentPhone?: string, testId?: string) => {
    await db.collection('mock_test_tickets').doc(ticketId).set({
        id: ticketId,
        status: 'Unused',
        studentName: studentName || '',
        studentPhone: studentPhone || '',
        testId: testId || null,
        createdAt: new Date().toISOString(),
        generatedBy: 'System-Approval'
    });
};

export const getMockTestResults = async (): Promise<MockTestResult[]> => {
    const snapshot = await db.collection('mock_test_results').orderBy('completedAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MockTestResult));
};

export const getMockTestResult = async (id: string): Promise<MockTestResult | null> => {
    const doc = await db.collection('mock_test_results').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as MockTestResult;
};

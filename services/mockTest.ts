import { db } from '../firebase';
import { MockTest, MockTestTicket, MockTestResult } from '../types';

// --- MOCK TEST MANAGEMENT (ADMIN) ---

export const createMockTest = async (test: Omit<MockTest, 'id' | 'createdAt'>) => {
    const newTest: MockTest = {
        ...test,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
    };
    await db.collection('mock_tests').doc(newTest.id).set(newTest);
    return newTest.id;
};

export const updateMockTest = async (id: string, data: Partial<MockTest>) => {
    await db.collection('mock_tests').doc(id).update(data);
};

export const getMockTests = async (): Promise<MockTest[]> => {
    const snapshot = await db.collection('mock_tests').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MockTest));
};

export const getMockTestById = async (id: string): Promise<MockTest | null> => {
    const doc = await db.collection('mock_tests').doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as MockTest) : null;
};

export const deleteMockTest = async (id: string) => {
    await db.collection('mock_tests').doc(id).delete();
};

// --- TICKET MANAGEMENT ---

export const getTickets = async (): Promise<MockTestTicket[]> => {
    const snapshot = await db.collection('mock_test_tickets').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MockTestTicket));
};

export const deleteTicket = async (id: string) => {
    await db.collection('mock_test_tickets').doc(id).delete();
};

export const resetTicket = async (id: string) => {
    await db.collection('mock_test_tickets').doc(id).update({
        status: 'Unused',
        studentName: null,
        studentPhone: null,
        startedAt: null,
        remainingSeconds: null,
        savedAnswers: null,
        completedAt: null
    });
};

export const generateTickets = async (count: number, testId?: string): Promise<string[]> => {
    const batch = db.batch();
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
        // Generate formatted code: GT-XXXX-XXXX
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
        const code = `GT-${randomPart.substring(0, 4)}-${randomPart.substring(4, 8)}`;
        
        const ticketRef = db.collection('mock_test_tickets').doc(code);
        const ticket: MockTestTicket = {
            id: code,
            status: 'Unused',
            testId: testId, // Optional: Pre-assign a specific test
            createdAt: new Date().toISOString()
        };
        
        batch.set(ticketRef, ticket);
        codes.push(code);
    }

    await batch.commit();
    return codes;
};

export const validateTicket = async (ticketId: string): Promise<{ valid: boolean; ticket?: MockTestTicket; message?: string }> => {
    const doc = await db.collection('mock_test_tickets').doc(ticketId).get();
    
    if (!doc.exists) {
        return { valid: false, message: 'Código inválido. Verifique e intente nuevamente.' };
    }

    const ticket = doc.data() as MockTestTicket;

    if (ticket.status === 'Completed') {
        return { valid: false, message: 'Este código ya ha sido utilizado y el examen finalizado.' };
    }

    return { valid: true, ticket };
};

export const startTicketSession = async (ticketId: string, studentName: string, studentPhone: string, testId: string) => {
    await db.collection('mock_test_tickets').doc(ticketId).update({
        status: 'In-Progress',
        studentName,
        studentPhone,
        testId, // Assign the test if not already assigned
        startedAt: new Date().toISOString(),
        remainingSeconds: 7200 // Initialize 2 hours
    });
};

export const updateTicketProgress = async (ticketId: string, remainingSeconds: number, answers: Record<string, number>) => {
    await db.collection('mock_test_tickets').doc(ticketId).update({
        remainingSeconds,
        savedAnswers: answers
    });
};

export const completeTicketSession = async (ticketId: string) => {
    await db.collection('mock_test_tickets').doc(ticketId).update({
        status: 'Completed',
        completedAt: new Date().toISOString()
    });
};

// --- RESULTS ---

export const saveMockTestResult = async (result: Omit<MockTestResult, 'id'>) => {
    const id = crypto.randomUUID();
    await db.collection('mock_test_results').doc(id).set({ ...result, id });
    return id;
};

export const getMockTestResult = async (id: string): Promise<MockTestResult | null> => {
    const doc = await db.collection('mock_test_results').doc(id).get();
    return doc.exists ? (doc.data() as MockTestResult) : null;
};

export const getMockTestResults = async (): Promise<MockTestResult[]> => {
    const snapshot = await db.collection('mock_test_results').orderBy('completedAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MockTestResult));
};

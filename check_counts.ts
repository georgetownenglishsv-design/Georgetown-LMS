import { db } from './services/db';

async function countDocs() {
    try {
        const quizzesSnap = await db.collection('daily_quizzes').get();
        console.log(`Total Spanglish Quizzes: ${quizzesSnap.size}`);

        const questionsSnap = await db.collection('questions').get();
        console.log(`Total Level Test Questions: ${questionsSnap.size}`);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

countDocs();

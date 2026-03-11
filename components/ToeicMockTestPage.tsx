import React, { useState } from 'react';
import { TicketEntry } from '../components/TicketEntry';
import { MockTestRunner } from '../components/MockTestRunner';
import { MockTestResults } from '../components/MockTestResults';
import { MockTestTicket, MockTest } from '../types';

export const ToeicMockTestPage: React.FC = () => {
    const [view, setView] = useState<'entry' | 'exam' | 'results'>('entry');
    const [activeTicket, setActiveTicket] = useState<MockTestTicket | null>(null);
    const [activeTest, setActiveTest] = useState<MockTest | null>(null);
    const [resultId, setResultId] = useState<string | null>(null);

    const handleTicketVerified = (ticket: MockTestTicket, test: MockTest) => {
        setActiveTicket(ticket);
        setActiveTest(test);
        setView('exam');
    };

    const handleExamComplete = (rId: string) => {
        setResultId(rId);
        setView('results');
    };

    return (
        <div className="font-sans">
            {view === 'entry' && (
                <TicketEntry onTicketVerified={handleTicketVerified} />
            )}
            
            {view === 'exam' && activeTicket && activeTest && (
                <MockTestRunner 
                    ticket={activeTicket} 
                    test={activeTest} 
                    onComplete={handleExamComplete} 
                />
            )}

            {view === 'results' && resultId && (
                <MockTestResults resultId={resultId} />
            )}
        </div>
    );
};

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { MockTest, MockTestTicket, MockTestQuestion } from '../types';
import { updateTicketProgress, completeTicketSession, saveMockTestResult } from '../services/mockTest';
import { calculateToeicScore } from '../utils/toeicScoring';

interface MockTestRunnerProps {
    ticket: MockTestTicket;
    test: MockTest;
    onComplete: (resultId: string) => void;
}

export const MockTestRunner: React.FC<MockTestRunnerProps> = ({ ticket, test, onComplete }) => {
    // State
    // Calculate initial time left based on startedAt to prevent reset on refresh
    const calculateTimeLeft = () => {
        if (!ticket.startedAt) return ticket.remainingSeconds || 7200;
        
        const startTime = new Date(ticket.startedAt).getTime();
        const now = new Date().getTime();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalDuration = 7200; // 2 hours default
        const calculatedRemaining = Math.max(0, totalDuration - elapsedSeconds);
        
        // Use the smaller of the two to be safe (prevent cheating by manipulating local time vs server stored remaining)
        // But primarily rely on startedAt for consistency across refreshes
        return Math.min(calculatedRemaining, ticket.remainingSeconds || 7200);
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
    const [answers, setAnswers] = useState<Record<string, number>>(ticket.savedAnswers || {});
    const [currentPart, setCurrentPart] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showOmr, setShowOmr] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    
    // Pagination State
    const [currentIndex, setCurrentIndex] = useState(0);

    // Refs
    const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const answersRef = useRef(answers);
    const timeLeftRef = useRef(timeLeft);

    // Update refs
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    useEffect(() => {
        timeLeftRef.current = timeLeft;
    }, [timeLeft]);

    // Filter actual questions
    const allQuestions = test.questions.filter(q => q.type !== 'direction').sort((a, b) => parseInt(a.id) - parseInt(b.id));
    const totalQuestionsCount = allQuestions.length;
    const answeredCount = Object.keys(answers).filter(k => allQuestions.some(q => q.id === k)).length;

    // --- Data Preparation ---
    const pages = React.useMemo(() => {
        const _pages: { type: 'direction' | 'standalone' | 'group', items: MockTestQuestion[], part: number }[] = [];
        
        const getPartItems = (p: number) => test.questions.filter(q => q.part === p).sort((a, b) => {
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            return idA - idB;
        });

        [1, 2, 3, 4, 5, 6, 7].forEach(part => {
            const items = getPartItems(part);
            const groups: { [key: string]: MockTestQuestion[] } = {};
            const standalone: MockTestQuestion[] = [];
            const directions: MockTestQuestion[] = [];

            items.forEach(item => {
                if (item.type === 'direction') {
                    directions.push(item);
                } else if (item.groupId) {
                    if (!groups[item.groupId]) groups[item.groupId] = [];
                    groups[item.groupId].push(item);
                } else {
                    standalone.push(item);
                }
            });

            directions.forEach(d => _pages.push({ type: 'direction', items: [d], part }));
            standalone.forEach(q => _pages.push({ type: 'standalone', items: [q], part }));
            Object.values(groups).forEach(groupQs => _pages.push({ type: 'group', items: groupQs, part }));
        });

        return _pages;
    }, [test.questions]);

    // Scroll Reset Refs
    const contentRef = useRef<HTMLDivElement>(null);
    const contextRef = useRef<HTMLDivElement>(null);

    // Effects
    useEffect(() => {
        if (contentRef.current) contentRef.current.scrollTop = 0;
        if (contextRef.current) contextRef.current.scrollTop = 0;
        
        // Sync current part
        if (pages[currentIndex]) {
            setCurrentPart(pages[currentIndex].part);
        }

        // Image Preloading Logic
        const preloadNextPageImages = () => {
            const nextPage = pages[currentIndex + 1];
            if (nextPage) {
                nextPage.items.forEach(item => {
                    if (item.imageUrl) {
                        const img = new Image();
                        img.src = item.imageUrl;
                    }
                    if (item.groupImage) {
                        const img = new Image();
                        img.src = item.groupImage;
                    }
                });
            }
        };
        preloadNextPageImages();

    }, [currentIndex, pages]);

    // Timer Logic
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 0) {
                    clearInterval(timer);
                    handleSubmit(); // Auto-submit when time runs out
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Sync with server every 30 seconds
        saveIntervalRef.current = setInterval(() => {
            updateTicketProgress(ticket.id, timeLeftRef.current, answersRef.current);
        }, 30000);

        return () => {
            clearInterval(timer);
            if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
        };
    }, []); // Empty dependency array to run once on mount

    // Audio Auto-play Logic
    useEffect(() => {
        if (audioRef.current && currentPart <= 4) {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(() => setIsPlaying(false));
        }
    }, [currentPart]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'ArrowRight' && currentIndex < pages.length - 1) setCurrentIndex(prev => prev + 1);
            if (e.key === 'ArrowLeft' && currentIndex > 0) setCurrentIndex(prev => prev - 1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, pages.length]);

    const handleAnswer = (questionId: string, optionIndex: number) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));

        const currentPage = pages[currentIndex];
        if (currentPage) {
            const allAnswered = currentPage.items.every(item => {
                if (item.id === questionId) return true;
                return answers[item.id] !== undefined;
            });

            if (allAnswered && currentIndex < pages.length - 1) {
                setTimeout(() => setCurrentIndex(prev => prev + 1), 500);
            }
        }
    };

    const handleNext = () => {
        if (currentIndex < pages.length - 1) setCurrentIndex(prev => prev + 1);
    };

    const handlePrev = () => {
        if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    };

    const jumpToQuestion = (questionId: string) => {
        const index = pages.findIndex(p => p.items.some(i => i.id === questionId));
        if (index !== -1) {
            setCurrentIndex(index);
            setShowOmr(false);
        }
    };
    
    const jumpToPart = (part: number) => {
        const index = pages.findIndex(p => p.part === part);
        if (index !== -1) {
            setCurrentIndex(index);
            setShowOmr(false);
        }
    };

    const toggleAudio = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.muted = !audioRef.current.muted;
            } else {
                audioRef.current.play()
                    .then(() => setIsPlaying(true))
                    .catch(console.error);
            }
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);

        const lcQuestions = allQuestions.filter(q => q.part <= 4);
        const rcQuestions = allQuestions.filter(q => q.part > 4);
        let lcRaw = 0, rcRaw = 0;

        allQuestions.forEach(q => {
            if (answers[q.id] === q.correctAnswer) {
                if (q.part <= 4) lcRaw++;
                else rcRaw++;
            }
        });

        const lcScaled = lcQuestions.length > 0 ? calculateToeicScore(Math.round((lcRaw / lcQuestions.length) * 100), 'LC') : 0;
        const rcScaled = rcQuestions.length > 0 ? calculateToeicScore(Math.round((rcRaw / rcQuestions.length) * 100), 'RC') : 0;

        const result = {
            ticketId: ticket.id,
            testId: test.id,
            studentName: ticket.studentName || 'Unknown',
            studentPhone: ticket.studentPhone || 'Unknown',
            lcRawScore: lcRaw,
            rcRawScore: rcRaw,
            lcScaledScore: lcScaled,
            rcScaledScore: rcScaled,
            totalScore: lcScaled + rcScaled,
            completedAt: new Date().toISOString(),
            answers: answers
        };

        const resultId = await saveMockTestResult(result);
        await completeTicketSession(ticket.id);
        onComplete(resultId);
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const renderCurrentPage = () => {
        const page = pages[currentIndex];
        if (!page) return <div>Fin del Examen</div>;

        if (page.type === 'direction') {
            const item = page.items[0];
            return (
                <div className="max-w-3xl mx-auto h-full flex flex-col justify-center overflow-y-auto custom-scrollbar p-4" ref={contentRef}>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="prose dark:prose-invert max-w-none text-sm text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
                    </div>
                </div>
            );
        }

        if (page.type === 'standalone') {
            return (
                <div className="max-w-3xl mx-auto h-full flex flex-col justify-center overflow-y-auto custom-scrollbar p-4" ref={contentRef}>
                    {renderQuestionBlock(page.items[0])}
                </div>
            );
        }

        if (page.type === 'group') {
            const groupQs = page.items;
            // Find image and text from any question in the group to be robust
            const groupImage = groupQs.find(q => q.groupImage)?.groupImage;
            const groupText = groupQs.find(q => q.groupText)?.groupText;
            
            const hasContext = !!groupImage || !!groupText;

            // 1. Smart Layout: No Context -> Single Column (Focus on Questions)
            if (!hasContext) {
                return (
                    <div className="max-w-3xl mx-auto h-full flex flex-col overflow-y-auto custom-scrollbar p-4" ref={contentRef}>
                        <div className="space-y-6 pb-20 lg:pb-0">
                            {groupQs.map(q => renderQuestionBlock(q))}
                        </div>
                    </div>
                );
            }

            // 2. Split Layout: Context Exists -> Left: Context, Right: Questions
            return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full p-1">
                    <div ref={contextRef} className="bg-white dark:bg-[#1a1f2e] rounded-xl p-5 shadow-sm overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 h-full">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2 sticky top-0 bg-white dark:bg-[#1a1f2e] py-2 z-10">
                            <Icon name="description" className="text-primary" /> Contexto
                        </h3>
                        
                        {/* Render Image OUTSIDE prose to avoid style conflicts */}
                        {groupImage && (
                            <div className="mb-4 w-full bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                <img 
                                    src={groupImage} 
                                    alt="Context" 
                                    className="w-full h-auto block min-h-[100px]" 
                                    referrerPolicy="no-referrer" 
                                    loading="eager"
                                />
                            </div>
                        )}

                        <div className="prose dark:prose-invert max-w-none text-sm">
                            {groupText && <div className="whitespace-pre-wrap font-serif leading-relaxed p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">{groupText}</div>}
                        </div>
                    </div>
                    <div ref={contentRef} className="overflow-y-auto custom-scrollbar h-full pr-1 pb-20 lg:pb-0">
                        <div className="space-y-4">
                            {groupQs.map(q => renderQuestionBlock(q))}
                        </div>
                    </div>
                </div>
            );
        }
    };

    const renderQuestionBlock = (q: MockTestQuestion) => {
        if (!q.options || !Array.isArray(q.options)) return null;
        return (
            <div id={`question-${q.id}`} key={q.id} className="bg-white dark:bg-[#1a1f2e] rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center font-bold text-xs">{q.id}</span>
                    <div className="flex-1">
                        {q.imageUrl && <img src={q.imageUrl} alt={`Question ${q.id}`} className="max-w-md w-full rounded-lg mb-3 border border-slate-200 dark:border-slate-700" referrerPolicy="no-referrer" />}
                        {q.text && <p className="text-slate-800 dark:text-slate-200 font-medium mb-3 text-base">{q.text}</p>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, optIdx) => (
                                <button
                                    key={optIdx}
                                    onClick={() => handleAnswer(q.id, optIdx)}
                                    className={`relative px-3 py-2 rounded-lg border text-left transition-all flex items-center gap-2 group ${
                                        answers[q.id] === optIdx ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                                    }`}
                                >
                                    <span className={`w-7 h-7 flex-shrink-0 rounded-full border-2 flex items-center justify-center text-base font-bold transition-colors ${
                                        answers[q.id] === optIdx ? 'bg-primary border-primary text-white' : 'border-slate-300 text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-hover:border-slate-400 dark:group-hover:border-slate-500'
                                    }`}>{['A', 'B', 'C', 'D'][optIdx]}</span>
                                    <span className="font-medium text-base">{opt}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-screen bg-[#0f1218] flex flex-col relative overflow-hidden">
            {/* Persistent Audio Player (Hidden) */}
            {test.audioUrl && (
                <audio 
                    ref={audioRef}
                    className="hidden"
                    src={test.audioUrl}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                />
            )}

            {/* Compact Header */}
            <header className="bg-[#1a1f2e] border-b border-slate-800 px-4 py-2 flex items-center justify-between z-50 shadow-md flex-shrink-0 h-16">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-md flex items-center justify-center overflow-hidden">
                        <Logo className="w-full h-full object-contain" />
                    </div>
                    <div className="hidden sm:block">
                        <h1 className="text-white font-bold text-sm truncate max-w-[200px]">{test.title}</h1>
                        <p className="text-slate-400 text-[10px]">Parte {currentPart}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Audio Control */}
                    {test.audioUrl && currentPart <= 4 && (
                        <button 
                            onClick={toggleAudio}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                isPlaying 
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            <Icon name={isPlaying ? "volume_up" : "play_circle"} className="text-sm" />
                            <span className="hidden sm:inline">{isPlaying ? "Reproduciendo" : "Reproducir Audio"}</span>
                        </button>
                    )}

                    {/* Timer */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-md border ${timeLeft < 600 ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' : 'bg-slate-800 border-slate-700 text-white'}`}>
                        <Icon name="timer" className="text-lg" />
                        <span className="font-mono text-xl font-bold tracking-wider">{formatTime(timeLeft)}</span>
                    </div>

                    <button onClick={handleSubmit} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-md text-sm flex items-center gap-2">
                        <Icon name="check_circle" className="text-lg" /> <span className="hidden sm:inline">Finalizar</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative p-2 sm:p-4">
                <div className="flex-1 overflow-hidden relative">
                    {renderCurrentPage()}
                </div>
            </main>

            {/* Compact Footer */}
            <div className="bg-[#1a1f2e]/95 backdrop-blur-md border-t border-slate-800 flex-shrink-0 z-40 relative">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-slate-800">
                    <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(answeredCount / totalQuestionsCount) * 100}%` }} />
                </div>

                <div className="px-4 py-2 flex items-center justify-between h-14">
                    <button 
                        onClick={handlePrev} 
                        disabled={currentIndex === 0}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold ${currentIndex === 0 ? 'text-slate-600 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                    >
                        <Icon name="arrow_back" className="text-sm" /> Anterior
                    </button>

                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-500">
                            {/* Display Question Range instead of Page Number */}
                            {pages[currentIndex]?.items[0]?.id && (
                                <>Pregunta {pages[currentIndex].items[0].id} {pages[currentIndex].items.length > 1 ? `- ${pages[currentIndex].items[pages[currentIndex].items.length - 1].id}` : ''}</>
                            )}
                        </span>
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-green-400">{answeredCount} Respondidas</span>
                            <span className="text-slate-500">/</span>
                            <span className="text-slate-400">{totalQuestionsCount} Total</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowOmr(true)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md relative"
                            title="Mapa de Preguntas"
                        >
                            <Icon name="grid_view" className="text-sm" />
                            {answeredCount < totalQuestionsCount && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
                        </button>
                        <button 
                            onClick={handleNext} 
                            disabled={currentIndex === pages.length - 1}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold ${currentIndex === pages.length - 1 ? 'text-slate-600 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark text-white'}`}
                        >
                            Siguiente <Icon name="arrow_forward" className="text-sm" />
                        </button>
                    </div>
                </div>
            </div>

            {/* OMR Modal with Part Navigation */}
            {showOmr && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4">
                    <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-[#1a1f2e] w-full max-w-4xl rounded-xl border border-slate-700 shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="text-white font-bold text-sm flex items-center gap-2"><Icon name="grid_view" /> Mapa de Preguntas</h3>
                            <button onClick={() => setShowOmr(false)} className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white"><Icon name="close" /></button>
                        </div>
                        
                        {/* Part Jump Buttons */}
                        <div className="p-3 border-b border-slate-700 bg-[#111621] flex gap-2 overflow-x-auto no-scrollbar">
                            {[1, 2, 3, 4, 5, 6, 7].map(part => (
                                <button
                                    key={part}
                                    onClick={() => jumpToPart(part)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${currentPart === part ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    Parte {part}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 gap-1.5">
                                {allQuestions.map((q) => {
                                    const isAnswered = answers[q.id] !== undefined;
                                    const isCurrent = pages[currentIndex]?.items.some(i => i.id === q.id);
                                    return (
                                        <button
                                            key={q.id}
                                            onClick={() => jumpToQuestion(q.id)}
                                            className={`h-8 rounded text-[10px] font-bold border ${isAnswered ? 'bg-green-600 border-green-500 text-white' : isCurrent ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                        >
                                            {q.id}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {isSubmitting && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <h2 className="text-xl font-bold text-white">Procesando...</h2>
                </div>
            )}
        </div>
    );
};

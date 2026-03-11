import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM as any;
import { Icon } from './Icon';
import { getMockTestResult, getMockTestById } from '../services/mockTest';
import { MockTestResult, MockTest } from '../types';

interface MockTestResultsProps {
    resultId: string;
}

export const MockTestResults: React.FC<MockTestResultsProps> = ({ resultId }) => {
    const navigate = useNavigate();
    const [result, setResult] = useState<MockTestResult | null>(null);
    const [test, setTest] = useState<MockTest | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Get Result
                const resultData = await getMockTestResult(resultId);
                if (!resultData) throw new Error("Result not found");
                setResult(resultData);

                // 2. Get Test Data (for correct answers & part info)
                const testData = await getMockTestById(resultData.testId);
                setTest(testData);

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [resultId]);

    if (loading) return <div className="min-h-screen bg-[#0f1218] flex items-center justify-center text-white">Cargando resultados...</div>;
    if (!result || !test) return <div className="min-h-screen bg-[#0f1218] flex items-center justify-center text-white">Resultados no encontrados.</div>;

    // Calculate percentages for charts
    const lcPercent = Math.round((result.lcScaledScore / 495) * 100);
    const rcPercent = Math.round((result.rcScaledScore / 495) * 100);
    
    // Helper to calculate part scores
    const getPartStats = (part: number) => {
        const questions = test.questions.filter(q => q.part === part && q.type !== 'direction');
        const total = questions.length;
        const correct = questions.filter(q => result.answers[q.id] === q.correctAnswer).length;
        return { correct, total };
    };

    const p1 = getPartStats(1);
    const p2 = getPartStats(2);
    const p3 = getPartStats(3);
    const p4 = getPartStats(4);
    const p5 = getPartStats(5);
    const p6 = getPartStats(6);
    const p7 = getPartStats(7);

    return (
        <div className="min-h-screen bg-[#0f1218] text-white p-6 md:p-12 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-700 rounded-full mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-green-500/30"
                    >
                        <Icon name="emoji_events" className="text-5xl text-white" />
                    </motion.div>
                    <h1 className="text-4xl font-black mb-2">Resultados del Examen <span className="text-sm bg-slate-700 px-2 py-1 rounded text-slate-300 align-middle">v2.0</span></h1>
                    <p className="text-slate-400 text-lg">{result.studentName} &bull; {new Date(result.completedAt).toLocaleDateString()}</p>
                </div>

                {/* Score Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {/* Total Score */}
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#1a1f2e] border border-slate-800 rounded-3xl p-8 text-center relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-blue-600"></div>
                        <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-4">Total Score</h3>
                        <div className="text-6xl font-black text-white mb-2">{result.totalScore}</div>
                        <div className="text-sm text-slate-500">de 990 puntos</div>
                    </motion.div>

                    {/* Listening Score */}
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[#1a1f2e] border border-slate-800 rounded-3xl p-8 text-center relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
                        <h3 className="text-blue-400 font-bold uppercase tracking-widest text-sm mb-4">Listening</h3>
                        <div className="text-5xl font-black text-white mb-2">{result.lcScaledScore}</div>
                        <div className="text-sm text-slate-500">de 495 puntos</div>
                        <div className="mt-4 w-full bg-slate-800 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${lcPercent}%` }}></div>
                        </div>
                    </motion.div>

                    {/* Reading Score */}
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="bg-[#1a1f2e] border border-slate-800 rounded-3xl p-8 text-center relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
                        <h3 className="text-green-400 font-bold uppercase tracking-widest text-sm mb-4">Reading</h3>
                        <div className="text-5xl font-black text-white mb-2">{result.rcScaledScore}</div>
                        <div className="text-sm text-slate-500">de 495 puntos</div>
                        <div className="mt-4 w-full bg-slate-800 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${rcPercent}%` }}></div>
                        </div>
                    </motion.div>
                </div>

                {/* Detailed Breakdown */}
                <div className="bg-[#1a1f2e] border border-slate-800 rounded-3xl p-8">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Icon name="analytics" className="text-primary" />
                        Análisis de Rendimiento
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold text-slate-300 mb-4">Listening Breakdown</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm p-3 bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-400">Part 1: Photographs</span>
                                    <span className="text-white font-bold">{p1.correct} / {p1.total}</span>
                                </div>
                                <div className="flex justify-between text-sm p-3 bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-400">Part 2: Question-Response</span>
                                    <span className="text-white font-bold">{p2.correct} / {p2.total}</span>
                                </div>
                                <div className="flex justify-between text-sm p-3 bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-400">Part 3: Conversations</span>
                                    <span className="text-white font-bold">{p3.correct} / {p3.total}</span>
                                </div>
                                <div className="flex justify-between text-sm p-3 bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-400">Part 4: Talks</span>
                                    <span className="text-white font-bold">{p4.correct} / {p4.total}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-300 mb-4">Reading Breakdown</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm p-3 bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-400">Part 5: Incomplete Sentences</span>
                                    <span className="text-white font-bold">{p5.correct} / {p5.total}</span>
                                </div>
                                <div className="flex justify-between text-sm p-3 bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-400">Part 6: Text Completion</span>
                                    <span className="text-white font-bold">{p6.correct} / {p6.total}</span>
                                </div>
                                <div className="flex justify-between text-sm p-3 bg-slate-800/50 rounded-lg">
                                    <span className="text-slate-400">Part 7: Reading Comprehension</span>
                                    <span className="text-white font-bold">{p7.correct} / {p7.total}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Premium Conversion Section */}
                <motion.div 
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-12 bg-gradient-to-br from-[#111418] to-[#1a1f2e] border border-yellow-500/30 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl shadow-yellow-500/10"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>
                    
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/10 mb-6 border border-yellow-500/20">
                        <Icon name="school" className="text-3xl text-yellow-500" />
                    </div>
                    
                    <h2 className="text-2xl md:text-3xl font-black text-white mb-4 leading-tight">
                        ¿Aún no alcanzas tu puntaje objetivo? <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200">
                            No pierdas más tiempo estudiando solo.
                        </span>
                    </h2>
                    
                    <p className="text-slate-300 text-sm md:text-base max-w-2xl mx-auto mb-8 leading-relaxed">
                        El <strong>Curso de Preparación TOEIC (2/3 meses)</strong> de Georgetown Academy está diseñado exclusivamente para que logres tu meta en el menor tiempo posible.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button 
                            onClick={() => navigate('/courses?category=TOEIC')}
                            className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-slate-700 hover:border-slate-600 flex items-center justify-center gap-2"
                        >
                            <Icon name="info" className="text-lg" />
                            Ver detalles del curso
                        </button>
                        <button 
                            onClick={() => navigate('/enroll')}
                            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black rounded-xl font-black transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 transform hover:scale-105"
                        >
                            <Icon name="how_to_reg" className="text-lg" />
                            Inscribirme ahora
                        </button>
                    </div>
                </motion.div>

                <div className="mt-8 text-center">
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-transparent hover:bg-slate-800/50 text-slate-500 hover:text-slate-300 rounded-lg font-medium transition-colors text-sm">
                        Volver al Inicio
                    </button>
                </div>
            </div>
        </div>
    );
};

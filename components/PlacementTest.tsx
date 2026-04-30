
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { getPlacementQuestions, savePlacementResult, recordInternalConversion } from '../services/db';
import { Question } from '../types';
import { auth } from '../firebase';
// @ts-ignore
import html2canvas from 'html2canvas';

// --- CONFIGURATION ---
const INSTAGRAM_HANDLE = "@GeorgetownAcademy";
const INSTAGRAM_URL = "https://www.instagram.com/georgetown.academy/";
const WHATSAPP_PHONE = "50376805577";

const PlacementTest: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<'intro' | 'test' | 'result'>('intro');
    const [loading, setLoading] = useState(true);
    
    // User Info
    const [userInfo, setUserInfo] = useState({ name: '', phone: '', email: '' });
    
    // Test Logic
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [testQuestions, setTestQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<{[key: string]: number}>({});
    const [score, setScore] = useState(0);
    const [level, setLevel] = useState('');

    // Certificate Refs
    const exportRef = useRef<HTMLDivElement>(null); // For generating the image (Hidden)
    const [generatingImg, setGeneratingImg] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
        document.documentElement.classList.remove('dark');
        
        const load = async () => {
            try {
                if (!auth.currentUser) {
                    console.log("Authenticating anonymously for placement test...");
                    await auth.signInAnonymously();
                }

                const data = await getPlacementQuestions();
                const activeQuestions = data.filter(q => q.active !== false);
                setAllQuestions(activeQuestions);
            } catch (e) {
                console.error("Error loading questions from DB:", e);
                alert("Error de conexión. Por favor intente recargar la página.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const startTest = async () => {
        if (!userInfo.name || !userInfo.phone) {
            alert("Por favor ingrese su nombre y teléfono para continuar.");
            return;
        }
        
        if (allQuestions.length === 0) {
            alert("⚠️ No hay preguntas disponibles en la base de datos. Por favor contacte al administrador.");
            return;
        }

        const easyPool = allQuestions.filter(q => q.level === 'A1' || q.level === 'A2');
        const mediumPool = allQuestions.filter(q => q.level === 'B1' || q.level === 'B2'); 

        const shuffledEasy = easyPool.sort(() => 0.5 - Math.random());
        const shuffledMedium = mediumPool.sort(() => 0.5 - Math.random());

        let selected: Question[] = [];
        
        if (easyPool.length > 0 && mediumPool.length > 0) {
             selected = [
                ...shuffledEasy.slice(0, 20),
                ...shuffledMedium.slice(0, 10)
            ];
        } else {
            selected = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 30);
        }

        if (selected.length === 0) {
             alert("Error de configuración: Preguntas insuficientes.");
             return;
        }

        setTestQuestions(selected);
        setStep('test');
        window.scrollTo(0, 0);
        
        if (typeof window !== 'undefined') {
            if ((window as any).gtag) (window as any).gtag('event', 'start_placement_test', { event_category: 'engagement' });
            if ((window as any).fbq) (window as any).fbq('trackCustom', 'StartPlacementTest');
        }
    };

    const handleAnswer = (optionIndex: number) => {
        const currentQ = testQuestions[currentIndex];
        setAnswers({ ...answers, [currentQ.id]: optionIndex });

        if (currentIndex < testQuestions.length - 1) {
            setTimeout(() => setCurrentIndex(currentIndex + 1), 300);
        } else {
            finishTest();
        }
    };

    const finishTest = async () => {
        const weights: Record<string, number> = { 
            'A1': 1, 
            'A2': 2, 
            'B1': 3, 
            'B2': 4, 
            'C1': 5 
        };

        let earnedPoints = 0;
        let totalPossiblePoints = 0;
        const breakdown: { [key: string]: { correct: number, total: number } } = {};

        testQuestions.forEach(q => {
            const levelKey = q.level || 'A1';
            const weight = weights[levelKey] || 1;
            
            totalPossiblePoints += weight;

            if (!breakdown[levelKey]) {
                breakdown[levelKey] = { correct: 0, total: 0 };
            }
            breakdown[levelKey].total++;

            const isCorrect = answers[q.id] === q.correctAnswer;
            
            if (isCorrect) {
                earnedPoints += weight;
                breakdown[levelKey].correct++;
            }
        });

        const weightedScore = totalPossiblePoints > 0 
            ? Math.round((earnedPoints / totalPossiblePoints) * 100) 
            : 0;
            
        setScore(weightedScore);

        let calcLevel = 'A1';
        if (weightedScore >= 85) calcLevel = 'C1';
        else if (weightedScore >= 65) calcLevel = 'B2';
        else if (weightedScore >= 45) calcLevel = 'B1';
        else if (weightedScore >= 25) calcLevel = 'A2';
        else calcLevel = 'A1';
        
        setLevel(calcLevel);

        setStep('result');
        window.scrollTo(0, 0);

        if (typeof window !== 'undefined') {
            if ((window as any).gtag) (window as any).gtag('event', 'complete_placement_test', { event_category: 'engagement', level: calcLevel });
            if ((window as any).fbq) (window as any).fbq('trackCustom', 'CompletePlacementTest', { level: calcLevel });
        }

        try {
            await savePlacementResult({
                studentName: userInfo.name,
                studentEmail: userInfo.email,
                studentPhone: userInfo.phone,
                score: weightedScore,
                totalQuestions: testQuestions.length,
                calculatedLevel: calcLevel,
                date: new Date().toISOString(),
                status: 'New',
                levelBreakdown: breakdown
            });
            // Record Conversion
            await recordInternalConversion('placementTest');
        } catch(e) {
            console.error("Error saving result", e);
        }
    };

    const handleDownloadCertificate = async () => {
        if (!exportRef.current) return;
        setGeneratingImg(true);
        try {
            // Wait for rendering
            await new Promise(r => setTimeout(r, 500));
            
            const canvas = await html2canvas(exportRef.current, {
                scale: 2, // High resolution (1080x1920 * 2)
                backgroundColor: '#0B1120', 
                useCORS: true,
                logging: false,
                allowTaint: true,
            });
            
            const link = document.createElement('a');
            link.download = `Georgetown_Certificate_${userInfo.name.replace(/\s/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            alert("✨ Certificado guardado.\n\nTip: Súbelo a tu historia de Instagram y etiquétanos para obtener un descuento especial.");
        } catch (err) {
            console.error(err);
            alert("Error al generar la imagen.");
        } finally {
            setGeneratingImg(false);
        }
    };

    const handleShareFacebook = () => {
        const url = encodeURIComponent(window.location.origin + '/placement-test');
        const quote = encodeURIComponent(`¡He alcanzado el nivel ${level} en Georgetown Academy! 🎓 ¿Cuál es tu nivel de inglés? Haz el test gratis aquí.`);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank');
    };

    const handleContactWhatsApp = () => {
        const msg = `Hola, he finalizado mi Evaluación de Nivel (Resultado: ${level}). Me gustaría inscribirme.`;
        
        if (typeof window !== 'undefined') {
            if ((window as any).gtag) (window as any).gtag('event', 'contact_whatsapp', { event_category: 'contact', source: 'placement_test' });
            if ((window as any).fbq) (window as any).fbq('track', 'Contact', { source: 'placement_test' });
        }
        
        // Record Conversion
        recordInternalConversion('whatsappContact').catch(console.error);
        
        window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const handleInstagramClick = () => {
        window.open(INSTAGRAM_URL, '_blank');
    };

    if (loading) return <div className="min-h-screen bg-[#111418] flex items-center justify-center text-white"><Icon name="sync" className="animate-spin text-4xl" /></div>;

    // --- STYLES ---
    const goldGradientText = {
        background: 'linear-gradient(to bottom right, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        backgroundSize: '200% auto',
        animation: 'shine 5s linear infinite',
    };

    return (
        <div className="min-h-screen bg-[#05080f] text-white font-display flex flex-col items-center relative overflow-x-hidden">
            <style>{`
                @keyframes shine {
                    to { background-position: 200% center; }
                }
                .font-serif { font-family: 'Times New Roman', serif; }
                .guilloche-pattern {
                    background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23d4af37' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E");
                }
            `}</style>

            {/* Navigation Header */}
            <div className="relative z-10 w-full max-w-5xl px-4 md:px-6 py-6 flex justify-between items-center h-20">
                <div className="flex justify-start items-center flex-shrink-0 min-w-[120px]">
                    <div className="h-10 md:h-12 w-auto cursor-pointer opacity-80 hover:opacity-100 transition-opacity" onClick={() => navigate('/')}>
                        <Logo className="h-full w-auto object-contain brightness-0 invert" iconOnly={false} />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/')} 
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white border border-white/10"
                    >
                        <Icon name="close" className="text-xl" />
                    </button>
                </div>
            </div>

            {/* Content Container */}
            <div className="relative z-10 flex-1 w-full max-w-3xl px-4 md:px-6 py-6 md:py-10 flex flex-col justify-center">
                
                {/* STEP 1: INTRO (Renamed) */}
                {step === 'intro' && (
                    <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/30 bg-yellow-500/10">
                            <Icon name="verified" className="text-yellow-500 text-sm" />
                            <span className="text-yellow-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em]">Official Assessment</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-serif text-white leading-tight">
                            Evaluación de<br/><span className="text-[#D4AF37]">Nivel Oficial</span>
                        </h1>
                        <p className="text-slate-400 text-sm md:text-lg max-w-xl mx-auto font-light leading-relaxed">
                            Evaluación precisa alineada al Marco Común Europeo (CEFR).<br/>Descubre tu nivel real en menos de 5 minutos.
                        </p>
                        <div className="bg-[#111621] border border-white/10 p-6 md:p-10 rounded-2xl shadow-2xl max-w-lg mx-auto">
                            <div className="space-y-5">
                                <input 
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all outline-none"
                                    placeholder="Nombre Completo"
                                    value={userInfo.name}
                                    onChange={e => setUserInfo({...userInfo, name: e.target.value})}
                                />
                                <input 
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all outline-none"
                                    placeholder="Teléfono (WhatsApp)"
                                    type="tel"
                                    value={userInfo.phone}
                                    onChange={e => setUserInfo({...userInfo, phone: e.target.value})}
                                />
                                <input 
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/50 transition-all outline-none"
                                    placeholder="Correo Electrónico"
                                    type="email"
                                    value={userInfo.email}
                                    onChange={e => setUserInfo({...userInfo, email: e.target.value})}
                                />
                                <button 
                                    onClick={startTest}
                                    className="w-full py-4 mt-2 bg-gradient-to-r from-[#D4AF37] to-[#B08D4B] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] text-black rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg transition-all active:scale-95"
                                >
                                    Iniciar Evaluación
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: TEST (Unchanged) */}
                {step === 'test' && testQuestions[currentIndex] && (
                    <div className="flex flex-col gap-8 max-w-2xl mx-auto w-full animate-in fade-in slide-in-from-right-8 duration-300">
                        <div className="w-full bg-white/5 rounded-full h-1">
                            <div 
                                className="bg-[#D4AF37] h-1 rounded-full transition-all duration-300 shadow-[0_0_10px_#D4AF37]" 
                                style={{ width: `${((currentIndex) / testQuestions.length) * 100}%` }}
                            ></div>
                        </div>

                        <div className="bg-[#111621] border border-white/10 p-8 md:p-12 rounded-[2rem] shadow-2xl relative overflow-hidden">
                            <span className="text-[#D4AF37] text-[10px] font-bold uppercase tracking-widest mb-6 block">
                                Question {currentIndex + 1} / {testQuestions.length}
                            </span>
                            
                            <h2 className="text-xl md:text-2xl font-serif leading-relaxed mb-10 text-white">
                                {testQuestions[currentIndex].text}
                            </h2>

                            <div className="grid grid-cols-1 gap-3">
                                {testQuestions[currentIndex].options.map((opt, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleAnswer(idx)}
                                        className={`text-left p-5 rounded-xl border transition-all flex items-center gap-4 group ${
                                            answers[testQuestions[currentIndex].id] === idx 
                                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]' 
                                            : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/20 text-slate-300'
                                        }`}
                                    >
                                        <div className={`size-6 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                                            answers[testQuestions[currentIndex].id] === idx
                                            ? 'border-[#D4AF37] bg-[#D4AF37] text-black'
                                            : 'border-white/20 group-hover:border-white/50'
                                        }`}>
                                            {String.fromCharCode(65 + idx)}
                                        </div>
                                        <span className="text-sm md:text-base">{opt}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: RESULT */}
                {step === 'result' && (
                    <div className="flex flex-col items-center gap-8 animate-in zoom-in-95 duration-1000 pb-10 w-full">
                        
                        <div className="text-center mb-2">
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-2">¡Felicitaciones!</h2>
                            <p className="text-slate-400">Has completado tu evaluación de nivel.</p>
                        </div>

                        {/* --- SCREEN VERSION (Visual Only) --- */}
                        <div className="relative w-full max-w-md aspect-[3/4] bg-[#0B1120] flex flex-col shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden rounded-xl border border-slate-800">
                            <div className="absolute inset-0 guilloche-pattern opacity-30 pointer-events-none"></div>
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_120%)] pointer-events-none"></div>
                            <div className="absolute inset-4 border border-[#AA771C]/50 pointer-events-none z-20"></div>
                            <div className="absolute inset-6 border-[3px] border-double border-[#D4AF37] pointer-events-none z-20"></div>

                            <div className="relative z-30 flex flex-col items-center justify-between h-full py-12 px-8 text-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="h-14 mb-2 opacity-90 drop-shadow-[0_0_10px_rgba(212,175,55,0.3)]">
                                        <Logo className="h-full w-auto object-contain brightness-0 invert" iconOnly={true} />
                                    </div>
                                    <h2 className="font-serif text-3xl uppercase tracking-widest" style={goldGradientText}>Certificate</h2>
                                    <p className="text-[#8a8f98] text-[9px] uppercase tracking-[0.4em] font-medium">Of Proficiency</p>
                                </div>

                                <div className="flex flex-col items-center w-full gap-2">
                                    <p className="text-slate-400 font-serif italic text-xs">This is to certify that</p>
                                    <div className="w-full border-b border-[#D4AF37]/30 pb-2 mb-4 mt-2">
                                        <h1 className="text-2xl font-serif text-white capitalize tracking-wide drop-shadow-md">{userInfo.name}</h1>
                                    </div>
                                    <p className="text-slate-400 font-serif italic text-xs">has achieved the level</p>
                                    <div className="py-6 relative">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-[#D4AF37] opacity-10 blur-[50px] rounded-full animate-pulse"></div>
                                        <h1 className="text-7xl font-serif font-bold tracking-tighter" style={goldGradientText}>{level}</h1>
                                    </div>
                                </div>

                                <div className="w-full pt-4 border-t border-[#D4AF37]/20 flex justify-between items-end">
                                    <div className="text-left">
                                        {/* Simple signature path */}
                                        <svg height="30" width="80" viewBox="0 0 100 40">
                                            <path d="M10,30 Q20,10 30,30 T50,30 T70,30" stroke="#D4AF37" fill="none" strokeWidth="2" opacity="0.6" />
                                        </svg>
                                        <p className="text-[7px] text-[#D4AF37] uppercase font-bold tracking-widest mt-1">Academic Director</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white font-serif italic text-xs">{new Date().toLocaleDateString()}</p>
                                        <p className="text-[7px] text-[#D4AF37] uppercase font-bold tracking-widest mt-1">Date Issued</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- ACTIONS: LUXURY BUTTONS --- */}
                        <div className="w-full max-w-sm flex flex-col gap-3">
                            {/* Instagram DOWNLOAD Button */}
                            <button 
                                onClick={handleDownloadCertificate} 
                                disabled={generatingImg} 
                                className="group w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-between text-white shadow-lg hover:shadow-pink-500/20 active:scale-[0.98] transition-all"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="text-[10px] font-medium opacity-80 uppercase tracking-wide">Paso 1</span>
                                    <span className="font-bold text-sm">Descargar Certificado (Historia)</span>
                                </div>
                                <div className="size-10 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                    {generatingImg ? <Icon name="sync" className="animate-spin" /> : <Icon name="download" className="text-xl" />}
                                </div>
                            </button>

                            {/* WhatsApp Button (FIXED SIZE) */}
                            <button 
                                onClick={handleContactWhatsApp} 
                                className="group w-full py-4 px-6 bg-[#111621] border border-green-500/30 hover:border-green-500 hover:bg-green-500/10 rounded-xl flex items-center justify-between text-white shadow-lg transition-all active:scale-[0.98]"
                            >
                                <div className="flex flex-col items-start min-w-0 pr-4">
                                    <span className="text-[10px] text-green-500 font-bold uppercase tracking-wide truncate">Paso 2</span>
                                    <span className="font-bold text-sm truncate">Asesoría en WhatsApp</span>
                                </div>
                                <div className="size-10 min-w-[40px] bg-green-500/20 rounded-full flex items-center justify-center text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors">
                                    {/* SVG Icon Fixed Size 20x20 */}
                                    <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
                                        <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"></path>
                                    </svg>
                                </div>
                            </button>

                            {/* Facebook Button (Button Style) */}
                            <button 
                                onClick={handleShareFacebook} 
                                className="w-full py-3 bg-[#1877F2] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#166fe5] transition-all shadow-md active:scale-95"
                            >
                                <span className="font-serif font-black lowercase text-lg">f</span> Compartir en Facebook
                            </button>
                            
                            {/* Instagram Link (Button Style) */}
                            <button 
                                onClick={handleInstagramClick}
                                className="w-full py-3 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md active:scale-95"
                            >
                                <Icon name="camera_alt" className="text-lg" />
                                Visitar Instagram {INSTAGRAM_HANDLE}
                            </button>
                        </div>

                        {/* --- HIDDEN EXPORT CERTIFICATE (9:16 Aspect Ratio for Stories) --- */}
                        {/* 1080x1920 layout with Typography Header */}
                        <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
                            <div 
                                ref={exportRef}
                                style={{
                                    width: '1080px',
                                    height: '1920px',
                                    backgroundColor: '#0B1120',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    fontFamily: 'serif',
                                    color: 'white',
                                    padding: '120px 80px',
                                    textAlign: 'center',
                                    justifyContent: 'space-between' // Distribute vertically
                                }}
                            >
                                {/* 1. GUILLOCHE PATTERN BACKGROUND (SVG) */}
                                <div style={{ 
                                    position: 'absolute', inset: 0, opacity: 0.1, 
                                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23d4af37' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E\")" 
                                }}></div>

                                {/* 2. GOLD BORDER FRAME */}
                                <div style={{ position: 'absolute', top: '40px', left: '40px', right: '40px', bottom: '40px', border: '4px solid #AA771C', zIndex: 10 }}></div>
                                <div style={{ position: 'absolute', top: '60px', left: '60px', right: '60px', bottom: '60px', border: '2px solid #D4AF37', zIndex: 10 }}></div>

                                {/* TOP SECTION: TEXT HEADER (REPLACES LOGO IMAGE) */}
                                <div style={{ zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', marginTop: '100px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                                        <h2 style={{ fontSize: '60px', fontWeight: 'bold', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'serif' }}>Georgetown</h2>
                                        <h2 style={{ fontSize: '40px', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', letterSpacing: '0.4em' }}>Academy</h2>
                                        <div style={{ width: '100px', height: '4px', backgroundColor: '#D4AF37', marginTop: '20px' }}></div>
                                    </div>
                                    <h1 style={{ fontSize: '90px', fontWeight: 'bold', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '40px' }}>Certificate</h1>
                                    <p style={{ fontSize: '30px', color: '#AAAAAA', textTransform: 'uppercase', letterSpacing: '0.4em' }}>Of Proficiency</p>
                                </div>

                                {/* MIDDLE SECTION: NAME & LEVEL (Using gap instead of margin) */}
                                <div style={{ zIndex: 20, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '60px' }}>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
                                        <p style={{ fontSize: '30px', color: '#AAAAAA', fontStyle: 'italic' }}>This certifies that</p>
                                        <div style={{ borderBottom: '2px solid #AA771C', paddingBottom: '20px', width: '80%' }}>
                                            <h1 style={{ fontSize: '80px', color: 'white', fontWeight: 'bold' }}>{userInfo.name}</h1>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
                                        <p style={{ fontSize: '30px', color: '#AAAAAA', fontStyle: 'italic' }}>has successfully demonstrated proficiency at</p>
                                        
                                        {/* FIXED OVERLAP: Added explicit margin bottom to level text */}
                                        <h1 style={{ fontSize: '220px', fontWeight: 'bold', color: '#D4AF37', lineHeight: 1, marginBottom: '50px' }}>{level}</h1>
                                        <p style={{ fontSize: '30px', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 'bold' }}>CEFR Level</p>
                                    </div>
                                </div>

                                {/* BOTTOM SECTION: QR & HANDLE */}
                                <div style={{ zIndex: 20, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
                                    
                                    {/* QR CODE & CTA */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '30px', background: 'rgba(212,175,55,0.1)', padding: '30px 50px', borderRadius: '30px', border: '2px solid rgba(212,175,55,0.3)' }}>
                                        <img 
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/placement-test')}&color=D4AF37&bgcolor=0B1120`} 
                                            alt="QR" 
                                            width="120"
                                            height="120"
                                        />
                                        <div style={{ textAlign: 'left' }}>
                                            <p style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>¡Mide tu nivel gratis!</p>
                                            <p style={{ fontSize: '20px', color: '#D4AF37' }}>Escanea para iniciar</p>
                                        </div>
                                    </div>

                                    <div style={{ width: '100%', borderTop: '2px solid rgba(212,175,55,0.3)', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                        <div style={{ textAlign: 'left' }}>
                                            <p style={{ fontSize: '20px', color: '#D4AF37', fontWeight: 'bold', textTransform: 'uppercase' }}>Academic Director</p>
                                            <p style={{ fontSize: '18px', color: '#AAAAAA' }}>Georgetown Academy</p>
                                        </div>
                                        <p style={{ fontSize: '30px', fontWeight: 'bold', color: 'white', letterSpacing: '0.1em' }}>{INSTAGRAM_HANDLE}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

            </div>
        </div>
    );
};

export default PlacementTest;

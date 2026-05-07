
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM as any;
import { Icon } from './Icon';
import { Logo } from './Logo';
import { 
    getStudentSchedule, 
    verifyStudentSession, 
    logStudentEntry, 
    getBrandInfo,
    getDailyQuizByDay,
    getStudentPlacementResult,
    getStudentPackages,
    getStudentById,
    getStudentsByEmail,
    recordInternalConversion
} from '../services/db';
import { Student, ClassSession, BrandInfo, DailyQuiz, PlacementResult, StudentPackage } from '../types';
import VideoCinema from './VideoCinema';
import AISpeakingChallenge from './AISpeakingChallenge';
import { DailyQuizModal } from './DailyQuizModal';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const getCourseColor = (name: string) => {
    const colors = [
        'border-blue-500 text-blue-600 bg-blue-50',
        'border-purple-500 text-purple-600 bg-purple-50',
        'border-emerald-500 text-emerald-600 bg-emerald-50',
        'border-orange-500 text-orange-600 bg-orange-50',
        'border-pink-500 text-pink-600 bg-pink-50'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const StudentPortal: React.FC = () => {
    const navigate = useNavigate();
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [brand, setBrand] = useState<BrandInfo | null>(null);
    const [groupedUpcoming, setGroupedUpcoming] = useState<{[key: string]: ClassSession[]}>({});
    const [groupedPast, setGroupedPast] = useState<{[key: string]: ClassSession[]}>({});
    const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'quiz'>('upcoming');
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [todayClass, setTodayClass] = useState<ClassSession | null>(null);
    const [joining, setJoining] = useState(false);

    // [NEW] Additional Data
    const [dailyQuiz, setDailyQuiz] = useState<DailyQuiz | null>(null);
    const [placementResult, setPlacementResult] = useState<PlacementResult | null>(null);
    const [packages, setPackages] = useState<StudentPackage[]>([]);
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);

    // [UPDATED] 시네마 플레이어 상태
    const [cinemaData, setCinemaData] = useState<{ url: string, title: string } | null>(null);

    const getTodayString = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getMinutes = (timeStr: string) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const getMidnightDate = (dateStr: string) => {
        if (!dateStr) return new Date(0);
        const parts = dateStr.split(/[-/]/).map(Number);
        let y, m, d;
        // Check if first part is year (4 digits)
        if (parts[0] > 1000) {
            [y, m, d] = parts;
        } else {
            // Assume DD-MM-YYYY (Common in Spanish locales)
            [d, m, y] = parts;
        }
        return new Date(y, m - 1, d);
    };

    // --- SECURITY HEARTBEAT ---
    useEffect(() => {
        const checkSession = async () => {
            const studentId = localStorage.getItem('studentId');
            const token = localStorage.getItem('studentToken');
            
            if (!studentId || !token) return;

            const isValid = await verifyStudentSession(studentId, token);
            if (!isValid) {
                alert("⚠️ Se ha detectado un inicio de sesión en otro dispositivo.\n\nPor seguridad, esta sesión se cerrará automáticamente.\n\n(Duplicate login detected. Session closed.)");
                localStorage.clear();
                navigate('/student/login');
            }
        };

        const intervalId = setInterval(checkSession, 10000); // 10 seconds
        return () => clearInterval(intervalId);
    }, [navigate]);

    useEffect(() => {
        const init = async () => {
            try {
                const studentId = localStorage.getItem('studentId');
                const token = localStorage.getItem('studentToken');
                if (!studentId || !token) { navigate('/student/login'); return; }
                
                const isValid = await verifyStudentSession(studentId, token);
                if (!isValid) { 
                    alert("Sesión expirada o inválida."); 
                    localStorage.clear(); 
                    navigate('/student/login'); 
                    return; 
                }
                
                // Optimized fetching: Get only the current student and brand info
                const [me, brandInfo] = await Promise.all([
                    getStudentById(studentId),
                    getBrandInfo()
                ]);
                
                setBrand(brandInfo);
                if (!me) { navigate('/student/login'); return; }
                setStudent(me);

                // Fetch additional data in parallel
                const quizId = Math.floor(new Date().getTime() / (1000 * 3600 * 24)) % 365;
                const [quiz, placement, myPackages] = await Promise.all([
                    getDailyQuizByDay(quizId).catch(() => null),
                    getStudentPlacementResult(me.email || '').catch(() => null),
                    getStudentPackages(me.email || '').catch(() => [])
                ]);
                
                setDailyQuiz(quiz);
                setPlacementResult(placement);
                setPackages(myPackages);

                // [CRITICAL CHANGE]: Aggregate courses based on Email to link multiple enrollments
                const myCourseIds: string[] = [];
                
                if (me.email) {
                    // Optimized: Fetch only profiles with the same email
                    const myProfiles = await getStudentsByEmail(me.email);
                    
                    // Collect Course IDs from all found profiles
                    myProfiles.forEach(p => {
                        if (p.courseId && !myCourseIds.includes(p.courseId)) {
                            myCourseIds.push(p.courseId);
                        }
                    });
                } else {
                    // Fallback for legacy records without email -> use single ID
                    if (me.courseId) myCourseIds.push(me.courseId);
                }
                
                if (myCourseIds.length > 0) {
                    // Pass IDs ARRAY to the service (It handles multiple IDs correctly)
                    const allSessions = await getStudentSchedule(myCourseIds);
                    const todayStr = getTodayString();
                    const todayDate = getMidnightDate(todayStr);
                    const now = new Date();
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                    
                    const filteredSessions = allSessions;

                    // [FIXED LOGIC]: Find ALL classes for today, then pick the most relevant one
                    const todaysSessions = filteredSessions.filter(s => {
                        const sDate = getMidnightDate(s.date);
                        return sDate.getTime() === todayDate.getTime() && s.status !== 'Cancelada';
                    });

                    let bestTodayClass: ClassSession | null = null;

                    if (todaysSessions.length > 0) {
                        // 1. Try to find currently active class
                        bestTodayClass = todaysSessions.find(s => {
                            const startMins = getMinutes(s.startTime);
                            const endMins = getMinutes(s.endTime);
                            // Active window: 10 mins before start until end
                            return currentMinutes >= (startMins - 10) && currentMinutes < endMins;
                        }) || null;

                        // 2. If no active class, find next upcoming class today
                        if (!bestTodayClass) {
                            bestTodayClass = todaysSessions.find(s => {
                                const startMins = getMinutes(s.startTime);
                                return currentMinutes < startMins;
                            }) || null;
                        }

                        // 3. If no upcoming class (all finished), show the last one that finished
                        if (!bestTodayClass) {
                            bestTodayClass = todaysSessions[todaysSessions.length - 1];
                        }
                    }
                    
                    setTodayClass(bestTodayClass);

                    const future: ClassSession[] = [];
                    const past: ClassSession[] = [];

                    filteredSessions.forEach(s => {
                        const sessionDate = getMidnightDate(s.date);
                        if (sessionDate.getTime() < todayDate.getTime()) {
                            past.push(s);
                        } else if (sessionDate.getTime() > todayDate.getTime()) {
                            future.push(s);
                        } else {
                            const endMinutes = getMinutes(s.endTime);
                            if (currentMinutes > endMinutes) past.push(s); else future.push(s);
                        }
                    });
                    
                    const groupSessions = (sessions: ClassSession[]) => {
                        const groups: {[key: string]: ClassSession[]} = {};
                        sessions.forEach(s => {
                            const [y, m] = s.date.split('-'); 
                            const key = `${MONTHS[parseInt(m) - 1]} ${y}`;
                            if (!groups[key]) groups[key] = [];
                            groups[key].push(s);
                        });
                        return groups;
                    };

                    setGroupedUpcoming(groupSessions(future));
                    setGroupedPast(groupSessions(past.reverse())); 
                    const currentMonthKey = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
                    setExpandedMonths(new Set([currentMonthKey]));
                }
            } catch (error) {
                console.error("Error initializing portal:", error);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const toggleMonth = (key: string) => {
        const newSet = new Set(expandedMonths);
        if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
        setExpandedMonths(newSet);
    };

    const handleJoinClass = async () => {
        if (!todayClass || !student || joining) return;
        if (!todayClass.meetingLink) { alert("Enlace no disponible."); return; }
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = todayClass.startTime.split(':').map(Number);
        const [eh, em] = todayClass.endTime.split(':').map(Number);
        // Changed from 15 to 10 minutes before
        const startRange = (sh * 60 + sm) - 10;
        const endRange = (eh * 60 + em);
        if (currentMinutes < startRange) { alert(`La clase aún no comienza. El acceso se habilita 10 minutos antes.`); return; }
        if (currentMinutes >= endRange) { alert("Esta clase ha finalizado."); return; }
        const meetingWindow = window.open(todayClass.meetingLink, '_blank');
        if (!meetingWindow) { alert("Por favor permita las ventanas emergentes (popups) para unirse a la clase."); return; }
        setJoining(true);
        try { await logStudentEntry(student.id, todayClass.id); } catch(e) { console.warn("Log entry failed", e); } finally { setJoining(false); }
    };

    // [UPDATED] 시네마 모달 열기
    const handleOpenVideo = (url: string, title: string) => {
        setCinemaData({ url, title });
    };

    const isClassActive = () => {
        if (!todayClass) return false;
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = todayClass.startTime.split(':').map(Number);
        const [eh, em] = todayClass.endTime.split(':').map(Number);
        // Changed from 15 to 10 minutes before
        return currentMinutes >= (sh * 60 + sm - 10) && currentMinutes < (eh * 60 + em);
    };

    const renderSessionList = (groups: {[key: string]: ClassSession[]}) => {
        const keys = Object.keys(groups);
        if (keys.length === 0) return <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200"><p className="text-slate-500">No hay clases en esta sección.</p></div>;
        return keys.map(monthKey => (
            <div key={monthKey} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-4">
                <button onClick={() => toggleMonth(monthKey)} className="w-full flex items-center justify-between px-6 py-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <span className="font-bold text-slate-700 text-sm uppercase">{monthKey}</span>
                    <Icon name="expand_more" className={`text-slate-400 transition-transform ${expandedMonths.has(monthKey) ? 'rotate-180' : ''}`} />
                </button>
                {expandedMonths.has(monthKey) && (
                    <div className="divide-y divide-slate-100">
                        {groups[monthKey].map(session => {
                            const colorClass = getCourseColor(session.courseName);
                            const recs = (session.manualRecordings && session.manualRecordings.length > 0) 
                                ? session.manualRecordings 
                                : (session.recordings || []);
                            
                            // [UPDATED] Check 28-day expiration (4 weeks)
                            const sessDate = getMidnightDate(session.date);
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const diffTime = today.getTime() - sessDate.getTime();
                            const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
                            const isExpired = diffDays > 28;
                            const remainingDays = 28 - diffDays;

                            return (
                                <div key={session.id} className={`p-4 border-l-[6px] ${colorClass.split(' ')[0]}`}>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex flex-col items-center justify-center bg-slate-100 rounded-xl min-w-[52px] h-[52px] border border-slate-200">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">{session.date.split('-')[1]}</span>
                                                <span className="text-xl font-black text-slate-800">{session.date.split('-')[2]}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${colorClass.split(' ').slice(1).join(' ')}`}>{session.courseName}</span>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1"><Icon name="schedule" className="text-sm" /> {session.startTime} - {session.endTime}</div>
                                            </div>
                                        </div>
                                        {recs.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {isExpired ? (
                                                    <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-xs font-bold border border-slate-200 cursor-not-allowed select-none">
                                                        <Icon name="history_toggle_off" className="text-sm" /> Grabación Expirada ({'>'}28 días)
                                                    </span>
                                                ) : (
                                                    recs.map((r, i) => (
                                                        <button key={i} onClick={() => handleOpenVideo(r.url, r.label || `Grabación ${session.date}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors w-full sm:w-auto justify-center sm:justify-start">
                                                            <Icon name="play_circle" className="text-sm" /> 
                                                            <span>
                                                                {recs.length > 1 ? `Parte ${i + 1}` : (r.label || 'Ver Grabación')}
                                                                <span className="ml-1 opacity-75 font-medium">
                                                                    ({remainingDays <= 0 ? 'Expira hoy' : `Queda${remainingDays === 1 ? '' : 'n'} ${remainingDays} día${remainingDays === 1 ? '' : 's'}`})
                                                                </span>
                                                            </span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        ));
    };

    return (
        <div className="min-h-screen bg-[#f5f7f8] font-display pb-10">
            <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center h-[64px]">
                <div className="flex items-center gap-3"><Logo className="size-8" iconOnly={true} /><div><h1 className="text-slate-900 font-black text-sm uppercase tracking-tight">Georgetown Academy</h1></div></div>
                <button onClick={() => { localStorage.clear(); navigate('/student/login'); }} className="text-slate-400 hover:text-red-500"><Icon name="logout" /></button>
            </nav>
            <main className="max-w-md mx-auto px-4 pt-6 flex flex-col gap-6">
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="size-14 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold text-xl">{student?.name.substring(0, 2).toUpperCase()}</div>
                        <div className="flex-1">
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Bienvenido</p>
                            <h2 className="text-2xl font-black">{student?.name.split(' ')[0]}</h2>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {student?.attendance && (
                                    <span className="text-[9px] font-black bg-white/10 px-1.5 py-0.5 rounded uppercase">Asistencia: {student.attendance}%</span>
                                )}
                                {placementResult && (
                                    <span className="text-[9px] font-black bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase border border-blue-500/30">Nivel: {placementResult.calculatedLevel}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {packages.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Mis Paquetes</p>
                            <div className="space-y-2">
                                {packages.map((pkg, idx) => {
                                    const used = pkg.slots.filter(s => s.status === 'Used').length;
                                    const total = pkg.totalMonths;
                                    const remaining = total - used;
                                    return (
                                        <div key={idx} className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-300">{pkg.totalMonths} Meses</span>
                                            <span className="font-black text-white">{remaining} / {total}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* AI Tutor Premium Banner */}
                <button 
                    onClick={() => {
                        setShowAIModal(true);
                        recordInternalConversion('tryEmmaStudent').catch(console.error);
                    }}
                    className="w-full group relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-1 shadow-2xl overflow-hidden active:scale-[0.98] transition-all"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 group-hover:opacity-40 transition-opacity duration-500 blur-xl"></div>
                    <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-[22px] p-6 border border-white/10 overflow-hidden flex flex-col items-start text-left">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-500 group-hover:rotate-12">
                            <Icon name="psychology" className="text-8xl text-white" />
                        </div>
                        <div className="flex items-center gap-2 mb-3 relative z-10">
                            <span className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">Premium</span>
                            <span className="text-purple-200 text-xs font-black uppercase tracking-widest">Speaking Challenge</span>
                        </div>
                        <h3 className="text-2xl font-black text-white leading-tight mb-2 relative z-10">Practica tu Speaking<br/>con Emma</h3>
                        <p className="text-indigo-200 text-sm font-medium opacity-90 max-w-[85%] relative z-10">Mejora tu fluidez y pronunciación en 3 minutos con nuestra tutora nativa.</p>
                        
                        <div className="mt-6 flex items-center gap-2 text-white font-bold text-sm bg-white/10 px-4 py-2 rounded-xl backdrop-blur-md border border-white/5 group-hover:bg-white/20 transition-colors relative z-10">
                            <Icon name="play_arrow" /> Comenzar
                        </div>
                    </div>
                </button>

                {todayClass && (
                    <div className={`bg-white rounded-3xl p-6 shadow-xl border-2 transition-all ${isClassActive() ? 'border-blue-500' : 'border-slate-200'}`}>
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-1">
                                {isClassActive() ? <><div className="size-2 bg-red-500 rounded-full animate-ping"></div><p className="text-xs font-bold text-red-500 uppercase">Clase en vivo ahora</p></> : <p className="text-xs font-bold text-blue-500 uppercase">Clase de hoy</p>}
                            </div>
                            <h2 className="text-2xl font-black text-slate-900">{todayClass.courseName}</h2>
                            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><Icon name="schedule" className="text-sm" /> {todayClass.startTime} - {todayClass.endTime}</p>
                        </div>
                        <button onClick={handleJoinClass} disabled={!isClassActive()} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${isClassActive() ? 'bg-blue-600 text-white shadow-lg active:scale-[0.98]' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}><Icon name="video_camera_front" /> Entrar a Clase</button>
                    </div>
                )}
                <div className="bg-white p-1.5 rounded-2xl shadow-sm flex flex-wrap gap-1">
                    <button onClick={() => setActiveTab('upcoming')} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[11px] font-bold transition-all ${activeTab === 'upcoming' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>📅 Próximas</button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[11px] font-bold transition-all ${activeTab === 'history' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>⏮️ Historial</button>
                    <button onClick={() => setActiveTab('quiz')} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[11px] font-bold transition-all ${activeTab === 'quiz' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>📝 Daily Quiz</button>
                </div>
                <div className="space-y-4">
                    {activeTab === 'upcoming' && renderSessionList(groupedUpcoming)}
                    {activeTab === 'history' && renderSessionList(groupedPast)}
                    {activeTab === 'quiz' && (
                        <div className="space-y-4">
                            {dailyQuiz ? (
                                <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <Icon name="quiz" className="text-8xl text-orange-500" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="size-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
                                                <Icon name="quiz" className="text-2xl" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 text-xl">Reto Diario</h3>
                                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Daily Quiz</p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-600 mb-6 font-medium leading-relaxed">Completa el reto diario para reforzar lo aprendido en clase y ganar puntos.</p>
                                        <button 
                                            onClick={() => setShowQuizModal(true)}
                                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            <Icon name="play_arrow" />
                                            Comenzar Reto
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                                    <div className="size-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                        <Icon name="event_busy" className="text-3xl" />
                                    </div>
                                    <p className="text-slate-500 font-medium">No hay reto disponible para hoy.</p>
                                    <p className="text-xs text-slate-400 mt-1">Vuelve mañana para un nuevo reto.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* [UPDATED] 시네마 플레이어 모달 */}
            {cinemaData && (
                <VideoCinema 
                    url={cinemaData.url} 
                    title={cinemaData.title} 
                    onClose={() => setCinemaData(null)} 
                />
            )}

            {/* Daily Quiz Modal */}
            {showQuizModal && dailyQuiz && (
                <DailyQuizModal 
                    quiz={dailyQuiz} 
                    onClose={() => setShowQuizModal(false)} 
                />
            )}

            {/* AI Speaking Challenge Modal */}
            {showAIModal && student && (
                <AISpeakingChallenge 
                    studentId={student.id}
                    studentName={student.name}
                    onClose={() => setShowAIModal(false)}
                />
            )}
        </div>
    );
};
export default StudentPortal;

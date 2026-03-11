
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM as any;
import { Icon } from './Icon';
import { Logo } from './Logo';
import { getStudentSchedule, verifyStudentSession, logStudentEntry, getStudents, getBrandInfo } from '../services/db';
import { Student, ClassSession, BrandInfo } from '../types';
import VideoCinema from './VideoCinema';

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
    const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
    const [todayClass, setTodayClass] = useState<ClassSession | null>(null);
    const [joining, setJoining] = useState(false);

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
            
            const [allStudents, brandInfo] = await Promise.all([getStudents(), getBrandInfo()]);
            setBrand(brandInfo);
            const me = allStudents.find(s => s.id === studentId);
            if (!me) { navigate('/student/login'); return; }
            setStudent(me);

            // [CRITICAL CHANGE]: Aggregate courses based on Email to link multiple enrollments
            const myCourseIds: string[] = [];
            
            if (me.email) {
                // Find ALL student records with the same email (Case Insensitive)
                const myProfiles = allStudents.filter(s => 
                    s.email && s.email.toLowerCase().trim() === me.email?.toLowerCase().trim()
                );
                
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
                
                // [NEW LOGIC]: Filter out sessions that occurred before the student's registration date
                const studentRegDate = me.date ? getMidnightDate(me.date).getTime() : 0;
                const filteredSessions = allSessions.filter(s => {
                    const sDate = getMidnightDate(s.date).getTime();
                    return sDate >= studentRegDate;
                });

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
                    // Filter out the one we selected as "Today's Class" from the lists to avoid duplication?
                    // Optional: Currently showing duplicates in list is standard behavior in LMS to keep history complete.
                    // We will keep standard logic: Date based splitting.
                    
                    if (sessionDate.getTime() < todayDate.getTime()) {
                        past.push(s);
                    } else if (sessionDate.getTime() > todayDate.getTime()) {
                        future.push(s);
                    } else {
                        // For TODAY'S classes in the list:
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
            setLoading(false);
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
                            
                            // [UPDATED] Check 15-day expiration
                            const sessDate = getMidnightDate(session.date);
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const diffTime = today.getTime() - sessDate.getTime();
                            const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
                            const isExpired = diffDays > 15;
                            const remainingDays = 15 - diffDays;

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
                                                        <Icon name="history_toggle_off" className="text-sm" /> Grabación Expirada ({'>'}15 días)
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
                        <div><p className="text-slate-400 text-xs font-bold uppercase">Bienvenido</p><h2 className="text-2xl font-black">{student?.name.split(' ')[0]}</h2></div>
                    </div>
                </div>
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
                <div className="bg-white p-1.5 rounded-2xl shadow-sm flex">
                    <button onClick={() => setActiveTab('upcoming')} className={`flex-1 py-3 rounded-xl text-sm font-bold ${activeTab === 'upcoming' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>📅 Próximas</button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 rounded-xl text-sm font-bold ${activeTab === 'history' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>⏮️ Historial</button>
                </div>
                <div className="space-y-4">{activeTab === 'upcoming' ? renderSessionList(groupedUpcoming) : renderSessionList(groupedPast)}</div>
            </main>

            {/* [UPDATED] 시네마 플레이어 모달 */}
            {cinemaData && (
                <VideoCinema 
                    url={cinemaData.url} 
                    title={cinemaData.title} 
                    onClose={() => setCinemaData(null)} 
                />
            )}
        </div>
    );
};
export default StudentPortal;

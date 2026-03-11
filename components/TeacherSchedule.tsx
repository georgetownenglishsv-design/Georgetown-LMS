
// ... (Existing Imports)
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { AppUser, Student, Course, ClassSession, AttendanceRecord } from '../types';
import { getStudents, getTeacherClasses, getTeacherAttendanceHistory } from '../services/db';
import VideoCinema from './VideoCinema';

interface TeacherScheduleProps {
    userProfile: AppUser;
}

const TeacherSchedule: React.FC<TeacherScheduleProps> = ({ userProfile }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // [UPDATED] 시네마 플레이어 상태
    const [cinemaData, setCinemaData] = useState<{ url: string, title: string } | null>(null);

    useEffect(() => {
        const fetchClasses = async () => {
            setLoading(true);
            const [mySessions, myHistory] = await Promise.all([
                getTeacherClasses(userProfile.id),
                getTeacherAttendanceHistory(userProfile.id)
            ]);
            setSessions(mySessions);
            setAttendanceHistory(myHistory);
            setLoading(false);
        };
        fetchClasses();
    }, [userProfile.id]);

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const handleToday = () => setCurrentDate(new Date());

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay(); 
        const daysArray = [];
        for (let i = 0; i < firstDayOfWeek; i++) daysArray.push(null);
        for (let i = 1; i <= days; i++) daysArray.push(new Date(year, month, i));
        return daysArray;
    };

    const calendarDays = getDaysInMonth(currentDate);
    const dayNames = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

    const isSameDate = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

    const getClassesForDate = (date: Date | null) => {
        if (!date) return [];
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        return sessions.filter(s => s.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
    };

    const getSessionStatusClass = (session: ClassSession) => {
        const record = attendanceHistory.find(r => r.classSessionId === session.id);
        if (record) return 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-500/20';
        const now = new Date();
        const sessionEndDateTime = `${session.date}T${session.endTime}:00`;
        if (sessionEndDateTime < new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('.')[0]) {
            return 'bg-red-50 dark:bg-red-900/10 border-red-300 text-red-800 dark:text-red-200';
        }
        return session.mode === 'Online' ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 text-blue-900 dark:text-blue-100' : 'bg-purple-50 dark:bg-purple-500/10 border-purple-500 text-purple-900 dark:text-purple-100';
    };

    const handleClassClick = async (e: React.MouseEvent, session: ClassSession, date: Date) => {
        e.stopPropagation();
        setSelectedSession(session);
        setSelectedDate(date);
        setIsModalOpen(true);
        setLoadingDetails(true);
        try {
            const allStudents = await getStudents();
            // [CRITICAL CHANGE] Filter by courseId
            const courseStudents = allStudents.filter(s => 
                s.courseId === session.courseId && 
                (s.status === 'Activo' || s.status === 'Pagado')
            );
            setEnrolledStudents(courseStudents);
        } finally {
            setLoadingDetails(false);
        }
    };

    const closeModal = () => { setIsModalOpen(false); setSelectedSession(null); setSelectedDate(null); };

    // [UPDATED] 비디오 플레이어 핸들러
    const handleOpenVideo = (url: string, title: string) => {
        setCinemaData({ url, title });
    };

    return (
        <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden relative">
            <div className="flex-1 flex flex-col h-full overflow-hidden p-4 md:p-8 max-w-[1600px] mx-auto w-full">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white capitalize">{currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                    <div className="flex bg-white dark:bg-surface-dark rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"><Icon name="chevron_left" /></button>
                        <button onClick={handleToday} className="px-4 py-1.5 text-xs font-bold uppercase transition-colors">Hoy</button>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"><Icon name="chevron_right" /></button>
                    </div>
                </div>

                <div className="flex-1 bg-white dark:bg-[#1a1f2b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
                    <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5 shrink-0">
                        {dayNames.map(day => (<div key={day} className="py-3 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{day}</div>))}
                    </div>
                    <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto custom-scrollbar">
                        {calendarDays.map((date, idx) => {
                            const isToday = date && isSameDate(date, new Date());
                            const dayClasses = getClassesForDate(date);
                            return (
                                <div key={idx} className={`min-h-[120px] p-2 border-b border-r border-slate-200 dark:border-slate-800 transition-colors ${!date ? 'bg-slate-50/30' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}>
                                    {date && (
                                        <div className="flex flex-col h-full gap-2">
                                            <span className={`flex items-center justify-center w-8 h-8 text-sm font-bold rounded-full ${isToday ? 'bg-primary text-white shadow-lg' : 'text-slate-700 dark:text-slate-300'}`}>{date.getDate()}</span>
                                            <div className="flex flex-col gap-1 overflow-y-auto max-h-full">
                                                {dayClasses.map((cls, cIdx) => (
                                                    <div key={cIdx} onClick={(e) => handleClassClick(e, cls, date)} className={`px-2 py-1.5 rounded-lg border-l-4 text-[10px] font-bold cursor-pointer transition-all ${getSessionStatusClass(cls)}`}>
                                                        <div className="truncate">{cls.startTime} {cls.courseName}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {isModalOpen && selectedSession && selectedDate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal}></div>
                    <div className="relative w-full max-w-4xl bg-white dark:bg-[#1a1f2b] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className={`p-8 border-b border-slate-200 dark:border-slate-800 ${selectedSession.mode === 'Online' ? 'bg-blue-50/50' : 'bg-purple-50/50'}`}>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{selectedSession.courseName}</h2>
                            <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 text-sm font-bold">
                                <span className="flex items-center gap-1"><Icon name="event" /> {selectedDate.toLocaleDateString()}</span>
                                <span className="flex items-center gap-1"><Icon name="schedule" /> {selectedSession.startTime} - {selectedSession.endTime}</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-8">
                            {/* RECORDINGS IN MODAL - [UPDATED to use VideoCinema] */}
                            {selectedSession.recordings && selectedSession.recordings.length > 0 && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-5 rounded-2xl">
                                    <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Icon name="video_library" /> Grabaciones de esta sesión</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedSession.recordings.map((r, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => handleOpenVideo(r.url, r.label || `Grabación ${selectedSession.date}`)} 
                                                className="flex items-center gap-2 bg-white dark:bg-emerald-800/20 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-700 hover:shadow-md transition-all"
                                            >
                                                <Icon name="play_circle" /> {selectedSession.recordings!.length > 1 ? `Parte ${i+1}` : (r.label || 'Ver Grabación')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Estudiantes Inscritos</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {enrolledStudents.map(student => (
                                        <div key={student.id} className="flex items-center gap-3 bg-white dark:bg-surface-dark p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">{student.name.substring(0,2).toUpperCase()}</div>
                                            <div><p className="text-sm font-bold text-slate-900 dark:text-white">{student.name}</p><p className="text-xs text-slate-500">{student.studentId}</p></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-surface-dark border-t flex justify-end"><button onClick={closeModal} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl text-sm">Cerrar</button></div>
                    </div>
                </div>
            )}

            {/* [UPDATED] VideoCinema 플레이어 모달 */}
            {cinemaData && (
                <VideoCinema 
                    url={cinemaData.url} 
                    title={cinemaData.title} 
                    onClose={() => setCinemaData(null)} 
                />
            )}
        </main>
    );
};
export default TeacherSchedule;
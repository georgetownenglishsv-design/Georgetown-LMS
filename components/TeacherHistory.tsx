
// ... (Existing Imports)
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { AppUser, AttendanceRecord, ClassSession, Student } from '../types';
import { getTeacherAttendanceHistory, getTeacherClassById, getStudents } from '../services/db';
import VideoCinema from './VideoCinema';

interface TeacherHistoryProps {
    userProfile: AppUser;
}

const TeacherHistory: React.FC<TeacherHistoryProps> = ({ userProfile }) => {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
    const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null);
    const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    
    // [UPDATED] 시네마 플레이어 상태 (기존 Bridge 상태 제거 후 교체)
    const [cinemaData, setCinemaData] = useState<{ url: string, title: string } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const data = await getTeacherAttendanceHistory(userProfile.id);
            setRecords(data);
            setLoading(false);
        };
        fetchData();
    }, [userProfile.id]);

    const filteredRecords = records.filter(r => {
        if (!r.date) return false;
        const [rYear, rMonth] = r.date.split('-').map(Number);
        return (rMonth - 1) === selectedMonth && rYear === selectedYear;
    });

    const handleRecordClick = async (record: AttendanceRecord) => {
        setSelectedRecord(record);
        setIsModalOpen(true);
        setLoadingDetails(true);
        try {
            const session = await getTeacherClassById(record.classSessionId);
            setSelectedSession(session || null);
            if (session) {
                const allStudents = await getStudents();
                // [CRITICAL CHANGE]: Match by courseId
                const relevantStudents = allStudents.filter(s => 
                    (s.courseId === session.courseId) && 
                    (s.status === 'Activo' || s.status === 'Pagado' || s.status === 'Graduado')
                );
                setEnrolledStudents(relevantStudents);
            }
        } finally { setLoadingDetails(false); }
    };

    // [UPDATED] VideoCinema 플레이어 실행 핸들러
    const handleOpenVideo = (url: string, title: string) => {
        setCinemaData({ url, title });
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
        <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-y-auto">
            {/* ... (UI code remains exactly the same, only the filtering logic above changed) ... */}
            <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full flex flex-col gap-8 print:hidden">
                <header className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white">Historial Académico</h2>
                    <div className="flex gap-3">
                        <select className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>{[2023, 2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}</select>
                        <select className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>{monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                        <button onClick={() => window.print()} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"><Icon name="picture_as_pdf" /><span>Guardar PDF</span></button>
                    </div>
                </header>
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead><tr className="bg-slate-50 dark:bg-white/5 border-b text-xs uppercase font-bold text-slate-500"><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Curso</th><th className="px-6 py-4">Horario Real</th><th className="px-6 py-4">Duración</th><th className="px-6 py-4 text-right">Detalle</th></tr></thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                {filteredRecords.map((rec) => (
                                    <tr key={rec.id} onClick={() => handleRecordClick(rec)} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer group"><td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{rec.date}</td><td className="px-6 py-4 text-slate-600 dark:text-slate-300">Clase Registrada</td><td className="px-6 py-4 text-slate-500 font-mono">{rec.actualStartTime} - {rec.actualEndTime}</td><td className="px-6 py-4 text-slate-900 dark:text-white font-bold">{rec.durationMinutes} min</td><td className="px-6 py-4 text-right"><Icon name="visibility" className="text-slate-300 group-hover:text-primary" /></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {isModalOpen && selectedRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative w-full max-w-4xl bg-white dark:bg-[#1a1f2b] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="relative bg-gradient-to-r from-[#111621] to-[#1a2230] p-6 pb-8 md:p-8 md:pb-10 shrink-0"><button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 md:top-6 md:right-6 text-white/50 hover:text-white"><Icon name="close" /></button><h2 className="text-2xl md:text-3xl font-black text-white tracking-tight pr-8">{selectedSession?.courseName || 'Detalle de Sesión'}</h2><div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-slate-400 text-sm mt-2"><span><Icon name="calendar_today" /> {selectedRecord.date}</span><span><Icon name="schedule" /> {selectedRecord.actualStartTime} - {selectedRecord.actualEndTime}</span></div></div>
                        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#111218] p-6 md:p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-1 space-y-6 order-first lg:order-last">
                                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-5 rounded-2xl">
                                        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Icon name="video_library" /> Grabaciones</h4>
                                        {selectedSession?.recordings && selectedSession.recordings.length > 0 ? (
                                            <div className="flex flex-col gap-2">{selectedSession.recordings.map((rec, idx) => (
                                                <button key={idx} onClick={() => handleOpenVideo(rec.url, rec.label || `Grabación ${selectedRecord.date}`)} className="flex items-center gap-2 bg-white dark:bg-emerald-800/20 px-3 py-3 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-700 hover:shadow-md transition-all text-left w-full justify-center lg:justify-start"><Icon name="play_circle" /> {selectedSession.recordings!.length > 1 ? `Parte ${idx + 1}` : (rec.label || 'Ver Grabación')}</button>
                                            ))}</div>
                                        ) : <p className="text-xs text-slate-400 italic">No hay grabaciones vinculadas.</p>}
                                    </div>
                                    <div className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center"><div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-3 ${userProfile.colorClass}`}>{userProfile.initials}</div><h3 className="font-bold text-slate-900 dark:text-white">{userProfile.name}</h3><p className="text-slate-500 text-xs uppercase tracking-wider font-bold">Instructor</p></div>
                                </div>
                                <div className="lg:col-span-2">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Estudiantes Presentes</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{loadingDetails ? <div className="col-span-2 py-10 text-center"><Icon name="sync" className="animate-spin" /></div> : enrolledStudents.length === 0 ? <div className="col-span-2 text-center text-slate-400 py-10">Sin registros.</div> : enrolledStudents.map(student => (
                                        <div key={student.id} className="flex items-center gap-4 bg-white dark:bg-surface-dark p-3 rounded-xl border border-slate-200 dark:border-slate-800"><div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 text-sm">{student.name.substring(0,2).toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-900 dark:text-white truncate">{student.name}</p><p className="text-xs text-slate-500 truncate">{student.studentId}</p></div><Icon name="check_circle" className="text-emerald-500" /></div>
                                    ))}</div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-white dark:bg-surface-dark border-t flex justify-end shrink-0"><button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-sm w-full md:w-auto">Cerrar</button></div>
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
export default TeacherHistory;
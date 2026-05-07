
// ... (existing imports)
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Course, ExamRegistration, Student, Teacher, ClassSession, Exam } from '../types';
import { getAllGlobalExamRegistrations, getStudents, getCourses, getTeachers, getTeacherClassById, getExams } from '../services/db';

const AdminCalendar: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [courses, setCourses] = useState<Course[]>([]);
    const [exams, setExams] = useState<ExamRegistration[]>([]);
    const [examDefs, setExamDefs] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<{ type: 'class' | 'exam', data: any, date: Date, isMock?: boolean } | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [detailsData, setDetailsData] = useState<{ students: Student[], teachers?: Teacher[], sessionFullData?: ClassSession }>({ students: [] });

    // Constants
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const dayNames = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
    const years = [2023, 2024, 2025, 2026];
    
    // Map JS Date.getDay() (0-6) to Course.days strings
    const dayKeyMap = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [allCourses, allExams, allExamDefs] = await Promise.all([
            getCourses(),
            getAllGlobalExamRegistrations(),
            getExams()
        ]);
        setCourses(allCourses);
        setExams(allExams);
        setExamDefs(allExamDefs);
        setLoading(false);
    };

    // Update currentDate when dropdowns change
    useEffect(() => {
        setCurrentDate(new Date(selectedYear, selectedMonth, 1));
    }, [selectedMonth, selectedYear]);

    const handlePrevMonth = () => {
        let newMonth = selectedMonth - 1;
        let newYear = selectedYear;
        if (newMonth < 0) {
            newMonth = 11;
            newYear -= 1;
        }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
    };

    const handleNextMonth = () => {
        let newMonth = selectedMonth + 1;
        let newYear = selectedYear;
        if (newMonth > 11) {
            newMonth = 0;
            newYear += 1;
        }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
    };

    // Calendar Helpers
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

    const getEventsForDate = (date: Date | null) => {
        if (!date) return [];
        const dayIdx = date.getDay();
        const dayString = dayKeyMap[dayIdx];
        
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        const dateStr = localDate.toISOString().split('T')[0];

        const dailyClasses = courses.filter(c => {
            if (c.status !== 'Active') return false;
            if (!c.days || !c.days.includes(dayString)) return false;
            if (c.startDate && dateStr < c.startDate) return false;
            if (c.endDate && dateStr > c.endDate) return false;
            return true;
        }).map(c => ({
            type: 'class',
            data: c,
            time: c.startTime || '00:00'
        }));

        const dailyExams = exams.filter(e => e.selectedDate === dateStr);
        const examEvents = dailyExams.map(e => {
            const examDef = examDefs.find(def => def.id === e.examId);
            return { 
                type: 'exam', 
                data: e, 
                time: e.selectedTime || '00:00',
                isMock: examDef?.type === 'OnlineMock'
            };
        });

        return [...dailyClasses, ...examEvents].sort((a, b) => a.time.localeCompare(b.time));
    };

    const isSameDate = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    };

    const handleEventClick = async (e: React.MouseEvent, evt: any, date: Date) => {
        e.stopPropagation();
        setSelectedEvent({ ...evt, date });
        setIsModalOpen(true);
        setLoadingDetails(true);

        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        const dateStr = localDate.toISOString().split('T')[0];

        try {
            if (evt.type === 'class') {
                const course = evt.data as Course;
                const [allStudents, allTeachers, allSessions] = await Promise.all([
                    getStudents(),
                    getTeachers(),
                    import('../services/db').then(m => m.getAllClassSessions())
                ]);

                const sessionFullData = allSessions.find(s => s.courseId === course.id && s.date === dateStr);
                
                // [CRITICAL CHANGE]: Match by courseId instead of courseName
                const courseStudents = allStudents.filter(s => 
                    s.courseId === course.id && // strict ID match
                    (s.status === 'Activo' || s.status === 'Pagado')
                );
                
                // FIX: Support ID-based lookup for teachers assigned via Schedule Manager
                let assignedTeachers = allTeachers.filter(t => course.professors && course.professors.includes(t.name));
                
                if (sessionFullData && sessionFullData.teacherId) {
                    const sessionTeacher = allTeachers.find(t => t.id === sessionFullData.teacherId);
                    if (sessionTeacher && !assignedTeachers.some(at => at.id === sessionTeacher.id)) {
                        assignedTeachers = [sessionTeacher, ...assignedTeachers];
                    }
                }

                setDetailsData({ students: courseStudents, teachers: assignedTeachers, sessionFullData });
            } else {
                setDetailsData({ students: [] });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingDetails(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedEvent(null);
    };

    // ... (rest of the component)
    // [UPDATED] WhatsApp Invite Handler
    const handleWhatsAppInvite = (phone: string, name: string, courseName: string, whatsappLink?: string) => {
        if (!phone) {
            alert("⚠️ Este usuario no tiene número de teléfono registrado.");
            return;
        }
        
        // Clean phone: remove everything except digits
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        
        // Auto-add country code +503 if missing (assuming 8 digits for El Salvador)
        if (cleanPhone.length === 8) {
            cleanPhone = '503' + cleanPhone;
        }
        
        const firstName = name.split(' ')[0];
        
        let message = `¡Hola ${firstName}! 👋 Bienvenido/a al curso *${courseName}* en Georgetown Academy 🎓✨.`;
        
        if (whatsappLink && whatsappLink.trim() !== '') {
            message += `\n\nÚnete a nuestro grupo oficial de WhatsApp aquí 👇:\n${whatsappLink}`;
        } else {
            // Fallback warning if no link
            alert("⚠️ No hay enlace de grupo de WhatsApp configurado para este curso. Se abrirá el chat solo con el mensaje de bienvenida.");
        }

        const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const calendarDays = getDaysInMonth(currentDate);

    return (
        <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden relative">
            {/* ... (render JSX stays mostly same, only logic changed) ... */}
            <div className="flex-1 flex flex-col h-full overflow-hidden p-4 md:p-8 max-w-[1600px] mx-auto w-full">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 shrink-0 bg-white dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary"><Icon name="calendar_month" className="text-2xl" /></div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Calendario Académico</h2>
                            <p className="text-xs text-slate-500 dark:text-text-secondary">Gestión de horarios y evaluaciones</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"><Icon name="chevron_left" /></button>
                        <div className="flex gap-2">
                            <div className="relative">
                                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="appearance-none bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-8 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer w-32 md:w-auto">
                                    {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                </select>
                                <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-sm" />
                            </div>
                            <div className="relative">
                                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="appearance-none bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-8 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer">
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <Icon name="expand_more" className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-sm" />
                            </div>
                        </div>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"><Icon name="chevron_right" /></button>
                    </div>
                </div>

                <div className="flex-1 bg-white dark:bg-[#1a1f2b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col relative">
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <div className="min-w-[800px] h-full flex flex-col">
                            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5 shrink-0 sticky top-0 z-10 backdrop-blur-sm">
                                {dayNames.map(day => (<div key={day} className="py-3 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{day}</div>))}
                            </div>
                            <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                                {calendarDays.map((date, idx) => {
                                    const isToday = date && isSameDate(date, new Date());
                                    const events = getEventsForDate(date);
                                    return (
                                        <div key={idx} className={`min-h-[120px] p-2 border-b border-r border-slate-200 dark:border-slate-800 relative group transition-colors ${!date ? 'bg-slate-50/30 dark:bg-black/20' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'} ${idx % 7 === 0 || idx % 7 === 6 ? 'bg-slate-50/10 dark:bg-black/5' : ''}`}>
                                            {date && (
                                                <div className="flex flex-col h-full gap-2">
                                                    <div className="flex justify-between items-start">
                                                        <span className={`flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full ${isToday ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-slate-700 dark:text-slate-300'}`}>{date.getDate()}</span>
                                                    </div>
                                                    <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar max-h-full pb-1">
                                                        {loading ? (<div className="h-4 bg-slate-100 dark:bg-white/5 rounded animate-pulse w-full"></div>) : (
                                                            events.map((evt: any, eIdx: number) => {
                                                                const isClass = evt.type === 'class';
                                                                const isMock = evt.type === 'exam' && evt.isMock;
                                                                const isPast = date.toISOString().split('T')[0] < new Date().toISOString().split('T')[0];
                                                                
                                                                let bgClass = '';
                                                                if (isClass) {
                                                                    bgClass = evt.data.mode === 'online' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
                                                                } else if (isMock) {
                                                                    bgClass = 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
                                                                } else {
                                                                    bgClass = 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800';
                                                                }
                                                                
                                                                return (<div key={eIdx} onClick={(e) => handleEventClick(e, evt, date)} className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all hover:opacity-80 truncate ${bgClass} ${isPast ? 'opacity-60 grayscale-[50%]' : ''}`} title={isClass ? evt.data.name : `${isMock ? 'Mock Test' : 'Examen'}: ${evt.data.studentName}`}><span className="opacity-75 mr-1">{evt.time}</span>{isClass ? evt.data.name : `${isMock ? 'Mock Test' : 'Examen'} (${evt.data.studentName})`}</div>);
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isModalOpen && selectedEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={closeModal}></div>
                    <div className="relative w-full max-w-4xl bg-white dark:bg-[#1a1f2b] rounded-3xl shadow-2xl ring-1 ring-white/10 flex flex-col max-h-[90vh] overflow-hidden transform transition-all scale-100">
                        <div className={`relative px-8 py-6 shrink-0 flex justify-between items-start border-b border-slate-200 dark:border-slate-800 ${selectedEvent.type === 'class' ? 'bg-blue-50/50 dark:bg-blue-900/10' : (selectedEvent.isMock ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-amber-50/50 dark:bg-amber-900/10')}`}>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${selectedEvent.type === 'class' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : (selectedEvent.isMock ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300')}`}>
                                        <Icon name={selectedEvent.type === 'class' ? (selectedEvent.data.mode === 'online' ? 'wifi' : 'apartment') : (selectedEvent.isMock ? 'computer' : 'assignment')} className="text-sm" /> 
                                        {selectedEvent.type === 'class' ? selectedEvent.data.mode : (selectedEvent.isMock ? 'Mock Test' : 'Evaluación')}
                                    </span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{selectedEvent.type === 'class' ? selectedEvent.data.name : (selectedEvent.isMock ? 'Mock Test Programado' : 'Examen Programado')}</h2>
                                <div className="flex items-center gap-6 text-slate-600 dark:text-slate-300 text-sm font-medium">
                                    <span className="flex items-center gap-2"><Icon name="event" className="text-primary" /> {selectedEvent.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                    <span className="flex items-center gap-2"><Icon name="schedule" className="text-primary" /> {selectedEvent.data.startTime || selectedEvent.data.selectedTime} {selectedEvent.type === 'class' && selectedEvent.data.endTime ? `- ${selectedEvent.data.endTime}` : ''}</span>
                                </div>
                            </div>
                            <button onClick={closeModal} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"><Icon name="close" className="text-2xl" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#111218] p-8">
                            {selectedEvent.type === 'class' ? (
                                <div className="flex flex-col gap-8">
                                    {/* Recording Section */}
                                    {detailsData.sessionFullData?.recordings && detailsData.sessionFullData.recordings.length > 0 && (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl">
                                            <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <Icon name="video_library" /> Grabaciones Sincronizadas
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {detailsData.sessionFullData.recordings.map((rec, i) => (
                                                    <a key={i} href={rec.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white dark:bg-emerald-800/20 px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-700 hover:shadow-md transition-all">
                                                        <Icon name="play_circle" /> {rec.label || 'Ver Grabación'}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* TEACHERS LIST */}
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Icon name="groups" /> Equipo Docente</h3>
                                        {loadingDetails ? (<div className="h-20 flex items-center text-slate-400 text-sm"><Icon name="sync" className="animate-spin mr-2" /> Cargando...</div>) : !detailsData.teachers || detailsData.teachers.length === 0 ? (<div className="text-sm text-slate-500 italic">Sin profesores asignados.</div>) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {detailsData.teachers.map((teacher, idx) => (
                                                    <div key={teacher.id || idx} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-surface-dark group hover:border-green-500/30 transition-all">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`size-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0 ${teacher.colorClass || 'bg-slate-500'}`}>{teacher.initials}</div>
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{teacher.name}</p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{teacher.phone}</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleWhatsAppInvite(teacher.phone, teacher.name, selectedEvent.data.name, selectedEvent.data.whatsappLink); }}
                                                            className="size-9 rounded-full bg-[#25D366] hover:bg-[#20bd5a] flex items-center justify-center text-white shadow-md transition-all hover:scale-110 active:scale-95 shrink-0"
                                                            title="Invitar por WhatsApp"
                                                        >
                                                            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
                                                                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="border-t border-slate-200 dark:border-slate-800"></div>
                                    
                                    {/* STUDENTS LIST */}
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2"><Icon name="school" /> Estudiantes Inscritos</h3>
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded">{detailsData.students.length} Estudiantes</span>
                                        </div>
                                        {loadingDetails ? (<div className="h-40 flex items-center justify-center text-slate-400"><Icon name="sync" className="animate-spin text-2xl mr-2" /> Cargando lista...</div>) : detailsData.students.length === 0 ? (<div className="bg-slate-50 dark:bg-surface-dark rounded-xl p-8 text-center text-slate-500 border border-slate-200 dark:border-slate-800 border-dashed">No se encontraron estudiantes activos.</div>) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {detailsData.students.map(student => (
                                                    <div key={student.id} className="flex items-center justify-between gap-4 bg-white dark:bg-surface-dark p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 text-sm shrink-0">{student.name.substring(0,2).toUpperCase()}</div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{student.name}</p>
                                                                <p className="text-xs text-slate-500 truncate">{student.studentId}</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleWhatsAppInvite(student.phone, student.name, selectedEvent.data.name, selectedEvent.data.whatsappLink); }}
                                                            className="size-8 rounded-full bg-[#25D366] hover:bg-[#20bd5a] flex items-center justify-center text-white shadow-md transition-all hover:scale-110 active:scale-95 shrink-0"
                                                            title="Invitar por WhatsApp"
                                                        >
                                                            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
                                                                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6">
                                    <div className={`p-6 border rounded-2xl flex flex-col md:flex-row gap-6 items-center ${selectedEvent.isMock ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'}`}>
                                        <div className={`size-16 rounded-full flex items-center justify-center text-3xl ${selectedEvent.isMock ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}><Icon name="person" /></div>
                                        <div className="flex-1 text-center md:text-left">
                                            <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${selectedEvent.isMock ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>{selectedEvent.isMock ? 'Estudiante (Mock Test)' : 'Estudiante Examinado'}</p>
                                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{selectedEvent.data.studentName}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{selectedEvent.data.studentEmail}</p>
                                        </div>
                                        <div className="text-right"><span className={`px-4 py-2 rounded-lg font-bold text-sm ${selectedEvent.data.paymentStatus === 'Confirmado' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>Pago: {selectedEvent.data.paymentStatus}</span></div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-500 mb-1">ID Estudiante</p>
                                            <p className="font-mono font-bold text-slate-900 dark:text-white">{selectedEvent.data.studentId}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700">
                                            <p className="text-xs text-slate-500 mb-1">Teléfono</p>
                                            <p className="font-bold text-slate-900 dark:text-white">{selectedEvent.data.phone || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
                            <button onClick={closeModal} className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm hover:opacity-90 transition-opacity shadow-sm">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default AdminCalendar;
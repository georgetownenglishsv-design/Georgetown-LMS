
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './Icon';
import { getCourses, getTeachers, getAllClassSessions, batchCreateSessions, batchDeleteSessionsByIds, batchUpdateSessions } from '../services/db';
import { Course, Teacher, ClassSession } from '../types';

const ScheduleManager: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [sessions, setSessions] = useState<ClassSession[]>([]); // All sessions global for conflict check
    const [loading, setLoading] = useState(true);
    
    // Global Filter State (For the list view only)
    const now = new Date();
    const [viewMonth, setViewMonth] = useState(now.getMonth());
    const [viewYear, setViewYear] = useState(now.getFullYear());

    // --- VISUAL SCHEDULER STATE ---
    const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
    const [targetCourse, setTargetCourse] = useState<Course | null>(null);
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
    
    // Assignment Settings inside Modal
    const [assignTeacherId, setAssignTeacherId] = useState('');
    const [assignStartTime, setAssignStartTime] = useState('');
    const [assignEndTime, setAssignEndTime] = useState('');
    const [assignRoom, setAssignRoom] = useState('');
    
    // Pre-computed Conflict Map
    const [teacherConflicts, setTeacherConflicts] = useState<Set<string>>(new Set());
    // Occupancy now stores an array of names for shared days
    const [otherTeacherOccupancy, setOtherTeacherOccupancy] = useState<Map<string, string[]>>(new Map());

    // Batch processing state
    const [saving, setSaving] = useState(false);

    // --- INITIAL DATA LOAD ---
    useEffect(() => {
        loadGlobalData();
    }, []);

    const loadGlobalData = async () => {
        setLoading(true);
        const [c, t, s] = await Promise.all([
            getCourses(),
            getTeachers(),
            getAllClassSessions()
        ]);
        setCourses(c.filter(course => course.status === 'Active'));
        setTeachers(t.filter(teacher => teacher.status === 'Activo'));
        setSessions(s);
        setLoading(false);
    };

    // --- 2. FILTERING FIX: Strict Overlap Logic ---
    const filteredCourses = useMemo(() => {
        // Construct View Range (First day of selected month to Last day of selected month)
        // We use string comparison for stability against timezones
        const startOfMonth = new Date(viewYear, viewMonth, 1);
        const endOfMonth = new Date(viewYear, viewMonth + 1, 0);
        
        // Format to YYYY-MM-DD
        const viewStartStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth()+1).padStart(2,'0')}-01`;
        const viewEndStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth()+1).padStart(2,'0')}-${String(endOfMonth.getDate()).padStart(2,'0')}`;

        return courses.filter(c => {
            if (!c.startDate || !c.endDate) return false;
            // Overlap Logic: (StartA <= EndB) and (EndA >= StartB)
            return c.startDate <= viewEndStr && c.endDate >= viewStartStr;
        });
    }, [courses, viewMonth, viewYear]);


    // --- CONFLICT & OCCUPANCY CALCULATION ---
    useEffect(() => {
        if (!isSchedulerOpen || !targetCourse || !assignTeacherId) {
            setTeacherConflicts(new Set());
            return;
        }

        const conflicts = new Set<string>();
        const [startH, startM] = assignStartTime.split(':').map(Number);
        const [endH, endM] = assignEndTime.split(':').map(Number);
        const newStart = startH * 60 + startM;
        const newEnd = endH * 60 + endM;

        sessions.forEach(s => {
            // Check conflict: Same Teacher, DIFFERENT Course/Session, Overlapping Time
            if (s.teacherId === assignTeacherId) {
                // Ignore sessions for THIS course (we might be overwriting them)
                if (s.courseId === targetCourse.id) return;

                const [sStartH, sStartM] = s.startTime.split(':').map(Number);
                const [sEndH, sEndM] = s.endTime.split(':').map(Number);
                const existStart = sStartH * 60 + sStartM;
                const existEnd = sEndH * 60 + sEndM;

                if (newStart < existEnd && newEnd > existStart) {
                    conflicts.add(s.date);
                }
            }
        });
        setTeacherConflicts(conflicts);

    }, [assignTeacherId, assignStartTime, assignEndTime, sessions, targetCourse, isSchedulerOpen]);

    // Recalculate Other Teacher Occupancy (Who else is teaching this course?)
    useEffect(() => {
        if (!isSchedulerOpen || !targetCourse) {
            setOtherTeacherOccupancy(new Map());
            return;
        }

        const occupancy = new Map<string, string[]>();
        
        sessions.forEach(s => {
            if (s.courseId === targetCourse.id && s.teacherId !== assignTeacherId) {
                const existing = occupancy.get(s.date) || [];
                // Only add unique names
                const teacherName = s.teacherName?.split(' ')[0] || 'Otro';
                if (!existing.includes(teacherName)) {
                    existing.push(teacherName);
                }
                occupancy.set(s.date, existing);
            }
        });
        setOtherTeacherOccupancy(occupancy);

        // Populate selected dates for CURRENT teacher
        if (assignTeacherId) {
            const myDates = new Set<string>();
            sessions.forEach(s => {
                if (s.courseId === targetCourse.id && s.teacherId === assignTeacherId) {
                    myDates.add(s.date);
                }
            });
            setSelectedDates(myDates);
        } else {
            setSelectedDates(new Set());
        }

    }, [targetCourse, assignTeacherId, sessions, isSchedulerOpen]);


    const handleOpenScheduler = (course: Course) => {
        setTargetCourse(course);
        setAssignTeacherId(''); 
        setAssignStartTime(course.defaultStartTime || '09:00');
        setAssignEndTime(course.defaultEndTime || '10:30');
        // FIX: Changed default room from 'Zoom' to 'Teams'
        setAssignRoom(course.mode === 'online' ? 'Teams' : 'Sede Central');
        
        // Note: We no longer change viewMonth/viewYear here because the modal
        // will use the course's start/end date specifically.
        
        setIsSchedulerOpen(true);
    };

    // --- 1. CALENDAR FIX: Generate dates based on COURSE DURATION, not selected month ---
    const generateCourseDates = (course: Course) => {
        if (!course.startDate || !course.endDate) return [];
        
        // Parse dates manually to avoid timezone shifts
        const [sY, sM, sD] = course.startDate.split('-').map(Number);
        const [eY, eM, eD] = course.endDate.split('-').map(Number);
        
        const current = new Date(sY, sM - 1, sD);
        const end = new Date(eY, eM - 1, eD);
        const dates = [];
        
        while (current <= end) {
            const yyyy = current.getFullYear();
            const mm = String(current.getMonth() + 1).padStart(2, '0');
            const dd = String(current.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            
            dates.push({ 
                dateStr, 
                dayOfWeek: current.getDay(), 
                dateObj: new Date(current),
                monthName: monthNames[current.getMonth()]
            });
            current.setDate(current.getDate() + 1);
        }
        return dates;
    };

    // Helper: Check if day matches course pattern
    const isDayAllowed = (dayIndex: number) => {
        if (!targetCourse) return false;
        // Day Map: 0=DOM, 1=LUN, 2=MAR ...
        const dayMap = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
        const dayString = dayMap[dayIndex];
        
        // If course has specific days defined, enforce strict check
        if (targetCourse.defaultDays && targetCourse.defaultDays.length > 0) {
            // Also check legacy `days` if `defaultDays` missing
            const allowedDays = targetCourse.defaultDays; 
            return allowedDays.includes(dayString);
        }
        // If no restrictions defined, allow all
        return true;
    };

    const toggleDate = (dateStr: string, dayIndex: number) => {
        // 1. Check Constraint
        if (!isDayAllowed(dayIndex)) {
            return;
        }

        // 2. Check Conflict
        if (teacherConflicts.has(dateStr)) {
            alert("El profesor ya tiene clase en este horario.");
            return;
        }

        const newSet = new Set(selectedDates);
        if (newSet.has(dateStr)) newSet.delete(dateStr);
        else newSet.add(dateStr);
        setSelectedDates(newSet);
    };

    const selectAll = () => {
        if (!targetCourse) return;
        const allDates = generateCourseDates(targetCourse); // Updated to use course duration
        const newSet = new Set<string>();
        allDates.forEach(d => {
            if (isDayAllowed(d.dayOfWeek) && !teacherConflicts.has(d.dateStr)) {
                newSet.add(d.dateStr);
            }
        });
        setSelectedDates(newSet);
    };

    const clearAll = () => setSelectedDates(new Set());

    const applyPatternToWeek = (weekStartStr: string, days: number[]) => {
        if (!targetCourse) return;
        
        // Find the week range relative to the click
        // But for "Apply to ALL weeks" pattern, we should probably iterate ALL course dates
        // However, standard UX is usually "Apply to this week" or "Apply to all".
        // Let's make the buttons on the left apply to the WHOLE course for convenience since courses are 4 weeks.
        
        const allDates = generateCourseDates(targetCourse);
        const newSet = new Set(selectedDates);
        
        allDates.forEach(d => {
            if (days.includes(d.dayOfWeek)) {
                if (isDayAllowed(d.dayOfWeek) && !teacherConflicts.has(d.dateStr)) {
                    newSet.add(d.dateStr);
                }
            }
        });
        setSelectedDates(newSet);
    };

    // --- SAVE LOGIC ---
    const handleSaveSchedule = async () => {
        if (!targetCourse || !assignTeacherId) {
            alert("Seleccione un profesor.");
            return;
        }

        if (assignStartTime >= assignEndTime) {
            alert("Error: La hora de inicio debe ser ANTES de la hora de fin.");
            return;
        }
        
        setSaving(true);
        try {
            const teacherName = teachers.find(t => t.id === assignTeacherId)?.name || 'Unknown';
            const courseDates = generateCourseDates(targetCourse); // Use full course range
            const courseDateStrings = courseDates.map(d => d.dateStr);

            // 1. Fetch existing sessions (Only MY sessions for THIS course in THIS duration)
            const existingSessions = sessions.filter(s => 
                s.courseId === targetCourse.id && 
                courseDateStrings.includes(s.date) &&
                s.teacherId === assignTeacherId 
            );

            const toDeleteIds: string[] = [];
            const toUpdateData: { id: string, data: any }[] = [];
            const toCreateData: any[] = [];

            // Generate new sessions info
            const duration = (() => {
                const [h1, m1] = assignStartTime.split(':').map(Number);
                const [h2, m2] = assignEndTime.split(':').map(Number);
                return (h2*60 + m2) - (h1*60 + m1);
            })();

            // --- 3. PRESENCIAL FIX: Handle missing link ---
            const safeMeetingLink = targetCourse.mode === 'online' ? (targetCourse.meetingLink || '') : '';

            // 2. Find sessions to add or update
            selectedDates.forEach(dateStr => {
                // Ensure date is within course range (sanity check)
                if (!courseDateStrings.includes(dateStr)) return;

                const existingForDate = existingSessions.filter(s => s.date === dateStr);

                if (existingForDate.length > 0) {
                    // Update the first one
                    const sessionToUpdate = existingForDate[0];
                    toUpdateData.push({
                        id: sessionToUpdate.id,
                        data: {
                            startTime: assignStartTime,
                            endTime: assignEndTime,
                            durationMinutes: duration,
                            room: assignRoom,
                            mode: targetCourse.mode === 'online' ? 'Online' : 'Presencial',
                            meetingLink: safeMeetingLink
                        }
                    });

                    // If there are duplicates for some reason, mark them for deletion
                    if (existingForDate.length > 1) {
                        for (let i = 1; i < existingForDate.length; i++) {
                            toDeleteIds.push(existingForDate[i].id);
                        }
                    }
                } else {
                    // Create new session
                    const [y,m,day] = dateStr.split('-').map(Number);
                    const dateObj = new Date(y, m-1, day);
                    toCreateData.push({
                        courseId: targetCourse.id,
                        courseName: targetCourse.name,
                        teacherId: assignTeacherId,
                        teacherName: teacherName,
                        date: dateStr,
                        startTime: assignStartTime,
                        endTime: assignEndTime,
                        durationMinutes: duration,
                        dayOfWeek: dateObj.getDay(),
                        mode: targetCourse.mode === 'online' ? 'Online' : 'Presencial',
                        room: assignRoom,
                        status: 'Programada',
                        meetingLink: safeMeetingLink
                    });
                }
            });

            // 3. Find sessions to delete
            existingSessions.forEach(s => {
                if (!selectedDates.has(s.date) && !toDeleteIds.includes(s.id)) {
                    toDeleteIds.push(s.id);
                }
            });

            // Execute
            if (toDeleteIds.length > 0) {
                await batchDeleteSessionsByIds(toDeleteIds);
            }
            if (toUpdateData.length > 0) {
                await batchUpdateSessions(toUpdateData);
            }
            if (toCreateData.length > 0) {
                await batchCreateSessions(toCreateData);
            }

            await loadGlobalData();
            alert(`Horario actualizado para ${teacherName}.`);
            setIsSchedulerOpen(false);

        } catch (e) {
            console.error(e);
            alert("Error al guardar.");
        } finally {
            setSaving(false);
        }
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Icon name="edit_calendar" className="text-primary" />
                        Asignación Mensual
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-text-secondary">Gestione los horarios. Múltiples profesores pueden impartir el mismo curso en horarios distintos.</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-100 dark:bg-black/20 p-1 rounded-xl">
                    <button onClick={() => {
                        const d = new Date(viewYear, viewMonth - 1, 1);
                        setViewMonth(d.getMonth());
                        setViewYear(d.getFullYear());
                    }} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><Icon name="chevron_left" /></button>
                    <span className="font-bold text-slate-700 dark:text-white w-32 text-center">
                        {monthNames[viewMonth]} {viewYear}
                    </span>
                    <button onClick={() => {
                        const d = new Date(viewYear, viewMonth + 1, 1);
                        setViewMonth(d.getMonth());
                        setViewYear(d.getFullYear());
                    }} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><Icon name="chevron_right" /></button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                    <div className="text-center py-10 text-slate-400"><Icon name="sync" className="animate-spin text-2xl"/> Cargando cursos...</div>
                ) : filteredCourses.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-surface-dark rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500">
                        No hay cursos activos en este mes.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredCourses.map(course => {
                            const sessionCount = sessions.filter(s => {
                                // Count sessions in the *selected view month* for dashboard consistency
                                const [y, m] = s.date.split('-').map(Number);
                                return s.courseId === course.id && (m-1) === viewMonth && y === viewYear;
                            }).length;

                            return (
                                <div key={course.id} className="group bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-primary/50 transition-all flex flex-col gap-4">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${course.mode === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                                {course.mode}
                                            </span>
                                            {sessionCount > 0 && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded"><Icon name="check" className="text-xs" /> {sessionCount} Clases (Mes)</span>}
                                        </div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight group-hover:text-primary transition-colors">{course.name}</h3>
                                        <p className="text-xs text-slate-500 mt-1">{course.startDate} ~ {course.endDate}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wide">
                                            Días: {course.defaultDays?.join(', ') || 'Todos'}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => handleOpenScheduler(course)}
                                        className="mt-auto w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                    >
                                        <Icon name="calendar_month" /> Gestionar Horario
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {isSchedulerOpen && targetCourse && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface-dark w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#1a2230]">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Icon name="edit_calendar" className="text-primary" /> {targetCourse.name}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        Duración: {targetCourse.startDate} al {targetCourse.endDate}
                                    </span>
                                    <span className="ml-2 opacity-50">| Días permitidos: {targetCourse.defaultDays?.join(', ') || 'Todos'}</span>
                                </p>
                            </div>
                            <button onClick={() => setIsSchedulerOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors"><Icon name="close" /></button>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            <div className="w-80 bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 p-6 overflow-y-auto flex flex-col gap-6 shrink-0">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">1. Profesor</label>
                                    <select 
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                                        value={assignTeacherId}
                                        onChange={e => setAssignTeacherId(e.target.value)}
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Inicio</label>
                                        <input type="time" className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-sm font-bold" value={assignStartTime} onChange={e => setAssignStartTime(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Fin</label>
                                        <input type="time" className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-sm font-bold" value={assignEndTime} onChange={e => setAssignEndTime(e.target.value)} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Aula / Link</label>
                                    <input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold" value={assignRoom} onChange={e => setAssignRoom(e.target.value)} />
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                                        <div className="w-3 h-3 rounded-full bg-primary border border-primary"></div>
                                        <span>Seleccionado (Asignar)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                                        <div className="w-3 h-3 rounded-full bg-orange-100 border border-orange-300"></div>
                                        <span>Otros Profesores</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                                        <div className="w-3 h-3 rounded-full bg-slate-100 border border-slate-300"></div>
                                        <span>Día No Permitido</span>
                                    </div>
                                </div>

                                <div className="mt-auto border-t border-slate-200 dark:border-slate-800 pt-6">
                                    <button 
                                        onClick={handleSaveSchedule} 
                                        disabled={saving || !assignTeacherId}
                                        className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-black shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? <Icon name="sync" className="animate-spin" /> : <Icon name="save" />}
                                        Guardar Asignación
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-black/5 overflow-hidden">
                                <div className="p-4 flex flex-wrap gap-2 items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shadow-sm z-10 justify-between">
                                    <div className="flex gap-2">
                                        <button onClick={selectAll} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-bold text-slate-600 dark:text-white transition-colors flex items-center gap-2">
                                            <Icon name="select_all" /> Seleccionar Todo
                                        </button>
                                        <button onClick={clearAll} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs font-bold text-slate-600 dark:text-white hover:text-red-500 transition-colors flex items-center gap-2">
                                            <Icon name="deselect" /> Limpiar Selección
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 relative">
                                    {(() => {
                                        // CHANGED: Use generateCourseDates instead of month-based logic
                                        const dates = generateCourseDates(targetCourse);
                                        const firstDate = dates[0]?.dateObj;
                                        if(!firstDate) return <div className="p-10 text-center text-slate-400">Rango de fechas inválido.</div>;

                                        const startDay = firstDate.getDay();
                                        const gridCells = [];
                                        
                                        // Fill empty slots for first row alignment
                                        for(let i=0; i<startDay; i++) gridCells.push(null);
                                        
                                        // Fill dates
                                        dates.forEach(d => gridCells.push(d));

                                        const rows = [];
                                        for (let i = 0; i < gridCells.length; i += 7) {
                                            rows.push(gridCells.slice(i, i + 7));
                                        }

                                        return (
                                            <div className="max-w-4xl mx-auto pb-10">
                                                <div className="grid grid-cols-8 gap-2 mb-2 sticky top-0 bg-slate-50 dark:bg-black/5 z-10 pb-2">
                                                    <div className="w-16"></div> 
                                                    {dayLabels.map((d, i) => (
                                                        <div key={i} className="text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
                                                    ))}
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    {rows.map((row, rIdx) => {
                                                        // Determine month label for this row (if it changes)
                                                        const firstValidDate = row.find(c => c !== null);
                                                        
                                                        return (
                                                            <div key={rIdx} className="grid grid-cols-8 gap-2 items-center">
                                                                <div className="flex flex-col gap-1 items-center justify-center w-16">
                                                                    {/* Row Pattern Buttons apply to ALL dates in the course matching these days */}
                                                                    <button 
                                                                        onClick={() => firstValidDate && applyPatternToWeek(firstValidDate.dateStr, [1,3,5])}
                                                                        className="w-full py-1.5 rounded-md bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm" 
                                                                        title="Aplicar a todo L-M-V"
                                                                    >
                                                                        L-M-V
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => firstValidDate && applyPatternToWeek(firstValidDate.dateStr, [2,4])}
                                                                        className="w-full py-1.5 rounded-md bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-purple-600 hover:bg-purple-50 hover:border-purple-300 transition-all shadow-sm" 
                                                                        title="Aplicar a todo M-J"
                                                                    >
                                                                        M-J
                                                                    </button>
                                                                </div>

                                                                {row.map((cell, cIdx) => {
                                                                    if (!cell) return <div key={cIdx} className="aspect-square"></div>;

                                                                    const isSelected = selectedDates.has(cell.dateStr);
                                                                    const otherTeachers = otherTeacherOccupancy.get(cell.dateStr) || [];
                                                                    const isConflict = teacherConflicts.has(cell.dateStr);
                                                                    const isAllowed = isDayAllowed(cell.dayOfWeek);
                                                                    const isDisabled = isConflict || !isAllowed;

                                                                    let cellClass = "bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-700 text-slate-400";
                                                                    
                                                                    if (!isAllowed) {
                                                                        cellClass = "bg-slate-100 dark:bg-slate-800 border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed";
                                                                    } else if (isConflict) {
                                                                        cellClass = "bg-red-50 border-red-200 text-red-300 cursor-not-allowed";
                                                                    } else if (isSelected) {
                                                                        cellClass = "bg-primary border-primary text-white shadow-md transform scale-[1.02]";
                                                                    } else if (otherTeachers.length > 0) {
                                                                        cellClass = "bg-orange-50 border-orange-200 text-orange-400 hover:border-orange-400";
                                                                    } else {
                                                                        cellClass += " hover:border-primary/50 hover:text-primary";
                                                                    }

                                                                    return (
                                                                        <div key={cIdx} className="aspect-square relative group">
                                                                            <button 
                                                                                disabled={isDisabled}
                                                                                onClick={() => toggleDate(cell.dateStr, cell.dayOfWeek)}
                                                                                className={`w-full h-full rounded-xl border-2 flex flex-col items-center justify-center transition-all relative overflow-hidden ${cellClass}`}
                                                                            >
                                                                                <span className="text-xs font-bold z-10">{cell.monthName.substring(0,3)}</span>
                                                                                <span className="text-lg font-black z-10 leading-none">{cell.dateObj.getDate()}</span>
                                                                                
                                                                                {isSelected && <Icon name="check" className="text-xs mt-1 z-10" />}
                                                                                
                                                                                {!isSelected && otherTeachers.length > 0 && (
                                                                                    <div className="absolute inset-0 flex items-end justify-center pb-1">
                                                                                        <span className="text-[7px] font-bold uppercase truncate max-w-full px-1 leading-tight text-center">
                                                                                            {otherTeachers.join(', ')}
                                                                                        </span>
                                                                                    </div>
                                                                                )}

                                                                                {isConflict && (
                                                                                    <div className="absolute inset-0 bg-red-100/50 flex items-center justify-center">
                                                                                        <Icon name="block" className="text-red-500 opacity-50" />
                                                                                    </div>
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default ScheduleManager;

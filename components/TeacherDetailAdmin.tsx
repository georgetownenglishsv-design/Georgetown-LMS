
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { AppUser, ClassSession, Teacher, AttendanceRecord } from '../types';
import { getTeacherById, getTeacherClasses, getTeacherAttendanceHistory, markAttendance, deleteAttendanceRecord, updateAttendanceRecord } from '../services/db';

interface TeacherDetailAdminProps {
    teacherId: string;
    currentUser: AppUser;
    onBack: () => void;
}

interface CalendarItem {
    type: 'session' | 'ghost';
    id: string;
    startTime: string;
    name: string;
    isPaid: boolean;
    recordId?: string;
    duration?: number;
    originalSession?: ClassSession;
}

// Interface for Aggregated Payroll Item
interface PayrollItem {
    courseName: string;
    count: number;
    totalHours: number;
    rate: number;
    totalAmount: number;
    isGhost: boolean;
    dates: string[]; // Store dates for tooltip or detail if needed
}

const TeacherDetailAdmin: React.FC<TeacherDetailAdminProps> = ({ teacherId, currentUser, onBack }) => {
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [activeTab, setActiveTab] = useState<'schedule' | 'payments'>('schedule');
    const [classes, setClasses] = useState<ClassSession[]>([]);
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // Payroll Filter State
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
    const [editDuration, setEditDuration] = useState<number>(0); 
    const [processing, setProcessing] = useState(false);

    // Constants defined inside component to avoid ReferenceError
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const availableYears = [2023, 2024, 2025, 2026];
    const dayLabels = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

    useEffect(() => {
        loadData();
    }, [teacherId]);

    const loadData = async () => {
        setLoading(true);
        const [tData, clsData, histData] = await Promise.all([
            getTeacherById(teacherId),
            getTeacherClasses(teacherId),
            getTeacherAttendanceHistory(teacherId)
        ]);
        setTeacher(tData);
        setClasses(clsData);
        setHistory(histData);
        setLoading(false);
    };

    // --- CALENDAR HELPERS ---
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

    const isSameDate = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

    const getCalendarItemsForDate = (date: Date | null): CalendarItem[] => {
        if (!date) return [];
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const items: CalendarItem[] = [];

        // 1. Regular Sessions
        const dailySessions = classes.filter(s => s.date === dateStr);
        dailySessions.forEach(s => {
            const record = history.find(h => h.classSessionId === s.id);
            items.push({
                type: 'session',
                id: s.id,
                startTime: s.startTime,
                name: s.courseName,
                isPaid: !!record,
                recordId: record?.id,
                duration: record?.durationMinutes || s.durationMinutes,
                originalSession: s
            });
        });

        // 2. Ghost Sessions (Records present in history but MISSING in classes)
        const dailyRecords = history.filter(h => h.date === dateStr);
        dailyRecords.forEach(r => {
            const isLinked = dailySessions.some(s => s.id === r.classSessionId);
            if (!isLinked) {
                items.push({
                    type: 'ghost',
                    id: r.id, 
                    startTime: r.actualStartTime || '??:??',
                    name: "⚠️ Clase Eliminada",
                    isPaid: true,
                    recordId: r.id,
                    duration: r.durationMinutes
                });
            }
        });

        return items.sort((a, b) => a.startTime.localeCompare(b.startTime));
    };

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const handleItemClick = (item: CalendarItem) => {
        setSelectedItem(item);
        setEditDuration(item.duration || 60);
        setIsModalOpen(true);
    };

    // --- ACTIONS ---
    const handleMarkAttendance = async () => {
        if (!selectedItem || !selectedItem.originalSession || !teacher) return;
        if (!confirm("¿Confirmar asistencia?")) return;

        setProcessing(true);
        try {
            const s = selectedItem.originalSession;
            const payload = {
                classSessionId: s.id,
                teacherId: teacher.id,
                date: s.date,
                actualStartTime: s.startTime,
                actualEndTime: s.endTime,
                durationMinutes: s.durationMinutes,
                notes: 'Manual Admin',
                status: 'Presente' as const
            };
            await markAttendance(payload);
            await loadData();
            setIsModalOpen(false);
        } catch (e) {
            alert("Error al registrar.");
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteRecord = async () => {
        if (!selectedItem || !selectedItem.recordId) return;
        const msg = selectedItem.type === 'ghost' 
            ? "⚠️ ¿Eliminar permanentemente este registro huérfano?" 
            : "¿Anular asistencia? El profesor dejará de ver el pago.";

        if (!confirm(msg)) return;

        setProcessing(true);
        try {
            await deleteAttendanceRecord(selectedItem.recordId);
            await loadData();
            setIsModalOpen(false);
        } catch (e) {
            alert("Error al eliminar.");
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdateDuration = async () => {
        if (!selectedItem || !selectedItem.recordId) return;
        setProcessing(true);
        try {
            await updateAttendanceRecord(selectedItem.recordId, {
                durationMinutes: Number(editDuration)
            });
            await loadData();
            setIsModalOpen(false);
            alert("Duración actualizada. La nómina se ha recalculado.");
        } catch (e) {
            alert("Error al actualizar.");
        } finally {
            setProcessing(false);
        }
    };

    // --- STATS CALCULATION (Real-time based on Calendar View) ---
    const stats = useMemo(() => {
        if (!teacher) return { earnings: 0, hours: 0, attendance: 0, rate: 0 };
        
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth(); 

        const monthlyRecords = history.filter(h => {
            const d = new Date(h.date);
            return d.getFullYear() === y && d.getMonth() === m;
        });

        let totalEarnings = 0;
        let totalMinutes = 0;

        monthlyRecords.forEach(r => {
            const session = classes.find(c => c.id === r.classSessionId);
            const isOnline = session?.mode === 'Online'; 
            const rate = isOnline 
                ? (teacher.hourlyRateOnline || teacher.hourlyRate || 0) 
                : (teacher.hourlyRateOffline || teacher.hourlyRate || 0);
            
            const hours = r.durationMinutes / 60;
            totalEarnings += hours * rate;
            totalMinutes += r.durationMinutes;
        });

        const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
        const scheduledCount = classes.filter(c => c.date.startsWith(prefix)).length;
        const ratePct = scheduledCount > 0 ? Math.round((monthlyRecords.length / scheduledCount) * 100) : 0;

        return {
            earnings: totalEarnings,
            hours: totalMinutes / 60,
            attendance: ratePct,
            rate: teacher.hourlyRateOnline || teacher.hourlyRate || 0
        };
    }, [teacher, history, classes, currentDate]);

    // --- PAYROLL AGGREGATION ---
    const payrollData = useMemo(() => {
        if (!teacher) return { online: [], offline: [], totalOnline: 0, totalOffline: 0, hoursOnline: 0, hoursOffline: 0, grandTotal: 0 };

        const targetPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        const records = history.filter(h => h.date && h.date.startsWith(targetPrefix));
        
        // Maps to aggregate data: Key = Course Name
        const onlineMap = new Map<string, PayrollItem>();
        const offlineMap = new Map<string, PayrollItem>();

        records.forEach(rec => {
            const session = classes.find(c => c.id === rec.classSessionId);
            const courseName = session?.courseName || '⚠️ Registro Eliminado';
            const mode = session?.mode || 'Presencial';
            const isOnline = mode.toLowerCase() === 'online';
            
            const rate = isOnline 
                ? (teacher.hourlyRateOnline || teacher.hourlyRate || 0)
                : (teacher.hourlyRateOffline || teacher.hourlyRate || 0);
            
            const hours = rec.durationMinutes / 60;
            const amount = hours * rate;
            const isGhost = !session;

            const targetMap = isOnline ? onlineMap : offlineMap;
            const key = courseName; // Group by Name

            if (targetMap.has(key)) {
                const existing = targetMap.get(key)!;
                existing.count += 1;
                existing.totalHours += hours;
                existing.totalAmount += amount;
                existing.dates.push(rec.date);
            } else {
                targetMap.set(key, {
                    courseName,
                    count: 1,
                    totalHours: hours,
                    rate,
                    totalAmount: amount,
                    isGhost,
                    dates: [rec.date]
                });
            }
        });

        const onlineItems = Array.from(onlineMap.values());
        const offlineItems = Array.from(offlineMap.values());

        const totalOnline = onlineItems.reduce((acc, item) => acc + item.totalAmount, 0);
        const hoursOnline = onlineItems.reduce((acc, item) => acc + item.totalHours, 0);
        
        const totalOffline = offlineItems.reduce((acc, item) => acc + item.totalAmount, 0);
        const hoursOffline = offlineItems.reduce((acc, item) => acc + item.totalHours, 0);

        return { 
            online: onlineItems, 
            offline: offlineItems, 
            totalOnline,
            totalOffline,
            hoursOnline,
            hoursOffline,
            grandTotal: totalOnline + totalOffline 
        };
    }, [history, classes, teacher, selectedMonth, selectedYear]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    const calendarDays = getDaysInMonth(currentDate);

    if (loading || !teacher) {
        return <div className="flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500"><Icon name="sync" className="animate-spin text-2xl" /></div>;
    }

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark print:bg-white">
            {/* Header */}
            <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 shadow-sm z-10 shrink-0 print:hidden">
                <div className="max-w-[1600px] mx-auto px-4 py-4 md:px-8 md:py-6">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-primary mb-4 transition-colors text-sm font-medium">
                        <Icon name="arrow_back" /> Volver a lista
                    </button>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`size-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-xl ${teacher.colorClass}`}>
                                {teacher.initials}
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 dark:text-white">{teacher.name}</h1>
                                <p className="text-slate-500 text-sm">{teacher.email}</p>
                            </div>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-black/20 p-1 rounded-xl">
                            <button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'schedule' ? 'bg-white dark:bg-slate-700 shadow text-primary dark:text-white' : 'text-slate-500'}`}>Calendario</button>
                            <button onClick={() => setActiveTab('payments')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'payments' ? 'bg-white dark:bg-slate-700 shadow text-primary dark:text-white' : 'text-slate-500'}`}>Nómina</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 dark:bg-black/10 print:p-0 print:bg-white">
                <div className="max-w-[1200px] mx-auto h-full flex flex-col gap-6">
                    
                    {/* --- STATS DASHBOARD --- */}
                    {activeTab === 'schedule' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl"><Icon name="payments" className="text-2xl" /></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Est. Mensual</p><p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(stats.earnings)}</p></div>
                            </div>
                            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl"><Icon name="schedule" className="text-2xl" /></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Horas Totales</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.hours.toFixed(1)}h</p></div>
                            </div>
                            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-xl"><Icon name="fact_check" className="text-2xl" /></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Cumplimiento</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.attendance}%</p></div>
                            </div>
                            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-xl"><Icon name="monetization_on" className="text-2xl" /></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Tarifa Base</p><p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(stats.rate)}/h</p></div>
                            </div>
                        </div>
                    )}

                    {/* --- SCHEDULE TAB (CALENDAR) --- */}
                    {activeTab === 'schedule' && (
                        <div className="flex-1 flex flex-col bg-white dark:bg-surface-dark rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden min-h-[600px]">
                            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white capitalize">{currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                                <div className="flex bg-slate-100 dark:bg-black/20 rounded-xl p-1">
                                    <button onClick={handlePrevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><Icon name="chevron_left" /></button>
                                    <button onClick={() => setCurrentDate(new Date())} className="px-4 text-xs font-bold uppercase hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors">Hoy</button>
                                    <button onClick={handleNextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><Icon name="chevron_right" /></button>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black/5 shrink-0">
                                    {dayLabels.map(d => (<div key={d} className="py-3 text-center text-xs font-bold text-slate-400 uppercase">{d}</div>))}
                                </div>
                                <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
                                    {calendarDays.map((date, idx) => {
                                        const items = getCalendarItemsForDate(date);
                                        return (
                                            <div key={idx} className={`min-h-[140px] p-2 border-b border-r border-slate-200 dark:border-slate-800 ${!date ? 'bg-slate-50/50 dark:bg-black/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}>
                                                {date && (
                                                    <div className="flex flex-col h-full gap-2">
                                                        <span className={`flex items-center justify-center size-7 text-xs font-bold rounded-full ${isSameDate(date, new Date()) ? 'bg-primary text-white' : 'text-slate-700 dark:text-slate-300'}`}>{date.getDate()}</span>
                                                        <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-1 max-h-[120px]">
                                                            {items.map(item => (
                                                                <button 
                                                                    key={item.id} 
                                                                    onClick={() => handleItemClick(item)} 
                                                                    className={`text-left px-2 py-1 rounded-lg border-l-2 transition-all hover:scale-[1.02] shadow-sm flex flex-col w-full overflow-hidden ${
                                                                        item.type === 'ghost' 
                                                                            ? 'bg-red-50 border-red-500 text-red-700' 
                                                                            : item.isPaid 
                                                                                ? 'bg-emerald-50 border-emerald-500 text-emerald-900' 
                                                                                : 'bg-slate-100 border-slate-300 text-slate-500'
                                                                    }`}
                                                                    title={item.name}
                                                                >
                                                                    <div className="flex items-center gap-1.5 w-full">
                                                                        <span className="font-mono text-[10px] font-black opacity-80 shrink-0">{item.startTime}</span>
                                                                        <span className="truncate text-[10px] font-bold block min-w-0">{item.name}</span>
                                                                    </div>
                                                                </button>
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
                    )}

                    {/* --- PAYROLL TAB (AGGREGATED) --- */}
                    {activeTab === 'payments' && (
                        <div className="flex flex-col gap-6">
                            <div className="bg-white dark:bg-surface-dark rounded-xl p-4 flex justify-between items-center shadow-sm print:hidden">
                                <div className="flex gap-3">
                                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-slate-100 dark:bg-black/20 border-none rounded-lg px-3 py-2 font-bold text-sm dark:text-white cursor-pointer">{monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-slate-100 dark:bg-black/20 border-none rounded-lg px-3 py-2 font-bold text-sm dark:text-white cursor-pointer">{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
                                </div>
                                <button onClick={() => window.print()} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-black transition-colors"><Icon name="print" /> Imprimir</button>
                            </div>

                            <div className="bg-white p-10 shadow-2xl print:shadow-none min-h-[800px]">
                                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                                    <div>
                                        <Logo className="h-12 w-auto mb-2 text-primary" />
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Reporte de Honorarios Docentes</p>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-4xl font-black text-slate-900 uppercase">NÓMINA</h2>
                                        <p className="text-slate-500 font-mono text-sm mt-1">PERIODO: {monthNames[selectedMonth].toUpperCase()} {selectedYear}</p>
                                        <p className="text-slate-900 font-bold mt-1">{teacher.name}</p>
                                    </div>
                                </div>

                                {/* Online Section */}
                                <div className="mb-8">
                                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-3 border-b border-blue-100 pb-1">Clases Online</h3>
                                    <table className="w-full text-sm text-left">
                                        <thead><tr className="text-slate-400 text-xs uppercase"><th className="pb-2">Periodo</th><th className="pb-2">Curso / Concepto</th><th className="pb-2 text-center">Sesiones</th><th className="pb-2 text-right">Horas</th><th className="pb-2 text-right">Tarifa</th><th className="pb-2 text-right">Total</th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {payrollData.online.map((item, i) => (
                                                <tr key={i} className={item.isGhost ? "bg-red-50" : ""}>
                                                    <td className="py-3 font-medium text-slate-500">{monthNames[selectedMonth]}</td>
                                                    <td className={`py-3 font-bold ${item.isGhost ? "text-red-500" : "text-slate-700"}`}>{item.courseName}</td>
                                                    <td className="py-3 text-center text-slate-600">{item.count}</td>
                                                    <td className="py-3 text-right font-mono text-slate-600">{item.totalHours.toFixed(2)}</td>
                                                    <td className="py-3 text-right text-slate-500">${item.rate.toFixed(2)}/h</td>
                                                    <td className="py-3 text-right font-bold text-slate-900">{formatCurrency(item.totalAmount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-blue-50/50 font-bold text-blue-800">
                                                <td colSpan={3} className="py-3 text-right pr-4 uppercase text-xs">Subtotal Online</td>
                                                <td className="py-3 text-right">{payrollData.hoursOnline.toFixed(2)} h</td>
                                                <td></td>
                                                <td className="py-3 text-right">{formatCurrency(payrollData.totalOnline)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Offline Section */}
                                <div className="mb-8">
                                    <h3 className="text-sm font-black text-purple-600 uppercase tracking-widest mb-3 border-b border-purple-100 pb-1">Clases Presenciales</h3>
                                    <table className="w-full text-sm text-left">
                                        <thead><tr className="text-slate-400 text-xs uppercase"><th className="pb-2">Periodo</th><th className="pb-2">Curso / Concepto</th><th className="pb-2 text-center">Sesiones</th><th className="pb-2 text-right">Horas</th><th className="pb-2 text-right">Tarifa</th><th className="pb-2 text-right">Total</th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {payrollData.offline.map((item, i) => (
                                                <tr key={i} className={item.isGhost ? "bg-red-50" : ""}>
                                                    <td className="py-3 font-medium text-slate-500">{monthNames[selectedMonth]}</td>
                                                    <td className={`py-3 font-bold ${item.isGhost ? "text-red-500" : "text-slate-700"}`}>{item.courseName}</td>
                                                    <td className="py-3 text-center text-slate-600">{item.count}</td>
                                                    <td className="py-3 text-right font-mono text-slate-600">{item.totalHours.toFixed(2)}</td>
                                                    <td className="py-3 text-right text-slate-500">${item.rate.toFixed(2)}/h</td>
                                                    <td className="py-3 text-right font-bold text-slate-900">{formatCurrency(item.totalAmount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-purple-50/50 font-bold text-purple-800">
                                                <td colSpan={3} className="py-3 text-right pr-4 uppercase text-xs">Subtotal Presencial</td>
                                                <td className="py-3 text-right">{payrollData.hoursOffline.toFixed(2)} h</td>
                                                <td></td>
                                                <td className="py-3 text-right">{formatCurrency(payrollData.totalOffline)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="mt-10 pt-6 border-t-2 border-slate-900 flex justify-end">
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total a Pagar</p>
                                        <p className="text-4xl font-black text-slate-900 bg-emerald-100 px-4 py-1 inline-block rounded-lg">{formatCurrency(payrollData.grandTotal)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Logic remains same */}
            {isModalOpen && selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl p-6 max-w-sm w-full relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><Icon name="close" /></button>
                        <div className="text-center mb-6">
                            <h3 className={`text-lg font-black mb-1 ${selectedItem.type === 'ghost' ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{selectedItem.name}</h3>
                            <p className="text-sm text-slate-500">{selectedItem.startTime}</p>
                        </div>
                        <div className="flex flex-col gap-4">
                            {selectedItem.type === 'ghost' ? (
                                <div className="space-y-3">
                                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-center"><p className="text-red-700 dark:text-red-400 font-bold flex items-center justify-center gap-2"><Icon name="warning" /> Registro Huérfano</p><p className="text-xs text-red-600/70 mt-1">El curso fue eliminado, pero este pago existe.</p></div>
                                    <div className="p-3 bg-white border border-slate-200 rounded-xl"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ajustar Duración (Min)</label><div className="flex gap-2"><input type="number" value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 p-2 text-center font-bold text-slate-900"/><button onClick={handleUpdateDuration} className="bg-slate-900 text-white px-3 rounded-lg text-xs font-bold">OK</button></div></div>
                                    <button onClick={handleDeleteRecord} disabled={processing} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg active:scale-95">{processing ? 'Procesando...' : '🗑️ Eliminar Definitivamente'}</button>
                                </div>
                            ) : selectedItem.isPaid ? (
                                <div className="space-y-3">
                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl"><label className="block text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase mb-1">Duración Real (Minutos)</label><div className="flex gap-2"><input type="number" value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} className="w-full rounded-lg border border-emerald-300 p-2 text-center font-bold text-emerald-900"/><button onClick={handleUpdateDuration} className="flex-1 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700">Actualizar</button></div></div>
                                    <button onClick={handleDeleteRecord} disabled={processing} className="w-full py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold text-sm transition-colors">Anular Asistencia (Remover Pago)</button>
                                </div>
                            ) : (
                                <>
                                    <div className="p-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl text-center"><p className="text-slate-500 font-medium text-sm">Sin registro de asistencia.</p><p className="text-xs text-slate-400 mt-1">Confirme para agregar al pago.</p></div>
                                    <button onClick={handleMarkAttendance} disabled={processing} className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all">{processing ? 'Guardando...' : 'Confirmar Asistencia Manual'}</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default TeacherDetailAdmin;

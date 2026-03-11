
// ... (Existing Imports)
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './Icon';
import { getStudents, getCourses, getExams, getTeachers, getTeacherAttendanceHistory, getAllClassSessions } from '../services/db';
import { Student, Course, Exam, Teacher, ClassSession, AttendanceRecord } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM as any;

const Finance: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'payroll'>('overview');
    
    // Data State
    const [students, setStudents] = useState<Student[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [allHistory, setAllHistory] = useState<AttendanceRecord[]>([]);

    // Overview Stats
    const [revenue, setRevenue] = useState(0);
    const [expenses, setExpenses] = useState(0);
    const [pending, setPending] = useState(0);
    const [monthlyData, setMonthlyData] = useState<any[]>([]);
    const [pieData, setPieData] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [sData, cData, eData, tData, sessData, hData] = await Promise.all([
            getStudents(),
            getCourses(),
            getExams(),
            getTeachers(),
            getAllClassSessions(),
            Promise.resolve([]) 
        ]);

        const historyPromises = tData.map(t => getTeacherAttendanceHistory(t.id));
        const historyResults = await Promise.all(historyPromises);
        const flatHistory = historyResults.flat();

        setStudents(sData);
        setCourses(cData);
        setExams(eData);
        setTeachers(tData);
        setSessions(sessData);
        setAllHistory(flatHistory);

        calculateOverview(sData, cData, eData, tData, sessData);
        setLoading(false);
    };

    const calculateOverview = (students: Student[], courses: Course[], exams: Exam[], teachers: Teacher[], sessions: ClassSession[]) => {
        // [CRITICAL CHANGE]: Map prices by Course ID, not Name
        const coursePriceMap = new Map<string, number>();
        courses.forEach(c => coursePriceMap.set(c.id, c.price));

        let totalTuition = 0;
        let pendingAmount = 0;

        students.forEach(s => {
            // Use courseId for lookup if available, fall back to matching by name only if ID missing (legacy)
            let price = 0;
            if (s.courseId) {
                price = coursePriceMap.get(s.courseId) || 0;
            } else {
                // Fallback for very old records without ID migration
                const found = courses.find(c => c.name === s.course);
                price = found ? found.price : 0;
            }

            if (s.status === 'Activo' || s.status === 'Pagado') totalTuition += price;
            if (s.status === 'Pendiente') pendingAmount += price;
        });

        let totalExamFees = 0;
        exams.forEach(e => {
            totalExamFees += (e.paidCount || 0) * (e.price || 0);
            pendingAmount += (e.pendingCount || 0) * (e.price || 0);
        });

        let totalPayrollEst = 0;
        setRevenue(totalTuition + totalExamFees);
        setExpenses(totalPayrollEst);
        setPending(pendingAmount);
        
        setPieData([
            { name: 'Matrículas', value: totalTuition, color: '#1754cf' },
            { name: 'Exámenes', value: totalExamFees, color: '#f59e0b' },
        ]);
        
        const txs = students
            .filter(s => s.status !== 'Graduado')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5)
            .map(s => {
                const p = s.courseId ? (coursePriceMap.get(s.courseId) || 0) : 0;
                return {
                    id: s.id,
                    name: s.name,
                    item: s.course,
                    amount: p,
                    status: s.status === 'Pagado' || s.status === 'Activo' ? 'Completado' : 'Pendiente',
                    date: s.date
                };
            });
        setTransactions(txs);
    };

    // --- PAYROLL CALCULATION LOGIC ---
    const payrollSummary = useMemo(() => {
        const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
        
        return teachers.map(t => {
            const myRecords = allHistory.filter(h => h.teacherId === t.id && h.date.startsWith(currentMonthPrefix));
            
            let onlineTotal = 0;
            let offlineTotal = 0;
            let onlineHours = 0;
            let offlineHours = 0;

            myRecords.forEach(rec => {
                const session = sessions.find(s => s.id === rec.classSessionId);
                const mode = session?.mode || 'Presencial';
                const hours = rec.durationMinutes / 60;
                
                if (mode.toLowerCase() === 'online') {
                    onlineHours += hours;
                    onlineTotal += hours * (t.hourlyRateOnline || t.hourlyRate || 0);
                } else {
                    offlineHours += hours;
                    offlineTotal += hours * (t.hourlyRateOffline || t.hourlyRate || 0);
                }
            });

            return {
                teacher: t,
                onlineHours,
                offlineHours,
                onlineTotal,
                offlineTotal,
                grandTotal: onlineTotal + offlineTotal
            };
        });
    }, [teachers, allHistory, sessions]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    if (loading) return <div className="flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500"><Icon name="sync" className="animate-spin text-3xl" /></div>;

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
            {/* ... (Render stays the same) ... */}
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-6 shrink-0 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">Finanzas & Nómina</h1>
                    <p className="text-sm text-slate-500 dark:text-text-secondary">Control de ingresos y pagos a docentes.</p>
                </div>
                <div className="flex bg-slate-100 dark:bg-black/20 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'overview' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}
                    >
                        General
                    </button>
                    <button 
                        onClick={() => setActiveTab('payroll')}
                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'payroll' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}
                    >
                        Nómina Docente
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="max-w-[1600px] mx-auto space-y-8">
                    
                    {activeTab === 'overview' && (
                        <>
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Ingresos Totales</p>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">{formatCurrency(revenue)}</h3>
                                </div>
                                <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Por Cobrar</p>
                                    <h3 className="text-3xl font-black text-orange-500 mt-2">{formatCurrency(pending)}</h3>
                                </div>
                                <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Nómina Estimada (Mes)</p>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                                        {formatCurrency(payrollSummary.reduce((sum, p) => sum + p.grandTotal, 0))}
                                    </h3>
                                </div>
                            </div>

                            {/* Charts Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-6">Fuentes de Ingreso</h3>
                                    <div className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">Transacciones Recientes</h3>
                                    <div className="space-y-3">
                                        {transactions.map((tx, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                                                <div><p className="font-bold text-slate-900 dark:text-white">{tx.name}</p><p className="text-xs text-slate-500">{tx.item}</p></div>
                                                <span className="font-bold text-emerald-600">{formatCurrency(tx.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'payroll' && (
                        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-black/20">
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Resumen de Pagos (Mes Actual)</h3>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase font-bold">Total a Dispersar</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                                        {formatCurrency(payrollSummary.reduce((sum, p) => sum + p.grandTotal, 0))}
                                    </p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white dark:bg-surface-dark text-xs uppercase text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4">Profesor</th>
                                            <th className="px-6 py-4 text-center">Hrs Online</th>
                                            <th className="px-6 py-4 text-center">Hrs Presencial</th>
                                            <th className="px-6 py-4 text-right">Subtotal Online</th>
                                            <th className="px-6 py-4 text-right">Subtotal Presencial</th>
                                            <th className="px-6 py-4 text-right">Total</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                        {payrollSummary.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => navigate(`/portal/teacher-details/${item.teacher.id}`)}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`size-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${item.teacher.colorClass}`}>{item.teacher.initials}</div>
                                                        <span className="font-bold text-slate-900 dark:text-white">{item.teacher.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono text-slate-600 dark:text-slate-400">{item.onlineHours.toFixed(1)}</td>
                                                <td className="px-6 py-4 text-center font-mono text-slate-600 dark:text-slate-400">{item.offlineHours.toFixed(1)}</td>
                                                <td className="px-6 py-4 text-right font-medium text-blue-600">{formatCurrency(item.onlineTotal)}</td>
                                                <td className="px-6 py-4 text-right font-medium text-purple-600">{formatCurrency(item.offlineTotal)}</td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-white/5">{formatCurrency(item.grandTotal)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <Icon name="chevron_right" className="text-slate-400 group-hover:text-primary transition-colors" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </main>
    );
};

export default Finance;
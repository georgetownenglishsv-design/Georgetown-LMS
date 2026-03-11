import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { getStudents, getCourses, getExams } from '../services/db';
import { AppUser, Student } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

interface DashboardProps {
    userProfile?: AppUser | null;
    onNavigate?: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ userProfile, onNavigate }) => {
  const [stats, setStats] = useState({
      activeStudents: 0,
      activeCourses: 0,
      totalExams: 0,
      newStudents: 0
  });
  const [enrollmentData, setEnrollmentData] = useState<any[]>([]);
  const [courseDistribution, setCourseDistribution] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<{type: string, text: string, time: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        const [students, courses, exams] = await Promise.all([
            getStudents(),
            getCourses(),
            getExams()
        ]);

        const activeStudents = students.filter(s => s.status === 'Activo' || s.status === 'Pagado').length;
        const activeCourses = courses.filter(c => c.status === 'Active').length;
        
        // 1. Calculate New Students this month
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const newStudents = students.filter(s => {
            if(!s.date) return false;
            // Handle local date string YYYY-MM-DD
            const [sYear, sMonth] = s.date.split('-').map(Number);
            return (sMonth - 1) === currentMonth && sYear === currentYear;
        }).length;

        // 2. Generate Real Trend Data (Last 6 Months) - Fixed Year Bug
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const trendData = [];

        // Loop backwards 5 months to present
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const targetMonth = d.getMonth();
            const targetYear = d.getFullYear();
            const label = months[targetMonth];

            // Filter students registered in this specific Month AND Year
            const count = students.filter(s => {
                if(!s.date) return false;
                const [sYear, sMonth] = s.date.split('-').map(Number);
                return (sMonth - 1) === targetMonth && sYear === targetYear;
            }).length;

            trendData.push({ name: label, value: count });
        }

        // 3. Course Distribution
        const distMap: {[key: string]: number} = {};
        students.forEach(s => {
            if (s.course) {
                distMap[s.course] = (distMap[s.course] || 0) + 1;
            }
        });
        const distData = Object.entries(distMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // 4. Recent Activity
        const sortedStudents = [...students].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
        const recents = sortedStudents.map(s => ({
            type: s.status === 'Pendiente' ? 'person_add' : (s.status === 'Pagado' ? 'payments' : 'school'),
            text: s.status === 'Pendiente' 
                ? `Nueva solicitud: ${s.name}` 
                : (s.status === 'Pagado' ? `Pago recibido: ${s.name}` : `Estudiante activo: ${s.name}`),
            time: s.date
        }));

        setStats({
            activeStudents,
            activeCourses,
            totalExams: exams.length,
            newStudents
        });
        setEnrollmentData(trendData);
        setCourseDistribution(distData);
        setRecentActivity(recents);
        setLoading(false);
    };
    loadData();
  }, []);

  const userName = userProfile?.name?.split(' ')[0] || 'Admin';

  if (loading) return <div className="flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500"><Icon name="sync" className="animate-spin text-3xl" /></div>;

  return (
    <main className="flex-1 bg-background-light dark:bg-background-dark overflow-y-auto p-4 md:p-10">
      <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8">
        
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                    Hola, {userName} <span className="text-3xl">👋</span>
                </h1>
                <p className="text-slate-500 dark:text-text-secondary mt-1 text-lg">Aquí tienes el resumen operativo de hoy.</p>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={() => onNavigate && onNavigate('enrollment')}
                    className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all active:scale-95"
                >
                    <Icon name="person_add" /> Nuevo Estudiante
                </button>
            </div>
        </div>

        {/* Stats Grid - Mobile Optimized (2 cols) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-36 md:h-40 relative overflow-hidden group hover:border-primary/50 transition-colors">
                <div className="absolute -right-4 -top-4 bg-primary/5 w-24 h-24 rounded-full group-hover:bg-primary/10 transition-colors"></div>
                <div>
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] md:text-xs tracking-wider">
                        <Icon name="school" /> Estudiantes
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mt-2">{stats.activeStudents}</p>
                </div>
                <div className="flex items-center text-emerald-500 text-xs md:text-sm font-bold gap-1">
                    <Icon name="trending_up" /> +{stats.newStudents} este mes
                </div>
            </div>

            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-36 md:h-40 group hover:border-purple-500/50 transition-colors">
                <div>
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] md:text-xs tracking-wider">
                        <Icon name="class" /> Cursos Activos
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mt-2">{stats.activeCourses}</p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full w-3/4 rounded-full"></div>
                </div>
            </div>

            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-36 md:h-40 group hover:border-amber-500/50 transition-colors">
                <div>
                    <div className="flex items-center gap-1.5 md:gap-2 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] md:text-xs tracking-wider">
                        <Icon name="assignment" /> Exámenes
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mt-2">{stats.totalExams}</p>
                </div>
                <button onClick={() => onNavigate && onNavigate('exams')} className="text-xs md:text-sm font-bold text-amber-500 hover:text-amber-600 text-left flex items-center gap-1">Gestionar <Icon name="arrow_forward" className="text-xs" /></button>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-2xl shadow-lg text-white flex flex-col justify-between h-36 md:h-40 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4"><Icon name="verified" className="text-8xl md:text-9xl" /></div>
                <div>
                    <p className="font-bold text-blue-100 uppercase text-[10px] md:text-xs tracking-wider">Estado Sistema</p>
                    <p className="text-xl md:text-2xl font-black mt-1">Operativo</p>
                </div>
                <div className="text-[10px] md:text-sm font-medium text-blue-100 bg-white/10 w-fit px-2 py-1 md:px-3 rounded-lg backdrop-blur-sm">
                    Versión 2.4.1
                </div>
            </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Enrollment Curve */}
            <div className="lg:col-span-2 bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">Tendencia de Matrícula</h3>
                    <select className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs font-bold px-3 py-1.5 text-slate-600 dark:text-slate-300 outline-none">
                        <option>Últimos 6 meses</option>
                    </select>
                </div>
                <div className="h-[250px] w-full">
                    {enrollmentData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={enrollmentData}>
                                <defs>
                                    <linearGradient id="colorEnroll" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorEnroll)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400">Sin datos de matrícula.</div>
                    )}
                </div>
            </div>

            {/* Popular Courses */}
            <div className="lg:col-span-1 bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-4">Cursos Populares</h3>
                <div className="flex-1 relative min-h-[200px]">
                    {courseDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={courseDistribution} layout="vertical" margin={{ left: 0, right: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: '#94a3b8'}} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', border: 'none', color: 'white' }} />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                                    {courseDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899'][index % 5]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm text-center">No hay estudiantes asignados a cursos aún.</div>
                    )}
                </div>
            </div>
        </div>

        {/* Quick Activity Widget */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Actividad Reciente</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentActivity.length === 0 ? (
                    <div className="p-6 text-center text-slate-500">Sin actividad reciente.</div>
                ) : (
                    recentActivity.map((item, i) => (
                        <div key={i} className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                <Icon name={item.type} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{item.text}</p>
                                <p className="text-xs text-slate-500">{item.time}</p>
                            </div>
                            <button className="text-slate-400 hover:text-primary"><Icon name="chevron_right" /></button>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
    </main>
  );
};

export default Dashboard;
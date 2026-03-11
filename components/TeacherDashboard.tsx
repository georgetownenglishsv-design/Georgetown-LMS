
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { AppUser, ClassSession } from '../types';
import { getTeacherClasses } from '../services/db';
import VideoCinema from './VideoCinema';

interface TeacherDashboardProps {
    userProfile: AppUser;
    onNavigate: (view: string, classId?: string) => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ userProfile, onNavigate }) => {
  const [todaysClasses, setTodaysClasses] = useState<ClassSession[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<ClassSession[]>([]);
  const [stats, setStats] = useState({
      weeklyHours: 0,
      activeClasses: 0,
      totalStudents: 0
  });
  const [loading, setLoading] = useState(true);

  // [UPDATED] 시네마 플레이어 상태
  const [cinemaData, setCinemaData] = useState<{ url: string, title: string } | null>(null);

  const getLocalTodayString = () => {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      return new Date(now.getTime() - offset).toISOString().split('T')[0];
  };

  useEffect(() => {
      const fetchClasses = async () => {
          setLoading(true);
          const all = await getTeacherClasses(userProfile.id);
          const todayStr = getLocalTodayString();
          const todayFiltered = all.filter(c => c.date === todayStr);
          setTodaysClasses(todayFiltered);
          const upcoming = all
            .filter(c => c.date > todayStr && c.status !== 'Cancelada')
            .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
            .slice(0, 5);
          setUpcomingClasses(upcoming);
          const distinctCourses = new Set(all.filter(c => c.date >= todayStr).map(c => c.courseId));
          const totalMins = all.filter(c => c.date <= todayStr && c.status === 'Completada').reduce((acc, curr) => acc + curr.durationMinutes, 0);
          setStats({ weeklyHours: Math.round(totalMins / 60), activeClasses: distinctCourses.size, totalStudents: 0 });
          setLoading(false);
      };
      fetchClasses();
  }, [userProfile.id]);

  const isClassJoinable = (cls: ClassSession) => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = cls.startTime.split(':').map(Number);
      const [eh, em] = cls.endTime.split(':').map(Number);
      // Changed from 10 to 15 minutes before
      return currentMinutes >= (sh * 60 + sm - 15) && currentMinutes < (eh * 60 + em);
  };

  const handleStartClass = (cls: ClassSession) => {
      if (cls.mode === 'Online' && cls.meetingLink) {
          window.open(cls.meetingLink, '_blank', 'noopener,noreferrer');
      }
      onNavigate('attendance', cls.id);
  };

  const handleOpenVideo = (url: string, title: string) => {
      setCinemaData({ url, title });
  };

  return (
    <main className="flex-1 flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark relative">
        <div className="w-full max-w-[1400px] mx-auto p-4 md:p-10 flex flex-col gap-8 z-10 pb-24">
            <header className="flex flex-wrap justify-between items-end gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-tight">Hola, {userProfile.name.split(' ')[0]} <span>👋</span></h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Bienvenido de vuelta a tu centro de control docente.</p>
                </div>
            </header>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex items-center gap-4 group hover:border-primary/50 transition-all">
                    <div className="size-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center"><Icon name="schedule" className="text-2xl" /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Horas Impartidas</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.weeklyHours}h <span className="text-xs text-slate-400 font-bold">Total</span></p>
                    </div>
                </div>
                <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm flex items-center gap-4 group hover:border-purple-500/50 transition-all">
                    <div className="size-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center"><Icon name="menu_book" className="text-2xl" /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cursos Activos</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.activeClasses}</p>
                    </div>
                </div>
            </section>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <h2 className="text-slate-900 dark:text-white text-xl font-bold flex items-center gap-2"><span className="w-1.5 h-6 bg-primary rounded-full block"></span> Clases de Hoy</h2>
                    {todaysClasses.length === 0 ? (
                        <div className="p-16 text-center bg-white dark:bg-surface-dark rounded-3xl border-2 border-dashed border-slate-200 dark:border-gray-800 text-slate-400 font-medium"><Icon name="event_busy" className="text-5xl mb-3 opacity-20" /><p>No hay clases registradas para hoy.</p></div>
                    ) : (
                        todaysClasses.map(cls => {
                            const joinable = isClassJoinable(cls);
                            const recs = cls.recordings || [];
                            return (
                                <div key={cls.id} className="bg-white dark:bg-surface-dark border-l-4 border-l-primary border-t border-r border-b border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cls.mode === 'Online' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>{cls.mode}</span>{joinable && <span className="size-2 bg-red-500 rounded-full animate-ping"></span>}</div>
                                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{cls.courseName}</h3>
                                            <div className="flex flex-col gap-1 mt-2">
                                                <p className="text-sm text-slate-500 flex items-center gap-2 font-bold"><Icon name="calendar_today" className="text-lg text-slate-400" /> {cls.date}</p>
                                                <p className="text-sm text-slate-500 flex items-center gap-2 font-bold"><Icon name="schedule" className="text-lg text-primary" /> {cls.startTime} - {cls.endTime}</p>
                                            </div>
                                            {recs.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Grabaciones disponibles</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {recs.map((r, i) => (
                                                            <button key={i} onClick={() => handleOpenVideo(r.url, r.label || `Clase ${cls.date}`)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors"><Icon name="play_circle" className="text-sm" /> {recs.length > 1 ? `Parte ${i+1}` : 'Ver Grabación'}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-3 shrink-0 md:items-end justify-center border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-4 md:pt-0">
                                            {joinable ? <button onClick={() => handleStartClass(cls)} className="w-full md:w-auto bg-primary hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all"><Icon name="video_camera_front" /> {cls.mode === 'Online' ? 'Entrar a Sala' : 'Iniciar Clase'}</button> : <div className="w-full md:w-auto bg-slate-50 dark:bg-slate-800 text-slate-400 px-6 py-3 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"><Icon name="lock" className="text-sm" /> Acceso Restringido</div>}
                                            <button onClick={() => onNavigate('attendance', cls.id)} className="w-full md:w-auto text-slate-500 hover:text-primary text-xs font-bold px-6 py-2 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-all text-center">Reportar Asistencia</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="flex flex-col gap-6">
                    <h2 className="text-slate-900 dark:text-white text-xl font-bold flex items-center gap-2"><Icon name="event" className="text-primary" /> Próximas Clases</h2>
                    <div className="bg-white dark:bg-surface-dark rounded-3xl border border-slate-200 dark:border-gray-800 shadow-sm overflow-hidden">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {upcomingClasses.length === 0 ? <div className="p-10 text-center text-slate-400 text-sm">Sin clases futuras.</div> : upcomingClasses.map(cls => (
                                <div key={cls.id} className="p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-default group">
                                    <p className="text-[10px] font-black text-primary uppercase mb-1">{cls.date}</p>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{cls.courseName}</h4>
                                    <div className="flex items-center justify-between mt-2"><span className="text-xs text-slate-500 font-medium">{cls.startTime}</span><span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{cls.mode}</span></div>
                                </div>
                            ))}
                        </div>
                        {upcomingClasses.length > 0 && <button onClick={() => onNavigate('schedule')} className="w-full py-4 text-xs font-black text-primary hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors uppercase tracking-widest border-t border-slate-100 dark:border-slate-800">Ver Calendario Completo</button>}
                    </div>
                </div>
            </section>
        </div>
        
        {/* [UPDATED] 시네마 플레이어 모달 */}
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
export default TeacherDashboard;

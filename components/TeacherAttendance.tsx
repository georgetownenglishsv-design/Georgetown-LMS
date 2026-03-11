
// ... (Existing Imports)
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { AppUser, ClassSession, Student } from '../types';
import { getTeacherClassById, markAttendance, getTeacherClasses, getStudents, getTeacherAttendanceHistory } from '../services/db';

interface TeacherAttendanceProps {
    classId?: string; // If coming from dashboard
    userProfile: AppUser;
    onBack: () => void;
}

const TeacherAttendance: React.FC<TeacherAttendanceProps> = ({ classId, userProfile, onBack }) => {
  const [classList, setClassList] = useState<ClassSession[]>([]);
  const [classData, setClassData] = useState<ClassSession | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Logic State
  const [isToday, setIsToday] = useState(false);
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);

  const getLocalTodayString = () => {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      return new Date(now.getTime() - offset).toISOString().split('T')[0];
  };

  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  useEffect(() => {
      const init = async () => {
          setLoading(true);
          const todayStr = getLocalTodayString();
          const targetId = classId || localSelectedId;
          
          if (targetId) {
              const [cls, history] = await Promise.all([
                  getTeacherClassById(targetId),
                  getTeacherAttendanceHistory(userProfile.id)
              ]);

              if (cls) {
                  setClassData(cls);
                  const isClassToday = cls.date === todayStr; 
                  setIsToday(isClassToday); 

                  // Check if record ALREADY exists for today
                  const todayRecord = history.find(r => r.classSessionId === cls.id && r.date === todayStr);
                  
                  if (todayRecord) {
                      setExistingRecordId(todayRecord.id);
                  } else {
                      setExistingRecordId(null);
                  }

                  // REFACTORED: Match students by courseId for absolute precision
                  const allStudents = await getStudents();
                  const courseStudents = allStudents.filter(s => 
                      s.courseId === cls.courseId && // <-- Strict ID matching
                      (s.status === 'Activo' || s.status === 'Pagado')
                  );
                  setStudents(courseStudents);
              }
          } else {
              // LIST MODE: Show only TODAY's classes for THIS teacher
              const all = await getTeacherClasses(userProfile.id);
              const active = all.filter(c => c.date === todayStr);
              active.sort((a, b) => a.startTime.localeCompare(b.startTime));
              setClassList(active);
          }
          setLoading(false);
      };
      init();
  }, [classId, localSelectedId, userProfile.id]);

  const calculateDuration = (start: string, end: string) => {
      if (!start || !end) return 0;
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      const duration = (endH * 60 + endM) - (startH * 60 + startM);
      return duration > 0 ? duration : 0;
  };

  const handleConfirmAttendance = async () => {
      if (!classData) return;
      if (existingRecordId) return;

      if (!isToday) {
          alert("Solo se puede registrar asistencia el día de la clase.");
          return;
      }

      if (!confirm(`¿Confirmar asistencia para la clase de ${classData.startTime} - ${classData.endTime}?\n\nSe registrará el horario programado automáticamente.`)) return;

      try {
          // STRICT: Use Scheduled Time from Class Data
          const duration = calculateDuration(classData.startTime, classData.endTime);
          
          const payload = {
              classSessionId: classData.id,
              teacherId: userProfile.id,
              date: getLocalTodayString(),
              actualStartTime: classData.startTime, // Force Scheduled Time
              actualEndTime: classData.endTime,     // Force Scheduled Time
              durationMinutes: duration,
              notes: '', // No notes allowed
              status: 'Presente' as const
          };

          await markAttendance(payload);
          alert("✅ Asistencia confirmada correctamente.");
          
          if(classId) onBack(); 
          else setLocalSelectedId(null);

      } catch (e) {
          console.error(e);
          alert("Error al guardar asistencia.");
      }
  };

  if (loading) return <div className="flex-1 p-10 flex flex-col items-center justify-center text-slate-500"><Icon name="sync" className="animate-spin text-3xl mb-2" /> Cargando...</div>;

  // VIEW 1: LIST SELECTION (If no class selected)
  if (!classId && !localSelectedId) {
      return (
        <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 bg-background-light dark:bg-background-dark overflow-y-auto">
            <div className="mx-auto max-w-5xl space-y-8">
                <div className="flex flex-col gap-2 border-b border-slate-200 dark:border-slate-800 pb-6">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Asistencia de Hoy</h2>
                    <p className="text-slate-500 dark:text-text-secondary">Seleccione una clase para marcar su asistencia.</p>
                </div>
                
                {classList.length === 0 ? (
                    <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">
                        No tienes clases programadas para hoy.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {classList.map(cls => (
                            <div 
                                key={cls.id} 
                                onClick={() => setLocalSelectedId(cls.id)}
                                className="group cursor-pointer bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary dark:hover:border-primary shadow-sm transition-all relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Icon name="class" className="text-6xl" /></div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-xs font-bold text-blue-600 dark:text-blue-400">{cls.startTime}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${cls.mode === 'Online' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                                        {cls.mode}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-primary transition-colors">{cls.courseName}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <Icon name="location_on" className="text-sm" /> {cls.room?.replace(/Zoom/gi, 'Teams')}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
      );
  }

  if (!classData) return <div className="p-8 text-center text-slate-500">Clase no encontrada.</div>;

  // VIEW 2: CONFIRMATION SCREEN
  return (
    <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 bg-background-light dark:bg-background-dark overflow-y-auto flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className={`p-8 text-center ${isToday ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            <button 
                onClick={() => classId ? onBack() : setLocalSelectedId(null)}
                className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
                <Icon name="arrow_back" />
            </button>
            <Icon name="verified_user" className={`text-6xl mb-4 ${isToday ? 'text-white/90' : 'text-slate-400'}`} />
            <h2 className="text-2xl font-black">{isToday ? 'Confirmar Asistencia' : 'Clase Pasada / Futura'}</h2>
            <p className={`text-sm font-medium mt-1 ${isToday ? 'text-blue-100' : 'text-slate-400'}`}>
                {isToday ? 'Registra tu actividad docente' : 'Solo lectura'}
            </p>
        </div>

        <div className="p-8 flex flex-col gap-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{classData.courseName}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${classData.mode === 'Online' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {classData.mode}
                </span>
            </div>

            <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 flex flex-col gap-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-bold text-slate-500 uppercase">Fecha</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">{classData.date}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500 uppercase">Horario</span>
                    <span className="text-xl font-black text-primary">{classData.startTime} - {classData.endTime}</span>
                </div>
            </div>

            {existingRecordId ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl text-center">
                    <p className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center gap-2">
                        <Icon name="check_circle" /> Asistencia Ya Registrada
                    </p>
                </div>
            ) : isToday ? (
                <button 
                    onClick={handleConfirmAttendance}
                    className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-black text-lg shadow-lg shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Icon name="fingerprint" /> Marcar Asistencia
                </button>
            ) : (
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-center text-slate-500 text-sm font-medium">
                    No se puede registrar asistencia fuera de fecha.
                </div>
            )}

            <div className="text-center">
                <p className="text-xs text-slate-400">
                    * El tiempo se calcula automáticamente según el horario programado.
                </p>
            </div>
        </div>
      </div>
    </main>
  );
};

export default TeacherAttendance;
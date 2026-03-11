import React, { useEffect, useState } from 'react';
import { Student } from '../types';
import { Icon } from './Icon';
import { getStudents } from '../services/db';

const RecentActivity: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        // Fetch students (already ordered by date desc in service)
        const allStudents = await getStudents();
        // Show only the 5 most recent
        setStudents(allStudents.slice(0, 5));
      } catch (error) {
        console.error("Error loading recent activity:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivity();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 flex justify-center items-center">
        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
           <Icon name="sync" className="animate-spin text-2xl" />
           <span className="text-sm font-medium">Cargando actividad reciente...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registros Recientes</h3>
        <a href="#" className="text-primary hover:text-primary-dark text-sm font-bold flex items-center gap-1 transition-colors">
          Ver todos
          <Icon name="arrow_forward" className="text-base" />
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-surface-highlight/30 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-text-secondary font-semibold">
              <th className="px-6 py-4">Estudiante</th>
              <th className="px-6 py-4">Curso</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {students.length === 0 ? (
               <tr>
                 <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-text-secondary text-sm">
                   No hay registros recientes.
                 </td>
               </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id} className="group hover:bg-slate-50 dark:hover:bg-surface-highlight/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {student.avatarUrl ? (
                        <div 
                          className="size-9 rounded-full bg-cover bg-center bg-slate-200 dark:bg-slate-700" 
                          style={{ backgroundImage: `url("${student.avatarUrl}")` }}
                        ></div>
                      ) : (
                        <div className="size-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-primary font-bold text-xs">
                          {student.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{student.name}</p>
                        <p className="text-xs text-slate-500 dark:text-text-secondary">ID: {student.studentId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{student.course}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      student.statusColor || 
                      (student.status === 'Activo' || student.status === 'Pagado'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300')
                    }`}>
                      <span className={`size-1.5 rounded-full ${
                        student.statusDot || (student.status === 'Activo' || student.status === 'Pagado' ? 'bg-green-500' : 'bg-slate-500')
                      }`}></span>
                      {student.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-500 dark:text-text-secondary">{student.date}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-highlight transition-all">
                      <Icon name="more_vert" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentActivity;
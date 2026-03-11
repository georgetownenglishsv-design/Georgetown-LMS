import React, { useState, useEffect } from 'react';
import { getStudents } from '../services/db';

const StudentLevels: React.FC = () => {
  const [levels, setLevels] = useState<{label: string, percent: number, color: string}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const students = await getStudents();
        const total = students.length;
        
        if (total === 0) {
            setLevels([]);
            setLoading(false);
            return;
        }

        // Aggregate by course name for this visualization
        const counts: {[key: string]: number} = {};
        students.forEach(s => {
            const course = s.course || 'Sin Asignar';
            counts[course] = (counts[course] || 0) + 1;
        });

        // Convert to percentage and sort
        const calculatedLevels = Object.entries(counts).map(([label, count], index) => {
            const colors = ['bg-primary', 'bg-purple-500', 'bg-orange-400', 'bg-success', 'bg-pink-500'];
            return {
                label,
                percent: Math.round((count / total) * 100),
                color: colors[index % colors.length]
            };
        }).sort((a, b) => b.percent - a.percent).slice(0, 5); // Top 5

        setLevels(calculatedLevels);
      } catch (e) {
        console.error("Error calculating levels", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="col-span-1 bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Distribución por Cursos</h3>
        <p className="text-sm text-slate-500 dark:text-text-secondary mt-1">Basado en inscripciones actuales</p>
      </div>
      <div className="flex flex-col justify-center flex-1 gap-6">
        {loading ? (
             <div className="animate-pulse flex flex-col gap-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
             </div>
        ) : levels.length === 0 ? (
            <p className="text-center text-slate-500">No hay datos suficientes.</p>
        ) : (
            levels.map((level, index) => (
            <div key={index} className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-4">{level.label}</span>
                <span className="font-bold text-slate-900 dark:text-white">{level.percent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                    className={`h-full ${level.color} rounded-full transition-all duration-1000 ease-out`} 
                    style={{ width: `${level.percent}%` }}
                ></div>
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default StudentLevels;
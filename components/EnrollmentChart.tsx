import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getStudents } from '../services/db';

const EnrollmentChart: React.FC = () => {
  const [data, setData] = useState<{name: string, value: number}[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Process students data into monthly counts
  useEffect(() => {
    setIsMounted(true);
    const fetchData = async () => {
      try {
        const students = await getStudents();
        const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
        
        // Initialize last 6 months map
        const today = new Date();
        const statsMap = new Map<string, number>();
        
        // Populate last 6 months keys to ensure order
        const orderedKeys: string[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = monthNames[d.getMonth()];
            statsMap.set(key, 0);
            orderedKeys.push(key);
        }

        students.forEach(student => {
            if (!student.date) return;
            const date = new Date(student.date);
            const key = monthNames[date.getMonth()];
            // Only count if it's within our tracked months (simple logic)
            if (statsMap.has(key)) {
                statsMap.set(key, (statsMap.get(key) || 0) + 1);
            }
        });

        const formattedData = orderedKeys.map(key => ({
            name: key,
            value: statsMap.get(key) || 0
        }));

        setData(formattedData);
      } catch (err) {
        console.error("Error generating chart data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="w-full flex flex-col">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tendencia de Inscripciones</h3>
          <p className="text-sm text-slate-500 dark:text-text-secondary mt-1">Últimos 6 meses (Datos reales)</p>
        </div>
      </div>
      
      <div className="w-full h-[250px]" style={{ minWidth: 0 }}>
        {isMounted && !loading ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{
                top: 10,
                right: 10,
                left: -20,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1754cf" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#1754cf" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#9da6b8', fontSize: 12, fontWeight: 600 }}
                dy={10}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1f2b', borderColor: '#252b3b', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: '#9da6b8' }}
                cursor={{ stroke: '#252b3b', strokeWidth: 1 }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#1754cf" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorValue)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col gap-2 items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-lg animate-pulse text-slate-400">
             <span>Cargando datos...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnrollmentChart;
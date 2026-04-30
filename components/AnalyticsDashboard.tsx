import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { Users, Eye, Target, Loader2, AlertCircle, TrendingUp, Zap, Activity, MousePointerClick } from 'lucide-react';
import { functions } from '../firebase';

interface AnalyticsData {
  date: string;
  pageViews: number;
  visitors: number;
  conversions: {
    placementTest: number;
    tryEmma: number;
    tryEmmaHomepage?: number;
    tryEmmaStudent?: number;
    whatsappContact: number;
    mockTest?: number;
    dailyQuiz?: number;
    levelTest?: number;
  };
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#6366f1'];

const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<number>(30);

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const getMarketingStatsDashboard = functions.httpsCallable('getMarketingStatsDashboard');
      const result: any = await getMarketingStatsDashboard({ days: dateRange });
      
      if (result.data?.success && result.data?.data) {
        setData(result.data.data);
      } else {
        throw new Error('No data returned from server');
      }
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.message || 'Failed to load analytics data.');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    if (!data.length) return { pageViews: 0, visitors: 0, totalConversions: 0 };
    return data.reduce((acc, curr) => ({
      pageViews: acc.pageViews + (Number(curr.pageViews) || 0),
      visitors: acc.visitors + (Number(curr.visitors) || 0),
      totalConversions: acc.totalConversions + Object.values(curr.conversions || {}).reduce((a: any, b: any) => a + (Number(b) || 0), 0)
    }), { pageViews: 0, visitors: 0, totalConversions: 0 });
  };

  const totals = calculateTotals();
  const conversionRate = totals.visitors > 0 ? ((totals.totalConversions / totals.visitors) * 100).toFixed(1) : '0.0';

  // Format data for Conversion Pie Chart
  const aggregateConversions = () => {
    if (!data.length) return [];
    const agg: Record<string, number> = {};
    data.forEach(d => {
      if (!d.conversions) return;
      Object.entries(d.conversions).forEach(([key, val]) => {
        if (typeof val === 'number') {
          const name = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          agg[name] = (agg[name] || 0) + val;
        }
      });
    });
    return Object.entries(agg)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  const pieData = aggregateConversions();

  // Create chart data combining conversions for stacked bar
  const conversionData = data.map(d => ({
    date: d.date,
    'Placement Test': Number(d.conversions?.placementTest) || 0,
    'Try Emma': (Number(d.conversions?.tryEmma) || 0) + (Number(d.conversions?.tryEmmaHomepage) || 0) + (Number(d.conversions?.tryEmmaStudent) || 0),
    'Mock Test': Number(d.conversions?.mockTest) || 0,
    'Daily Quiz': Number(d.conversions?.dailyQuiz) || 0,
    'Level Test': Number(d.conversions?.levelTest) || 0,
    'WhatsApp': Number(d.conversions?.whatsappContact) || 0,
  }));

  if (loading && data.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="text-gray-400 font-mono text-sm tracking-widest uppercase">Initializing Neural Matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] p-8 -mt-8 -mx-8 sm:mt-0 sm:mx-0 sm:p-6 lg:p-8 font-sans selection:bg-blue-500/30 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-500/10 rounded-md ring-1 ring-blue-500/20">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <h2 className="text-sm font-semibold tracking-widest text-blue-600 dark:text-blue-400 uppercase">Georgetown LMS</h2>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Analytics Hub</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Real-time telemetry and conversion insights.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white dark:bg-[#111111] border border-gray-200 dark:border-gray-800 p-1 rounded-xl shadow-sm">
            {[7, 14, 30].map(days => (
              <button 
                key={days}
                onClick={() => setDateRange(days)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none ${dateRange === days ? 'bg-gray-100 dark:bg-[#222222] text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 flex items-start gap-3 text-red-600 dark:text-red-400 backdrop-blur-sm">
             <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
             <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Visitors" value={totals.visitors.toLocaleString()} icon={<Users />} trend="+12%" color="blue" />
          <StatCard title="Page Views" value={totals.pageViews.toLocaleString()} icon={<Eye />} trend="+8%" color="indigo" />
          <StatCard title="Total Conversions" value={totals.totalConversions.toLocaleString()} icon={<Target />} trend="+24%" color="emerald" />
          <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={<Zap />} trend="+2.1%" color="fuchsia" />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* Main Traffic Chart */}
          <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative lg:col-span-2 group hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
            {loading && (
              <div className="absolute inset-0 bg-white/40 dark:bg-[#0a0a0a]/40 flex items-center justify-center z-10 rounded-2xl backdrop-blur-md">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            )}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  Traffic Heatmap
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Visitors vs Views over {dateRange} days</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <div className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20"></div>
                  <span className="text-gray-600 dark:text-gray-300">Page Views</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20"></div>
                  <span className="text-gray-600 dark:text-gray-300">Visitors</span>
                </div>
              </div>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#6b7280'}} tickMargin={12} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#6b7280'}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ color: '#fff', fontSize: '13px' }}
                    labelStyle={{ color: '#888', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    cursor={{stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4'}}
                  />
                  <Area type="monotone" dataKey="pageViews" name="Page Views" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
                  <Area type="monotone" dataKey="visitors" name="Unique Visitors" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVisitors)" activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Conversion Breakdown Pie */}
          <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative group hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Goal Distribution</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Which funnels perform best?</p>
            
            <div className="h-[240px] w-full flex justify-center items-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px', border: 'none' }}
                      itemStyle={{ color: '#fff', fontSize: '13px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-2">
                  <Target className="w-8 h-8 opacity-50" />
                  <span className="text-sm">No conversion data yet</span>
                </div>
              )}
            </div>
            
            <div className="mt-4 space-y-3">
              {pieData.slice(0, 4).map((item, index) => (
                <div key={item.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{item.value}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(item.value / totals.totalConversions) * 100}%`, backgroundColor: COLORS[index % COLORS.length] }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stacked Bar for Conversions */}
        <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative group hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Conversion Funnel Velocity</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Daily breakdown of completed actions.</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={conversionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={12}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                 <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#6b7280'}} tickMargin={12} minTickGap={20} />
                 <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#6b7280'}} />
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                   cursor={{fill: 'rgba(255,255,255,0.03)'}}
                   itemStyle={{ fontSize: '13px' }}
                   labelStyle={{ color: '#888', marginBottom: '8px', fontSize: '12px' }}
                 />
                 <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                 <Bar dataKey="Placement Test" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                 <Bar dataKey="Try Emma" stackId="a" fill="#3b82f6" />
                 <Bar dataKey="Daily Quiz" stackId="a" fill="#ec4899" />
                 <Bar dataKey="Mock Test" stackId="a" fill="#8b5cf6" />
                 <Bar dataKey="WhatsApp" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// Subcomponents
const StatCard = ({ title, value, icon, trend, color }: { title: string, value: string, icon: React.ReactNode, trend: string, color: string }) => {
  const isPositive = trend.startsWith('+');
  
  const colorMap: Record<string, string> = {
    blue: 'text-blue-500 bg-blue-500/10 ring-blue-500/20',
    indigo: 'text-indigo-500 bg-indigo-500/10 ring-indigo-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 ring-emerald-500/20',
    fuchsia: 'text-fuchsia-500 bg-fuchsia-500/10 ring-fuchsia-500/20',
  };
  
  const selectedColor = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col relative overflow-hidden group hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transform translate-x-4 -translate-y-4 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
        {React.cloneElement(icon as React.ReactElement, { className: 'w-24 h-24' })}
      </div>
      
      <div className="flex items-start justify-between mb-6 relative">
        <div className={`p-2.5 rounded-xl ring-1 ${selectedColor}`}>
          {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
        </div>
        {trend && (
           <div className={`flex items-center gap-1 font-mono text-xs font-medium px-2 py-1 rounded-md ${isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 ring-1 ring-red-500/20'}`}>
             <TrendingUp className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`} />
             <span>{trend}</span>
           </div>
        )}
      </div>
      <div className="relative">
        <h4 className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide mb-1">{title}</h4>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;


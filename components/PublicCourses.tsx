
import React, { useState, useEffect } from 'react';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { Link, useNavigate, useLocation } = ReactRouterDOM as any;
import { getCourses, getCategories } from '../services/db';
import { Course, Category } from '../types';
import { Icon } from './Icon';
import { auth } from '../firebase';
import { PublicNavbar } from './PublicNavbar';
import { PublicMobileFooter } from './PublicMobileFooter';
import { PublicFloatingButtons } from './PublicFloatingButtons';
import { PublicFooter } from './PublicFooter';

// Internal Component for Inline Text Expansion
const ExpandableDescription: React.FC<{ text: string }> = ({ text }) => {
    const [expanded, setExpanded] = useState(false);
    // Limit for truncation
    const LIMIT = 90; 

    if (text.length <= LIMIT) {
        return <p className="text-[#60758a] text-sm font-normal leading-normal mb-3">{text}</p>;
    }

    return (
        <div className="mb-3 text-sm font-normal leading-normal text-[#60758a]">
            {expanded ? text : `${text.substring(0, LIMIT)}...`}
            <span 
                onClick={(e) => {
                    e.stopPropagation(); // Prevent navigation when clicking 'Read more'
                    setExpanded(!expanded);
                }}
                className="text-[#0d7ff2] font-bold cursor-pointer ml-1 hover:underline text-xs uppercase tracking-wide"
            >
                {expanded ? '(Ver menos)' : '(Ver más)'}
            </span>
        </div>
    );
};

// Interface for Grouped Course
interface GroupedCourse {
    id: string; // ID of the representative course (usually the earliest)
    base: Course;
    schedules: Course[];
}

const PublicCourses: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [groupedCourses, setGroupedCourses] = useState<GroupedCourse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Initialize from URL parameter if present
  const queryParams = new URLSearchParams(location.search);
  const initialCategory = queryParams.get('category') || 'Todos';
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  
  const [loading, setLoading] = useState(true);

  // Fallback images matching the design aesthetic
  const FALLBACK_IMAGES = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCLVjMPNtK8M4DlUwfM4Nmd48Ih8B8TxXNd3PNxtpPfgrGIkkbvM_8BhmQ6z4QU1zQlHfzghADA8LBJxAcrQY9dHNMXg97lM8ZjJNZR2EFLrz73-toXusEjHZLaNPR3-7IP0wl7vuTGOC661fBdpAUaGWUol8Nv1_H7bCzBw25yi7EKPZmKkKrNMKBwh663djW8Zd6qGX6KmjG3-u3_MxpPfVeHArTJHCIgBmaJC45ylACLQCY4COK9fHbajLt5meD6Uj7-fY-Kb30",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAmNSVN1rKbtTvn8kvRpyKKp6l7bk1MdpnxObriYg-08bgYIyCLKxtJmXIgHEL-qmxzEI6PKmaUOVdQ_NsQHDyH3xoU4vJ9nOMybh1dvrMKgIqIhu1jgfnwG0veqdz0oniSQGAgp5Hb51-mfPf0YV69ZZi-oIrIixwvFQ7RcNTCgXtH9oE91oMITYdZR0oHvqs4ykRia2wxNQ5bMuXHqfGd1Y05S73e5hSkHu_QmSqttTZgME5zmptHR9KIhmz0gdR4Y2sTdha6njA",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDVxK4wvs0vWvJFHq1lq9Laokn6F5MPRPFJL-fsgmnt_JPJ3SoczaiVOWRe_D1wdHMBBcO0Uz_mQNvFB1kkb-4o4nxUltot5abxvKZ4lynGDqYerv3k6enySpxBZLVlxaGYtdCwpQu8Qn2rtKPEgh0b6b_mbd7B7sjYoYxc5WDXprQOPc_YFWpdYz0vhkd-mSDF0k-ctoxNZrjTsiT2cbicW0FMJ4JvCcHEduJBcP4Cpl3gfB1yGgWGjniN1zRA7D9mkP-VaXe4fMs",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAMGBeVoGEWO-4u-FVtSkdyxCaoWAwMkIz10tjFBKvdGKAAiSWK63cDpAzqWRgfcuKW65oY-bsfpB_siQmlY3thp4k0X6GxVVsevZqKvGwp3PxGzDqECW1MnB8KFmkGpzMKdVbyR3uVAKuW2qaoqm703opLN4LkI7Fi1xAgDferKn2CDC5wRChQ2fRmAyRvGzPrXzUwVVADeVZF4wNRIeEdmC_5Mz73ESi9HwNC1CLcp74ObR9JKZP3HFEw2CMa2bSwiA4jv5PgMW0"
  ];

  // Helper: Extract base name (remove trailing 6-digit date like 202601)
  const getBaseName = (name: string) => {
      return name.replace(/\s\d{6}$/, '').trim();
  };

  // Helper for formatting schedule date DD/MMM
  const formatDateRange = (start: string, end: string) => {
      const format = (dStr: string) => {
          const [y, m, d] = dStr.split('-');
          const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
          return `${d}/${months[parseInt(m) - 1]}`;
      };
      return `${format(start)} - ${format(end)}`;
  };

  // Helper for time 12H with Zero Padding
  const formatTime = (time: string) => {
      if (!time) return '';
      const [h, m] = time.split(':');
      const hour = parseInt(h);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      // ZERO PAD HOUR
      const hourStr = hour12 < 10 ? `0${hour12}` : `${hour12}`;
      return `${hourStr}:${m} ${ampm}`;
  };

  const formatTimeRange = (start?: string, end?: string) => {
      if (!start) return 'TBA';
      const s = formatTime(start);
      const e = end ? formatTime(end) : '';
      return e ? `${s} - ${e}` : s;
  };

  // Force Light Mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    return () => {};
  }, []);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [fetchedCourses, fetchedCategories] = await Promise.all([
          getCourses(),
          getCategories()
        ]);
        
        // Filter only Active
        const activeOnly = fetchedCourses.filter(c => c.status === 'Active');
        
        // --- SMART GROUPING LOGIC ---
        // Map Key: BaseName|Category|Mode
        const groups = new Map<string, GroupedCourse>();
        
        // Sort by start date first to prioritize earliest
        const sortedCourses = activeOnly.sort((a, b) => a.startDate.localeCompare(b.startDate));

        sortedCourses.forEach(course => {
            const baseName = getBaseName(course.name);
            const uniqueKey = `${baseName}|${course.category}|${course.mode}`;
            
            if (!groups.has(uniqueKey)) {
                groups.set(uniqueKey, { 
                    id: course.id,
                    base: course, 
                    schedules: [] 
                });
            }
            groups.get(uniqueKey)?.schedules.push(course);
        });

        setGroupedCourses(Array.from(groups.values()));
        setCategories(fetchedCategories.filter(c => c.status === 'Activo'));
      } catch (error) {
        console.error("Error loading courses page:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredGroups = activeCategory === 'Todos' 
    ? groupedCourses 
    : groupedCourses.filter(g => g.base.category === activeCategory || g.base.category === categories.find(cat => cat.name === activeCategory)?.shortCode);

  const handleDetails = (e: React.MouseEvent, courseId: string) => {
      e.stopPropagation();
      navigate(`/courses/${courseId}`); 
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#f5f7f8] font-display text-[#111418]">
      
      <PublicNavbar />

      <div className="flex-1 w-full pb-24">
          <div className="w-full">
            
            <div className="flex flex-row items-start justify-between px-4 pt-6 pb-2 gap-3 w-full">
                <div className="flex flex-col min-w-0 flex-1">
                    <h1 className="text-[#111418] tracking-tight text-2xl md:text-[32px] font-bold leading-tight text-left break-words">
                        Nuestros Programas
                    </h1>
                    <p className="text-[#60758a] text-sm md:text-base font-normal leading-normal pt-2">
                        Excelencia académica y preparación de alto nivel.
                    </p>
                </div>
                <button 
                    onClick={() => navigate('/search')}
                    className="flex shrink-0 items-center justify-center size-12 rounded-full bg-white text-[#0d7ff2] shadow-lg shadow-blue-100 border border-[#e5e7eb] hover:bg-[#f0f2f4] active:scale-95 transition-all mt-1"
                    title="Buscar cursos"
                >
                    <span className="material-symbols-outlined text-2xl">search</span>
                </button>
            </div>

            <div className="sticky top-20 z-40 bg-[#f5f7f8] w-full pt-2 pb-4">
                <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar pb-1 w-full">
                <button 
                    onClick={() => setActiveCategory('Todos')}
                    className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-xl pl-5 pr-5 shadow-sm transition-transform active:scale-95 ${activeCategory === 'Todos' ? 'bg-[#0d7ff2] text-white' : 'bg-white border border-[#e5e7eb] text-[#111418]'}`}
                >
                    <p className="text-sm font-bold leading-normal">Todos</p>
                </button>
                {categories.map((cat) => (
                    <button 
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.shortCode)}
                        className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-xl pl-5 pr-5 shadow-sm transition-transform active:scale-95 ${activeCategory === cat.shortCode ? 'bg-[#0d7ff2] text-white' : 'bg-white border border-[#e5e7eb] text-[#111418]'}`}
                    >
                        <p className="text-sm font-medium leading-normal">{cat.name}</p>
                    </button>
                ))}
                </div>
            </div>

            <div className="flex flex-col gap-4 px-4 pb-4 w-full">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-[#60758a]">
                        <Icon name="sync" className="animate-spin text-4xl mb-2" />
                        <p>Cargando programas...</p>
                    </div>
                ) : filteredGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-[#60758a] bg-white rounded-xl border border-[#e5e7eb] border-dashed w-full">
                        <Icon name="search_off" className="text-4xl mb-2" />
                        <p>No hay cursos disponibles en esta categoría.</p>
                    </div>
                ) : (
                    filteredGroups.map((group, index) => {
                        const { base, schedules } = group;
                        
                        // Smart Grouping Logic: Check if all schedules have the same days
                        const firstDays = schedules[0]?.days?.sort().join(',') || '';
                        const allSameDays = schedules.every(s => (s.days?.sort().join(',') || '') === firstDays);
                        const commonDaysDisplay = allSameDays && schedules[0]?.days && schedules[0].days.length > 0 
                            ? schedules[0].days.join(' / ') 
                            : null;

                        return (
                            <div key={base.id} className="w-full">
                                <div 
                                    onClick={() => navigate(`/courses/${base.id}`)}
                                    className="flex flex-col items-stretch justify-start rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white transition-transform hover:scale-[1.01] duration-300 border border-[#e5e7eb] w-full cursor-pointer group"
                                >
                                    <div 
                                        className="w-full bg-center bg-no-repeat aspect-[2.4/1] bg-cover relative" 
                                        style={{ backgroundImage: `url("${base.image || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]}")` }}
                                    >
                                        {/* LUXURY DISCOUNT BADGE */}
                                        {base.discountBadgeText && (
                                            <div className="absolute -top-3 -right-3 z-20">
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-600 rounded-full blur opacity-70 animate-pulse"></div>
                                                    <div className="relative px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 border border-amber-300/50 rounded-full shadow-xl overflow-hidden">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer"></div>
                                                        <span className="relative text-white text-xs font-black tracking-wider uppercase drop-shadow-md">{base.discountBadgeText}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-end p-3 absolute top-0 right-0 w-full z-10">
                                            <span className="bg-white/90 backdrop-blur-sm text-[#111418] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide shadow-sm">
                                                {base.category}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-2 left-2 flex gap-1">
                                            {base.mode && (
                                                <span className={`text-[11px] font-black px-2 py-1 rounded-md uppercase tracking-wider text-white shadow-md ${base.mode === 'online' ? 'bg-blue-500' : 'bg-purple-600'}`}>
                                                    {base.mode}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex w-full grow flex-col items-stretch justify-center gap-1 p-5 pt-4">
                                        <p className="text-[#0d7ff2] text-[11px] font-bold leading-normal uppercase tracking-wide">
                                            {base.isToeic ? 'Certificación Oficial' : 'Programa Académico'}
                                        </p>
                                        
                                        {/* HEADER: Title + Days next to badges if space or below */}
                                        <div>
                                            <h3 className="text-[#111418] text-lg font-bold leading-tight tracking-[-0.015em] mb-1 group-hover:text-primary transition-colors">
                                                {getBaseName(base.name)}
                                            </h3>
                                            {/* Common Days Display (Moved to Header Area) */}
                                            {commonDaysDisplay && (
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Icon name="calendar_month" className="text-xs text-slate-400" />
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                                        {commonDaysDisplay}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Expandable Description */}
                                        <ExpandableDescription text={base.description} />
                                        
                                        {/* LUXURY SCHEDULE DISPLAY (VIP TICKET STYLE) */}
                                        <div className="mt-2 mb-4 bg-gradient-to-r from-slate-50 to-white border border-slate-100 rounded-xl p-3 shadow-sm relative overflow-hidden">
                                            {/* Shimmer Effect */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 translate-x-[-150%] animate-[shimmer_2s_infinite]"></div>
                                            
                                            <div className="flex items-center gap-2 mb-2 relative z-10">
                                                <Icon name="event" className="text-primary animate-pulse text-lg" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                                                    Convocatorias Abiertas
                                                </span>
                                            </div>
                                            
                                            <div className="flex flex-col gap-2 relative z-10">
                                                {schedules.map((schedule, idx) => (
                                                    <div key={schedule.id} className="flex flex-row items-center justify-between text-xs font-bold text-slate-600 bg-white/80 rounded-lg px-3 py-2 border border-slate-100 hover:border-blue-200 transition-colors gap-1 sm:gap-0">
                                                        
                                                        {/* Left: Date (Styled Badge) - FORCE 1 Line */}
                                                        <div className="flex items-center gap-2 whitespace-nowrap min-w-[120px]">
                                                            <div className="bg-slate-100 border border-slate-200 rounded px-2 py-1 flex items-center gap-2 shadow-sm w-full sm:w-auto">
                                                                <span className={`size-1.5 rounded-full shrink-0 ${idx === 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                                                <span className="text-slate-800 font-black tracking-tight text-[11px]">
                                                                    {formatDateRange(schedule.startDate, schedule.endDate)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Right: Time (Ticket Style) - ALLOW 2 Lines */}
                                                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                                                            {!allSameDays && (
                                                                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded">
                                                                    {schedule.days?.join('/')}
                                                                </span>
                                                            )}
                                                            <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded text-blue-700 border border-blue-100 whitespace-nowrap font-mono">
                                                                <Icon name="schedule" className="text-[14px]" />
                                                                <span className="font-black text-[11px]">
                                                                    {formatTimeRange(schedule.startTime, schedule.endTime)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-lg font-black text-slate-900 leading-none mb-4">
                                            <Icon name="payments" className="text-gold text-xl" /> 
                                            <div className="flex items-baseline gap-2">
                                                <span>${base.price.toFixed(2)}</span>
                                                {base.originalPrice && (
                                                    <span className="text-sm text-slate-400 line-through font-medium">${base.originalPrice.toFixed(2)}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-[#f0f2f4]">
                                            <button
                                                onClick={(e) => handleDetails(e, base.id)} 
                                                className="w-full flex items-center justify-center h-10 px-4 rounded-xl bg-primary text-white hover:bg-blue-600 font-bold text-xs transition-all shadow-md hover:shadow-lg active:scale-95"
                                            >
                                                Ver Disponibilidad
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
          </div>
      </div>

      <PublicFooter />
      <PublicMobileFooter />
      <PublicFloatingButtons />

    </div>
  );
};

export default PublicCourses;

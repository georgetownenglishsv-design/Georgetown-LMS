
import React, { useState, useEffect } from 'react';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM as any;
import { getCourses, recordInternalConversion } from '../services/db';
import { Course } from '../types';
import { Icon } from './Icon';

const CourseSearch: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load Data & History
  useEffect(() => {
    // Force light mode for this page layout consistency
    document.documentElement.classList.remove('dark');

    const loadData = async () => {
      const data = await getCourses();
      // Filter only active courses
      const active = data.filter(c => c.status === 'Active');
      setCourses(active);
      setFilteredCourses(active.slice(0, 5)); // Initial "Trends"
      setLoading(false);
    };

    const history = localStorage.getItem('course_search_history');
    if (history) {
      setRecentSearches(JSON.parse(history));
    } else {
      setRecentSearches(['Inglés de Negocios', 'TOEIC', 'Principiantes']);
    }

    loadData();

    return () => {
       // Optional: restore logic if needed
    };
  }, []);

  // Filter Logic
  useEffect(() => {
    if (!searchTerm.trim()) {
      // If empty, show "Trends" (just the first few courses or random ones)
      setFilteredCourses(courses.slice(0, 5));
      return;
    }

    const lowerTerm = searchTerm.toLowerCase();
    const results = courses.filter(course => 
      course.name.toLowerCase().includes(lowerTerm) || 
      course.category.toLowerCase().includes(lowerTerm) ||
      course.description.toLowerCase().includes(lowerTerm)
    );
    setFilteredCourses(results);
  }, [searchTerm, courses]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const saveToHistory = (term: string) => {
      if (!term.trim()) return;
      const newHistory = [term, ...recentSearches.filter(t => t !== term)].slice(0, 5);
      setRecentSearches(newHistory);
      localStorage.setItem('course_search_history', JSON.stringify(newHistory));
  };

  const handleCourseClick = (courseId: string) => {
      // Save current term to history before navigating
      const course = courses.find(c => c.id === courseId);
      saveToHistory(searchTerm || (course ? course.name : ''));
      // Navigate to enrollment with pre-selection (using course ID or generic link)
      navigate('/enroll'); 
  };
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-hidden font-display antialiased text-[#111418]">
      
      {/* Background Image Layer */}
      <div 
        className="absolute inset-0 z-0 w-full h-full bg-cover bg-center opacity-20 pointer-events-none" 
        data-alt="Blurred background"
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAXWDNYYUCKhzlON4-VangSU0rLY9TvhQxXP5dYppFCpv_HvleVW0WXa5pFDV99NWrW_X7OUNOg2VaPh7i3wZ1rK49Tc3fqgBJDHDKWiDmLWqReI7RjWlZDPEFXOgFzezL-7flAgeKi0iAFEMPBYZnBg8T0oRcH06l2_KE2GfWXhP_3vcWGWKicsYNfzrowcJ0XY-0sinJLImepYD7UYdNKM_Y6vV8EL-XkazR8YLlcQKkQ6cHg5ZoCI6t3bu_B9cGD4WpKKpBm364')" }}
      ></div>
      
      {/* Blur Overlay Layer */}
      <div className="absolute inset-0 z-0 backdrop-blur-xl bg-white/90"></div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col flex-1 w-full max-w-md mx-auto px-4 pt-2 h-full overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between py-4 shrink-0">
          <div className="w-12"></div> 
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-[#111418] hover:bg-slate-200 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined font-bold">close</span>
          </button>
        </div>

        {/* Title */}
        <div className="mb-6 mt-2 shrink-0">
          <h2 className="text-[#111418] text-[32px] font-bold leading-tight tracking-[-0.02em]">
            Encuentra tu<br/>
            <span className="text-[#0d7ff2]">curso ideal</span>
          </h2>
        </div>

        {/* Search Input */}
        <div className="mb-8 relative group shrink-0">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-[#0d7ff2] text-[28px]">search</span>
          </div>
          <input 
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-14 pr-4 py-5 bg-white border-0 rounded-2xl text-lg font-medium text-[#111418] shadow-lg shadow-slate-200/50 placeholder:text-slate-400 focus:ring-2 focus:ring-[#0d7ff2] focus:outline-none transition-all" 
            placeholder="Buscar cursos..." 
            type="text"
          />
        </div>

        {/* Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
            
            {/* Recent Searches */}
            {!searchTerm && recentSearches.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Búsquedas Recientes</h3>
                    <div className="flex flex-wrap gap-3">
                        {recentSearches.map((term, idx) => (
                            <button 
                                key={idx}
                                onClick={() => handleSearch(term)}
                                className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-xl bg-white border border-slate-100 pl-4 pr-5 hover:border-[#0d7ff2]/50 hover:text-[#0d7ff2] transition-colors shadow-sm text-slate-500"
                            >
                                <span className="material-symbols-outlined text-[20px] opacity-70">history</span>
                                <p className="text-sm font-medium leading-normal">{term}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Results / Trends */}
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                    {searchTerm ? 'Resultados' : 'Tendencias'}
                </h3>
                {!searchTerm && <button className="text-[#0d7ff2] text-sm font-semibold hover:underline">Ver todo</button>}
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="py-10 text-center text-slate-400">
                        <Icon name="sync" className="animate-spin text-2xl" />
                    </div>
                ) : filteredCourses.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 bg-white/50 rounded-2xl border border-dashed border-slate-200">
                        No se encontraron cursos.
                    </div>
                ) : (
                    filteredCourses.map((course) => (
                        <div 
                            key={course.id}
                            onClick={() => handleCourseClick(course.id)}
                            className="group flex items-center p-3 bg-white rounded-2xl border border-transparent hover:border-[#0d7ff2]/20 hover:shadow-md transition-all cursor-pointer"
                        >
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                                {course.image ? (
                                    <img alt={course.name} className="h-full w-full object-cover" src={course.image} />
                                ) : (
                                    <div className="absolute inset-0 bg-[#0d7ff2]/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[#0d7ff2] text-3xl">school</span>
                                    </div>
                                )}
                            </div>
                            <div className="ml-4 flex-1 min-w-0">
                                <h4 className="text-base font-bold text-[#111418] truncate group-hover:text-[#0d7ff2] transition-colors">
                                    {course.name}
                                </h4>
                                <p className="text-sm text-slate-500 truncate">
                                    {course.category} • {course.mode}
                                </p>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 group-hover:bg-[#0d7ff2] group-hover:text-white transition-colors text-slate-400">
                                <span className="material-symbols-outlined text-xl">arrow_forward</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            {/* Visual Spacer for "Keyboard" area on mobile to ensure content isn't hidden behind FABs */}
            <div className="h-24"></div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 items-center">
        <button 
            onClick={scrollToTop}
            aria-label="Volver arriba" 
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 transition-all hover:text-[#0d7ff2] hover:scale-110 active:scale-95"
        >
            <span className="material-symbols-outlined text-xl">arrow_upward</span>
        </button>
        <a 
            href="https://api.whatsapp.com/send?phone=50376805577"
            target="_blank"
            rel="noreferrer"
            onClick={() => {
                if (typeof window !== 'undefined') {
                    if ((window as any).gtag) (window as any).gtag('event', 'contact_whatsapp', { event_category: 'contact', source: 'course_search' });
                    if ((window as any).fbq) (window as any).fbq('track', 'Contact', { source: 'course_search' });
                }
                recordInternalConversion('whatsappContact').catch(console.error);
            }}
            aria-label="Contactar por WhatsApp" 
            className="group flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-green-500/30 transition-all hover:bg-[#20bd5a] hover:scale-110 active:scale-95"
        >
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" className="w-8 h-8">
                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.53 6.53 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
            </svg>
        </a>
      </div>

    </div>
  );
};

export default CourseSearch;

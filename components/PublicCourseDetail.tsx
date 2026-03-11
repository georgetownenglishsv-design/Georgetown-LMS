
import React, { useState, useEffect, useRef } from 'react';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { useParams, useNavigate, Link } = ReactRouterDOM as any;
import { getCourseById, getCourseDetail, getTestimonialsByCategory, getFAQsByCategory, getCourses } from '../services/db';
import { Course, CourseDetail, Testimonial, GlobalFAQ } from '../types';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { auth } from '../firebase';
import { PublicMobileFooter } from './PublicMobileFooter';
import { PublicFloatingButtons } from './PublicFloatingButtons';
import { PublicFooter } from './PublicFooter';

const PublicCourseDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [baseCourse, setBaseCourse] = useState<Course | null>(null); // The course initially loaded
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null); // The specific session selected
  const [availableSessions, setAvailableSessions] = useState<Course[]>([]); // Grouped sessions
  
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [faqs, setFaqs] = useState<GlobalFAQ[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Refs
  const testimonialScrollRef = useRef<HTMLDivElement>(null);
  
  // Accordion State
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  // Helper: Extract base name (remove trailing 6-digit date like 202601)
  const getBaseName = (name: string) => {
      return name.replace(/\s\d{6}$/, '').trim();
  };

  // Helper for formatting schedule
  const formatTimeAMPM = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hourStr, minuteStr] = timeStr.split(':');
    let hour = parseInt(hourStr);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; 
    return `${String(hour).padStart(2, '0')}:${minuteStr} ${ampm}`;
  };

  const getScheduleParts = (course: Course) => {
    const days = course.days?.join(', ') || 'Horario a convenir';
    const start = formatTimeAMPM(course.startTime);
    const end = formatTimeAMPM(course.endTime);
    const timeRange = start && end ? `${start} ~ ${end}` : (start || '');
    return { timeRange, days };
  };

  // Helper date formatter: DD/MMM (e.g., 05/FEB)
  const formatDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-');
      // Month names in Spanish (Short)
      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      const monthIndex = parseInt(m) - 1;
      return `${d}/${months[monthIndex]}`;
  };

  // Force Light Mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    return () => {};
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        // [REMOVED] Automatic Anonymous Auth Logic
        // Data is now accessible via public read rules in Firestore.

        const [mainCourse, allCourses] = await Promise.all([
            getCourseById(id),
            getCourses()
        ]);

        if (mainCourse) {
            setBaseCourse(mainCourse);
            // Default selection
            setSelectedCourse(mainCourse); 

            // Find siblings with SAME BASE NAME for the dropdown
            // Filter: Name matches (ignoring date suffix), Status is Active
            const baseName = getBaseName(mainCourse.name);
            const siblings = allCourses.filter(c => 
                getBaseName(c.name) === baseName && 
                c.status === 'Active'
            ).sort((a, b) => a.startDate.localeCompare(b.startDate));
            
            setAvailableSessions(siblings);

            const detailData = await getCourseDetail(id, mainCourse);
            setDetail(detailData);
            const faqData = await getFAQsByCategory(mainCourse.category);
            setFaqs(faqData);
            const testimonialData = await getTestimonialsByCategory(mainCourse.category);
            const shuffled = testimonialData.sort(() => 0.5 - Math.random());
            setTestimonials(shuffled.slice(0, 8));
        }
      } catch (error) {
        console.error("Error loading details", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const toggleFaq = (faqId: string) => {
      if (openFaqId === faqId) {
          setOpenFaqId(null);
      } else {
          setOpenFaqId(faqId);
      }
  };

  const handleEnroll = () => {
      if (selectedCourse) {
          navigate('/enroll', { state: { selectedCourseId: selectedCourse.id } });
      } else {
          navigate('/enroll');
      }
  };

  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newId = e.target.value;
      const found = availableSessions.find(c => c.id === newId);
      if (found) {
          setSelectedCourse(found);
      }
  };

  const scrollTestimonials = (direction: 'left' | 'right') => {
      if (testimonialScrollRef.current) {
          const scrollAmount = 340;
          testimonialScrollRef.current.scrollBy({
              left: direction === 'left' ? -scrollAmount : scrollAmount,
              behavior: 'smooth'
          });
      }
  };

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center text-slate-400 bg-[#f5f7f8]"><Icon name="sync" className="animate-spin text-3xl" /></div>;
  }

  if (!selectedCourse || !detail) {
      return <div className="min-h-screen flex items-center justify-center text-slate-500 bg-[#f5f7f8]">Curso no encontrado.</div>;
  }

  const schedule = getScheduleParts(selectedCourse);

  // --- REVISED STAR LOGIC ---
  const renderStars = (score: number) => {
      const stars = [];
      const rounded = Math.round(score * 2) / 2; // Round to nearest 0.5

      for (let i = 1; i <= 5; i++) {
          if (rounded >= i) {
              stars.push('star'); // Full
          } else if (rounded >= i - 0.5) {
              stars.push('star_half'); // Half
          } else {
              stars.push('star_border'); // Empty
          }
      }
      return stars.map((s, idx) => (
          <span 
            key={idx} 
            className={`material-symbols-outlined text-[20px] text-yellow-400 ${s !== 'star_border' ? 'filled' : ''}`}
          >
              {s}
          </span>
      ));
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-[#f5f7f8] font-display text-[#111418] pb-32">
        <div className="sticky top-0 z-50 bg-[#f5f7f8]/95 backdrop-blur-md border-b border-[#e5e7eb]">
            <div className="flex items-center justify-between px-4 py-3 h-[64px] max-w-[1200px] mx-auto w-full">
                <div className="flex items-center gap-3 shrink-0">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 transition-colors text-[#111418]"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <Link to="/" className="flex items-center justify-center h-8 w-auto">
                        <Logo className="h-full w-auto object-contain" iconOnly={true} />
                    </Link>
                </div>
                <div className="flex-1 flex justify-center px-2 min-w-0">
                    <h2 className="text-[#111418] text-sm font-bold leading-tight tracking-tight truncate text-center">
                        Georgetown Academy
                    </h2>
                </div>
                <div className="flex items-center justify-end shrink-0">
                    <button onClick={handleEnroll} className="hidden md:block bg-[#0d7ff2] hover:bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-sm">
                        Inscribirme
                    </button>
                </div>
            </div>
        </div>

        <div className="w-full max-w-[1200px] mx-auto">
            <div className="px-4 py-4 w-full">
                <div 
                    className="relative w-full h-80 rounded-2xl overflow-hidden shadow-xl bg-gray-200" 
                    style={{ 
                        backgroundImage: `linear-gradient(0deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 70%), url("${detail.heroImage || selectedCourse.image || 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1000'}")`, 
                        backgroundSize: 'cover', 
                        backgroundPosition: 'center' 
                    }}
                >
                    {/* LUXURY DISCOUNT BADGE */}
                    {selectedCourse.discountBadgeText && (
                        <div className="absolute top-4 right-4 z-20">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-600 rounded-full blur opacity-70 animate-pulse"></div>
                                <div className="relative px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 border border-amber-300/50 rounded-full shadow-xl overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer"></div>
                                    <span className="relative text-white text-sm font-black tracking-widest uppercase drop-shadow-md">{selectedCourse.discountBadgeText}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="absolute top-4 left-4 flex gap-2">
                        <span className="bg-[#0d7ff2]/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider shadow-sm">
                            {selectedCourse.category}
                        </span>
                        <span className={`text-xs font-black px-3 py-1.5 rounded-lg uppercase tracking-wider text-white shadow-md ${selectedCourse.mode === 'online' ? 'bg-blue-500/90' : 'bg-purple-600/90'}`}>
                            {selectedCourse.mode}
                        </span>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col gap-2">
                        <h1 className="text-white tracking-tight text-[28px] md:text-[36px] font-black leading-tight drop-shadow-lg">
                            {getBaseName(selectedCourse.name)}
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="flex items-center">
                                {renderStars(detail.rating || 5)}
                            </span>
                            <span className="text-white font-bold text-sm drop-shadow-md ml-1">{detail.rating || '5.0'}</span>
                            <span className="text-white/80 text-xs ml-1">({detail.reviewCount || 10} Reseñas)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- SESSION SELECTOR & INFO GRID --- */}
            <div className="px-4 pb-8">
                
                {/* Date Dropdown Section (Highlight) */}
                <div className="mb-6 bg-white border border-[#e5e7eb] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
                            <Icon name="event_available" className="text-2xl" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Seleccionar Inicio</p>
                            <p className="text-slate-900 font-bold text-sm">Elige la fecha que prefieras:</p>
                        </div>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <select 
                            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-primary focus:border-primary block p-3 pr-10 cursor-pointer"
                            value={selectedCourse.id}
                            onChange={handleSessionChange}
                        >
                            {availableSessions.map(sess => (
                                <option key={sess.id} value={sess.id}>
                                    {formatDate(sess.startDate)} - {formatDate(sess.endDate)} {sess.status === 'Active' ? '(Disponible)' : '(Cerrado)'}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                            <Icon name="expand_more" />
                        </div>
                    </div>
                </div>

                {/* Bento Grid: 2 cols mobile, 5 cols desktop */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {/* 1. Precio (Small) */}
                    <div className="col-span-1 flex flex-col items-center justify-center gap-2 rounded-2xl p-4 bg-white border border-[#e5e7eb] shadow-sm hover:border-primary/30 transition-colors relative overflow-hidden">
                        {selectedCourse.originalPrice && (
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-red-500 to-pink-600 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-lg shadow-sm">
                                OFERTA
                            </div>
                        )}
                        <span className="material-symbols-outlined text-gold text-[28px]">payments</span>
                        <div className="text-center">
                            <p className="text-[#60758a] text-[10px] font-bold uppercase tracking-wider">Precio</p>
                            <div className="flex flex-col items-center">
                                {selectedCourse.originalPrice && (
                                    <p className="text-slate-400 text-xs line-through font-bold decoration-red-400 decoration-2 mb-0.5">${selectedCourse.originalPrice.toFixed(2)}</p>
                                )}
                                <p className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600 text-xl font-black leading-tight drop-shadow-sm">${selectedCourse.price.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* 2. Horario (Large - spans 2 cols on mobile) */}
                    <div className="col-span-2 md:col-span-1 flex flex-col items-center justify-center gap-2 rounded-2xl p-4 bg-white border border-[#e5e7eb] shadow-sm hover:border-primary/30 transition-colors order-first md:order-none">
                        <span className="material-symbols-outlined text-primary text-[28px]">schedule</span>
                        <div className="text-center">
                            <p className="text-[#60758a] text-[10px] font-bold uppercase tracking-wider mb-0.5">Horario</p>
                            <div className="flex flex-col">
                                <p className="text-primary text-[11px] font-black leading-tight uppercase">{schedule.timeRange}</p>
                                <p className="text-slate-400 text-[10px] font-bold leading-tight mt-0.5">{schedule.days}</p>
                            </div>
                        </div>
                    </div>

                    {/* 3. Duración (Small) */}
                    <div className="col-span-1 flex flex-col items-center justify-center gap-2 rounded-2xl p-4 bg-white border border-[#e5e7eb] shadow-sm hover:border-primary/30 transition-colors">
                        <span className="material-symbols-outlined text-indigo-600 text-[28px]">calendar_month</span>
                        <div className="text-center">
                            <p className="text-[#60758a] text-[10px] font-bold uppercase tracking-wider">Duración</p>
                            <p className="text-indigo-600 text-sm font-black leading-tight">{detail.duration}</p>
                        </div>
                    </div>

                    {/* 4. Nivel (Small) */}
                    <div className="col-span-1 flex flex-col items-center justify-center gap-2 rounded-2xl p-4 bg-white border border-[#e5e7eb] shadow-sm hover:border-primary/30 transition-colors">
                        <span className="material-symbols-outlined text-emerald-600 text-[28px]">signal_cellular_alt</span>
                        <div className="text-center">
                            <p className="text-[#60758a] text-[10px] font-bold uppercase tracking-wider">Nivel</p>
                            <p className="text-emerald-600 text-sm font-black leading-tight">{detail.level}</p>
                        </div>
                    </div>

                    {/* 5. Modalidad (Small) */}
                    <div className="col-span-1 flex flex-col items-center justify-center gap-2 rounded-2xl p-4 bg-white border border-[#e5e7eb] shadow-sm hover:border-primary/30 transition-colors">
                        <span className="material-symbols-outlined text-purple-600 text-[28px]">location_on</span>
                        <div className="text-center">
                            <p className="text-[#60758a] text-[10px] font-bold uppercase tracking-wider">Modalidad</p>
                            <p className="text-purple-600 text-sm font-black leading-tight capitalize">{selectedCourse.mode}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 py-2">
                <div className="mb-10">
                    <h3 className="text-[#111418] text-[22px] font-bold leading-tight tracking-[-0.015em] pb-3">Sobre este curso</h3>
                    <p className="text-[#60758a] text-base font-normal leading-relaxed whitespace-pre-line">
                        {detail.longDescription}
                    </p>
                </div>
                
                {detail.learningPoints && detail.learningPoints.length > 0 && (
                    <div className="bg-white rounded-3xl p-8 border border-[#e5e7eb] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)]">
                        <h4 className="text-[#111418] font-bold text-xl mb-6 flex items-center gap-2">
                            <span className="size-2 bg-emerald-50 rounded-full"></span>
                            Lo que aprenderás
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
                            {detail.learningPoints.map((point, idx) => (
                                <div key={idx} className="flex gap-4 items-start py-0.5">
                                    <div className="mt-1 flex items-center justify-center size-5 bg-emerald-100 text-emerald-600 rounded-full shrink-0">
                                        <span className="material-symbols-outlined text-[14px] font-black">check</span>
                                    </div>
                                    <p className="text-[#4b5563] text-sm font-medium leading-relaxed">{point}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {testimonials.length > 0 && (
                <div className="py-12">
                    <div className="px-4 flex justify-between items-center mb-6">
                        <h3 className="text-[#111418] text-[22px] font-bold leading-tight tracking-[-0.015em]">Testimonios de Alumnos</h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => scrollTestimonials('left')}
                                className="size-9 rounded-full border border-[#e5e7eb] flex items-center justify-center text-[#60758a] hover:bg-white hover:border-[#0d7ff2] hover:text-[#0d7ff2] transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                            </button>
                            <button 
                                onClick={() => scrollTestimonials('right')}
                                className="size-9 rounded-full border border-[#e5e7eb] flex items-center justify-center text-[#60758a] hover:bg-white hover:border-[#0d7ff2] hover:text-[#0d7ff2] transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                    <div 
                        ref={testimonialScrollRef}
                        className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-4 snap-x snap-mandatory"
                    >
                        {testimonials.map((t, i) => (
                            <div key={i} className="min-w-[320px] p-6 rounded-2xl bg-white border border-[#e5e7eb] shadow-sm flex flex-col justify-between h-52 hover:shadow-md transition-shadow snap-start">
                                <div>
                                    <div className="flex text-yellow-400 mb-3">
                                        {/* Force 5 Filled Stars for Testimonials as typical "Best" Highlight */}
                                        {renderStars(5)} 
                                    </div>
                                    <p className="text-[#111418] text-sm leading-relaxed line-clamp-3 italic font-medium">
                                        "{t.text}"
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 mt-4 border-t border-slate-50 pt-4">
                                    {t.avatarUrl ? (
                                        <img className="size-10 rounded-full object-cover ring-2 ring-slate-100" src={t.avatarUrl} alt={t.name} />
                                    ) : (
                                        <div className="size-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 ring-2 ring-slate-100">
                                            {t.name.substring(0,2).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm font-black text-[#111418]">{t.name}</p>
                                        <p className="text-[10px] text-[#60758a] uppercase font-bold tracking-widest">{t.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {faqs.length > 0 && (
                <div className="px-4 py-4 mb-12">
                    <h3 className="text-[#111418] text-[22px] font-bold leading-tight tracking-[-0.015em] mb-6">Preguntas Frecuentes</h3>
                    <div className="flex flex-col gap-3">
                        {faqs.map((faq, i) => {
                            const isOpen = openFaqId === (faq.id || String(i));
                            return (
                                <div key={faq.id || i} className="bg-white rounded-2xl border border-[#e5e7eb] shadow-sm overflow-hidden transition-all duration-300">
                                    <button 
                                        onClick={() => toggleFaq(faq.id || String(i))}
                                        className="w-full flex justify-between items-center p-5 text-left group"
                                    >
                                        <span className="font-bold text-sm text-[#111418] group-hover:text-primary transition-colors">{faq.question}</span>
                                        <span className={`material-symbols-outlined text-[#9ca3af] transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>
                                    <div 
                                        className={`px-5 text-sm text-[#60758a] leading-relaxed transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] pb-5 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}
                                    >
                                        <div className="pt-2 border-t border-slate-50">
                                            {faq.answer}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>

        <PublicFooter />

        {/* Global Mobile Footer */}
        <PublicMobileFooter />
        <PublicFloatingButtons />

        {/* 
            ACTION BAR:
            - Desktop: Fixed at bottom-0.
            - Mobile: Fixed at bottom-[64px] (to sit above the Global Footer).
            - Z-Index: 40 to sit above content but below modals/overlays.
        */}
        <div className="fixed bottom-[64px] lg:bottom-0 left-0 w-full z-40 bg-white/95 backdrop-blur-xl border-t border-[#e5e7eb] px-4 py-3 lg:py-4 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]">
            <div className="max-w-md mx-auto flex items-center gap-4 lg:gap-6">
                <div className="flex flex-col shrink-0">
                    <span className="text-[10px] font-black text-[#9ca3af] uppercase tracking-widest">Precio</span>
                    <div className="flex items-baseline gap-1">
                        {selectedCourse.originalPrice && (
                            <span className="text-xs text-slate-400 line-through font-bold decoration-red-400 mr-1">${selectedCourse.originalPrice.toFixed(2)}</span>
                        )}
                        <span className="text-2xl lg:text-3xl font-black text-slate-900">${selectedCourse.price.toFixed(2)}</span>
                        <span className="text-xs text-[#60758a] font-bold">USD</span>
                    </div>
                </div>
                <button 
                    onClick={handleEnroll}
                    className="flex-1 h-12 lg:h-14 bg-gradient-to-r from-[#0d7ff2] to-blue-600 rounded-xl lg:rounded-2xl flex items-center justify-center gap-2 text-white font-black text-base lg:text-lg shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all hover:brightness-110"
                >
                    <span className="hidden sm:inline">Inscribirme a esta fecha</span>
                    <span className="sm:hidden">Inscribirme</span>
                    <span className="material-symbols-outlined">arrow_forward</span>
                </button>
            </div>
        </div>
    </div>
  );
};

export default PublicCourseDetail;

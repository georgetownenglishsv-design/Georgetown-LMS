
import React, { useState, useEffect } from 'react';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { useParams, useNavigate, Link } = ReactRouterDOM as any;
import { getWebExamDetailById, getExams } from '../services/db';
import { WebExamDetail, Exam } from '../types';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { auth } from '../firebase';
import { PublicFloatingButtons } from './PublicFloatingButtons';
import { PublicMobileFooter } from './PublicMobileFooter';
import { PublicFooter } from './PublicFooter';

const PublicExamDetail: React.FC = () => {
  /* Fix: Removed type arguments from untyped function call useParams to resolve "Untyped function calls may not accept type arguments" error. */
  const { id } = useParams();
  const navigate = useNavigate();
  const [pageData, setPageData] = useState<WebExamDetail | null>(null);
  const [realExams, setRealExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    return () => {};
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // [REMOVED] Automatic Anonymous Auth Logic
        // Data is now accessible via public read rules in Firestore.
        
        const [page, exams] = await Promise.all([
            getWebExamDetailById(id),
            getExams()
        ]);
        
        if (page) {
            setPageData(page);
        }
        setRealExams(exams);
      } catch (error) {
        console.error("Error details", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleEnroll = (realExamId: string) => {
      if (!realExamId) {
          alert("Esta opción no tiene un examen vinculado actualmente.");
          return;
      }
      // Pass the REAL exam ID to the enrollment page
      navigate('/enroll', { state: { selectedExamId: realExamId } });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400 bg-[#f5f7f8]"><Icon name="sync" className="animate-spin text-3xl" /></div>;
  if (!pageData) return <div className="min-h-screen flex items-center justify-center text-slate-500 bg-[#f5f7f8]">Página no encontrada.</div>;

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-24 bg-[#f5f7f8] font-display text-[#111418]">
        {/* Navbar */}
        <div className="sticky top-0 z-50 flex items-center bg-white/95 backdrop-blur-md px-4 py-3 justify-between border-b border-gray-100 shadow-sm transition-colors">
            <div className="flex items-center gap-3 shrink-0">
                <div onClick={() => navigate(-1)} className="text-[#0d7ff2] flex size-12 shrink-0 items-center justify-center cursor-pointer hover:bg-[#0d7ff2]/10 rounded-full transition-colors">
                    <Icon name="arrow_back" className="text-2xl" />
                </div>
                <Link to="/" className="flex items-center justify-center h-8 w-auto">
                    <Logo className="h-full w-auto object-contain" iconOnly={true} />
                </Link>
            </div>
            <h2 className="text-[#111418] text-lg font-extrabold leading-tight tracking-[-0.015em] flex-1 text-center truncate px-2">
                Georgetown Academy
            </h2>
            <div className="w-12"></div>
        </div>

        {/* Hero Section */}
        <div className="relative w-full aspect-[2/1] md:aspect-[3/1] max-h-[400px] overflow-hidden">
            <div 
                className="absolute inset-0 bg-cover bg-center" 
                style={{ backgroundImage: `url("${pageData.heroImage}")` }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#111418] via-transparent to-transparent opacity-90"></div>
            <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 max-w-[1200px] mx-auto">
                <span className="inline-block px-3 py-1 mb-3 text-xs font-bold bg-[#0d7ff2] rounded-lg text-white uppercase tracking-wider shadow-sm">
                    Certificación Oficial
                </span>
                <h1 className="text-white text-3xl md:text-5xl font-black leading-tight tracking-tight drop-shadow-md">
                    {pageData.title}
                </h1>
            </div>
        </div>

        <div className="w-full max-w-4xl mx-auto px-4 -mt-6 relative z-10 flex flex-col gap-8">
            
            {/* Main Info Card */}
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-slate-100">
                <h3 className="text-[#111418] text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Icon name="info" className="text-[#0d7ff2]" /> Información del Examen
                </h3>
                <div className="text-[#4b5563] text-base leading-relaxed whitespace-pre-line">
                    {pageData.description}
                </div>
            </div>

            {/* Ventajas Georgetown (Features) */}
            {pageData.features && pageData.features.length > 0 && (
                <div>
                    <h2 className="text-[#111418] tracking-tight text-[22px] font-bold leading-tight px-2 text-left pb-3">
                        Ventajas Georgetown
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {pageData.features.map((feat, idx) => (
                            <div key={idx} className="flex flex-col gap-2 rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-[#0d7ff2]">
                                        <Icon name={feat.icon} className="text-lg" />
                                    </div>
                                    <h2 className="text-[#111418] text-sm font-bold leading-tight">{feat.title}</h2>
                                </div>
                                <p className="text--[#60758a] text-xs font-medium leading-relaxed pl-1">{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Options / Pricing (MANUAL CARDS from WebExamOption) */}
            <div id="pricing">
                <h2 className="text-[#111418] tracking-tight text-[22px] font-bold leading-tight px-2 text-left pb-4 pt-4">
                    Selecciona tu Opción
                </h2>
                <div className="flex flex-col gap-4">
                    {(!pageData.options || pageData.options.length === 0) ? (
                        <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500 text-sm">
                            No hay opciones disponibles por el momento.
                        </div>
                    ) : (
                        pageData.options.map((opt) => {
                            const linkedExam = realExams.find(e => e.id === opt.linkedRealExamId);
                            let discountText = opt.discountBadgeText || linkedExam?.discountBadgeText;
                            const originalPrice = opt.originalPriceLabel || (linkedExam?.originalPrice ? `$${linkedExam.originalPrice.toFixed(2)}` : null);
                            
                            // Fallback: If there is a discount but no badge text, show "OFERTA"
                            if (!discountText && originalPrice) {
                                discountText = "OFERTA";
                            }

                            const priceLabel = opt.priceLabel || (linkedExam?.price ? `$${linkedExam.price.toFixed(2)}` : null);

                            return (
                            <div key={opt.id} className="group flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(13,127,242,0.08)] hover:shadow-xl hover:border-[#0d7ff2]/30 transition-all duration-300 relative overflow-hidden">
                                {/* Decorative gradient accent */}
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#0d7ff2]"></div>

                                {/* LUXURY DISCOUNT BADGE */}
                                {discountText && (
                                    <div className="absolute -top-2 -right-2 z-20 scale-90 origin-top-right">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-600 rounded-full blur opacity-70 animate-pulse"></div>
                                            <div className="relative px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-600 border border-amber-300/50 rounded-full shadow-xl overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer"></div>
                                                <span className="relative text-white text-[10px] font-black tracking-wider uppercase drop-shadow-md">{discountText}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-start pl-2 gap-4">
                                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                                        <h3 className="text-[#111418] text-lg font-bold group-hover:text-[#0d7ff2] transition-colors break-words leading-tight">{opt.marketingTitle}</h3>
                                        <p className="text-[#60758a] text-sm font-medium flex items-center gap-1">
                                            <Icon name="schedule" className="text-sm shrink-0" /> {opt.duration}
                                        </p>
                                    </div>
                                    <div className="text-right flex flex-col items-end shrink-0">
                                        {originalPrice && (
                                            <span className="text-xs sm:text-sm text-slate-400 line-through font-bold mb-0.5 decoration-red-400 decoration-2">{originalPrice}</span>
                                        )}
                                        <span className="block text-[#0d7ff2] text-2xl sm:text-3xl font-black tracking-tighter drop-shadow-sm leading-none">{priceLabel}</span>
                                    </div>
                                </div>

                                {/* Guarantees */}
                                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-500 pl-2">
                                    {opt.guarantee1 && (
                                        <div className="flex items-center gap-1.5">
                                            <Icon name="check_circle" className="text-emerald-500 text-sm" /> {opt.guarantee1}
                                        </div>
                                    )}
                                    {opt.guarantee2 && (
                                        <div className="flex items-center gap-1.5">
                                            <Icon name="verified" className="text-emerald-500 text-sm" /> {opt.guarantee2}
                                        </div>
                                    )}
                                </div>

                                <div className="w-full h-px bg-gray-100 my-1"></div>
                                
                                <button 
                                    onClick={() => handleEnroll(opt.linkedRealExamId)}
                                    className="w-full py-4 rounded-xl bg-[#0d7ff2] text-white font-bold text-sm hover:bg-blue-600 shadow-lg shadow-blue-500/30 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    Inscribirme Ahora <Icon name="arrow_forward" />
                                </button>
                            </div>
                        )})
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

export default PublicExamDetail;

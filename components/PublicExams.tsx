
import React, { useState, useEffect } from 'react';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM as any;
import { getWebExamLandings, getBrandInfo } from '../services/db';
import { WebExamLanding, BrandInfo } from '../types';
import { Icon } from './Icon';
import { auth } from '../firebase';
import { PublicNavbar } from './PublicNavbar';
import { PublicMobileFooter } from './PublicMobileFooter';
import { PublicFloatingButtons } from './PublicFloatingButtons';
import { PublicFooter } from './PublicFooter';

const PublicExams: React.FC = () => {
  const navigate = useNavigate();
  const [landings, setLandings] = useState<WebExamLanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<BrandInfo | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    return () => {};
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // [REMOVED] Automatic Anonymous Auth Logic
        // Data is now accessible via public read rules in Firestore.

        const [data, brandInfo] = await Promise.all([
            getWebExamLandings(),
            getBrandInfo()
        ]);
        setLandings(data.filter(p => p.status === 'Active'));
        setBrand(brandInfo);
      } catch (error) {
        console.error("Error loading exam pages:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-[#f5f7f8] font-display text-[#111418]">
      <PublicNavbar />
      
      <main className="flex-1 flex flex-col gap-6 pb-24 w-full max-w-[1280px] mx-auto">
        <div className="px-4 pt-6">
            <h1 className="text-[#111418] tracking-tight text-[32px] font-bold leading-tight">Certificaciones Internacionales</h1>
            <p className="text-[#60758a] text-sm mt-2 font-normal">Valida tu nivel de inglés con los estándares globales más exigentes.</p>
        </div>

        {/* Feature Grid - Static for now */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4">
            <div className="flex flex-row md:flex-col gap-4 rounded-xl border border-transparent bg-white p-4 items-center shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05),0_0_8px_rgba(0,0,0,0.02)]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0d7ff2]/10 text-[#0d7ff2]">
                    <span className="material-symbols-outlined text-2xl">schedule</span>
                </div>
                <div className="flex flex-col md:text-center text-left">
                    <h3 className="text-[#111418] text-base font-bold leading-tight">Horarios Flexibles</h3>
                    <p className="text-[#60758a] text-xs mt-1">Agenda tu examen cuando mejor te convenga.</p>
                </div>
            </div>
            <div className="flex flex-row md:flex-col gap-4 rounded-xl border border-transparent bg-white p-4 items-center shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05),0_0_8px_rgba(0,0,0,0.02)]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0d7ff2]/10 text-[#0d7ff2]">
                    <span className="material-symbols-outlined text-2xl">verified</span>
                </div>
                <div className="flex flex-col md:text-center text-left">
                    <h3 className="text-[#111418] text-base font-bold leading-tight">Certificación Express</h3>
                    <p className="text-[#60758a] text-xs mt-1">Resultados y certificado oficial el mismo día.</p>
                </div>
            </div>
            <div className="flex flex-row md:flex-col gap-4 rounded-xl border border-transparent bg-white p-4 items-center shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05),0_0_8px_rgba(0,0,0,0.02)]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0d7ff2]/10 text-[#0d7ff2]">
                    <span className="material-symbols-outlined text-2xl">analytics</span>
                </div>
                <div className="flex flex-col md:text-center text-left">
                    <h3 className="text-[#111418] text-base font-bold leading-tight">Resultados Detallados</h3>
                    <p className="text-[#60758a] text-xs mt-1">Análisis profundo de tus habilidades.</p>
                </div>
            </div>
        </div>

        <div className="h-px w-full bg-gray-200 my-2 px-4"></div>

        {/* Exams List (From Landings) */}
        <div className="flex flex-col gap-6 px-4">
            {loading ? (
                <div className="flex justify-center py-20 text-slate-400">
                    <Icon name="sync" className="animate-spin text-3xl" />
                </div>
            ) : landings.length === 0 ? (
                <div className="text-center py-20 text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200">
                    No hay exámenes disponibles en este momento.
                </div>
            ) : (
                landings.map((landing) => (
                    <div key={landing.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05),0_0_8px_rgba(0,0,0,0.02)] transition-transform hover:scale-[1.01] duration-300">
                        {/* Using a generic or specific image for the landing card if available, otherwise fallback pattern */}
                        <div 
                            className="relative w-full aspect-video md:aspect-[3/1] bg-center bg-cover" 
                            style={{ backgroundImage: `url("${landing.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBfPl2Dm4NpZBe4eyRmhItuwaYWDABWdAPXBo7gFs3NCN0OwrvpAgib9TlsL0ttns-Lec8xXVlbZJLrmC_dOvYPOzvDkFcbZOP_82XnNNhqEkXRlv2n201U_7ij7On6nj5qL9NJWkoFmAIa2wgPcd2YP4Vf4DGtAPWzTcgVLqJcYA9_CDDvl31hswFxhU96XoY9A4ONXUpippHaBCb9hNyUBtbDanGC7gnqsOtNe3PArZnGu6TuM90Xa3F22dvmA1yfDC2kotbmoco'}")` }}
                        >
                            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[#0d7ff2] text-base">verified</span>
                                <span className="text-[#0d7ff2] text-xs font-bold uppercase tracking-wide">{landing.internalCategory || 'Certificación'}</span>
                            </div>
                        </div>
                        <div className="flex flex-col p-5 gap-4">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-[#111418] text-xl font-bold leading-tight">{landing.title}</h3>
                                <p className="text-[#60758a] text-base leading-normal">
                                    {landing.shortDescription}
                                </p>
                            </div>
                            
                            <div className="pt-2 mt-auto">
                                <button 
                                    onClick={() => navigate(`/exams/${landing.linkedDetailId}`)}
                                    className="w-full flex items-center justify-center rounded-xl h-12 px-4 bg-[#0d7ff2] hover:bg-[#0b6ad0] text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-colors"
                                >
                                    Ver Detalles e Inscripción
                                </button>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
        <div className="h-10"></div>
      </main>

      <PublicFooter />
      <PublicMobileFooter />
      <PublicFloatingButtons />
    </div>
  );
};

export default PublicExams;

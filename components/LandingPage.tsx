
import React, { useState, useEffect } from 'react';
import { PublicNavbar } from './PublicNavbar';
import * as ReactRouterDOM from 'react-router-dom';
const { Link, useNavigate } = ReactRouterDOM as any;
import { Icon } from './Icon';
import { getWebLandingConfig, getWebStoreConfig, getCourses, getExams, getBrandInfo } from '../services/db';
import { WebLandingSlide, BrandInfo } from '../types';
import { PublicMobileFooter } from './PublicMobileFooter';
import { PublicFloatingButtons } from './PublicFloatingButtons';
import { PublicFooter } from './PublicFooter';
import CareerROICalculator from './CareerROICalculator';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [slides, setSlides] = useState<WebLandingSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [featuredPrograms, setFeaturedPrograms] = useState<any[]>([]); 
  const [loadingHero, setLoadingHero] = useState(true); 
  const [loadingContent, setLoadingContent] = useState(true); 
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  
  // Modal State for ROI Calculator
  const [isRoiOpen, setIsRoiOpen] = useState(false);

  useEffect(() => {
      const fetchCriticalData = async () => {
          try {
              const [landingConfig, brandInfo] = await Promise.all([
                  getWebLandingConfig(),
                  getBrandInfo()
              ]);

              if (landingConfig.slides && landingConfig.slides.length > 0) {
                  setSlides(landingConfig.slides.sort((a, b) => a.order - b.order));
              }
              setBrand(brandInfo);
              setLoadingHero(false); 

              const [storeConfig, rawCourses, rawExams] = await Promise.all([
                  getWebStoreConfig(),
                  getCourses(),
                  getExams()
              ]);

              const activeCourses = rawCourses.filter(c => c.status === 'Active');
              const activeExams = rawExams.filter(e => e.status === 'Active');

              const slots = [storeConfig.featured.slot1, storeConfig.featured.slot2, storeConfig.featured.slot3, storeConfig.featured.slot4];
              let resolvedItems = slots.map(slot => {
                  if (slot.itemType === 'course') return activeCourses.find(c => c.id === slot.itemId);
                  return activeExams.find(e => e.id === slot.itemId);
              }).filter(Boolean);

              if (resolvedItems.length < 3) {
                  const usedIds = new Set(resolvedItems.map((i: any) => i.id));
                  const filler = activeCourses.filter(c => !usedIds.has(c.id));
                  resolvedItems = [...resolvedItems, ...filler].slice(0, 4); 
              }

              setFeaturedPrograms(resolvedItems);
              setLoadingContent(false); 

          } catch (e) {
              console.error("Error loading landing page data", e);
              setLoadingHero(false);
              setLoadingContent(false);
          }
      };
      
      fetchCriticalData();
  }, []);

  useEffect(() => {
      if (slides.length <= 1) return;
      const interval = setInterval(() => {
          setCurrentSlide(prev => (prev + 1) % slides.length);
      }, 5000);
      return () => clearInterval(interval);
  }, [slides.length]);

  const activeSlide = slides[currentSlide];
  const brandName = brand?.name || 'Georgetown Academy';

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background-light font-display text-slate-900">
      <PublicNavbar />

      <div className="@container">
        <div className="@[480px]:p-4">
          <div className="relative flex min-h-[500px] flex-col gap-6 @[480px]:gap-8 @[480px]:rounded-2xl items-center justify-center p-4 overflow-hidden shadow-2xl bg-black">
            
            {loadingHero ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <div className="absolute inset-0 bg-[#111621] animate-pulse"></div>
                    <div className="relative z-10 flex flex-col gap-6 text-center max-w-3xl items-center w-full px-4">
                        <div className="h-4 w-32 bg-white/10 rounded-full animate-pulse"></div>
                        <div className="h-16 md:h-20 w-3/4 bg-white/10 rounded-xl animate-pulse"></div>
                        <div className="h-6 md:h-8 w-1/2 bg-white/10 rounded-lg animate-pulse"></div>
                    </div>
                </div>
            ) : (
                <>
                    {slides.length > 0 ? slides.map((slide, idx) => {
                        const isActive = idx === currentSlide;
                        const isSlideVideo = slide.imageUrl.endsWith('.mp4') || slide.imageUrl.endsWith('.webm');
                        return (
                            <div 
                                key={slide.id}
                                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 z-0' : 'opacity-0 -z-10'}`}
                            >
                                {isSlideVideo ? (
                                    <video autoPlay muted loop playsInline className="w-full h-full object-cover opacity-60">
                                        <source src={slide.imageUrl} type="video/mp4" />
                                    </video>
                                ) : (
                                    <div 
                                        className="w-full h-full bg-cover bg-center"
                                        style={{ backgroundImage: `linear-gradient(rgba(17, 22, 33, 0.3) 0%, rgba(17, 22, 33, 0.7) 100%), url("${slide.imageUrl}")` }}
                                    ></div>
                                )}
                                <div className="absolute inset-0 bg-black/30"></div>
                            </div>
                        );
                    }) : (
                        <div className="absolute inset-0 bg-[#111621] flex items-center justify-center">
                            <div className="text-white text-center p-4">
                                <h1 className="text-4xl font-bold mb-4">{brandName}</h1>
                                <p>Bienvenido. Configure los slides en el panel de administración.</p>
                            </div>
                        </div>
                    )}

                    {activeSlide && (
                        <div className="relative z-10 flex flex-col gap-4 text-center max-w-3xl animate-in fade-in zoom-in-95 duration-700" key={activeSlide.id}>
                        <span className="text-gold font-bold tracking-[0.2em] uppercase text-xs md:text-sm drop-shadow-md">
                            {brandName}
                        </span>
                        <h1 className="text-white text-4xl sm:text-5xl md:text-7xl font-black leading-tight tracking-tighter drop-shadow-2xl">
                            {activeSlide.title}
                        </h1>
                        <h2 className="text-slate-100 text-lg md:text-xl font-medium leading-relaxed max-w-xl mx-auto drop-shadow-lg mt-2 text-shadow">
                            {activeSlide.subtitle}
                        </h2>
                        <div className="flex justify-center mt-6">
                            <Link to={activeSlide.link} className="flex min-w-[200px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-14 px-8 bg-white text-primary hover:bg-gold hover:text-white transition-all duration-300 text-sm font-black uppercase tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.6)] hover:scale-105">
                                <span className="truncate">{activeSlide.buttonText}</span>
                            </Link>
                        </div>
                        </div>
                    )}

                    {slides.length > 1 && (
                        <div className="absolute bottom-6 left-0 w-full flex justify-center gap-3 z-20">
                            {slides.map((_, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setCurrentSlide(idx)}
                                    className={`w-3 h-3 rounded-full transition-all border border-white/50 ${idx === currentSlide ? 'bg-white scale-125' : 'bg-white/20 hover:bg-white/50'}`}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-white border-b border-slate-200 py-4 px-4 shadow-sm relative z-20">
        <div className="flex items-center justify-center gap-3 text-center">
          <Icon name="school" className="text-gold text-2xl" />
          <p className="text-sm font-medium text-slate-700">
            Ofrecemos clases <span className="text-gold font-bold">presenciales</span> y <span className="text-primary font-bold">en línea</span> con certificación internacional.
          </p>
        </div>
      </div>

      {/* --- FLASH PROMO BANNER FOR EMMA --- */}
      <div className="w-full max-w-6xl mx-auto px-4 pt-8 pb-2">
        <div 
          onClick={() => navigate('/try-emma')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-purple-900/40 to-slate-900 border border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.25)] hover:shadow-[0_0_50px_rgba(168,85,247,0.5)] transition-all duration-500 hover:-translate-y-1 cursor-pointer group"
        >
          {/* Shimmer Effect */}
          <div className="absolute top-0 -left-[100%] h-full w-[50%] z-0 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:left-[200%] transition-all duration-1000 ease-in-out" />
          
          {/* Animated Glow */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-[-50%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/20 blur-[80px] mix-blend-screen animate-pulse"></div>
            <div className="absolute bottom-[-50%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/20 blur-[80px] mix-blend-screen animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>

          <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/50 text-pink-300 text-xs font-black tracking-widest uppercase mb-3 shadow-[0_0_15px_rgba(236,72,153,0.5)] animate-pulse">
                <Icon name="local_fire_department" className="text-sm" />
                Oferta Especial: 1 Minuto Gratis
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2 leading-tight">
                ¿Inglés sin miedo? <br className="hidden md:block"/>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">Conoce a Emma, tu Tutor.</span>
              </h2>
              <p className="text-slate-300 text-sm md:text-base max-w-xl">
                Practica speaking sin juicios y recibe feedback instantáneo. ¡Haz clic aquí para probarlo ahora mismo!
              </p>
            </div>
            <div className="shrink-0">
              <div className="relative inline-flex items-center justify-center px-8 py-4 font-black text-white transition-all duration-300 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full group-hover:scale-110 overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.6)]">
                <span className="relative flex items-center gap-2">
                  <Icon name="play_arrow" className="text-2xl" />
                  PROBAR AHORA
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- MOTIVATION GRID (COMPACT TEASERS) --- */}
      <div className="w-full max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* CARD 1: PLACEMENT TEST */}
              <div 
                  onClick={() => navigate('/placement-test')}
                  className="relative overflow-hidden rounded-2xl cursor-pointer group shadow-lg h-32 md:h-56 transition-all hover:scale-[1.01] hover:shadow-xl bg-gradient-to-r from-blue-900 to-slate-900"
              >
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=1000')] bg-cover bg-center opacity-40 group-hover:opacity-30 transition-opacity"></div>
                  <div className="relative z-10 p-5 md:p-8 flex flex-col justify-center h-full items-start">
                      <div className="bg-blue-500/20 text-blue-300 p-2 rounded-lg mb-2 hidden md:block">
                          <Icon name="psychology" className="text-2xl" />
                      </div>
                      <h3 className="text-white text-xl md:text-3xl font-black leading-tight mb-1">
                          ¿No sabes tu nivel?
                      </h3>
                      <p className="text-blue-100 text-xs md:text-sm font-medium mb-3 md:mb-4">
                          Test rápido y certificado gratuito.
                      </p>
                      <button className="bg-white text-blue-900 px-4 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-2 group-hover:bg-blue-50 transition-colors shadow-lg">
                          Iniciar Test <Icon name="arrow_forward" className="text-sm" />
                      </button>
                  </div>
              </div>

              {/* CARD 2: ROI CALCULATOR */}
              <div 
                  onClick={() => setIsRoiOpen(true)}
                  className="relative overflow-hidden rounded-2xl cursor-pointer group shadow-lg h-32 md:h-56 transition-all hover:scale-[1.01] hover:shadow-xl bg-gradient-to-r from-slate-900 to-[#2c2207]"
              >
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=1000')] bg-cover bg-center opacity-20 group-hover:opacity-10 transition-opacity"></div>
                  <div className="relative z-10 p-5 md:p-8 flex flex-col justify-center h-full items-start">
                      <div className="bg-gold/20 text-gold p-2 rounded-lg mb-2 hidden md:block">
                          <Icon name="currency_exchange" className="text-2xl" />
                      </div>
                      <h3 className="text-white text-xl md:text-3xl font-black leading-tight mb-1">
                          ¿Cuánto vale tu inglés?
                      </h3>
                      <p className="text-yellow-100/80 text-xs md:text-sm font-medium mb-3 md:mb-4">
                          Calculadora salarial con IA.
                      </p>
                      <button className="bg-gold text-black px-4 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-2 group-hover:bg-yellow-400 transition-colors shadow-lg">
                          Calcular Ahora <Icon name="calculate" className="text-sm" />
                      </button>
                  </div>
              </div>

          </div>
      </div>

      {/* ROI MODAL */}
      <CareerROICalculator isOpen={isRoiOpen} onClose={() => setIsRoiOpen(false)} />

      {/* PREMIUM DARK SECTION: TOEIC MOCK TEST */}
      <div className="px-4 py-8 md:py-16">
          <div className="max-w-6xl mx-auto">
              <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-[#0a0f16] p-6 md:p-12 lg:p-16">
                  {/* Background Effects */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
                  <div className="absolute bottom-0 right-0 w-96 h-96 bg-yellow-500/5 blur-[100px] rounded-full pointer-events-none"></div>
                  
                  <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
                      
                      {/* Left: Mockup Image (Hidden on mobile to save space) */}
                      <div className="relative order-2 lg:order-1 group hidden md:block">
                          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50 bg-[#151a23] aspect-[4/3] flex items-center justify-center">
                              {/* Simulated Laptop/Screen Mockup */}
                              <div className="w-[85%] h-[75%] bg-[#0f1218] rounded-lg border border-slate-800 shadow-inner flex flex-col overflow-hidden relative">
                                  {/* Screen Header */}
                                  <div className="h-6 bg-slate-800/50 border-b border-slate-700 flex items-center px-3 gap-1.5">
                                      <div className="w-2 h-2 rounded-full bg-red-500/80"></div>
                                      <div className="w-2 h-2 rounded-full bg-yellow-500/80"></div>
                                      <div className="w-2 h-2 rounded-full bg-green-500/80"></div>
                                  </div>
                                  {/* Screen Content */}
                                  <div className="flex-1 p-4 flex flex-col items-center justify-center relative">
                                      <Icon name="headset_mic" className="text-5xl text-blue-500/80 mb-3" />
                                      <div className="w-3/4 h-2 bg-slate-700/50 rounded-full mb-2"></div>
                                      <div className="w-1/2 h-2 bg-slate-700/50 rounded-full mb-6"></div>
                                      <div className="grid grid-cols-2 gap-2 w-full max-w-[200px]">
                                          <div className="h-8 bg-blue-600/20 border border-blue-500/30 rounded flex items-center justify-center"><div className="w-4 h-4 rounded-full border-2 border-blue-500/50"></div></div>
                                          <div className="h-8 bg-slate-800/50 rounded flex items-center justify-center"><div className="w-4 h-4 rounded-full border-2 border-slate-600"></div></div>
                                      </div>
                                      {/* Overlay Glow */}
                                      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1218] via-transparent to-transparent"></div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Right: Content */}
                      <div className="order-1 lg:order-2 flex flex-col items-center lg:items-start text-center lg:text-left">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-4 md:mb-6">
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                              Servicio Premium
                          </div>
                          
                          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-white leading-[1.1] mb-3 md:mb-6 tracking-tight">
                              Entorno idéntico al examen real. <br className="hidden md:block" />
                              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                                  Georgetown Premium TOEIC Mock Test.
                              </span>
                          </h2>
                          
                          <p className="text-slate-400 text-xs md:text-base leading-relaxed mb-6 md:mb-8 max-w-lg">
                              Mide tu nivel con precisión antes del examen oficial. Nuestro simulador reproduce las condiciones exactas del TOEIC, brindándote un análisis detallado de tu desempeño.
                          </p>
                          
                          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full sm:w-auto">
                              <button 
                                  onClick={() => navigate('/exams/w5ll0s8xpX109jv54w8n')}
                                  className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-white text-black hover:bg-slate-100 rounded-xl font-bold transition-all shadow-lg shadow-white/10 flex items-center justify-center gap-2 transform hover:scale-105 text-sm md:text-base"
                              >
                                  <Icon name="visibility" className="text-lg" />
                                  Ver detalles y aplicar
                              </button>
                          </div>
                          
                          <div className="mt-6 md:mt-8 flex flex-wrap justify-center lg:justify-start items-center gap-3 md:gap-4 text-slate-500 text-[10px] md:text-xs font-medium">
                              <div className="flex items-center gap-1"><Icon name="check_circle" className="text-blue-500 text-sm" /> Resultados Inmediatos</div>
                              <div className="flex items-center gap-1"><Icon name="check_circle" className="text-blue-500 text-sm" /> Análisis por Sección</div>
                          </div>
                      </div>

                  </div>
              </div>
          </div>
      </div>

      {/* Why Georgetown Section */}
      <div className="px-4 py-16 bg-gradient-to-b from-background-light to-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-slate-900 text-3xl font-black leading-tight tracking-tight mb-3 text-center">¿Por qué {brandName}?</h2>
          <p className="text-slate-500 text-base text-center mb-12 max-w-2xl mx-auto">Excelencia académica y un entorno exclusivo diseñado para potenciar tu aprendizaje sin límites.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="relative w-full h-[400px] rounded-3xl overflow-hidden shadow-2xl border border-white/20 group">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBKtpi558Vlpc8-lZ7WofE9FO7R1MWKZQ7o57bpDsVt6UHEk401-UxF34MfyMFhVWHJMr_U06nmPghys3RIiDPAsDUEjmJpQ2SyepaX-6I0ZvNF0N4nHhTWBhqOKtH-pGIX6fcLaEkhceHTUuWIwzUpVGUcwWXqPpdVHjdz6rrsOKJD7nZJXesdhj5ZE5Iu5POl54TBe2emC-Har7XY6g6mlh8htmNUz5nxferNyvk5ma9oWAB1h_jpPKAT0iqCj8d7cAAV_E12tpk")' }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
              <div className="relative h-full flex flex-col justify-end p-8 text-left z-10">
                <div className="flex flex-col gap-2">
                  <span className="inline-block py-1 px-3 rounded-lg bg-gold text-white text-[10px] font-bold tracking-widest uppercase w-fit mb-2">
                    Experiencia Premium
                  </span>
                  <h3 className="text-white text-3xl font-black drop-shadow-xl leading-none">
                    Aprende. <span className="text-gold italic">Brilla.</span> Triunfa.
                  </h3>
                  <p className="text-slate-200 text-sm font-medium leading-relaxed mt-2 opacity-90">
                    Un método único donde el lujo se encuentra con la educación de clase mundial. Instalaciones modernas y tecnología de punta.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: 'psychology', title: 'Sistema Avanzado', sub: 'Metodología única basada en PNL' },
                { icon: 'workspace_premium', title: 'Profesores Top', sub: 'Certificados TEFL y Nativos' },
                { icon: 'storefront', title: 'Instalaciones', sub: 'Espacios de lujo y confort' },
                { icon: 'forum', title: 'Networking', sub: 'Comunidad elite empresarial' }
              ].map((item, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-2xl bg-white p-4 md:p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all border border-slate-100 items-start text-left group h-full">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                  </div>
                  <div>
                    <p className="text-slate-900 text-base md:text-lg font-bold leading-tight">{item.title}</p>
                    <p className="text-slate-500 text-[10px] md:text-xs mt-1 font-medium">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Programs Section */}
      <div className="px-4 py-16 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-slate-900 text-3xl font-black leading-tight tracking-tight mb-3">Nuestros Programas</h2>
              <p className="text-slate-500 text-base leading-relaxed">
                Explora nuestra oferta académica integral. Desde clases personalizadas hasta grupos ejecutivos, tenemos el camino perfecto para tu dominio del idioma.
              </p>
            </div>
            <Link to="/courses" className="inline-flex items-center justify-center px-6 py-3 bg-slate-900 hover:bg-primary text-white text-sm font-bold rounded-xl transition-colors shadow-lg">
                Catálogo Completo
                <Icon name="arrow_forward" className="ml-2 text-lg" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingContent ? (
                [1,2,3].map(i => (
                    <div key={i} className="flex flex-col rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden h-96 animate-pulse">
                        <div className="h-48 bg-slate-200"></div>
                        <div className="p-6 flex-1 space-y-4">
                            <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                            <div className="h-4 bg-slate-200 rounded w-full"></div>
                            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                        </div>
                    </div>
                ))
            ) : featuredPrograms.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p>Próximamente publicaremos nuevos programas.</p>
                </div>
            ) : (
                featuredPrograms.map((item: any) => (
                    <div key={item.id} className="flex flex-col rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden group hover:shadow-2xl hover:shadow-primary/10 transition-all cursor-pointer" onClick={() => navigate(item.category && item.category !== 'EXAM' ? `/courses/${item.id}` : `/enroll`)}>
                        <div className="h-48 bg-center bg-no-repeat bg-cover relative" style={{ backgroundImage: `url("${item.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuBKtpi558Vlpc8-lZ7WofE9FO7R1MWKZQ7o57bpDsVt6UHEk401-UxF34MfyMFhVWHJMr_U06nmPghys3RIiDPAsDUEjmJpQ2SyepaX-6I0ZvNF0N4nHhTWBhqOKtH-pGIX6fcLaEkhceHTUuWIwzUpVGUcwWXqPpdVHjdz6rrsOKJD7nZJXesdhj5ZE5Iu5POl54TBe2emC-Har7XY6g6mlh8htmNUz5nxferNyvk5ma9oWAB1h_jpPKAT0iqCj8d7cAAV_E12tpk'}")` }}>
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                            <div className="absolute top-4 left-4">
                                <span className="bg-white/90 backdrop-blur text-slate-900 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                                    {item.category || 'Destacado'}
                                </span>
                            </div>
                            {item.originalPrice && (
                                <div className="absolute top-4 right-4">
                                    <div className="bg-gradient-to-r from-red-500 to-pink-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-sm uppercase tracking-wider animate-pulse">
                                        OFERTA
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col flex-1 p-6">
                            <div className="flex-1">
                                <h3 className="text-slate-900 text-xl font-bold mb-2 group-hover:text-primary transition-colors">{item.name}</h3>
                                <p className="text-slate-500 text-sm line-clamp-3 mb-4">
                                    {item.description || 'Descripción no disponible. Contacte para más información.'}
                                </p>
                                <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wide">
                                    {item.mode === 'online' ? (
                                        <span className="flex items-center gap-1"><Icon name="wifi" /> Online</span>
                                    ) : (
                                        <span className="flex items-center gap-1"><Icon name="groups" /> Presencial</span>
                                    )}
                                    <span className="flex items-center gap-1"><Icon name="verified" /> Certificado</span>
                                </div>
                            </div>
                            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
                                <div className="flex flex-col">
                                    {item.originalPrice ? (
                                        <>
                                            <span className="text-xs text-slate-400 line-through font-bold decoration-red-400 decoration-2">${item.originalPrice.toFixed(2)}</span>
                                            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700">${item.price.toFixed(2)}</span>
                                        </>
                                    ) : (
                                        <span className="text-xl font-black text-slate-900">${item.price.toFixed(2)}</span>
                                    )}
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation(); 
                                        navigate('/enroll', { state: { selectedCourseId: item.id } });
                                    }}
                                    className="flex items-center justify-center rounded-xl h-9 px-4 bg-primary text-white hover:bg-gold font-bold text-xs transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ml-auto"
                                >
                                    Inscribirse
                                </button>
                            </div>
                        </div>
                    </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Online Enrollment Banner - Reduced Padding Here */}
      {!loadingContent && (
          <div className="px-4 py-12 md:py-16 bg-background-light">
            <div className="max-w-5xl mx-auto relative overflow-hidden rounded-3xl bg-slate-900 p-8 md:p-12 text-white shadow-2xl">
              <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-gold/20 blur-3xl"></div>
              <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-primary/30 blur-3xl"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-4 text-gold">
                        <Icon name="diamond" className="text-3xl" />
                        <span className="font-bold tracking-widest uppercase text-sm">Tienda en Línea</span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-black mb-4 leading-tight">Tu futuro comienza aquí</h3>
                    <p className="text-slate-300 text-base leading-relaxed mb-8 max-w-xl">
                        Asegura tu lugar en nuestros cursos premium o adquiere materiales de estudio exclusivos directamente desde nuestra plataforma segura.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                        <Link to="/enroll" className="rounded-xl bg-white text-slate-900 px-8 py-3.5 text-sm font-bold shadow-lg hover:bg-gray-100 transition-colors">
                            Inscribirme Ahora
                        </Link>
                        <Link to="/store" className="rounded-xl border border-white/20 hover:bg-white/10 px-8 py-3.5 text-sm font-bold text-white transition-colors flex items-center justify-center">
                            Ver Tienda
                        </Link>
                    </div>
                </div>
                <div className="shrink-0 hidden md:block">
                     <Icon name="shopping_bag" className="text-[140px] text-white/5" />
                </div>
              </div>
            </div>
          </div>
      )}

      <PublicFooter />
      <PublicMobileFooter />
      <PublicFloatingButtons />
    </div>
  );
};

export default LandingPage;

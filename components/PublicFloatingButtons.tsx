
import React, { useState, useEffect } from 'react';
import { getBrandInfo, getDailyQuizByDay } from '../services/db';
import { BrandInfo, DailyQuiz } from '../types';
import { Icon } from './Icon';
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM as any;

export const PublicFloatingButtons: React.FC = () => {
  const navigate = useNavigate();
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false); // Menu state
  const [isVisible, setIsVisible] = useState(false); // Animation delay
  
  // Quiz State
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [dailyQuiz, setDailyQuiz] = useState<DailyQuiz | null>(null);
  const [quizState, setQuizState] = useState<'question' | 'result'>('question');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
      const load = async () => {
          const info = await getBrandInfo();
          setBrand(info);
      };
      load();
      
      const handleUpdate = (e: any) => setBrand(e.detail);
      window.addEventListener('brand-updated', handleUpdate);
      
      // Show Tooltip after 3 seconds
      const timer = setTimeout(() => setShowTooltip(true), 3000);
      const hideTimer = setTimeout(() => setShowTooltip(false), 10000); // Hide after 7s

      return () => {
          window.removeEventListener('brand-updated', handleUpdate);
          clearTimeout(timer);
          clearTimeout(hideTimer);
      };
  }, []);

  // Fetch Daily Quiz on Mount (Lazy load can also work on click)
  useEffect(() => {
      const fetchQuiz = async () => {
          const now = new Date();
          // Calculate Day of Year (1-365)
          const start = new Date(now.getFullYear(), 0, 0);
          const diff = now.getTime() - start.getTime();
          const oneDay = 1000 * 60 * 60 * 24;
          const dayOfYear = Math.floor(diff / oneDay);
          
          // Modulo logic: If we have 30 quizzes, day 32 shows quiz #2
          // But since IDs in DB are likely "1"..."30", we fetch exact ID.
          // Since our generator makes ID 1-30, we map dayOfYear to 1-30 range.
          const totalQuizzes = 30; // Assuming monthly bank refresh
          const quizId = ((dayOfYear - 1) % totalQuizzes) + 1;
          
          const quiz = await getDailyQuizByDay(quizId);
          if (quiz) setDailyQuiz(quiz);
      };
      fetchQuiz();
  }, []);

  useEffect(() => {
    if (isOpen) {
        requestAnimationFrame(() => setIsVisible(true));
    } else {
        setIsVisible(false);
    }
  }, [isOpen]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWhatsAppAction = (message: string) => {
      if (!brand?.whatsappNumber) return;
      const cleanNumber = brand.whatsappNumber.replace(/[^0-9]/g, '');
      const encodedMessage = encodeURIComponent(message);
      const url = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      setIsOpen(false);
  };

  const handleQuizAnswer = (idx: number) => {
      setSelectedOption(idx);
      setQuizState('result');
  };

  const handleLevelTestRedirect = () => {
      setIsQuizOpen(false);
      navigate('/placement-test');
  };

  const menuOptions = [
      { label: 'Cursos', icon: 'school', message: 'Hola, info cursos.', color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Exámenes', icon: 'assignment_turned_in', message: 'Hola, info exámenes.', color: 'text-purple-600', bg: 'bg-purple-50' },
      { label: 'Ubicación', icon: 'location_on', message: 'Hola, ubicación.', color: 'text-red-500', bg: 'bg-red-50' },
      { label: 'Soporte', icon: 'support_agent', message: 'Hola, ayuda.', color: 'text-emerald-600', bg: 'bg-emerald-50' }
  ];

  return (
    <>
        {/* Transparent Backdrop for Menu */}
        {isOpen && (
            <div className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px] transition-opacity duration-300" onClick={() => setIsOpen(false)} />
        )}

        {/* --- QUIZ MODAL --- */}
        {isQuizOpen && dailyQuiz && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300">
                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden relative">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center relative">
                        <button onClick={() => setIsQuizOpen(false)} className="absolute top-4 right-4 text-white/70 hover:text-white"><Icon name="close" /></button>
                        <div className="size-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
                            <Icon name="diamond" className="text-2xl text-white" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tight">Reto del Día</h3>
                        <p className="text-xs opacity-80 font-medium">Spanglish Challenge</p>
                    </div>

                    <div className="p-6">
                        {quizState === 'question' ? (
                            <div className="space-y-6">
                                <p className="text-lg font-bold text-slate-800 text-center leading-relaxed">
                                    "{dailyQuiz.question}"
                                </p>
                                <div className="flex flex-col gap-3">
                                    {dailyQuiz.options.map((opt, idx) => (
                                        <button 
                                            key={idx} 
                                            onClick={() => handleQuizAnswer(idx)}
                                            className="w-full py-4 px-6 rounded-xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 text-slate-600 font-bold transition-all text-sm"
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-5 text-center animate-in fade-in slide-in-from-bottom-4">
                                <div className={`size-16 mx-auto rounded-full flex items-center justify-center text-3xl shadow-lg ${selectedOption === dailyQuiz.correctAnswer ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                                    <Icon name={selectedOption === dailyQuiz.correctAnswer ? 'check' : 'close'} />
                                </div>
                                
                                <div>
                                    <h4 className={`text-xl font-black mb-1 ${selectedOption === dailyQuiz.correctAnswer ? 'text-green-600' : 'text-red-500'}`}>
                                        {selectedOption === dailyQuiz.correctAnswer ? '¡Correcto!' : 'Ups, casi...'}
                                    </h4>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-left">
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Explicación</p>
                                        <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                            {dailyQuiz.explanation}
                                        </p>
                                    </div>
                                </div>

                                {/* Marketing Hook - Dynamic based on result */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-100">
                                    <p className="text-xs text-slate-700 leading-tight">
                                        {selectedOption === dailyQuiz.correctAnswer 
                                            ? <><span className="font-bold text-indigo-600">¡Muy bien! 🌟</span> ¿Te interesan desafíos más avanzados? Mide tu nivel real con nuestro test completo.</>
                                            : <><span className="font-bold text-indigo-600">¿Sueles dudar en esto? 🤔</span> Es un error común. Descubre tu nivel exacto y cómo mejorar.</>
                                        }
                                    </p>
                                </div>

                                <button 
                                    onClick={handleLevelTestRedirect}
                                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Icon name="school" /> Iniciar Test de Nivel Gratuito
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Buttons Container */}
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 lg:right-6 z-[60] flex flex-col gap-4 items-end pointer-events-none transition-[bottom] duration-300">
            
            {/* 1. Scroll To Top */}
            <div className="pointer-events-auto transition-transform duration-300">
                <button onClick={scrollToTop} className="flex size-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-lg shadow-black/5 border border-gray-100 transition-all hover:text-[#0d7ff2] hover:scale-110 active:scale-95">
                    <span className="material-symbols-outlined text-xl">arrow_upward</span>
                </button>
            </div>

            {/* 2. QUIZ BUTTON (NEW) */}
            {dailyQuiz && (
                <div className="pointer-events-auto relative group">
                    {/* Tooltip */}
                    <div className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-white text-slate-800 text-sm font-black px-4 py-2 rounded-xl shadow-xl border border-slate-100 whitespace-nowrap transition-all duration-500 ${showTooltip ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
                        Reto del día 🎁
                        <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white transform rotate-45 border-t border-r border-slate-100"></div>
                    </div>

                    {/* Luxury Pulse Animation (Ping Effect) */}
                    <span className="absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-20 animate-ping duration-1000"></span>

                    <button 
                        onClick={() => { setIsQuizOpen(true); setQuizState('question'); setShowTooltip(false); }}
                        className="flex size-10 items-center justify-center rounded-full bg-white shadow-[0_0_20px_rgba(147,51,234,0.4)] border border-purple-100 transition-all hover:scale-110 active:scale-95 relative z-10 animate-[pulse_3s_ease-in-out_infinite]"
                    >
                        {/* Increased Diamond Size to text-2xl for impact */}
                        <Icon name="diamond" className="text-purple-600 text-2xl" />
                        <span className="absolute top-0 right-0 size-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                    </button>
                </div>
            )}

            {/* 3. Bottom Row (Menu + WhatsApp) */}
            <div className="flex items-end gap-3 relative">
                {/* Menu */}
                <div className={`absolute bottom-0 right-[52px] transition-all duration-300 origin-right ${isVisible ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto' : 'opacity-0 scale-90 translate-x-8 pointer-events-none'}`}>
                    <div className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-2 min-w-[240px] flex flex-col gap-1 ring-1 ring-black/5">
                        <div className="px-3 py-2 border-b border-slate-100 mb-1"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">¿En qué podemos ayudarte?</p></div>
                        {menuOptions.map((opt, idx) => (
                            <button key={idx} onClick={() => handleWhatsAppAction(opt.message)} className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left w-full relative overflow-hidden">
                                <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${opt.bg} ${opt.color}`}><Icon name={opt.icon} className="text-lg" /></div>
                                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{opt.label}</span>
                                <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 text-slate-300"><Icon name="chevron_right" /></div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Button */}
                <button onClick={() => setIsOpen(!isOpen)} className={`pointer-events-auto group flex size-10 items-center justify-center rounded-full shadow-xl shadow-green-500/20 transition-all duration-300 hover:scale-105 active:scale-95 relative overflow-hidden z-20 ${isOpen ? 'bg-slate-800 rotate-90' : 'bg-[#25D366] rotate-0'}`}>
                    <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isOpen ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`}>
                        <svg className="w-5 h-5 fill-white" viewBox="0 0 16 16"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"></path></svg>
                    </div>
                    <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`}>
                        <Icon name="close" className="text-lg text-white font-bold" />
                    </div>
                </button>
            </div>
        </div>
    </>
  );
};

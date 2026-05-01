import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Logo } from './Logo';
import AISpeakingChallenge from './AISpeakingChallenge';
import { recordInternalConversion, saveTryEmmaLead } from '../services/db';

const TryEmma: React.FC = () => {
  const [showChallenge, setShowChallenge] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: ''
  });

  const isFormValid = formData.name.trim() !== '' && formData.email.trim() !== '' && formData.whatsapp.trim() !== '';

  const handleStart = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    try {
      if (typeof window !== 'undefined') {
        if ((window as any).gtag) (window as any).gtag('event', 'start_try_emma', { event_category: 'engagement' });
        if ((window as any).fbq) (window as any).fbq('trackCustom', 'StartTryEmma');
      }
      recordInternalConversion('tryEmmaHomepage').catch(console.error);

      // Save lead (non-blocking)
      saveTryEmmaLead({
        name: formData.name.trim(),
        email: formData.email.trim(),
        whatsapp: formData.whatsapp.trim()
      }).catch(err => {
        console.error("No se pudo guardar el lead:", err);
      });

      setShowChallenge(true);
    } catch (e) {
      console.error("Error en tryEmma:", e);
      alert('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative font-display flex flex-col items-center justify-center">
      {/* Background Atmospheric Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[150vw] h-[150vw] md:w-[70vw] md:h-[70vw] rounded-full bg-blue-600/20 blur-[80px] md:blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[120vw] h-[120vw] md:w-[60vw] md:h-[60vw] rounded-full bg-purple-600/20 blur-[80px] md:blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }}></div>
        <div className="absolute top-[40%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[100vw] h-[100vw] md:w-[40vw] md:h-[40vw] rounded-full bg-indigo-500/10 blur-[60px] md:blur-[100px] mix-blend-screen"></div>
      </div>

      {/* Back button to return to main landing page */}
      {!showChallenge && (
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 z-50 size-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-colors"
        >
          <Icon name="arrow_back" />
        </button>
      )}

      <AnimatePresence mode="wait">
        {!showChallenge ? (
          <motion.div 
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto w-full pt-8"
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.8 }}
              className="mb-6 md:mb-10 mt-6"
            >
              <Logo className="h-20 md:h-28 lg:h-36 drop-shadow-2xl" />
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
            >
              Meet Emma.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="text-base md:text-xl text-slate-400 max-w-2xl mb-10 font-light leading-relaxed"
            >
              Tu compañera perfecta de conversación. Sin juicios, sin estrés. Completa tus datos para iniciar tu sesión gratis de 1 minuto.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
              
              <div className="space-y-5 text-left">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 ml-1">Nombre Completo</label>
                  <div className="relative">
                    <Icon name="person" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      className="w-full bg-black/50 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-light"
                      placeholder="Ej. Juan Pérez"
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 ml-1">WhatsApp</label>
                  <div className="relative">
                    <Icon name="phone" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="tel"
                      className="w-full bg-black/50 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-light"
                      placeholder="Ej. +503 7000 0000"
                      value={formData.whatsapp}
                      onChange={e => setFormData(p => ({ ...p, whatsapp: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 ml-1">Correo Electrónico</label>
                  <div className="relative">
                    <Icon name="email" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      className="w-full bg-black/50 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-light"
                      placeholder="tu@email.com"
                      value={formData.email}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleStart}
                    disabled={!isFormValid || isSubmitting}
                    className="group relative w-full inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-blue-600 disabled:bg-slate-800 disabled:text-slate-500 border border-transparent disabled:border-white/5 rounded-2xl hover:bg-blue-500 overflow-hidden"
                  >
                    {!isSubmitting && isFormValid && <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400/0 via-white/20 to-blue-400/0 group-hover:translate-x-full transition-transform duration-1000 -translate-x-full"></div>}
                    <span className="relative flex items-center gap-3">
                      {isSubmitting ? (
                        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Icon name="play_arrow" className="text-xl" />
                      )}
                      {isSubmitting ? 'Iniciando...' : 'Iniciar Prueba de 1 Minuto'}
                    </span>
                  </button>
                  <p className="mt-4 text-center text-xs text-slate-500 uppercase tracking-widest">Totalmente gratis. No requiere tarjeta.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div 
            key="challenge"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 w-full h-screen flex items-center justify-center"
          >
            <AISpeakingChallenge 
              isPromo={true} 
              duration={60} 
              studentName={formData.name || "Guest"} 
              onClose={() => setShowChallenge(false)} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close button if challenge is active but user wants to go back to landing */}
      {showChallenge && (
        <button 
          onClick={() => setShowChallenge(false)}
          className="absolute top-6 right-6 z-50 size-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-colors"
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
};

export default TryEmma;


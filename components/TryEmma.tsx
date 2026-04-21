import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import AISpeakingChallenge from './AISpeakingChallenge';

const TryEmma: React.FC = () => {
  const [showChallenge, setShowChallenge] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative font-display flex flex-col items-center justify-center">
      {/* Background Atmospheric Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-blue-600/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-600/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }}></div>
        <div className="absolute top-[40%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/10 blur-[100px] mix-blend-screen"></div>
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
            className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="mb-8 relative"
            >
              <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-30 rounded-full"></div>
              <div className="relative size-24 md:size-32 bg-gradient-to-br from-slate-800 to-black rounded-full border border-slate-700/50 flex items-center justify-center shadow-2xl">
                <Icon name="graphic_eq" className="text-4xl md:text-5xl text-blue-400" />
              </div>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
            >
              Meet Emma.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="text-lg md:text-2xl text-slate-400 max-w-2xl mb-12 font-light leading-relaxed"
            >
              Tu compañera perfecta de conversación. Sin juicios, sin estrés. Solo tú y una tutora nativa diseñada para llevar tu inglés al siguiente nivel.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
            >
              <button 
                onClick={() => setShowChallenge(true)}
                className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-transparent border border-white/20 rounded-full hover:bg-white/10 hover:border-white/40 overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="relative flex items-center gap-3">
                  <Icon name="play_arrow" className="text-xl" />
                  Iniciar Prueba de 1 Minuto
                </span>
              </button>
              <p className="mt-4 text-xs text-slate-500 uppercase tracking-widest">Totalmente gratis. No requiere tarjeta.</p>
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
              studentName="Guest" 
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

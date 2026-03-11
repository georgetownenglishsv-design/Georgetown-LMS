
import React, { useState } from 'react';
import { Logo } from './Logo';
import { Icon } from './Icon';
import { auth, firebase } from '../firebase';
import { AppUser } from '../types';
import { validateFirestoreCredential, getUserByEmail, syncCurrentUserToFirestore } from '../services/db';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { Link } = ReactRouterDOM as any;

interface LoginProps {
  onLogin: (profile: AppUser) => void;
}

// Optimized Base64 SVG Noise to avoid external network requests
const noiseDataUri = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E`;

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode>(''); // Allow JSX in error

  const handleSendReset = async () => {
      try {
          await auth.sendPasswordResetEmail(email);
          alert("Se ha enviado un enlace de restablecimiento a su correo. Por favor revise su bandeja de entrada (y spam).");
          setError('');
      } catch (e: any) {
          alert("Error al enviar correo: " + e.message);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Handle "Remember Me" logic
      await auth.setPersistence(
          rememberMe 
          ? firebase.auth.Auth.Persistence.LOCAL 
          : firebase.auth.Auth.Persistence.SESSION
      );
      
      // Standard login
      await auth.signInWithEmailAndPassword(email, password);
      
      const profile = await getUserByEmail(email);
      
      if (profile) {
          onLogin(profile);
          return;
      } 
      
      // Retry once if profile not found immediately (Race condition handler)
      await new Promise(r => setTimeout(r, 1000));
      const profileRetry = await getUserByEmail(email);
      
      if (profileRetry) {
          onLogin(profileRetry);
          return;
      } else {
          // Final fallback: try syncing from auth user
          const synced = await syncCurrentUserToFirestore(auth.currentUser);
          if (synced) {
              onLogin(synced);
              return;
          }
          throw new Error("Inicio de sesión exitoso, pero no se encontró el perfil de usuario.");
      }
      
    } catch (err: any) {
      console.error(err);

      // --- EMERGENCY FALLBACK LOGIN LOGIC ---
      try {
          const isValid = await validateFirestoreCredential(email, password);
          if (isValid) {
              const profile = await getUserByEmail(email);
              if (profile) {
                  try {
                      await auth.createUserWithEmailAndPassword(email, password);
                      onLogin(profile);
                      return; 
                  } catch (createErr: any) {
                      console.warn("Auth sync failed, forcing manual entry via Firestore credential.", createErr);
                      onLogin(profile);
                      return; 
                  }
              }
          }
      } catch (fallbackErr) {
          console.error("Fallback login failed", fallbackErr);
      }

      let msg = 'Ocurrió un error inesperado.';
      
      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          msg = 'Credenciales incorrectas. Verifique su correo y contraseña.';
          break;
        case 'auth/too-many-requests':
          msg = 'Demasiados intentos. Intente más tarde.';
          break;
        case 'auth/invalid-email':
            msg = 'Formato de correo inválido.';
            break;
        default:
          msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-center items-center overflow-hidden bg-[#111621] text-white selection:bg-primary selection:text-white font-display">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] rounded-full bg-primary/20 blur-[130px]"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-cyan-500/10 blur-[120px]"></div>
        <div 
          className="absolute inset-0 opacity-20 brightness-100 contrast-150" 
          style={{ backgroundImage: `url("${noiseDataUri}")` }}
        ></div>
      </div>

      <div className="flex flex-col w-full max-w-[960px] px-4 z-10 relative">
        <div className="flex flex-col items-center justify-center py-10 w-full min-h-[90vh]">
          {/* Logo Section (Clickable) */}
          <Link to="/" className="flex flex-col items-center justify-center mb-8 text-center gap-4 group cursor-pointer">
            <div className="w-24 h-24 sm:w-28 sm:h-28 relative mb-2 transition-transform duration-500 group-hover:scale-105" style={{ filter: 'drop-shadow(0 0 15px rgba(6, 182, 212, 0.2))' }}>
               <Logo className="w-full h-full object-contain" iconOnly={true} />
            </div>
            <div className="flex flex-col items-center">
              <h2 className="text-cyan-500 tracking-[0.2em] text-xs font-bold uppercase mb-1">Georgetown Academy</h2>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-300 drop-shadow-sm">
                GteaMgr
              </h1>
            </div>
          </Link>

          {/* Glass Card */}
          <div className="w-full max-w-[460px] flex flex-col rounded-2xl border border-white/5 overflow-hidden p-8 sm:p-10 transition-all duration-300 backdrop-blur-xl bg-[#161b26]/85 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
            
            <div className="mb-8 text-center">
              <h3 className="text-white text-xl sm:text-2xl font-bold leading-tight">
                Iniciar Sesión
              </h3>
              <p className="text-slate-400 text-sm font-normal mt-2">
                Acceso para administradores y docentes
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2 group">
                <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider ml-1">
                  ID
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-slate-500 z-10 group-focus-within:text-cyan-500 transition-colors duration-200">
                    <Icon name="person" className="text-[20px]" />
                  </span>
                  <input 
                    className="w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 border border-slate-700/50 bg-[#0f1218]/50 focus:border-cyan-500 h-12 placeholder:text-slate-600 pl-[48px] pr-[15px] text-base font-medium leading-normal transition-all hover:border-slate-600" 
                    placeholder="correo@ejemplo.com" 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 group">
                <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider ml-1">
                  Contraseña
                </label>
                <div className="relative flex w-full flex-1 items-stretch rounded-xl">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 z-10 group-focus-within:text-cyan-500 transition-colors duration-200">
                     <Icon name="lock" className="text-[20px]" />
                  </span>
                  <input 
                    className="w-full min-w-0 flex-1 resize-none overflow-hidden rounded-l-xl rounded-r-none text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:z-10 border border-slate-700/50 bg-[#0f1218]/50 focus:border-cyan-500 h-12 placeholder:text-slate-600 pl-[48px] pr-2 text-base font-medium leading-normal transition-all hover:border-slate-600" 
                    placeholder="••••••••" 
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <div 
                    className="flex items-center justify-center px-4 border border-l-0 border-slate-700/50 bg-[#0f1218]/50 rounded-r-xl cursor-pointer hover:bg-slate-800 transition-colors group/eye"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="text-slate-500 group-hover/eye:text-slate-300 transition-colors">
                      <Icon name={showPassword ? "visibility_off" : "visibility"} className="text-[20px]" />
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-xs text-center font-medium bg-red-500/10 py-3 rounded-lg border border-red-500/20 px-4 animate-in slide-in-from-top-1">
                  {error}
                </div>
              )}

              <div className="flex justify-between items-center mt-1">
                <div className="flex items-center gap-2">
                  <input 
                    className="rounded bg-slate-800 border-slate-700 text-primary focus:ring-offset-0 focus:ring-cyan-500/50 w-4 h-4 cursor-pointer" 
                    id="remember" 
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label className="text-slate-400 text-xs cursor-pointer select-none" htmlFor="remember">Recordarme</label>
                </div>
                <button 
                    type="button"
                    onClick={handleSendReset}
                    className="text-cyan-500 hover:text-cyan-300 text-xs font-medium transition-colors hover:underline"
                >
                    ¿Olvidó su contraseña?
                </button>
              </div>

              <button 
                disabled={loading}
                className="relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-5 bg-gradient-to-r from-primary to-blue-700 hover:to-blue-600 text-white text-sm font-bold uppercase tracking-wider shadow-[0_4px_20px_-4px_rgba(36,80,166,0.5)] hover:shadow-[0_8px_25px_-4px_rgba(6,182,212,0.4)] hover:-translate-y-0.5 transition-all duration-300 mt-4 group disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="relative z-10">
                    {loading ? (
                        <Icon name="sync" className="animate-spin text-xl" />
                    ) : (
                        'Iniciar Sesión'
                    )}
                </span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
            </form>
          </div>

          <div className="mt-8 text-center flex flex-col gap-4">
            <Link to="/" className="text-slate-400 hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                <Icon name="arrow_back" /> Volver a Inicio
            </Link>
            <p className="text-slate-600 text-xs font-normal mt-4">
              Todos los derechos reservados. ©2025 Georgetown Academy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

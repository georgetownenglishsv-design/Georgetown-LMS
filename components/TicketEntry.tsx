import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { validateTicket, startTicketSession, getMockTests } from '../services/mockTest';
import { MockTestTicket, MockTest } from '../types';

interface TicketEntryProps {
    onTicketVerified: (ticket: MockTestTicket, test: MockTest) => void;
}

export const TicketEntry: React.FC<TicketEntryProps> = ({ onTicketVerified }) => {
    const [ticketCode, setTicketCode] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'code' | 'details' | 'welcome'>('code');
    const [verifiedTicket, setVerifiedTicket] = useState<MockTestTicket | null>(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await validateTicket(ticketCode.trim().toUpperCase());
            
            if (!result.valid || !result.ticket) {
                setError(result.message || 'Código inválido');
                setLoading(false);
                return;
            }

            setVerifiedTicket(result.ticket);

            // If ticket has pre-filled data (New System)
            if (result.ticket.studentName) {
                setName(result.ticket.studentName);
                setPhone(result.ticket.studentPhone || '');
                setStep('welcome');
                setLoading(false);
                return;
            }

            // If ticket is already In-Progress, resume immediately
            if (result.ticket.status === 'In-Progress') {
                if (result.ticket.testId) {
                    // We need to fetch the test. For now, let's assume we can get it.
                    // In a real app, we might need a direct getMockTestById here or pass it down.
                    // For simplicity in this flow, we'll fetch available tests and find it.
                    const tests = await getMockTests();
                    const test = tests.find(t => t.id === result.ticket!.testId);
                    if (test) {
                        onTicketVerified(result.ticket, test);
                    } else {
                        setError('El examen asignado a este código no se encuentra disponible.');
                    }
                } else {
                     // Should not happen for In-Progress, but handle edge case
                     setError('Error crítico: El ticket está en progreso pero no tiene examen asignado.');
                }
            } else {
                // New ticket without pre-filled data (Old System), ask for details
                setStep('details');
            }
        } catch (err) {
            console.error(err);
            setError('Error de conexión. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleStartExam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!verifiedTicket) return;
        
        setLoading(true);
        try {
            // 1. Validate that ticket has a test assigned
            if (!verifiedTicket.testId) {
                setError('Este ticket no tiene un examen asignado. Contacte al administrador.');
                setLoading(false);
                return;
            }

            // 2. Fetch the assigned test to ensure it exists and is active
            const tests = await getMockTests();
            const assignedTest = tests.find(t => t.id === verifiedTicket.testId);

            if (!assignedTest) {
                setError('El examen asignado no está disponible.');
                setLoading(false);
                return;
            }

            if (assignedTest.status !== 'Active') {
                setError('El examen asignado no está activo actualmente.');
                setLoading(false);
                return;
            }

            // 3. Start Session
            await startTicketSession(verifiedTicket.id, name, phone, verifiedTicket.testId);
            
            // 4. Callback to parent
            onTicketVerified({
                ...verifiedTicket,
                status: 'In-Progress',
                studentName: name,
                studentPhone: phone,
                testId: verifiedTicket.testId
            }, assignedTest);

        } catch (err) {
            console.error(err);
            setError('Error al iniciar el examen.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f1218] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px]" />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl relative z-10"
            >
                <div className="text-center mb-8">
                    <div className="w-24 h-24 bg-white/5 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-primary/20 p-4">
                        <Logo className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
                        TOEIC Mock Test
                    </h1>
                    <p className="text-slate-400">
                        Georgetown English Academy
                    </p>
                </div>

                <div className="bg-[#1a1f2e] border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        {step === 'code' ? (
                            <motion.form 
                                key="code-form"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onSubmit={handleVerifyCode}
                                className="space-y-6 max-w-md mx-auto"
                            >
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Código de Acceso
                                    </label>
                                    <input 
                                        type="text" 
                                        value={ticketCode}
                                        onChange={e => setTicketCode(e.target.value)}
                                        placeholder="GT-MOCK-XXXX"
                                        className="w-full bg-[#0f1218] border border-slate-700 rounded-xl px-4 py-4 text-center text-xl font-mono font-bold text-white placeholder:text-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all uppercase"
                                        autoFocus
                                    />
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                                        {error}
                                    </div>
                                )}

                                <button 
                                    type="submit" 
                                    disabled={loading || !ticketCode}
                                    className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Verificar Código <Icon name="arrow_forward" />
                                        </>
                                    )}
                                </button>
                            </motion.form>
                        ) : step === 'welcome' ? (
                            <motion.div
                                key="welcome-screen"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                className="space-y-8"
                            >
                                <div className="text-center">
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold mb-4">
                                        <Icon name="verified" className="text-base" /> Código Verificado
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                                        ¡Bienvenido/a, <span className="text-primary">{name.split(' ')[0]}</span>! 👋
                                    </h2>
                                    <p className="text-slate-400 text-sm">Estás a punto de iniciar tu examen de simulación TOEIC.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-[#0f1218] p-5 rounded-2xl border border-slate-800 flex gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                                            <Icon name="timer" className="text-xl" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">Duración: 2 Horas</h3>
                                            <p className="text-xs text-slate-500 mt-1">El tiempo comenzará a correr automáticamente al iniciar. No hay pausas.</p>
                                        </div>
                                    </div>

                                    <div className="bg-[#0f1218] p-5 rounded-2xl border border-slate-800 flex gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                                            <Icon name="headphones" className="text-xl" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">Audio Requerido</h3>
                                            <p className="text-xs text-slate-500 mt-1">Asegúrate de usar audífonos. La sección de Listening es continua.</p>
                                        </div>
                                    </div>
                                    <div className="bg-[#0f1218] p-5 rounded-2xl border border-slate-800 flex gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                                            <Icon name="wifi_off" className="text-xl" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-sm">Desconexión Segura</h3>
                                            <p className="text-xs text-slate-500 mt-1">Si pierdes internet o cierras la pestaña, puedes volver a entrar. Tu avance se guarda, pero <span className="text-orange-400">el tiempo sigue corriendo</span>.</p>
                                        </div>
                                    </div>
                                    <div className="relative group overflow-hidden rounded-2xl p-[1px]">
                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 animate-gradient-xy opacity-70 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative bg-[#0f1218] p-5 rounded-[15px] h-full flex gap-4 items-start">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/20 animate-pulse">
                                                <Icon name="map" className="text-xl" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 text-sm flex items-center gap-2">
                                                    Mapa de Estrategia <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">NUEVO</span>
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                    Ubicado al <span className="text-white font-bold">final de la pantalla</span>. 
                                                    Las preguntas resueltas se marcan en <span className="text-emerald-400 font-bold">verde</span>. 
                                                    ¡Úsalo para saltar entre Partes (1-7) y dominar tu tiempo!
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* CRITICAL WARNING SECTION */}
                                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-4">
                                    <h3 className="text-red-400 font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                                        <Icon name="warning" /> Advertencias Críticas
                                    </h3>
                                    <ul className="space-y-3 text-sm text-slate-300">
                                        <li className="flex gap-3 items-start">
                                            <span className="text-red-500 mt-0.5">•</span>
                                            <span>
                                                <strong className="text-white">El tiempo NO se detiene:</strong> Una vez iniciado, el cronómetro del servidor corre sin pausa. Si cierras la ventana o pierdes conexión, el tiempo sigue corriendo.
                                            </span>
                                        </li>
                                        <li className="flex gap-3 items-start">
                                            <span className="text-red-500 mt-0.5">•</span>
                                            <span>
                                                <strong className="text-white">Prohibido recargar:</strong> Si recargas durante el Listening, el audio se reiniciará pero tu tiempo NO. Perderás la sincronización.
                                            </span>
                                        </li>
                                        <li className="flex gap-3 items-start">
                                            <span className="text-red-500 mt-0.5">•</span>
                                            <span>
                                                <strong className="text-white">Una sola sesión:</strong> Debes completar el examen en una sola sesión continua. No puedes pausar y volver más tarde.
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="pt-4 border-t border-slate-800 space-y-4">
                                    <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                                        <div className="relative flex items-center">
                                            <input 
                                                type="checkbox" 
                                                className="peer sr-only"
                                                checked={acceptedTerms}
                                                onChange={e => setAcceptedTerms(e.target.checked)}
                                            />
                                            <div className="w-5 h-5 border-2 border-slate-500 rounded peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                                            <Icon name="check" className="absolute text-white text-xs opacity-0 peer-checked:opacity-100 top-0.5 left-0.5 pointer-events-none" />
                                        </div>
                                        <span className="text-sm text-slate-400 group-hover:text-slate-300 select-none">
                                            Entiendo que el tiempo no se detiene y debo completar el examen en una sola sesión continua.
                                        </span>
                                    </label>

                                    <button 
                                        onClick={handleStartExam}
                                        disabled={loading || !acceptedTerms}
                                        className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
                                    >
                                        {loading ? (
                                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Icon name="play_circle" className="text-2xl" /> COMENZAR AHORA
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.form 
                                key="details-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (name && phone) {
                                        setStep('welcome');
                                    }
                                }}
                                className="space-y-5 max-w-md mx-auto"
                            >
                                <div className="text-center mb-6">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold">
                                        <Icon name="check_circle" className="text-sm" /> Código Verificado
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Nombre Completo
                                    </label>
                                    <input 
                                        type="text" 
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Tu nombre"
                                        className="w-full bg-[#0f1218] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Teléfono / WhatsApp
                                    </label>
                                    <input 
                                        type="tel" 
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="Para enviarte resultados"
                                        className="w-full bg-[#0f1218] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                                        {error}
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button 
                                        type="submit" 
                                        disabled={loading || !name || !phone}
                                        className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Icon name="play_circle" className="text-xl" /> Comenzar Examen
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setStep('code')}
                                        className="w-full mt-3 py-2 text-slate-500 text-sm hover:text-white transition-colors"
                                    >
                                        Volver
                                    </button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
                
                <p className="text-center text-slate-600 text-xs mt-8">
                    &copy; {new Date().getFullYear()} Georgetown English Academy. All rights reserved.
                </p>
            </motion.div>
        </div>
    );
};

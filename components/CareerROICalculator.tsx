
import React, { useState } from 'react';
import { Icon } from './Icon';
import { GoogleGenAI } from "@google/genai";
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { Link } = ReactRouterDOM as any;

interface CareerROICalculatorProps {
    isOpen: boolean;
    onClose: () => void;
}

const CareerROICalculator: React.FC<CareerROICalculatorProps> = ({ isOpen, onClose }) => {
    const [role, setRole] = useState('');
    const [currentLevel, setCurrentLevel] = useState('A1');
    const [targetLevel, setTargetLevel] = useState('B2');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ increase: string, message: string } | null>(null);

    // Reset state when closed, or keep it? Keeping it allows user to check back.
    
    if (!isOpen) return null;

    const roles = [
        "Desarrollador de Software", "Marketing Digital", "Atención al Cliente (Call Center)",
        "Ventas / Ejecutivo Comercial", "Administración / RRHH", "Ingeniero Industrial", 
        "Estudiante Universitario", "Freelancer / Asistente Virtual"
    ];

    const calculateROI = async () => {
        if (!role) {
            alert("Por favor selecciona tu área profesional.");
            return;
        }

        setLoading(true);
        try {
            const ai = new GoogleGenAI({ 
                apiKey: "proxy-key",
                httpOptions: { 
                    baseUrl: `${window.location.protocol}//${window.location.host}/api/gemini`
                }
            });
            // Modified prompt to ensure Spanish response
            const prompt = `Actúa como consultor de carreras experto para El Salvador y Latinoamérica.
            El usuario es un "${role}" con nivel de inglés actual "${currentLevel}" buscando llegar a "${targetLevel}".
            Estima el aumento salarial mensual potencial (en USD) realista para este mercado.
            Proporciona una frase motivacional corta y persuasiva en ESPAÑOL.
            Output JSON: { "increase": "$XXX - $YYY", "message": "Frase motivacional en Español." }`;

            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            
            const text = response.text;
            if (text) {
                const json = JSON.parse(text);
                setResult(json);
                
                if (typeof window !== 'undefined') {
                    if ((window as any).gtag) (window as any).gtag('event', 'calculate_roi', { event_category: 'engagement', role: role });
                    if ((window as any).fbq) (window as any).fbq('trackCustom', 'CalculateROI', { role: role });
                }
            }
        } catch (e) {
            setResult({
                increase: "30% - 50%",
                message: "El dominio del inglés es la habilidad más valorada para potenciar tu carrera globalmente."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            
            {/* Modal Content */}
            <div className="relative w-full max-w-lg bg-[#111418] rounded-3xl border border-gold/20 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gold/20 rounded-lg text-gold">
                            <Icon name="trending_up" />
                        </div>
                        <h2 className="text-lg font-black text-white">Calculadora ROI</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <Icon name="close" className="text-2xl" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    {!result ? (
                        <div className="space-y-5">
                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-black text-white mb-2">¿Cuánto vale tu inglés?</h3>
                                <p className="text-slate-400 text-sm">Descubre el impacto financiero real de dominar el idioma en tu carrera.</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Profesión / Rol</label>
                                    <select 
                                        value={role} 
                                        onChange={(e) => setRole(e.target.value)} 
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-gold outline-none transition-colors"
                                    >
                                        <option value="" className="text-black">Selecciona tu área...</option>
                                        {roles.map(r => <option key={r} value={r} className="text-black">{r}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nivel Actual</label>
                                        <select value={currentLevel} onChange={e => setCurrentLevel(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-gold outline-none">
                                            {['A1','A2','B1'].map(l => <option key={l} value={l} className="text-black">{l}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gold uppercase mb-1.5">Nivel Meta</label>
                                        <select value={targetLevel} onChange={e => setTargetLevel(e.target.value)} className="w-full bg-white/5 border border-gold/50 rounded-xl px-4 py-3 text-white text-sm focus:border-gold outline-none">
                                            {/* Updated: Starts from A2 as requested */}
                                            {['A2','B1','B2','C1','C2'].map(l => <option key={l} value={l} className="text-black">{l}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={calculateROI}
                                disabled={loading}
                                className="w-full mt-4 py-4 bg-gradient-to-r from-gold to-amber-600 hover:to-amber-500 text-white rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {loading ? <Icon name="sync" className="animate-spin" /> : <Icon name="calculate" />}
                                {loading ? 'Analizando Mercado...' : 'Calcular Aumento'}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center animate-in slide-in-from-bottom-4 duration-500">
                            <div className="size-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                                <Icon name="payments" className="text-4xl text-green-400" />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Aumento Salarial Estimado</p>
                            <h3 className="text-4xl font-black text-white mb-1">{result.increase}</h3>
                            <p className="text-xs text-green-400 font-bold mb-6">Mensuales Adicionales</p>
                            
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-6">
                                <p className="text-sm text-slate-300 italic">"{result.message}"</p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Link 
                                    to="/courses" 
                                    onClick={onClose}
                                    className="w-full py-3 bg-white text-black hover:bg-slate-200 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    Ver Cursos para {targetLevel} <Icon name="arrow_forward" />
                                </Link>
                                <button 
                                    onClick={() => setResult(null)} 
                                    className="text-xs font-bold text-slate-500 hover:text-white transition-colors"
                                >
                                    Recalcular
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CareerROICalculator;

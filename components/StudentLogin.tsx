
import React, { useState, useEffect } from 'react';
// Fix: Use namespace import
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate, Link } = ReactRouterDOM as any;
import { Icon } from './Icon';
import { Logo } from './Logo';
import { authenticateStudent } from '../services/db';
import { auth } from '../firebase'; // Import auth

const StudentLogin: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // --- EFFECT: Ensure Anonymous Auth for DB Access ---
    useEffect(() => {
        const ensureAuth = async () => {
            // Check if already authenticated (either anonymously or otherwise)
            if (!auth.currentUser) {
                try {
                    await auth.signInAnonymously();
                    console.log("Anonymous auth established for public access.");
                } catch (e) {
                    console.error("Failed to establish anonymous auth", e);
                    setError("Error de conexión con el sistema.");
                }
            }
        };
        ensureAuth();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Double check auth before query
            if (!auth.currentUser) {
                await auth.signInAnonymously();
            }

            const result = await authenticateStudent(email, lastName);
            
            if (result) {
                // Save session info
                localStorage.setItem('studentId', result.student.id);
                localStorage.setItem('studentToken', result.token);
                
                navigate('/student/dashboard');
            } else {
                setError('Credenciales inválidas. Verifique su correo y apellidos (o contacte a administración).');
            }
        } catch (e) {
            console.error(e);
            setError('Error de conexión. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f7f8] flex flex-col justify-center items-center px-4 font-display">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden p-8">
                <div className="flex justify-center mb-6">
                    <Link to="/" className="w-24 h-auto">
                        <Logo className="w-full h-full" iconOnly={true} />
                    </Link>
                </div>
                
                <h2 className="text-2xl font-black text-slate-900 text-center mb-2">Portal Estudiantil</h2>
                <p className="text-sm text-slate-500 text-center mb-8">Ingresa para acceder a tus clases en vivo.</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Correo Electrónico</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Icon name="mail" />
                            </div>
                            <input 
                                required
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium text-slate-900"
                                placeholder="ejemplo@correo.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Apellidos</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Icon name="badge" />
                            </div>
                            <input 
                                required
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium text-slate-900"
                                placeholder="Tus apellidos registrados"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                            <Icon name="error" className="text-lg" />
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-4 bg-primary hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Icon name="sync" className="animate-spin text-xl" /> : 'Ingresar al Aula'}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <Link to="/" className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                        Volver al Inicio
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default StudentLogin;

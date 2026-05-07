import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { getTryEmmaLeads, updateTryEmmaLead, deleteTryEmmaLead } from '../services/db';
import { TryEmmaLead } from '../types';

const TryEmmaAdmin: React.FC = () => {
    const [leads, setLeads] = useState<TryEmmaLead[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getTryEmmaLeads();
            setLeads(data);
        } catch (error) {
            console.error("Error fetching leads:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsAppContact = (phone: string, name: string) => {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const msg = `¡Hola ${name}! 🌟 Qué gusto saludarte.\n\nSoy de *Georgetown Academy* 🎓✨. Vimos que estuviste probando nuestra experiencia interactiva con nuestra tutora de Inteligencia Artificial, *Emma* 🤖💬.\n\n¿Qué te pareció probar un pedacito del futuro del aprendizaje? 🚀\n\nMe encantaría compartir contigo cómo nuestra metodología combina tecnología de punta y enseñanza premium 💎 para llevar tu inglés a otro nivel. ¿Tienes un minuto para platicar? 👇`;
        window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
    };

    const toggleContactStatus = async (id: string, currentStatus: boolean | undefined) => {
        const newStatus = !currentStatus;
        try {
            await updateTryEmmaLead(id, { hasContacted: newStatus });
            setLeads(prev => prev.map(r => r.id === id ? { ...r, hasContacted: newStatus } : r));
        } catch (e) {
            alert("Error al actualizar estado.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este lead?')) return;
        try {
            await deleteTryEmmaLead(id);
            setLeads(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            alert("Error al eliminar.");
        }
    };

    // Calculate pagination
    const totalPages = Math.ceil(leads.length / itemsPerPage);
    const currentLeads = leads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto font-display">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        <Icon name="record_voice_over" className="text-4xl text-blue-600" />
                        Try Emma Leads
                    </h1>
                    <p className="text-slate-500 mt-2 text-lg">Usuarios de prueba con IA generativa desde el Landing Page.</p>
                </div>
                <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 flex gap-6">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Leads</p>
                        <p className="text-2xl font-black text-blue-600">{leads.length}</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="bg-white rounded-3xl p-12 text-center shadow-xl border border-slate-100 flex flex-col items-center justify-center min-h-[400px]">
                     <div className="size-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                     <p className="text-slate-500 font-medium">Cargando leads...</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estudiante</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contacto</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-500 italic">No hay leads registrados aún.</td>
                                    </tr>
                                ) : currentLeads.map((r, i) => (
                                    <tr key={r.id || i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 text-sm text-slate-500">
                                            {r.createdAt ? new Date(r.createdAt.toDate ? r.createdAt.toDate() : r.createdAt).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="p-4">
                                            <p className="font-bold text-slate-900">{r.name}</p>
                                        </td>
                                        <td className="p-4">
                                            <p className="text-sm font-medium text-slate-700">{r.whatsapp}</p>
                                            <p className="text-xs text-slate-500">{r.email}</p>
                                        </td>
                                        <td className="p-4">
                                            <button 
                                                onClick={() => toggleContactStatus(r.id!, r.hasContacted)}
                                                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                                                    r.hasContacted 
                                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                                                    : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                                                }`}
                                            >
                                                {r.hasContacted ? 'Contactado' : 'Nuevo'}
                                            </button>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleWhatsAppContact(r.whatsapp, r.name)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#25D366] text-white hover:bg-[#128C7E] rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95"
                                                    title="Contactar por WhatsApp"
                                                >
                                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                                                    </svg>
                                                    WhatsApp
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(r.id!)}
                                                    className="size-10 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl flex items-center justify-center transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Icon name="delete" className="text-lg" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <span className="text-sm text-slate-500">
                                Mostrando {Math.min(itemsPerPage, leads.length - (currentPage - 1) * itemsPerPage)} de {leads.length}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-50 transition-all text-slate-600"
                                >
                                    <Icon name="chevron_left" />
                                </button>
                                <span className="p-2 px-4 text-sm font-bold text-slate-700">{currentPage} / {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-50 transition-all text-slate-600"
                                >
                                    <Icon name="chevron_right" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TryEmmaAdmin;

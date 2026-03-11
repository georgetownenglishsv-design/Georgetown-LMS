
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { getWebLandingConfig, saveWebLandingConfig } from '../services/db';
import { WebLandingConfig, WebLandingSlide } from '../types';

const WebLandingManager: React.FC = () => {
    const [config, setConfig] = useState<WebLandingConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSlide, setEditingSlide] = useState<WebLandingSlide | null>(null);
    const [formData, setFormData] = useState<WebLandingSlide>({
        id: '',
        imageUrl: '',
        title: '',
        subtitle: '',
        buttonText: 'Más Información',
        link: '/courses',
        order: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await getWebLandingConfig();
        // Sort slides by order
        if(data.slides) {
            data.slides.sort((a, b) => a.order - b.order);
        }
        setConfig(data);
        setLoading(false);
    };

    const handleCreate = () => {
        setEditingSlide(null);
        setFormData({
            id: Date.now().toString(),
            imageUrl: '',
            title: '',
            subtitle: '',
            buttonText: 'Ver Cursos',
            link: '/courses',
            order: (config?.slides.length || 0) + 1
        });
        setIsModalOpen(true);
    };

    const handleEdit = (slide: WebLandingSlide) => {
        setEditingSlide(slide);
        setFormData(slide);
        setIsModalOpen(true);
    };

    const handleDelete = async (slideId: string) => {
        if(!config) return;
        if(!confirm("¿Eliminar este slide?")) return;
        
        const newSlides = config.slides.filter(s => s.id !== slideId);
        const newConfig = { ...config, slides: newSlides };
        
        setSaving(true);
        await saveWebLandingConfig(newConfig);
        setConfig(newConfig);
        setSaving(false);
    };

    const handleSaveSlide = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!config) return;

        setSaving(true);
        let newSlides = [...config.slides];

        if (editingSlide) {
            newSlides = newSlides.map(s => s.id === editingSlide.id ? formData : s);
        } else {
            newSlides.push(formData);
        }

        // Sort just in case
        newSlides.sort((a, b) => a.order - b.order);

        const newConfig = { ...config, slides: newSlides };
        await saveWebLandingConfig(newConfig);
        setConfig(newConfig);
        setSaving(false);
        setIsModalOpen(false);
    };

    if (loading) return <div className="p-10 text-center"><Icon name="sync" className="animate-spin text-2xl"/></div>;

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">Gestión Web Inicio</h1>
                    <p className="text-sm text-slate-500">Configura el carrusel principal de la página de aterrizaje.</p>
                </div>
                <button onClick={handleCreate} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-bold text-sm shadow flex items-center gap-2">
                    <Icon name="add_photo_alternate" /> Nuevo Slide
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Slides Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                        {config?.slides.map((slide, idx) => (
                            <div key={slide.id} className="group relative bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                <div className="aspect-video bg-slate-100 relative">
                                    <img src={slide.imageUrl} alt="Slide Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex items-end p-4">
                                        <div className="text-white">
                                            <p className="font-bold text-lg leading-tight drop-shadow-md">{slide.title}</p>
                                            <p className="text-xs opacity-90 line-clamp-1">{slide.subtitle}</p>
                                        </div>
                                    </div>
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="bg-black/50 text-white text-[10px] px-2 py-1 rounded">#{slide.order}</span>
                                    </div>
                                </div>
                                <div className="p-4 flex justify-between items-center">
                                    <div className="text-xs text-slate-500 truncate max-w-[200px]">
                                        Link: <span className="font-mono text-primary">{slide.link}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(slide)} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"><Icon name="edit" /></button>
                                        <button onClick={() => handleDelete(slide.id)} className="p-2 text-slate-600 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Icon name="delete" /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {config?.slides.length === 0 && (
                        <div className="py-20 text-center text-slate-400 italic">No hay slides configurados. Se mostrará el predeterminado.</div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-xl p-6 overflow-y-auto max-h-[90vh]">
                        <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white border-b pb-2">{editingSlide ? 'Editar Slide' : 'Nuevo Slide'}</h3>
                        <form onSubmit={handleSaveSlide} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Imagen URL (o Video MP4)</label>
                                <input required className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} placeholder="https://..." />
                                <p className="text-[10px] text-slate-400 mt-1">Soporta imágenes (JPG, PNG) y videos directos (MP4, WEBM).</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título Principal</label>
                                <input required className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subtítulo</label>
                                <textarea rows={2} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={formData.subtitle} onChange={e => setFormData({...formData, subtitle: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Texto Botón</label>
                                    <input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={formData.buttonText} onChange={e => setFormData({...formData, buttonText: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Enlace Botón</label>
                                    <input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Orden Visual</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={formData.order} onChange={e => setFormData({...formData, order: Number(e.target.value)})} />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" disabled={saving} className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm shadow flex items-center gap-2">
                                    <Icon name="save" /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
};

export default WebLandingManager;


import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { getCourses, getExams, getWebStoreConfig, saveWebStoreConfig } from '../services/db';
import { Course, Exam, WebStoreConfig } from '../types';

const WebStoreManager: React.FC = () => {
    const [config, setConfig] = useState<WebStoreConfig | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'hero' | 'featured' | 'bottom'>('hero');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const [cData, eData, cfgData] = await Promise.all([
                getCourses(),
                getExams(),
                getWebStoreConfig()
            ]);
            setCourses(cData);
            setExams(eData);
            setConfig(cfgData);
            setLoading(false);
        };
        loadData();
    }, []);

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        try {
            await saveWebStoreConfig(config);
            alert("Tienda actualizada correctamente.");
        } catch (e) {
            alert("Error al guardar.");
        } finally {
            setSaving(false);
        }
    };

    if (loading || !config) return <div className="p-10 text-center"><Icon name="sync" className="animate-spin text-2xl"/></div>;

    // Helper options for dropdown
    const allItems = [
        ...courses.map(c => ({ id: c.id, name: `[CURSO] ${c.name}`, type: 'course' as const })),
        ...exams.map(e => ({ id: e.id, name: `[EXAMEN] ${e.name}`, type: 'exam' as const }))
    ];

    return (
        <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">Gestión Destacados y Tienda</h1>
                    <p className="text-sm text-slate-500">Configure los cursos destacados que aparecen en el Inicio (Landing) y en la Tienda.</p>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-70"
                >
                    <Icon name={saving ? "sync" : "save"} className={saving ? "animate-spin" : ""} />
                    {saving ? "Guardando..." : "Publicar Cambios"}
                </button>
            </header>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Tabs */}
                <div className="w-full md:w-64 bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 flex flex-row md:flex-col overflow-x-auto md:overflow-visible shrink-0">
                    <button onClick={() => setActiveTab('hero')} className={`p-4 text-left font-bold text-sm border-b md:border-b-0 md:border-l-4 transition-all whitespace-nowrap ${activeTab === 'hero' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                        Banner Principal
                    </button>
                    <button onClick={() => setActiveTab('featured')} className={`p-4 text-left font-bold text-sm border-b md:border-b-0 md:border-l-4 transition-all whitespace-nowrap ${activeTab === 'featured' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                        Programas Destacados
                    </button>
                    <button onClick={() => setActiveTab('bottom')} className={`p-4 text-left font-bold text-sm border-b md:border-b-0 md:border-l-4 transition-all whitespace-nowrap ${activeTab === 'bottom' ? 'border-primary bg-primary/5 text-primary' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
                        Banner Inferior
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-black/10">
                    <div className="max-w-3xl mx-auto space-y-6">
                        
                        {activeTab === 'hero' && (
                            <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Configuración del Banner Principal (Tienda)</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título Grande</label>
                                        <input 
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                                            value={config.hero.title}
                                            onChange={e => setConfig({...config, hero: {...config.hero, title: e.target.value}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subtítulo / Oferta</label>
                                        <input 
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                                            value={config.hero.subtitle}
                                            onChange={e => setConfig({...config, hero: {...config.hero, subtitle: e.target.value}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Acción del Botón (Comprar Ahora)</label>
                                        <select 
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                                            value={config.hero.linkedItemId}
                                            onChange={e => {
                                                const selected = allItems.find(i => i.id === e.target.value);
                                                if (selected) {
                                                    setConfig({...config, hero: {...config.hero, linkedItemId: selected.id, linkedItemType: selected.type}});
                                                }
                                            }}
                                        >
                                            <option value="">-- Seleccionar Producto --</option>
                                            {allItems.map(item => (
                                                <option key={item.id} value={item.id}>{item.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </section>
                        )}

                        {activeTab === 'featured' && (
                            <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Programas Destacados (Landing & Tienda)</h3>
                                    <p className="text-xs text-slate-500 mt-1">Estos 4 elementos se mostrarán en la página de inicio (Landing) y en la sección destacada de la tienda.</p>
                                </div>
                                <div className="space-y-4">
                                    {[1, 2, 3, 4].map(num => {
                                        const slotKey = `slot${num}` as keyof typeof config.featured;
                                        const currentSlot = config.featured[slotKey];
                                        
                                        return (
                                            <div key={num} className="p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-slate-700">
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Posición #{num}</label>
                                                <select 
                                                    className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-600 rounded-lg p-2 text-sm dark:text-white"
                                                    value={currentSlot.itemId}
                                                    onChange={e => {
                                                        const selected = allItems.find(i => i.id === e.target.value);
                                                        if (selected) {
                                                            setConfig({
                                                                ...config, 
                                                                featured: {
                                                                    ...config.featured,
                                                                    [slotKey]: { itemId: selected.id, itemType: selected.type }
                                                                }
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <option value="">-- Seleccionar --</option>
                                                    {allItems.map(item => (
                                                        <option key={item.id} value={item.id}>{item.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {activeTab === 'bottom' && (
                            <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Banner Inferior (Clases Privadas)</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                                        <input 
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                                            value={config.privateClass.title}
                                            onChange={e => setConfig({...config, privateClass: {...config.privateClass, title: e.target.value}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
                                        <input 
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                                            value={config.privateClass.description}
                                            onChange={e => setConfig({...config, privateClass: {...config.privateClass, description: e.target.value}})}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Precio ($)</label>
                                            <input 
                                                type="number"
                                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                                                value={config.privateClass.price}
                                                onChange={e => setConfig({...config, privateClass: {...config.privateClass, price: Number(e.target.value)}})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Enlace de Compra</label>
                                            <select 
                                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                                                value={config.privateClass.linkedItemId}
                                                onChange={e => {
                                                    const selected = allItems.find(i => i.id === e.target.value);
                                                    if (selected) {
                                                        setConfig({...config, privateClass: {...config.privateClass, linkedItemId: selected.id, linkedItemType: selected.type}});
                                                    }
                                                }}
                                            >
                                                <option value="">-- Seleccionar --</option>
                                                {allItems.map(item => (
                                                    <option key={item.id} value={item.id}>{item.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                    </div>
                </div>
            </div>
        </main>
    );
};

export default WebStoreManager;

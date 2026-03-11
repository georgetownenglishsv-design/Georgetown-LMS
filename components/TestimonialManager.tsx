
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Testimonial, Category } from '../types';
import { getTestimonials, addTestimonial, updateTestimonial, deleteTestimonial, getCategories } from '../services/db';

const TestimonialManager: React.FC = () => {
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('all');

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Testimonial | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        role: '',
        text: '',
        avatarUrl: '',
        category: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [tData, cData] = await Promise.all([getTestimonials(), getCategories()]);
        setTestimonials(tData);
        setCategories(cData);
        setLoading(false);
    };

    const handleEdit = (item: Testimonial) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            role: item.role,
            text: item.text,
            avatarUrl: item.avatarUrl || '',
            category: item.category
        });
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingItem(null);
        setFormData({
            name: '',
            role: 'Estudiante',
            text: '',
            avatarUrl: '',
            category: categories.length > 0 ? categories[0].shortCode : ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if(!confirm("¿Eliminar este testimonio?")) return;
        await deleteTestimonial(id);
        fetchData();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await updateTestimonial(editingItem.id, formData);
            } else {
                await addTestimonial(formData);
            }
            setIsModalOpen(false);
            fetchData();
        } catch(e) {
            alert("Error al guardar.");
        }
    };

    const filteredList = filterCategory === 'all' 
        ? testimonials 
        : testimonials.filter(t => t.category === filterCategory);

    if (loading) return <div className="p-10 text-center"><Icon name="sync" className="animate-spin text-2xl"/></div>;

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">Testimonios</h1>
                    <p className="text-sm text-slate-500 dark:text-text-secondary">Administra las reseñas de estudiantes por categoría.</p>
                </div>
                <button onClick={handleCreate} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-bold text-sm shadow flex items-center gap-2">
                    <Icon name="add" /> Nuevo
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Filter */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <button 
                            onClick={() => setFilterCategory('all')}
                            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border ${filterCategory === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-700'}`}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button 
                                key={cat.id}
                                onClick={() => setFilterCategory(cat.shortCode)}
                                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border ${filterCategory === cat.shortCode ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-slate-700'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredList.map(item => (
                            <div key={item.id} className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative group">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(item)} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-white hover:text-primary"><Icon name="edit" /></button>
                                    <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-white hover:text-red-500"><Icon name="delete" /></button>
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    {item.avatarUrl ? (
                                        <img src={item.avatarUrl} alt={item.name} className="w-12 h-12 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">{item.name.substring(0,2)}</div>
                                    )}
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{item.name}</h3>
                                        <p className="text-xs text-slate-500">{item.role}</p>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 italic line-clamp-3">"{item.text}"</p>
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">{item.category}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredList.length === 0 && <div className="text-center py-20 text-slate-400 italic">No hay testimonios en esta categoría.</div>}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-6">
                        <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">{editingItem ? 'Editar Testimonio' : 'Nuevo Testimonio'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                                <select 
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white"
                                    value={formData.category}
                                    onChange={e => setFormData({...formData, category: e.target.value})}
                                >
                                    {categories.map(c => <option key={c.id} value={c.shortCode}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                                    <input required className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ocupación / Rol</label>
                                    <input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comentario</label>
                                <textarea required rows={3} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Avatar URL (Opcional)</label>
                                <input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={formData.avatarUrl} onChange={e => setFormData({...formData, avatarUrl: e.target.value})} placeholder="https://..." />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 text-sm font-bold">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
};

export default TestimonialManager;

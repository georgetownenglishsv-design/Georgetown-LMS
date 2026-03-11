
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { GlobalFAQ, Category } from '../types';
import { getFAQs, addFAQ, updateFAQ, deleteFAQ, getCategories } from '../services/db';

const FAQManager: React.FC = () => {
    const [faqs, setFaqs] = useState<GlobalFAQ[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('all');

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<GlobalFAQ | null>(null);
    const [formData, setFormData] = useState({
        question: '',
        answer: '',
        category: '',
        order: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [fData, cData] = await Promise.all([getFAQs(), getCategories()]);
        setFaqs(fData);
        setCategories(cData);
        setLoading(false);
    };

    const handleEdit = (item: GlobalFAQ) => {
        setEditingItem(item);
        setFormData({
            question: item.question,
            answer: item.answer,
            category: item.category,
            order: item.order
        });
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingItem(null);
        setFormData({
            question: '',
            answer: '',
            category: categories.length > 0 ? categories[0].shortCode : '',
            order: faqs.length + 1
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if(!confirm("¿Eliminar esta pregunta?")) return;
        await deleteFAQ(id);
        fetchData();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                order: Number(formData.order)
            };
            if (editingItem) {
                await updateFAQ(editingItem.id, payload);
            } else {
                await addFAQ(payload);
            }
            setIsModalOpen(false);
            fetchData();
        } catch(e) {
            alert("Error al guardar.");
        }
    };

    const filteredList = filterCategory === 'all' 
        ? faqs 
        : faqs.filter(f => f.category === filterCategory).sort((a,b) => a.order - b.order);

    if (loading) return <div className="p-10 text-center"><Icon name="sync" className="animate-spin text-2xl"/></div>;

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">Preguntas Frecuentes (FAQ)</h1>
                    <p className="text-sm text-slate-500 dark:text-text-secondary">Administra las preguntas por categoría. Se mostrarán automáticamente en los cursos.</p>
                </div>
                <button onClick={handleCreate} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-bold text-sm shadow flex items-center gap-2">
                    <Icon name="add" /> Nueva Pregunta
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="max-w-5xl mx-auto space-y-6">
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

                    {/* List */}
                    <div className="space-y-3">
                        {filteredList.map(item => (
                            <div key={item.id} className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-4 items-start group">
                                <div className="flex flex-col items-center gap-1 min-w-[3rem]">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Orden</span>
                                    <span className="text-lg font-black text-slate-900 dark:text-white">{item.order}</span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">{item.category}</span>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{item.question}</h3>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.answer}</p>
                                </div>
                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(item)} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-white hover:text-primary"><Icon name="edit" /></button>
                                    <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-white hover:text-red-500"><Icon name="delete" /></button>
                                </div>
                            </div>
                        ))}
                        {filteredList.length === 0 && <div className="text-center py-20 text-slate-400 italic">No hay preguntas registradas.</div>}
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-6">
                        <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">{editingItem ? 'Editar Pregunta' : 'Nueva Pregunta'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
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
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Orden</label>
                                    <input type="number" required className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={formData.order} onChange={e => setFormData({...formData, order: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pregunta</label>
                                <input required className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={formData.question} onChange={e => setFormData({...formData, question: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Respuesta</label>
                                <textarea required rows={4} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={formData.answer} onChange={e => setFormData({...formData, answer: e.target.value})} />
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

export default FAQManager;

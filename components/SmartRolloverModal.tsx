import React, { useState } from 'react';
import { Icon } from './Icon';
import { Course } from '../types';
import { batchRolloverCourses } from '../services/db';

interface SmartRolloverModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeCourses: Course[];
    onSuccess: () => void;
}

const SmartRolloverModal: React.FC<SmartRolloverModalProps> = ({ isOpen, onClose, activeCourses, onSuccess }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set(activeCourses.map(c => c.id)));
    const [processing, setProcessing] = useState(false);

    if (!isOpen) return null;

    const toggleCourse = (id: string) => {
        const newSet = new Set(selectedCourseIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedCourseIds(newSet);
    };

    const toggleAll = () => {
        if (selectedCourseIds.size === activeCourses.length) {
            setSelectedCourseIds(new Set());
        } else {
            setSelectedCourseIds(new Set(activeCourses.map(c => c.id)));
        }
    };

    const handleExecute = async () => {
        if (!startDate || !endDate) {
            alert("Por favor seleccione las fechas de inicio y fin para el próximo ciclo.");
            return;
        }
        if (selectedCourseIds.size === 0) {
            alert("Seleccione al menos un curso para duplicar.");
            return;
        }

        if (!confirm(`¿Generar ${selectedCourseIds.size} cursos en estado 'Draft' (Borrador)?`)) return;

        setProcessing(true);
        try {
            await batchRolloverCourses(startDate, endDate, Array.from(selectedCourseIds));
            alert("Cursos generados exitosamente. Ahora puede editarlos en la pestaña 'Preparación (Draft)'.");
            onSuccess();
            onClose();
        } catch (e: any) {
            console.error(e);
            alert(`Error al generar cursos: ${e.message}`);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl ring-1 ring-white/10 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a2230] flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Icon name="content_copy" className="text-primary" />
                            Preparar Próximo Mes
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-text-secondary">Duplica cursos activos como borradores para la siguiente convocatoria.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><Icon name="close" /></button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    
                    {/* Date Config */}
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl">
                        <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-3 uppercase tracking-wide">Configuración de Fechas (Nuevo Ciclo)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Fecha Inicio</label>
                                <input 
                                    type="date" 
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/20 px-3 py-2 text-sm font-bold dark:text-white"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Fecha Fin</label>
                                <input 
                                    type="date" 
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-black/20 px-3 py-2 text-sm font-bold dark:text-white"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Selection List */}
                    <div>
                        <div className="flex justify-between items-center mb-2 px-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Seleccionar Cursos a Duplicar</h4>
                            <button onClick={toggleAll} className="text-xs font-bold text-primary hover:underline">
                                {selectedCourseIds.size === activeCourses.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                            </button>
                        </div>
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                            {activeCourses.map(course => (
                                <div 
                                    key={course.id} 
                                    onClick={() => toggleCourse(course.id)}
                                    className={`flex items-center gap-3 p-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-colors ${selectedCourseIds.has(course.id) ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedCourseIds.has(course.id) ? 'bg-primary border-primary text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {selectedCourseIds.has(course.id) && <Icon name="check" className="text-xs" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{course.name}</p>
                                        <p className="text-xs text-slate-500">{course.days?.join(', ')} {course.startTime}</p>
                                    </div>
                                    <span className="text-xs font-mono text-slate-400">{course.mode}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2 text-right">
                            {selectedCourseIds.size} cursos seleccionados
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a2230] flex justify-end gap-3">
                    <button onClick={onClose} disabled={processing} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleExecute} 
                        disabled={processing}
                        className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {processing ? <Icon name="sync" className="animate-spin" /> : <Icon name="auto_awesome" />}
                        {processing ? 'Generando...' : 'Generar Borradores'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SmartRolloverModal;

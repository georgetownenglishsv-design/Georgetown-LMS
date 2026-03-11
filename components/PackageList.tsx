
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { StudentPackage, PackageSlot, Course } from '../types';
import { getPackages, updatePackageSlot, deletePackage, getCourses } from '../services/db';

const PackageList: React.FC = () => {
    const [packages, setPackages] = useState<StudentPackage[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Slot Management Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPkg, setSelectedPkg] = useState<StudentPackage | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<PackageSlot | null>(null);
    const [assignCourseName, setAssignCourseName] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pkgData, courseData] = await Promise.all([
                getPackages(),
                getCourses()
            ]);
            setPackages(pkgData);
            setCourses(courseData.filter(c => c.status === 'Active')); // Only active courses for dropdown
        } catch (e) {
            console.error("Error loading packages", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("⚠️ ¿Eliminar este registro de membresía?\n\nEsto NO afectará al estudiante ni a sus inscripciones pasadas.")) return;
        try {
            await deletePackage(id);
            setPackages(prev => prev.filter(p => p.id !== id));
        } catch (e) {
            alert("Error al eliminar.");
        }
    };

    const handleSlotClick = (pkg: StudentPackage, slot: PackageSlot) => {
        if (slot.status === 'Used') {
            // SHOW INFO ON CLICK
            alert(`📌 Detalle del Mes ${slot.index}\n\n🎓 Curso: ${slot.courseName}\n📅 Fecha de uso: ${slot.usedDate || 'N/A'}`);
            return; 
        }
        setSelectedPkg(pkg);
        setSelectedSlot(slot);
        setAssignCourseName('');
        setIsModalOpen(true);
    };

    const handleAssignSlot = async () => {
        if (!selectedPkg || !selectedSlot || !assignCourseName) return;
        
        if (!confirm(`¿Confirmar uso de crédito?\n\nEstudiante: ${selectedPkg.name}\nMes: ${selectedSlot.index}\nCurso: ${assignCourseName}`)) return;

        try {
            await updatePackageSlot(selectedPkg.id, selectedSlot.index, assignCourseName);
            
            // Update local state to reflect change immediately
            const updatedPackages = packages.map(p => {
                if (p.id === selectedPkg.id) {
                    const newSlots = p.slots.map(s => {
                        if (s.index === selectedSlot.index) {
                            return { ...s, status: 'Used' as const, courseName: assignCourseName, usedDate: new Date().toISOString().split('T')[0] };
                        }
                        return s;
                    });
                    return { ...p, slots: newSlots };
                }
                return p;
            });
            
            setPackages(updatedPackages);
            setIsModalOpen(false);
        } catch (e) {
            alert("Error al actualizar el registro.");
        }
    };

    const filteredPackages = packages.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.humanId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Icon name="card_membership" className="text-primary" />
                            Paquetes
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-text-secondary">
                            Gestión de estudiantes con pagos adelantados (2+ meses).
                        </p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="max-w-6xl mx-auto space-y-6">
                    
                    {/* Search */}
                    <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="search" /></span>
                            <input 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm dark:text-white focus:ring-primary focus:border-primary"
                                placeholder="Buscar por nombre o correo..."
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-black/20 text-xs font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4">Estudiante</th>
                                        <th className="px-6 py-4">Contacto</th>
                                        <th className="px-6 py-4 text-center">Progreso</th>
                                        <th className="px-6 py-4 text-center">Detalle de Meses (Click para Ver/Asignar)</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {loading ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-500"><Icon name="sync" className="animate-spin" /> Cargando...</td></tr>
                                    ) : filteredPackages.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">No se encontraron membresías.</td></tr>
                                    ) : (
                                        filteredPackages.map(pkg => {
                                            const usedCount = pkg.slots.filter(s => s.status === 'Used').length;
                                            const progress = Math.round((usedCount / pkg.totalMonths) * 100);
                                            
                                            return (
                                                <tr key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div>
                                                            <p className="font-bold text-slate-900 dark:text-white text-sm">{pkg.name}</p>
                                                            <span className="text-[10px] text-slate-400">Creado: {pkg.startDate}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-xs text-slate-500">{pkg.humanId}</p>
                                                        <p className="text-xs text-slate-500">{pkg.phone}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1 items-center">
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                                {usedCount} / {pkg.totalMonths} Meses
                                                            </span>
                                                            <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${progress}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-2 justify-center flex-wrap">
                                                            {pkg.slots.sort((a,b) => a.index - b.index).map(slot => (
                                                                <div 
                                                                    key={slot.index}
                                                                    onClick={() => handleSlotClick(pkg, slot)}
                                                                    className={`
                                                                        relative rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 p-1 w-12 h-12
                                                                        ${slot.status === 'Used' 
                                                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700' 
                                                                            : 'bg-white dark:bg-slate-800 border-dashed border-slate-300 dark:border-slate-600 hover:border-primary text-slate-400 hover:text-primary'}
                                                                    `}
                                                                    title={slot.status === 'Used' ? `Usado: ${slot.courseName}\nFecha: ${slot.usedDate}` : 'Click para asignar'}
                                                                >
                                                                    <span className="text-[9px] font-bold uppercase mb-0.5">Mes {slot.index}</span>
                                                                    {slot.status === 'Used' ? (
                                                                        <Icon name="check" className="text-lg" />
                                                                    ) : (
                                                                        <Icon name="add" className="text-sm" />
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={() => handleDelete(pkg.id)}
                                                            className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                            title="Eliminar Registro"
                                                        >
                                                            <Icon name="delete" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* ASSIGNMENT MODAL */}
            {isModalOpen && selectedPkg && selectedSlot && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-2xl shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                Asignar Crédito (Mes {selectedSlot.index})
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><Icon name="close" /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
                                <p><span className="font-bold">Estudiante:</span> {selectedPkg.name}</p>
                                <p><span className="font-bold">Acción:</span> Se marcará el Mes {selectedSlot.index} como "Usado".</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Seleccionar Curso (Referencia)</label>
                                <select 
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-primary"
                                    value={assignCourseName}
                                    onChange={(e) => setAssignCourseName(e.target.value)}
                                >
                                    <option value="">-- Seleccionar Curso Activo --</option>
                                    {courses.map(c => (
                                        <option key={c.id} value={c.name}>{c.name} ({c.startTime})</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    * Esto solo actualiza el registro de membresía. No inscribe al estudiante en el curso (use "Nueva Inscripción" para eso).
                                </p>
                            </div>

                            <button 
                                onClick={handleAssignSlot}
                                disabled={!assignCourseName}
                                className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Icon name="check_circle" /> Confirmar Uso
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default PackageList;

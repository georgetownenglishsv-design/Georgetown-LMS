
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './Icon';
import { getCourses, deleteCourseWithStudents, getArchivedCourses, restoreCourseToDraft, updateCourse, getStudentCountByCourse, getCategories } from '../services/db';
import { createTeamsChannelEvent } from '../services/microsoft';
import { Course, Category } from '../types';
import SmartRolloverModal from './SmartRolloverModal';

interface CourseListProps {
    onNavigate: (view: string, id?: string) => void;
}

// ... (Internal Component: Course Summary Stats - unchanged)
const CourseSummary: React.FC<{ courses: Course[] }> = ({ courses }) => {
    const active = courses.filter(c => c.status === 'Active');
    const online = active.filter(c => c.mode === 'online').length;
    const presencial = active.filter(c => c.mode === 'presencial').length;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                    <Icon name="library_books" className="text-2xl" />
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cursos Activos</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{active.length}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl">
                    <Icon name="wifi" className="text-2xl" />
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modalidad Online</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{online}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-xl">
                    <Icon name="domain" className="text-2xl" />
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Presencial</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{presencial}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                    <Icon name="groups" className="text-2xl" />
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Oferta</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{courses.length}</p>
                </div>
            </div>
        </div>
    );
};

const CourseList: React.FC<CourseListProps> = ({ onNavigate }) => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [archivedCourses, setArchivedCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'Active' | 'Draft' | 'Archived' | 'Concluded'>('Active');
    
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    const [retryLoading, setRetryLoading] = useState<string | null>(null);
    const [isRolloverOpen, setIsRolloverOpen] = useState(false);
    
    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, course: Course | null}>({ isOpen: false, course: null });

    const fetchData = async () => {
        setLoading(true);
        // Fetch courses and categories
        const [courseData, catData] = await Promise.all([
            getCourses(false), // false = exclude archived
            getCategories()
        ]);
        setCourses(courseData);
        setCategories(catData);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Lazy load archived when tab is clicked
    useEffect(() => {
        if (activeTab === 'Archived') {
            const loadArchived = async () => {
                setLoading(true);
                const archived = await getArchivedCourses();
                setArchivedCourses(archived);
                setLoading(false);
            };
            loadArchived();
        }
    }, [activeTab]);

    // --- SMART DELETE HANDLER ---
    const handleDeleteClick = (course: Course) => {
        setDeleteModal({ isOpen: true, course });
    };

    const confirmDeleteCourseOnly = async () => {
        const { course } = deleteModal;
        if (!course) return;

        try {
            // includeStudents = false: Only deletes course, class_sessions, and course_details
            await deleteCourseWithStudents(course.id, course.name, false);
            alert(`✅ El curso "${course.name}" ha sido eliminado. Los estudiantes inscritos se mantienen intactos.`);
            setDeleteModal({ isOpen: false, course: null });
            
            if (activeTab === 'Archived') {
                const updated = await getArchivedCourses();
                setArchivedCourses(updated);
            } else {
                fetchData();
            }
        } catch (e: any) {
            console.error(e);
            alert("Error al eliminar el curso.");
        }
    };

    // --- UNDO TO DRAFT HANDLER ---
    const handleUndoToDraft = async (course: Course) => {
        if (!confirm(`¿Devolver "${course.name}" a estado BORRADOR (Draft)?\n\nEsto lo ocultará de los estudiantes y reportes.`)) return;
        try {
            await restoreCourseToDraft(course.id);
            alert("Curso movido a Borradores.");
            fetchData(); // Refresh active list
        } catch (e) {
            alert("Error al restaurar.");
        }
    }

    // --- TEAMS FINALIZATION LOGIC ---
    const handleFinalizeTeams = async (course: Course) => {
        if (!course.teamsTeamId) return;
        
        setRetryLoading(course.id);
        try {
            const joinWebUrl = await createTeamsChannelEvent(
                course.teamsTeamId,
                course.name,
                course.defaultStartTime || '09:00',
                course.defaultEndTime || '10:30',
                course.startDate,
                course.endDate,
                course.defaultDays || [],
                course.refCode 
            );

            await updateCourse(course.id, {
                teamsProvisioningStatus: 'Completed',
                meetingLink: joinWebUrl
            });
            
            alert("✅ Aula Virtual creada exitosamente.");
            fetchData();
        } catch (e: any) {
            console.error(e);
            alert(`Error al finalizar configuración: ${e.message}`);
            await updateCourse(course.id, { teamsProvisioningStatus: 'Failed' });
            fetchData();
        } finally {
            setRetryLoading(null);
        }
    };

    const filteredCourses = useMemo(() => {
        const source = activeTab === 'Archived' ? archivedCourses : courses;
        
        return source.filter(c => {
            const status = c.status || 'Active';
            const matchesTab = status === activeTab;
            // Enhanced Search: Name or RefCode
            const lowerTerm = searchTerm.toLowerCase();
            const matchesSearch = c.name.toLowerCase().includes(lowerTerm) || 
                                  (c.refCode && c.refCode.toLowerCase().includes(lowerTerm));
            // Category Filter
            const matchesCategory = filterCategory ? c.category === filterCategory : true;

            return matchesTab && matchesSearch && matchesCategory;
        }).sort((a, b) => {
            // Sort by Start Date Descending (Newest First)
            const dateA = a.startDate || '';
            const dateB = b.startDate || '';
            // If dates are equal, sort by Name
            if (dateA === dateB) return a.name.localeCompare(b.name);
            return dateB.localeCompare(dateA); 
        });
    }, [courses, archivedCourses, activeTab, searchTerm, filterCategory]);

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
            {/* Header Area */}
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-5 shrink-0">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Gestión Académica</h1>
                        <p className="text-sm text-slate-500 dark:text-text-secondary">Administra el catálogo de cursos y aulas virtuales.</p>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                        <button 
                            onClick={() => onNavigate('categories')}
                            className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-surface-highlight border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
                        >
                            <Icon name="category" /> Categorías
                        </button>
                        <button 
                            onClick={() => setIsRolloverOpen(true)}
                            className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-purple-500/20 whitespace-nowrap"
                        >
                            <Icon name="content_copy" /> Rollover Mensual
                        </button>
                        <button 
                            onClick={() => onNavigate('create-course')}
                            className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-blue-500/20 whitespace-nowrap"
                        >
                            <Icon name="add" /> Nuevo Curso
                        </button>
                    </div>
                </div>
                
                {/* Tabs & Search */}
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-end gap-4">
                    <div className="flex gap-1 bg-slate-100 dark:bg-black/20 p-1 rounded-xl overflow-x-auto">
                        {['Active', 'Draft', 'Concluded', 'Archived'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    activeTab === tab 
                                        ? 'bg-white dark:bg-surface-highlight text-slate-900 dark:text-white shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                {tab === 'Active' ? 'Activos' : tab === 'Draft' ? 'Borradores' : tab === 'Concluded' ? 'Concluidos' : 'Archivados'}
                            </button>
                        ))}
                    </div>
                    
                    {/* Filters: Search & Category */}
                    <div className="flex gap-3 w-full md:w-auto">
                        {/* Category Dropdown */}
                        <div className="relative min-w-[140px] flex-1 md:flex-none">
                            <select 
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="w-full appearance-none bg-slate-50 dark:bg-surface-highlight border border-slate-200 dark:border-slate-700 rounded-xl pl-3 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-primary dark:text-white font-medium cursor-pointer"
                            >
                                <option value="">Todas las Categorías</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.shortCode}>{cat.name}</option>
                                ))}
                            </select>
                            <span className="absolute right-3 top-2.5 text-slate-400 pointer-events-none"><Icon name="expand_more" /></span>
                        </div>

                        {/* Search Input */}
                        <div className="relative flex-1 md:w-64">
                            <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="search" /></span>
                            <input 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-surface-highlight border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary dark:text-white"
                                placeholder="Buscar curso o código..."
                            />
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    
                    {activeTab === 'Active' && <CourseSummary courses={courses} />}

                    {/* Grid */}
                    {loading ? (
                        <div className="text-center py-20 text-slate-400"><Icon name="sync" className="animate-spin text-2xl" /> Cargando cursos...</div>
                    ) : filteredCourses.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-surface-dark rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500">
                            No se encontraron cursos con los filtros actuales.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredCourses.map(course => (
                                <div key={course.id} className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col hover:border-primary/50 transition-colors group">
                                    <div className="h-40 bg-slate-200 dark:bg-black/40 relative">
                                        {course.image && <img src={course.image} className="w-full h-full object-cover" />}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                        <div className="absolute top-3 right-3">
                                            <span className="bg-white/90 dark:bg-black/60 backdrop-blur text-[10px] font-bold px-2 py-1 rounded text-slate-900 dark:text-white uppercase tracking-wider shadow-sm">
                                                {course.category}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-3 left-4 right-4 text-white">
                                            <div className="flex items-center justify-between">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-white/20 ${course.mode === 'online' ? 'bg-blue-500/80' : 'bg-purple-500/80'}`}>
                                                    {course.mode}
                                                </span>
                                                <span className="font-mono text-xs opacity-80">{course.refCode}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-5 flex-1 flex flex-col gap-4">
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight mb-1 line-clamp-1" title={course.name}>{course.name}</h3>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <Icon name="event" className="text-sm" />
                                                <span>{course.startDate} ~ {course.endDate}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                <Icon name="schedule" className="text-sm" />
                                                <span>{course.defaultDays?.join(', ') || 'N/A'} • {course.startTime || 'TBD'}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Teams Status Box */}
                                        {course.mode === 'online' && activeTab === 'Active' && (
                                            <div className="bg-slate-50 dark:bg-black/20 rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Aula Virtual</span>
                                                    {course.teamsProvisioningStatus === 'Completed' ? (
                                                        <Icon name="check_circle" className="text-emerald-500" />
                                                    ) : course.teamsProvisioningStatus === 'TeamCreated' ? (
                                                        <span className="size-2 rounded-full bg-orange-500 animate-pulse"></span>
                                                    ) : (
                                                        <Icon name="wifi_off" className="text-slate-300" />
                                                    )}
                                                </div>
                                                
                                                {course.teamsProvisioningStatus === 'Completed' ? (
                                                    <a 
                                                        href={course.meetingLink} 
                                                        target="_blank" 
                                                        className="flex items-center justify-center w-full py-2.5 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-200 transition-colors gap-1"
                                                    >
                                                        <Icon name="video_camera_front" /> Entrar a Clase
                                                    </a>
                                                ) : course.teamsProvisioningStatus === 'TeamCreated' ? (
                                                    <button 
                                                        onClick={() => handleFinalizeTeams(course)}
                                                        disabled={!!retryLoading}
                                                        className="flex items-center justify-center w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors gap-1 shadow-sm"
                                                    >
                                                        {retryLoading === course.id ? <Icon name="sync" className="animate-spin" /> : <Icon name="build" />}
                                                        Generar Enlace (Paso 2)
                                                    </button>
                                                ) : (
                                                    <div className="text-center text-xs text-slate-400 italic py-1 bg-white dark:bg-white/5 rounded">Sin configuración</div>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-auto flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <span className="font-black text-lg text-slate-900 dark:text-white">${course.price}</span>
                                            <div className="flex gap-2">
                                                {/* Undo Button for Active/Concluded */}
                                                {(activeTab === 'Active' || activeTab === 'Concluded') && (
                                                    <button onClick={() => handleUndoToDraft(course)} className="p-2.5 text-slate-500 hover:text-orange-500 transition-colors bg-slate-100 hover:bg-orange-50 dark:bg-slate-800 dark:hover:bg-orange-900/20 rounded-lg" title="Devolver a Borrador"><Icon name="undo" /></button>
                                                )}
                                                
                                                <button onClick={() => onNavigate('create-course', course.id)} className="p-2.5 text-slate-500 hover:text-primary transition-colors bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg" title="Editar"><Icon name="edit" /></button>
                                                
                                                {/* Delete Button */}
                                                <button onClick={() => handleDeleteClick(course)} className="p-2.5 text-slate-500 hover:text-red-500 transition-colors bg-slate-100 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-900/20 rounded-lg" title="Eliminar"><Icon name="delete" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Smart Rollover Modal */}
            <SmartRolloverModal 
                isOpen={isRolloverOpen}
                onClose={() => setIsRolloverOpen(false)}
                activeCourses={courses.filter(c => c.status === 'Active')}
                onSuccess={fetchData}
            />

            {/* Delete Confirmation Modal */}
            {deleteModal.isOpen && deleteModal.course && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 md:p-8 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center mb-6">
                                <Icon name="warning" className="text-3xl" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Eliminar Curso</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">
                                Estás a punto de eliminar el curso <strong className="text-slate-700 dark:text-white">{deleteModal.course.name}</strong>.
                            </p>
                            
                            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-500/20 rounded-xl p-4 mb-8 text-left w-full">
                                <p className="text-sm font-bold text-orange-800 dark:text-orange-400 mb-1 flex items-center gap-2">
                                    <Icon name="info" className="text-base" /> Acción Cautelosa
                                </p>
                                <p className="text-xs text-orange-700/80 dark:text-orange-300/80">
                                    Solo se eliminará la información del curso, el detalle y las sesiones de clase. <strong>Los estudiantes inscritos no serán eliminados.</strong>
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <button 
                                    onClick={() => setDeleteModal({ isOpen: false, course: null })}
                                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-surface-highlight text-slate-700 dark:text-white font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmDeleteCourseOnly}
                                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
                                >
                                     강좌만 삭제 (Eliminar Curso)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default CourseList;

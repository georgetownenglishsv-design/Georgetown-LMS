
import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './Icon';
import { getCourses, getCourseDetail, saveCourseDetail, updateCourse } from '../services/db';
import { Course, CourseDetail } from '../types';

const WebCourseManager: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  
  // Filter & UI States
  const [viewMode, setViewMode] = useState<'Active' | 'Draft'>('Active');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    const data = await getCourses();
    setCourses(data);
    setLoading(false);
  };

  // Grouping Logic
  const groupedCourses = useMemo(() => {
      const filtered = courses.filter(c => c.status === viewMode);
      const groups: { [key: string]: Course[] } = {};
      
      filtered.forEach(c => {
          const name = c.name.trim();
          if (!groups[name]) groups[name] = [];
          groups[name].push(c);
      });

      // Sort courses inside groups by date
      Object.keys(groups).forEach(key => {
          groups[key].sort((a, b) => a.startDate.localeCompare(b.startDate));
      });

      return groups;
  }, [courses, viewMode]);

  const toggleGroup = (groupName: string) => {
      const newSet = new Set(expandedGroups);
      if (newSet.has(groupName)) newSet.delete(groupName);
      else newSet.add(groupName);
      setExpandedGroups(newSet);
  };

  const handleSelectCourse = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setLoadingDetail(true);
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    // Fetch existing or generate default
    const existingDetail = await getCourseDetail(courseId, course);
    setDetail(existingDetail);
    setLoadingDetail(false);
  };

  // NEW: Smart Import Feature
  const handleImportFromPrevious = async () => {
      if (!selectedCourseId) return;
      const currentCourse = courses.find(c => c.id === selectedCourseId);
      if (!currentCourse) return;

      if(!confirm("¿Buscar y copiar contenido de la versión anterior de este curso? Esto sobrescribirá los cambios actuales.")) return;

      setLoadingDetail(true);
      try {
          // Find most recent OTHER course with same name
          const siblings = courses.filter(c => c.name === currentCourse.name && c.id !== currentCourse.id);
          const sortedSiblings = siblings.sort((a, b) => b.startDate.localeCompare(a.startDate)); // Descending
          
          let foundDetail = null;
          for (const sibling of sortedSiblings) {
              const d = await getCourseDetail(sibling.id);
              if (d && d.longDescription) { // Check if it has content
                  foundDetail = d;
                  break;
              }
          }

          if (foundDetail) {
              const { id, ...content } = foundDetail;
              // Apply to current ID
              setDetail({ ...content, id: selectedCourseId });
              alert("Contenido importado exitosamente.");
          } else {
              alert("No se encontró contenido previo para este curso.");
          }
      } catch (e) {
          console.error(e);
          alert("Error al importar.");
      } finally {
          setLoadingDetail(false);
      }
  };

  const handleSave = async () => {
    if (!selectedCourseId || !detail) return;
    setSaving(true);
    try {
      await saveCourseDetail(selectedCourseId, detail);
      alert("Información web actualizada correctamente.");
    } catch (e) {
      console.error(e);
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
      if (!selectedCourseId) return;
      if (!confirm("¿Publicar este curso ahora? Pasará a estado 'Active'.")) return;
      try {
          await updateCourse(selectedCourseId, { status: 'Active' });
          await fetchCourses(); // Refresh list
          if (viewMode === 'Draft') setSelectedCourseId(null); // Clear selection if moved
          alert("Curso publicado.");
      } catch (e) {
          alert("Error al publicar.");
      }
  }

  // --- Array Manipulation Helpers ---

  const addLearningPoint = () => {
    if (!detail) return;
    const points = detail.learningPoints || [];
    setDetail({ ...detail, learningPoints: [...points, ""] });
  };

  const updateLearningPoint = (index: number, value: string) => {
    if (!detail) return;
    const newPoints = [...(detail.learningPoints || [])];
    newPoints[index] = value;
    setDetail({ ...detail, learningPoints: newPoints });
  };

  const removeLearningPoint = (index: number) => {
    if (!detail) return;
    setDetail({ ...detail, learningPoints: (detail.learningPoints || []).filter((_, i) => i !== index) });
  };

  const formatDateShort = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}`;
  }

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Gestión Web Cursos</h1>
            <p className="text-sm text-slate-500 dark:text-text-secondary">Edita el contenido visual y descriptivo para la página web pública.</p>
        </div>
        {selectedCourseId && (
            <div className="flex gap-2">
                {viewMode === 'Draft' && (
                    <button 
                        onClick={handlePublish}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg transition-all active:scale-95"
                    >
                        <Icon name="publish" /> Publicar
                    </button>
                )}
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-70"
                >
                    <Icon name={saving ? "sync" : "save"} className={saving ? "animate-spin" : ""} />
                    {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
            </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Hierarchical Sidebar */}
        <aside className="w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark flex flex-col">
            {/* View Mode Toggle */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black/20 shrink-0">
                <div className="flex bg-slate-200 dark:bg-slate-700 rounded-lg p-1">
                    <button 
                        onClick={() => setViewMode('Active')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'Active' ? 'bg-white dark:bg-slate-500 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Publicados
                    </button>
                    <button 
                        onClick={() => setViewMode('Draft')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'Draft' ? 'bg-white dark:bg-slate-500 shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Borradores
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-8 text-center text-slate-400"><Icon name="sync" className="animate-spin text-2xl" /></div>
                ) : Object.keys(groupedCourses).length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">No hay cursos en esta sección.</div>
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {Object.entries(groupedCourses).map(([name, groupCourses]: [string, Course[]]) => (
                            <li key={name} className="flex flex-col">
                                <button 
                                    onClick={() => toggleGroup(name)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`size-8 rounded-lg flex items-center justify-center text-sm shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500`}>
                                            <Icon name="folder" />
                                        </div>
                                        <span className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">{name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 rounded-full text-slate-600 dark:text-slate-300 font-bold">{groupCourses.length}</span>
                                        <Icon name="expand_more" className={`text-slate-400 transition-transform ${expandedGroups.has(name) ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>
                                
                                {expandedGroups.has(name) && (
                                    <ul className="bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-slate-800">
                                        {groupCourses.map(course => (
                                            <li key={course.id}>
                                                <button 
                                                    onClick={() => handleSelectCourse(course.id)}
                                                    className={`w-full text-left pl-12 pr-4 py-2 text-xs flex items-center justify-between hover:bg-white dark:hover:bg-white/5 transition-colors ${selectedCourseId === course.id ? 'text-primary font-bold bg-white dark:bg-white/5 border-l-2 border-primary' : 'text-slate-500 dark:text-slate-400'}`}
                                                >
                                                    <span>{formatDateShort(course.startDate)} - {formatDateShort(course.endDate)}</span>
                                                    <span className={`text-[10px] uppercase px-1 rounded ${course.mode === 'online' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>{course.mode.substring(0,3)}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>

        {/* Right: Editor */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50 dark:bg-black/10">
            {!selectedCourseId ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <Icon name="web" className="text-6xl mb-4 opacity-50" />
                    <p className="text-lg font-medium">Selecciona un curso para editar su contenido.</p>
                </div>
            ) : loadingDetail || !detail ? (
                <div className="h-full flex items-center justify-center text-primary"><Icon name="sync" className="animate-spin text-3xl" /></div>
            ) : (
                <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Utility Bar */}
                    <div className="flex justify-end">
                        <button 
                            onClick={handleImportFromPrevious}
                            className="text-xs font-bold text-slate-500 hover:text-primary flex items-center gap-1 transition-colors"
                            title="Si el contenido está vacío, intenta copiar del curso anterior."
                        >
                            <Icon name="content_copy" className="text-sm" /> Importar de anterior
                        </button>
                    </div>

                    {/* Section: Basic Info */}
                    <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Icon name="info" className="text-primary" /> Información Básica
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Descripción Larga</label>
                                <textarea 
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white"
                                    rows={5}
                                    value={detail.longDescription}
                                    onChange={(e) => setDetail({...detail, longDescription: e.target.value})}
                                ></textarea>
                                <p className="text-xs text-slate-400 mt-1">Se muestra en el encabezado de la página de detalle.</p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Duración (Texto)</label>
                                    <input 
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white"
                                        value={detail.duration}
                                        onChange={(e) => setDetail({...detail, duration: e.target.value})}
                                        placeholder="Ej. 12 Semanas / 3 Meses"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nivel / Dificultad</label>
                                    <input 
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white"
                                        value={detail.level}
                                        onChange={(e) => setDetail({...detail, level: e.target.value})}
                                        placeholder="Ej. Intermedio B2"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Calificación (0-5)</label>
                                        <input 
                                            type="number"
                                            step="0.1"
                                            max="5"
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white"
                                            value={detail.rating}
                                            onChange={(e) => setDetail({...detail, rating: parseFloat(e.target.value)})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Num. Reseñas</label>
                                        <input 
                                            type="number"
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-white"
                                            value={detail.reviewCount}
                                            onChange={(e) => setDetail({...detail, reviewCount: parseInt(e.target.value)})}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section: Learning Points */}
                    <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Icon name="check_circle" className="text-emerald-500" /> Lo que aprenderás
                            </h3>
                            <button onClick={addLearningPoint} className="text-xs font-bold text-primary hover:underline">+ Agregar Punto</button>
                        </div>
                        <div className="space-y-3">
                            {(detail.learningPoints || []).map((point, i) => (
                                <div key={i} className="flex gap-2">
                                    <input 
                                        className="flex-1 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                                        value={point}
                                        onChange={(e) => updateLearningPoint(i, e.target.value)}
                                        placeholder="Ej. Dominio de gramática avanzada..."
                                    />
                                    <button onClick={() => removeLearningPoint(i)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Icon name="delete" /></button>
                                </div>
                            ))}
                        </div>
                    </section>

                </div>
            )}
        </div>
      </div>
    </main>
  );
};

export default WebCourseManager;

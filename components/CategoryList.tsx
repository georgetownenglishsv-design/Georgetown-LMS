import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Category } from '../types';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../services/db';

const COLOR_PRESETS = [
    { name: 'Purple', class: 'bg-purple-500/20 text-purple-400', hex: '#a855f7' },
    { name: 'Blue', class: 'bg-blue-500/20 text-blue-400', hex: '#3b82f6' },
    { name: 'Pink', class: 'bg-pink-500/20 text-pink-400', hex: '#ec4899' },
    { name: 'Orange', class: 'bg-orange-500/20 text-orange-400', hex: '#f97316' },
    { name: 'Teal', class: 'bg-teal-500/20 text-teal-400', hex: '#14b8a6' },
    { name: 'Green', class: 'bg-green-500/20 text-green-400', hex: '#22c55e' },
];

const CategoryList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const [formData, setFormData] = useState({
      displayId: '',
      name: '',
      shortCode: '',
      colorClass: COLOR_PRESETS[0].class,
      description: '',
      status: 'Activo' as 'Activo' | 'Inactivo',
      order: 0
  });

  const fetchData = async () => {
      setLoading(true);
      const data = await getCategories();
      setCategories(data);
      setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
      setFormData({
          displayId: `#${String(categories.length + 1).padStart(3, '0')}`,
          name: '',
          shortCode: '',
          colorClass: COLOR_PRESETS[0].class,
          description: '',
          status: 'Activo',
          order: categories.length + 1
      });
      setEditingCategory(null);
  };

  const handleOpenModal = () => {
      resetForm();
      setIsModalOpen(true);
  };

  const handleEdit = (category: Category) => {
      setEditingCategory(category);
      setFormData({
          displayId: category.displayId,
          name: category.name,
          shortCode: category.shortCode,
          colorClass: category.colorClass,
          description: category.description,
          status: category.status,
          order: category.order || 0
      });
      setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
      if (!confirm("¿Está seguro de eliminar esta categoría?")) return;
      try {
          await deleteCategory(id);
          alert("Categoría eliminada.");
          fetchData(); // Refresh list
      } catch (e: any) {
          alert("Error: " + (e.message.includes('used by') ? "No se puede eliminar porque hay cursos asignados a esta categoría." : "No se pudo eliminar."));
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const payload = {
              ...formData,
              order: Number(formData.order),
              courseCount: editingCategory ? editingCategory.courseCount : 0 // Preserve or default
          };

          if (editingCategory) {
              await updateCategory(editingCategory.id, payload);
          } else {
              await addCategory(payload);
          }
          
          setIsModalOpen(false);
          fetchData();
      } catch (e) {
          console.error(e);
          alert("Error al guardar categoría");
      }
  };

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Page Header */}
      <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-6 lg:px-10 shrink-0">
        <div className="max-w-[1400px] mx-auto space-y-4">
          <nav aria-label="Breadcrumb" className="flex">
            <ol className="flex items-center space-x-2">
              <li>
                <a className="text-text-secondary hover:text-primary transition-colors flex items-center gap-1" href="#">
                  <Icon name="home" className="text-sm" />
                  <span className="text-xs font-medium">Inicio</span>
                </a>
              </li>
              <li><span className="text-text-secondary text-xs">/</span></li>
              <li><a className="text-text-secondary hover:text-primary transition-colors text-xs font-medium" href="#">Cursos</a></li>
              <li><span className="text-text-secondary text-xs">/</span></li>
              <li aria-current="page" className="text-primary font-bold text-xs">Categorías</li>
            </ol>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Gestión de Categorías
              </h1>
              <p className="text-slate-500 dark:text-text-secondary text-base font-light max-w-2xl">
                Administra las taxonomías de los cursos para el sistema académico de Georgetown Academy.
              </p>
            </div>
            <button onClick={handleOpenModal} className="bg-primary hover:bg-primary-dark text-white text-sm font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center gap-2 group whitespace-nowrap active:scale-95">
              <Icon name="add" className="group-hover:rotate-90 transition-transform duration-300" />
              Agregar Categoría
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <div className="max-w-[1400px] mx-auto space-y-8">
          
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-5 shadow-sm">
              <div className="size-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Icon name="category" className="text-2xl" />
              </div>
              <div>
                <p className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Total Categorías</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{categories.length}</p>
              </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-5 shadow-sm">
              <div className="size-14 rounded-2xl bg-success/10 flex items-center justify-center text-success">
                <Icon name="check_circle" className="text-2xl" />
              </div>
              <div>
                <p className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Activas</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">
                    {categories.filter(c => c.status === 'Activo').length}
                </p>
              </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-5 shadow-sm">
              <div className="size-14 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <Icon name="school" className="text-2xl" />
              </div>
              <div>
                <p className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Cursos Asignados</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">48</p>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            
            {/* Filters Bar */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between bg-slate-50/30 dark:bg-white/5">
              <div className="relative flex-1 max-w-md group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-text-secondary group-focus-within:text-primary transition-colors">
                  <Icon name="search" />
                </span>
                <input 
                  className="w-full bg-white dark:bg-surface-highlight border border-slate-200 dark:border-transparent text-slate-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-primary focus:border-primary block pl-11 p-3 placeholder-slate-400 transition-all outline-none" 
                  placeholder="Buscar por nombre o ID..." 
                  type="text"
                />
              </div>
              <div className="flex gap-3">
                <button className="px-5 py-3 text-sm font-bold text-slate-700 dark:text-gray-200 bg-white dark:bg-surface-highlight border border-slate-200 dark:border-transparent rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 shadow-sm">
                  <Icon name="filter_list" />
                  Filtros
                </button>
                <button className="px-5 py-3 text-sm font-bold text-slate-700 dark:text-gray-200 bg-white dark:bg-surface-highlight border border-slate-200 dark:border-transparent rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 shadow-sm">
                  <Icon name="download" />
                  Exportar
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-text-secondary uppercase bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-5 font-bold tracking-wider w-12 text-center">Orden</th>
                    <th className="px-6 py-5 font-bold tracking-wider w-24">ID</th>
                    <th className="px-6 py-5 font-bold tracking-wider">Nombre de la Categoría</th>
                    <th className="px-6 py-5 font-bold tracking-wider hidden md:table-cell">Descripción</th>
                    <th className="px-6 py-5 font-bold tracking-wider text-center">Cursos</th>
                    <th className="px-6 py-5 font-bold tracking-wider">Estado</th>
                    <th className="px-6 py-5 font-bold tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                            <div className="flex flex-col items-center gap-2">
                                <Icon name="sync" className="animate-spin text-xl" />
                                <span>Cargando categorías...</span>
                            </div>
                        </td>
                    </tr>
                  ) : categories.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">No hay categorías disponibles.</td>
                    </tr>
                  ) : (
                    categories.map((cat) => (
                      <tr key={cat.id} className="bg-white dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-6 text-center text-slate-500 font-bold">{cat.order || 99}</td>
                        <td className="px-6 py-6 font-bold text-text-secondary">{cat.displayId}</td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className={`size-9 rounded-xl ${cat.colorClass} flex items-center justify-center font-black text-[10px] shadow-sm`}>
                              {cat.shortCode}
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{cat.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-text-secondary hidden md:table-cell max-w-xs truncate font-medium">
                          {cat.description}
                        </td>
                        <td className="px-6 py-6 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black bg-slate-100 dark:bg-surface-highlight text-slate-700 dark:text-slate-300">
                            {cat.courseCount}
                          </span>
                        </td>
                        <td className="px-6 py-6">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
                            cat.status === 'Activo' 
                              ? 'bg-success/10 text-success border-success/20' 
                              : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                          }`}>
                            <span className={`size-2 rounded-full ${cat.status === 'Activo' ? 'bg-success shadow-[0_0_8px_rgba(11,218,94,0.5)] animate-pulse' : 'bg-slate-500'}`}></span>
                            {cat.status}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button onClick={() => handleEdit(cat)} className="p-2.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-xl transition-all" title="Editar">
                              <Icon name="edit" />
                            </button>
                            <button onClick={() => handleDelete(cat.id)} className="p-2.5 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all" title="Eliminar">
                              <Icon name="delete" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-white/5 px-6 py-5 gap-4">
              <p className="text-sm text-text-secondary font-medium">
                Mostrando <span className="font-bold text-slate-900 dark:text-white">{categories.length > 0 ? 1 : 0}</span> a <span className="font-bold text-slate-900 dark:text-white">{categories.length}</span> de <span className="font-bold text-slate-900 dark:text-white">{categories.length}</span> resultados
              </p>
              <nav aria-label="Pagination" className="isolate inline-flex -space-x-px rounded-xl shadow-sm bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button className="relative inline-flex items-center px-3 py-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-r border-slate-200 dark:border-slate-800">
                  <Icon name="chevron_left" />
                </button>
                <button className="relative z-10 inline-flex items-center bg-primary px-5 py-2 text-sm font-black text-white focus:z-20">1</button>
                <button className="relative inline-flex items-center px-3 py-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <Icon name="chevron_right" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
      
      {/* Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           {/* Backdrop */}
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
           
           {/* Modal Panel */}
           <div className="relative w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-2xl ring-1 ring-slate-900/5 flex flex-col animate-in zoom-in-95 duration-200">
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                      <Icon name="close" />
                  </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="col-span-1">
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">ID Visual</label>
                          <input required value={formData.displayId} onChange={e => setFormData({...formData, displayId: e.target.value})} className="w-full bg-slate-50 dark:bg-[#111621] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white focus:ring-primary focus:border-primary" placeholder="#000" />
                      </div>
                      <div className="col-span-1">
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Código Corto</label>
                          <input required value={formData.shortCode} onChange={e => setFormData({...formData, shortCode: e.target.value})} className="w-full bg-slate-50 dark:bg-[#111621] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white focus:ring-primary focus:border-primary" placeholder="Ej. MAT" maxLength={4} />
                      </div>
                  </div>
                  
                  <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nombre de la Categoría</label>
                      <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-[#111621] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white focus:ring-primary focus:border-primary" placeholder="Ej. Matemáticas Avanzadas" />
                  </div>

                  <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Color del Tema</label>
                      <div className="flex flex-wrap gap-3">
                          {COLOR_PRESETS.map((color) => (
                              <button
                                  key={color.name}
                                  type="button"
                                  onClick={() => setFormData({...formData, colorClass: color.class})}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${formData.colorClass === color.class ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-surface-dark ring-primary scale-110' : 'hover:scale-110'}`}
                                  style={{ backgroundColor: color.hex }}
                                  title={color.name}
                              >
                                  {formData.colorClass === color.class && <Icon name="check" className="text-white text-sm" />}
                              </button>
                          ))}
                      </div>
                  </div>

                  <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Descripción</label>
                      <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 dark:bg-[#111621] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white focus:ring-primary focus:border-primary resize-none" rows={3} placeholder="Breve descripción del área académica..." />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="col-span-1">
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Estado</label>
                          <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as 'Activo' | 'Inactivo'})} className="w-full bg-slate-50 dark:bg-[#111621] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white focus:ring-primary focus:border-primary">
                              <option value="Activo">Activo</option>
                              <option value="Inactivo">Inactivo</option>
                          </select>
                      </div>
                      <div className="col-span-1">
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Orden Visual</label>
                          <input type="number" value={formData.order} onChange={e => setFormData({...formData, order: Number(e.target.value)})} className="w-full bg-slate-50 dark:bg-[#111621] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white focus:ring-primary focus:border-primary" placeholder="Ej. 1" />
                      </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">Cancelar</button>
                      <button type="submit" className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
                          <Icon name="save" />
                          Guardar Categoría
                      </button>
                  </div>
              </form>
           </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-text-secondary border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white/50 dark:bg-surface-dark/50 backdrop-blur-sm">
        <p className="font-medium tracking-wide">© 2025 Georgetown Academy. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
};

export default CategoryList;
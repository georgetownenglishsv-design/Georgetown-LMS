
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { getTeachers, addUser, updateUser, deleteUser } from '../services/db';
import { Teacher, AppUser } from '../types';
import { auth } from '../firebase';

interface TeacherListProps {
    onViewDetails?: (id: string) => void;
}

const AVATAR_COLORS = [
    { name: 'Blue', class: 'bg-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-500' },
    { name: 'Purple', class: 'bg-purple-500', bg: 'bg-purple-500/20', text: 'text-purple-500' },
    { name: 'Pink', class: 'bg-pink-500', bg: 'bg-pink-500/20', text: 'text-pink-500' },
    { name: 'Orange', class: 'bg-orange-500', bg: 'bg-orange-500/20', text: 'text-orange-500' },
    { name: 'Teal', class: 'bg-teal-500', bg: 'bg-teal-500/20', text: 'text-teal-500' },
    { name: 'Emerald', class: 'bg-emerald-500', bg: 'bg-emerald-500/20', text: 'text-emerald-500' },
];

const TeacherList: React.FC<TeacherListProps> = ({ onViewDetails }) => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      password: '', // Updates tempPassword in DB
      hourlyRateOnline: '', // New separate field
      hourlyRateOffline: '', // New separate field
      status: 'Activo' as 'Activo' | 'Inactivo',
      colorIndex: 0
  });

  const fetchTeachers = async () => {
      setLoading(true);
      const data = await getTeachers();
      setTeachers(data);
      setLoading(false);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleOpenModal = () => {
      setEditingId(null);
      setFormData({
          name: '',
          email: '',
          phone: '',
          password: '',
          hourlyRateOnline: '',
          hourlyRateOffline: '',
          status: 'Activo',
          colorIndex: Math.floor(Math.random() * AVATAR_COLORS.length)
      });
      setIsModalOpen(true);
  };

  const handleCloseModal = () => {
      setIsModalOpen(false);
      setEditingId(null);
  };

  const handleEdit = (teacher: Teacher) => {
      setEditingId(teacher.id);
      
      // Try to match existing color class to one of our presets
      let colorIdx = 0;
      if (teacher.colorClass) {
          const matchedIdx = AVATAR_COLORS.findIndex(c => teacher.colorClass.includes(c.name.toLowerCase()));
          if (matchedIdx !== -1) colorIdx = matchedIdx;
      }

      setFormData({
          name: teacher.name,
          email: teacher.email,
          phone: teacher.phone,
          password: '', // Reset password field
          // Support migration from old single rate if new ones don't exist
          hourlyRateOnline: teacher.hourlyRateOnline ? teacher.hourlyRateOnline.toString() : (teacher.hourlyRate ? teacher.hourlyRate.toString() : ''),
          hourlyRateOffline: teacher.hourlyRateOffline ? teacher.hourlyRateOffline.toString() : (teacher.hourlyRate ? teacher.hourlyRate.toString() : ''),
          status: teacher.status as 'Activo' | 'Inactivo',
          colorIndex: colorIdx
      });
      setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
      if (!window.confirm("¿Está seguro de eliminar este profesor? Esta acción no se puede deshacer.")) {
          return;
      }

      try {
          await deleteUser(id);
          setTeachers(prev => prev.filter(t => t.id !== id));
          alert("Profesor eliminado correctamente.");
      } catch (error: any) {
          console.error(error);
          // Show specific message if available (e.g. active classes constraint)
          alert("Error: " + (error.message.includes("Cannot delete") ? "No se puede eliminar porque tiene clases activas asignadas." : "No se pudo eliminar el profesor."));
      }
  };

  // Feature: Send Password Reset Email for existing Auth users
  const handleSendResetEmail = async (email: string) => {
      if (!window.confirm(`¿Enviar correo de restablecimiento de contraseña a ${email}?`)) return;
      
      try {
          await auth.sendPasswordResetEmail(email);
          alert("Correo de restablecimiento enviado exitosamente.");
      } catch (error: any) {
          console.error(error);
          if (error.code === 'auth/user-not-found') {
              alert("Este usuario aún no ha iniciado sesión por primera vez. Puede establecer la contraseña directamente en 'Editar'.");
          } else {
              alert("Error al enviar el correo: " + error.message);
          }
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!formData.name || !formData.email) return;

      setSubmitting(true);
      try {
          // Generate Initials
          const names = formData.name.split(' ');
          const initials = (names[0][0] + (names.length > 1 ? names[names.length - 1][0] : '')).toUpperCase();
          
          // Generate Color Class string
          const selectedColor = AVATAR_COLORS[formData.colorIndex];
          const colorClass = `bg-gradient-to-br from-${selectedColor.name.toLowerCase()}-500 to-${selectedColor.name.toLowerCase()}-600`;

          const teacherPayload: Partial<AppUser> & { tempPassword?: string, hourlyRateOnline?: number, hourlyRateOffline?: number } = {
              name: formData.name,
              email: formData.email,
              role: 'Profesor',
              initials: initials,
              colorClass: colorClass,
              // Update tempPassword if user typed something new. 
              // This allows first-time login to pick up the new password.
              ...(formData.password ? { tempPassword: formData.password } : {}),
              // DB Service handles saving any extra fields passed to updateUser/addUser
              hourlyRateOnline: formData.hourlyRateOnline ? Number(formData.hourlyRateOnline) : 0,
              hourlyRateOffline: formData.hourlyRateOffline ? Number(formData.hourlyRateOffline) : 0,
          };

          const fullPayload = {
              ...teacherPayload,
              phone: formData.phone,
              status: formData.status
          };

          if (editingId) {
              await updateUser(editingId, fullPayload);
              if (formData.password) {
                  alert("Datos actualizados. Como cambió la contraseña, el profesor deberá usar el botón 'Sincronizar contraseña' al intentar iniciar sesión si la antigua ya no funciona.");
              } else {
                  alert("Datos del profesor actualizados exitosamente.");
              }
          } else {
              await addUser({
                  ...fullPayload,
                  permissions: { students: false, courses: true, finance: false, settings: false },
                  isSuperAdmin: false
              } as any);
              alert("Profesor registrado exitosamente.");
          }

          setIsModalOpen(false);
          fetchTeachers();

      } catch (error) {
          console.error(error);
          alert("Error al guardar información.");
      } finally {
          setSubmitting(false);
      }
  };

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Header */}
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
              <li aria-current="page" className="text-primary font-bold text-xs">Profesores</li>
            </ol>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Gestión de Profesores
              </h1>
              <p className="text-slate-500 dark:text-text-secondary text-base font-light max-w-2xl">
                Administre el directorio docente. Visualice asignaciones, gestione perfiles y controle el estado activo del personal.
              </p>
            </div>
            <button onClick={handleOpenModal} className="bg-primary hover:bg-primary-dark text-white text-sm font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center gap-2 group whitespace-nowrap active:scale-95">
              <Icon name="add" className="group-hover:rotate-90 transition-transform duration-300" />
              Nuevo Profesor
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <div className="max-w-[1400px] mx-auto space-y-8">
          
          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
                <label className="flex flex-col gap-2">
                    <span className="text-slate-900 dark:text-white text-sm font-medium">Buscar profesor</span>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" /></span>
                        <input className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary pl-11 pr-4 py-3 text-sm transition-all shadow-sm" placeholder="Buscar por nombre, correo o teléfono..."/>
                    </div>
                </label>
            </div>
            <div className="w-full md:w-64">
                <label className="flex flex-col gap-2">
                    <span className="text-slate-900 dark:text-white text-sm font-medium">Filtrar por Estado</span>
                    <div className="relative">
                        <select className="w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary px-4 py-3 text-sm transition-all shadow-sm cursor-pointer">
                            <option value="all">Todos los estados</option>
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                        </select>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"><Icon name="expand_more" /></span>
                    </div>
                </label>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-surface-highlight border-b border-slate-200 dark:border-slate-800">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-text-secondary uppercase tracking-wider">Nombre Completo</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-text-secondary uppercase tracking-wider">Contacto</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-text-secondary uppercase tracking-wider hidden md:table-cell">Correo Electrónico</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-text-secondary uppercase tracking-wider text-center">Clases</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-text-secondary uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-text-secondary uppercase tracking-wider text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Cargando profesores...</td></tr>
                        ) : teachers.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No hay profesores registrados.</td></tr>
                        ) : teachers.map((teacher) => (
                            <tr key={teacher.id} className="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-full ${teacher.colorClass} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                            {teacher.initials}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">{teacher.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-text-secondary md:hidden">{teacher.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-text-secondary tabular-nums">{teacher.phone}</td>
                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-text-secondary hidden md:table-cell">{teacher.email}</td>
                                <td className="px-6 py-4 text-sm text-slate-900 dark:text-white text-center font-medium">
                                    <span className="inline-flex items-center justify-center size-6 rounded bg-slate-100 dark:bg-white/5 text-xs">{teacher.classCount || 0}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
                                        teacher.status === 'Activo' 
                                            ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 border-emerald-200 dark:border-emerald-500/20' 
                                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-text-secondary border-slate-200 dark:border-white/10'
                                    }`}>
                                        <span className={`size-1.5 rounded-full ${teacher.status === 'Activo' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                        {teacher.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => onViewDetails && onViewDetails(teacher.id)}
                                            className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-bold rounded-lg transition-all mr-2 flex items-center gap-1"
                                            title="Ver historial y gestión"
                                        >
                                            <Icon name="visibility" className="text-[16px]" /> Gestionar
                                        </button>
                                        <button 
                                            onClick={() => handleSendResetEmail(teacher.email)}
                                            className="p-2 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-400/10 rounded-lg transition-colors" 
                                            title="Enviar correo de restablecimiento de contraseña"
                                        >
                                            <Icon name="lock_reset" className="text-[20px]" />
                                        </button>
                                        <button 
                                            onClick={() => handleEdit(teacher)}
                                            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors" 
                                            title="Editar"
                                        >
                                            <Icon name="edit" className="text-[20px]" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(teacher.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors" 
                                            title="Eliminar"
                                        >
                                            <Icon name="delete" className="text-[20px]" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark px-4 py-3">
                <p className="text-sm text-slate-500 dark:text-text-secondary">
                    Mostrando <span className="font-medium text-slate-900 dark:text-white">{teachers.length > 0 ? 1 : 0}</span> a <span className="font-medium text-slate-900 dark:text-white">{teachers.length}</span> de <span className="font-medium text-slate-900 dark:text-white">{teachers.length}</span> resultados
                </p>
                <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-text-secondary disabled:opacity-50" disabled>Anterior</button>
                    <button className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-text-secondary disabled:opacity-50" disabled>Siguiente</button>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Teacher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={handleCloseModal}></div>
            <div className="relative w-full max-w-2xl bg-white dark:bg-surface-dark rounded-2xl shadow-2xl ring-1 ring-slate-900/5 flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
                
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#1a2230]">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {editingId ? 'Editar Profesor' : 'Registrar Nuevo Profesor'}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-text-secondary">
                            {editingId ? 'Modifique los datos del perfil docente.' : 'Complete la información para crear el perfil docente.'}
                        </p>
                    </div>
                    <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <Icon name="close" className="text-[24px]" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[80vh]">
                    <div className="space-y-6">
                        
                        {/* Profile Preview & Color Selection */}
                        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a2230]/50">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg ${AVATAR_COLORS[formData.colorIndex].class}`}>
                                {formData.name ? formData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'NM'}
                            </div>
                            <div className="flex-1 w-full">
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Color de Perfil</label>
                                <div className="flex flex-wrap gap-3">
                                    {AVATAR_COLORS.map((color, idx) => (
                                        <button
                                            key={color.name}
                                            type="button"
                                            onClick={() => setFormData({...formData, colorIndex: idx})}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${formData.colorIndex === idx ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-surface-dark ring-primary scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                            title={color.name}
                                        >
                                            <div className={`w-full h-full rounded-full ${color.class}`}></div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Nombre Completo</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="person" /></span>
                                    <input 
                                        required 
                                        value={formData.name} 
                                        onChange={e => setFormData({...formData, name: e.target.value})} 
                                        className="w-full bg-slate-50 dark:bg-[#111218] border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm placeholder:text-slate-400" 
                                        placeholder="Ej. Dr. Alejandro Méndez" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Correo Electrónico</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="mail" /></span>
                                    <input 
                                        required 
                                        type="email"
                                        value={formData.email} 
                                        onChange={e => setFormData({...formData, email: e.target.value})} 
                                        className="w-full bg-slate-50 dark:bg-[#111218] border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm placeholder:text-slate-400" 
                                        placeholder="profesor@georgetown.edu" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Teléfono</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="call" /></span>
                                    <input 
                                        value={formData.phone} 
                                        onChange={e => setFormData({...formData, phone: e.target.value})} 
                                        className="w-full bg-slate-50 dark:bg-[#111218] border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm placeholder:text-slate-400" 
                                        placeholder="+503 2222-0000" 
                                    />
                                </div>
                            </div>

                            {/* Split Rates */}
                            <div>
                                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Pago Online ($/h)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="wifi" /></span>
                                    <input 
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.hourlyRateOnline} 
                                        onChange={e => setFormData({...formData, hourlyRateOnline: e.target.value})} 
                                        className="w-full bg-slate-50 dark:bg-[#111218] border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm placeholder:text-slate-400" 
                                        placeholder="0.00" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Pago Presencial ($/h)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="apartment" /></span>
                                    <input 
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.hourlyRateOffline} 
                                        onChange={e => setFormData({...formData, hourlyRateOffline: e.target.value})} 
                                        className="w-full bg-slate-50 dark:bg-[#111218] border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm placeholder:text-slate-400" 
                                        placeholder="0.00" 
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                                    {editingId ? 'Cambiar Contraseña (Administrador)' : 'Contraseña Inicial'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400"><Icon name="lock" /></span>
                                    <input 
                                        required={!editingId}
                                        type="password"
                                        value={formData.password} 
                                        onChange={e => setFormData({...formData, password: e.target.value})} 
                                        className="w-full bg-slate-50 dark:bg-[#111218] border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm placeholder:text-slate-400" 
                                        placeholder={editingId ? "Dejar en blanco para mantener" : "Mínimo 6 caracteres"}
                                        minLength={6}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    {editingId 
                                        ? "Nota: Actualiza el registro administrativo. El usuario deberá restablecer su contraseña vía correo para sincronizar el acceso." 
                                        : "Se usará para el primer inicio de sesión."}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">Estado</label>
                                <div className="relative">
                                    <select 
                                        value={formData.status}
                                        onChange={e => setFormData({...formData, status: e.target.value as 'Activo' | 'Inactivo'})}
                                        className="w-full appearance-none bg-slate-50 dark:bg-[#111218] border border-slate-200 dark:border-slate-700 rounded-lg pl-4 pr-10 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm cursor-pointer"
                                    >
                                        <option value="Activo">Activo</option>
                                        <option value="Inactivo">Inactivo</option>
                                    </select>
                                    <span className="absolute right-3 top-2.5 text-slate-400 pointer-events-none"><Icon name="expand_more" /></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
                        <button 
                            type="button" 
                            onClick={handleCloseModal}
                            className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-[#252f44] transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={submitting}
                            className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <Icon name={submitting ? "sync" : "save"} className={submitting ? "animate-spin" : ""} />
                            {submitting ? 'Guardando...' : (editingId ? 'Actualizar Profesor' : 'Guardar Profesor')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </main>
  );
};

export default TeacherList;

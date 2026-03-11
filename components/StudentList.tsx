
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from './Icon';
import StudentDetailsModal from './StudentDetailsModal';
import { getStudents, updateStudent, getMessageTemplates, createPackageFromEnrollment } from '../services/db';
import { Student, MessageTemplate, AppUser } from '../types';
import { auth } from '../firebase';
import { syncCurrentUserToFirestore } from '../services/db';
// @ts-ignore
import html2canvas from 'html2canvas';

interface StudentListProps {
    onNavigate?: (view: string) => void;
    userProfile?: AppUser | null;
}

// ... (Existing Stats Component - Unchanged)
const StudentStats: React.FC<{ students: Student[] }> = ({ students }) => {
    // Only count NON-archived students for general stats
    const activePool = students.filter(s => !s.isArchived);
    
    const total = activePool.length;
    const pending = activePool.filter(s => s.status === 'Pendiente').length;
    const active = activePool.filter(s => s.status === 'Activo' || s.status === 'Pagado').length;
    
    // New this month (Fixed Timezone Bug)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const newThisMonth = activePool.filter(s => {
        if(!s.date) return false;
        // Parse date string YYYY-MM-DD
        const [year, month] = s.date.split('-').map(Number);
        // month is 1-12, currentMonth is 0-11
        return (month - 1) === currentMonth && year === currentYear;
    }).length;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 pb-6">
            <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Estudiantes</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{total}</p>
                </div>
                <div className="p-2 sm:p-3 bg-blue-500/10 text-blue-600 rounded-lg hidden sm:block">
                    <Icon name="groups" className="text-xl sm:text-2xl" />
                </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Activos</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{active}</p>
                </div>
                <div className="p-2 sm:p-3 bg-emerald-500/10 text-emerald-600 rounded-lg hidden sm:block">
                    <Icon name="check_circle" className="text-xl sm:text-2xl" />
                </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Pendientes Pago</p>
                    <p className="text-2xl font-black text-orange-500 mt-1">{pending}</p>
                </div>
                <div className="p-2 sm:p-3 bg-orange-500/10 text-orange-500 rounded-lg hidden sm:block">
                    <Icon name="pending_actions" className="text-xl sm:text-2xl" />
                </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Nuevos (Mes)</p>
                    <p className="text-2xl font-black text-indigo-500 mt-1">+{newThisMonth}</p>
                </div>
                <div className="p-2 sm:p-3 bg-indigo-500/10 text-indigo-500 rounded-lg hidden sm:block">
                    <Icon name="person_add" className="text-xl sm:text-2xl" />
                </div>
            </div>
        </div>
    );
};

const StudentList: React.FC<StudentListProps> = ({ onNavigate, userProfile }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  
  // View State (Active / Archived)
  const [viewMode, setViewMode] = useState<'Active' | 'Archived'>('Active');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourseId, setFilterCourseId] = useState(''); // REFACTORED: Using ID
  const [filterStatus, setFilterStatus] = useState('');

  // Hidden Ticket Ref for List-based Approval
  const listTicketRef = useRef<HTMLDivElement>(null);
  const [ticketStudent, setTicketStudent] = useState<Student | null>(null);

  const fetchData = async () => {
      setLoading(true);
      const data = await getStudents();
      setStudents(data);
      setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Check permissions
    const checkPerms = async () => {
        let profile = userProfile;
        if (!profile) {
            const u = auth.currentUser;
            if(u) {
                profile = await syncCurrentUserToFirestore(u);
            }
        }
        
        if(profile) {
            if(profile.isSuperAdmin || profile.permissions.students === 'edit' || (profile.permissions.students as any) === true) {
                setCanEdit(true);
            }
        }
    };
    checkPerms();
  }, [userProfile]);

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  // --- QUICK APPROVE HANDLER WITH TICKET GEN ---
  const handleQuickApprove = async (e: React.MouseEvent, student: Student) => {
      e.stopPropagation();
      if (!canEdit) return; // Guard
      if (!confirm(`¿Confirmar pago y activar a ${student.name}?`)) return;
      
      try {
          // 1. Prepare Ticket Data (State triggers render of hidden div)
          setTicketStudent(student);
          // Allow DOM update
          await new Promise(r => setTimeout(r, 200));

          // 2. Generate Ticket
          if (listTicketRef.current) {
              const canvas = await html2canvas(listTicketRef.current, { scale: 2, backgroundColor: null, useCORS: true });
              
              canvas.toBlob(async (blob: Blob | null) => {
                  if (blob) {
                      try {
                          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                          
                          // 3. Prepare Message (Template)
                          let message = `¡Bienvenido/a ${student.name.split(' ')[0]}! 🎓\n\nTu inscripción al curso *${student.course}* está confirmada.\n\n🎟️ *Adjunto encontrarás tu Ticket de Acceso.*\n\n*Credenciales del Portal:*\n👤 ID: ${student.email}\n🔒 Clave: ${student.lastName || 'Tu Apellido'}\n\n👉 Accede aquí: www.georgetownenglish.com/student/login`;
                          
                          // Try to fetch saved template
                          const templates = await getMessageTemplates();
                          const welcomeTemplate = templates.find(t => t.type === 'welcome' && t.isDefault);
                          if (welcomeTemplate) {
                              message = welcomeTemplate.content
                                  .replace(/{{studentName}}/g, student.name)
                                  .replace(/{{course}}/g, student.course)
                                  .replace(/{{email}}/g, student.email || '')
                                  .replace(/{{password}}/g, student.lastName || 'Tu Apellido')
                                  .replace(/{{portalLink}}/g, `www.georgetownenglish.com/student/login`);
                          }

                          // 4. Alert User
                          alert("✅ Ticket copiado al portapapeles.\n\nSe abrirá WhatsApp ahora. Por favor presione 'Pegar' (Ctrl+V) en el chat para enviar la imagen.");

                          // 5. Open WhatsApp - Strict Encoding for Emojis
                          const phone = student.phone.replace(/[^0-9]/g, '');
                          const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
                          window.open(url, '_blank');
                          
                      } catch (err) {
                          console.error("Clipboard error", err);
                          alert("Error al copiar ticket. Revise permisos del navegador.");
                      }
                  }
              });
          }

          // 6. Update DB
          const now = new Date();
          const localDateStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
          await updateStudent(student.id, { 
              status: 'Activo', 
              lastPaymentDate: localDateStr
          });

          // --- 7. NEW: AUTO-CREATE PACKAGE (BULLETPROOF) ---
          // Wrapped in try-catch to ensure main approval never fails even if this does.
          if (student.monthsIntended && student.monthsIntended > 1) {
              try {
                  console.log(`[Package] Attempting to auto-create package for ${student.name}...`);
                  await createPackageFromEnrollment(student);
                  console.log(`[Package] Success.`);
              } catch (pkgError) {
                  console.error("[Package] Auto-creation failed:", pkgError);
                  // Non-blocking alert only
                  alert(`⚠️ El estudiante fue activado, pero hubo un error creando el registro de Membresía (Paquete).\n\nPor favor cree el paquete manualmente en la sección de Membresías.`);
              }
          }
          // -------------------------------------------------
          
          fetchData(); // Refresh
          setTicketStudent(null); // Cleanup

      } catch (e) {
          console.error(e);
          alert("Error al actualizar.");
      }
  };

  // Filter Logic
  const filteredStudents = useMemo(() => {
      return students.filter(student => {
          // 1. View Mode Filter (Active vs Archived)
          if (viewMode === 'Active') {
              if (student.isArchived) return false;
          } else {
              if (!student.isArchived) return false;
          }

          // 2. Search & Dropdowns
          const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                student.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                student.phone.includes(searchTerm);
          
          // REFACTORED: Use courseId for precise filtering if available
          const matchesCourse = filterCourseId ? student.courseId === filterCourseId : true;
          
          const matchesStatus = filterStatus ? student.status === filterStatus : true;
          
          return matchesSearch && matchesCourse && matchesStatus;
      });
  }, [students, searchTerm, filterCourseId, filterStatus, viewMode]);

  // Unique Courses for Filter Dropdown (REFACTORED: Map ID -> Name)
  const uniqueCourses = useMemo(() => {
      const relevantStudents = students.filter(s => viewMode === 'Active' ? !s.isArchived : s.isArchived);
      const courseMap = new Map<string, string>(); // ID -> Name
      
      relevantStudents.forEach(s => {
          if (s.courseId && s.course) {
              courseMap.set(s.courseId, s.course);
          }
      });
      
      // Convert to array and sort by NAME
      return Array.from(courseMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, viewMode]);

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap justify-between items-end gap-4">
             <div className="flex flex-col gap-1">
                <h2 className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">Gestión de Estudiantes</h2>
                <p className="text-slate-500 dark:text-text-secondary text-sm">Administra inscripciones, pagos y estados académicos.</p>
             </div>
             <div className="flex gap-3">
                 {canEdit && (
                     <button 
                        onClick={() => onNavigate && onNavigate('enrollment')}
                        className="flex items-center justify-center gap-2 rounded-lg h-10 px-5 bg-primary hover:bg-primary-dark text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                     >
                       <Icon name="person_add" className="text-xl" />
                       <span>Nueva Inscripción</span>
                     </button>
                 )}
             </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2">
              <button 
                  onClick={() => setViewMode('Active')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${viewMode === 'Active' ? 'bg-slate-100 dark:bg-surface-highlight text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                  Estudiantes Activos
              </button>
              <button 
                  onClick={() => setViewMode('Archived')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${viewMode === 'Archived' ? 'bg-slate-100 dark:bg-surface-highlight text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                  Archivados (Histórico)
              </button>
          </div>
        </div>
      </header>

      {/* Stats Section (Only show for Active view) */}
      {viewMode === 'Active' && (
          <div className="mt-6">
              <StudentStats students={students} />
          </div>
      )}

      {/* Filters */}
      <div className={`px-6 pb-4 shrink-0 ${viewMode === 'Archived' ? 'pt-6' : ''}`}>
         <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex-1 w-full lg:max-w-md">
               <label className="relative flex items-center w-full">
                  <span className="absolute left-3 text-slate-500 material-symbols-outlined">search</span>
                  <input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-[#252f44] dark:text-white text-slate-900 placeholder:text-slate-500 rounded-lg pl-10 pr-4 py-2.5 border-none focus:ring-2 focus:ring-primary text-sm font-normal" 
                    placeholder="Buscar por nombre, ID o teléfono" 
                  />
               </label>
            </div>
            <div className="flex flex-wrap gap-3 w-full lg:w-auto items-center">
               <div className="relative min-w-[180px] flex-1 lg:flex-none">
                  <select 
                    value={filterCourseId}
                    onChange={(e) => setFilterCourseId(e.target.value)}
                    className="appearance-none w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                     <option value="">Todos los cursos</option>
                     {uniqueCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Icon name="expand_more" className="absolute right-3 top-2.5 pointer-events-none text-slate-500" />
               </div>
               {viewMode === 'Active' && (
                   <div className="relative min-w-[140px] flex-1 lg:flex-none">
                      <select 
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="appearance-none w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                      >
                         <option value="">Todos los estados</option>
                         <option value="Activo">Activo</option>
                         <option value="Pendiente">Pendiente</option>
                         <option value="Pausado">Pausado</option>
                      </select>
                      <Icon name="expand_more" className="absolute right-3 top-2.5 pointer-events-none text-slate-500" />
                   </div>
               )}
               <button 
                onClick={() => { setSearchTerm(''); setFilterCourseId(''); setFilterStatus(''); }}
                className="flex items-center justify-center size-10 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-surface-highlight text-slate-500 transition-colors" 
                title="Limpiar filtros"
               >
                  <Icon name="filter_alt_off" />
               </button>
            </div>
         </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto px-6 pb-6">
         <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 min-w-[900px] overflow-hidden">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-50 dark:bg-surface-highlight border-b border-slate-200 dark:border-slate-800">
                     <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-secondary">Estudiante</th>
                     <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-secondary">Contacto</th>
                     <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-secondary">Curso / Programa</th>
                     <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-secondary">Método Pago</th>
                     <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-secondary">Estado</th>
                     <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-secondary text-right">Acciones</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-text-secondary">
                        <div className="flex flex-col items-center gap-2">
                          <Icon name="sync" className="animate-spin text-2xl" />
                          <span>Cargando estudiantes...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-text-secondary">
                        {viewMode === 'Active' ? 'No se encontraron estudiantes activos con los filtros actuales.' : 'No hay estudiantes archivados.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => (
                     <tr 
                        key={student.id} 
                        onClick={() => handleEdit(student)}
                        className={`transition-colors group cursor-pointer ${
                            student.status === 'Pendiente' 
                                ? 'bg-orange-50/50 hover:bg-orange-100/50 dark:bg-orange-900/10 dark:hover:bg-orange-900/20' 
                                : 'hover:bg-slate-50 dark:hover:bg-surface-highlight/30'
                        }`}
                     >
                        <td className="py-3 px-4">
                           <div className="flex items-center gap-3">
                              <div className={`size-9 rounded-full flex items-center justify-center font-bold text-sm ${student.status === 'Pendiente' ? 'bg-orange-200 text-orange-700' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                {student.name.substring(0,2).toUpperCase()}
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-slate-900 dark:text-white">{student.name}</p>
                                 <p className="text-xs text-slate-500 dark:text-text-secondary font-mono">{student.studentId}</p>
                              </div>
                           </div>
                        </td>
                        <td className="py-3 px-4">
                           <p className="text-sm text-slate-900 dark:text-slate-300">{student.phone}</p>
                           <p className="text-xs text-slate-500 dark:text-text-secondary">{student.email}</p>
                        </td>
                        <td className="py-3 px-4">
                           <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              {student.course}
                           </span>
                        </td>
                        <td className="py-3 px-4">
                           <div className="flex flex-col gap-1">
                               <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                   {student.paymentMethod === 'transfer' ? 'Transferencia' : 
                                    student.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo'}
                               </span>
                               {student.paymentReceiptUrl && (
                                   <span className="flex items-center gap-1 text-[10px] text-blue-500 font-bold">
                                       <Icon name="attachment" className="text-[12px]" /> Comprobante
                                   </span>
                               )}
                           </div>
                        </td>
                        <td className="py-3 px-4">
                           <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                               student.status === 'Pendiente' 
                                ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800'
                                : student.status === 'Activo' || student.status === 'Pagado'
                                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                           }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${student.status === 'Activo' ? 'bg-green-500' : student.status === 'Pendiente' ? 'bg-orange-500 animate-pulse' : 'bg-slate-500'}`}></span>
                              {student.status}
                           </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                           <div className="flex items-center justify-end gap-2">
                              {student.status === 'Pendiente' && canEdit && !student.isArchived && (
                                  <button 
                                    onClick={(e) => handleQuickApprove(e, student)}
                                    className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 p-1.5 rounded-md transition-colors"
                                    title="Aprobar Pago"
                                  >
                                      <Icon name="check" className="text-lg font-bold" />
                                  </button>
                              )}
                              <button className="text-slate-400 hover:text-primary dark:hover:text-primary transition-colors p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
                                 <Icon name={canEdit ? "edit" : "visibility"} className="text-xl" />
                              </button>
                           </div>
                        </td>
                     </tr>
                  )))}
               </tbody>
            </table>
         </div>
      </div>
      
      {/* Modal */}
      {selectedStudent && (
        <StudentDetailsModal 
           isOpen={isModalOpen} 
           onClose={() => setIsModalOpen(false)} 
           student={selectedStudent} 
           onUpdate={fetchData}
        />
      )}

      {/* --- HIDDEN TICKET TEMPLATE FOR LIST APPROVAL --- */}
      {ticketStudent && (
        <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
            <div 
                ref={listTicketRef}
                className="w-[400px] h-[600px] bg-[#111418] text-white font-display flex flex-col overflow-hidden relative"
            >
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                {/* Header */}
                <div className="relative z-10 p-6 pt-8 text-center border-b border-white/10">
                    <p className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.3em] mb-2">Georgetown Academy</p>
                    <h1 className="text-3xl font-black uppercase tracking-tight leading-none text-white">Boarding Pass</h1>
                    {/* Centered ID Badge */}
                    <div className="mt-4 flex justify-center">
                        <div className="flex h-7 items-center justify-center bg-white/10 px-4 rounded border border-white/10 text-[10px] font-mono text-primary font-bold">
                            ID: {ticketStudent.studentId}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="relative z-10 p-6 flex-1 flex flex-col gap-5">
                    <div className="flex justify-between items-end border-b border-white/10 pb-3">
                        <div className="flex-1 mr-4 min-w-0">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Estudiante</p>
                            {/* Allow multiline */}
                            <p className="text-lg font-bold leading-tight mt-0.5 break-words">{ticketStudent.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Fecha</p>
                            <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="border-b border-white/10 pb-3">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold mb-1">Curso / Programa</p>
                        <p className="text-xl font-black text-primary leading-tight break-words">{ticketStudent.course}</p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-3 text-center">Credenciales de Acceso</p>
                        <div className="grid grid-cols-1 gap-2">
                            <div className="flex justify-between items-start text-xs gap-2">
                                <span className="text-gray-500 shrink-0 mt-0.5">Portal:</span>
                                <span className="font-mono text-white tracking-tight text-[9px] text-right leading-tight break-all">www.georgetownenglish.com/student/login</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500">ID Usuario:</span>
                                <span className="font-mono text-white">{ticketStudent.email}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500">Contraseña:</span>
                                <span className="font-mono text-white">{ticketStudent.lastName || 'Tu Apellido'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer QR Code */}
                <div className="relative z-10 p-6 pt-0 flex justify-between items-center mt-auto">
                    <div className="bg-white p-1 rounded-lg">
                        {/* Real QR Code using simple API */}
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticketStudent.studentId}&color=000000&bgcolor=FFFFFF`} 
                            alt="Student QR" 
                            className="w-16 h-16 object-contain"
                        />
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] text-gray-500 uppercase">Estado</p>
                        <p className="text-lg font-bold text-emerald-500">CONFIRMADO</p>
                    </div>
                </div>
            </div>
        </div>
      )}
    </main>
  );
};

export default StudentList;

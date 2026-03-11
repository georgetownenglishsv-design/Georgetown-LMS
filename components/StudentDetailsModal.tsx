
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Student } from '../types';
import { updateStudent, deleteStudent, getMessageTemplates } from '../services/db';
// @ts-ignore
import html2canvas from 'html2canvas';

interface StudentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  onUpdate: () => void; // Callback to refresh list
}

const StudentDetailsModal: React.FC<StudentDetailsModalProps> = ({ isOpen, onClose, student, onUpdate }) => {
  if (!isOpen) return null;
  
  const [activeTab, setActiveTab] = useState<'info' | 'payment'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  
  // Ticket Generation Ref
  const ticketRef = useRef<HTMLDivElement>(null);
  
  // Form State
  const [formData, setFormData] = useState({
      name: student.name,
      phone: student.phone,
      parentPhone: student.parentPhone,
      email: student.email || '',
      status: student.status,
      date: student.date || ''
  });

  // Reset form when student changes
  useEffect(() => {
      setFormData({
          name: student.name,
          phone: student.phone,
          parentPhone: student.parentPhone,
          email: student.email || '',
          status: student.status,
          date: student.date || ''
      });
      // If student is pending, default to payment tab to check receipt
      if (student.status === 'Pendiente') {
          setActiveTab('payment');
      } else {
          setActiveTab('info');
      }
  }, [student]);

  const handleDelete = async () => {
      if (!confirm("⚠️ ¿Estás seguro de eliminar este estudiante?\nEsta acción no se puede deshacer.")) return;
      
      try {
          setSubmitting(true);
          await deleteStudent(student.id);
          alert("Estudiante eliminado correctamente.");
          onUpdate();
          onClose();
      } catch (e) {
          alert("Error al eliminar.");
      } finally {
          setSubmitting(false);
      }
  };

  const handleSave = async (e?: React.FormEvent) => {
      if(e) e.preventDefault();
      try {
          setSubmitting(true);
          await updateStudent(student.id, formData);
          alert("Información actualizada.");
          setIsEditing(false);
          onUpdate();
      } catch (e) {
          alert("Error al guardar.");
      } finally {
          setSubmitting(false);
      }
  };

  const generateAndCopyTicket = async () => {
      if (!ticketRef.current) return false;
      try {
          // Small delay to ensure render
          await new Promise(r => setTimeout(r, 200));
          
          const canvas = await html2canvas(ticketRef.current, {
              scale: 2,
              backgroundColor: null,
              useCORS: true
          });
          
          return new Promise<boolean>((resolve) => {
              canvas.toBlob(async (blob: Blob | null) => {
                  if (blob) {
                      try {
                          await navigator.clipboard.write([
                              new ClipboardItem({ 'image/png': blob })
                          ]);
                          resolve(true);
                      } catch (err) {
                          console.error("Clipboard API failed", err);
                          resolve(false);
                      }
                  } else {
                      resolve(false);
                  }
              });
          });
      } catch (e) {
          console.error("Ticket gen error", e);
          return false;
      }
  };

  const togglePaymentStatus = async () => {
      const newStatus = student.status === 'Pendiente' ? 'Activo' : 'Pendiente';
      const confirmMsg = newStatus === 'Activo' 
          ? "¿Confirmar pago y activar estudiante?\n\n💡 Esto generará el Ticket de Bienvenida y copiará la imagen al portapapeles." 
          : "¿Revocar pago y devolver a estado pendiente?";
      
      if (!confirm(confirmMsg)) return;

      try {
          setSubmitting(true);
          
          const now = new Date();
          const localDateStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

          let ticketCopied = false;

          // If Activating, generate ticket first
          if (newStatus === 'Activo') {
              ticketCopied = await generateAndCopyTicket();
              
              if (ticketCopied) {
                  // Fetch Template
                  const templates = await getMessageTemplates();
                  const welcomeTemplate = templates.find(t => t.type === 'welcome' && t.isDefault);
                  
                  let message = `¡Bienvenido/a {{studentName}}! 🎓\n\nTu inscripción al curso *{{course}}* está confirmada.\n\n🎟️ *Adjunto encontrarás tu Ticket de Acceso.*\n\n*Credenciales del Portal:*\n👤 ID: {{email}}\n🔒 Clave: {{password}}\n\n👉 Accede aquí: {{portalLink}}`;
                  
                  if (welcomeTemplate) {
                      message = welcomeTemplate.content;
                  }

                  // Replace variables
                  message = message
                      .replace(/{{studentName}}/g, student.name)
                      .replace(/{{course}}/g, student.course)
                      .replace(/{{email}}/g, student.email || '')
                      .replace(/{{password}}/g, student.lastName || 'Tu Apellido')
                      .replace(/{{portalLink}}/g, `www.georgetownenglish.com/student/login`);

                  // Open WhatsApp
                  const phone = student.phone.replace(/[^0-9]/g, '');
                  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
                  
                  // ALERT BEFORE OPENING
                  alert("✨ Ticket copiado al portapapeles.\n\nCuando se abra WhatsApp, presiona 'Pegar' (Ctrl+V) para adjuntar la imagen junto con el mensaje.");
                  
                  window.open(url, '_blank');
              }
          }

          await updateStudent(student.id, { 
              status: newStatus,
              ...(newStatus === 'Activo' ? { lastPaymentDate: localDateStr } : {}) 
          });
          
          setFormData(prev => ({ ...prev, status: newStatus }));
          
          if (!ticketCopied && newStatus === 'Activo') {
              alert("Estudiante activado, pero no se pudo generar el ticket visual automáticamente.");
          }
          
          onUpdate();
          onClose();
      } catch (e) {
          console.error(e);
          alert("Error al actualizar estado.");
      } finally {
          setSubmitting(false);
      }
  };

  return (
    <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity" onClick={onClose}></div>
        
        {/* Modal Content - Luxury Redesign */}
        <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#151c27] rounded-[2rem] shadow-2xl ring-1 ring-white/10 flex flex-col animate-in zoom-in-95 duration-300 no-scrollbar">
            
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/90 dark:bg-[#151c27]/90 backdrop-blur-xl z-20">
                <div className="flex flex-col gap-0.5">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                        {isEditing ? 'Edición de Perfil' : 'Expediente del Estudiante'}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-widest">ID: {student.studentId}</span>
                    </div>
                </div>
                <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all transform hover:rotate-90">
                    <Icon name="close" className="text-2xl" />
                </button>
            </div>

            <div className="p-8">
                {/* Status Banner - Enhanced */}
                <div className={`mb-8 p-6 rounded-3xl border-2 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 transition-all ${student.status === 'Pendiente' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`size-14 rounded-2xl flex items-center justify-center shadow-inner ${student.status === 'Pendiente' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            <Icon name={student.status === 'Pendiente' ? 'pending' : 'verified'} className="text-3xl" />
                        </div>
                        <div className="text-center sm:text-left">
                            <p className={`text-sm font-black uppercase tracking-widest ${student.status === 'Pendiente' ? 'text-amber-800 dark:text-amber-400' : 'text-emerald-800 dark:text-emerald-400'}`}>
                                Estado: {student.status}
                            </p>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                {student.status === 'Pendiente' ? 'El registro espera aprobación administrativa.' : 'Inscripción aprobada y curso habilitado.'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={togglePaymentStatus}
                        disabled={submitting}
                        className={`w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 uppercase tracking-widest ${
                            student.status === 'Pendiente' 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20' 
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        {submitting ? 'Procesando...' : (student.status === 'Pendiente' ? 'Aprobar & Enviar Ticket' : 'Revocar Acceso')}
                    </button>
                </div>

                {/* Tabs - Modern Minimalist */}
                <div className="flex gap-2 mb-8 bg-slate-100/50 dark:bg-black/20 p-1.5 rounded-2xl w-fit">
                    <button onClick={() => setActiveTab('info')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'info' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Icon name="person" className="text-lg" /> Perfil Personal
                    </button>
                    <button onClick={() => setActiveTab('payment')} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'payment' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Icon name="receipt_long" className="text-lg" /> Comprobante
                    </button>
                </div>

                {/* Content Body */}
                {activeTab === 'info' && (
                    <form onSubmit={handleSave} className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* 2x2 Luxury Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <div className="space-y-1.5 group">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-widest group-focus-within:text-primary transition-colors">Nombre Completo</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-primary transition-colors"><Icon name="person_outline" /></span>
                                    <input 
                                        disabled={!isEditing}
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-[#111621] border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:opacity-70 disabled:grayscale"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5 group">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-widest group-focus-within:text-primary transition-colors">Correo Electrónico</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-primary transition-colors"><Icon name="mail_outline" /></span>
                                    <input 
                                        disabled={!isEditing}
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-[#111621] border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:opacity-70 disabled:grayscale"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5 group">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-widest group-focus-within:text-primary transition-colors">Teléfono Personal</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-primary transition-colors"><Icon name="smartphone" /></span>
                                    <input 
                                        disabled={!isEditing}
                                        value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-[#111621] border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:opacity-70 disabled:grayscale"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5 group">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-widest group-focus-within:text-primary transition-colors">Teléfono Tutor / Alternativo</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-primary transition-colors"><Icon name="supervisor_account" /></span>
                                    <input 
                                        disabled={!isEditing}
                                        value={formData.parentPhone}
                                        onChange={e => setFormData({...formData, parentPhone: e.target.value})}
                                        className="w-full bg-slate-50 dark:bg-[#111621] border border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:opacity-70 disabled:grayscale"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Removed save button from here, moved to footer */}
                    </form>
                )}

                {activeTab === 'payment' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Método de Pago</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white capitalize flex items-center gap-2">
                                    <Icon name={student.paymentMethod === 'card' ? 'credit_card' : 'account_balance'} className="text-primary" />
                                    {student.paymentMethod === 'card' ? 'Tarjeta (Compra-Click)' : student.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha de Registro</p>
                                {isEditing ? (
                                    <input 
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({...formData, date: e.target.value})}
                                        className="w-full bg-white dark:bg-[#111621] border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                                    />
                                ) : (
                                    <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Icon name="calendar_today" className="text-primary" />
                                        {student.date}
                                    </p>
                                )}
                            </div>
                            <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plan Seleccionado</p>
                                <p className="text-sm font-bold text-primary flex items-center gap-2 truncate">
                                    <Icon name="school" />
                                    {student.course}
                                </p>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    <Icon name="image" className="text-primary" /> Imagen del Comprobante
                                </h4>
                                {student.paymentReceiptUrl && (
                                    <button onClick={() => setShowImagePreview(true)} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">Pantalla Completa</button>
                                )}
                            </div>
                            
                            {student.paymentReceiptUrl ? (
                                <div className="group relative rounded-3xl overflow-hidden border-4 border-slate-50 dark:border-slate-800 bg-white dark:bg-black/40 shadow-xl transition-all hover:shadow-2xl">
                                    <img 
                                        src={student.paymentReceiptUrl} 
                                        alt="Comprobante" 
                                        className="w-full h-auto max-h-[450px] object-contain transition-transform duration-700 group-hover:scale-[1.02]"
                                    />
                                    <div 
                                        onClick={() => setShowImagePreview(true)}
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer backdrop-blur-[2px]"
                                    >
                                        <div className="size-16 rounded-full bg-white/20 flex items-center justify-center mb-2">
                                            <Icon name="zoom_in" className="text-4xl" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest">Ampliar Imagen</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-black/20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] text-slate-400">
                                    <div className="size-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                        <Icon name="image_not_supported" className="text-4xl opacity-40" />
                                    </div>
                                    <p className="text-sm font-bold opacity-60">Sin comprobante digital adjunto</p>
                                    {student.paymentMethod === 'cash' && <p className="text-[10px] font-black text-amber-500 mt-2 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full">Pago Presencial en Efectivo</p>}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Footer Actions - Luxury Minimalist */}
            <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 z-10">
                <button onClick={handleDelete} className="w-full sm:w-auto order-last sm:order-first text-red-500 hover:text-white hover:bg-red-500 font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    <Icon name="delete" /> Eliminar Estudiante
                </button>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={onClose} className="flex-1 sm:flex-none px-8 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                        Cerrar
                    </button>
                    {!isEditing && (
                        <button onClick={() => setIsEditing(true)} className="flex-1 sm:flex-none px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 shadow-lg transition-all flex items-center justify-center gap-2">
                            <Icon name="edit" /> Editar
                        </button>
                    )}
                    {isEditing && (
                        <button onClick={handleSave} disabled={submitting} className="flex-1 sm:flex-none px-8 py-3 bg-primary hover:bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95">
                            <Icon name="save" /> Guardar
                        </button>
                    )}
                </div>
            </div>
        </div>
        </div>

        {/* Full Screen Image Preview Modal (Lightbox) */}
        {showImagePreview && student.paymentReceiptUrl && (
            <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
                <button 
                    onClick={() => setShowImagePreview(false)}
                    className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all transform hover:rotate-90 z-[110]"
                >
                    <Icon name="close" className="text-3xl" />
                </button>
                <div className="w-full h-full flex items-center justify-center p-4 md:p-10">
                    <img 
                        src={student.paymentReceiptUrl} 
                        alt="Comprobante Full" 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                </div>
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-white/70 text-xs font-bold uppercase tracking-[0.2em]">
                    Comprobante :: {student.name}
                </div>
            </div>
        )}

        {/* --- HIDDEN TICKET TEMPLATE FOR GENERATION --- */}
        {/* We render this off-screen but in DOM to capture it */}
        <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
            <div 
                ref={ticketRef}
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
                            ID: {student.studentId}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="relative z-10 p-6 flex-1 flex flex-col gap-5">
                    <div className="flex justify-between items-end border-b border-white/10 pb-3">
                        <div className="flex-1 mr-4 min-w-0">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Estudiante</p>
                            {/* Allow multiline + word break */}
                            <p className="text-lg font-bold leading-tight mt-0.5 break-words">{student.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Fecha</p>
                            <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="border-b border-white/10 pb-3">
                        <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold mb-1">Curso / Programa</p>
                        <p className="text-xl font-black text-primary leading-tight break-words">{student.course}</p>
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
                                <span className="font-mono text-white">{student.email}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500">Contraseña:</span>
                                <span className="font-mono text-white">{student.lastName || 'Tu Apellido'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer QR Code */}
                <div className="relative z-10 p-6 pt-0 flex justify-between items-center mt-auto">
                    <div className="bg-white p-1 rounded-lg">
                        {/* Real QR Code using simple API */}
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${student.studentId}&color=000000&bgcolor=FFFFFF`} 
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
    </>
  );
};

export default StudentDetailsModal;

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { getExams, getExamRegistrations, addExam, updateExam, deleteExam, db, updateExamRegistration, deleteExamRegistration, toggleExamPaymentStatus, verifyDataIntegrity, firebase, createIndividualMockTicket } from '../services/db'; 
import { getMockTests } from '../services/mockTest';
import { Exam, ExamRegistration, MockTest } from '../types';
// @ts-ignore
import html2canvas from 'html2canvas';

interface ExamListProps {
    onViewRegistration: (regId: string) => void;
}

const isRegistrationFinished = (reg: ExamRegistration) => {
    if (!reg.selectedDate || !reg.selectedTime) return false;
    const dateTimeStr = `${reg.selectedDate}T${reg.selectedTime}`;
    const examDate = new Date(dateTimeStr);
    examDate.setHours(examDate.getHours() + 3);
    return new Date() > examDate;
};

const ExamList: React.FC<ExamListProps> = ({ onViewRegistration }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<ExamRegistration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);

  const [showPastRegs, setShowPastRegs] = useState(false);
  const [regSearchTerm, setRegSearchTerm] = useState('');

  // CRUD State for EXAMS
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
      name: '',
      mode: 'presencial' as 'online' | 'presencial',
      type: 'Offline' as 'Offline' | 'OnlineMock', // NEW
      allowedPaymentMethods: ['cash'] as ('card' | 'transfer' | 'cash')[], // FIX: Explicitly type the array
      paymentLink: '',
      price: '',
      originalPrice: '', // NEW
      discountBadgeText: '', // NEW
      order: '', // NEW: Display Order
      colorClass: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
      icon: 'school',
      status: 'Active' as 'Active' | 'Draft' | 'Archived'
  });

  // Approval Modal State
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvingReg, setApprovingReg] = useState<ExamRegistration | null>(null);
  const [approvingExam, setApprovingExam] = useState<Exam | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [availableTests, setAvailableTests] = useState<MockTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const ticketRef = useRef<HTMLDivElement>(null);

  // CRUD State for REGISTRATIONS
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<ExamRegistration | null>(null);
  const [regFormData, setRegFormData] = useState({
      studentName: '',
      studentEmail: '',
      phone: '',
      dui: '',
      paymentStatus: 'Pendiente' as 'Confirmado' | 'Pendiente'
  });

  const [globalStats, setGlobalStats] = useState({
      activeExams: 0,
      totalEnrolled: 0,
      totalRevenue: 0,
      pendingAction: 0
  });

  const fetchExams = async () => {
      setLoading(true);
      const data = await getExams();
      setExams(data);
      
      const active = data.filter(e => e.status === 'Active');
      const enrolled = data.reduce((acc, e) => acc + (e.enrolled || 0), 0);
      const revenue = data.reduce((acc, e) => acc + ((e.paidCount || 0) * (e.price || 0)), 0);
      const pending = data.reduce((acc, e) => acc + (e.pendingCount || 0), 0);

      setGlobalStats({
          activeExams: active.length,
          totalEnrolled: enrolled,
          totalRevenue: revenue,
          pendingAction: pending
      });

      setLoading(false);
  };

  useEffect(() => {
    // Auto-heal on mount to ensure statistics are correct
    const init = async () => {
        setLoading(true);
        try {
            await verifyDataIntegrity(); // Ensure counters are accurate
        } catch(e) {
            console.warn("Auto-heal failed", e);
        }
        await fetchExams();
    };
    init();
  }, []);

  const handleSelectExam = async (exam: Exam) => {
      if (selectedExamId === exam.id) {
          setSelectedExamId(null);
          setRegistrations([]);
          setShowPastRegs(false);
          setRegSearchTerm('');
          return;
      }
      setSelectedExamId(exam.id);
      setLoadingRegs(true);
      try {
          const regs = await getExamRegistrations(exam.id);
          setRegistrations(regs);
      } finally {
          setLoadingRegs(false);
      }
  };

  const handleTogglePayment = async (reg: ExamRegistration) => {
      const isPending = reg.paymentStatus === 'Pendiente';
      
      if (!isPending) {
          // Revoke Logic (Simple)
          if(!confirm(`¿Revocar pago de ${reg.studentName || 'Estudiante'}?\nVolverá a estado pendiente.`)) return;
          try {
              await toggleExamPaymentStatus(reg.id, reg.examId);
              setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, paymentStatus: 'Pendiente' } : r));
              fetchExams(); 
              alert("Pago revocado.");
          } catch (e) {
              console.error(e);
              alert("Error al actualizar estado.");
          }
          return;
      }

      // Approve Logic (Wizard)
      const exam = exams.find(e => e.id === reg.examId);
      if (!exam) return;

      setApprovingReg(reg);
      setApprovingExam(exam);
      
      // Generate default code if OnlineMock OR if name implies it (Robust check)
      const isMock = exam.type === 'OnlineMock' || exam.name.toLowerCase().includes('mock') || exam.name.toLowerCase().includes('simulacro');
      
      if (isMock) {
          setAccessCode(`GT-MOCK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`);
          // Fetch available tests for selection
          getMockTests().then(tests => {
              const active = tests.filter(t => t.status === 'Active');
              setAvailableTests(active);
              if (active.length > 0) setSelectedTestId(active[0].id);
          });
      } else {
          setAccessCode('');
          setAvailableTests([]);
          setSelectedTestId('');
      }
      setApprovalModalOpen(true);
  };

  const confirmApproval = async () => {
      if (!approvingReg || !approvingExam) return;

      try {
          // 1. Update DB
          await toggleExamPaymentStatus(approvingReg.id, approvingReg.examId);
          
          // If Online Mock (or access code exists), save access code AND create ticket
          if (accessCode) {
              await updateExamRegistration(approvingReg.id, { accessCode });
              // Pass selectedTestId to createIndividualMockTicket
              await createIndividualMockTicket(accessCode, approvingReg.studentName || 'Estudiante', approvingReg.phone, selectedTestId);
          }

          // 2. Update Local State
          setRegistrations(prev => prev.map(r => r.id === approvingReg.id ? { ...r, paymentStatus: 'Confirmado', accessCode: accessCode || r.accessCode } : r));
          fetchExams();

          // 3. Generate Ticket & Message
          if (ticketRef.current) {
              // Wait for render
              await new Promise(r => setTimeout(r, 100));
              
              const canvas = await html2canvas(ticketRef.current, { scale: 2, backgroundColor: null, useCORS: true });
              canvas.toBlob(async (blob: Blob | null) => {
                  if (blob) {
                      try {
                          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                          
                          // Prepare Message
                          let message = '';
                          const studentFirstName = (approvingReg.studentName || 'Estudiante').split(' ')[0];
                          // Check if it's a mock test based on access code presence
                          if (accessCode) {
                              message = `🎓 *GEORGETOWN ACADEMY*\n*Official Mock Test Registration*\n\nHola ${studentFirstName}! 👋\nTu inscripción al examen *${approvingExam.name || ''}* está confirmada.\n\n🎫 *TU CÓDIGO DE ACCESO:*\n*${accessCode}*\n\n👇 *INSTRUCCIONES:*\n1. Ingresa al portal: https://www.georgetownenglish.com/toeicmocktest\n2. Escribe tu código de acceso.\n3. Presiona [Start Exam].\n\n⚠️ *Importante:*\n- El examen dura 2 horas.\n- Usa PC/Laptop con Chrome.\n- Asegúrate de tener buena conexión.\n\n¡Mucho éxito! 🍀`;
                          } else {
                              message = `🎓 *GEORGETOWN ACADEMY*\n*Confirmación de Examen*\n\nHola ${studentFirstName}! 👋\nTu cupo para el examen *${approvingExam.name || ''}* ha sido confirmado.\n\n📅 Fecha: ${approvingReg.selectedDate || 'Por definir'}\n⏰ Hora: ${approvingReg.selectedTime || 'Por definir'}\n📍 Lugar: Georgetown Academy (Presencial)\n\nPor favor llega 15 minutos antes. ¡Éxito! 🍀`;
                          }

                          alert("✅ Ticket copiado al portapapeles.\n\nSe abrirá WhatsApp. Presiona 'Pegar' (Ctrl+V) para enviar la imagen.");
                          
                          const phone = (approvingReg.phone || '').replace(/[^0-9]/g, '');
                          const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
                          window.open(url, '_blank');

                      } catch (err) {
                          console.error("Clipboard error", err);
                          alert("Aprobado, pero error al copiar ticket. Revise permisos.");
                      }
                  }
              });
          }

          setApprovalModalOpen(false);
          setApprovingReg(null);
          setApprovingExam(null);

      } catch (e) {
          console.error(e);
          alert("Error al aprobar.");
      }
  };

  // --- Registration CRUD Handlers ---

  const handleEditRegistration = (e: React.MouseEvent, reg: ExamRegistration) => {
      e.stopPropagation();
      setEditingReg(reg);
      setRegFormData({
          studentName: reg.studentName || '',
          studentEmail: reg.studentEmail || '',
          phone: reg.phone || '',
          dui: reg.dui || '',
          paymentStatus: reg.paymentStatus || 'Pendiente'
      });
      setIsRegModalOpen(true);
  };

  const handleDeleteRegistration = async (e: React.MouseEvent, reg: ExamRegistration) => {
      e.stopPropagation();
      if(!confirm(`¿Eliminar la inscripción de ${reg.studentName || 'Estudiante'}?\nEsta acción actualizará los contadores del examen.`)) return;
      
      try {
          // Transaction now reads status safely, no need to pass it
          await deleteExamRegistration(reg.id, reg.examId);
          setRegistrations(prev => prev.filter(r => r.id !== reg.id));
          fetchExams(); // Refresh global stats
          alert("Inscripción eliminada.");
      } catch (e) {
          console.error(e);
          alert("Error al eliminar inscripción.");
      }
  };

  const handleSaveRegistration = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingReg) return;
      
      setSaving(true);
      try {
          const statusChanged = regFormData.paymentStatus !== editingReg.paymentStatus;
          
          // The updated service now automatically handles counter adjustments if status changed
          await updateExamRegistration(editingReg.id, regFormData);
          
          // Refresh lists
          setRegistrations(prev => prev.map(r => r.id === editingReg.id ? { ...r, ...regFormData } : r));
          
          if (statusChanged) {
             fetchExams(); // Update global stats
          }

          setIsRegModalOpen(false);
          setEditingReg(null);
          alert("Datos actualizados correctamente.");
      } catch (e) {
          console.error(e);
          alert("Error al guardar cambios.");
      } finally {
          setSaving(false);
      }
  };

  // --- Exam CRUD Handlers ---
  const handleOpenModal = () => {
      setEditingExam(null);
      setFormData({ 
          name: '', 
          mode: 'presencial', 
          type: 'Offline', // Default
          allowedPaymentMethods: ['cash'] as ('card' | 'transfer' | 'cash')[], // Default
          paymentLink: '',
          price: '', 
          originalPrice: '', // NEW
          discountBadgeText: '', // NEW
          order: '', // NEW: Display Order
          colorClass: 'bg-slate-100 dark:bg-slate-800 text-slate-500', 
          icon: 'school', 
          status: 'Active' 
      });
      setIsModalOpen(true);
  };

  const handleEditExam = (e: React.MouseEvent, exam: Exam) => {
      e.stopPropagation();
      setEditingExam(exam);
      setFormData({
          name: exam.name || '',
          mode: exam.mode || 'presencial',
          type: exam.type || 'Offline', // Fallback
          allowedPaymentMethods: (exam.allowedPaymentMethods || ['cash']) as ('card' | 'transfer' | 'cash')[], // Fallback
          paymentLink: exam.paymentLink || '',
          price: (exam.price || 0).toString(),
          originalPrice: exam.originalPrice?.toString() || '', // NEW
          discountBadgeText: exam.discountBadgeText || '', // NEW
          order: exam.order?.toString() || '', // NEW
          colorClass: exam.colorClass || 'bg-slate-100 dark:bg-slate-800 text-slate-500',
          icon: exam.icon || 'school',
          status: exam.status || 'Active'
      });
      setIsModalOpen(true);
  };

  const handleDeleteExam = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!confirm("⚠️ ¿Eliminar este examen?\nSe eliminarán TODOS los registros de estudiantes asociados.")) return;
      try {
          await deleteExam(id);
          alert("Examen eliminado.");
          fetchExams();
          if (selectedExamId === id) setSelectedExamId(null);
      } catch (err) {
          alert("Error al eliminar.");
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
          const payload = { 
              ...formData, 
              price: Number(formData.price),
              originalPrice: (formData.originalPrice ? Number(formData.originalPrice) : null) as any,
              discountBadgeText: (formData.discountBadgeText || null) as any,
              order: (formData.order ? parseInt(formData.order) : null) as any
          };
          if (editingExam) {
              await updateExam(editingExam.id, payload);
              alert("Examen actualizado.");
          } else {
              await addExam(payload);
              alert("Examen creado.");
          }
          setIsModalOpen(false);
          fetchExams();
      } catch (err) {
          console.error(err);
          alert("Error al guardar.");
      } finally {
          setSaving(false);
      }
  };

  const filteredRegistrations = useMemo(() => {
      let filtered = registrations;
      if (!showPastRegs) {
          filtered = filtered.filter(r => !isRegistrationFinished(r));
      }
      if (regSearchTerm) {
          const lower = regSearchTerm.toLowerCase();
          filtered = filtered.filter(r => (r.studentName || '').toLowerCase().includes(lower) || (r.studentEmail || '').toLowerCase().includes(lower));
      }
      return filtered.sort((a, b) => {
          if (a.paymentStatus === 'Pendiente' && b.paymentStatus !== 'Pendiente') return -1;
          if (a.paymentStatus !== 'Pendiente' && b.paymentStatus === 'Pendiente') return 1;
          return new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime();
      });
  }, [registrations, showPastRegs, regSearchTerm]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <main className="flex-1 px-4 py-8 lg:px-10 overflow-y-auto bg-background-light dark:bg-background-dark">
      <div className="mx-auto max-w-[1400px] flex flex-col gap-8">
        
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Certificaciones & Exámenes</h1>
                <p className="text-slate-500 dark:text-text-secondary">Gestione cupos, pagos y logística de evaluaciones.</p>
            </div>
            <button onClick={handleOpenModal} className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2">
                <Icon name="add_circle" /> Crear Examen
            </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white dark:bg-surface-dark p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-3 md:p-3 opacity-5 group-hover:opacity-10 transition-opacity"><Icon name="event" className="text-5xl md:text-6xl" /></div>
                <p className="text-[10px] md:text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Exámenes Activos</p>
                <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{globalStats.activeExams}</p>
            </div>
            <div className="bg-white dark:bg-surface-dark p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-28">
                <p className="text-[10px] md:text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Total Inscritos</p>
                <p className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400">{globalStats.totalEnrolled}</p>
            </div>
            <div className="bg-white dark:bg-surface-dark p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden">
                {globalStats.pendingAction > 0 && <div className="absolute top-0 right-0 w-3 h-3 bg-orange-500 rounded-full m-3 animate-ping"></div>}
                <p className="text-[10px] md:text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Pagos Pendientes</p>
                <div className="flex items-center gap-2">
                    <p className={`text-2xl md:text-3xl font-black ${globalStats.pendingAction > 0 ? 'text-orange-500' : 'text-slate-900 dark:text-white'}`}>{globalStats.pendingAction}</p>
                    {globalStats.pendingAction > 0 && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Acción req.</span>}
                </div>
            </div>
            <div className="bg-white dark:bg-surface-dark p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-28">
                <p className="text-[10px] md:text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Ingresos Estimados</p>
                <p className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(globalStats.totalRevenue)}</p>
            </div>
        </div>

        <div className="flex flex-col gap-6">
            {exams.map(exam => {
                const isSelected = selectedExamId === exam.id;
                return (
                    <div key={exam.id} className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
                        <div onClick={() => handleSelectExam(exam)} className={`p-6 flex flex-col md:flex-row gap-6 cursor-pointer border-l-4 transition-colors ${isSelected ? 'border-l-primary bg-slate-50 dark:bg-[#151720]' : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-[#151720]/50'}`}>
                            <div className="flex items-center gap-4 flex-1">
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${exam.colorClass || 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    <Icon name={exam.icon || 'school'} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{exam.name || ''}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${exam.mode === 'online' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{exam.mode === 'online' ? 'Online' : 'Paper Based'}</span>
                                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">• ${exam.price || 0} USD</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 sm:gap-8 self-start md:self-center">
                                <div className="text-center"><p className="text-xs text-slate-400 font-bold uppercase">Inscritos</p><p className="font-black text-lg text-slate-900 dark:text-white">{exam.enrolled || 0}</p></div>
                                <div className="text-center"><p className="text-xs text-slate-400 font-bold uppercase">Pagados</p><p className="font-bold text-emerald-500">{exam.paidCount || 0}</p></div>
                                <div className="text-center"><p className="text-xs text-slate-400 font-bold uppercase">Pendientes</p><p className={`font-bold ${(exam.pendingCount || 0) > 0 ? 'text-orange-500 animate-pulse' : 'text-slate-300'}`}>{exam.pendingCount || 0}</p></div>
                                <div className="flex gap-2">
                                    <button onClick={(e) => handleEditExam(e, exam)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Icon name="edit" /></button>
                                    <button onClick={(e) => handleDeleteExam(e, exam.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Icon name="delete" /></button>
                                    <div className={`p-2 transition-transform duration-300 ${isSelected ? 'rotate-180' : ''} text-slate-400`}><Icon name="expand_more" /></div>
                                </div>
                            </div>
                        </div>
                        {isSelected && (
                            <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0f111a] p-6 animate-in slide-in-from-top-2">
                                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                                    <div className="flex flex-col gap-1"><h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Lista de Inscritos</h4><p className="text-xs text-slate-400">Visualizando {filteredRegistrations.length} estudiantes</p></div>
                                    <div className="flex gap-3 items-center w-full md:w-auto">
                                        <div className="relative flex-1 md:w-64"><span className="absolute left-3 top-2.5 text-slate-400 text-sm"><Icon name="search" /></span><input value={regSearchTerm} onChange={(e) => setRegSearchTerm(e.target.value)} className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none" placeholder="Buscar estudiante..." /></div>
                                        <button onClick={() => setShowPastRegs(!showPastRegs)} className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${showPastRegs ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-transparent' : 'bg-transparent border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>{showPastRegs ? 'Ocultar Historial' : 'Ver Historial'}</button>
                                    </div>
                                </div>
                                {loadingRegs ? <div className="py-8 text-center text-slate-500"><Icon name="sync" className="animate-spin" /> Cargando...</div> : filteredRegistrations.length === 0 ? <div className="py-8 text-center text-slate-500 italic border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">No hay registros.</div> : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {filteredRegistrations.map(reg => (
                                            <div key={reg.id} className={`bg-white dark:bg-surface-dark p-4 rounded-xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-opacity ${isRegistrationFinished(reg) ? 'opacity-60 hover:opacity-100 border-slate-100 dark:border-slate-800' : 'border-slate-200 dark:border-slate-700'}`}>
                                                <div className="flex items-center gap-4 flex-1 w-full"><div className={`size-10 rounded-full flex items-center justify-center font-bold text-sm ${reg.paymentStatus === 'Pendiente' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{(reg.studentName || 'ES').substring(0,2).toUpperCase()}</div><div className="flex flex-col min-w-0"><div className="flex items-center gap-2"><p className="font-bold text-slate-900 dark:text-white truncate">{reg.studentName || 'Estudiante'}</p>{reg.paymentStatus === 'Pendiente' && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>}</div><p className="text-xs text-slate-500 truncate">{reg.studentEmail || 'Sin correo'}</p></div></div>
                                                <div className="flex flex-col items-start md:items-end min-w-[140px]"><p className="text-xs font-bold text-slate-400 uppercase">Horario</p><p className="text-sm font-mono text-slate-700 dark:text-slate-300">{reg.selectedDate ? `${new Date(reg.selectedDate.replace(/-/g, '/')).toLocaleDateString()} ${reg.selectedTime || ''}` : 'Sin asignar'}</p></div>
                                                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-100 dark:border-slate-700 pt-3 md:pt-0 mt-2 md:mt-0">
                                                    {reg.paymentStatus === 'Pendiente' ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded">Pendiente</span>
                                                            <button onClick={(e) => { e.stopPropagation(); handleTogglePayment(reg); }} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-green-500/20 flex items-center gap-1 transition-all active:scale-95"><Icon name="check" className="text-sm" /> Aprobar</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded flex items-center gap-1"><Icon name="verified" className="text-sm" /> Pagado</span>
                                                            <button onClick={(e) => { e.stopPropagation(); handleTogglePayment(reg); }} className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-xs font-bold rounded-lg border border-red-500/20 flex items-center gap-1 transition-all active:scale-95"><Icon name="undo" className="text-sm" /> Revocar</button>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
                                                        <button onClick={(e) => { e.stopPropagation(); onViewRegistration(reg.id); }} className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"><Icon name="visibility" className="text-lg" /></button>
                                                        <button onClick={(e) => handleEditRegistration(e, reg)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"><Icon name="edit" className="text-lg" /></button>
                                                        <button onClick={(e) => handleDeleteRegistration(e, reg)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Icon name="delete" className="text-lg" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
      </div>

      {/* Exam Create/Edit Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsModalOpen(false)}></div>
             <div className="relative w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-xl flex flex-col">
                 <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#1a2230] rounded-t-2xl">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editingExam ? 'Editar Examen' : 'Nuevo Examen'}</h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><Icon name="close" /></button>
                 </div>
                 <form onSubmit={handleSubmit} className="p-6 space-y-5">
                     <div>
                         <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Nombre del Examen</label>
                         <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary" placeholder="Ej. TOEIC Listening & Reading" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Precio Final ($)</label>
                             <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary" />
                         </div>
                         <div>
                             <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Precio Original ($) <span className="text-[10px] font-normal text-slate-400">(Opcional)</span></label>
                             <input type="number" step="0.01" value={formData.originalPrice} onChange={e => setFormData({...formData, originalPrice: e.target.value})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary" placeholder="Ej. 100.00" />
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Texto de Descuento <span className="text-[10px] font-normal text-slate-400">(Opcional)</span></label>
                             <input value={formData.discountBadgeText} onChange={e => setFormData({...formData, discountBadgeText: e.target.value})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary" placeholder="Ej. Exclusivo Online" />
                         </div>
                         <div>
                             <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Modalidad</label>
                             <select value={formData.mode} onChange={e => setFormData({...formData, mode: e.target.value as any})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary">
                                 <option value="presencial">Presencial (Paper)</option>
                                 <option value="online">Online</option>
                             </select>
                         </div>
                         <div>
                             <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Orden de Visualización <span className="text-[10px] font-normal text-slate-400">(Opcional)</span></label>
                             <input type="number" value={formData.order} onChange={e => setFormData({...formData, order: e.target.value})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary" placeholder="Ej. 1, 2, 3..." />
                         </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Tipo de Examen</label>
                              <select 
                                  value={formData.type} 
                                  onChange={e => setFormData({...formData, type: e.target.value as any})} 
                                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary"
                              >
                                  <option value="Offline">Examen Oficial (Offline)</option>
                                  <option value="OnlineMock">Mock Test (Online)</option>
                              </select>
                              <p className="text-xs text-slate-500 mt-1">
                                  {formData.type === 'OnlineMock' ? 'Requiere código de acceso y permite pagos online.' : 'Solo pago en efectivo.'}
                              </p>
                          </div>
                          
                          <div>
                              <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Métodos de Pago</label>
                              <div className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                                      <input 
                                          type="checkbox" 
                                          checked={formData.allowedPaymentMethods.includes('cash')}
                                          onChange={e => {
                                              const methods = e.target.checked 
                                                  ? [...formData.allowedPaymentMethods, 'cash'] as ('card' | 'transfer' | 'cash')[]
                                                  : formData.allowedPaymentMethods.filter(m => m !== 'cash') as ('card' | 'transfer' | 'cash')[];
                                              setFormData({...formData, allowedPaymentMethods: methods});
                                          }}
                                          className="rounded text-primary focus:ring-primary"
                                      />
                                      <span className="dark:text-white">Efectivo (Cash)</span>
                                  </label>
                                  
                                  {formData.type === 'OnlineMock' && (
                                      <>
                                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                                              <input 
                                                  type="checkbox" 
                                                  checked={formData.allowedPaymentMethods.includes('card')}
                                                  onChange={e => {
                                                      const methods = e.target.checked 
                                                          ? [...formData.allowedPaymentMethods, 'card'] as ('card' | 'transfer' | 'cash')[]
                                                          : formData.allowedPaymentMethods.filter(m => m !== 'card') as ('card' | 'transfer' | 'cash')[];
                                                      setFormData({...formData, allowedPaymentMethods: methods});
                                                  }}
                                                  className="rounded text-primary focus:ring-primary"
                                              />
                                              <span className="dark:text-white">Tarjeta (Card)</span>
                                          </label>
                                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                                              <input 
                                                  type="checkbox" 
                                                  checked={formData.allowedPaymentMethods.includes('transfer')}
                                                  onChange={e => {
                                                      const methods = e.target.checked 
                                                          ? [...formData.allowedPaymentMethods, 'transfer'] as ('card' | 'transfer' | 'cash')[]
                                                          : formData.allowedPaymentMethods.filter(m => m !== 'transfer') as ('card' | 'transfer' | 'cash')[];
                                                      setFormData({...formData, allowedPaymentMethods: methods});
                                                  }}
                                                  className="rounded text-primary focus:ring-primary"
                                              />
                                              <span className="dark:text-white">Transferencia</span>
                                          </label>
                                      </>
                                  )}
                              </div>
                          </div>
                      </div>

                      {formData.allowedPaymentMethods.includes('card') && (
                          <div>
                              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Enlace de Pago (Compra Click)</label>
                              <input 
                                  value={formData.paymentLink} 
                                  onChange={e => setFormData({...formData, paymentLink: e.target.value})} 
                                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary" 
                                  placeholder="https://..." 
                              />
                          </div>
                      )}

                     <div>
                         <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Estilo (Color/Icono)</label>
                         <div className="flex gap-2">
                             {['bg-blue-100 text-blue-500', 'bg-purple-100 text-purple-500', 'bg-orange-100 text-orange-500', 'bg-emerald-100 text-emerald-500'].map(cls => (
                                 <button type="button" key={cls} onClick={() => setFormData({...formData, colorClass: cls})} className={`w-8 h-8 rounded-full ${cls} ${formData.colorClass === cls ? 'ring-2 ring-primary ring-offset-2' : ''}`}></button>
                             ))}
                         </div>
                     </div>
                     <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                         <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg">Cancelar</button>
                         <button type="submit" disabled={saving} className="px-6 py-2 bg-primary hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 flex items-center gap-2">
                             <Icon name="save" /> {saving ? 'Guardando...' : 'Guardar'}
                         </button>
                     </div>
                 </form>
             </div>
          </div>
      )}

      {/* Registration Edit Modal */}
      {isRegModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsRegModalOpen(false)}></div>
             <div className="relative w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-xl flex flex-col animate-in zoom-in-95">
                 <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#1a2230] rounded-t-2xl">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Editar Inscripción</h2>
                    <button onClick={() => setIsRegModalOpen(false)} className="text-slate-400 hover:text-white"><Icon name="close" /></button>
                 </div>
                 <form onSubmit={handleSaveRegistration} className="p-6 space-y-5">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="md:col-span-2">
                             <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Nombre Estudiante</label>
                             <input required value={regFormData.studentName} onChange={e => setRegFormData({...regFormData, studentName: e.target.value})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary" />
                         </div>
                         <div className="md:col-span-2">
                             <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Correo Electrónico</label>
                             <input required type="email" value={regFormData.studentEmail} onChange={e => setRegFormData({...regFormData, studentEmail: e.target.value})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary" />
                         </div>
                         <div>
                             <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Teléfono</label>
                             <input value={regFormData.phone} onChange={e => setRegFormData({...regFormData, phone: e.target.value})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary" />
                         </div>
                         <div>
                             <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">DUI</label>
                             <input value={regFormData.dui} onChange={e => setRegFormData({...regFormData, dui: e.target.value})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary" />
                         </div>
                         <div className="md:col-span-2">
                             <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">Estado de Pago</label>
                             <select value={regFormData.paymentStatus} onChange={e => setRegFormData({...regFormData, paymentStatus: e.target.value as any})} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111218] px-4 py-2.5 text-sm dark:text-white focus:ring-2 focus:ring-primary">
                                 <option value="Pendiente">Pendiente</option>
                                 <option value="Confirmado">Confirmado</option>
                             </select>
                             <p className="text-xs text-slate-500 mt-1">Nota: Cambiar el estado aquí no afecta automáticamente los contadores del examen. Use el botón "Aprobar" en la lista para flujo normal.</p>
                         </div>
                     </div>
                     <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                         <button type="button" onClick={() => setIsRegModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg">Cancelar</button>
                         <button type="submit" disabled={saving} className="px-6 py-2 bg-primary hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 flex items-center gap-2">
                             <Icon name="save" /> {saving ? 'Guardando...' : 'Actualizar'}
                         </button>
                     </div>
                 </form>
             </div>
          </div>
      )}
       {/* Approval Wizard Modal */}
       {approvalModalOpen && approvingReg && approvingExam && (
           <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={() => setApprovalModalOpen(false)}></div>
              <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200 dark:border-slate-800">
                  
                  {/* Header */}
                  <div className="px-8 py-6 bg-slate-50 dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                     <div>
                         <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                             <Icon name="verified" className="text-emerald-500" />
                             Confirmar Inscripción
                         </h2>
                         <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                             {approvingExam.type === 'OnlineMock' ? 'Configuración de Mock Test Online' : 'Confirmación de Examen Presencial'}
                         </p>
                     </div>
                     <button onClick={() => setApprovalModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><Icon name="close" /></button>
                  </div>

                  <div className="p-8 space-y-8">
                      {/* Step 1: Review Info */}
                      <div className="flex gap-6 items-start p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${approvingExam.colorClass} text-white`}>
                              <Icon name={approvingExam.icon || 'school'} />
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{approvingReg.studentName || 'Estudiante'}</h3>
                              <p className="text-slate-500 dark:text-slate-400 text-sm">{approvingExam.name || ''}</p>
                              <div className="flex gap-3 mt-2 text-xs font-bold uppercase tracking-wider">
                                  <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Pagado</span>
                                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">{approvingReg.selectedDate || 'Por definir'} • {approvingReg.selectedTime || ''}</span>
                              </div>
                          </div>
                      </div>

                      {/* Step 2: Type Specific Inputs */}
                      {(approvingExam.type === 'OnlineMock' || accessCode) ? (
                          <div className="space-y-6">
                              <div className="space-y-4">
                                  <label className="block text-sm font-bold text-slate-700 dark:text-white">
                                      🔐 Código de Acceso (Access Code)
                                      <span className="ml-2 text-xs font-normal text-slate-500">Generado para el portal de examen</span>
                                  </label>
                                  <div className="flex gap-2">
                                      <input 
                                          value={accessCode} 
                                          onChange={e => setAccessCode(e.target.value)} 
                                          placeholder="Ej. MOCK-2024-X9Y2"
                                          className="flex-1 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] px-4 py-3 text-lg font-mono font-bold tracking-widest text-center uppercase focus:border-primary focus:ring-0 text-slate-900 dark:text-white"
                                      />
                                      <button 
                                          onClick={() => setAccessCode(`GT-MOCK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`)}
                                          className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
                                          title="Generar Aleatorio"
                                      >
                                          <Icon name="refresh" />
                                      </button>
                                  </div>
                                  <p className="text-xs text-slate-500">Este código se enviará al estudiante para ingresar al examen.</p>
                              </div>
                              
                              <div className="space-y-2">
                                  <label className="block text-sm font-bold text-slate-700 dark:text-white">
                                      📚 Asignar Examen (Question Set)
                                  </label>
                                  <select 
                                      value={selectedTestId}
                                      onChange={e => setSelectedTestId(e.target.value)}
                                      className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] px-4 py-3 text-sm focus:border-primary focus:ring-0 text-slate-900 dark:text-white"
                                  >
                                      <option value="">-- Seleccionar Examen --</option>
                                      {availableTests.map(test => (
                                          <option key={test.id} value={test.id}>
                                              {test.title} ({test.questions.length} Preguntas)
                                          </option>
                                      ))}
                                  </select>
                                  <p className="text-xs text-slate-500">El estudiante realizará este examen específico.</p>
                              </div>
                          </div>
                      ) : (
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl flex gap-3">
                              <Icon name="info" className="text-blue-500 shrink-0 mt-0.5" />
                              <div className="text-sm text-blue-800 dark:text-blue-200">
                                  <p className="font-bold mb-1">Examen Presencial</p>
                                  <p>Se generará un pase de entrada digital con la fecha, hora y ubicación. No se requiere código de acceso.</p>
                              </div>
                          </div>
                      )}

                      {/* Hidden Ticket Template for Generation */}
                      <div className="absolute left-[-9999px] top-0">
                          <div ref={ticketRef} className="w-[600px] h-[300px] bg-[#1e293b] relative overflow-hidden flex text-white font-sans">
                              {/* Left Stub */}
                              <div className="w-[180px] bg-[#0f172a] flex flex-col items-center justify-center p-6 border-r-2 border-dashed border-slate-700 relative">
                                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 bg-white p-2">
                                      <Logo className="w-full h-full object-contain" />
                                  </div>
                                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">ADMIT ONE</span>
                                  <span className="text-2xl font-black tracking-tighter">PASS</span>
                                  
                                  {/* Semi-circles for ticket effect */}
                                  <div className="absolute -top-3 -right-3 w-6 h-6 bg-[#1e293b] rounded-full"></div>
                                  <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-[#1e293b] rounded-full"></div>
                              </div>

                              {/* Main Content */}
                              <div className="flex-1 p-8 flex flex-col justify-between relative">
                                  {/* Background Pattern */}
                                  <div className="absolute top-0 right-0 p-4 opacity-5">
                                      <Logo className="w-48 h-48 object-contain grayscale" />
                                  </div>

                                  <div className="relative z-10">
                                      <div className="flex justify-between items-start mb-2">
                                          <span className="bg-primary/20 text-primary px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border border-primary/20">
                                              {(approvingExam.type === 'OnlineMock' || accessCode) ? 'ONLINE MOCK TEST' : 'OFFICIAL EXAM'}
                                          </span>
                                          <span className="text-slate-500 font-mono text-sm">#{approvingReg.id.slice(-6).toUpperCase()}</span>
                                      </div>
                                      <h1 className="text-3xl font-black leading-tight mb-1 text-white">{approvingExam.name || ''}</h1>
                                      <p className="text-slate-400 text-sm font-medium">Georgetown English Academy</p>
                                  </div>

                                  <div className="flex flex-col gap-3 mt-4 relative z-10">
                                      <div>
                                          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">STUDENT</p>
                                          <p className="font-bold text-lg text-white break-words leading-tight">{approvingReg.studentName || 'Estudiante'}</p>
                                      </div>
                                      <div>
                                          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">DATE & TIME</p>
                                          <p className="font-bold text-lg text-white">{approvingReg.selectedDate || 'TBD'} • {approvingReg.selectedTime || 'TBD'}</p>
                                      </div>
                                  </div>
                                  
                                  {accessCode && (
                                      <div className="mt-4 bg-slate-800/50 rounded-lg p-2 border border-slate-700 flex justify-between items-center relative z-10">
                                          <span className="text-xs text-slate-400 font-bold uppercase px-2">ACCESS CODE:</span>
                                          <span className="font-mono text-xl font-bold text-primary tracking-widest px-2">{accessCode}</span>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>

                  </div>

                  {/* Footer Actions */}
                  <div className="px-8 py-6 bg-slate-50 dark:bg-[#1e293b] border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                      <button onClick={() => setApprovalModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                          Cancelar
                      </button>
                      <button 
                          onClick={confirmApproval}
                          disabled={!!((approvingExam.type === 'OnlineMock' || accessCode) && (!accessCode || !selectedTestId))}
                          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <Icon name="check_circle" />
                          Confirmar y Enviar WhatsApp
                      </button>
                  </div>
              </div>
           </div>
       )}
     </main>
  );
};

export default ExamList;

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { Exam, ExamRegistration, MockTest } from '../types';
import { getRegistrationById, getExams, approveExamRegistration, revokeExamRegistration, createIndividualMockTicket, deleteExamRegistration } from '../services/db';
import { getMockTests } from '../services/mockTest';
// @ts-ignore
import html2canvas from 'html2canvas';

interface ExamDetailsProps {
    registrationId: string;
    onBack: () => void;
}

const ExamDetails: React.FC<ExamDetailsProps> = ({ registrationId, onBack }) => {
  const [data, setData] = useState<ExamRegistration | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);

  // Approval Modal State
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [availableTests, setAvailableTests] = useState<MockTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const fetchData = async () => {
          setLoading(true);
          const [reg, allExams] = await Promise.all([
              getRegistrationById(registrationId),
              getExams()
          ]);
          setData(reg || null);
          if (reg) {
              const matchedExam = allExams.find(e => e.id === reg.examId) || null;
              setExam(matchedExam);
              if (reg.accessCode) {
                  setAccessCode(reg.accessCode);
              }
          }
          setLoading(false);
      };
      fetchData();
  }, [registrationId]);

  const isMockExam = (targetExam: Exam | null, reg?: ExamRegistration | null) => {
      if (reg?.accessCode) return true;
      if (!targetExam) return false;
      return targetExam.type === 'OnlineMock' || targetExam.name.toLowerCase().includes('mock') || targetExam.name.toLowerCase().includes('simulacro');
  };

  const handleOpenApproval = () => {
      if (!data) return;
      const mock = isMockExam(exam, data);
      if (mock) {
          setAccessCode(data.accessCode || `GT-MOCK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`);
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

  const generateAndSendWhatsAppTicket = async (codeToUse: string) => {
      if (!data) return;
      if (ticketRef.current) {
          await new Promise(r => setTimeout(r, 150));
          const canvas = await html2canvas(ticketRef.current, { scale: 2, backgroundColor: null, useCORS: true, allowTaint: false });
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
              try {
                  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                  const studentFirstName = (data.studentName || 'Estudiante').split(' ')[0];
                  const examName = exam?.name || 'TOEIC';
                  let message = '';
                  if (codeToUse) {
                      message = `🎓 *GEORGETOWN ACADEMY*\n*Official Mock Test Registration*\n\nHola ${studentFirstName}! 👋\nTu inscripción al examen *${examName}* está confirmada.\n\n🎫 *TU CÓDIGO DE ACCESO:*\n*${codeToUse}*\n\n👇 *INSTRUCCIONES:*\n1. Ingresa al portal: https://www.georgetownenglish.com/toeicmocktest\n2. Escribe tu código de acceso.\n3. Presiona [Start Exam].\n\n⚠️ *Importante:*\n- El examen dura 2 horas.\n- Usa PC/Laptop con Chrome.\n- Asegúrate de tener buena conexión.\n\n¡Mucho éxito! 🍀`;
                  } else {
                      message = `🎓 *GEORGETOWN ACADEMY*\n*Confirmación de Examen*\n\nHola ${studentFirstName}! 👋\nTu cupo para el examen *${examName}* ha sido confirmado.\n\n📅 Fecha: ${data.selectedDate || 'Por definir'}\n⏰ Hora: ${data.selectedTime || 'Por definir'}\n📍 Lugar: Georgetown Academy (Presencial)\n\nPor favor llega 15 minutos antes. ¡Éxito! 🍀`;
                  }

                  alert("✅ Ticket copiado al portapapeles.\n\nSe abrirá WhatsApp. Presiona 'Pegar' (Ctrl+V) para enviar la imagen.");
                  const phone = (data.phone || '').replace(/[^0-9]/g, '');
                  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
                  window.open(url, '_blank');
              } catch (err) {
                  console.error("Clipboard error", err);
                  alert("Error al copiar ticket al portapapeles. Revise permisos del navegador.");
              }
          }
      }
  };

  const confirmApproval = async () => {
      if (!data || isApproving) return;
      setIsApproving(true);
      try {
          await approveExamRegistration(data.id, data.examId, accessCode || undefined);
          if (accessCode) {
              await createIndividualMockTicket(accessCode, data.studentName || 'Estudiante', data.phone, selectedTestId);
          }

          setData(prev => prev ? { ...prev, paymentStatus: 'Confirmado', accessCode: accessCode || prev.accessCode } : prev);
          await generateAndSendWhatsAppTicket(accessCode);
          setApprovalModalOpen(false);
      } catch (e) {
          console.error(e);
          alert("Error al aprobar.");
      } finally {
          setIsApproving(false);
      }
  };

  const handleRevokePayment = async () => {
      if (!data || isRevoking) return;
      if (!confirm(`¿Revocar pago de ${data.studentName || 'Estudiante'}?\nVolverá a estado pendiente.`)) return;
      setIsRevoking(true);
      try {
          await revokeExamRegistration(data.id, data.examId);
          setData(prev => prev ? { ...prev, paymentStatus: 'Pendiente', accessCode: undefined } : prev);
          setAccessCode('');
          alert("Pago revocado.");
      } catch (e) {
          console.error(e);
          alert("Error al actualizar estado.");
      } finally {
          setIsRevoking(false);
      }
  };

  const handleSendPaymentReminder = () => {
      if (!data) return;
      const phone = (data.phone || '').replace(/[^0-9]/g, '');
      if (!phone) {
          alert("El estudiante no tiene un número de teléfono registrado.");
          return;
      }
      const studentFirstName = (data.studentName || 'Estudiante').split(' ')[0];
      const examName = exam?.name || 'Examen TOEIC';
      const total = ((data.cost || 0) + (data.surcharge || 0)).toFixed(2);
      const message = `🎓 *GEORGETOWN ACADEMY*\n*Recordatorio de Inscripción*\n\nHola ${studentFirstName}! 👋\nTe recordamos que tu inscripción para *${examName}* se encuentra *Pendiente de Confirmación*.\n\n📅 Fecha solicitada: ${data.selectedDate || 'Por definir'} ${data.selectedTime || ''}\n💵 Total a pagar: *$${total} USD*\n\nUna vez realizado el pago, te enviaremos tu pase y código de acceso oficial. ¡Gracias!`;
      const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const handleCancelRegistration = async () => {
      if (!data) return;
      if (!confirm(`¿Eliminar la inscripción de ${data.studentName || 'Estudiante'}?\nEsta acción actualizará los contadores del examen.`)) return;
      try {
          await deleteExamRegistration(data.id, data.examId);
          alert("Inscripción eliminada.");
          onBack();
      } catch (e) {
          console.error(e);
          alert("Error al eliminar inscripción.");
      }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500"><Icon name="sync" className="animate-spin text-2xl" /></div>;
  if (!data) return <div className="flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">Registro no encontrado.</div>;

  const currentTicketCode = data.accessCode || accessCode;

  return (
    <div className="flex flex-col min-h-screen w-full bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 md:px-10 lg:px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            {/* Breadcrumbs */}
            <div className="flex flex-wrap gap-2 px-4 py-2 mb-2">
              <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }} className="text-slate-500 dark:text-[#9ca1ba] hover:text-primary transition-colors text-sm font-medium leading-normal flex items-center gap-1">
                <Icon name="home" className="text-lg" /> Inicio
              </a>
              <span className="text-slate-500 dark:text-[#9ca1ba] text-sm font-medium leading-normal">/</span>
              <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }} className="text-slate-500 dark:text-[#9ca1ba] hover:text-primary transition-colors text-sm font-medium leading-normal">Exámenes TOEIC</a>
              <span className="text-slate-500 dark:text-[#9ca1ba] text-sm font-medium leading-normal">/</span>
              <span className="text-slate-900 dark:text-white text-sm font-medium leading-normal">Detalles de Registro #{data.id.split('-').pop()}</span>
            </div>
            
            {/* Page Heading */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-4 pb-6 border-b border-slate-200 dark:border-[#282b39]">
              <div className="flex min-w-0 flex-col gap-2">
                <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em]">Detalles de Registro</h1>
                <p className="text-slate-500 dark:text-[#9ca1ba] text-base font-normal leading-normal flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-500/20">{exam?.name || 'TOEIC Listening & Reading'}</span>
                  <span>•</span>
                  <span>Revisión de inscripción</span>
                </p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button onClick={() => window.print()} className="flex flex-1 md:flex-none cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white dark:bg-[#282b39] border border-slate-200 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#34384b] text-slate-700 dark:text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 transition-all shadow-sm">
                  <Icon name="print" className="text-[20px]" />
                  <span className="truncate">Imprimir</span>
                </button>
                <button onClick={() => window.print()} className="flex flex-1 md:flex-none cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white dark:bg-[#282b39] border border-slate-200 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#34384b] text-slate-700 dark:text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 transition-all shadow-sm">
                  <Icon name="picture_as_pdf" className="text-[20px]" />
                  <span className="truncate">PDF</span>
                </button>
              </div>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4">
              {/* Left Column: Student & Exam Info (8 cols) */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {/* Student Profile Card */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-lg shadow-black/5 dark:shadow-black/20">
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="relative mx-auto sm:mx-0">
                      <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-xl w-24 h-24 sm:w-32 sm:h-32 shadow-inner border border-slate-100 dark:border-white/10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-2xl font-black text-slate-500" style={data.avatarUrl ? { backgroundImage: `url("${data.avatarUrl}")` } : undefined}>
                        {!data.avatarUrl && (data.studentName || 'ES').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1 rounded-full border-4 border-white dark:border-surface-dark" title="Activo">
                        <Icon name="check" className="text-sm block" />
                      </div>
                    </div>
                    <div className="flex flex-col justify-center flex-1 w-full text-center sm:text-left">
                      <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start w-full gap-2">
                        <div>
                          <h3 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-[-0.015em] mb-1">{data.studentName}</h3>
                          <p className="text-primary font-medium text-sm mb-3">ID Estudiante: {data.studentId}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-[#282b39] text-slate-600 dark:text-[#9ca1ba] text-xs font-bold border border-slate-200 dark:border-white/5 whitespace-nowrap">{data.level || 'Nivel B2'}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 mt-2 text-left">
                        <div className="flex items-center gap-3 text-slate-600 dark:text-[#9ca1ba]">
                          <Icon name="mail" className="text-[20px] text-slate-400 dark:text-white/40 shrink-0" />
                          <span className="text-sm truncate">{data.studentEmail}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 dark:text-[#9ca1ba]">
                          <Icon name="call" className="text-[20px] text-slate-400 dark:text-white/40 shrink-0" />
                          <span className="text-sm">{data.phone || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 dark:text-[#9ca1ba]">
                          <Icon name="badge" className="text-[20px] text-slate-400 dark:text-white/40 shrink-0" />
                          <span className="text-sm">DUI: {data.dui || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 dark:text-[#9ca1ba]">
                          <Icon name="school" className="text-[20px] text-slate-400 dark:text-white/40 shrink-0" />
                          <span className="text-sm">{data.program || exam?.name || 'Programa General'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exam Details Section */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-lg shadow-black/5 dark:shadow-black/20">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-[#161821]">
                    <h3 className="text-slate-900 dark:text-white text-lg font-bold flex items-center gap-2">
                      <Icon name="event_available" className="text-primary" />
                      Información del Examen
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-50 dark:bg-[#111218] p-4 rounded-lg border border-slate-200 dark:border-border-dark flex flex-col gap-1">
                        <span className="text-slate-500 dark:text-[#9ca1ba] text-xs font-bold uppercase tracking-wider mb-1">Fecha</span>
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                          <Icon name="calendar_month" className="text-primary" />
                          <span className="text-lg font-semibold">{data.selectedDate || data.registrationDate}</span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-[#9ca1ba] pl-7">Fecha Seleccionada</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#111218] p-4 rounded-lg border border-slate-200 dark:border-border-dark flex flex-col gap-1">
                        <span className="text-slate-500 dark:text-[#9ca1ba] text-xs font-bold uppercase tracking-wider mb-1">Horario</span>
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                          <Icon name="schedule" className="text-primary" />
                          <span className="text-lg font-semibold">{data.selectedTime || '09:00 - 11:30'}</span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-[#9ca1ba] pl-7">Horario Asignado</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#111218] p-4 rounded-lg border border-slate-200 dark:border-border-dark flex flex-col gap-1">
                        <span className="text-slate-500 dark:text-[#9ca1ba] text-xs font-bold uppercase tracking-wider mb-1">Modalidad / Sede</span>
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                          <Icon name={exam?.mode === 'online' ? 'wifi' : 'location_on'} className="text-primary" />
                          <span className="text-lg font-semibold">{exam?.mode === 'online' ? 'Portal Online' : 'Campus Central'}</span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-[#9ca1ba] pl-7">{exam?.mode === 'online' ? 'Acceso con Código' : 'Georgetown Academy'}</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <label className="block text-slate-500 dark:text-[#9ca1ba] text-sm font-medium mb-2">Notas del Administrador / Observaciones</label>
                      <div className="bg-slate-50 dark:bg-[#111218] rounded-lg border border-slate-200 dark:border-border-dark p-4 min-h-[100px] text-sm text-slate-600 dark:text-[#d1d5db]">
                        <p className="mb-2"><span className="text-primary font-bold">{data.registrationDate} - System:</span> Registro completado exitosamente.</p>
                        {data.accessCode && (
                            <p className="mt-2"><span className="text-emerald-500 font-bold">Código de Acceso Emitido:</span> <span className="font-mono font-bold text-slate-900 dark:text-white">{data.accessCode}</span></p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Payment & Actions (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                {/* Payment Status Card */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-lg shadow-black/5 dark:shadow-black/20 flex flex-col h-full">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-[#161821]">
                    <h3 className="text-slate-900 dark:text-white text-lg font-bold flex items-center gap-2">
                      <Icon name="payments" className="text-green-500" />
                      Estado de Pago
                    </h3>
                  </div>
                  <div className="p-6 flex flex-col gap-6 flex-1">
                    {data.paymentStatus === 'Confirmado' ? (
                       <div className="flex flex-col items-center justify-center py-4 px-3 bg-green-50 dark:bg-green-500/5 rounded-xl border border-green-200 dark:border-green-500/20">
                         <div className="bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-500 rounded-full p-3 mb-3">
                           <Icon name="check_circle" className="text-3xl" />
                         </div>
                         <span className="text-green-600 dark:text-green-500 font-bold text-lg">Pago Confirmado</span>
                         <span className="text-slate-500 dark:text-[#9ca1ba] text-sm">Procesado el {data.registrationDate}</span>
                         {data.accessCode && (
                             <div className="mt-3 w-full bg-white dark:bg-[#111218] border border-green-200 dark:border-green-500/30 rounded-lg px-3 py-2 text-center">
                                 <span className="block text-[10px] font-bold uppercase text-slate-400">Código de Acceso</span>
                                 <span className="font-mono font-black text-base text-primary tracking-wider">{data.accessCode}</span>
                             </div>
                         )}
                       </div>
                    ) : (
                       <div className="flex flex-col items-center justify-center py-4 bg-yellow-50 dark:bg-yellow-500/5 rounded-xl border border-yellow-200 dark:border-yellow-500/20">
                         <div className="bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 rounded-full p-3 mb-3">
                           <Icon name="pending" className="text-3xl" />
                         </div>
                         <span className="text-yellow-600 dark:text-yellow-500 font-bold text-lg">Pendiente de Confirmación</span>
                         <span className="text-slate-500 dark:text-[#9ca1ba] text-sm">Pago en efectivo requerido</span>
                       </div>
                    )}
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-border-dark border-dashed">
                        <span className="text-slate-500 dark:text-[#9ca1ba] text-sm">Costo del Examen</span>
                        <span className="text-slate-900 dark:text-white font-medium">${(data.cost || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-border-dark border-dashed">
                        <span className="text-slate-500 dark:text-[#9ca1ba] text-sm">Recargo Tardío</span>
                        <span className="text-slate-900 dark:text-white font-medium">${(data.surcharge || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-slate-900 dark:text-white font-bold text-lg">Total a Pagar</span>
                        <span className="text-primary font-bold text-2xl">${((data.cost || 0) + (data.surcharge || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="mt-auto pt-6 flex flex-col gap-3">
                      {data.paymentStatus !== 'Confirmado' ? (
                        <>
                          <button
                            onClick={handleOpenApproval}
                            className="w-full cursor-pointer flex items-center justify-center rounded-lg h-12 bg-primary hover:bg-blue-700 text-white font-bold shadow-lg shadow-primary/25 transition-all transform active:scale-[0.98]"
                          >
                            <Icon name="check_circle" className="mr-2" />
                            Confirmar Pago
                          </button>
                          <button
                            onClick={handleSendPaymentReminder}
                            className="w-full cursor-pointer flex items-center justify-center rounded-lg h-10 bg-white dark:bg-[#282b39] border border-slate-200 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#34384b] text-slate-700 dark:text-white font-medium transition-colors"
                          >
                            <Icon name="send" className="mr-2 text-sm" />
                            Enviar Recordatorio de Pago
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => generateAndSendWhatsAppTicket(currentTicketCode)}
                            className="w-full cursor-pointer flex items-center justify-center rounded-lg h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all transform active:scale-[0.98]"
                          >
                            <Icon name="send" className="mr-2 text-sm" />
                            Enviar Ticket por WhatsApp
                          </button>
                          <button
                            onClick={handleRevokePayment}
                            disabled={isRevoking}
                            className="w-full cursor-pointer flex items-center justify-center rounded-lg h-10 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                          >
                            <Icon name="undo" className="mr-2 text-sm" />
                            {isRevoking ? 'Revocando...' : 'Revocar Pago'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Additional Actions / Quick Links */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark p-4 shadow-lg shadow-black/5 dark:shadow-black/20">
                  <h4 className="text-slate-900 dark:text-white text-sm font-bold mb-4 px-2">Acciones Rápidas</h4>
                  <div className="flex flex-col gap-2">
                    <button onClick={ onBack } className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#282b39] text-slate-500 dark:text-[#9ca1ba] hover:text-slate-900 dark:hover:text-white transition-colors group w-full text-left">
                      <Icon name="arrow_back" className="text-[20px] group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">Volver a la Lista de Exámenes</span>
                    </button>
                    <button onClick={handleCancelRegistration} className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-500 dark:text-[#9ca1ba] hover:text-red-500 transition-colors group w-full text-left mt-2 border-t border-slate-200 dark:border-border-dark pt-3">
                      <Icon name="cancel" className="text-[20px]" />
                      <span className="text-sm font-medium">Cancelar Registro</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Ticket Template for Generation (Always mounted for instant Confirm & Resend) */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none">
          <div ref={ticketRef} className="w-[600px] h-[300px] bg-[#1e293b] relative overflow-hidden flex text-white font-sans">
              {/* Left Stub */}
              <div className="w-[180px] bg-[#0f172a] flex flex-col items-center justify-center p-6 border-r-2 border-dashed border-slate-700 relative">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 bg-white p-2">
                      <Logo className="w-full h-full object-contain" />
                  </div>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">ADMIT ONE</span>
                  <span className="text-2xl font-black tracking-tighter">PASS</span>
                  
                  <div className="absolute -top-3 -right-3 w-6 h-6 bg-[#1e293b] rounded-full"></div>
                  <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-[#1e293b] rounded-full"></div>
              </div>

              {/* Main Content */}
              <div className="flex-1 p-8 flex flex-col justify-between relative">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Logo className="w-48 h-48 object-contain grayscale" />
                  </div>

                  <div className="relative z-10">
                      <div className="flex justify-between items-start mb-2">
                          <span className="bg-primary/20 text-primary px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border border-primary/20">
                              {isMockExam(exam, data) ? 'ONLINE MOCK TEST' : 'OFFICIAL EXAM'}
                          </span>
                          <span className="text-slate-500 font-mono text-sm">#{data.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <h1 className="text-3xl font-black leading-tight mb-1 text-white">{exam?.name || 'TOEIC Listening & Reading'}</h1>
                      <p className="text-slate-400 text-sm font-medium">Georgetown English Academy</p>
                  </div>

                  <div className="flex flex-col gap-3 mt-4 relative z-10">
                      <div>
                          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">STUDENT</p>
                          <p className="font-bold text-lg text-white break-words leading-tight">{data.studentName || 'Estudiante'}</p>
                      </div>
                      <div>
                          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">DATE & TIME</p>
                          <p className="font-bold text-lg text-white">{data.selectedDate || 'TBD'} • {data.selectedTime || 'TBD'}</p>
                      </div>
                  </div>
                  
                  {currentTicketCode && (
                      <div className="mt-4 bg-slate-800/50 rounded-lg p-2 border border-slate-700 flex justify-between items-center relative z-10">
                          <span className="text-xs text-slate-400 font-bold uppercase px-2">ACCESS CODE:</span>
                          <span className="font-mono text-xl font-bold text-primary tracking-widest px-2">{currentTicketCode}</span>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* Approval Wizard Modal */}
      {approvalModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" onClick={() => !isApproving && setApprovalModalOpen(false)}></div>
              <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200 dark:border-slate-800">
                  
                  <div className="px-8 py-6 bg-slate-50 dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <div>
                          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                              <Icon name="verified" className="text-emerald-500" />
                              Confirmar Inscripción
                          </h2>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                              {isMockExam(exam, data) ? 'Configuración de Mock Test Online' : 'Confirmación de Examen Presencial'}
                          </p>
                      </div>
                      <button onClick={() => !isApproving && setApprovalModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"><Icon name="close" /></button>
                  </div>

                  <div className="p-8 space-y-8">
                      <div className="flex gap-6 items-start p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${exam?.colorClass || 'bg-blue-100 text-blue-500'}`}>
                              <Icon name={exam?.icon || 'school'} />
                          </div>
                          <div>
                              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{data.studentName || 'Estudiante'}</h3>
                              <p className="text-slate-500 dark:text-slate-400 text-sm">{exam?.name || 'TOEIC'}</p>
                              <div className="flex gap-3 mt-2 text-xs font-bold uppercase tracking-wider">
                                  <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Pagado</span>
                                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">{data.selectedDate || 'Por definir'} • {data.selectedTime || ''}</span>
                              </div>
                          </div>
                      </div>

                      {(isMockExam(exam, data) || accessCode) ? (
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
                                          placeholder="Ej. GT-MOCK-X9Y2"
                                          className="flex-1 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] px-4 py-3 text-lg font-mono font-bold tracking-widest text-center uppercase focus:border-primary focus:ring-0 text-slate-900 dark:text-white"
                                      />
                                      <button 
                                          type="button"
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
                  </div>

                  <div className="px-8 py-6 bg-slate-50 dark:bg-[#1e293b] border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                      <button onClick={() => !isApproving && setApprovalModalOpen(false)} disabled={isApproving} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50">
                          Cancelar
                      </button>
                      <button 
                          onClick={confirmApproval}
                          disabled={isApproving || !!((isMockExam(exam, data) || accessCode) && (!accessCode || !selectedTestId))}
                          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <Icon name={isApproving ? "sync" : "check_circle"} className={isApproving ? "animate-spin" : ""} />
                          {isApproving ? 'Procesando...' : 'Confirmar y Enviar WhatsApp'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ExamDetails;
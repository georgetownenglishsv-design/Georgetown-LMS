import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { ExamRegistration } from '../types';
import { getRegistrationById } from '../services/db';

interface ExamDetailsProps {
    registrationId: string;
    onBack: () => void;
}

const ExamDetails: React.FC<ExamDetailsProps> = ({ registrationId, onBack }) => {
  const [data, setData] = useState<ExamRegistration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      const fetchData = async () => {
          setLoading(true);
          const reg = await getRegistrationById(registrationId);
          setData(reg || null);
          setLoading(false);
      };
      fetchData();
  }, [registrationId]);

  if (loading) return <div className="flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500"><Icon name="sync" className="animate-spin text-2xl" /></div>;
  if (!data) return <div className="flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500">Registro no encontrado.</div>;

  return (
    <div className="flex flex-col min-h-screen w-full bg-background-light dark:bg-background-dark">
      {/* Custom Header separate from main layout if needed, or integrate. 
          For consistency with App layout, we'll keep the Sidebar but overlay this content area.
      */}
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
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-500/20">TOEIC Listening & Reading</span>
                  <span>•</span>
                  <span>Revisión de inscripción</span>
                </p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <button className="flex flex-1 md:flex-none cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white dark:bg-[#282b39] border border-slate-200 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#34384b] text-slate-700 dark:text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 transition-all shadow-sm">
                  <Icon name="print" className="text-[20px]" />
                  <span className="truncate">Imprimir</span>
                </button>
                <button className="flex flex-1 md:flex-none cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white dark:bg-[#282b39] border border-slate-200 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#34384b] text-slate-700 dark:text-white text-sm font-bold leading-normal tracking-[0.015em] gap-2 transition-all shadow-sm">
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
                      <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-xl w-24 h-24 sm:w-32 sm:h-32 shadow-inner border border-slate-100 dark:border-white/10" style={{ backgroundImage: `url("${data.avatarUrl}")` }}></div>
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
                          <span className="text-sm">{data.program || 'Programa General'}</span>
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
                    <button className="text-primary hover:text-primary/80 text-sm font-bold flex items-center gap-1 transition-colors">
                      <Icon name="edit" className="text-[18px]" /> Editar
                    </button>
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
                        <span className="text-slate-500 dark:text-[#9ca1ba] text-xs font-bold uppercase tracking-wider mb-1">Sede</span>
                        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                          <Icon name="location_on" className="text-primary" />
                          <span className="text-lg font-semibold">Campus Central</span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-[#9ca1ba] pl-7">Salón 304, Edificio B</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <label className="block text-slate-500 dark:text-[#9ca1ba] text-sm font-medium mb-2">Notas del Administrador / Observaciones</label>
                      <div className="bg-slate-50 dark:bg-[#111218] rounded-lg border border-slate-200 dark:border-border-dark p-4 min-h-[100px] text-sm text-slate-600 dark:text-[#d1d5db]">
                        <p className="mb-2"><span className="text-primary font-bold">{data.registrationDate} - System:</span> Registro completado exitosamente.</p>
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
                       <div className="flex flex-col items-center justify-center py-4 bg-green-50 dark:bg-green-500/5 rounded-xl border border-green-200 dark:border-green-500/20">
                         <div className="bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-500 rounded-full p-3 mb-3">
                           <Icon name="check_circle" className="text-3xl" />
                         </div>
                         <span className="text-green-600 dark:text-green-500 font-bold text-lg">Pago Confirmado</span>
                         <span className="text-slate-500 dark:text-[#9ca1ba] text-sm">Procesado el {data.registrationDate}</span>
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
                        <span className="text-slate-900 dark:text-white font-medium">${data.cost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-border-dark border-dashed">
                        <span className="text-slate-500 dark:text-[#9ca1ba] text-sm">Recargo Tardío</span>
                        <span className="text-slate-900 dark:text-white font-medium">${data.surcharge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-slate-900 dark:text-white font-bold text-lg">Total a Pagar</span>
                        <span className="text-primary font-bold text-2xl">${(data.cost + data.surcharge).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="mt-auto pt-6 flex flex-col gap-3">
                      {data.paymentStatus !== 'Confirmado' && (
                          <button className="w-full cursor-pointer flex items-center justify-center rounded-lg h-12 bg-primary hover:bg-blue-700 text-white font-bold shadow-lg shadow-primary/25 transition-all transform active:scale-[0.98]">
                            <Icon name="check_circle" className="mr-2" />
                            Confirmar Pago
                          </button>
                      )}
                      <button className="w-full cursor-pointer flex items-center justify-center rounded-lg h-10 bg-white dark:bg-[#282b39] border border-slate-200 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#34384b] text-slate-700 dark:text-white font-medium transition-colors">
                        <Icon name="send" className="mr-2 text-sm" />
                        Enviar Recordatorio de Pago
                      </button>
                    </div>
                  </div>
                </div>

                {/* Additional Actions / Quick Links */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark p-4 shadow-lg shadow-black/5 dark:shadow-black/20">
                  <h4 className="text-slate-900 dark:text-white text-sm font-bold mb-4 px-2">Acciones Rápidas</h4>
                  <div className="flex flex-col gap-2">
                    <a className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#282b39] text-slate-500 dark:text-[#9ca1ba] hover:text-slate-900 dark:hover:text-white transition-colors group" href="#">
                      <Icon name="history" className="text-[20px] group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">Ver Historial de Cambios</span>
                    </a>
                    <a className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#282b39] text-slate-500 dark:text-[#9ca1ba] hover:text-slate-900 dark:hover:text-white transition-colors group" href="#">
                      <Icon name="person_search" className="text-[20px] group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">Ver Perfil Completo</span>
                    </a>
                    <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-500 dark:text-[#9ca1ba] hover:text-red-500 transition-colors group w-full text-left mt-2 border-t border-slate-200 dark:border-border-dark">
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
    </div>
  );
};

export default ExamDetails;
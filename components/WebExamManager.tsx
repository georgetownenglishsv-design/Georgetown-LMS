
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { getExams, getWebExamLandings, saveWebExamLanding, deleteWebExamLanding, getWebExamDetails, saveWebExamDetail, deleteWebExamDetail } from '../services/db';
import { Exam, WebExamLanding, WebExamDetail, WebExamOption } from '../types';

// Luxury Photos for Test Takers
const HERO_PRESETS = [
    { id: 'p1', url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1200', label: 'Estudiante Serio' },
    { id: 'p2', url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1200', label: 'Ejecutivo' },
    { id: 'p3', url: 'https://images.unsplash.com/photo-1598257006458-087169a1f08d?q=80&w=1200', label: 'Laboratorio Moderno' },
    { id: 'p4', url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200', label: 'Estudiante Feliz' },
];

const WebExamManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bridge' | 'detail'>('bridge');
  const [landings, setLandings] = useState<WebExamLanding[]>([]);
  const [details, setDetails] = useState<WebExamDetail[]>([]);
  const [realExams, setRealExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // --- FORM STATES ---
  const [isLandingModalOpen, setIsLandingModalOpen] = useState(false);
  const [landingForm, setLandingForm] = useState<Partial<WebExamLanding>>({});
  
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailForm, setDetailForm] = useState<Partial<WebExamDetail>>({});

  useEffect(() => {
      fetchData();
  }, []);

  const fetchData = async () => {
      setLoading(true);
      const [lData, dData, eData] = await Promise.all([
          getWebExamLandings(),
          getWebExamDetails(),
          getExams()
      ]);
      setLandings(lData);
      setDetails(dData);
      setRealExams(eData.filter(e => e.status === 'Active'));
      setLoading(false);
  };

  // --- BRIDGE / LANDING HANDLERS ---
  const openLandingModal = (item?: WebExamLanding) => {
      if (item) {
          setLandingForm(item);
      } else {
          setLandingForm({
              internalCategory: '',
              title: '',
              shortDescription: '',
              linkedDetailId: '',
              status: 'Active',
              order: landings.length + 1
          });
      }
      setIsLandingModalOpen(true);
  };

  const saveLanding = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!landingForm.linkedDetailId) {
          alert("Debe vincular una página de detalle existente.");
          return;
      }
      try {
          // @ts-ignore
          await saveWebExamLanding(landingForm);
          setIsLandingModalOpen(false);
          fetchData();
          alert("Página Landing guardada!");
      } catch (err) {
          alert("Error al guardar.");
      }
  };

  const deleteLanding = async (id: string) => {
      if(!confirm("¿Borrar esta página de puente?")) return;
      await deleteWebExamLanding(id);
      fetchData();
  };

  // --- DETAIL PAGE HANDLERS ---
  const openDetailModal = (item?: WebExamDetail) => {
      if (item) {
          setDetailForm({
              ...item,
              options: item.options || [],
              features: item.features || []
          });
      } else {
          setDetailForm({
              title: '',
              description: '',
              heroImage: HERO_PRESETS[0].url,
              features: [
                  { icon: 'verified', title: 'Resultados Rápidos', desc: 'Entrega en 24 horas' },
                  { icon: 'public', title: 'Validez Global', desc: 'Aceptado en todo el mundo' }
              ],
              options: []
          });
      }
      setIsDetailModalOpen(true);
  };

  const saveDetail = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          // @ts-ignore
          await saveWebExamDetail(detailForm);
          setIsDetailModalOpen(false);
          fetchData();
          alert("Página de detalle guardada.");
      } catch (err) {
          alert("Error al guardar.");
      }
  };

  const deleteDetail = async (id: string) => {
      if(!confirm("¿Borrar esta página de detalle? Si está vinculada a una Landing, el enlace se romperá.")) return;
      await deleteWebExamDetail(id);
      fetchData();
  };

  // --- OPTION HELPERS ---
  const addOption = () => {
      const newOpt: WebExamOption = {
          id: Date.now().toString(),
          marketingTitle: 'Opción Estándar',
          duration: '2 Horas',
          priceLabel: '$85.00',
          guarantee1: 'Resultados 24h',
          guarantee2: 'Certificado PDF',
          linkedRealExamId: ''
      };
      setDetailForm(prev => ({ ...prev, options: [...(prev.options || []), newOpt] }));
  };

  const removeOption = (idx: number) => {
      setDetailForm(prev => {
          const opts = [...(prev.options || [])];
          opts.splice(idx, 1);
          return { ...prev, options: opts };
      });
  };

  const updateOption = (idx: number, field: keyof WebExamOption, val: string) => {
      setDetailForm(prev => {
          const opts = [...(prev.options || [])];
          opts[idx] = { ...opts[idx], [field]: val };
          return { ...prev, options: opts };
      });
  };

  const updateFeature = (idx: number, field: string, val: string) => {
      setDetailForm(prev => {
          const feats = [...(prev.features || [])];
          (feats[idx] as any)[field] = val;
          return { ...prev, features: feats };
      });
  };

  if (loading) return <div className="p-10 text-center"><Icon name="sync" className="animate-spin text-2xl"/></div>;

  return (
    <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
        {/* Top Split Header */}
        <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Gestión Web Exámenes</h1>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                <button 
                    onClick={() => setActiveTab('bridge')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'bridge' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary dark:text-white' : 'text-slate-500'}`}
                >
                    1. Landing (Bridge)
                </button>
                <button 
                    onClick={() => setActiveTab('detail')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'detail' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary dark:text-white' : 'text-slate-500'}`}
                >
                    2. Detalle (Detail)
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10">
            {/* VIEW 1: BRIDGE PAGES */}
            {activeTab === 'bridge' && (
                <div className="space-y-6 max-w-6xl mx-auto">
                    <div className="flex justify-between items-end">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Páginas de Aterrizaje (Bridge)</h2>
                            <p className="text-sm text-slate-500">Tarjetas visibles en el listado principal. Enlazan a una página de detalle.</p>
                        </div>
                        <button onClick={() => openLandingModal()} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-bold text-sm shadow flex gap-2">
                            <Icon name="add" /> Crear Landing
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {landings.map(landing => (
                            <div key={landing.id} className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 relative group">
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openLandingModal(landing)} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded hover:text-primary"><Icon name="edit" /></button>
                                    <button onClick={() => deleteLanding(landing.id)} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded hover:text-red-500"><Icon name="delete" /></button>
                                </div>
                                <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500 mb-2 inline-block">
                                    {landing.internalCategory}
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{landing.title}</h3>
                                <p className="text-sm text-slate-500 line-clamp-2 mb-4">{landing.shortDescription}</p>
                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Links to:</span>
                                    <span className="text-xs font-mono font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-2 py-1 rounded">
                                        {details.find(d => d.id === landing.linkedDetailId)?.title.substring(0, 15) || '???'}...
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VIEW 2: DETAIL PAGES */}
            {activeTab === 'detail' && (
                <div className="space-y-6 max-w-6xl mx-auto">
                    <div className="flex justify-between items-end">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Páginas de Detalle</h2>
                            <p className="text-sm text-slate-500">Páginas con información completa y opciones de compra vinculadas a la DB.</p>
                        </div>
                        <button onClick={() => openDetailModal()} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-bold text-sm shadow flex gap-2">
                            <Icon name="add" /> Crear Detalle
                        </button>
                    </div>

                    <div className="space-y-4">
                        {details.map(detail => (
                            <div key={detail.id} className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col md:flex-row gap-6">
                                <div className="w-full md:w-48 h-32 bg-slate-200 rounded-lg overflow-hidden shrink-0">
                                    <img src={detail.heroImage} alt="Hero" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{detail.title}</h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => openDetailModal(detail)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-bold hover:bg-slate-200">Editar</button>
                                            <button onClick={() => deleteDetail(detail.id)} className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded text-xs font-bold hover:bg-red-100">Borrar</button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-500 line-clamp-2 mb-4">{detail.description}</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {detail.options?.map((opt, i) => (
                                            <span key={i} className="text-[10px] border border-slate-200 dark:border-slate-700 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                {opt.marketingTitle} (${opt.priceLabel})
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* --- MODAL: LANDING (BRIDGE) --- */}
        {isLandingModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-xl p-6">
                    <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Editar Landing (Bridge)</h3>
                    <form onSubmit={saveLanding} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría Interna</label>
                            <input required className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={landingForm.internalCategory} onChange={e => setLandingForm({...landingForm, internalCategory: e.target.value})} placeholder="Ej. Certificaciones" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título de Tarjeta</label>
                            <input required className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={landingForm.title} onChange={e => setLandingForm({...landingForm, title: e.target.value})} placeholder="Ej. Examen TOEIC" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción Corta</label>
                            <textarea required rows={2} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={landingForm.shortDescription} onChange={e => setLandingForm({...landingForm, shortDescription: e.target.value})} placeholder="Breve resumen..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase mb-1 text-primary">Vincular a Detalle (Obligatorio)</label>
                            <select 
                                required
                                className="w-full bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded p-2 text-sm font-bold text-blue-900 dark:text-blue-100"
                                value={landingForm.linkedDetailId}
                                onChange={e => setLandingForm({...landingForm, linkedDetailId: e.target.value})}
                            >
                                <option value="">-- Seleccionar Página de Detalle --</option>
                                {details.map(d => (
                                    <option key={d.id} value={d.id}>{d.title}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setIsLandingModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold text-sm">Cancelar</button>
                            <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* --- MODAL: DETAIL PAGE --- */}
        {isDetailModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                <div className="bg-white dark:bg-surface-dark w-full max-w-4xl rounded-2xl shadow-xl p-6 my-10">
                    <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white border-b pb-2">Editor de Página Detallada</h3>
                    <form onSubmit={saveDetail} className="space-y-8">
                        
                        {/* 1. Hero Image */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">1. Seleccionar Foto Hero (Luxury Presets)</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {HERO_PRESETS.map(p => (
                                    <div 
                                        key={p.id} 
                                        onClick={() => setDetailForm({...detailForm, heroImage: p.url})}
                                        className={`relative h-24 rounded-lg overflow-hidden cursor-pointer border-2 ${detailForm.heroImage === p.url ? 'border-primary ring-2 ring-primary/30' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                    >
                                        <img src={p.url} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 w-full bg-black/50 text-white text-[10px] text-center py-1">{p.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. Basic Info */}
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título de Página (H1)</label>
                                <input required className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={detailForm.title} onChange={e => setDetailForm({...detailForm, title: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción Completa</label>
                                <textarea rows={4} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-2 text-sm dark:text-white" value={detailForm.description} onChange={e => setDetailForm({...detailForm, description: e.target.value})} />
                            </div>
                        </div>

                        {/* 3. Ventajas */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">3. Ventajas Georgetown (Editable)</label>
                            <div className="space-y-2">
                                {detailForm.features?.map((feat, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input className="w-16 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs text-center" value={feat.icon} onChange={e => updateFeature(i, 'icon', e.target.value)} />
                                        <input className="flex-1 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs font-bold" value={feat.title} onChange={e => updateFeature(i, 'title', e.target.value)} />
                                        <input className="flex-[2] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs" value={feat.desc} onChange={e => updateFeature(i, 'desc', e.target.value)} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 4. Options (Complex) */}
                        <div className="bg-slate-50 dark:bg-black/10 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <label className="block text-sm font-bold text-slate-900 dark:text-white uppercase">4. Opciones de Compra</label>
                                <button type="button" onClick={addOption} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded hover:bg-black font-bold">+ Agregar Opción</button>
                            </div>
                            
                            <div className="space-y-4">
                                {detailForm.options?.map((opt, idx) => (
                                    <div key={idx} className="bg-white dark:bg-surface-dark p-4 rounded-lg border border-slate-200 dark:border-slate-700 relative">
                                        <button type="button" onClick={() => removeOption(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Icon name="close" /></button>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Visuals */}
                                            <div className="space-y-2">
                                                <input className="w-full border rounded p-1.5 text-xs font-bold" placeholder="Título (ej. Pack Gold)" value={opt.marketingTitle} onChange={e => updateOption(idx, 'marketingTitle', e.target.value)} />
                                                <div className="flex gap-2">
                                                    <input className="w-1/2 border rounded p-1.5 text-xs" placeholder="Duración (ej. 2h)" value={opt.duration} onChange={e => updateOption(idx, 'duration', e.target.value)} />
                                                    <input className="w-1/2 border rounded p-1.5 text-xs font-bold text-green-600" placeholder="Precio ($85.00)" value={opt.priceLabel} onChange={e => updateOption(idx, 'priceLabel', e.target.value)} />
                                                </div>
                                                {/* NEW: Luxury Pricing Fields */}
                                                <div className="flex gap-2">
                                                    <input className="w-1/2 border rounded p-1.5 text-xs text-slate-500" placeholder="Precio Orig. ($120.00)" value={opt.originalPriceLabel || ''} onChange={e => updateOption(idx, 'originalPriceLabel', e.target.value)} />
                                                    <input className="w-1/2 border rounded p-1.5 text-xs font-bold text-amber-600" placeholder="Badge (OFERTA)" value={opt.discountBadgeText || ''} onChange={e => updateOption(idx, 'discountBadgeText', e.target.value)} />
                                                </div>
                                                <div className="flex gap-2">
                                                    <input className="w-1/2 border rounded p-1.5 text-xs" placeholder="Garantía 1" value={opt.guarantee1} onChange={e => updateOption(idx, 'guarantee1', e.target.value)} />
                                                    <input className="w-1/2 border rounded p-1.5 text-xs" placeholder="Garantía 2" value={opt.guarantee2} onChange={e => updateOption(idx, 'guarantee2', e.target.value)} />
                                                </div>
                                            </div>

                                            {/* Logic Link */}
                                            <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded border border-amber-200 dark:border-amber-800">
                                                <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase mb-1">Vincular Examen Real (DB)</label>
                                                <select 
                                                    className="w-full text-xs p-2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-black/20"
                                                    value={opt.linkedRealExamId}
                                                    onChange={e => updateOption(idx, 'linkedRealExamId', e.target.value)}
                                                >
                                                    <option value="">-- Seleccionar --</option>
                                                    {realExams.map(ex => (
                                                        <option key={ex.id} value={ex.id}>{ex.name} (${ex.price})</option>
                                                    ))}
                                                </select>
                                                <p className="text-[9px] text-amber-600 mt-1">
                                                    Al hacer clic en "Inscripción", se usará este ID para la lógica de pago.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                            <button type="button" onClick={() => setIsDetailModalOpen(false)} className="px-6 py-2.5 text-slate-500 font-bold text-sm">Cancelar</button>
                            <button type="submit" className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-lg">Guardar Todo</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </main>
  );
};

export default WebExamManager;

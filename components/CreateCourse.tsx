
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { getCategories, addCourse, getCourseById, updateCourse } from '../services/db';
import { Category } from '../types';
import { generateRefCode, createTeamsTeam } from '../services/microsoft';
import { GoogleGenAI } from "@google/genai";

interface CreateCourseProps {
    onBack: () => void;
    courseId?: string;
}

// --- RANDOM LUXURY IMAGE POOL ---
const IMAGE_POOL = [
    // Students / Learning
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1524178232363-1fb2b075b955?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1427504746696-ea3093607dbe?q=80&w=1000&auto=format&fit=crop",
    
    // Business / Corporate / Tech
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=1000&auto=format&fit=crop",
    
    // Travel / International
    "https://images.unsplash.com/photo-1526772662000-3f88f107f5b8?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1000&auto=format&fit=crop",
    
    // Abstract / Modern
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1000&auto=format&fit=crop"
];

const CreateCourse: React.FC<CreateCourseProps> = ({ onBack, courseId }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  // UI State
  const [loading, setLoading] = useState(false); // Only for SAVE button
  const [aiLoading, setAiLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'online' | 'presencial'>('presencial');
  const [isToeic, setIsToeic] = useState(false);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [days, setDays] = useState<string[]>([]);
  
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState(''); // NEW
  const [discountBadgeText, setDiscountBadgeText] = useState(''); // NEW
  const [order, setOrder] = useState(''); // NEW: Display Order
  const [paymentLink, setPaymentLink] = useState('');
  const [image, setImage] = useState('');
  
  const [refCode, setRefCode] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  
  // Teams State - Read only from DB if exists
  const [teamsInfo, setTeamsInfo] = useState<{status: string, link: string}>({ status: 'Ready', link: '' });

  // Suggested Images State
  const [suggestedImages, setSuggestedImages] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
        const cats = await getCategories();
        setCategories(cats);

        if (courseId) {
            setIsEditing(true);
            const courseData = await getCourseById(courseId);
            if (courseData) {
                setName(courseData.name);
                setCategory(courseData.category);
                setDescription(courseData.description);
                setMode(courseData.mode);
                setIsToeic(courseData.isToeic);
                setStartDate(courseData.startDate || '');
                setEndDate(courseData.endDate || '');
                setStartTime(courseData.defaultStartTime || courseData.startTime || '');
                setEndTime(courseData.defaultEndTime || courseData.endTime || '');
                setDays(courseData.defaultDays || courseData.days || []);
                setPrice(courseData.price.toString());
                setOriginalPrice(courseData.originalPrice?.toString() || ''); // NEW
                setDiscountBadgeText(courseData.discountBadgeText || ''); // NEW
                setOrder(courseData.order?.toString() || ''); // NEW
                setPaymentLink(courseData.paymentLink || '');
                setImage(courseData.image || '');
                setRefCode(courseData.refCode || '');
                setWhatsappLink(courseData.whatsappLink || '');
                setTeamsInfo({
                    status: courseData.teamsProvisioningStatus || 'Ready',
                    link: courseData.meetingLink || ''
                });
            }
        } else {
            setRefCode(generateRefCode());
        }
    };
    loadData();
  }, [courseId]);

  // RANDOMIZE IMAGES WHEN CATEGORY CHANGES
  useEffect(() => {
      // Pick 6 random images from pool
      const shuffled = [...IMAGE_POOL].sort(() => 0.5 - Math.random());
      setSuggestedImages(shuffled.slice(0, 6));
  }, [category]); // Triggers on mount (empty cat) and when cat changes

  // AI Description Generator
  const handleGenerateDescription = async () => {
      if (!name || !category) return alert("Ingrese nombre y categoría.");
      
      setAiLoading(true);
      try {
          const ai = new GoogleGenAI({ 
              apiKey: import.meta.env.VITE_GEMINI_API_KEY
          });
          const prompt = `Escribe una descripción comercial atractiva (máximo 250 caracteres) para un curso llamado "${name}". Categoría: ${category}.`;
          const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
          if (response.text) setDescription(response.text.trim());
      } catch (error: any) {
          alert(`Error AI: ${error.message}`);
      } finally {
          setAiLoading(false);
      }
  };

  const toggleDay = (day: string) => {
    if (days.includes(day)) setDays(days.filter(d => d !== day));
    else setDays([...days, day]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => setImage(reader.result as string);
        reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          const currentRefCode = refCode || generateRefCode();
          
          let teamsPayload: any = {};
          
          // STEP 1: CREATE TEAM IF NEW ONLINE COURSE
          // Only if mode is online AND no existing team link/status
          if (mode === 'online' && !teamsInfo.link && teamsInfo.status === 'Ready') {
              try {
                  const teamId = await createTeamsTeam(name, currentRefCode);
                  teamsPayload = {
                      teamsTeamId: teamId,
                      teamsProvisioningStatus: 'TeamCreated', // Step 1 Done
                      teamsCreatedAt: Date.now() // Start timer
                  };
                  alert("✅ Paso 1 Completo: Equipo de Teams Creado.\n\nEl enlace de reunión se generará automáticamente en 15 minutos (cuando Microsoft prepare el buzón). Verifique el estado en la lista de cursos.");
              } catch (teamsError: any) {
                  console.error("Teams Creation Failed", teamsError);
                  if(!confirm("⚠️ Error al crear Team en Microsoft. ¿Guardar el curso de todos modos (sin Teams)?")) {
                      setLoading(false);
                      return;
                  }
              }
          }

          const payload = {
              name, category, isToeic, mode, description,
              startDate, endDate, startTime, endTime, days,
              defaultDays: days, defaultStartTime: startTime, defaultEndTime: endTime,
              isRecurring: false, price: Number(price), 
              originalPrice: (originalPrice ? Number(originalPrice) : null) as any, // NEW
              discountBadgeText: (discountBadgeText || null) as any, // NEW
              order: (order ? parseInt(order) : null) as any, // NEW
              paymentLink, image,
              refCode: currentRefCode,
              whatsappLink,
              status: 'Active' as const,
              ...teamsPayload
          };

          if (isEditing && courseId) {
              await updateCourse(courseId, payload);
          } else {
              await addCourse(payload);
          }
          onBack();
      } catch (error) {
          console.error(error);
          alert('Error al guardar curso.');
      } finally {
          setLoading(false);
      }
  };

  return (
    <main className="fixed inset-0 z-50 flex flex-col w-full h-full bg-[#f8f9fc] dark:bg-[#0f111a] overflow-hidden">
      
      {/* Header */}
      <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0 shadow-sm z-10">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400">
                    <Icon name="arrow_back" className="text-xl" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{isEditing ? 'Editar Curso' : 'Nuevo Curso'}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Complete la información académica.</p>
                </div>
            </div>
            <div className="flex gap-3">
                <button type="button" onClick={onBack} className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm">Cancelar</button>
                <button onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm flex items-center gap-2">
                    <Icon name={loading ? "sync" : "save"} className={loading ? "animate-spin" : ""} />
                    {loading ? 'Procesando...' : 'Guardar Curso'}
                </button>
            </div>
        </div>
      </header>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                    <span className="w-1 h-4 bg-primary rounded-full"></span> Información General
                </h3>
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Nombre del Curso</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white" placeholder="Ej. Inglés Intensivo" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Categoría</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                                <option value="">Seleccionar...</option>
                                {categories.map(c => <option key={c.id} value={c.shortCode}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Modalidad</label>
                            <div className="flex bg-slate-100 dark:bg-black/20 p-1 rounded-xl">
                                <button type="button" onClick={() => setMode('presencial')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === 'presencial' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'}`}>Presencial</button>
                                <button type="button" onClick={() => setMode('online')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === 'online' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'}`}>Online</button>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Descripción</label>
                            <button type="button" onClick={handleGenerateDescription} disabled={aiLoading} className="text-[10px] font-bold text-primary flex items-center gap-1">{aiLoading ? 'Generando...' : 'Generar IA'}</button>
                        </div>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white resize-none" placeholder="Descripción del curso..." />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase flex items-center gap-2">
                            <span className="text-[#25D366] text-base"><i className="fab fa-whatsapp"></i></span> 
                            Enlace Grupo WhatsApp
                        </label>
                        <input value={whatsappLink} onChange={e => setWhatsappLink(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400" placeholder="https://chat.whatsapp.com/..." />
                        <p className="text-[10px] text-slate-400 mt-1">Este enlace se usará para invitar automáticamente a los estudiantes desde el calendario.</p>
                    </div>
                </div>
            </section>

            <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                    <span className="w-1 h-4 bg-orange-500 rounded-full"></span> Horarios
                </h3>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Fecha Inicio</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Hora Inicio</label>
                            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Fecha Fin</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Hora Fin</label>
                            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Días</label>
                        <div className="flex flex-wrap gap-2">
                            {['LUN','MAR','MIE','JUE','VIE','SAB','DOM'].map(d => (
                                <button type="button" key={d} onClick={() => toggleDay(d)} className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${days.includes(d) ? 'bg-slate-800 text-white' : 'bg-white dark:bg-black/20 text-slate-500'}`}>{d}</button>
                            ))}
                        </div>
                    </div>

                    {mode === 'online' && (
                        <div className={`mt-6 p-5 rounded-xl border-2 transition-all ${teamsInfo.link ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-200'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-sm text-indigo-900">Aula Virtual (Teams)</h4>
                            </div>
                            <p className="text-xs text-indigo-700/70 mb-3">
                                {teamsInfo.link 
                                    ? '✅ Aula configurada correctamente.' 
                                    : 'Al guardar, se iniciará el proceso de creación del Team (Paso 1). El enlace se generará en 15 minutos (Paso 2) automáticamente.'}
                            </p>
                            {teamsInfo.link && (
                                <div className="bg-white/50 p-3 rounded-lg border border-emerald-100 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <Icon name="check_circle" className="text-emerald-500" />
                                        <code className="text-[10px] text-emerald-700 truncate">{teamsInfo.link}</code>
                                    </div>
                                    <a href={teamsInfo.link} target="_blank" className="text-emerald-600 hover:text-emerald-800"><Icon name="open_in_new" /></a>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full"></span> Finanzas
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Precio Final ($)</label>
                        <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 rounded-xl p-3 font-bold" placeholder="0.00" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Precio Original ($) <span className="text-[10px] font-normal text-slate-400">(Opcional, para tachar)</span></label>
                        <input type="number" min="0" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 rounded-xl p-3 text-sm" placeholder="Ej. 100.00" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Texto de Descuento <span className="text-[10px] font-normal text-slate-400">(Opcional)</span></label>
                        <input value={discountBadgeText} onChange={e => setDiscountBadgeText(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 rounded-xl p-3 text-sm" placeholder="Ej. Exclusivo Online" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Orden de Visualización <span className="text-[10px] font-normal text-slate-400">(Opcional)</span></label>
                        <input type="number" value={order} onChange={e => setOrder(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 rounded-xl p-3 text-sm" placeholder="Ej. 1, 2, 3..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Link de Pago</label>
                        <input value={paymentLink} onChange={e => setPaymentLink(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 rounded-xl p-3 text-sm" placeholder="https://..." />
                    </div>
                </div>
            </section>

            <section className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-2">
                    <span className="w-1 h-4 bg-purple-500 rounded-full"></span> Imagen
                </h3>
                
                {/* Upload Area */}
                <div 
                    className={`relative w-full aspect-video rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer mb-4 ${image ? 'border-transparent' : 'border-slate-300'}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {image ? (
                        <div className="relative w-full h-full">
                            <img src={image} className="w-full h-full object-cover rounded-xl" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">Cambiar</div>
                        </div>
                    ) : (
                        <div className="text-slate-400 text-center"><Icon name="add_photo_alternate" className="text-3xl" /><br/><span className="text-xs">Subir</span></div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>

                {/* --- SUGGESTED IMAGES GRID (RESTORED) --- */}
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Recomendadas (Aleatorias)</p>
                    <div className="grid grid-cols-3 gap-2">
                        {suggestedImages.map((imgUrl, idx) => (
                            <div 
                                key={idx}
                                onClick={() => setImage(imgUrl)}
                                className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 ${image === imgUrl ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-80 hover:opacity-100'}`}
                            >
                                <img src={imgUrl} className="w-full h-full object-cover" alt="Suggestion" />
                            </div>
                        ))}
                    </div>
                    <button 
                        type="button" 
                        onClick={() => {
                            // Re-shuffle manually
                            const shuffled = [...IMAGE_POOL].sort(() => 0.5 - Math.random());
                            setSuggestedImages(shuffled.slice(0, 6));
                        }}
                        className="text-[10px] text-primary font-bold mt-2 hover:underline w-full text-center"
                    >
                        ↻ Cargar otras imágenes
                    </button>
                </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CreateCourse;

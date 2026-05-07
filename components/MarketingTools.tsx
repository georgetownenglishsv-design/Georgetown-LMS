
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from './Icon';
import { getCourses, getExams, getMessageTemplates, saveMessageTemplate, getCategories, batchSaveDailyQuizzes, getAllDailyQuizzes, deleteDailyQuiz, updateDailyQuiz, deleteAllDailyQuizzes, getUsedQuizTopics, saveUsedQuizTopics } from '../services/db';
import { Course, Exam, MessageTemplate, Category, DailyQuiz } from '../types';
import { getAppCheckToken } from '../firebase';
// @ts-ignore
import html2canvas from 'html2canvas';

const MarketingTools: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'promo' | 'resources' | 'quiz'>('promo');
    const [courses, setCourses] = useState<Course[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    
    // Quiz State
    const [quizGenerating, setQuizGenerating] = useState(false);
    const [progressStatus, setProgressStatus] = useState(''); 
    const [existingQuizzes, setExistingQuizzes] = useState<DailyQuiz[]>([]);
    
    // Quiz Edit State
    const [editingQuiz, setEditingQuiz] = useState<DailyQuiz | null>(null);
    const [editForm, setEditForm] = useState<Partial<DailyQuiz>>({});

    // UI State
    const [selectedItem, setSelectedItem] = useState<Course | Exam | null>(null);
    const [selectedType, setSelectedType] = useState<'course' | 'exam' | 'catalog' | 'guide'>('course'); 
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    
    const [targetPeriod, setTargetPeriod] = useState<'all' | 'bi-monthly'>('bi-monthly'); 
    
    const [designTheme, setDesignTheme] = useState<'gold' | 'blue'>('gold');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    
    const [messageText, setMessageText] = useState('');
    const flyerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const [cData, eData, tData, catData, qData] = await Promise.all([
                getCourses(), 
                getExams(),
                getMessageTemplates(),
                getCategories(),
                getAllDailyQuizzes()
            ]);
            setCourses(cData.filter(c => c.status === 'Active'));
            setExams(eData.filter(e => e.status === 'Active'));
            setTemplates(tData);
            setCategories(catData);
            setExistingQuizzes(qData);
            setLoading(false);
        };
        loadData();
    }, []);

    // --- QUIZ CRUD HANDLERS ---

    const handleDeleteAllQuizzes = async () => {
        if(!confirm("⚠️ PELIGRO: ¿Estás seguro de eliminar TODAS las preguntas del banco?\n\nEsta acción no se puede deshacer.")) return;
        setLoading(true);
        try {
            await deleteAllDailyQuizzes();
            setExistingQuizzes([]);
            alert("Banco de preguntas vaciado.");
        } catch(e) {
            alert("Error al eliminar.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteQuiz = async (id: string) => {
        if(!confirm("¿Eliminar esta pregunta?")) return;
        try {
            await deleteDailyQuiz(id);
            setExistingQuizzes(prev => prev.filter(q => q.id !== id));
        } catch(e) {
            alert("Error al eliminar.");
        }
    };

    const handleEditQuiz = (q: DailyQuiz) => {
        setEditingQuiz(q);
        setEditForm({...q});
    };

    const saveEditedQuiz = async () => {
        if(!editingQuiz || !editForm.question) return;
        try {
            await updateDailyQuiz(editingQuiz.id, editForm);
            setExistingQuizzes(prev => prev.map(q => q.id === editingQuiz.id ? { ...q, ...editForm } : q));
            setEditingQuiz(null);
        } catch(e) {
            alert("Error al guardar cambios.");
        }
    };

    // --- HYBRID GENERATION HANDLER (2-Step) ---
    const handleGenerateQuizzes = async () => {
        // Removed check for process.env.API_KEY because it's handled server-side now.

        // 1. Ask User for Mode
        const mode = prompt(
            "Seleccione modo de generación:\n\n[1] Auto (Evitar duplicados históricos)\n[2] Tema Específico (Ej. Aeropuerto, Restaurante)\n\nEscriba 1 o el nombre del tema:", 
            "1"
        );

        if (!mode) return;

        setQuizGenerating(true);
        setProgressStatus("Inicializando...");

        try {
            // --- STEP 1: TOPIC GENERATION ---
            setProgressStatus("Paso 1: Planificando temas únicos...");
            
            let exclusionInstruction = "";
            let themeInstruction = "";

            if (mode === "1" || mode.toLowerCase() === "auto") {
                const pastTopics = await getUsedQuizTopics();
                if (pastTopics.length > 0) {
                    // Limit context size just in case, take last 100 topics
                    const recentPast = pastTopics.slice(0, 100).join(", ");
                    exclusionInstruction = `CRITICAL: Do NOT use these topics: [${recentPast}]. Generate fresh ones.`;
                }
                themeInstruction = "Focus on general Spanglish grammar errors and common false friends.";
            } else {
                themeInstruction = `Focus ONLY on Spanglish errors related to the theme: "${mode}".`;
            }

            const topicPrompt = `Act as an expert English teacher for Spanish speakers. List 30 DISTINCT, specific grammatical errors or 'False Friends' (Spanglish) often made by beginners (A1-A2).
            Examples: 'People is', 'I am agree', 'Actually/Currently', 'Embarrassed/Embarazada'.
            ${exclusionInstruction}
            ${themeInstruction}
            Return ONLY a raw JSON array of strings. Example: ["'People is' vs 'People are'", "'I have 20 years' mistake"]`;

            const appCheckToken = await getAppCheckToken();
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (appCheckToken) {
              headers["X-Firebase-AppCheck"] = appCheckToken;
            }

            const topicRes = await fetch("/api/gemini", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    model: "gemini-2.5-flash",
                    contents: [{ role: "user", parts: [{ text: topicPrompt }] }],
                    config: { responseMimeType: "application/json" }
                })
            });
            if (!topicRes.ok) throw new Error("API request failed");
            const topicResponse = await topicRes.json();

            const topicJson = topicResponse.text;
            if (!topicJson) throw new Error("AI did not return topics.");
            
            let generatedTopics: string[] = [];
            try {
                generatedTopics = JSON.parse(topicJson);
            } catch (e) {
                // Fallback cleanup
                const clean = topicJson.replace(/```json|```/g, '').trim();
                generatedTopics = JSON.parse(clean);
            }

            if (!Array.isArray(generatedTopics) || generatedTopics.length === 0) {
                throw new Error("Invalid topic format returned.");
            }

            // Save topics to history immediately to prevent reuse next time
            await saveUsedQuizTopics(generatedTopics);

            // --- STEP 2: QUESTION GENERATION (Batching 15 + 15 for safety) ---
            setProgressStatus(`Paso 2: Generando preguntas (0/${generatedTopics.length})...`);
            
            let allNewQuizzes: DailyQuiz[] = [];
            
            // Determine start ID
            const existingIds = existingQuizzes.map(q => parseInt(q.id) || 0);
            let nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

            const BATCH_SIZE = 15;
            for (let i = 0; i < generatedTopics.length; i += BATCH_SIZE) {
                const currentBatchTopics = generatedTopics.slice(i, i + BATCH_SIZE);
                if (currentBatchTopics.length === 0) continue;

                setProgressStatus(`Paso 2: Generando bloque ${Math.floor(i/BATCH_SIZE)+1}...`);

                const questionPrompt = `Here is a list of specific grammar topics: ${JSON.stringify(currentBatchTopics)}.
                For EACH topic, generate 1 multiple-choice question.
                Target Level: A1-A2.
                
                STRICT FORMAT RULES:
                1. Question: Must be in SPANISH (e.g. "¿Cómo se dice...?" or "Corrige la frase...").
                2. Options: English sentences. One correct, one typical Spanglish mistake.
                3. Explanation: Spanish. Clear and concise.
                
                Output JSON Array of objects:
                {
                  "question": "string",
                  "options": ["string", "string"],
                  "correctAnswer": number (0 or 1),
                  "explanation": "string",
                  "category": "Spanglish"
                }`;

                const qRes = await fetch("/api/gemini", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        model: "gemini-2.5-flash",
                        contents: [{ role: "user", parts: [{ text: questionPrompt }] }],
                        config: { responseMimeType: "application/json" }
                    })
                });
                if (!qRes.ok) throw new Error("API request failed");
                const qResponse = await qRes.json();

                const qJson = qResponse.text;
                if (qJson) {
                    let rawQuizzes: any[] = [];
                    try {
                        rawQuizzes = JSON.parse(qJson);
                    } catch(e) {
                        const clean = qJson.replace(/```json|```/g, '').trim();
                        rawQuizzes = JSON.parse(clean);
                    }

                    if (Array.isArray(rawQuizzes)) {
                        rawQuizzes.forEach(q => {
                            allNewQuizzes.push({
                                id: (nextId++).toString(),
                                topic: q.topic || currentBatchTopics[0] || 'Spanglish',
                                embedUrl: q.embedUrl || '',
                                question: q.question,
                                options: q.options,
                                correctAnswer: q.correctAnswer,
                                explanation: q.explanation,
                                category: 'Spanglish'
                            });
                        });
                    }
                }
                
                // Slight delay to be nice to API
                await new Promise(r => setTimeout(r, 1000));
            }

            if (allNewQuizzes.length > 0) {
                setProgressStatus("Guardando en base de datos...");
                await batchSaveDailyQuizzes(allNewQuizzes);
                
                const newAll = await getAllDailyQuizzes();
                setExistingQuizzes(newAll);
                
                alert(`✅ ¡Éxito! Se generaron ${allNewQuizzes.length} preguntas nuevas basada en ${generatedTopics.length} temas únicos.`);
            } else {
                alert("⚠️ Error: La IA generó temas pero falló al crear las preguntas.");
            }

        } catch (e: any) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setQuizGenerating(false);
            setProgressStatus("");
        }
    };

    // --- DATA PROCESSING FOR CATALOG ---
    const catalogData = useMemo(() => {
        if (selectedType !== 'catalog') return null;
        let filtered = courses.filter(c => selectedCategory === 'all' || c.category === selectedCategory);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const nextMonthDate = new Date(currentYear, currentMonth + 2, 0); 

        if (targetPeriod === 'bi-monthly') {
            filtered = filtered.filter(c => {
                if (!c.startDate) return false;
                const [y, m, d] = c.startDate.split('-').map(Number);
                const cDate = new Date(y, m - 1, d);
                const startOfThisMonth = new Date(currentYear, currentMonth, 1);
                return cDate >= startOfThisMonth && cDate <= nextMonthDate;
            });
        }
        const groups: { [key: string]: Course[] } = {};
        const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        filtered.forEach(c => {
            if (!c.startDate) return;
            const [y, m, d] = c.startDate.split('-').map(Number);
            const key = `${monthNames[m - 1]} ${y}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        });
        return groups;
    }, [courses, selectedType, selectedCategory, targetPeriod]);

    const getDensityClasses = () => {
        let totalItems = 0;
        if (catalogData) {
            Object.values(catalogData).forEach(items => totalItems += items.length);
        }

        if (totalItems > 12) {
            return {
                container: 'pt-6 pb-2',
                header: 'text-2xl',
                hideFooter: true,
                groupHeader: 'mb-1 mt-2 text-[10px]',
                rowPy: 'py-1',
                text: 'text-[9px]',
                subtext: 'text-[7px]'
            };
        } else if (totalItems > 8) {
            return {
                container: 'pt-8 pb-4',
                header: 'text-3xl',
                hideFooter: false,
                groupHeader: 'mb-2 mt-3 text-xs',
                rowPy: 'py-2',
                text: 'text-xs',
                subtext: 'text-[9px]'
            };
        } else {
            return {
                container: 'pt-10 pb-6',
                header: 'text-4xl',
                hideFooter: false,
                groupHeader: 'mb-3 mt-4 text-sm',
                rowPy: 'py-3',
                text: 'text-sm',
                subtext: 'text-[10px]'
            };
        }
    };

    const density = getDensityClasses();

    useEffect(() => {
        let defaultText = "";
        if (selectedType === 'guide') {
            defaultText = `🔐 *Guía de Acceso - Portal Estudiantil*\n\nHola! Aquí tienes los pasos para ingresar a tu aula virtual:\n\n1️⃣ Entra a: ${window.location.origin}/student/login\n2️⃣ Usuario: Tu Correo\n3️⃣ Clave: Tu Apellido\n\nCualquier duda, estamos a la orden.`;
        } else {
            const templateType = selectedType === 'catalog' ? 'catalog' : 'promo';
            const savedTemplate = templates.find(t => t.type === templateType && t.isDefault);
            if (savedTemplate) {
                defaultText = savedTemplate.content;
            } else {
                if (selectedType === 'course' && selectedItem) {
                    const c = selectedItem as Course;
                    defaultText = `🎓 *{{name}}*\n\n📅 Inicio: {{startDate}}\n⏰ Horario: {{startTime}} - {{endTime}}\n🗓️ Días: {{days}}\n💰 Inversión: $\${{price}}\n\n👉 *Inscríbete aquí:* ${window.location.origin}/courses/${c.id}`;
                } else if (selectedType === 'exam' && selectedItem) {
                    const e = selectedItem as Exam;
                    defaultText = `🏆 *Certificación {{name}}*\n\n💰 Costo: $\${{price}}\n🌐 Modalidad: {{mode}}\n\n👉 *Más información:* ${window.location.origin}/exams`;
                } else if (selectedType === 'catalog') {
                    defaultText = `📚 *Oferta Académica - Georgetown Academy*\n\nAquí tienes nuestra programación para {{category}}:\n\n{{list}}\n\n👉 *Ver detalles:* ${window.location.origin}/courses`;
                }
            }
        }
        if (selectedItem || selectedType === 'catalog' || selectedType === 'guide') {
            let replaced = defaultText;
            if (selectedType === 'catalog') {
                const catName = selectedCategory === 'all' ? 'Todos los Programas' : categories.find(c => c.shortCode === selectedCategory)?.name || selectedCategory;
                let listText = "";
                if (catalogData) {
                    Object.entries(catalogData).forEach(([month, items]) => {
                        listText += `\n📅 *${month}*\n`;
                        items.forEach(c => { listText += `• ${c.name} (${c.startTime}) - $${c.price.toFixed(2)}\n`; });
                    });
                }
                replaced = replaced.replace(/{{category}}/g, catName).replace(/{{list}}/g, listText);
            } else if (selectedItem) {
                const item = selectedItem as any;
                replaced = replaced.replace(/{{name}}/g, item.name).replace(/{{price}}/g, item.price?.toFixed(2)).replace(/{{startDate}}/g, item.startDate || 'Próximamente').replace(/{{startTime}}/g, item.startTime || '').replace(/{{endTime}}/g, item.endTime || '').replace(/{{days}}/g, item.days?.join(', ') || '').replace(/{{mode}}/g, item.mode || '');
            }
            setMessageText(replaced);
        } else { setMessageText(""); }
    }, [selectedItem, selectedType, selectedCategory, targetPeriod, catalogData]);

    const handleSaveTemplate = async () => {
        const name = prompt("Nombre para esta plantilla:", "Nueva Plantilla");
        if (!name) return;
        const newTemplate: MessageTemplate = { id: Date.now().toString(), type: selectedType === 'catalog' ? 'promo' : 'promo', name: name, content: messageText, isDefault: false };
        await saveMessageTemplate(newTemplate);
        setTemplates([...templates, newTemplate]);
        alert("Plantilla guardada.");
    };

    const handleCopyImage = async () => {
        if (!flyerRef.current) return;
        setGenerating(true);
        try {
            await new Promise(r => setTimeout(r, 500));
            const canvas = await html2canvas(flyerRef.current, { useCORS: true, scale: 2, backgroundColor: null });
            canvas.toBlob(async (blob: any) => {
                if (!blob) { alert("Error al generar imagen."); return; }
                try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); alert("✨ ¡Imagen copiada!\nPegar en WhatsApp (Ctrl+V)."); } catch (err) { alert("Tu navegador no soporta copiado directo."); }
            });
        } catch (e) { alert("Error al generar flyer."); } finally { setGenerating(false); }
    };

    const handleCopyText = () => { navigator.clipboard.writeText(messageText); alert("Texto copiado."); };
    const getTitleSize = (text: string) => { if (text.length < 15) return 'text-5xl'; if (text.length < 25) return 'text-4xl'; if (text.length < 35) return 'text-3xl'; return 'text-2xl leading-tight'; };
    const bgImage = designTheme === 'gold' ? "https://images.unsplash.com/photo-1554034483-04fda0d3507b?q=80&w=1000&auto=format&fit=crop" : "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=1000&auto=format&fit=crop";
    const accentColor = designTheme === 'gold' ? 'text-[#D4AF37]' : 'text-[#0d7ff2]';
    const borderColor = designTheme === 'gold' ? 'border-[#D4AF37]' : 'border-[#0d7ff2]';
    const themeBg = designTheme === 'gold' ? 'bg-[#D4AF37]' : 'bg-[#0d7ff2]';

    return (
        <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Icon name="campaign" className="text-primary" /> Marketing Studio
                    </h1>
                    <p className="text-sm text-slate-500">Crea contenido visual profesional y gestiona el Quiz Diario.</p>
                </div>
                <div className="flex bg-slate-100 dark:bg-black/20 p-1 rounded-xl">
                    <button onClick={() => { setActiveTab('promo'); setSelectedType('course'); }} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'promo' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Programas</button>
                    <button onClick={() => { setActiveTab('resources'); setSelectedType('guide'); setSelectedItem(null); }} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'resources' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Recursos</button>
                    <button onClick={() => { setActiveTab('quiz'); }} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'quiz' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Reto Diario (AI)</button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col md:flex-row gap-8">
                
                {/* --- TAB: DAILY QUIZ --- */}
                {activeTab === 'quiz' && (
                    <div className="w-full max-w-4xl mx-auto space-y-8">
                        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-10"><Icon name="psychology" className="text-9xl" /></div>
                            <h2 className="text-2xl font-black mb-4 flex items-center gap-3">
                                <Icon name="auto_awesome" /> Generador de Reto Diario
                            </h2>
                            <p className="text-indigo-100 text-sm mb-6 max-w-xl leading-relaxed">
                                Genera automáticamente un banco de preguntas enfocado en <b>"Errores Comunes (Spanglish)"</b>. 
                                Nivel A1-A2. La IA evitará duplicados automáticamente.
                            </p>
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={handleGenerateQuizzes}
                                    disabled={quizGenerating}
                                    className="bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {quizGenerating ? <Icon name="sync" className="animate-spin text-xl" /> : <Icon name="bolt" className="text-xl" />}
                                    {quizGenerating ? progressStatus : "Generar 30 Preguntas (Spanglish)"}
                                </button>
                                <div className="text-xs font-bold bg-white/10 px-4 py-2 rounded-lg">
                                    Total: {existingQuizzes.length}
                                </div>
                            </div>
                        </div>

                        {/* Quiz List Preview */}
                        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Banco de Preguntas Actual</h3>
                                <button 
                                    onClick={handleDeleteAllQuizzes}
                                    className="text-xs text-red-500 hover:text-red-600 font-bold flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <Icon name="delete_forever" /> Borrar Todo
                                </button>
                            </div>
                            
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {existingQuizzes.length === 0 ? (
                                    <div className="text-center text-slate-400 py-10">El banco está vacío. Genera preguntas para comenzar.</div>
                                ) : (
                                    existingQuizzes.map((q) => (
                                        <div key={q.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-black/20 group relative">
                                            {/* Action Buttons */}
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditQuiz(q)} className="p-1.5 bg-white dark:bg-slate-700 rounded text-slate-500 hover:text-blue-500 shadow-sm"><Icon name="edit" /></button>
                                                <button onClick={() => handleDeleteQuiz(q.id)} className="p-1.5 bg-white dark:bg-slate-700 rounded text-slate-500 hover:text-red-500 shadow-sm"><Icon name="delete" /></button>
                                            </div>

                                            {/* Editing Mode */}
                                            {editingQuiz?.id === q.id ? (
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400">Pregunta (ES)</label>
                                                        <input className="w-full text-sm font-bold p-2 border rounded" value={editForm.question} onChange={e => setEditForm({...editForm, question: e.target.value})} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400">Explicación (ES)</label>
                                                        <textarea rows={2} className="w-full text-xs p-2 border rounded" value={editForm.explanation} onChange={e => setEditForm({...editForm, explanation: e.target.value})} />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={saveEditedQuiz} className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded">Guardar</button>
                                                        <button onClick={() => setEditingQuiz(null)} className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded">Cancelar</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded">ID: {q.id}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold">Respuesta: {q.correctAnswer !== undefined ? String.fromCharCode(65 + q.correctAnswer) : '?'}</span>
                                                    </div>
                                                    <p className="font-bold text-slate-900 dark:text-white text-sm mb-2">{q.question}</p>
                                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                                        {(q.options || []).map((opt, i) => (
                                                            <div key={i} className={`text-xs p-2 rounded border ${i === q.correctAnswer ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500'}`}>
                                                                {String.fromCharCode(65+i)}. {opt}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="text-xs text-slate-600 dark:text-slate-400 italic bg-white dark:bg-white/5 p-2 rounded border border-slate-100 dark:border-slate-700">
                                                        <span className="font-bold not-italic">💡 Explicación:</span> {q.explanation}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ORIGINAL PROMO/RESOURCES TABS --- */}
                {(activeTab === 'promo' || activeTab === 'resources') && (
                    <>
                        {/* CONTROLS PANEL */}
                        <div className="w-full md:w-1/3 flex flex-col gap-6">
                            {/* ... (Existing Controls - No Changes, just reused) ... */}
                            <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                                {/* Only show controls relevant to the tab */}
                                {activeTab === 'promo' ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">1. Modo de Flyer</label>
                                            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-black/20 rounded-xl">
                                                <button onClick={() => { setSelectedType('course'); setSelectedItem(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${selectedType === 'course' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>Curso Único</button>
                                                <button onClick={() => { setSelectedType('catalog'); setSelectedItem(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${selectedType === 'catalog' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>Catálogo (Lista)</button>
                                                <button onClick={() => { setSelectedType('exam'); setSelectedItem(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${selectedType === 'exam' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>Examen</button>
                                            </div>
                                        </div>
                                        
                                        {selectedType === 'catalog' ? (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">2. Filtrar Categoría</label>
                                                    <select className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold dark:text-white outline-none" onChange={(e) => setSelectedCategory(e.target.value)} value={selectedCategory}>
                                                        <option value="all">Todas las Categorías</option>
                                                        {categories.map(c => <option key={c.id} value={c.shortCode}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">3. Periodo</label>
                                                    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-black/20 rounded-xl">
                                                        <button onClick={() => setTargetPeriod('bi-monthly')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${targetPeriod === 'bi-monthly' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>Prox. 2 Meses</button>
                                                        <button onClick={() => setTargetPeriod('all')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${targetPeriod === 'all' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>Todo</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">2. Seleccionar {selectedType === 'course' ? 'Curso' : 'Examen'}</label>
                                                <select className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold dark:text-white outline-none" onChange={(e) => { const id = e.target.value; const item = selectedType === 'course' ? courses.find(c => c.id === id) : exams.find(ex => ex.id === id); setSelectedItem(item || null); }} value={selectedItem?.id || ''}>
                                                    <option value="">-- Seleccionar --</option>
                                                    {selectedType === 'course' ? courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.startTime})</option>) : exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Diseño Visual</label>
                                            <div className="flex gap-2">
                                                <button onClick={() => setDesignTheme('gold')} className={`flex-1 py-2 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 ${designTheme === 'gold' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-slate-200 text-slate-500'}`}><div className="size-3 bg-[#D4AF37] rounded-full"></div> Gold</button>
                                                <button onClick={() => setDesignTheme('blue')} className={`flex-1 py-2 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 ${designTheme === 'blue' ? 'border-[#0d7ff2] bg-[#0d7ff2]/10 text-[#0d7ff2]' : 'border-slate-200 text-slate-500'}`}><div className="size-3 bg-[#0d7ff2] rounded-full"></div> Blue</button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div 
                                        onClick={() => { setSelectedType('guide'); setSelectedItem(null); }}
                                        className={`p-4 border rounded-xl flex items-center gap-4 cursor-pointer group transition-all ${selectedType === 'guide' ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 dark:hover:bg-white/5 border-slate-200'}`}
                                    >
                                        <div className="size-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><Icon name="login" className="text-2xl" /></div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-900 dark:text-white">Guía de Acceso</h4>
                                            <p className="text-xs text-slate-500">Tutorial de login para alumnos</p>
                                        </div>
                                        <button className="text-primary font-bold text-xs">Ver</button>
                                    </div>
                                )}

                                {/* Message Editor & Actions */}
                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Mensaje WhatsApp</label>
                                        <button onClick={handleSaveTemplate} className="text-[10px] text-primary font-bold hover:underline">Guardar Tpl</button>
                                    </div>
                                    <textarea className="w-full h-32 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm resize-none focus:ring-1 focus:ring-primary dark:text-white" value={messageText} onChange={(e) => setMessageText(e.target.value)}></textarea>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button onClick={handleCopyImage} disabled={(!selectedItem && selectedType !== 'catalog' && selectedType !== 'guide') || generating} className="w-full py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                        {generating ? <Icon name="sync" className="animate-spin" /> : <Icon name="image" />} Copiar Imagen (Portapapeles)
                                    </button>
                                    <button onClick={handleCopyText} disabled={!messageText} className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-xl font-bold active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                        <Icon name="content_copy" /> Copiar Mensaje
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* --- PREVIEW PANEL (CANVAS) --- */}
                        <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-black/20 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 md:p-8 min-h-[600px] overflow-hidden relative">
                            {(!selectedItem && selectedType !== 'catalog' && selectedType !== 'guide') ? (
                                <div className="text-center text-slate-400">
                                    <Icon name="style" className="text-6xl mb-4 opacity-30" />
                                    <p className="text-lg font-medium">Selecciona un elemento para previsualizar</p>
                                </div>
                            ) : (
                                <div className="scale-[0.5] sm:scale-[0.6] md:scale-[0.65] lg:scale-[0.7] origin-center shadow-2xl">
                                    <div ref={flyerRef} className="w-[400px] h-[710px] relative bg-[#111] overflow-hidden flex flex-col text-white font-display">
                                        {/* Background Image */}
                                        <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url("${(selectedItem as any)?.image || bgImage}")` }}></div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/30"></div>
                                        
                                        {/* Header */}
                                        <div className={`relative z-10 text-center ${density.container}`}>
                                            <p className={`text-xs font-bold tracking-[0.3em] uppercase mb-2 ${accentColor}`}>Georgetown Academy</p>
                                            {selectedType === 'catalog' ? (
                                                <>
                                                    <h1 className={`${density.header} font-black leading-[1.1] tracking-tight uppercase drop-shadow-2xl px-4`}>
                                                        {selectedCategory === 'all' ? 'Oferta Académica' : categories.find(c => c.shortCode === selectedCategory)?.name || selectedCategory}
                                                    </h1>
                                                    <div className={`h-1 w-20 mx-auto mt-4 rounded-full ${themeBg}`}></div>
                                                    {!density.hideFooter && <p className="text-xs mt-2 text-gray-300 font-bold uppercase tracking-widest bg-white/10 inline-block px-3 py-1 rounded-full">Inscripciones Abiertas</p>}
                                                </>
                                            ) : selectedType === 'guide' ? (
                                                <>
                                                    <h1 className="text-3xl font-black leading-[1.1] tracking-tight uppercase drop-shadow-2xl px-4">Guía de Acceso</h1>
                                                    <div className={`h-1 w-20 mx-auto mt-4 rounded-full ${themeBg}`}></div>
                                                    <p className="text-xs mt-3 text-gray-300 font-bold uppercase tracking-widest">Portal Estudiantil</p>
                                                </>
                                            ) : (
                                                <>
                                                    <h1 className={`font-black leading-[0.9] tracking-tight uppercase drop-shadow-2xl ${getTitleSize((selectedItem as any).name)}`}>{(selectedItem as any).name}</h1>
                                                    <div className={`h-1 w-20 mx-auto mt-4 rounded-full ${themeBg}`}></div>
                                                </>
                                            )}
                                        </div>

                                        {/* Body Info */}
                                        <div className="relative z-10 flex-1 flex flex-col px-6 gap-5 overflow-hidden">
                                            {selectedType === 'catalog' && catalogData ? (
                                                <div className={`flex flex-col pt-2`}>
                                                    {Object.entries(catalogData).length === 0 ? <p className="text-center text-gray-500 italic mt-10">No hay cursos disponibles.</p> : Object.entries(catalogData).map(([month, courses]) => (
                                                        <div key={month} className="flex flex-col">
                                                            <div className={`flex items-center gap-2 ${density.groupHeader}`}><div className={`h-px flex-1 bg-white/20`}></div><span className={`font-black uppercase tracking-widest ${accentColor}`}>{month}</span><div className={`h-px flex-1 bg-white/20`}></div></div>
                                                            <div className="flex flex-col">
                                                                {courses.map((c, i) => (
                                                                    <div key={i} className={`flex justify-between items-center border-b border-white/5 last:border-0 ${density.rowPy}`}>
                                                                        <div className="flex-1 min-w-0 pr-2"><p className={`${density.text} font-bold text-white leading-tight break-words mb-0.5`}>{c.name}</p><div className="flex items-center gap-1.5"><p className={`${density.subtext} font-black ${accentColor} tracking-wide`}>{c.startTime} - {c.endTime}</p><span className={`${density.subtext} text-gray-600`}>|</span><p className={`${density.subtext} text-gray-400 font-medium uppercase tracking-wide`}>{c.days?.join('/')}</p></div></div>
                                                                        <div className="shrink-0 text-right"><p className={`font-black ${density.text} ${accentColor}`}>${c.price.toFixed(2)}</p></div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : selectedType === 'guide' ? (
                                                <div className="flex flex-col justify-center h-full gap-6 px-4">
                                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col gap-6">
                                                        <div className="flex items-center gap-4"><div className="size-12 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0"><Icon name="public" className="text-2xl" /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Paso 1: Entra al link</p><p className="text-lg font-bold text-white">georgetown.academy</p><p className="text-[10px] text-blue-400 font-bold">Sección: "Soy Alumno"</p></div></div>
                                                        <div className="h-px bg-white/10 w-full"></div>
                                                        <div className="flex items-center gap-4"><div className="size-12 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0"><Icon name="person" className="text-2xl" /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Paso 2: Usuario</p><p className="text-lg font-bold text-white">Tu Correo</p><p className="text-[10px] text-gray-500 italic">(El que registraste)</p></div></div>
                                                        <div className="flex items-center gap-4"><div className="size-12 rounded-full bg-orange-600 flex items-center justify-center text-white shrink-0"><Icon name="lock" className="text-2xl" /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Paso 3: Contraseña</p><p className="text-lg font-bold text-white">Tu Apellido</p><p className="text-[10px] text-gray-500 italic">(Primera letra Mayúscula)</p></div></div>
                                                    </div>
                                                    <div className="text-center"><p className="text-gray-400 text-xs">¿Problemas para ingresar?</p><p className={`font-bold ${accentColor} text-sm mt-1`}>Soporte: +503 7680-5577</p></div>
                                                </div>
                                            ) : selectedType === 'course' ? (
                                                <div className="flex flex-col justify-center h-full gap-6 px-4">
                                                    <div className="flex items-center gap-4"><div className={`size-12 rounded-full border ${borderColor} flex items-center justify-center ${accentColor} shrink-0`}><Icon name="event" className="text-2xl" /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Inicio de Clases</p><p className="text-2xl font-bold">{(selectedItem as Course).startDate}</p></div></div>
                                                    <div className="flex items-center gap-4"><div className={`size-12 rounded-full border ${borderColor} flex items-center justify-center ${accentColor} shrink-0`}><Icon name="schedule" className="text-2xl" /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Horario</p><p className="text-xl font-bold leading-tight">{(selectedItem as Course).startTime} - {(selectedItem as Course).endTime}</p><p className="text-sm text-gray-400 uppercase font-bold mt-1">{(selectedItem as Course).days?.join(' / ')}</p></div></div>
                                                    <div className="flex items-center gap-4"><div className={`size-12 rounded-full border ${borderColor} flex items-center justify-center ${accentColor} shrink-0`}><Icon name={(selectedItem as Course).mode === 'online' ? 'wifi' : 'domain'} className="text-2xl" /></div><div><p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Modalidad</p><p className="text-2xl font-bold capitalize">{(selectedItem as Course).mode}</p></div></div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-20 flex flex-col items-center justify-center h-full"><Icon name="verified" className={`text-6xl mb-6 ${accentColor}`} /><p className="text-gray-300 text-lg leading-relaxed mb-6 font-medium px-4">Certificación oficial internacional. Valida tu nivel de inglés con estándares globales.</p><div className={`inline-block border ${borderColor} px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest ${accentColor}`}>Resultados Express</div></div>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        {selectedType !== 'guide' && (
                                            <div className="relative z-10 bg-white/10 backdrop-blur-md p-8 flex justify-between items-center border-t border-white/10 mt-auto">
                                                {selectedType === 'catalog' ? (
                                                    <div className="w-full text-center">{!density.hideFooter && <p className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Inscripciones Abiertas</p>}<p className={`text-2xl font-black ${accentColor} mt-1`}>Cupos Limitados</p></div>
                                                ) : (
                                                    <><div className="flex flex-col"><p className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Inversión</p><p className={`text-5xl font-black ${accentColor}`}>${(selectedItem as any).price.toFixed(2)}</p></div><div className={`size-14 rounded-full bg-white flex items-center justify-center ${designTheme === 'gold' ? 'text-black' : 'text-blue-600'}`}><Icon name="arrow_forward" className="text-3xl" /></div></>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
};

export default MarketingTools;

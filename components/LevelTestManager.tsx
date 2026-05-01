
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { getPlacementResults, getPlacementQuestions, batchSaveQuestions, updateQuestion, deleteQuestion, updatePlacementResult, deletePlacementResult, db } from '../services/db';
import { PlacementResult, Question } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

const LevelTestManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'results' | 'questions'>('results');
    const [results, setResults] = useState<PlacementResult[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filter State
    const [filterLevel, setFilterLevel] = useState<string>('ALL');

    // AI Generator State
    const [generating, setGenerating] = useState(false);
    const [genLevel, setGenLevel] = useState('B1');
    const [genCount, setGenCount] = useState(20);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [resData, qData] = await Promise.all([
            getPlacementResults(),
            getPlacementQuestions()
        ]);
        setResults(resData);
        setQuestions(qData);
        setLoading(false);
    };

    const handleWhatsAppContact = (phone: string, name: string, level: string) => {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const msg = `Hola ${name}, vimos que completaste el Test de Nivel en Georgetown Academy con resultado *${level}*. ¿Te gustaría agendar una asesoría para inscribirte?`;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const toggleContactStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Contacted' ? 'New' : 'Contacted';
        try {
            await updatePlacementResult(id, { status: newStatus as any });
            setResults(prev => prev.map(r => r.id === id ? { ...r, status: newStatus as any } : r));
        } catch (e) {
            alert("Error al actualizar estado.");
        }
    };

    const handleDeleteResult = async (id: string) => {
        if(!confirm("¿Eliminar este resultado?")) return;
        try {
            await deletePlacementResult(id);
            setResults(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            alert("Error al eliminar.");
        }
    };

    const handleGenerateQuestions = async () => {
        // Removed check for process.env.API_KEY because it's handled server-side now.

        // Limit batch size to prevent AI timeouts/cuts
        const SAFE_BATCH_SIZE = 20;
        let finalGenCount = genCount;
        
        if (genCount > SAFE_BATCH_SIZE) {
            if(!confirm(`⚠️ Generar ${genCount} preguntas de una vez puede causar errores. ¿Reducir a ${SAFE_BATCH_SIZE} para mayor seguridad?`)) {
                return;
            }
            finalGenCount = SAFE_BATCH_SIZE;
            setGenCount(SAFE_BATCH_SIZE);
        }

        if (!confirm(`¿Generar ${finalGenCount} preguntas nuevas de nivel ${genLevel} usando IA?\n(Los duplicados se eliminarán automáticamente)`)) return;

        setGenerating(true);
        try {
            const ai = new GoogleGenAI({ 
                apiKey: import.meta.env.VITE_GEMINI_API_KEY
            });
            const existingTexts = new Set(questions.map(q => q.text ? q.text.trim().toLowerCase() : ""));

            const prompt = `Generate ${finalGenCount} unique English multiple-choice questions for CEFR level ${genLevel}.
            Focus on grammar and vocabulary suitable for placement testing.
            Return ONLY a JSON array. Do not use Markdown blocks. Each object must have:
            - text (string): The question body.
            - options (string[]): Array of 4 options.
            - correctAnswer (number): Index of correct option (0-3).
            - category (string): Either 'Grammar' or 'Vocabulary'.
            - level (string): "${genLevel}"
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                correctAnswer: { type: Type.INTEGER },
                                category: { type: Type.STRING },
                                level: { type: Type.STRING }
                            }
                        }
                    }
                }
            });

            const rawText = response.text;
            if (!rawText) throw new Error("No response from AI");
            
            // Clean up Markdown if AI adds it despite instructions
            const cleanJson = rawText.replace(/```json|```/g, '').trim();

            let newQuestions;
            try {
                newQuestions = JSON.parse(cleanJson);
            } catch (parseError) {
                console.error("Failed to parse JSON:", cleanJson);
                throw new Error("AI returned invalid JSON format.");
            }
            
            if (!Array.isArray(newQuestions)) {
                throw new Error("AI did not return an array.");
            }

            const uniqueBatch: any[] = [];
            let duplicateCount = 0;
            let invalidCount = 0;

            newQuestions.forEach((q: any) => {
                // Strong Validation
                if (!q.text || !Array.isArray(q.options) || q.options.length < 2 || typeof q.correctAnswer !== 'number') {
                    console.warn("Skipping invalid question from AI:", q);
                    invalidCount++;
                    return;
                }

                const normalizedText = q.text.trim().toLowerCase();
                if (existingTexts.has(normalizedText)) {
                    duplicateCount++;
                } else {
                    uniqueBatch.push({ ...q, active: true });
                    existingTexts.add(normalizedText); 
                }
            });
            
            if (uniqueBatch.length > 0) {
                await batchSaveQuestions(uniqueBatch);
                alert(`✅ Proceso Finalizado:\n\n- Generados: ${newQuestions.length}\n- Guardados: ${uniqueBatch.length} (Nuevos)\n- Omitidos: ${duplicateCount} (Duplicados)\n- Inválidos: ${invalidCount}`);
                fetchData();
            } else {
                alert(`⚠️ Se generaron preguntas, pero todas eran duplicadas o inválidas.`);
            }

        } catch (e: any) {
            console.error(e);
            alert("Error generating questions: " + e.message);
        } finally {
            setGenerating(false);
        }
    };

    // --- CRUD Handlers ---

    const handleDeleteQuestion = async (id: string) => {
        if (!confirm("¿Eliminar esta pregunta?")) return;
        try {
            await deleteQuestion(id);
            // Optimistic Update
            setQuestions(prev => prev.filter(q => q.id !== id));
        } catch (e) {
            alert("Error al eliminar.");
        }
    };

    const handleEditQuestion = (q: Question) => {
        setEditingQuestion({ ...q });
        setIsEditModalOpen(true);
    };

    const saveEditedQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingQuestion) return;
        try {
            await updateQuestion(editingQuestion.id, editingQuestion);
            setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? editingQuestion : q));
            setIsEditModalOpen(false);
            setEditingQuestion(null);
        } catch (e) {
            alert("Error al guardar cambios.");
        }
    };

    // --- Filtering & Pagination Logic ---
    const filteredQuestions = questions.filter(q => 
        filterLevel === 'ALL' ? true : q.level === filterLevel
    );

    const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
    const paginatedQuestions = filteredQuestions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(prev => prev - 1);
    };

    const handleFilterChange = (level: string) => {
        setFilterLevel(level);
        setCurrentPage(1); // Reset to first page
    };

    return (
        <main className="flex-1 flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">Test de Nivel (Leads)</h1>
                    <p className="text-sm text-slate-500">Gestiona prospectos y el banco de preguntas.</p>
                </div>
                <div className="flex bg-slate-100 dark:bg-black/20 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('results')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'results' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>Resultados</button>
                    <button onClick={() => setActiveTab('questions')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'questions' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>Banco de Preguntas</button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10">
                {activeTab === 'results' && (
                    <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-black/20 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Estudiante</th>
                                    <th className="px-6 py-4">Contacto</th>
                                    <th className="px-6 py-4">Puntaje Detallado</th>
                                    <th className="px-6 py-4 text-center">Nivel</th>
                                    <th className="px-6 py-4 text-center">Estado</th>
                                    <th className="px-6 py-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {results.map(res => (
                                    <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                        <td className="px-6 py-4 text-xs text-slate-500">{new Date(res.date).toLocaleDateString()} {new Date(res.date).toLocaleTimeString()}</td>
                                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{res.studentName}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{res.studentPhone}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-sm font-black text-slate-800 dark:text-white">
                                                    {Math.round((res.score / 100) * res.totalQuestions)} / {res.totalQuestions} ({res.score}%)
                                                </div>
                                                {res.levelBreakdown ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {Object.entries(res.levelBreakdown).map(([lvl, stats]) => (
                                                            <span key={lvl} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 rounded text-slate-500 dark:text-slate-300 font-medium">
                                                                {lvl}: {stats.correct}/{stats.total}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400">Sin detalle</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">{res.calculatedLevel}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => toggleContactStatus(res.id, res.status)}
                                                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${res.status === 'Contacted' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                                            >
                                                {res.status === 'Contacted' ? 'Contactado' : 'Nuevo'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => handleWhatsAppContact(res.studentPhone, res.studentName, res.calculatedLevel)}
                                                    className="bg-[#25D366] hover:bg-[#20bd5a] text-white p-2 rounded-lg transition-colors"
                                                    title="Contactar por WhatsApp"
                                                >
                                                    <Icon name="whatsapp" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteResult(res.id)}
                                                    className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded-lg transition-colors"
                                                    title="Eliminar registro"
                                                >
                                                    <Icon name="delete" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {results.length === 0 && <div className="p-8 text-center text-slate-500">No hay resultados de test todavía.</div>}
                    </div>
                )}

                {activeTab === 'questions' && (
                    <div className="space-y-6">
                        {/* Generator Panel */}
                        <div className="bg-gradient-to-r from-indigo-900 to-blue-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-10"><Icon name="auto_awesome" className="text-9xl" /></div>
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Icon name="psychology" /> Generador IA</h2>
                            <p className="text-blue-100 text-sm mb-6 max-w-lg">
                                Usa Gemini AI para expandir el banco de preguntas. 
                                <span className="block mt-1 font-bold text-white">* El sistema filtrará duplicados y validará la estructura.</span>
                            </p>
                            
                            <div className="flex gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-blue-200">Nivel CEFR</label>
                                    <select 
                                        className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm font-bold w-32 text-white [&>option]:text-black" 
                                        value={genLevel} 
                                        onChange={e => setGenLevel(e.target.value)}
                                    >
                                        <option value="A1">A1</option>
                                        <option value="A2">A2</option>
                                        <option value="B1">B1</option>
                                        <option value="B2">B2</option>
                                        <option value="C1">C1</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1 text-blue-200">Cantidad</label>
                                    <select 
                                        className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm font-bold w-32 text-white [&>option]:text-black" 
                                        value={genCount} 
                                        onChange={e => setGenCount(Number(e.target.value))}
                                    >
                                        <option value="10">10</option>
                                        <option value="20">20</option>
                                        <option value="50">50</option>
                                    </select>
                                </div>
                                <button 
                                    onClick={handleGenerateQuestions}
                                    disabled={generating}
                                    className="bg-white text-blue-900 px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-70"
                                >
                                    {generating ? <Icon name="sync" className="animate-spin" /> : <Icon name="bolt" />}
                                    Generar Preguntas
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                            <div className="flex flex-col gap-4 mb-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-slate-900 dark:text-white">Total Preguntas: {questions.length}</h3>
                                    <div className="text-xs text-slate-500 hidden sm:block">
                                        A1: {questions.filter(q => q.level === 'A1').length} | 
                                        A2: {questions.filter(q => q.level === 'A2').length} | 
                                        B1: {questions.filter(q => q.level === 'B1').length} | 
                                        B2: {questions.filter(q => q.level === 'B2').length} | 
                                        C1: {questions.filter(q => q.level === 'C1').length}
                                    </div>
                                </div>

                                {/* Filter Tabs */}
                                <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 overflow-x-auto no-scrollbar">
                                    {['ALL', 'A1', 'A2', 'B1', 'B2', 'C1'].map(lvl => (
                                        <button
                                            key={lvl}
                                            onClick={() => handleFilterChange(lvl)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterLevel === lvl 
                                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md transform scale-105' 
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            {lvl === 'ALL' ? 'Todos los Niveles' : `Nivel ${lvl}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Table */}
                            <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-black/20 border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th className="px-4 py-3 w-16">Nivel</th>
                                            <th className="px-4 py-3">Pregunta</th>
                                            <th className="px-4 py-3 w-1/4">Respuesta Correcta</th>
                                            <th className="px-4 py-3 w-20 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {paginatedQuestions.map(q => (
                                            <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-white/5 group">
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${q.level === 'A1' ? 'bg-green-100 text-green-700' : q.level === 'C1' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {q.level}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{q.text}</td>
                                                <td className="px-4 py-3 text-emerald-600 font-medium">
                                                    {q.options && typeof q.correctAnswer === 'number' && q.options[q.correctAnswer] 
                                                        ? q.options[q.correctAnswer] 
                                                        : <span className="text-red-400 text-xs italic">Datos incompletos</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleEditQuestion(q)} className="text-slate-400 hover:text-blue-500"><Icon name="edit" /></button>
                                                        <button onClick={() => handleDeleteQuestion(q.id)} className="text-slate-400 hover:text-red-500"><Icon name="delete" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {questions.length === 0 && (
                                            <tr><td colSpan={4} className="p-8 text-center text-slate-400">Banco de preguntas vacío. Genere algunas con IA.</td></tr>
                                        )}
                                        {questions.length > 0 && paginatedQuestions.length === 0 && (
                                            <tr><td colSpan={4} className="p-8 text-center text-slate-400">No hay preguntas para el filtro seleccionado ({filterLevel}).</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex justify-between items-center mt-4">
                                    <button 
                                        onClick={handlePrevPage} 
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 text-sm font-bold border rounded-lg hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Anterior
                                    </button>
                                    <span className="text-sm text-slate-500">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    <button 
                                        onClick={handleNextPage} 
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 text-sm font-bold border rounded-lg hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && editingQuestion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-2xl p-6">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Editar Pregunta</h3>
                        <form onSubmit={saveEditedQuestion} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Pregunta</label>
                                <textarea 
                                    className="w-full border rounded-lg p-2 text-sm dark:bg-black/20 dark:text-white dark:border-slate-700" 
                                    value={editingQuestion.text} 
                                    onChange={e => setEditingQuestion({...editingQuestion, text: e.target.value})}
                                    required 
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                {editingQuestion.options.map((opt, idx) => (
                                    <div key={idx}>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Opción {idx + 1}</label>
                                        <input 
                                            className="w-full border rounded-lg p-2 text-sm dark:bg-black/20 dark:text-white dark:border-slate-700"
                                            value={opt}
                                            onChange={e => {
                                                const newOpts = [...editingQuestion.options];
                                                newOpts[idx] = e.target.value;
                                                setEditingQuestion({...editingQuestion, options: newOpts});
                                            }}
                                            required
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Respuesta Correcta</label>
                                    <select 
                                        className="w-full border rounded-lg p-2 text-sm dark:bg-black/20 dark:text-white dark:border-slate-700"
                                        value={editingQuestion.correctAnswer}
                                        onChange={e => setEditingQuestion({...editingQuestion, correctAnswer: Number(e.target.value)})}
                                    >
                                        {editingQuestion.options.map((_, idx) => (
                                            <option key={idx} value={idx}>Opción {idx + 1}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-24">
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nivel</label>
                                    <select 
                                        className="w-full border rounded-lg p-2 text-sm dark:bg-black/20 dark:text-white dark:border-slate-700"
                                        value={editingQuestion.level}
                                        onChange={e => setEditingQuestion({...editingQuestion, level: e.target.value as any})}
                                    >
                                        {['A1','A2','B1','B2','C1'].map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold text-sm">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
};

export default LevelTestManager;

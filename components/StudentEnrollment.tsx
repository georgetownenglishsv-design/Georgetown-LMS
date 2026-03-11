
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { getCourses, addStudent, getCategories, getExams, addExamRegistration } from '../services/db';
import { Course, Category, Exam } from '../types';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { useLocation, useNavigate } = ReactRouterDOM as any;
import { auth } from '../firebase';

interface StudentEnrollmentProps {
    onBack: () => void;
    isPublic?: boolean;
}

type ItemType = 'course' | 'exam';

interface SelectedItem {
    type: ItemType;
    data: Course | Exam;
}

// Country Codes Ordered List - COMPACT DESIGN
const COUNTRY_CODES = [
    { code: '+503', label: '🇸🇻 +503' },
    { code: '+1',   label: '🇺🇸 +1' },
    { code: '+1',   label: '🇨🇦 +1' },
    { code: '+52',  label: '🇲🇽 +52' },
    { code: '+502', label: '🇬🇹 +502' },
    { code: '+504', label: '🇭🇳 +504' },
    { code: '+505', label: '🇳🇮 +505' },
    { code: '+506', label: '🇨🇷 +506' },
    { code: '+507', label: '🇵🇦 +507' },
    { code: '+34',  label: '🇪🇸 +34' },
    { code: '+82',  label: '🇰🇷 +82' },
    { code: '+57',  label: '🇨🇴 +57' },
    { code: '+51',  label: '🇵🇪 +51' },
    { code: '+56',  label: '🇨🇱 +56' },
    { code: '+54',  label: '🇦🇷 +54' },
];

// --- HELPER: Client-side Image Compression ---
const compressImage = (base64Str: string, maxWidth = 1000, maxHeight = 1000): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Fill white background for JPEGs (prevents black background on transparent PNGs)
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
            }
            // 0.7 quality balance between size and readability
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
    });
};

const StudentEnrollment: React.FC<StudentEnrollmentProps> = ({ onBack, isPublic = false }) => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Data State
    const [courses, setCourses] = useState<Course[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
    const [availableDates, setAvailableDates] = useState<Course[]>([]); // Sibling courses for date selection
    
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'cash'>('transfer');
    const [receiptFile, setReceiptFile] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Multi-month State
    const [paymentPlan, setPaymentPlan] = useState<1 | 2 | 3>(1); 

    // Success State
    const [isSuccess, setIsSuccess] = useState(false);
    const [generatedRef, setGeneratedRef] = useState('');
    
    // Selection Modal State (to pick item if none selected)
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState('Todos');

    // Exam Specific State
    const [examSchedule, setExamSchedule] = useState({ date: '', time: '' });

    // Form State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phoneCountry: '+503',
        phoneLocal: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- DERIVED STATE ---
    const isOnline = selectedItem?.type === 'course' && selectedItem.data.mode === 'online';

    // Helper: Extract base name (remove trailing 6-digit date like 202601)
    const getBaseName = (name: string) => {
        return name.replace(/\s\d{6}$/, '').trim();
    };

    // Helper formatter for dates DD/MMM
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        return `${d}/${months[parseInt(m) - 1]}`;
    };

    // Helper for time 12H with Zero Padding (FIX 4)
    const formatTime = (time: string) => {
        if (!time) return '';
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        // ZERO PAD HOUR
        const hourStr = hour12 < 10 ? `0${hour12}` : `${hour12}`;
        return `${hourStr}:${m} ${ampm}`;
    };

    const formatTimeRange = (start?: string, end?: string) => {
        if (!start) return 'TBA';
        const s = formatTime(start);
        const e = end ? formatTime(end) : '';
        return e ? `${s} - ${e}` : s;
    };

    // --- EFFECT: Load Data & Handle Pre-selection ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (isPublic && !auth.currentUser) await auth.signInAnonymously();
                
                const [coursesData, categoriesData, examsData] = await Promise.all([
                    getCourses(),
                    getCategories(),
                    getExams()
                ]);
                
                const activeCourses = coursesData.filter(c => c.status === 'Active');
                const activeExams = examsData.filter(e => e.status === 'Active');

                setCourses(activeCourses); // Keep raw list here, we group in the modal
                setCategories(categoriesData.filter(c => c.status === 'Activo'));
                setExams(activeExams);
                
                // Handle Pre-selection from Navigation State
                const state = location.state as { selectedExamId?: string, selectedCourseId?: string } | null;
                
                if (state) {
                    if (state.selectedExamId) {
                        const preSelectedExam = activeExams.find(e => e.id === state.selectedExamId);
                        if (preSelectedExam) {
                            setSelectedItem({ type: 'exam', data: preSelectedExam });
                            setPaymentMethod('cash'); // Default for exams
                        }
                    } else if (state.selectedCourseId) {
                        const preSelectedCourse = activeCourses.find(c => c.id === state.selectedCourseId);
                        if (preSelectedCourse) {
                            handleSelectItem(preSelectedCourse, 'course', activeCourses);
                            setPaymentMethod('transfer'); // Default for courses
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [isPublic, location.state]);

    // --- HANDLERS ---

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Large initial limit allowed because we will compress it
        if (file.size > 10 * 1024 * 1024) { 
            alert("El archivo es demasiado pesado (Máximo 10MB).");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            try {
                const compressed = await compressImage(base64);
                setReceiptFile(compressed);
            } catch (err) {
                console.error("Compression error", err);
                setReceiptFile(base64); // Fallback
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSelectItem = (item: Course | Exam, type: ItemType, allCoursesRef = courses) => {
        setSelectedItem({ type, data: item });
        setIsSelectionModalOpen(false);
        
        if (type === 'course') {
            const course = item as Course;
            const baseName = getBaseName(course.name);
            
            // Use provided ref or state
            const sourceCourses = allCoursesRef.length > 0 ? allCoursesRef : courses;

            const siblings = sourceCourses.filter(c => 
                c.status === 'Active' && 
                getBaseName(c.name) === baseName && 
                c.category === course.category &&
                c.mode === course.mode
            ).sort((a, b) => b.startDate.localeCompare(a.startDate)); // Newest first
            
            setAvailableDates(siblings);
            setPaymentMethod('transfer');
        } else {
            setAvailableDates([]);
            
            // Smart default payment method selection for Exams
            const exam = item as Exam;
            if (exam.allowedPaymentMethods && exam.allowedPaymentMethods.length > 0) {
                if (exam.allowedPaymentMethods.includes('cash')) setPaymentMethod('cash');
                else if (exam.allowedPaymentMethods.includes('transfer')) setPaymentMethod('transfer');
                else if (exam.allowedPaymentMethods.includes('card')) setPaymentMethod('card');
            } else {
                setPaymentMethod('cash');
            }
            
            setPaymentPlan(1);
        }
    };

    const handleDateSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCourseId = e.target.value;
        const newCourse = availableDates.find(c => c.id === newCourseId);
        if (newCourse) {
            setSelectedItem({ type: 'course', data: newCourse });
        }
    };

    const handleOpenPaymentLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = selectedItem?.type === 'course' 
            ? (selectedItem.data as Course)?.paymentLink 
            : (selectedItem?.data as Exam)?.paymentLink;
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const calculateTotal = () => {
        if (!selectedItem) return 0;
        const base = selectedItem.data.price;
        if (selectedItem.type === 'exam') return base;
        
        // Multi-month logic (No discounts as requested)
        return base * paymentPlan;
    };

    const calculateOriginalTotal = () => {
        if (!selectedItem || !selectedItem.data.originalPrice) return null;
        const base = Number(selectedItem.data.originalPrice);
        if (selectedItem.type === 'exam') return base;
        return base * paymentPlan;
    };

    const handleRegister = async () => {
        setError(null);

        if (!formData.firstName || !formData.lastName || !formData.email || !formData.phoneLocal) {
            setError("Por favor complete toda la información personal.");
            return;
        }
        if (!selectedItem) {
            setError("Por favor seleccione un curso o examen.");
            return;
        }

        if (selectedItem.type === 'exam') {
            if (!examSchedule.date || !examSchedule.time) {
                setError("Por favor seleccione fecha y hora para el examen.");
                return;
            }
        } else {
            // Course
            if ((paymentMethod === 'card' || paymentMethod === 'transfer') && !receiptFile) {
                setError("Debe adjuntar el comprobante de pago.");
                return;
            }
        }

        // REMOVED CONFIRM DIALOG FOR IFRAME COMPATIBILITY
        // if(!confirm(`¿Finalizar inscripción para ${selectedItem.data.name}?`)) return;

        setIsSubmitting(true);
        try {
            const timestampId = Date.now().toString().slice(-6);
            const studentId = `STD-${new Date().getFullYear()}-${timestampId}`;
            const refId = `GA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const fullName = `${formData.firstName} ${formData.lastName}`;
            const fullPhone = `${formData.phoneCountry} ${formData.phoneLocal}`;
            const today = new Date().toISOString().split('T')[0];
            const finalCost = calculateTotal();

            if (selectedItem.type === 'course') {
                await addStudent({
                    name: fullName,
                    firstName: formData.firstName, 
                    lastName: formData.lastName,
                    studentId: studentId,
                    email: formData.email,
                    phone: fullPhone,
                    parentPhone: '',
                    grade: 'N/A', 
                    course: selectedItem.data.name,
                    courseId: selectedItem.data.id, // [FIX] Critical for student portal
                    attendance: 100,
                    status: 'Pendiente', 
                    date: today,
                    avatarUrl: null,
                    paymentMethod: paymentMethod,
                    paymentReceiptUrl: receiptFile,
                    lastPaymentDate: today,
                    monthsIntended: paymentPlan, 
                    totalCost: finalCost, 
                    credits: 0 
                });
            } else {
                const exam = selectedItem.data as Exam;
                await addExamRegistration({
                    examId: exam.id,
                    studentName: fullName,
                    studentEmail: formData.email,
                    studentId: studentId,
                    avatarUrl: null,
                    paymentStatus: 'Pendiente',
                    registrationDate: today,
                    cost: exam.price,
                    surcharge: 0,
                    phone: fullPhone,
                    dui: 'N/A',
                    paymentMethod: 'cash', 
                    selectedDate: examSchedule.date,
                    selectedTime: examSchedule.time
                });
            }

            // Success Transition
            setGeneratedRef(refId);
            setIsSuccess(true);

        } catch (error: any) {
            console.error(error);
            const errorMsg = error.message || "";
            if (errorMsg.includes("document too large") || errorMsg.includes("limit")) {
                setError("Error: La foto del comprobante es demasiado grande. Por favor intente con una foto más pequeña o una captura de pantalla.");
            } else {
                setError("Ocurrió un error al procesar la inscripción: " + (error.message || "Error desconocido. Por favor contacte a soporte."));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter & Group Logic for Modal (FIX 3: Strict Sorting)
    const getGroupedItems = () => {
        let items: any[] = [];
        
        // 1. ADD EXAMS IF SELECTED OR TODOS (Sorted Last = 4)
        if (activeCategory === 'Todos' || activeCategory === 'Exámenes') {
            items = [...items, ...exams.map(e => ({...e, type: 'exam', category: 'Exámenes', internalSort: 4 }))];
        }
        
        // 2. ADD COURSES
        if (activeCategory !== 'Exámenes') {
            const filteredCourses = activeCategory === 'Todos' 
                ? courses 
                : courses.filter(c => c.category === activeCategory || c.category === categories.find(cat => cat.name === activeCategory)?.shortCode);
            
            // Group courses by Base Name
            const groups = new Map<string, { base: Course, schedules: Course[] }>();
            
            filteredCourses.forEach(c => {
                const baseName = getBaseName(c.name);
                const key = `${baseName}|${c.category}|${c.mode}`;
                if (!groups.has(key)) {
                    groups.set(key, { base: c, schedules: [] });
                }
                groups.get(key)?.schedules.push(c);
            });

            // Sort schedules inside groups (Newest first)
            Array.from(groups.values()).forEach(g => {
                g.schedules.sort((a,b) => b.startDate.localeCompare(a.startDate));
                g.base = g.schedules[0]; // Set base to the newest course
            });

            // Map to flat items with sort key
            const courseItems = Array.from(groups.values()).map(g => {
                // Determine Sort Order: TOEIC (1) -> INGLES (2) -> TOEFL (3) -> OTHERS (5)
                let sortKey = 5;
                const cat = g.base.category.toUpperCase();
                const name = g.base.name.toUpperCase();

                if (cat.includes('TOEIC') || name.includes('TOEIC')) sortKey = 1;
                else if (cat.includes('INGL') || cat.includes('GEN') || name.includes('INGL')) sortKey = 2; // Matches most Ingles courses
                else if (cat.includes('TOEFL') || name.includes('TOEFL')) sortKey = 3;
                else if (cat.includes('EXAM')) sortKey = 4;
                
                return {
                    ...g.base, 
                    type: 'course', 
                    _schedules: g.schedules, // Store siblings
                    internalSort: sortKey
                };
            });
            
            items = [...items, ...courseItems];
        }
        
        // 3. APPLY FINAL SORT (TOEIC -> INGLES -> TOEFL -> EXAMENES -> OTHERS)
        items.sort((a, b) => a.internalSort - b.internalSort);

        return items;
    };

    const groupedItems = getGroupedItems();

    // Helper to check if a payment method is allowed
    const isPaymentAllowed = (method: 'card' | 'transfer' | 'cash') => {
        if (selectedItem?.type === 'course') return true;
        if (selectedItem?.type === 'exam') {
            const exam = selectedItem.data as Exam;
            if (exam.allowedPaymentMethods && exam.allowedPaymentMethods.length > 0) {
                return exam.allowedPaymentMethods.includes(method);
            }
            return method === 'cash'; // Fallback default
        }
        return false;
    };

    // Validation
    const isValid = selectedItem && 
                    formData.firstName && formData.lastName && formData.email && formData.phoneLocal && 
                    (selectedItem.type === 'course' ? (paymentMethod === 'cash' || receiptFile) : (examSchedule.date && examSchedule.time));

    
    // --- SUCCESS SCREEN RENDERER ---
    if (isSuccess && selectedItem) {
        return (
            <div className="relative flex min-h-screen flex-col overflow-x-hidden pb-6 bg-[#f5f7f8] dark:bg-[#101922] font-display text-[#111418] dark:text-white antialiased selection:bg-primary/20">
                <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#1a242d]/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 transition-colors duration-200">
                    <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto w-full">
                        <button onClick={() => isPublic ? navigate('/') : onBack()} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer text-[#111418] dark:text-white">
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>arrow_back</span>
                        </button>
                        <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center truncate px-2">
                            Georgetown Academy
                        </h2>
                        <div className="size-10"></div>
                    </div>
                </header>
                
                <main className="flex-1 flex flex-col px-4 pt-8 pb-32 w-full max-w-md mx-auto">
                    <div className="flex flex-col items-center justify-center text-center mb-8 animate-in slide-in-from-bottom-4 duration-700">
                        <div className="relative mb-6 group">
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl scale-90 group-hover:scale-110 transition-transform duration-700"></div>
                            <div className="relative flex items-center justify-center size-24 bg-white dark:bg-[#1a242d] rounded-full shadow-lg border border-white/50 dark:border-white/5">
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '48px', fontVariationSettings: "'FILL' 1, 'wght' 600" }}>check_circle</span>
                            </div>
                        </div>
                        <h1 className="text-[#111418] dark:text-white text-[28px] leading-tight font-extrabold tracking-tight mb-3">
                            ¡Solicitud Recibida!
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-base font-medium leading-relaxed max-w-xs mx-auto">
                            Hemos recibido tu pedido correctamente. Nuestro equipo de admisiones está revisando los detalles.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-[#1a242d] rounded-2xl shadow-[0_4px_24px_-2px_rgba(0,0,0,0.08)] overflow-hidden mb-8 border border-white dark:border-gray-800 relative z-10 animate-in slide-in-from-bottom-8 duration-700 delay-100">
                        <div className="bg-amber-50 dark:bg-amber-900/20 px-5 py-3 flex items-center justify-between border-b border-amber-100 dark:border-amber-800/30">
                            <div className="flex items-center gap-1.5">
                                <div className="size-2 rounded-full bg-amber-500 animate-pulse"></div>
                                <span className="text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                                    Pendiente de Verificación
                                </span>
                            </div>
                            <span className="text-amber-700/60 dark:text-amber-400/60 text-[10px] font-bold tracking-widest uppercase">
                                Estado
                            </span>
                        </div>
                        <div className="p-6 flex flex-col gap-6">
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-start">
                                    <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">Ref: #{generatedRef}</p>
                                </div>
                                <h3 className="text-[#111418] dark:text-white text-xl font-bold leading-snug">
                                    {selectedItem.data.name}
                                </h3>
                                {selectedItem.type === 'course' && (
                                    <p className="text-sm font-bold text-primary">Duración: {paymentPlan} Mes(es)</p>
                                )}
                            </div>
                            <div className="h-px bg-gray-100 dark:bg-gray-800 w-full border-t border-dashed"></div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center group/item">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Método de Pago</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-300 group-hover/item:text-primary transition-colors duration-300" style={{ fontSize: '18px' }}>
                                            {paymentMethod === 'card' ? 'credit_card' : paymentMethod === 'transfer' ? 'account_balance' : 'payments'}
                                        </span>
                                        <p className="text-[#111418] dark:text-white text-sm font-bold text-right capitalize">
                                            {paymentMethod === 'card' ? 'Tarjeta (Compra-Click)' : paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium pb-1">Total Estimado</p>
                                    <p className="text-primary text-3xl font-extrabold text-right tracking-tight leading-none">${calculateTotal().toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary/5 to-transparent dark:from-primary/10 rounded-xl p-5 mb-6 flex gap-4 items-start border border-primary/10 animate-in slide-in-from-bottom-12 duration-700 delay-200">
                        <div className="size-10 rounded-lg bg-white dark:bg-white/5 flex items-center justify-center shadow-sm shrink-0 text-primary">
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>mark_email_read</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <h4 className="text-[#111418] dark:text-white text-sm font-bold">Próximos Pasos</h4>
                            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                Te contactaremos a más tardar un día antes del inicio de clases vía correo electrónico para confirmar tu cupo.
                            </p>
                        </div>
                    </div>
                </main>

                <div className="fixed bottom-0 left-0 w-full bg-white/80 dark:bg-[#1a242d]/80 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 p-4 pb-8 z-40">
                    <div className="max-w-md mx-auto flex flex-col gap-3">
                        <button 
                            onClick={() => isPublic ? navigate('/') : onBack()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl h-14 bg-primary hover:bg-blue-600 active:scale-[0.98] transition-all text-white text-base font-bold shadow-[0_0_20px_-5px_rgba(13,127,242,0.3)]"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>home</span>
                            Volver a Inicio
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Reusable Order Summary Component
    const OrderSummary = () => {
        // --- 1. Empty State (Action Call) ---
        if (!selectedItem) {
            return (
                <div 
                    onClick={() => setIsSelectionModalOpen(true)}
                    className="bg-white dark:bg-[#15202b] rounded-2xl p-8 shadow-sm border-2 border-dashed border-primary/30 dark:border-primary/20 relative overflow-hidden group cursor-pointer hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center text-center gap-4 animate-[pulse_3s_ease-in-out_infinite] hover:animate-none"
                >
                    <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 animate-bounce">
                        <Icon name="add_circle" className="text-[32px] text-primary" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-500">Seleccionar Programa</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                            Haga clic aquí para elegir su curso o examen.
                        </p>
                    </div>
                </div>
            );
        }

        // --- 2. Filled State (Receipt Style) ---
        return (
            <div 
                onClick={() => setIsSelectionModalOpen(true)}
                className="bg-white dark:bg-[#15202b] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors"
            >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Icon name={selectedItem.type === 'exam' ? 'assignment' : 'school'} className="text-[80px] text-primary" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Resumen del Pedido</h3>
                        <span className="inline-flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-800">
                            <span className="size-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                            PENDIENTE
                        </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight mb-1">
                        {getBaseName(selectedItem.data.name)}
                    </h2>
                    
                    {/* START DATE SELECTOR (SIBLINGS) */}
                    {selectedItem.type === 'course' && availableDates.length > 0 && (
                        <div className="mt-3" onClick={e => e.stopPropagation()}>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha de Inicio (Convocatoria)</label>
                            <div className="relative">
                                <select 
                                    className="w-full appearance-none bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-bold rounded-lg py-2 pl-3 pr-8 focus:ring-1 focus:ring-primary cursor-pointer"
                                    value={selectedItem.data.id}
                                    onChange={handleDateSelection}
                                >
                                    {availableDates.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {formatDate(c.startDate)} - {formatDate(c.endDate)} {c.status === 'Active' ? '' : '(Cerrado)'}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                    <Icon name="expand_more" className="text-sm" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DURATION SELECTOR (Renamed from Payment Plan) */}
                    {selectedItem.type === 'course' && (
                        <div className="mt-4 p-3 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-slate-800 cursor-default" onClick={e => e.stopPropagation()}>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Duración del Programa</p>
                            <div className="flex gap-2">
                                {[1, 2, 3].map(months => (
                                    <button 
                                        key={months}
                                        onClick={() => setPaymentPlan(months as 1|2|3)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${paymentPlan === months ? 'bg-white shadow text-primary border-primary' : 'bg-transparent text-slate-500 border-slate-200'}`}
                                    >
                                        {months} {months === 1 ? 'Mes' : 'Meses'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/50">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total a pagar</span>
                        <div className="flex flex-col items-end">
                            {calculateOriginalTotal() && (
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Ahorras ${(calculateOriginalTotal()! - calculateTotal()).toFixed(2)}</span>
                                    <span className="text-sm text-slate-400 line-through font-bold decoration-slate-300">${calculateOriginalTotal()?.toFixed(2)}</span>
                                </div>
                            )}
                            <span className="text-2xl sm:text-3xl font-black text-primary tracking-tight">
                                ${calculateTotal().toFixed(2)}
                            </span>
                        </div>
                    </div>
                    
                    {/* Exam Date Picker inside Summary (Fixed Layout) */}
                    {selectedItem.type === 'exam' && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/50 cursor-default" onClick={(e) => e.stopPropagation()}>
                            <div className="mb-2">
                                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                                    <Icon name="event_note" className="text-primary text-sm" />
                                    Agendar Examen
                                </h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                                    Seleccione su fecha y hora preferida. <span className="opacity-70">*Sujeto a cambios.</span>
                                </p>
                            </div>

                            {/* FIX: Improved layout with flex-wrap to prevent cut-off */}
                            <div className="flex flex-wrap gap-2 items-end">
                                
                                {/* Date Input */}
                                <div className="group flex-1 min-w-[120px]">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Fecha</label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer h-9" 
                                        value={examSchedule.date} 
                                        onChange={e => setExamSchedule({...examSchedule, date: e.target.value})} 
                                    />
                                </div>

                                {/* Time Input */}
                                <div className="group flex-1 min-w-[100px]">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Hora</label>
                                    <input 
                                        type="time" 
                                        className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer h-9" 
                                        value={examSchedule.time} 
                                        onChange={e => setExamSchedule({...examSchedule, time: e.target.value})} 
                                    />
                                </div>

                                {/* Warning Box (Full width on small, flexible on larger) */}
                                <div className="w-full sm:w-auto flex items-center gap-2 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 rounded-lg px-3 py-2 mt-1 sm:mt-0 sm:flex-1">
                                    <Icon name="info" className="text-orange-400 text-xs shrink-0" />
                                    <p className="text-[10px] leading-tight text-orange-800/80 dark:text-orange-200/70 font-medium">
                                        Verifique datos antes de continuar.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Desktop Submit Button (Inside Summary) */}
                    <div className="hidden lg:block mt-6">
                        {error && (
                            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold text-center animate-pulse">
                                <Icon name="error" className="inline mr-1 text-sm" />
                                {error}
                            </div>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleRegister(); }}
                            disabled={isSubmitting || !isValid}
                            className="relative w-full overflow-hidden bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="relative flex items-center justify-center gap-2">
                                {isSubmitting ? (
                                    <>
                                        <Icon name="sync" className="animate-spin text-xl" />
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Finalizar Proceso</span>
                                        <Icon name="check_circle" className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="relative flex h-full min-h-screen w-full flex-col bg-[#f5f7f8] dark:bg-[#101922] font-display text-[#111418] dark:text-white antialiased selection:bg-primary/30">
            
            {/* 1. Header */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#101922]/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 p-4 pb-3 flex justify-between items-center transition-all duration-300">
                <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
                    <button 
                        onClick={() => isPublic ? navigate(-1) : onBack()}
                        className="text-[#111418] dark:text-white flex size-10 shrink-0 items-center justify-center cursor-pointer rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <Icon name="arrow_back" className="text-[24px]" />
                    </button>
                    <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center truncate px-2">
                        Confirmación de Inscripción
                    </h2>
                    <div className="flex items-center justify-end">
                        <div className="size-10 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Icon name="shopping_bag" className="text-[20px]" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Responsive Content Layout - ADDED PB-40 to prevent overlap */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="max-w-6xl mx-auto w-full p-4 lg:p-8 pb-40">
                    
                    {/* LUXURY WARNING CARD FOR ONLINE COURSES (ONLY ONLINE) */}
                    {isOnline && (
                        <div className="mb-8 relative overflow-hidden rounded-3xl bg-[#111418] p-1 shadow-2xl border border-white/10 group animate-in fade-in slide-in-from-top-4 duration-700">
                            {/* Animated Border Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 group-hover:opacity-40 transition-opacity duration-1000 blur-xl"></div>
                            
                            <div className="relative bg-[#1a202c]/95 backdrop-blur-xl rounded-[22px] p-6 md:p-8 overflow-hidden">
                                {/* Background Decorations */}
                                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                    <Icon name="verified_user" className="text-[120px] text-white" />
                                </div>

                                <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                    <div className="size-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                                        <Icon name="lock" className="text-3xl text-white animate-pulse" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl md:text-2xl font-black text-white mb-2 leading-tight">
                                            Credenciales de Acceso <span className="text-blue-400">Vitales</span>
                                        </h3>
                                        <p className="text-slate-300 text-sm leading-relaxed mb-4">
                                            Para garantizar tu entrada al Aula Virtual, es crítico que la información sea exacta.
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium">
                                            <div className="flex items-center gap-3 bg-white/5 rounded-lg p-2 border border-white/5">
                                                <Icon name="mail" className="text-blue-400" />
                                                <span className="text-slate-200">
                                                    Tu <span className="text-white font-bold">Email</span> y <span className="text-white font-bold">Apellidos</span> serán tu llave de acceso.
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white/5 rounded-lg p-2 border border-white/5">
                                                <div className="text-[#25D366]"><i className="fab fa-whatsapp text-lg"></i></div>
                                                <span className="text-slate-200">
                                                    Recibirás la invitación al grupo de estudio vía <span className="text-white font-bold">WhatsApp</span>.
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Desktop: 2-Column Grid / Mobile: Vertical Stack */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 pb-4 lg:pb-0">
                        
                        {/* LEFT COLUMN: Forms (Order 2 on Mobile, Order 1 on Desktop) */}
                        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
                            
                            {/* Student Info Form - COMPACT LAYOUT */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 px-1">Información de Estudiante</h3>
                                <div className="bg-white dark:bg-[#15202b] rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800">
                                    <div className="space-y-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                                            {/* NOMBRES */}
                                            <div className="group">
                                                <div className="flex justify-between items-center h-6 mb-1 ml-1">
                                                    <label className="text-xs font-bold text-slate-400 group-focus-within:text-primary transition-colors uppercase tracking-tight">Nombres</label>
                                                </div>
                                                <input value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-gray-50 dark:bg-[#101922] text-gray-900 dark:text-white text-sm font-semibold border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary px-4 py-3.5 outline-none transition-all placeholder:text-gray-300" placeholder="Ej. Alejandro" type="text"/>
                                            </div>
                                            
                                            {/* APELLIDOS + WARNING IN LABEL */}
                                            <div className="group">
                                                <div className="flex justify-between items-center h-6 mb-1 ml-1">
                                                    <label className={`text-xs font-bold transition-colors uppercase tracking-tight flex items-center gap-1 ${isOnline ? 'text-blue-600' : 'text-slate-400 group-focus-within:text-primary'}`}>
                                                        {isOnline ? 'Apellidos (ID de Acceso)' : 'Apellidos'}
                                                        {isOnline && <Icon name="lock" className="text-[12px]" />}
                                                    </label>
                                                    {isOnline && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-800 animate-pulse">⚠️ Clave de Acceso</span>}
                                                </div>
                                                <input 
                                                    value={formData.lastName} 
                                                    onChange={e => setFormData({...formData, lastName: e.target.value})} 
                                                    className={`w-full bg-gray-50 dark:bg-[#101922] text-gray-900 dark:text-white text-sm font-semibold border rounded-xl px-4 py-3.5 outline-none transition-all placeholder:text-gray-300 ${isOnline ? 'focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 border-gray-100 dark:border-gray-700' : 'focus:ring-2 focus:ring-primary/20 focus:border-primary border-gray-100 dark:border-gray-700'}`} 
                                                    placeholder="Ej. Martínez" 
                                                    type="text"
                                                />
                                            </div>

                                            {/* EMAIL */}
                                            <div className="group">
                                                <div className="flex justify-between items-center h-6 mb-1 ml-1">
                                                    <label className={`text-xs font-bold transition-colors uppercase tracking-tight flex items-center gap-1 ${isOnline ? 'text-blue-600' : 'text-slate-400 group-focus-within:text-primary'}`}>
                                                        {isOnline ? 'Correo Electrónico (ID de Acceso)' : 'Correo Electrónico'}
                                                        {isOnline && <Icon name="lock" className="text-[12px]" />}
                                                    </label>
                                                </div>
                                                <div className="relative">
                                                    <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${isOnline ? 'text-amber-500' : 'text-slate-300 group-focus-within:text-primary'}`}>
                                                        <Icon name="mail" className="text-[20px]" />
                                                    </div>
                                                    <input 
                                                        value={formData.email} 
                                                        onChange={e => setFormData({...formData, email: e.target.value})} 
                                                        className={`w-full bg-gray-50 dark:bg-[#101922] text-gray-900 dark:text-white text-sm font-semibold border rounded-xl pl-11 pr-4 py-3.5 outline-none transition-all placeholder:text-gray-300 ${isOnline ? 'focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 border-gray-100 dark:border-gray-700' : 'focus:ring-2 focus:ring-primary/20 focus:border-primary border-gray-100 dark:border-gray-700'}`}
                                                        placeholder="ejemplo@correo.com" 
                                                        type="email"
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* PHONE + HELPER IN LABEL */}
                                            <div className="group">
                                                <div className="flex justify-between items-center h-6 mb-1 ml-1">
                                                    <label className="text-xs font-bold text-slate-400 group-focus-within:text-primary transition-colors uppercase tracking-tight">Teléfono</label>
                                                    <span className="text-[10px] text-slate-400 font-medium">Para grupo de WhatsApp</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="relative w-24 shrink-0">
                                                        <select 
                                                            className="w-full bg-gray-50 dark:bg-[#101922] text-gray-900 dark:text-white text-sm font-bold border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary pl-2 pr-6 py-3.5 outline-none appearance-none cursor-pointer truncate"
                                                            value={formData.phoneCountry}
                                                            onChange={e => setFormData({...formData, phoneCountry: e.target.value})}
                                                        >
                                                            {COUNTRY_CODES.map(c => (
                                                                <option key={c.label} value={c.code}>{c.label}</option>
                                                            ))}
                                                        </select>
                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                                            <Icon name="expand_more" className="text-xs" />
                                                        </div>
                                                    </div>
                                                    <input 
                                                        value={formData.phoneLocal} 
                                                        onChange={e => setFormData({...formData, phoneLocal: e.target.value.replace(/[^0-9]/g, '')})} 
                                                        className="flex-1 bg-gray-50 dark:bg-[#101922] text-gray-900 dark:text-white text-sm font-semibold border border-gray-100 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary px-4 py-3.5 outline-none transition-all placeholder:text-gray-300" 
                                                        placeholder="Número" 
                                                        type="tel"
                                                        inputMode="numeric"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Methods */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 px-1">Selecciona Método de Pago</h3>
                                <div className="space-y-5">
                                    <div 
                                        onClick={() => isPaymentAllowed('card') && setPaymentMethod('card')}
                                        className={`bg-white dark:bg-[#15202b] rounded-2xl p-5 shadow-sm border transition-all ${paymentMethod === 'card' ? 'border-primary ring-1 ring-primary' : 'border-gray-100 dark:border-gray-800'} ${!isPaymentAllowed('card') ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:shadow-md'}`}
                                    >
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-primary shadow-sm">
                                                <Icon name="credit_card" className="text-[24px]" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white text-base">Pago con Tarjeta</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Vía BAC Compra-Click</p>
                                            </div>
                                            <div className="ml-auto">
                                                <input checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="size-5 text-primary border-gray-300 focus:ring-primary" name="payment_method" type="radio"/>
                                            </div>
                                        </div>
                                        {paymentMethod === 'card' && (
                                            <div className="animate-in slide-in-from-top-2">
                                                {(selectedItem?.type === 'course' ? (selectedItem.data as Course)?.paymentLink : (selectedItem?.data as Exam)?.paymentLink) ? (
                                                    <button 
                                                        onClick={handleOpenPaymentLink}
                                                        className="w-full mb-6 bg-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                                                    >
                                                        <span>Pagar con Compra-Click</span>
                                                        <Icon name="open_in_new" className="text-sm group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                ) : (
                                                    <button disabled className="w-full mb-6 bg-gray-200 dark:bg-gray-700 text-gray-500 font-bold py-3 rounded-xl cursor-not-allowed">Enlace no disponible</button>
                                                )}
                                                <div className="bg-gray-50 dark:bg-[#101922] rounded-xl p-4 border border-dashed border-gray-200 dark:border-gray-700">
                                                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-1.5"><Icon name="attach_file" className="text-[16px]" /> Adjunta Tu Comprobante de Pago</p>
                                                    <label className="flex items-center justify-center w-full py-2.5 px-4 bg-white dark:bg-[#15202b] border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary/50 transition-colors shadow-sm relative overflow-hidden">
                                                        <span className={`text-xs font-bold mr-2 ${receiptFile ? 'text-emerald-500' : 'text-primary'}`}>{receiptFile ? 'Archivo Seleccionado' : 'Subir Archivo'}</span>
                                                        <span className="text-[10px] text-gray-400">{receiptFile ? 'Listo' : '(JPG, PDF, PNG)'}</span>
                                                        <input className="hidden" type="file" ref={fileInputRef} onChange={handleFileChange} />
                                                        {receiptFile && <div className="absolute inset-0 border-2 border-emerald-500 rounded-lg pointer-events-none"></div>}
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div 
                                        onClick={() => isPaymentAllowed('transfer') && setPaymentMethod('transfer')}
                                        className={`bg-white dark:bg-[#15202b] rounded-2xl p-5 shadow-sm border transition-all ${paymentMethod === 'transfer' ? 'border-primary ring-1 ring-primary' : 'border-gray-100 dark:border-gray-800'} ${!isPaymentAllowed('transfer') ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:shadow-md'}`}
                                    >
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="size-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm">
                                                <Icon name="account_balance" className="text-[24px]" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white text-base">Transferencia Bancaria</h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Transferencia Directa</p>
                                            </div>
                                            <div className="ml-auto">
                                                <input checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} className="size-5 text-primary border-gray-300 focus:ring-primary" name="payment_method" type="radio"/>
                                            </div>
                                        </div>
                                        {paymentMethod === 'transfer' && (
                                            <div className="animate-in slide-in-from-top-2">
                                                <div className="space-y-3 mb-6 bg-gray-50 dark:bg-[#101922] p-4 rounded-xl border border-gray-100 dark:border-gray-800 text-sm">
                                                    <div className="flex justify-between items-center"><span className="text-gray-500 dark:text-gray-400 text-xs font-medium">Banco</span><span className="font-bold text-gray-900 dark:text-white">Banco America Central</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-gray-500 dark:text-gray-400 text-xs font-medium">Cuenta</span><span className="font-bold text-gray-900 dark:text-white">Corriente</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-gray-500 dark:text-gray-400 text-xs font-medium">Número</span><div className="flex items-center gap-1.5"><span className="font-bold text-gray-900 dark:text-white font-mono tracking-wide">201208527</span><Icon name="content_copy" className="text-[14px] text-gray-400 cursor-pointer hover:text-primary" /></div></div>
                                                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700"><span className="text-gray-500 dark:text-gray-400 text-xs font-medium">Beneficiario</span><span className="font-bold text-gray-900 dark:text-white">Seungyeon Lee</span></div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-[#101922] rounded-xl p-4 border border-dashed border-gray-200 dark:border-gray-700">
                                                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-1.5"><Icon name="attach_file" className="text-[16px]" /> Adjunta Tu Comprobante</p>
                                                    <label className="flex items-center justify-center w-full py-2.5 px-4 bg-white dark:bg-[#15202b] border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary/50 transition-colors shadow-sm relative overflow-hidden">
                                                        <span className={`text-xs font-bold mr-2 ${receiptFile ? 'text-emerald-500' : 'text-primary'}`}>{receiptFile ? 'Archivo Seleccionado' : 'Subir Archivo'}</span>
                                                        <span className="text-[10px] text-gray-400">{receiptFile ? 'Listo' : '(JPG, PDF, PNG)'}</span>
                                                        <input className="hidden" type="file" ref={fileInputRef} onChange={handleFileChange} />
                                                        {receiptFile && <div className="absolute inset-0 border-2 border-emerald-500 rounded-lg pointer-events-none"></div>}
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div 
                                        onClick={() => isPaymentAllowed('cash') && setPaymentMethod('cash')}
                                        className={`bg-white dark:bg-[#15202b] rounded-2xl p-5 shadow-sm border transition-all ${paymentMethod === 'cash' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-100 dark:border-gray-800'} ${!isPaymentAllowed('cash') ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:shadow-md'}`}
                                    >
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm"><Icon name="payments" className="text-[24px]" /></div>
                                            <div><h4 className="font-bold text-gray-900 dark:text-white text-base">Pago en Efectivo</h4><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Visita presencial</p></div>
                                            <div className="ml-auto"><input checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="size-5 text-emerald-500 border-gray-300 focus:ring-emerald-500" name="payment_method" type="radio"/></div>
                                        </div>
                                        {paymentMethod === 'cash' && (
                                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 rounded-xl p-4 mb-4 animate-in slide-in-from-top-2">
                                                <div className="flex gap-3"><Icon name="warning" className="text-orange-600 dark:text-orange-400 shrink-0" /><p className="text-xs text-orange-900 dark:text-orange-200 font-medium leading-relaxed"><span className="font-bold">Importante:</span> Para completar su inscripción con pago en efectivo, es necesario visitar nuestras instalaciones antes de la fecha de inicio del curso.</p></div>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-3 pl-2 opacity-80"><Icon name="location_on" className="text-gray-400 pt-0.5" /><div className="text-sm text-gray-600 dark:text-gray-300"><p className="font-bold text-gray-900 dark:text-white">Georgetown Academy</p><p>Centro Comercial Loma Linda, Local# 31D</p><p>San Benito, San Salvador</p></div></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Order Summary (Order 1 on Mobile, 2 on Desktop) - Sticky on Desktop */}
                        <div className="lg:col-span-1 order-1 lg:order-2">
                            <div className="lg:sticky lg:top-[120px]">
                                <OrderSummary />
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* 3. Sticky Footer (Mobile Only) - FIXED FLOATING ISLAND STYLE */}
            <div className="lg:hidden block fixed bottom-6 left-4 right-4 z-50">
                <div className="bg-white/90 dark:bg-[#1a242d]/90 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20 dark:border-white/10">
                    {error && (
                        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs font-bold text-center">
                            {error}
                        </div>
                    )}
                    <button 
                        onClick={handleRegister}
                        disabled={isSubmitting || !isValid}
                        className="relative w-full overflow-hidden bg-gray-900 dark:bg-white text-white dark:text-black font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="absolute inset-0 bg-white/20 dark:bg-black/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <div className="relative flex items-center justify-center gap-2">
                            {isSubmitting ? (
                                <>
                                    <Icon name="sync" className="animate-spin text-xl" />
                                    <span>Procesando...</span>
                                </>
                            ) : (
                                <>
                                    <span>Finalizar Proceso</span>
                                    <Icon name="check_circle" className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </div>
                    </button>
                </div>
            </div>

            {/* Item Selection Modal (if none selected) */}
            {isSelectionModalOpen && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSelectionModalOpen(false)}></div>
                    <div className="relative w-full bg-white dark:bg-[#101922] rounded-t-3xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Seleccionar Programa</h3>
                            <button onClick={() => setIsSelectionModalOpen(false)}><Icon name="close" className="text-2xl text-gray-500" /></button>
                        </div>
                        
                        {/* Filter Tabs - Pill Style based on screenshot */}
                        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
                            <button 
                                onClick={() => setActiveCategory('Todos')} 
                                className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${activeCategory === 'Todos' ? 'bg-[#0d7ff2] text-white border-[#0d7ff2] shadow-sm' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                Todos
                            </button>
                            <button 
                                onClick={() => setActiveCategory('Exámenes')} 
                                className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${activeCategory === 'Exámenes' ? 'bg-[#0d7ff2] text-white border-[#0d7ff2] shadow-sm' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                Exámenes
                            </button>
                            {categories.map(c => (
                                <button 
                                    key={c.id} 
                                    onClick={() => setActiveCategory(c.shortCode)} 
                                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${activeCategory === c.shortCode ? 'bg-[#0d7ff2] text-white border-[#0d7ff2] shadow-sm' : 'bg-white text-gray-600 border-gray-200'}`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>

                        <div className="grid gap-3">
                            {groupedItems.map((item: any) => {
                                // If it's a grouped course, use base info
                                const isGrouped = !!item._schedules;
                                const baseName = getBaseName(item.name);
                                
                                // Schedule display logic
                                let scheduleDisplay;
                                
                                if (isGrouped) {
                                    // Multiple schedules available
                                    const schedules = item._schedules as Course[];
                                    
                                    // Smart Grouping: Check if all days are the same
                                    const firstDays = schedules[0]?.days?.sort().join(',') || '';
                                    const allSameDays = schedules.every(s => (s.days?.sort().join(',') || '') === firstDays);
                                    
                                    scheduleDisplay = (
                                        <div className="mt-1 flex flex-col gap-2">
                                            {/* Days Header */}
                                            {/* If all days are the same, show them ONCE at the top */}
                                            {/* FIX 3: INLINE DAYS NEXT TO BADGE MOVED TO LIST ITEM BELOW */}
                                            
                                            {/* Schedule Rows */}
                                            {schedules.map((s, i) => (
                                                <div key={s.id} className="flex flex-row items-center justify-between text-[10px] text-slate-600 font-bold bg-slate-50 px-2 py-2 rounded border border-slate-100 gap-2">
                                                    {/* Date Badge - FIX 2: FORCE 1 Line + Whitespace Nowrap */}
                                                    <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
                                                       <span className="bg-white border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm whitespace-nowrap overflow-hidden text-ellipsis">
                                                          <Icon name="event" className="text-[10px] text-blue-500" />
                                                          {formatDate(s.startDate)} - {formatDate(s.endDate)}
                                                       </span>
                                                    </div>
                                                    
                                                    {/* Time & Specific Days - Allow Wrap on Mobile */}
                                                    <div className="flex items-center justify-end gap-2 min-w-0">
                                                       {/* If days differ, show them per row */}
                                                       {!allSameDays && (
                                                           <span className="text-slate-400 bg-white px-1 rounded border border-slate-100 hidden sm:inline-block">{s.days?.join('/')}</span>
                                                       )}
                                                       <span className="text-primary bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap font-mono truncate">
                                                          ⏰ {formatTimeRange(s.startTime, s.endTime)}
                                                       </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                } else {
                                    // Standard single item (e.g. Exam or ungrouped course)
                                    const days = item.days?.join('/') || 'Horario a convenir';
                                    const timeRange = item.startTime ? formatTimeRange(item.startTime, item.endTime) : '';
                                    
                                    scheduleDisplay = (
                                        <div className="flex flex-col gap-1 mt-1">
                                            {/* Time below */}
                                            {timeRange && (
                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 font-mono pl-0.5">
                                                    <Icon name="schedule" className="text-xs" />
                                                    <span>{timeRange}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                const startDate = item.startDate ? formatDate(item.startDate) : '';
                                const endDate = item.endDate ? formatDate(item.endDate) : '';
                                const dateRange = !isGrouped && startDate && endDate ? `${startDate} - ${endDate}` : '';

                                return (
                                    <div 
                                        key={item.id} 
                                        onClick={() => handleSelectItem(item, item.type)}
                                        className="flex justify-between items-start p-3 bg-white dark:bg-[#15202b] border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors last:border-0"
                                    >
                                        {/* Left Content */}
                                        <div className="flex-1 min-w-0 pr-3">
                                            {/* Title */}
                                            <h3 className="font-bold text-base text-gray-900 dark:text-white leading-tight mb-1">
                                                {isGrouped ? baseName : item.name}
                                            </h3>
                                            
                                            {/* FIX 1: INLINE DAYS NEXT TO BADGE */}
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                {item.mode && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                                                        item.mode.toLowerCase() === 'online' 
                                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
                                                        : 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                                    }`}>
                                                        {item.mode.substring(0, 3)}
                                                    </span>
                                                )}
                                                
                                                {/* INLINE DAYS HERE if Grouped and same days OR Single */}
                                                {(isGrouped && item._schedules && item._schedules[0]?.days) ? (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#0d7ff2] uppercase">
                                                        <Icon name="calendar_month" className="text-[10px]" />
                                                        {item._schedules[0].days.join('/')}
                                                    </div>
                                                ) : (!isGrouped && item.days) ? (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#0d7ff2] uppercase">
                                                        <Icon name="calendar_month" className="text-[10px]" />
                                                        {item.days.join('/')}
                                                    </div>
                                                ) : null}

                                                {/* Single Date Range (If not grouped) */}
                                                {dateRange && (
                                                    <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">| {dateRange}</span>
                                                )}
                                            </div>

                                            {/* Schedule Display */}
                                            {scheduleDisplay}
                                        </div>

                                        {/* Right Content (Price & Add) */}
                                        <div className="flex flex-col items-end gap-2 pt-1">
                                            <span className="font-black text-[15px] text-slate-900 dark:text-white whitespace-nowrap">
                                                ${item.price.toFixed(2)}
                                            </span>
                                            <div className="size-6 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-300 dark:text-gray-600">
                                                <Icon name="add" className="text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentEnrollment;

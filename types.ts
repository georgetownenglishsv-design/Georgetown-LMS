
// ... (Keep existing types)

// --- NEW: Daily Quiz Types ---
export interface DailyQuiz {
    id: string; // "1" to "365" (Day of Year)
    question: string;
    options: string[]; // [Option A, Option B]
    correctAnswer: number; // 0 or 1
    explanation: string; // The "Why" in Spanish
    category?: 'Grammar' | 'Vocabulary' | 'Spanglish';
}

export interface Student {
  id: string; // Firestore Document ID
  name: string; // Full Name (Display)
  firstName?: string; // NEW: For precise logic
  lastName?: string;  // NEW: For Login Auth
  studentId: string;
  grade: string;
  phone: string;
  parentPhone: string;
  course: string; // Primary/Legacy Course
  courseId?: string; // [MIGRATION]: Link to Course Document ID
  courses?: string[]; // NEW: Multi-course support
  // UI Helpers (can be optional in DB)
  courseColor?: string;
  attendance: number;
  attendanceColor?: string;
  status: 'Pagado' | 'Pendiente' | 'Activo' | 'Pausado' | 'Graduado';
  statusColor?: string;
  statusDot?: string;
  date: string; // Registration Date
  avatarUrl: string | null;
  email?: string;
  address?: string;
  birthDate?: string;
  // Payment Specifics
  paymentMethod?: 'card' | 'transfer' | 'cash';
  paymentReceiptUrl?: string | null; // Base64 or URL
  lastPaymentDate?: string;
  // Multi-month & Credits
  credits?: number; // Pre-paid months available
  monthsIntended?: number; // How many months selected during enrollment (1, 3, 6)
  totalCost?: number; // Snapshot of total cost at enrollment
  
  // Security
  sessionToken?: string; // For single-device login enforcement
  
  // Lifecycle
  isArchived?: boolean; // If true, hidden from main list
}

export interface Category {
  id: string; // Firestore Document ID
  displayId: string; // e.g. #001
  name: string;
  shortCode: string;
  colorClass: string;
  description: string;
  courseCount: number;
  status: 'Activo' | 'Inactivo';
  order?: number; // Display Order
}

export interface Course {
  id: string;
  name: string;
  category: string;
  professors?: string[]; // Legacy/Denormalized: Teachers assigned
  isToeic: boolean;
  mode: 'online' | 'presencial'; // Default mode, can be overridden per session
  description: string;
  startDate: string;
  endDate: string;
  // Default templates for generating schedule
  defaultStartTime?: string; 
  defaultEndTime?: string;   
  defaultDays?: string[]; // ['LUN', 'MAR']
  // Legacy fields for backward compatibility/display
  startTime?: string;
  endTime?: string;
  days?: string[];
  isRecurring: boolean;
  price: number;
  originalPrice?: number; // NEW: For discount display
  discountBadgeText?: string; // NEW: E.g., "Exclusivo Online"
  paymentLink?: string;
  image?: string; // URL
  status: 'Active' | 'Draft' | 'Archived' | 'Concluded'; // Added Concluded
  order?: number; // Display Order
  rolloverParentId?: string; // ID of the course this was cloned from
  
  // Teams Integration
  meetingLink?: string; // The generic Teams link for this course
  refCode?: string; // Unique Reference Code (e.g. GA-2024-05-1234) for automation
  
  // WhatsApp Integration
  whatsappLink?: string; // Link to join the WhatsApp group
  
  // NEW: Teams Provisioning Logic
  teamsProvisioningStatus?: 'Ready' | 'TeamCreated' | 'Completed' | 'Failed';
  teamsTeamId?: string; // Store the Team ID for step 2
  teamsCreatedAt?: number; // Timestamp for 15-min countdown
}

// NEW: Global Testimonial
export interface Testimonial {
    id: string;
    name: string;
    role: string; // Ocupacion
    text: string; // Comment
    avatarUrl?: string;
    category: string; // Linked to Category shortCode (e.g. 'TOE', 'ING')
}

// NEW: Global FAQ
export interface GlobalFAQ {
    id: string;
    question: string;
    answer: string;
    category: string; // Linked to Category shortCode
    order: number;
}

// Updated: Removed testimonials/faqs from individual detail
export interface CourseDetail {
  id: string; // Matches Course ID
  heroImage?: string;
  longDescription: string;
  level: string; // e.g. "Avanzado C1"
  duration: string; // e.g. "12 Semanas"
  rating: number; // Manual override for marketing
  reviewCount: number; // Manual override
  learningPoints: string[]; // "Lo que aprenderás"
}

export interface Exam {
  id: string;
  name: string;
  description?: string;
  mode: 'online' | 'presencial';
  type?: 'Offline' | 'OnlineMock'; // NEW: Distinguish exam type
  allowedPaymentMethods?: ('card' | 'transfer' | 'cash')[]; // NEW: Payment control
  paymentLink?: string; // NEW: Payment link for Compra Click
  mockTestId?: string; // NEW: Link to actual Mock Test
  price: number;
  originalPrice?: number; // NEW: For discount display
  discountBadgeText?: string; // NEW: E.g., "Exclusivo Online"
  image?: string;
  capacity?: number;
  // Stats (Calculated or stored)
  enrolled: number;
  paidCount: number;
  pendingCount: number;
  status: 'Active' | 'Draft' | 'Archived';
  // UI Helpers
  colorClass?: string; 
  icon?: string;
  order?: number; // Display Order
}

// --- NEW WEB EXAM STRUCTURE (Split Bridge vs Detail) ---

// 1. The Bridge Page (Landing Card)
export interface WebExamLanding {
    id: string;
    internalCategory: string; // For admin sorting only
    title: string;
    shortDescription: string;
    linkedDetailId: string; // Links to WebExamDetail
    image?: string; // Optional cover
    status: 'Active' | 'Hidden';
    order: number;
}

// 2. The Detailed Page (Content + Options)
export interface WebExamOption {
    id: string; // Internal UUID
    marketingTitle: string; // "Paquete Gold"
    duration: string;       // "2 Horas"
    priceLabel: string;     // "$85.00"
    originalPriceLabel?: string; // "$120.00" (NEW)
    discountBadgeText?: string;  // "OFERTA 50%" (NEW)
    guarantee1: string;     // "Resultados 24h"
    guarantee2: string;     // "Certificado Oficial"
    linkedRealExamId: string; // Links to 'exams' collection
}

export interface WebExamDetail {
    id: string;
    heroImage: string;
    title: string;
    description: string;
    features: { icon: string, title: string, desc: string }[];
    options: WebExamOption[];
}

// --- NEW: Web Store Configuration ---
export interface WebStoreConfig {
    id?: string;
    hero: {
        title: string;
        subtitle: string;
        linkedItemId: string; // ID of Course or Exam
        linkedItemType: 'course' | 'exam';
    };
    featured: { // Fixed 4 slots
        slot1: { itemId: string; itemType: 'course' | 'exam' };
        slot2: { itemId: string; itemType: 'course' | 'exam' };
        slot3: { itemId: string; itemType: 'course' | 'exam' };
        slot4: { itemId: string; itemType: 'course' | 'exam' };
    };
    privateClass: {
        title: string;
        description: string;
        price: number;
        linkedItemId: string;
        linkedItemType: 'course' | 'exam';
    };
}

// --- NEW: Web Landing Configuration (Main Page Slider) ---
export interface WebLandingSlide {
    id: string;
    imageUrl: string; // Can be video URL too if implemented
    title: string;
    subtitle: string;
    buttonText: string;
    link: string;
    order: number;
}

export interface WebLandingConfig {
    id?: string;
    slides: WebLandingSlide[];
}

export interface ExamRegistration {
  id: string;
  examId: string;
  studentName: string;
  studentEmail: string;
  studentId: string; // e.g. TOEIC-23-001
  avatarUrl: string | null;
  avatarColor?: string; // gradient classes
  paymentStatus: 'Confirmado' | 'Pendiente';
  registrationDate: string;
  selectedDate?: string; // Date chosen by student
  selectedTime?: string; // Time chosen by student
  accessCode?: string; // NEW: For Online Mock Tests
  // Detail view fields
  phone?: string;
  dui?: string;
  level?: string;
  program?: string;
  cost: number;
  surcharge: number;
  // Payment Specifics
  paymentMethod?: 'card' | 'transfer' | 'cash';
  paymentReceiptUrl?: string | null;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  colorClass: string; // Tailwind gradient
  classCount: number;
  status: 'Activo' | 'Inactivo';
  avatarUrl?: string;
  hourlyRateOnline?: number; // Rate for Online classes
  hourlyRateOffline?: number; // Rate for Presencial classes
  hourlyRate?: number; // Deprecated fallback
}

// CORE SCHEDULING UNIT
export interface ClassSession {
  id: string;
  courseId: string; // Link to parent Course
  courseName: string; // Denormalized for display
  teacherId: string; // The assigned teacher for THIS specific session
  teacherName?: string; // Denormalized
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number; // Calculated duration
  dayOfWeek: number; // 0=Sun, 1=Mon, etc. (Derived from date)
  mode: 'Online' | 'Presencial'; // Used for billing calculation (Overrideable)
  room: string;
  status: 'Programada' | 'En Curso' | 'Completada' | 'Cancelada';
  studentsCount?: number; // Calculated dynamically
  // Denormalized from Course for filtering
  courseStartDate?: string;
  courseEndDate?: string;
  // Teams Integration
  meetingLink?: string; 
  recordingLink?: string; // Legacy: Single Link
  recordings?: { label: string; url: string; duration?: string }[]; // NEW: Multi-part support
  manualRecordings?: { label: string; url: string; duration?: string }[]; // NEW: Manual override for Completo links
}

export interface AttendanceRecord {
  id: string;
  classSessionId: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  actualStartTime: string;
  actualEndTime: string;
  durationMinutes: number;
  notes?: string;
  status: 'Presente' | 'Ausente'; // Instructor status
}

// STUDENT ENTRY LOG (For Portal)
export interface StudentEntryLog {
    id?: string;
    studentId: string;
    classSessionId: string;
    enteredAt: string; // ISO Timestamp
    deviceInfo?: string; // User Agent or simplistic device ID
}

export interface StatItem {
  label: string;
  value: string;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral';
  icon: string;
  colorClass: string; 
  bgClass: string;   
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

// Updated Permission Type: 'none' | 'view' | 'edit'
export type PermissionLevel = 'none' | 'view' | 'edit';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Secretaría' | 'Contabilidad' | 'Profesor';
  initials: string;
  colorClass: string; // Tailwind class for avatar bg
  permissions: {
    students: PermissionLevel;
    courses: PermissionLevel;
    exams: PermissionLevel;
    finance: PermissionLevel;
    settings: PermissionLevel;
    calendar: PermissionLevel;
    teachers: PermissionLevel;
  };
  isSuperAdmin?: boolean;
  tempPassword?: string; // Optional for creating users
}

export interface SystemSettings {
  id?: string;
  emailAlerts: boolean;
  systemNotifications: boolean;
  paymentAlerts: boolean;
  language: string;
  timezone: string;
  dateFormat: string;
  logoUrl?: string; // New field for Custom Branding
  
  // Microsoft Integration
  microsoftTenantId?: string;
  microsoftClientId?: string;
}

// NEW: Global Brand Configuration
export interface BrandInfo {
    name: string;
    tagline: string;
    address: string;
    phonePrimary: string;
    phoneSecondary: string; // e.g. Mobile/WhatsApp
    email: string;
    facebookUrl: string;
    instagramUrl: string;
    whatsappNumber: string; // Raw number for API
    mapUrl: string;
    wazeUrl: string;
}

// [NEW] System Logs for Background Tasks
export interface SystemLog {
    id: string;
    type: string; // e.g., 'RECORDING_SYNC'
    trigger: 'SCHEDULED' | 'MANUAL';
    timestamp: any; // Firestore Timestamp
    summary: string;
    status: 'SUCCESS' | 'ERROR';
    details?: any;
}

// NEW: Message Templates for WhatsApp/Email
export interface MessageTemplate {
    id: string;
    type: 'promo' | 'welcome' | 'payment_reminder' | 'catalog';
    name: string;
    content: string; // Use variables like {{name}}, {{course}}
    isDefault?: boolean;
}

// --- PLACEMENT TEST TYPES ---
export interface Question {
    id: string;
    text: string;
    options: string[]; // 4 options
    correctAnswer: number; // 0-3 index
    level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
    category: 'Grammar' | 'Vocabulary';
    active: boolean;
}

export interface PlacementResult {
    id: string;
    studentName: string;
    studentEmail: string;
    studentPhone: string;
    score: number;
    totalQuestions: number;
    calculatedLevel: string;
    date: string; // ISO
    status: 'New' | 'Contacted' | 'Enrolled';
    // Detailed breakdown for Admin view
    levelBreakdown?: {
        [key: string]: { correct: number; total: number };
    };
}

// --- NEW: STUDENT PACKAGES (MEMBERSHIPS) ---
export interface PackageSlot {
    index: number; // 1, 2, 3...
    status: 'Used' | 'Pending';
    courseName: string; // Text reference only (Decoupled from ID)
    usedDate?: string;
}

export interface StudentPackage {
    id: string;
    humanId: string; // Email (Unique Identifier for the human, NOT courseId)
    name: string; // Full Name (Synced from Student initially)
    phone: string;
    totalMonths: number;
    startDate: string;
    notes?: string;
    slots: PackageSlot[];
}

// --- NEW: TOEIC MOCK TEST TYPES ---
export interface MockTestQuestion {
    id: string; // "1" to "200"
    part: number; // 1 to 7
    imageUrl?: string; // OneDrive direct link
    text?: string; // Optional question text
    options: string[]; // ['A', 'B', 'C', 'D'] or ['A', 'B', 'C']
    correctAnswer: number; // 0, 1, 2, 3
    groupId?: string; // For grouping questions (e.g., Part 6, 7)
    groupText?: string; // Shared text passage for the group
    groupImage?: string; // Shared image for the group
    
    // NEW: For Directions/Instructions
    type?: 'question' | 'direction'; // Default is 'question'
    content?: string; // HTML content for directions
}

export interface MockTest {
    id: string;
    title: string;
    description?: string;
    audioUrl?: string; // Single MP3 for the whole test
    status: 'Draft' | 'Active' | 'Archived';
    createdAt: string;
    questions: MockTestQuestion[]; // 200 questions
}

export interface MockTestTicket {
    id: string; // e.g., GT-MOCK-A1B2
    status: 'Unused' | 'In-Progress' | 'Completed';
    testId?: string; // Assigned test ID when started
    studentName?: string;
    studentPhone?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    savedAnswers?: Record<string, number>; // { "1": 0, "2": 2 }
    remainingSeconds?: number; // 7200 seconds (120 mins)
}

export interface MockTestResult {
    id: string;
    ticketId: string;
    testId: string;
    studentName: string;
    studentPhone: string;
    lcRawScore: number;
    rcRawScore: number;
    lcScaledScore: number;
    rcScaledScore: number;
    totalScore: number;
    completedAt: string;
    answers: Record<string, number>; // Student's answers
}

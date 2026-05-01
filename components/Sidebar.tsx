
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { AppUser } from '../types';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { Link } = ReactRouterDOM as any;

interface SidebarProps {
  currentView?: string;
  onNavigate?: (view: string) => void;
  userProfile?: AppUser | null;
  onLogout?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView = 'dashboard', onNavigate, userProfile, onLogout, isOpen = false, onClose }) => {
  // Define web management views
  const webViews = ['web-landing', 'web-courses', 'web-exams', 'web-store', 'categories', 'web-testimonials', 'web-faqs'];
  const isWebActive = webViews.includes(currentView) || currentView.startsWith('web-');

  // Sub-menu state - Auto open if current view is a web view
  const [isWebMenuOpen, setIsWebMenuOpen] = useState(isWebActive);

  // Sync open state when navigation changes
  useEffect(() => {
      if (isWebActive) {
          setIsWebMenuOpen(true);
      }
  }, [currentView, isWebActive]);

  const handleNav = (view: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) onNavigate(view);
    if (onClose) onClose(); // Close drawer on mobile nav
  };

  const handleLogoutClick = () => {
      if(window.confirm("¿Está seguro de cerrar sesión?")) {
          if (onLogout) onLogout();
          if (onClose) onClose();
      }
  };

  const getLinkClasses = (view: string) => {
    const isActive = currentView === view;
    if (isActive) {
      return "flex items-center gap-3 px-4 py-3 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 transition-all shrink-0";
    }
    return "flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-text-secondary hover:bg-slate-100 dark:hover:bg-surface-highlight hover:text-slate-900 dark:hover:text-white transition-all group shrink-0";
  };

  const displayName = userProfile?.name || 'Usuario';
  const displayRole = userProfile?.role || 'Admin';
  const displayInitials = userProfile?.initials || 'U';
  const displayColorClass = userProfile?.colorClass || 'bg-slate-500/20 text-slate-500';
  
  // Permission Helper
  const canAccess = (module: keyof AppUser['permissions']) => {
      if (userProfile?.isSuperAdmin) return true;
      const perm = (userProfile?.permissions as any)?.[module];
      if (perm === true) return true; 
      if (perm === 'view' || perm === 'edit') return true; 
      return false;
  };

  const canEditStudents = () => {
      if (userProfile?.isSuperAdmin) return true;
      const perm = (userProfile?.permissions as any)?.students;
      return perm === 'edit' || perm === true;
  };

  const canManageWeb = canAccess('courses') || canAccess('exams');

  return (
    <>
      {/* Mobile Backdrop with Transition */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      ></div>

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 h-screen flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark shrink-0 transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header Section (Fixed Height) */}
        <div className="p-6 pb-4 shrink-0 flex flex-col gap-6 relative">
          {/* Close Button Mobile */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white lg:hidden"
          >
            <Icon name="close" className="text-xl" />
          </button>

          <Link to="/portal" onClick={(e: React.MouseEvent) => { e.preventDefault(); if(onNavigate) onNavigate('dashboard'); if(onClose) onClose(); }} className="flex items-center justify-center px-2 cursor-pointer">
            <Logo className="w-full h-auto max-w-[180px]" />
          </Link>
        </div>

        {/* Scrollable Navigation Area (Flex Grow) */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 flex flex-col gap-1.5">
            {/* 1. Dashboard (Always Visible) */}
            <a href="#" onClick={handleNav('dashboard')} className={getLinkClasses('dashboard')}>
              <Icon name="dashboard" filled={currentView === 'dashboard'} />
              <span className="text-sm font-semibold">Dashboard</span>
            </a>
            
            {/* 2. Schedule Manager (Interactive Assignment) */}
            {canAccess('calendar') && (
              <a href="#" onClick={handleNav('schedule-manager')} className={getLinkClasses('schedule-manager')}>
                  <Icon name="edit_calendar" className={currentView !== 'schedule-manager' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'schedule-manager'} />
                  <span className="text-sm font-medium">Asignación & Horarios</span>
              </a>
            )}

            {/* 3. Global Calendar (Read Only) */}
            {canAccess('calendar') && (
              <a href="#" onClick={handleNav('calendar')} className={getLinkClasses('calendar')}>
                  <Icon name="calendar_month" className={currentView !== 'calendar' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'calendar'} />
                  <span className="text-sm font-medium">Calendario Global</span>
              </a>
            )}

            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-2"></div>

            {/* MARKETING TOOLS (NEW) */}
            {canEditStudents() && (
                <a href="#" onClick={handleNav('marketing')} className={getLinkClasses('marketing')}>
                    <Icon name="campaign" className={currentView !== 'marketing' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'marketing'} />
                    <span className="text-sm font-medium">Marketing Studio</span>
                </a>
            )}

            {/* MARKETING ANALYTICS (NEW) */}
            {canEditStudents() && (
                <a href="#" onClick={handleNav('analytics')} className={getLinkClasses('analytics')}>
                    <Icon name="bar_chart" className={currentView !== 'analytics' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'analytics'} />
                    <span className="text-sm font-medium">Estadísticas & Ads</span>
                </a>
            )}

            {/* PLACEMENT TESTS (NEW) */}
            {canEditStudents() && (
                <a href="#" onClick={handleNav('level-tests')} className={getLinkClasses('level-tests')}>
                    <Icon name="quiz" className={currentView !== 'level-tests' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'level-tests'} />
                    <span className="text-sm font-medium">Test de Nivel (Leads)</span>
                </a>
            )}

            {/* TRY EMMA LEADS */}
            {canEditStudents() && (
                <a href="#" onClick={handleNav('try-emma-leads')} className={getLinkClasses('try-emma-leads')}>
                    <Icon name="record_voice_over" className={currentView !== 'try-emma-leads' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'try-emma-leads'} />
                    <span className="text-sm font-medium">Try Emma Leads</span>
                </a>
            )}

            {/* MOCK TESTS (NEW) */}
            {canEditStudents() && (
                <a href="#" onClick={handleNav('mock-tests')} className={getLinkClasses('mock-tests')}>
                    <Icon name="school" className={currentView !== 'mock-tests' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'mock-tests'} />
                    <span className="text-sm font-medium">TOEIC Mock Tests</span>
                </a>
            )}

            {/* 4. Courses */}
            {canAccess('courses') && (
              <a href="#" onClick={handleNav('courses')} className={getLinkClasses('courses')}>
                  <Icon name="menu_book" className={currentView !== 'courses' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'courses'} />
                  <span className="text-sm font-medium">Cursos</span>
              </a>
            )}

            {/* 5. Exams */}
            {canAccess('exams') && (
              <a href="#" onClick={handleNav('exams')} className={getLinkClasses('exams')}>
                  <Icon name="assignment" className={currentView !== 'exams' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'exams'} />
                  <span className="text-sm font-medium">Exámenes</span>
              </a>
            )}

            {/* 6. Students */}
            {canAccess('students') && (
              <a href="#" onClick={handleNav('students')} className={getLinkClasses('students')}>
                  <Icon name="groups" className={currentView !== 'students' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'students'} />
                  <span className="text-sm font-medium">Estudiantes</span>
              </a>
            )}

            {/* NEW: Independent Memberships - RENAMED TO Paquetes */}
            {canAccess('students') && (
              <a href="#" onClick={handleNav('memberships')} className={getLinkClasses('memberships')}>
                  <Icon name="card_membership" className={currentView !== 'memberships' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'memberships'} />
                  <span className="text-sm font-medium">Paquetes</span>
              </a>
            )}

            {/* 7. Teachers */}
            {canAccess('teachers') && (
              <a href="#" onClick={handleNav('teachers')} className={getLinkClasses('teachers')}>
                  <Icon name="person_apron" className={currentView !== 'teachers' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'teachers'} />
                  <span className="text-sm font-medium">Profesores</span>
              </a>
            )}

            {/* 8. Finance */}
            {canAccess('finance') && (
              <a href="#" onClick={handleNav('finance')} className={getLinkClasses('finance')}>
                  <Icon name="payments" className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">Finanzas</span>
              </a>
            )}

            {/* WEB MANAGEMENT GROUP */}
            {canManageWeb && (
                <div className="pt-2 shrink-0">
                    <button 
                        onClick={() => setIsWebMenuOpen(!isWebMenuOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-600 dark:text-text-secondary hover:bg-slate-100 dark:hover:bg-surface-highlight hover:text-slate-900 dark:hover:text-white transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="language" className="group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-medium">Gestión Web</span>
                        </div>
                        <Icon name={isWebMenuOpen ? "expand_less" : "expand_more"} className="text-sm opacity-50" />
                    </button>
                    
                    {/* Submenu */}
                    {isWebMenuOpen && (
                        <div className="ml-4 pl-4 border-l border-slate-200 dark:border-slate-800 flex flex-col gap-1 mt-1 animate-in slide-in-from-top-2">
                            <a href="#" onClick={handleNav('web-landing')} className={getLinkClasses('web-landing')}>
                                <span className="text-sm font-medium">Web Inicio (Slider)</span>
                            </a>
                            <a href="#" onClick={handleNav('web-store')} className={getLinkClasses('web-store')}>
                                <span className="text-sm font-medium">Destacados & Tienda</span>
                            </a>
                            <a href="#" onClick={handleNav('web-courses')} className={getLinkClasses('web-courses')}>
                                <span className="text-sm font-medium">Web Cursos</span>
                            </a>
                            <a href="#" onClick={handleNav('web-exams')} className={getLinkClasses('web-exams')}>
                                <span className="text-sm font-medium">Web Exámenes</span>
                            </a>
                            <a href="#" onClick={handleNav('categories')} className={getLinkClasses('categories')}>
                                <span className="text-sm font-medium">Categorías</span>
                            </a>
                            <a href="#" onClick={handleNav('web-testimonials')} className={getLinkClasses('web-testimonials')}>
                                <span className="text-sm font-medium">Testimonios</span>
                            </a>
                            <a href="#" onClick={handleNav('web-faqs')} className={getLinkClasses('web-faqs')}>
                                <span className="text-sm font-medium">FAQs</span>
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* Enrollment */}
            {canEditStudents() && (
              <a href="#" onClick={handleNav('enrollment')} className={getLinkClasses('enrollment')}>
                  <Icon name="person_add" className={currentView !== 'enrollment' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'enrollment'} />
                  <span className="text-sm font-medium">Inscripción</span>
              </a>
            )}

            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-2"></div>

            {/* NEW: Teams Management */}
            {canAccess('settings') && (
              <a href="#" onClick={handleNav('teams-manager')} className={getLinkClasses('teams-manager')}>
                  <Icon name="hub" className={currentView !== 'teams-manager' ? "group-hover:scale-110 transition-transform" : ""} filled={currentView === 'teams-manager'} />
                  <span className="text-sm font-medium">Gestión Teams</span>
              </a>
            )}

            {/* Settings */}
            {canAccess('settings') && (
              <a href="#" onClick={handleNav('settings')} className={getLinkClasses('settings')}>
                  <Icon name="settings" className="group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">Configuración</span>
              </a>
            )}
        </nav>

        {/* Footer Section (Fixed Height) */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div onClick={handleLogoutClick} className="flex items-center gap-3 p-3 rounded-xl bg-slate-100 dark:bg-surface-highlight cursor-pointer hover:bg-slate-200 dark:hover:bg-[#2f3647] transition-colors group relative" title="Cerrar Sesión">
            <div className={`size-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${displayColorClass}`}>
                {displayInitials}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
              <p className="text-xs text-slate-500 dark:text-text-secondary truncate">{displayRole}</p>
            </div>
            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon name="logout" className="text-red-500" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

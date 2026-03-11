import React from 'react';
import { Icon } from './Icon';
import { AppUser } from '../types';

interface TeacherSidebarProps {
  currentView?: string;
  onNavigate: (view: string) => void;
  userProfile?: AppUser | null;
  onLogout?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const TeacherSidebar: React.FC<TeacherSidebarProps> = ({ currentView, onNavigate, userProfile, onLogout, isOpen = false, onClose }) => {
  const handleNav = (view: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(view);
    if(onClose) onClose();
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
      return "flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary border border-primary/20 transition-all hover:bg-primary/20";
    }
    return "flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all";
  };

  return (
    <>
      {/* Mobile Backdrop with Transition */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      ></div>

      {/* Sidebar Panel */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 flex flex-col justify-between border-r border-gray-800 bg-[#111218] p-6 shrink-0 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col gap-8 relative">
          {/* Close Button Mobile */}
          <button 
            onClick={onClose}
            className="absolute -top-2 right-0 p-2 text-slate-500 hover:text-white md:hidden"
          >
            <Icon name="close" className="text-xl" />
          </button>

          {/* Branding */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-blue-900/20">
              <Icon name="school" className="text-2xl" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-white text-lg font-bold tracking-tight">GteaMgr</h1>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Panel Docente</p>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex flex-col gap-2">
            <a href="#" onClick={handleNav('dashboard')} className={getLinkClasses('dashboard')}>
              <Icon name="dashboard" className="text-[20px]" />
              <p className="text-sm font-medium">Dashboard</p>
            </a>
            <a href="#" onClick={handleNav('schedule')} className={getLinkClasses('schedule')}>
              <Icon name="calendar_month" className="text-[20px]" />
              <p className="text-sm font-medium">Calendario</p>
            </a>
            <a href="#" onClick={handleNav('attendance')} className={getLinkClasses('attendance')}>
              <Icon name="check_circle" className="text-[20px]" />
              <p className="text-sm font-medium">Asistencia</p>
            </a>
            <a href="#" onClick={handleNav('history')} className={getLinkClasses('history')}>
              <Icon name="history" className="text-[20px]" />
              <p className="text-sm font-medium">Historial</p>
            </a>
          </nav>
        </div>

        {/* User & Logout */}
        <div className="flex flex-col gap-4 border-t border-gray-800 pt-6">
          <div className="flex items-center gap-3">
            <div 
              className="bg-center bg-no-repeat bg-cover rounded-full size-10 ring-2 ring-primary/30 flex items-center justify-center bg-slate-800 text-white font-bold"
            >
               {userProfile?.initials || 'P'}
            </div>
            <div className="flex flex-col">
              <p className="text-white text-sm font-semibold">{userProfile?.name || 'Profesor'}</p>
              <p className="text-slate-400 text-xs">ID: {userProfile?.id.substring(0,6)}...</p>
            </div>
          </div>
          <button onClick={handleLogoutClick} className="flex items-center gap-3 px-2 py-2 text-slate-400 hover:text-red-400 transition-colors">
            <Icon name="logout" className="text-[20px]" />
            <p className="text-sm font-medium">Cerrar Sesión</p>
          </button>
        </div>
      </aside>
    </>
  );
};

export default TeacherSidebar;
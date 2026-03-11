
import React from 'react';
// Fix: Use namespace import
import * as ReactRouterDOM from 'react-router-dom';
const { Link, useLocation } = ReactRouterDOM as any;
import { Icon } from './Icon';

export const PublicMobileFooter: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { label: 'Inicio', path: '/', icon: 'home' },
    { label: 'Cursos', path: '/courses', icon: 'school' },
    { label: 'Exámenes', path: '/exams', icon: 'assignment' },
    { label: 'Inscripción', path: '/enroll', icon: 'how_to_reg' },
    { label: 'Contacto', path: '/contact', icon: 'mail' }, // Changed from WhatsApp to Contact Page
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200 pb-safe">
      <div className="flex items-center justify-between px-2 h-16">
        {navItems.map((item) => {
          const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
          return (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className={`material-symbols-outlined text-[24px] ${isActive ? 'fill-1' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[10px] font-bold tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

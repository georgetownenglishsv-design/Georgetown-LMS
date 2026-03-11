
import React, { useState, useEffect } from 'react';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { Link } = ReactRouterDOM as any;
import { Icon } from './Icon';
import { Logo } from './Logo';
import { getBrandInfo } from '../services/db';
import { BrandInfo } from '../types';

export const PublicNavbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [brand, setBrand] = useState<BrandInfo | null>(null);

  useEffect(() => {
      const loadBrand = async () => {
          const info = await getBrandInfo();
          setBrand(info);
      };
      loadBrand();

      // Listen for updates from settings
      const handleUpdate = (e: any) => setBrand(e.detail);
      window.addEventListener('brand-updated', handleUpdate);
      return () => window.removeEventListener('brand-updated', handleUpdate);
  }, []);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const menuItems = [
    { label: 'Home', path: '/' },
    { label: 'Cursos', path: '/courses' },
    { label: 'Examenes', path: '/exams' },
    { label: 'Test de Nivel', path: '/placement-test' },
    { label: 'Tienda', path: '/store' },
    { label: 'Contactanos', path: '/contact' },
    { label: 'Portal Alumnos', path: '/student/login' }, 
  ];

  const brandName = brand?.name || 'Georgetown Academy';
  const brandTagline = brand?.tagline || 'Language Institute';
  const displayPhone = brand?.phonePrimary || '+503 2231-1790';
  const displayMobile = brand?.phoneSecondary || '+503 7680-5577';
  const rawPhone = displayPhone.replace(/[^0-9]/g, '');
  const rawMobile = displayMobile.replace(/[^0-9]/g, '');

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center bg-white/90 backdrop-blur-xl px-4 md:px-6 py-2 justify-between border-b border-slate-200 shadow-sm h-20 transition-colors">
        {/* Left: Hamburger & Logo */}
        <div className="flex items-center gap-2 md:gap-4 z-50 shrink-0">
          <button 
            onClick={toggleMenu} 
            className="text-slate-900 flex items-center justify-center cursor-pointer hover:text-gold transition-colors p-2 rounded-full hover:bg-slate-100" 
            title="Menú"
            aria-label="Abrir menú"
          >
            <span className="material-symbols-outlined text-2xl md:text-3xl">{isMenuOpen ? 'close' : 'menu'}</span>
          </button>
          
          <Link to="/" className="flex items-center justify-center h-10 w-auto min-w-[40px] max-w-[120px] overflow-hidden">
             <Logo className="h-full w-full object-contain" iconOnly={true} />
          </Link>
        </div>
        
        {/* Center: Brand Name (Tablet/Desktop) - Hidden ONLY on very small Mobile screens */}
        {/* Changed from 'hidden md:flex' to 'hidden sm:flex' to show on tablets */}
        <div className="absolute left-0 w-full flex justify-center items-center pointer-events-none z-40 h-full px-14 sm:px-16 hidden sm:flex">
          <div className="flex flex-col items-center justify-center text-center">
             <h2 className="text-slate-900 font-black tracking-tight uppercase flex flex-col sm:block leading-[0.9] sm:leading-tight">
              {brandName.split(' ').map((word, i) => (
                  <span key={i} className={`text-[11px] sm:text-base block sm:inline ${i > 0 ? 'sm:ml-1' : ''}`}>{word}</span>
              ))}
            </h2>
            <span className="text-[8px] sm:text-[10px] text-gold font-bold tracking-[0.2em] uppercase hidden sm:block">{brandTagline}</span>
          </div>
        </div>
        
        {/* Right: CTA Buttons */}
        <div className="flex items-center gap-2 md:gap-3 z-50 shrink-0">
          
          {/* Placement Test Link Desktop - UPDATED TO BUTTON STYLE */}
          <Link 
            to="/placement-test" 
            className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 bg-white hover:border-primary hover:text-primary hover:bg-blue-50 text-slate-600 text-xs font-bold uppercase tracking-wider transition-all shadow-sm mr-1"
          >
              <Icon name="quiz" className="text-lg" />
              Test de Nivel
          </Link>

          {/* Student Portal Button - Icon Only on Mobile/Tablet, Full on Desktop */}
          <Link 
            to="/student/login" 
            className="flex items-center justify-center bg-slate-900 hover:bg-primary text-white transition-all shadow-md active:scale-95
                       md:rounded-full md:px-5 md:py-2.5 md:text-xs md:font-bold md:uppercase md:tracking-wider md:gap-2
                       rounded-full size-9 md:size-auto"
            title="Portal Alumnos"
          >
            {/* Text visible only on MD+ */}
            <span className="hidden md:inline">Soy Alumno</span>
            {/* Icon visible on all */}
            <span className="material-symbols-outlined text-[18px] md:text-[16px]">person</span>
          </Link>

          {/* Enroll Button (Gold) - Always Visible */}
          <Link 
            to="/enroll" 
            className="bg-gradient-to-r from-gold to-[#B08D4B] hover:shadow-lg hover:shadow-gold/20 text-white font-bold rounded-full transition-all shadow-md uppercase tracking-wider whitespace-nowrap active:scale-95 flex items-center gap-1
                       text-[10px] px-3 py-2
                       md:text-xs md:px-5 md:py-2.5"
          >
            Inscripción
          </Link>

        </div>
      </div>

      {/* Spacer to prevent content from being hidden behind the fixed header */}
      <div className="h-20 w-full"></div>

      {/* Full Screen Mobile Menu Overlay */}
      <div 
        className={`fixed inset-0 z-[100] bg-background-light flex flex-col items-center justify-center transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-10 pointer-events-none'
        }`}
      >
          {/* Menu Items */}
          <nav className="flex flex-col gap-6 text-center w-full max-w-sm px-6">
            {menuItems.map((item, idx) => (
              <Link 
                key={idx}
                to={item.path} 
                onClick={() => setIsMenuOpen(false)}
                className={`text-2xl font-bold transition-colors py-2 border-b border-transparent hover:border-slate-200 ${item.path === '/student/login' ? 'text-primary' : 'text-slate-800 hover:text-primary'}`}
              >
                {item.label}
              </Link>
            ))}
            
            <div className="w-16 h-1 bg-gold rounded-full mx-auto mt-4"></div>
            
            <div className="flex flex-col gap-4 mt-4">
               <p className="text-slate-500 text-sm font-medium">¿Necesitas ayuda?</p>
               <div className="flex flex-col gap-3">
                   <a href={`tel:${rawPhone}`} className="flex items-center justify-center gap-2 text-lg font-bold text-slate-900 hover:text-primary transition-colors">
                       <Icon name="call" className="text-primary text-xl" />
                       {displayPhone}
                   </a>
                   <a href={`tel:${rawMobile}`} className="flex items-center justify-center gap-2 text-lg font-bold text-slate-900 hover:text-primary transition-colors">
                       <Icon name="phone_iphone" className="text-primary text-xl" />
                       {displayMobile}
                   </a>
               </div>
            </div>
            
            <button 
                onClick={() => setIsMenuOpen(false)}
                className="mt-8 mx-auto p-3 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
                <Icon name="close" className="text-2xl" />
            </button>
          </nav>
      </div>
    </>
  );
};


import React, { useState, useEffect } from 'react';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { Link } = ReactRouterDOM as any;
import { Icon } from './Icon';
import { getBrandInfo } from '../services/db';
import { BrandInfo } from '../types';

export const PublicFooter: React.FC = () => {
  const [brand, setBrand] = useState<BrandInfo | null>(null);

  useEffect(() => {
      const load = async () => {
          const info = await getBrandInfo();
          setBrand(info);
      };
      load();
  }, []);

  const brandName = brand?.name || 'Georgetown Academy';
  const brandAddress = brand?.address || 'San Benito, San Salvador';
  const brandPhone = brand?.phonePrimary || '+503 2231-1790';
  const brandMobile = brand?.phoneSecondary || '+503 7680-5577';
  const brandEmail = brand?.email || 'info@georgetown.edu';
  const fbLink = brand?.facebookUrl || '#';
  const igLink = brand?.instagramUrl || '#';

  return (
    <div className="bg-white border-t border-slate-200 pb-14 md:pb-8 print:hidden">
        <div className="max-w-[1280px] mx-auto px-8 pt-8 pb-4 md:px-12 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between gap-8">
              <div className="flex flex-col gap-3 max-w-xs">
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{brandName}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                    Líderes en enseñanza de idiomas con estándares internacionales. Transformando vidas a través de la educación.
                </p>
                <div className="flex gap-3 mt-1">
                    <a href={fbLink} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#1877F2] hover:text-white transition-all shadow-sm">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                    <a href={igLink} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#E4405F] hover:text-white transition-all shadow-sm">
                        {/* Official Instagram Glyph */}
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                    </a>
                </div>
              </div>
              <div className="flex-1 flex flex-col sm:flex-row gap-8 sm:gap-16">
                  <div className="flex flex-col gap-3 min-w-[120px]">
                      <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Enlaces</h5>
                      <div className="flex flex-col gap-2 text-xs text-slate-500">
                          <Link to="/courses" className="hover:text-primary transition-colors">Cursos</Link>
                          <Link to="/exams" className="hover:text-primary transition-colors">Exámenes</Link>
                          <Link to="/store" className="hover:text-primary transition-colors">Tienda</Link>
                          <Link to="/contact" className="hover:text-primary transition-colors">Contáctanos</Link>
                          <Link to="/login" className="hover:text-primary transition-colors font-medium text-slate-400 pt-1">Acceso Staff</Link>
                      </div>
                  </div>
                  <div className="flex flex-col gap-3 flex-1">
                      <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Contacto</h5>
                      <div className="flex flex-col gap-y-3 text-xs text-slate-500">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-y-3 lg:gap-x-8">
                              <div className="flex items-center gap-2">
                                  <Icon name="call" className="text-primary shrink-0 text-sm" /> 
                                  <div className="flex flex-col">
                                      <span className="whitespace-nowrap">{brandPhone}</span>
                                      <span className="text-slate-400">{brandMobile}</span>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                  <Icon name="mail" className="text-primary shrink-0 text-sm" /> 
                                  <span className="break-all font-medium">{brandEmail}</span>
                              </div>
                          </div>
                          <div className="flex items-center gap-2 w-full">
                              <Icon name="location_on" className="text-primary shrink-0 text-sm" /> 
                              <span className="leading-snug">{brandAddress}</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
          <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
                <p className="text-[10px] text-slate-400 text-center sm:text-left uppercase tracking-wide">
                    © 2019-{new Date().getFullYear()} {brandName}.
                </p>
            </div>
          </div>
        </div>
    </div>
  );
};

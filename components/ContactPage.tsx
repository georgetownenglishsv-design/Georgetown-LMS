
import React, { useState, useEffect } from 'react';
import { PublicNavbar } from './PublicNavbar';
import { Icon } from './Icon';
import { getBrandInfo } from '../services/db';
import { BrandInfo } from '../types';
import { PublicMobileFooter } from './PublicMobileFooter';
import { PublicFloatingButtons } from './PublicFloatingButtons';
import { PublicFooter } from './PublicFooter';
import emailjs from '@emailjs/browser';

const ContactPage: React.FC = () => {
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
      const load = async () => {
          const info = await getBrandInfo();
          setBrand(info);
      };
      load();
  }, []);

  const handleSendMessage = async () => {
      if (!name || !email || !message) {
          alert("Por favor complete todos los campos.");
          return;
      }
      
      setSending(true);

      // --- EMAILJS CONFIGURATION ---
      // NOTE: Values updated based on potential copy-paste error. 
      // TEMPLATE_ID must be different from SERVICE_ID.
      const SERVICE_ID: string = 'service_vav571u';   
      const TEMPLATE_ID: string = 'template_64q5w15'; // Placeholder: REPLACE with your actual Template ID from EmailJS
      const PUBLIC_KEY = 's-orlaC7o6lcPb1Ky'; 

      const templateParams = {
          from_name: name,
          from_email: email,
          message: message,
          to_name: 'Georgetown Academy Admin'
      };

      try {
          // Check for placeholder or identical IDs which indicate configuration error
          if (TEMPLATE_ID === 'YOUR_TEMPLATE_ID' || TEMPLATE_ID === SERVICE_ID || TEMPLATE_ID.includes('template_8d9s7s')) {
              console.warn("EmailJS configuration invalid. Simulating success for demo.");
              await new Promise(resolve => setTimeout(resolve, 1500));
              alert(`[MODO DEMO] Configuración incompleta (Template ID inválido).\n\nDatos capturados:\nNombre: ${name}\nEmail: ${email}\nMensaje: ${message}`);
          } else {
              // Real sending
              await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
              alert(`Gracias ${name}. Hemos recibido tu mensaje correctamente.`);
          }

          // Reset form on success (or simulated success)
          setName('');
          setEmail('');
          setMessage('');
      } catch (error: any) {
          console.error('EmailJS Error Details:', JSON.stringify(error));
          const errorText = error?.text || "Error desconocido";
          alert(`Hubo un error al enviar el mensaje: ${errorText}. \n\nPor favor contáctenos por WhatsApp.`);
      } finally {
          setSending(false);
      }
  };

  const mapLink = brand?.mapUrl || "https://www.google.com/maps/search/?api=1&query=Georgetown+Academy";
  const wazeLink = brand?.wazeUrl || "https://waze.com/ul?q=Georgetown%20Academy";
  const fbLink = brand?.facebookUrl || "#";
  const igLink = brand?.instagramUrl || "#";
  const address = brand?.address || "Cargando dirección...";
  const phoneFixed = brand?.phonePrimary || "...";
  const phoneMobile = brand?.phoneSecondary || "...";
  const contactEmail = brand?.email || "...";
  const rawPhoneFixed = phoneFixed.replace(/[^0-9]/g, '');
  const rawPhoneMobile = phoneMobile.replace(/[^0-9]/g, '');

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#f8fafc] dark:bg-[#101922] font-display text-slate-900 dark:text-white">
      <PublicNavbar />

      <main className="flex-1 px-4 pb-24 pt-6">
        {/* Hero Text */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">Hablemos de tu Futuro</h1>
          <p className="text-slate-500 dark:text-slate-400 text-base max-w-md mx-auto leading-relaxed">
            Estamos listos para ayudarte a alcanzar tus metas en inglés con nuestro sistema avanzado.
          </p>
        </div>

        <div className="flex flex-col gap-6 max-w-lg mx-auto">
          
          {/* Phone Card */}
          <div className="flex flex-col rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700">
            <div className="flex items-start gap-4 mb-4">
               <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2 mb-1">
                   <span className="bg-primary/10 text-primary p-1.5 rounded-lg">
                     <Icon name="call" className="text-[20px]" />
                   </span>
                   <h3 className="text-lg font-bold text-slate-900 dark:text-white">Llámanos</h3>
                 </div>
                 <p className="text-sm text-slate-500 dark:text-slate-400 pl-1">Atención personalizada inmediata</p>
               </div>
            </div>
            <div className="flex flex-col gap-3">
               {/* Landline */}
               <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                 <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Fijo</span>
                    <span className="text-slate-700 dark:text-slate-200 font-medium">{phoneFixed}</span>
                 </div>
                 <a href={`tel:${rawPhoneFixed}`} className="bg-white dark:bg-slate-600 text-primary shadow-sm size-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                   <Icon name="phone_in_talk" className="text-[18px]" />
                 </a>
               </div>
               {/* Mobile */}
               <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                 <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Móvil / WhatsApp</span>
                    <span className="text-slate-700 dark:text-slate-200 font-medium">{phoneMobile}</span>
                 </div>
                 <a href={`tel:${rawPhoneMobile}`} className="bg-white dark:bg-slate-600 text-primary shadow-sm size-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                   <Icon name="phone_iphone" className="text-[18px]" />
                 </a>
               </div>
            </div>
          </div>

          {/* Email Card */}
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 group">
             <div className="relative z-10 flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 mb-1">
                      <span className="bg-primary/10 text-primary p-1.5 rounded-lg">
                        <Icon name="mail" className="text-[20px]" />
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Correo Electrónico</h3>
                   </div>
                   <p className="text-sm text-slate-500 dark:text-slate-400 break-all">{contactEmail}</p>
                </div>
                <a href={`mailto:${contactEmail}`} className="flex w-full items-center justify-center rounded-xl h-10 px-4 bg-primary text-white gap-2 text-sm font-semibold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all">
                   <Icon name="send" className="text-[18px]" />
                   <span>Redactar Correo</span>
                </a>
             </div>
             <div className="absolute -right-6 -bottom-6 opacity-5 dark:opacity-10 rotate-12 pointer-events-none">
                <Icon name="mark_email_unread" className="text-[120px] text-primary" />
             </div>
          </div>

          {/* Map Card */}
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700">
             <div className="h-40 w-full bg-slate-200 relative">
                <div 
                  className="w-full h-full bg-cover bg-center opacity-90"
                  style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCchTYwGWdTLPd61w7POpBpy7EvjLyuDrf7c3GJWykMUz6SI7dsrCdceX-2VtyXbPQf8TjE66n-RYmJYoLuj7vbdvDrM-5rdUnXpfCNGj7zKHjjiUpX85KBF9DY8tnJYGQ111FuxF5286Dzxiu8iXG__0Fv0HTBOxSdWLle1ffru-kYIeF3zw6U7xdlKVnsQdeDd2EVJSdsxbuAfSiSPs_bsCanWYJJOy0eRb-fjxGozLKxM87XjRDLRvhHIHZNAhmGVx0JIn-yOlA')" }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                   <a 
                     href={mapLink}
                     target="_blank" 
                     rel="noreferrer"
                     className="bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1 hover:bg-slate-100 transition-colors"
                   >
                      <Icon name="near_me" className="text-[14px] text-primary" />
                      Ver Mapa
                   </a>
                </div>
             </div>
             <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                   <span className="bg-primary/10 text-primary p-1.5 rounded-lg">
                      <Icon name="storefront" className="text-[20px]" />
                   </span>
                   <h3 className="text-lg font-bold text-slate-900 dark:text-white">Visítanos</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                   {address}
                </p>
                <div className="flex gap-2">
                   <a href={wazeLink} target="_blank" rel="noreferrer" className="flex-1 bg-slate-50 dark:bg-slate-700 py-2.5 rounded-xl text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors border border-slate-100 dark:border-slate-600">
                      Waze
                   </a>
                   <a href={mapLink} target="_blank" rel="noreferrer" className="flex-1 bg-slate-50 dark:bg-slate-700 py-2.5 rounded-xl text-center text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors border border-slate-100 dark:border-slate-600">
                      Google Maps
                   </a>
                </div>
             </div>
          </div>

          {/* Social Grid */}
          <div className="grid grid-cols-2 gap-4">
             <a href={fbLink} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-[1.02] transition-transform">
                <div className="w-10 h-10 rounded-full bg-[#1877F2]/10 flex items-center justify-center mb-2">
                   <span className="font-bold text-[#1877F2] text-xl">f</span>
                </div>
                <span className="text-slate-600 dark:text-slate-300 font-medium text-sm">Facebook</span>
             </a>
             <a href={igLink} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-[1.02] transition-transform">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] p-[2px] mb-2">
                   <div className="w-full h-full bg-white dark:bg-slate-800 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 fill-current text-[#dc2743]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                   </div>
                </div>
                <span className="text-slate-600 dark:text-slate-300 font-medium text-sm">Instagram</span>
             </a>
          </div>

          {/* Contact Form - RESTORED */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700">
              <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="bg-primary/10 text-primary p-1.5 rounded-lg">
                          <Icon name="chat" className="text-[20px]" />
                      </span>
                      Escríbenos
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 pl-1">
                      Déjanos tus datos y te contactaremos en breve.
                  </p>
              </div>

              <div className="flex flex-col gap-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 ml-1">Nombre Completo</label>
                      <input 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400"
                          placeholder="Tu nombre"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 ml-1">Correo Electrónico</label>
                      <input 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400"
                          placeholder="tucorreo@ejemplo.com"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 ml-1">Mensaje</label>
                      <textarea 
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={4}
                          className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none placeholder:text-slate-400"
                          placeholder="¿En qué podemos ayudarte?"
                      />
                  </div>
                  <button 
                      onClick={handleSendMessage}
                      disabled={sending}
                      className="mt-2 w-full py-3.5 bg-slate-900 hover:bg-primary text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                      {sending ? <Icon name="sync" className="animate-spin text-xl" /> : <Icon name="send" className="text-xl" />}
                      <span>{sending ? 'Enviando...' : 'Enviar Mensaje'}</span>
                  </button>
              </div>
          </div>

        </div>
      </main>

      <PublicFooter />
      <PublicMobileFooter />
      <PublicFloatingButtons />
    </div>
  );
};

export default ContactPage;

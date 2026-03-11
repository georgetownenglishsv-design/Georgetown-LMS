
import React, { useState, useEffect } from 'react';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate } = ReactRouterDOM as any;
import { getCourses, getExams, getCategories, getWebStoreConfig, getBrandInfo } from '../services/db';
import { Course, Category, Exam, WebStoreConfig, BrandInfo } from '../types';
import { Icon } from './Icon';
import { PublicNavbar } from './PublicNavbar';
import { auth } from '../firebase';
import { PublicMobileFooter } from './PublicMobileFooter';
import { PublicFloatingButtons } from './PublicFloatingButtons';
import { PublicFooter } from './PublicFooter';

// Luxury Fallback Images
const FALLBACK_IMAGES = [
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1000&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1000&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1000&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=1000&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1598257006458-087169a1f08d?q=80&w=1000&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1000&auto=format&fit=crop"
];

const getFallbackImage = (id: string) => {
    const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return FALLBACK_IMAGES[sum % FALLBACK_IMAGES.length];
};

const PublicStore: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<WebStoreConfig | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Filter States ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeQuickFilter, setActiveQuickFilter] = useState('Todos'); // Top bar pills

  // Advanced Filter State (Modal)
  const [tempFilters, setTempFilters] = useState({
      categories: new Set<string>(), // Stores shortCodes
      modes: new Set<string>(),      // 'online', 'presencial', 'hibrido'
      priceRange: [0, 500]           // [min, max]
  });

  const [appliedFilters, setAppliedFilters] = useState({
      categories: new Set<string>(),
      modes: new Set<string>(),
      priceRange: [0, 500]
  });

  // Pagination
  const ITEMS_PER_PAGE = 12;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    const fetchData = async () => {
      setLoading(true);
      try {
        // [REMOVED] Automatic Anonymous Auth Logic
        // Data is now accessible via public read rules in Firestore.

        const [cData, eData, catData, cfgData, brandData] = await Promise.all([
            getCourses(),
            getExams(),
            getCategories(),
            getWebStoreConfig(),
            getBrandInfo()
        ]);
        
        setCourses(cData.filter(c => c.status === 'Active'));
        setExams(eData.filter(e => e.status === 'Active'));
        setCategories(catData.filter(c => c.status === 'Activo'));
        setConfig(cfgData);
        setBrand(brandData);
      } catch (error) {
        console.error("Error fetching store data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Handlers ---

  const handleBuy = (itemType: string, itemId: string) => {
      if (itemType === 'course') {
          navigate('/enroll', { state: { selectedCourseId: itemId } });
      } else {
          // Default to exam if not explicitly 'course' or if type is 'exam'
          navigate('/enroll', { state: { selectedExamId: itemId } });
      }
  };

  const handleOpenFilter = () => {
      // Sync temp state with currently applied state
      setTempFilters(appliedFilters);
      setIsFilterOpen(true);
  };

  const toggleFilterCategory = (shortCode: string) => {
      const newSet = new Set(tempFilters.categories);
      if (newSet.has(shortCode)) newSet.delete(shortCode);
      else newSet.add(shortCode);
      setTempFilters({ ...tempFilters, categories: newSet });
  };

  const toggleFilterMode = (mode: string) => {
      const newSet = new Set(tempFilters.modes);
      if (newSet.has(mode)) newSet.delete(mode);
      else newSet.add(mode);
      setTempFilters({ ...tempFilters, modes: newSet });
  };

  const applyFilters = () => {
      setAppliedFilters(tempFilters);
      // Reset quick filter if using advanced
      if (tempFilters.categories.size > 0) setActiveQuickFilter('Custom');
      setIsFilterOpen(false);
      setVisibleCount(ITEMS_PER_PAGE);
  };

  const resetFilters = () => {
      const empty = { categories: new Set<string>(), modes: new Set<string>(), priceRange: [0, 500] };
      setTempFilters(empty);
      setAppliedFilters(empty);
      setActiveQuickFilter('Todos');
  };

  const handleLoadMore = () => {
      setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  };

  const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Derived Data ---

  const getFeaturedItems = () => {
      if (!config) return [];
      const slots = [config.featured.slot1, config.featured.slot2, config.featured.slot3, config.featured.slot4];
      return slots.map(slot => {
          if (slot.itemType === 'course') return courses.find(c => c.id === slot.itemId);
          return exams.find(e => e.id === slot.itemId);
      }).filter(Boolean);
  };

  const featuredItems = getFeaturedItems();

  const allCatalogItems = [
      ...courses.map(c => ({ ...c, type: 'course' })),
      ...exams.map(e => ({ ...e, type: 'exam', category: 'EXAM', mode: e.mode || 'presencial' }))
  ];

  const filteredCatalog = allCatalogItems.filter(item => {
      // 1. Search Text
      const term = searchTerm.toLowerCase();
      const matchesSearch = item.name.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      // 2. Quick Pills (Only if no advanced filters applied or 'Custom' not active)
      if (activeQuickFilter !== 'Custom') {
          if (activeQuickFilter === 'Todos') return true;
          if (activeQuickFilter === 'EXAM') return item.type === 'exam';
          return item.type === 'course' && item.category === activeQuickFilter;
      }

      // 3. Advanced Filters (Modal)
      
      // Categories
      if (appliedFilters.categories.size > 0) {
          const catMatch = item.type === 'course' 
              ? appliedFilters.categories.has(item.category)
              : appliedFilters.categories.has('EXAM'); // Checkbox for exams
          if (!catMatch) return false;
      }

      // Modes
      if (appliedFilters.modes.size > 0) {
          // Normalize item mode
          const iMode = item.mode?.toLowerCase();
          let modeMatch = false;
          if (iMode === 'online' && appliedFilters.modes.has('online')) modeMatch = true;
          if (iMode === 'presencial' && appliedFilters.modes.has('presencial')) modeMatch = true;
          if (!modeMatch) return false;
      }

      // Price
      if (item.price < appliedFilters.priceRange[0] || item.price > appliedFilters.priceRange[1]) {
          // Allow if max is 500+ (treated as infinity)
          if (appliedFilters.priceRange[1] < 500) return false;
      }

      return true;
  });

  const visibleItems = filteredCatalog.slice(0, visibleCount);

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root bg-[#f5f7f8] font-display text-[#111418] overflow-x-hidden">
        <PublicNavbar />

        {/* Combined Sticky Search & Filter Header */}
        <div className="sticky top-[80px] z-30 bg-white shadow-sm">
            {/* Search Bar */}
            <div className="px-4 py-3 border-b border-gray-100">
                <label className="flex flex-col min-w-40 h-12 w-full">
                    <div className="flex w-full flex-1 items-stretch rounded-xl h-full shadow-sm">
                        <div className="text-[#60758a] flex border-none bg-[#f0f2f5] items-center justify-center pl-4 rounded-l-xl border-r-0">
                            <Icon name="search" className="text-[24px]" />
                        </div>
                        <input 
                            className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-[#111418] focus:outline-0 focus:ring-0 border-none bg-[#f0f2f5] h-full placeholder:text-[#60758a] px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal" 
                            placeholder="Buscar cursos y materiales" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="text-[#60758a] flex border-none bg-[#f0f2f5] items-center justify-center pr-4 rounded-r-xl border-l-0 cursor-pointer hover:text-primary transition-colors">
                            <Icon name="tune" className="text-[24px]" />
                        </div>
                    </div>
                </label>
            </div>

            {/* Filter Pills - FIX: Added overflow-x-auto and no-scrollbar */}
            <div className="flex gap-3 px-4 py-3 overflow-x-auto no-scrollbar bg-white w-full">
                <button 
                    onClick={handleOpenFilter}
                    className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white pl-4 pr-5 border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-all ${activeQuickFilter === 'Custom' ? 'border-primary text-primary bg-blue-50' : ''}`}
                >
                    <Icon name="filter_list" className="text-[20px]" />
                    <p className="text-sm font-bold leading-normal">Filtrar</p>
                    {activeQuickFilter === 'Custom' && <div className="w-2 h-2 bg-primary rounded-full"></div>}
                </button>
                <button 
                    onClick={() => { setActiveQuickFilter('Todos'); setAppliedFilters({ categories: new Set(), modes: new Set(), priceRange: [0, 500] }); }}
                    className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full pl-5 pr-5 shadow-sm cursor-pointer transition-all border ${activeQuickFilter === 'Todos' ? 'bg-[#111418] text-white border-transparent' : 'bg-[#f0f2f5] text-[#111418] border-transparent'}`}
                >
                    <p className="text-sm font-medium leading-normal">Todos</p>
                </button>
                <button 
                    onClick={() => { setActiveQuickFilter('EXAM'); setAppliedFilters({ categories: new Set(), modes: new Set(), priceRange: [0, 500] }); }}
                    className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full pl-5 pr-5 shadow-sm cursor-pointer transition-all border ${activeQuickFilter === 'EXAM' ? 'bg-[#111418] text-white border-transparent' : 'bg-[#f0f2f5] text-[#111418] border-transparent'}`}
                >
                    <p className="text-sm font-medium leading-normal">Exámenes</p>
                </button>
                {categories.map(cat => (
                    <button 
                        key={cat.id}
                        onClick={() => { setActiveQuickFilter(cat.shortCode); setAppliedFilters({ categories: new Set(), modes: new Set(), priceRange: [0, 500] }); }}
                        className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full pl-5 pr-5 shadow-sm cursor-pointer transition-all border ${activeQuickFilter === cat.shortCode ? 'bg-[#111418] text-white border-transparent' : 'bg-[#f0f2f5] text-[#111418] border-transparent'}`}
                    >
                        <p className="text-sm font-medium leading-normal whitespace-nowrap">{cat.name}</p>
                    </button>
                ))}
            </div>
        </div>

        <div className="w-full max-w-[1280px] mx-auto pb-24 pt-4">
            
            {/* Hero / Promo Banner (Dynamic) */}
            {config && (
                <div className="px-4 py-4 w-full">
                    <div className="@container">
                        <div 
                            className="bg-cover bg-center flex flex-col justify-between overflow-hidden rounded-2xl min-h-[220px] shadow-lg relative group cursor-pointer transition-transform hover:scale-[1.01]" 
                            style={{ backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%), url("https://lh3.googleusercontent.com/aida-public/AB6AXuDzoT6FSfKwigf4g34_GQD0DE-hVVsaJPM6ALgwTZEysH2sx3X1lyR5VfHXsJ_44Vglp5-XX_MYDI7fe5T4J_mukmccYdJwUSrXKJVydyStHB0fOEs6DcgY-_7g-nVS-p7NgNxHyVfhCQ7l-x_T4q7vojnL6kGrUS3ltU048pmXp2CK4ZWNLUid69oagIqu7HZK2oru7hEg9y895cycSqqW56vEPBD3SOq9w5frXbr2qgnHr9ZAUTrxRF-wY9QIHjDHYBk0B6VRU8k")' }}
                        >
                            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
                                <p className="text-xs font-bold text-primary tracking-wide uppercase">Oferta Especial</p>
                            </div>
                            <div className="mt-auto p-5 pb-6">
                                <h2 className="text-white text-3xl font-bold leading-tight mb-1">{config.hero.title}</h2>
                                <p className="text-white/90 text-sm font-medium mb-3">{config.hero.subtitle}</p>
                                <button 
                                    onClick={() => handleBuy(config.hero.linkedItemType, config.hero.linkedItemId)}
                                    className="bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2 px-4 rounded-lg shadow-md transition-colors inline-flex items-center gap-2"
                                >
                                    Ver Ofertas <Icon name="arrow_forward" className="text-[16px]" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Programas Destacados */}
            <div className="flex flex-col">
                <h2 className="text-[#111418] tracking-tight text-[22px] font-bold leading-tight px-4 pb-3 pt-2">
                    Programas Destacados
                </h2>
                
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                        <Icon name="sync" className="animate-spin text-3xl mr-2" /> Cargando...
                    </div>
                ) : featuredItems.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-500 text-sm italic">
                        No hay programas destacados configurados.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4 pb-4">
                        {featuredItems.map((item: any) => (
                            <div key={item.id} className="flex flex-col rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden h-full group cursor-pointer hover:shadow-md transition-all">
                                <div 
                                    className="h-32 bg-cover bg-center relative" 
                                    style={{ backgroundImage: `url("${item.image || getFallbackImage(item.id)}")` }}
                                >
                                    {/* LUXURY DISCOUNT BADGE */}
                                    {item.discountBadgeText && (
                                        <div className="absolute -top-2 -right-2 z-20 scale-90 origin-top-right">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-600 rounded-full blur opacity-70 animate-pulse"></div>
                                                <div className="relative px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-600 border border-amber-300/50 rounded-full shadow-xl overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer"></div>
                                                    <span className="relative text-white text-[10px] font-black tracking-wider uppercase drop-shadow-md">{item.discountBadgeText}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-md">
                                        <p className="text-[10px] font-bold text-white uppercase tracking-wider">Popular</p>
                                    </div>
                                </div>
                                <div className="p-3 flex flex-col flex-1">
                                    <div className="flex justify-between items-start">
                                        <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-1">{item.category || 'Examen'}</p>
                                    </div>
                                    <h3 className="text-[15px] font-bold text-[#111418] leading-tight mb-1">{item.name}</h3>
                                    <p className="text-xs text-[#60758a] line-clamp-2 mb-3 flex-1">{item.description}</p>
                                    
                                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100">
                                        <div className="flex flex-col">
                                            {item.originalPrice ? (
                                                <>
                                                    <span className="text-xs text-slate-400 line-through font-semibold decoration-red-300 decoration-2">${item.originalPrice}</span>
                                                    <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700">${item.price}</span>
                                                </>
                                            ) : (
                                                <span className="text-lg font-black text-slate-900">${item.price}</span>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => navigate(item.category && item.category !== 'EXAM' ? `/courses/${item.id}` : `/enroll`)}
                                            className="ml-auto size-8 flex items-center justify-center rounded-full bg-[#f0f2f5] text-primary hover:bg-primary hover:text-white transition-colors"
                                        >
                                            <Icon name="add" className="text-[20px]" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* FULL CATALOG GRID */}
            <div className="flex flex-col bg-white py-4 mt-4 border-t border-gray-100">
                <div className="flex items-center justify-between px-4 pb-3">
                    <h2 className="text-[#111418] tracking-tight text-[22px] font-bold leading-tight">
                        Catálogo Completo
                    </h2>
                    <p className="text-sm text-[#60758a]">{filteredCatalog.length} Resultados</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4 pb-4">
                    {visibleItems.map((item: any) => (
                        <div key={item.id} className="flex flex-row items-center gap-4 bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden" onClick={() => navigate(item.category && item.category !== 'EXAM' ? `/courses/${item.id}` : `/enroll`)}>
                            {/* LUXURY DISCOUNT BADGE (Small version for list) */}
                            {item.discountBadgeText && (
                                <div className="absolute top-0 right-0 z-10">
                                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-bl-lg shadow-sm">
                                        {item.discountBadgeText}
                                    </div>
                                </div>
                            )}
                            <div className="size-16 rounded-lg bg-gray-100 shrink-0 overflow-hidden relative">
                                <img src={item.image || getFallbackImage(item.id)} className="w-full h-full object-cover" alt={item.name} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-sm font-bold text-[#111418] line-clamp-1 pr-16">{item.name}</h4>
                                    <div className="flex flex-col items-end">
                                        {item.originalPrice ? (
                                            <>
                                                <span className="text-[10px] text-slate-400 line-through font-bold decoration-red-300 decoration-2">${item.originalPrice}</span>
                                                <span className="text-base font-black text-primary">${item.price}</span>
                                            </>
                                        ) : (
                                            <span className="text-base font-bold text-primary">${item.price}</span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-[#60758a] truncate mt-0.5">{item.category === 'EXAM' ? 'Certificación' : item.category}</p>
                                <div className="flex gap-2 mt-2">
                                    <button onClick={(e) => { e.stopPropagation(); navigate(item.type === 'course' ? `/courses/${item.id}` : `/enroll`); }} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 transition-colors">Detalles</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleBuy(item.type, item.id); }} className="text-[10px] font-bold text-white bg-primary px-2 py-1 rounded hover:bg-blue-600 transition-colors">Comprar</button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredCatalog.length === 0 && (
                        <div className="col-span-full py-10 text-center text-slate-400">
                            No se encontraron productos.
                        </div>
                    )}
                </div>

                {filteredCatalog.length > visibleCount && (
                    <div className="px-4 py-4 flex justify-center">
                        <button onClick={handleLoadMore} className="px-6 py-2.5 rounded-full border border-gray-200 bg-white text-[#111418] text-sm font-bold shadow-sm hover:bg-gray-50 flex items-center gap-2">
                            Ver más productos <Icon name="expand_more" />
                        </button>
                    </div>
                )}
            </div>

            {/* Private Class Banner */}
            {config && config.privateClass && (
                <div className="px-4 pb-20 mt-4"> 
                    <div className="flex flex-col md:flex-row rounded-2xl bg-gradient-to-r from-[#101922] to-[#1A2633] p-4 items-center gap-4 shadow-md text-white">
                        <div className="size-16 rounded-xl bg-white/10 flex items-center justify-center shrink-0 backdrop-blur-sm">
                            <span className="material-symbols-outlined text-[32px] text-primary">school</span>
                        </div>
                        <div className="flex flex-col flex-1 text-center md:text-left">
                            <h3 className="text-lg font-bold leading-tight">{config.privateClass.title}</h3>
                            <p className="text-xs text-gray-300 mt-1">{config.privateClass.description}</p>
                        </div>
                        <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto">
                            <span className="text-lg font-bold">${config.privateClass.price}</span>
                            <button 
                                onClick={() => handleBuy(config.privateClass.linkedItemType, config.privateClass.linkedItemId)}
                                className="text-xs bg-white text-black font-bold px-3 py-1.5 rounded-lg hover:bg-gray-200"
                            >
                                Ver
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <PublicFooter />

        {/* Global Footer */}
        <PublicMobileFooter />
        <PublicFloatingButtons />

        {/* --- FILTER MODAL --- */}
        {isFilterOpen && (
            <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] flex flex-col justify-end">
                <div className="w-full bg-white rounded-t-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300 ring-1 ring-white/10">
                    <div className="relative flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-full"></div>
                        <button onClick={() => setIsFilterOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <Icon name="close" />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* Categories */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Categorías</h4>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={() => toggleFilterCategory('EXAM')} 
                                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${tempFilters.categories.has('EXAM') ? 'bg-primary text-white border-primary shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                >
                                    Exámenes
                                </button>
                                {categories.map(cat => (
                                    <button 
                                        key={cat.id} 
                                        onClick={() => toggleFilterCategory(cat.shortCode)} 
                                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${tempFilters.categories.has(cat.shortCode) ? 'bg-primary text-white border-primary shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Modes */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Modalidad</h4>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => toggleFilterMode('online')} 
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${tempFilters.modes.has('online') ? 'bg-primary text-white border-primary shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                >
                                    Online
                                </button>
                                <button 
                                    onClick={() => toggleFilterMode('presencial')} 
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${tempFilters.modes.has('presencial') ? 'bg-primary text-white border-primary shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                >
                                    Presencial
                                </button>
                            </div>
                        </div>

                        {/* Price Range Placeholder */}
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Rango de Precio</h4>
                            <div className="px-2">
                                <div className="flex justify-between text-sm font-bold text-gray-900 mb-2">
                                    <span>$0</span>
                                    <span>$500+</span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden relative">
                                    <div className="absolute inset-y-0 bg-primary left-0 right-0 opacity-20"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3 pb-10">
                        <button onClick={resetFilters} className="flex-1 py-4 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Limpiar</button>
                        <button onClick={applyFilters} className="flex-[2] py-4 bg-[#111418] text-white rounded-xl text-sm font-bold shadow-lg shadow-black/10 active:scale-95 transition-all">Aplicar Filtros</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default PublicStore;

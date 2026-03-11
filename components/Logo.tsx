
import React, { useEffect, useState } from 'react';
import { getSystemSettings } from '../services/db';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

// Keys for caching
const MEMORY_CACHE: { url: string | null | undefined } = { url: undefined };
const STORAGE_KEY = 'gtea_system_logo_cache';

export const Logo: React.FC<LogoProps> = ({ className, iconOnly = false }) => {
  // 1. Initialize State Synchronously
  const [customLogo, setCustomLogo] = useState<string | null | undefined>(() => {
      // A. Check Memory (SPA Navigation)
      if (MEMORY_CACHE.url !== undefined) return MEMORY_CACHE.url;

      // B. Check Persisted Storage (Page Refresh)
      try {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) {
              MEMORY_CACHE.url = cached; // Sync memory
              return cached;
          }
      } catch (e) {
          // Ignore storage errors
      }

      // C. Unknown, trigger loading
      return undefined;
  });

  useEffect(() => {
    const fetchLogo = async () => {
      // If we already have a value from cache, we technically don't need to show loading, 
      // but we still fetch to update/validate in background.
      
      try {
        const settings = await getSystemSettings();
        const url = settings.logoUrl || null;
        
        MEMORY_CACHE.url = url;
        if (url) {
            localStorage.setItem(STORAGE_KEY, url);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }

        setCustomLogo(url);
      } catch (e) {
        console.error("Failed to refresh logo settings", e);
        // On error, if we had nothing, default to null (show nothing)
        if (customLogo === undefined) setCustomLogo(null);
      }
    };

    fetchLogo();

    const handleUpdate = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const newUrl = detail || null;
        
        MEMORY_CACHE.url = newUrl;
        setCustomLogo(newUrl);
        
        if (newUrl) {
            localStorage.setItem(STORAGE_KEY, newUrl);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    window.addEventListener('logo-updated', handleUpdate);
    return () => window.removeEventListener('logo-updated', handleUpdate);
  }, []);

  // 1. LOADING OR NO LOGO => RENDER NOTHING
  if (!customLogo) {
      return null;
  }

  // 2. CUSTOM LOGO STATE
  return (
      <img 
          src={customLogo} 
          alt="Academy Logo" 
          className={`object-contain ${className}`}
      />
  );
};

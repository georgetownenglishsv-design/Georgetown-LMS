
import React, { useEffect, useState } from 'react';
import { getSystemSettings } from '../services/db';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

// Keys for caching
const MEMORY_CACHE: { url: string | null | undefined; dataUrl?: string | null; sourceUrl?: string | null } = { url: undefined };
const STORAGE_KEY = 'gtea_system_logo_cache';
const BASE64_STORAGE_KEY = 'gtea_system_logo_base64_cache';
const BASE64_SOURCE_KEY = 'gtea_system_logo_base64_source';

export const resolveLogoAsDataUrl = async (url: string): Promise<string> => {
  if (!url || url.startsWith('data:')) return url;
  if (MEMORY_CACHE.dataUrl && MEMORY_CACHE.sourceUrl === url) {
    return MEMORY_CACHE.dataUrl;
  }
  try {
    const cachedSource = localStorage.getItem(BASE64_SOURCE_KEY);
    const cachedBase64 = localStorage.getItem(BASE64_STORAGE_KEY);
    if (cachedSource === url && cachedBase64 && cachedBase64.startsWith('data:')) {
      MEMORY_CACHE.dataUrl = cachedBase64;
      MEMORY_CACHE.sourceUrl = url;
      return cachedBase64;
    }
  } catch (e) {
    // Ignore storage read errors
  }

  // 1. Try backend proxy endpoint (/api/proxy-image) to bypass Firebase Storage CORS
  try {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.dataUrl && json.dataUrl.startsWith('data:')) {
        MEMORY_CACHE.dataUrl = json.dataUrl;
        MEMORY_CACHE.sourceUrl = url;
        try {
          localStorage.setItem(BASE64_SOURCE_KEY, url);
          localStorage.setItem(BASE64_STORAGE_KEY, json.dataUrl);
        } catch (e) {
          // Ignore quota errors
        }
        return json.dataUrl;
      }
    }
  } catch (e) {
    // Fallback to direct fetch if proxy unavailable
  }

  // 2. Fallback: Try direct CORS fetch
  try {
    const directRes = await fetch(url, { mode: 'cors' });
    if (directRes.ok) {
      const blob = await directRes.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (dataUrl.startsWith('data:')) {
        MEMORY_CACHE.dataUrl = dataUrl;
        MEMORY_CACHE.sourceUrl = url;
        try {
          localStorage.setItem(BASE64_SOURCE_KEY, url);
          localStorage.setItem(BASE64_STORAGE_KEY, dataUrl);
        } catch (e) {}
        return dataUrl;
      }
    }
  } catch (e) {
    // Return original URL if both fail
  }

  return url;
};

export const Logo: React.FC<LogoProps> = ({ className }) => {
  // 1. Initialize State Synchronously
  const [customLogo, setCustomLogo] = useState<string | null | undefined>(() => {
      if (MEMORY_CACHE.dataUrl) return MEMORY_CACHE.dataUrl;
      if (MEMORY_CACHE.url !== undefined) return MEMORY_CACHE.url;

      try {
          const cachedBase64 = localStorage.getItem(BASE64_STORAGE_KEY);
          const cachedUrl = localStorage.getItem(STORAGE_KEY);
          const cachedSource = localStorage.getItem(BASE64_SOURCE_KEY);
          if (cachedBase64 && cachedUrl && cachedSource === cachedUrl) {
              MEMORY_CACHE.url = cachedUrl;
              MEMORY_CACHE.dataUrl = cachedBase64;
              MEMORY_CACHE.sourceUrl = cachedUrl;
              return cachedBase64;
          }
          if (cachedUrl) {
              MEMORY_CACHE.url = cachedUrl;
              return cachedUrl;
          }
      } catch (e) {
          // Ignore storage errors
      }

      return undefined;
  });

  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchLogo = async () => {
      try {
        const settings = await getSystemSettings();
        const url = settings.logoUrl || null;
        
        MEMORY_CACHE.url = url;
        if (url) {
            try { localStorage.setItem(STORAGE_KEY, url); } catch (e) {}
            const resolved = await resolveLogoAsDataUrl(url);
            if (isMounted) {
                setImgError(false);
                setCustomLogo(resolved);
            }
        } else {
            try {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(BASE64_STORAGE_KEY);
                localStorage.removeItem(BASE64_SOURCE_KEY);
            } catch (e) {}
            MEMORY_CACHE.dataUrl = null;
            MEMORY_CACHE.sourceUrl = null;
            if (isMounted) setCustomLogo(null);
        }
      } catch (e) {
        console.error("Failed to refresh logo settings", e);
        if (isMounted && customLogo === undefined) setCustomLogo(null);
      }
    };

    fetchLogo();

    const handleUpdate = async (e: Event) => {
        const detail = (e as CustomEvent).detail;
        const newUrl = detail || null;
        
        MEMORY_CACHE.url = newUrl;
        if (newUrl) {
            try { localStorage.setItem(STORAGE_KEY, newUrl); } catch (err) {}
            const resolved = await resolveLogoAsDataUrl(newUrl);
            if (isMounted) {
                setImgError(false);
                setCustomLogo(resolved);
            }
        } else {
            try {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(BASE64_STORAGE_KEY);
                localStorage.removeItem(BASE64_SOURCE_KEY);
            } catch (err) {}
            MEMORY_CACHE.dataUrl = null;
            MEMORY_CACHE.sourceUrl = null;
            if (isMounted) setCustomLogo(null);
        }
    };

    window.addEventListener('logo-updated', handleUpdate);
    return () => {
        isMounted = false;
        window.removeEventListener('logo-updated', handleUpdate);
    };
  }, []);

  // Fallback Emblem SVG if logo is missing or failed to load (prevents blank boxes in tickets)
  if (!customLogo || imgError) {
      return (
          <svg
              viewBox="0 0 100 100"
              className={`object-contain ${className || ''}`}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
          >
              <rect width="100" height="100" rx="22" fill="#0F172A" />
              <path d="M50 18L18 34L50 50L82 34L50 18Z" fill="#2563EB" />
              <path d="M28 42V62C28 70 38 78 50 78C62 78 72 70 72 62V42L50 53L28 42Z" fill="#3B82F6" />
              <path d="M80 36V60" stroke="#60A5FA" strokeWidth="4" strokeLinecap="round" />
              <circle cx="80" cy="63" r="3.5" fill="#60A5FA" />
          </svg>
      );
  }

  return (
      <img 
          src={customLogo} 
          alt="Academy Logo" 
          onError={() => setImgError(true)}
          className={`object-contain ${className}`}
      />
  );
};


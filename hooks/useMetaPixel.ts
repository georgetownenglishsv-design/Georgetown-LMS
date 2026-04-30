import { useEffect } from 'react';
import { getSystemSettings } from '../services/db';

export const useMetaPixel = () => {
  useEffect(() => {
    let scriptElement: HTMLScriptElement | null = null;
    let noscriptElement: HTMLElement | null = null;

    const initPixel = async () => {
      try {
        const settings = await getSystemSettings();
        // Fallback to default pixel ID if not present
        const pixelId = settings?.metaPixelId || '1240913734670032';

        if (pixelId) {
          // Initialize Facebook Pixel manually via DOM injection
          const w = window as any;
          if (!w.fbq) {
            const n: any = w.fbq = function() {
              n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            };
            if (!w._fbq) w._fbq = n;
            n.push = n;
            n.loaded = !0;
            n.version = '2.0';
            n.queue = [];
          }

          // Insert standard script
          scriptElement = document.createElement('script');
          scriptElement.async = true;
          scriptElement.src = 'https://connect.facebook.net/en_US/fbevents.js';
          document.head.appendChild(scriptElement);

          // Insert noscript image fallback
          noscriptElement = document.createElement('noscript');
          const imgElement = document.createElement('img');
          imgElement.height = 1;
          imgElement.width = 1;
          imgElement.style.display = 'none';
          imgElement.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
          noscriptElement.appendChild(imgElement);
          document.head.appendChild(noscriptElement);

          // Call init and track
          w.fbq('init', pixelId);
          w.fbq('track', 'PageView');
        }
      } catch (error) {
        console.error("Error loading Meta Pixel:", error);
      }
    };

    initPixel();

    return () => {
      // Cleanup dynamically injected elements if the component unmounts
      if (scriptElement && document.head.contains(scriptElement)) {
        document.head.removeChild(scriptElement);
      }
      if (noscriptElement && document.head.contains(noscriptElement)) {
        document.head.removeChild(noscriptElement);
      }
    };
  }, []);
};

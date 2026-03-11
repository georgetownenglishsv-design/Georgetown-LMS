
import { useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useLocation } = ReactRouterDOM as any;

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Instant scroll to top on path change
    window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' 
    });
  }, [pathname]);

  return null;
};

export default ScrollToTop;

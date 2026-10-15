import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Automatically resets window, document, and layout scroll positions to top (0, 0)
 * whenever the route (pathname or search query) changes.
 */
const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // 1. Instant window scroll to (0, 0)
    try {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant',
      });
    } catch {
      window.scrollTo(0, 0);
    }

    // 2. Fallback for documentElement and body
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    // 3. Fallback for any scrollable main container
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [pathname, search]);

  return null;
};

export default ScrollToTop;

import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Store scroll positions for each route
const scrollPositions = new Map<string, number>();

// Disable browser's automatic scroll restoration
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

export const useScrollPosition = () => {
  const location = useLocation();
  const scrollRef = useRef<number>(0);

  useLayoutEffect(() => {
    // Restore scroll position synchronously before paint
    const savedPosition = scrollPositions.get(location.pathname) || 0;
    if (savedPosition !== window.scrollY) {
      window.scrollTo(0, savedPosition);
    }

    // Save scroll position when user scrolls
    const handleScroll = () => {
      scrollRef.current = window.scrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      scrollPositions.set(location.pathname, scrollRef.current);
    };
  }, [location.pathname]);
};

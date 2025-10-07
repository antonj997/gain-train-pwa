import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Store scroll positions for each route
const scrollPositions = new Map<string, number>();

export const useScrollPosition = () => {
  const location = useLocation();
  const scrollRef = useRef<number>(0);

  useEffect(() => {
    // Prevent browser's automatic scroll restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Small delay to ensure DOM is ready before restoring scroll
    const timer = setTimeout(() => {
      const savedPosition = scrollPositions.get(location.pathname) || 0;
      window.scrollTo(0, savedPosition);
    }, 0);

    // Save scroll position when scrolling
    const handleScroll = () => {
      scrollRef.current = window.scrollY;
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
      scrollPositions.set(location.pathname, scrollRef.current);
    };
  }, [location.pathname]);
};

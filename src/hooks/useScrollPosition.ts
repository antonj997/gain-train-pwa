import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Store scroll positions for each route
const scrollPositions = new Map<string, number>();

export const useScrollPosition = () => {
  const location = useLocation();
  const scrollRef = useRef<number>(0);

  useEffect(() => {
    // Restore scroll position when component mounts
    const savedPosition = scrollPositions.get(location.pathname) || 0;
    window.scrollTo(0, savedPosition);

    // Save scroll position when component unmounts or route changes
    const handleScroll = () => {
      scrollRef.current = window.scrollY;
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      scrollPositions.set(location.pathname, scrollRef.current);
    };
  }, [location.pathname]);
};

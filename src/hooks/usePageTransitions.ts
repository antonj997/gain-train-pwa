import {
  useCallback,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type RefObject,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { appRoute, pageTransition } from "@/lib/page-transition";
import {
  animatePageEntry,
  canViewTransition,
  markPageEntering,
  navigateWithTransition,
  settlePageTransition,
} from "@/lib/view-transition";

/**
 * The page slides, in one place (Layout). A tap on an in-app link between the
 * tabs, Settings and Admin runs as a view transition; every other way the route
 * changes (back/forward, a navigation from code, no API) plays the fallback.
 * A tab or sub-page starts at the top, as it always has.
 */
export function usePageTransitions(main: RefObject<HTMLElement>) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const previous = useRef(pathname);

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from === pathname) return;
    const handled = settlePageTransition(main.current);
    const direction = pageTransition(from, pathname);
    if (!direction) return;
    if (window.scrollY) window.scrollTo(0, 0);
    const element = main.current;
    if (!element) return;
    markPageEntering(element);
    if (!handled) animatePageEntry(element, direction);
  }, [pathname, main]);

  /** On the app shell: takes over plain taps on links that slide. */
  const onClickCapture = useCallback(
    (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey ||
        !canViewTransition()
      )
        return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const route = appRoute(
        anchor.href,
        window.location.origin,
        import.meta.env.BASE_URL,
      );
      if (!route) return;
      const direction = pageTransition(previous.current, route.pathname);
      if (!direction) return;
      // The router's Link sees defaultPrevented and leaves the navigation to us.
      event.preventDefault();
      navigateWithTransition(direction, () => navigate(route.to));
    },
    [navigate],
  );

  return { onClickCapture };
}

/** Back from a sub-page: to where it was opened from, or `fallback` on a fresh load. */
export function usePageBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    navigateWithTransition("pop", () => {
      if (window.history.state?.idx > 0) navigate(-1);
      else navigate(fallback);
    });
  }, [navigate, fallback]);
}

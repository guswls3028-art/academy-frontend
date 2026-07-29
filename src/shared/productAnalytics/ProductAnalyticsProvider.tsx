import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";
import { trackProductUsage } from "./client";
import { ProductAnalyticsContext } from "./context";
import { resolveProductRoute } from "./routeRegistry";
import type { ProductRoute } from "./types";

const TRACKED_DESTINATION_SELECTOR =
  "a[href], [data-analytics-destination]";

function placementFor(element: Element): string {
  const explicit = element.closest<HTMLElement>("[data-analytics-placement]")
    ?.dataset.analyticsPlacement;
  if (explicit) return explicit;
  if (element.closest("aside")) return "sidebar";
  if (element.closest("header")) return "header";
  if (element.closest("nav")) return "navigation";
  return "content";
}

function positionFor(element: Element): number | undefined {
  const parent = element.parentElement;
  if (!parent) return undefined;
  const peers = Array.from(parent.children).filter(
    (candidate) => candidate.matches(TRACKED_DESTINATION_SELECTOR),
  );
  const index = peers.indexOf(element);
  return index >= 0 ? index : undefined;
}

function destinationFor(element: Element): ProductRoute | null {
  const explicit = (
    element.closest<HTMLElement>("[data-analytics-destination]")
      ?.dataset.analyticsDestination
    || ""
  ).trim();
  if (explicit) {
    return resolveProductRoute(
      new URL(explicit, window.location.origin).pathname,
    );
  }

  const anchor = element.closest<HTMLAnchorElement>("a[href]");
  if (!anchor) return null;
  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin) return null;
  return resolveProductRoute(url.pathname);
}

export default function ProductAnalyticsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation();
  const { user } = useAuth();
  const { program } = useProgram();
  const route = useMemo(
    () => resolveProductRoute(location.pathname),
    [location.pathname],
  );
  const enabled = Boolean(
    user
    && route
    && program?.feature_flags?.product_usage_analytics_enabled === true,
  );
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !route) {
      setViewId(null);
      return;
    }
    const nextViewId = crypto.randomUUID();
    setViewId(nextViewId);
    trackProductUsage({
      event_type: "screen_view",
      view_id: nextViewId,
      feature_id: route.featureId,
      screen_id: route.screenId,
      surface: route.surface,
      route_template: route.routeTemplate,
    });

    let remainingMs = 10_000;
    let visibleSince = document.visibilityState === "visible" ? performance.now() : null;
    let timer: number | null = null;
    const arm = () => {
      if (visibleSince === null || timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        trackProductUsage({
          event_type: "screen_engaged",
          view_id: nextViewId,
          feature_id: route.featureId,
          screen_id: route.screenId,
          surface: route.surface,
          route_template: route.routeTemplate,
        });
      }, remainingMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        visibleSince = performance.now();
        arm();
        return;
      }
      if (visibleSince !== null) {
        remainingMs -= performance.now() - visibleSince;
      }
      visibleSince = null;
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    arm();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [enabled, route]);

  const contextValue = useMemo(
    () => ({ enabled, route, viewId }),
    [enabled, route, viewId],
  );

  useEffect(() => {
    if (!enabled || !viewId || !route) return;

    const impressionTimers = new WeakMap<Element, number>();
    const pendingTimers = new Set<number>();
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target;
          const existingTimer = impressionTimers.get(element);
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
            if (existingTimer !== undefined) {
              window.clearTimeout(existingTimer);
              impressionTimers.delete(element);
              pendingTimers.delete(existingTimer);
            }
            return;
          }
          if (seen.has(element) || existingTimer !== undefined) return;
          const timer = window.setTimeout(() => {
            pendingTimers.delete(timer);
            const destination = destinationFor(element);
            if (!destination) return;
            seen.add(element);
            trackProductUsage({
              event_type: "cta_impression",
              view_id: viewId,
              feature_id: destination.featureId,
              screen_id: route.screenId,
              surface: route.surface,
              route_template: route.routeTemplate,
              cta_id: `navigate.${destination.featureId}`,
              placement_id: placementFor(element),
              position_index: positionFor(element),
            });
          }, 500);
          impressionTimers.set(element, timer);
          pendingTimers.add(timer);
        });
      },
      { threshold: [0.5] },
    );

    const observeLinks = () => {
      document.querySelectorAll<HTMLElement>(
        TRACKED_DESTINATION_SELECTOR,
      ).forEach((element) => {
        try {
          if (destinationFor(element)) observer.observe(element);
        } catch {
          // Ignore malformed third-party hrefs.
        }
      });
    };
    const mutationObserver = new MutationObserver(observeLinks);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    observeLinks();

    const onClick = (event: MouseEvent) => {
      const element = (event.target as Element | null)?.closest<HTMLElement>(
        TRACKED_DESTINATION_SELECTOR,
      );
      if (!element) return;
      let destination: ProductRoute | null;
      try {
        destination = destinationFor(element);
      } catch {
        return;
      }
      if (!destination) return;
      trackProductUsage({
        event_type: "cta_click",
        view_id: viewId,
        interaction_id: crypto.randomUUID(),
        feature_id: destination.featureId,
        screen_id: route.screenId,
        surface: route.surface,
        route_template: route.routeTemplate,
        cta_id: `navigate.${destination.featureId}`,
        placement_id: placementFor(element),
        position_index: positionFor(element),
      });
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      mutationObserver.disconnect();
      observer.disconnect();
      pendingTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [enabled, route, viewId]);

  return (
    <ProductAnalyticsContext.Provider value={contextValue}>
      {children}
    </ProductAnalyticsContext.Provider>
  );
}

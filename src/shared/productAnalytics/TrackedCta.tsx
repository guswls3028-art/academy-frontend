import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type MouseEvent,
} from "react";
import { trackProductUsage } from "./client";
import { useProductAnalyticsView } from "./context";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  ctaId: string;
  placementId: string;
  positionIndex?: number;
};

export default function TrackedCta({
  ctaId,
  placementId,
  positionIndex,
  onClick,
  ...buttonProps
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const { enabled, route, viewId } = useProductAnalyticsView();

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !route || !viewId || !element) return;
    let timer: number | null = null;
    let sent = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.5) {
          if (timer !== null) window.clearTimeout(timer);
          timer = null;
          return;
        }
        if (sent || timer !== null) return;
        timer = window.setTimeout(() => {
          sent = true;
          trackProductUsage({
            event_type: "cta_impression",
            view_id: viewId,
            feature_id: route.featureId,
            screen_id: route.screenId,
            surface: route.surface,
            route_template: route.routeTemplate,
            cta_id: ctaId,
            placement_id: placementId,
            position_index: positionIndex,
          });
        }, 500);
      },
      { threshold: [0.5] },
    );
    observer.observe(element);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [ctaId, enabled, placementId, positionIndex, route, viewId]);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (enabled && route && viewId) {
      trackProductUsage({
        event_type: "cta_click",
        view_id: viewId,
        interaction_id: crypto.randomUUID(),
        feature_id: route.featureId,
        screen_id: route.screenId,
        surface: route.surface,
        route_template: route.routeTemplate,
        cta_id: ctaId,
        placement_id: placementId,
        position_index: positionIndex,
      });
    }
    onClick?.(event);
  };

  return <button ref={ref} {...buttonProps} onClick={handleClick} />;
}

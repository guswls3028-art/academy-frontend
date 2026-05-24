import { Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";

import RouteFallback from "./RouteFallback";

export function renderLazyRoute(
  Component: LazyExoticComponent<ComponentType>,
  fallback: ReactNode = <RouteFallback />,
) {
  return (
    <Suspense fallback={fallback}>
      <Component />
    </Suspense>
  );
}

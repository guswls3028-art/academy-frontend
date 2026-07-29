import { createContext, useContext } from "react";
import type { ProductRoute } from "./types";

export type ProductAnalyticsViewContext = {
  enabled: boolean;
  route: ProductRoute | null;
  viewId: string | null;
};

export const ProductAnalyticsContext =
  createContext<ProductAnalyticsViewContext>({
    enabled: false,
    route: null,
    viewId: null,
  });

export function useProductAnalyticsView(): ProductAnalyticsViewContext {
  return useContext(ProductAnalyticsContext);
}

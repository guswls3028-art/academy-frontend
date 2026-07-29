import { useCallback } from "react";
import { isApiError } from "@/shared/api/axios";
import { trackProductUsage } from "./client";
import { useProductAnalyticsView } from "./context";
import type { ProductAnalyticsFailure } from "./types";

function failureCategory(error: unknown): ProductAnalyticsFailure {
  if (!isApiError(error)) return "unknown";
  if (!error.response) return "network";
  if (error.response.status === 400 || error.response.status === 422) {
    return "validation";
  }
  if (error.response.status === 401 || error.response.status === 403) {
    return "permission";
  }
  return "server";
}

export function useTrackedTask() {
  const { enabled, route, viewId } = useProductAnalyticsView();

  return useCallback(
    async function runTrackedTask<T>(
      actionId: string,
      operation: () => Promise<T>,
    ): Promise<T> {
      if (!enabled || !route || !viewId) return operation();
      const interactionId = crypto.randomUUID();
      const common = {
        view_id: viewId,
        interaction_id: interactionId,
        feature_id: route.featureId,
        screen_id: route.screenId,
        surface: route.surface,
        route_template: route.routeTemplate,
        action_id: actionId,
      } as const;
      trackProductUsage({ ...common, event_type: "task_start" });
      try {
        const result = await operation();
        trackProductUsage({ ...common, event_type: "task_success" });
        return result;
      } catch (error) {
        trackProductUsage({
          ...common,
          event_type: "task_failure",
          failure_category: failureCategory(error),
        });
        throw error;
      }
    },
    [enabled, route, viewId],
  );
}

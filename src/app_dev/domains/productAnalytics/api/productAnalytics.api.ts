import api from "@/shared/api/axios";

export type ProductAnalyticsFilters = {
  days: 7 | 28 | 90;
  tenantId?: number;
  role?: string;
  surface?: string;
};

export type ProductAnalyticsFeature = {
  feature_id: string;
  unique_actors: number;
  visits: number;
  engaged: number;
  engagement_rate: number | null;
  starts: number;
  successes: number;
  completion_rate: number | null;
  failures: number;
  failure_rate: number | null;
  last_observed_at: string | null;
};

export type ProductAnalyticsCta = {
  feature_id: string;
  cta_id: string;
  placement_id: string;
  position_index: number;
  impressions: number;
  clicks: number;
  click_rate: number | null;
  unique_actors: number;
};

export type ProductAnalyticsOverview = {
  period: {
    days: number;
    start: string;
    end: string;
  };
  filters: {
    tenant_id: number | null;
    role: string | null;
    surface: string | null;
  };
  suppressed: boolean;
  summary: {
    active_actors: number | null;
    screen_views: number | null;
    engagement_rate: number | null;
    task_completion_rate: number | null;
    task_failure_rate: number | null;
    last_observed_at: string | null;
  };
  features: ProductAnalyticsFeature[];
  ctas: ProductAnalyticsCta[];
  roles: Array<{
    role: string;
    active_actors: number;
    event_count: number;
  }>;
  quality: {
    raw_events: number;
    synthetic_events: number;
    impersonated_events: number;
    last_received_at: string | null;
  };
};

export async function getProductAnalyticsOverview(
  filters: ProductAnalyticsFilters,
): Promise<ProductAnalyticsOverview> {
  const res = await api.get<ProductAnalyticsOverview>(
    "/core/dev/product-analytics/overview/",
    {
      params: {
        days: filters.days,
        tenant_id: filters.tenantId,
        role: filters.role || undefined,
        surface: filters.surface || undefined,
      },
    },
  );
  return res.data;
}

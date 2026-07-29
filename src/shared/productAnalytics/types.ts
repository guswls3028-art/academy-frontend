import type { TenantRole } from "@/auth/context/AuthContext";

export type ProductAnalyticsSurface = "admin" | "teacher" | "student";
export type ProductAnalyticsDevice = "mobile" | "tablet" | "desktop";
export type ProductAnalyticsEventType =
  | "screen_view"
  | "screen_engaged"
  | "cta_impression"
  | "cta_click"
  | "task_start"
  | "task_success"
  | "task_failure";
export type ProductAnalyticsFailure =
  | "validation"
  | "network"
  | "permission"
  | "server"
  | "unknown";

export type ProductFeature = {
  featureId: string;
  label: string;
  domain: string;
  audiences: TenantRole[];
  expectedFrequency: "daily" | "weekly" | "monthly" | "rare";
  strategicPriority: "core" | "support" | "optional";
  status: "active" | "retired";
};

export type ProductRoute = {
  routeTemplate: string;
  featureId: string;
  screenId: string;
  surface: ProductAnalyticsSurface;
};

export type ProductUsageEvent = {
  event_id: string;
  event_type: ProductAnalyticsEventType;
  occurred_at: string;
  session_id: string;
  view_id: string;
  interaction_id?: string;
  feature_id: string;
  screen_id: string;
  surface: ProductAnalyticsSurface;
  route_template: string;
  cta_id?: string;
  action_id?: string;
  placement_id?: string;
  position_index?: number;
  failure_category?: ProductAnalyticsFailure;
  device_class: ProductAnalyticsDevice;
  client_release: string;
  catalog_version: string;
  synthetic: boolean;
};

export type ProductUsageInput = Omit<
  ProductUsageEvent,
  | "event_id"
  | "occurred_at"
  | "session_id"
  | "device_class"
  | "client_release"
  | "catalog_version"
  | "synthetic"
>;

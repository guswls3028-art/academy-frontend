// PATH: src/shared/ui/asyncStatus/workboxTelemetry.ts
// Structured telemetry for Workbox. HIGH severity for tenant mismatch.

const PREFIX = "[workbox]";

type WorkboxTelemetryPayload =
  | {
      taskId: string;
      taskTenantScope: string | null;
      currentTenantKey: string;
    }
  | { taskId: string; status: string }
  | { taskId: string; from: string; to: string }
  | { taskId: string; jobType: string };

declare global {
  interface Window {
    __WORKBOX_DEBUG__?: boolean;
    __WORKBOX_TELEMETRY__?: (event: string, payload: WorkboxTelemetryPayload) => void;
  }
}

function isDebugEnabled(): boolean {
  return import.meta.env.DEV && typeof window !== "undefined" && window.__WORKBOX_DEBUG__ === true;
}

export function workboxTenantMismatch(payload: {
  taskId: string;
  taskTenantScope: string | null;
  currentTenantKey: string;
}): void {
  try {
    console.warn(PREFIX, "workbox_tenant_mismatch", payload);
    if (typeof window !== "undefined" && typeof window.__WORKBOX_TELEMETRY__ === "function") {
      window.__WORKBOX_TELEMETRY__("workbox_tenant_mismatch", payload);
    }
  } catch {
    // no-op
  }
}

export function workboxTaskRendered(payload: { taskId: string; status: string }): void {
  try {
    if (isDebugEnabled()) {
      console.info(PREFIX, "workbox_task_rendered", payload);
    }
  } catch {
    // no-op
  }
}

export function workboxTaskStatusChanged(payload: {
  taskId: string;
  from: string;
  to: string;
}): void {
  try {
    if (isDebugEnabled()) {
      console.info(PREFIX, "workbox_task_status_changed", payload);
    }
  } catch {
    // no-op
  }
}

export function workboxRetryClicked(payload: { taskId: string; jobType: string }): void {
  try {
    if (isDebugEnabled()) {
      console.info(PREFIX, "workbox_retry_clicked", payload);
    }
  } catch {
    // no-op
  }
}

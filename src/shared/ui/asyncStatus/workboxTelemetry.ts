// PATH: src/shared/ui/asyncStatus/workboxTelemetry.ts
// Structured telemetry for Workbox. HIGH severity for tenant mismatch.

const PREFIX = "[workbox]";

export function workboxTenantMismatch(payload: {
  taskId: string;
  taskTenantScope: string | null;
  currentTenantKey: string;
}): void {
  try {
    console.warn(PREFIX, "workbox_tenant_mismatch", payload);
    if (typeof (window as any).__WORKBOX_TELEMETRY__ === "function") {
      (window as any).__WORKBOX_TELEMETRY__("workbox_tenant_mismatch", payload);
    }
  } catch {
    // no-op
  }
}

export function workboxTaskRendered(payload: { taskId: string; status: string }): void {
  try {
    if (import.meta.env.DEV && (window as any).__WORKBOX_DEBUG__) {
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
    if (import.meta.env.DEV && (window as any).__WORKBOX_DEBUG__) {
      console.info(PREFIX, "workbox_task_status_changed", payload);
    }
  } catch {
    // no-op
  }
}

export function workboxRetryClicked(payload: { taskId: string; jobType: string }): void {
  try {
    if (import.meta.env.DEV && (window as any).__WORKBOX_DEBUG__) {
      console.info(PREFIX, "workbox_retry_clicked", payload);
    }
  } catch {
    // no-op
  }
}

import api from "@/shared/api/axios";
import { sanitizeObservabilityPath } from "@/shared/lib/sentryContext";

const AUTO_REPORT_DEDUP_MS = 15 * 60_000;
const AUTO_REPORT_CONFIRM_MS = 5 * 60_000;

type UserIncidentPayload = {
  source: "manual" | "frontend_exception";
  message: string;
  route: string;
  errorName?: string;
  sentryEventId?: string;
  screenSize?: string;
};

function autoReportKey(route: string, errorName: string): string {
  const raw = `${route}|${errorName}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `user-incident:${Math.abs(hash)}`;
}

type AutoReportState = {
  firstSeenAt: number;
  lastSentAt: number;
};

function reserveAutoReport(
  route: string,
  errorName: string,
  confirmedPersistent: boolean,
): string | null {
  const key = autoReportKey(route, errorName);
  try {
    const now = Date.now();
    const stored = JSON.parse(sessionStorage.getItem(key) || "null") as AutoReportState | null;
    const firstSeenAt = Number(stored?.firstSeenAt || 0);
    const lastSentAt = Number(stored?.lastSentAt || 0);
    if (Number.isFinite(lastSentAt) && now - lastSentAt < AUTO_REPORT_DEDUP_MS) {
      return null;
    }
    if (
      !confirmedPersistent
      && (!Number.isFinite(firstSeenAt) || now - firstSeenAt > AUTO_REPORT_CONFIRM_MS)
    ) {
      sessionStorage.setItem(key, JSON.stringify({ firstSeenAt: now, lastSentAt: 0 }));
      return null;
    }
    sessionStorage.setItem(key, JSON.stringify({ firstSeenAt: now, lastSentAt: now }));
  } catch {
    // 저장소를 쓸 수 없으면 명시적으로 지속 오류로 확인된 경로만 제출한다.
    return confirmedPersistent ? key : null;
  }
  return key;
}

export async function submitUserIncident(payload: UserIncidentPayload): Promise<void> {
  await api.post(
    "/core/problem-reports/",
    {
      source: payload.source,
      message: payload.message.slice(0, 1000),
      route: sanitizeObservabilityPath(payload.route),
      error_name: (payload.errorName || "").slice(0, 100),
      sentry_event_id: (payload.sentryEventId || "").slice(0, 64),
      screen_size: (payload.screenSize || "").slice(0, 16),
    },
    { timeout: 10_000 },
  );
}

export function reportClientException(
  errorName: string,
  options: {
    route?: string;
    sentryEventId?: string;
    confirmedPersistent?: boolean;
  } = {},
): void {
  const route = sanitizeObservabilityPath(
    options.route || (typeof window !== "undefined" ? window.location.href : "/unknown"),
  );
  const safeErrorName = String(errorName || "Error").slice(0, 100);
  const reservationKey = reserveAutoReport(
    route,
    safeErrorName,
    options.confirmedPersistent === true,
  );
  if (!reservationKey) return;

  void submitUserIncident({
    source: "frontend_exception",
    message: "사용자 화면에서 처리되지 않은 오류가 발생했습니다.",
    route,
    errorName: safeErrorName,
    sentryEventId: options.sentryEventId,
    screenSize:
      typeof window !== "undefined"
        ? `${window.innerWidth}x${window.innerHeight}`
        : undefined,
  }).catch(() => {
    try {
      sessionStorage.setItem(
        reservationKey,
        JSON.stringify({ firstSeenAt: Date.now(), lastSentAt: 0 }),
      );
    } catch {
      // ignore
    }
    // 오류 보고 실패가 원래 사용자 오류를 덮거나 재귀 보고를 만들면 안 된다.
  });
}

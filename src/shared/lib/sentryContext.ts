// PATH: src/shared/lib/sentryContext.ts
// Sentry 사용자 컨텍스트 및 API 에러 추적 유틸리티

import * as Sentry from "@sentry/react";

/**
 * 로그인 성공 시 Sentry에 사용자 컨텍스트 설정.
 * Sentry 대시보드에서 "이 에러를 겪은 유저가 누구인지" 바로 확인 가능.
 */
export function setSentryUser(user: {
  id: number;
  username: string;
  name: string | null;
  tenantRole: string | null;
}) {
  Sentry.setUser({
    id: String(user.id),
    username: user.username,
    // Sentry의 segment 필드를 role로 활용
    segment: user.tenantRole || "unknown",
  });
  Sentry.setTag("user.role", user.tenantRole || "unknown");
  Sentry.setTag("user.name", user.name || "unknown");
}

/** 로그아웃 시 Sentry 사용자 컨텍스트 제거 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * API 에러를 Sentry에 이벤트로 전송.
 * throw된 에러가 아닌 4xx/5xx 응답도 추적하기 위함.
 */
export function captureApiError(
  method: string,
  url: string,
  status: number,
  responseData?: unknown,
) {
  // 401/403은 인증 흐름에서 정상 처리되므로 별도 이벤트 불필요 (breadcrumb만)
  if (status === 401 || status === 403) {
    Sentry.addBreadcrumb({
      category: "api",
      message: `${method.toUpperCase()} ${url} → ${status}`,
      level: "warning",
      data: { status },
    });
    return;
  }

  // 4xx/5xx → Sentry 이벤트 전송
  const detail =
    typeof responseData === "object" && responseData !== null
      ? (responseData as Record<string, unknown>).detail ||
        (responseData as Record<string, unknown>).message ||
        JSON.stringify(responseData).slice(0, 500)
      : String(responseData || "");

  Sentry.captureMessage(`API ${status}: ${method.toUpperCase()} ${url}`, {
    level: status >= 500 ? "error" : "warning",
    tags: {
      "api.method": method.toUpperCase(),
      "api.status": String(status),
    },
    contexts: {
      api: {
        url,
        method: method.toUpperCase(),
        status,
        response_detail: String(detail).slice(0, 1000),
      },
    },
  });
}

/**
 * 네비게이션 breadcrumb 수동 추가.
 * React Router의 경로 변경을 Sentry에 기록하여 "유저가 어디서 에러를 만났는지" 추적.
 */
export function addNavigationBreadcrumb(from: string, to: string) {
  Sentry.addBreadcrumb({
    category: "navigation",
    message: `${from} → ${to}`,
    level: "info",
    data: { from, to },
  });
}

// PATH: src/shared/lib/sentryContext.ts
// Sentry 사용자 컨텍스트 및 API 에러 추적 유틸리티

import * as Sentry from "@sentry/react";

/**
 * 로그인 성공 시 Sentry에 사용자 컨텍스트 설정.
 * PII 없이 내부 ID와 역할만 기록한다. username/name은 휴대폰 번호나 학생명을
 * 포함할 수 있으므로 observability 외부 경계로 보내지 않는다.
 */
export function setSentryUser(user: {
  id: number;
  username: string;
  name: string | null;
  tenantRole: string | null;
}) {
  Sentry.setUser({
    id: String(user.id),
    // Sentry의 segment 필드를 role로 활용
    segment: user.tenantRole || "unknown",
  });
  Sentry.setTag("user.role", user.tenantRole || "unknown");
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
) {
  const safeUrl = sanitizeObservabilityPath(url);
  // 401/403은 인증 흐름에서 정상 처리되므로 별도 이벤트 불필요 (breadcrumb만)
  if (status === 401 || status === 403) {
    Sentry.addBreadcrumb({
      category: "api",
      message: `${method.toUpperCase()} ${safeUrl} → ${status}`,
      level: "warning",
      data: { status },
    });
    return;
  }

  // 응답 본문에는 이름·전화번호·점수 등이 포함될 수 있어 외부 observability로 전송하지 않는다.
  Sentry.captureMessage(`API ${status}: ${method.toUpperCase()} ${safeUrl}`, {
    level: status >= 500 ? "error" : "warning",
    tags: {
      "api.method": method.toUpperCase(),
      "api.status": String(status),
    },
    contexts: {
      api: {
        url: safeUrl,
        method: method.toUpperCase(),
        status,
      },
    },
  });
}

export function sanitizeObservabilityPath(url: string): string {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    return pathname
      .replace(/\b\d+\b/g, ":id")
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":uuid");
  } catch {
    return String(url || "unknown").split("?", 1)[0].slice(0, 200);
  }
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

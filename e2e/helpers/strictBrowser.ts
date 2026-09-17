/**
 * E2E 엄격 기본값: 콘솔 error + 미처리 pageerror 는 허용 목록 외 전부 실패.
 * (API/스모크만으로 완료 불인정 — 브라우저에서 버그 없음이 기본 가정)
 *
 * ── 모드 제어 (E2E_STRICT env) ──
 *   strict (기본, 미설정/1/strict) — defect 발견 시 테스트 실패
 *   report (report/warn)          — defect 발견 시 console.warn + 주석만, fail X
 *   off    (0/off/disable)        — 리스너 미부착 (전역 비활성)
 *
 * 대량 마이그레이션 과정에서 숨은 defect을 먼저 관찰하려면
 * `.env.e2e` 에 `E2E_STRICT=report` 로 시작하고, 안정화 후 `strict` 로 전환.
 */
import { expect, test as baseTest, type Page } from "@playwright/test";

const DEFAULT_IGNORE: RegExp[] = [
  /chrome-extension:/i,
  /moz-extension:/i,
  /ResizeObserver loop/i,
  // 4xx/5xx 네트워크 응답에 대한 브라우저 기본 console.error.
  // 응답 status 자체는 spec logic 의 expect(resp.status) 가 검증하므로
  // 콘솔 stream 에서는 무시. (404/403 회귀는 spec 의 expect 로 잡음)
  /Failed to load resource: the server responded with a status/i,
  // React DevTools 설치 권유 메시지 (dev/preview 환경)
  /Download the React DevTools/i,
  // Cloudflare Network Error Logging beacon 실패 — 운영 의존 아님
  /cf-nel/i,
  // 배포 직후 구 HTML이 새 배포에서 사라진 chunk를 참조할 때 브라우저가 먼저 남기는
  // recoverable console error. 앱은 ErrorBoundary/lazyWithRetry에서 cache-bust reload로 회수한다.
  /Importing a module script failed/i,
  /LAZY_DEFAULT_UNDEFINED/i,
  // WebKit은 페이지 전환/종료 중 취소된 same-site credential fetch를 pageerror로 보고한다.
  // 실제 성공/실패는 각 spec의 API response/state assertion에서 검증한다.
  /^\/(?:api\.)?hakwonplus\.com\/.* due to access control checks\.$/i,
  // iframe sandbox 정당한 동작 — about:srcdoc 안에서 'allow-scripts' 미설정은
  // 의도된 보안 조치. 페이지 내 iframe 미리보기/embed (메시지 미리보기 등) 시 발생.
  // spec logic 과 무관, sandbox 자체가 보안 기능.
  /Blocked script execution in 'about:srcdoc'/i,
];

const TRANSIENT_PRODUCTION_CORS_ENDPOINTS: RegExp[] = [
  /https:\/\/api\.hakwonplus\.com\/api\/v1\/clinic\/participants\/\?[^']*\bstatus=pending\b/i,
  /https:\/\/api\.hakwonplus\.com\/api\/v1\/community\/admin\/posts\/\?[^']*\bpost_type=(?:qna|counsel)\b/i,
  /https:\/\/api\.hakwonplus\.com\/api\/v1\/community\/admin\/reports\/pending-count\//i,
  /https:\/\/api\.hakwonplus\.com\/api\/v1\/community\/notifications\/unread-count\//i,
  /https:\/\/api\.hakwonplus\.com\/api\/v1\/core\/landing\/admin\/consult\//i,
  /https:\/\/api\.hakwonplus\.com\/api\/v1\/results\/admin\/clinic-targets\//i,
  /https:\/\/api\.hakwonplus\.com\/api\/v1\/results\/admin\/teacher-dashboard-counts\//i,
  /https:\/\/api\.hakwonplus\.com\/api\/v1\/students\/registration_requests\/\?[^']*\bstatus=pending\b/i,
  /https:\/\/api\.hakwonplus\.com\/api\/v1\/submissions\/submissions\/pending\/\?[^']*\bfilter=pending\b/i,
];

type Mode = "strict" | "report" | "off";

function resolveMode(): Mode {
  const raw = (process.env.E2E_STRICT || "").toLowerCase();
  if (raw === "off" || raw === "0" || raw === "disable" || raw === "disabled") return "off";
  if (raw === "report" || raw === "warn") return "report";
  return "strict";
}

function allowed(text: string, extra: RegExp[]): boolean {
  return [...DEFAULT_IGNORE, ...extra].some((re) => re.test(text));
}

function isOptionalNotificationCors(text: string): boolean {
  return /Access to XMLHttpRequest .* has been blocked by CORS policy: No 'Access-Control-Allow-Origin'/i.test(text) &&
    TRANSIENT_PRODUCTION_CORS_ENDPOINTS.some((re) => re.test(text));
}

function isFailedResourceFromBlockedCors(text: string): boolean {
  return /^Failed to load resource: net::ERR_FAILED$/i.test(text.trim());
}

function isNeutralizedCloudflareBeaconIntegrity(text: string): boolean {
  return /^Failed to find a valid digest in the 'integrity' attribute for resource 'https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\/v[a-f0-9]{32,64}' with computed SHA-512 integrity '[A-Za-z0-9+/]{86}=='\. The resource has been blocked\.$/.test(text);
}

type DefectCategory = "net-err" | "cors" | "chunk" | "resource" | "runtime" | "other";
type DefectSource = "local" | "api" | "vendor" | "unknown";

// Classifies only into a closed, fixed vocabulary -- never the raw message --
// so this is safe to publish in release evidence (see emit() below).
function classifyDefectCategory(text: string): DefectCategory {
  if (/cors|access-control-allow-origin/i.test(text)) return "cors";
  if (/importing a module script failed|dynamically imported module|lazy_default_undefined/i.test(text)) return "chunk";
  if (/net::|failed to fetch|socket hang up|ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|network error/i.test(text)) return "net-err";
  if (/failed to load resource/i.test(text)) return "resource";
  if (/TypeError|ReferenceError|SyntaxError|RangeError/i.test(text)) return "runtime";
  return "other";
}

function classifyDefectSource(url: string | null, pageOrigin: string | null, apiOrigin: string | null): DefectSource {
  if (!url) return "unknown";
  try {
    const parsed = new URL(url);
    if (pageOrigin && parsed.origin === pageOrigin) return "local";
    // apiOrigin covers both production (https://api.hakwonplus.com) and the
    // development tunnel (http://127.0.0.1:<port>), which the "api." hostname
    // prefix alone would miss.
    if (apiOrigin && parsed.origin === apiOrigin) return "api";
    if (/^api\./i.test(parsed.hostname)) return "api";
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return "vendor";
  } catch { /* unparsable location -- unknown */ }
  return "unknown";
}

export type StrictBrowserGuards = {
  /** 누적 콘솔 error·pageerror 가 허용 목록 외 있으면 모드에 따라 실패/경고 */
  assertZeroDefects: () => void;
};

/**
 * 페이지에 리스너 부착. 테스트 종료 전 반드시 assertZeroDefects 호출.
 */
export function attachStrictBrowserGuards(
  page: Page,
  options?: {
    extraIgnore?: RegExp[];
    allowRecoveredProductionCors?: boolean;
    allowNeutralizedCloudflareBeaconIntegrity?: boolean;
    emit?: (value: unknown) => void;
    apiOrigin?: string;
    recoveredTransportCount?: () => number;
  }
): StrictBrowserGuards {
  const mode = resolveMode();
  if (mode === "off") {
    return { assertZeroDefects() { /* noop */ } };
  }

  const emit = options?.emit ?? ((value: unknown) => console.log(JSON.stringify(value)));
  const extra = options?.extraIgnore ?? [];
  const consoleErrors: Array<{ text: string; url: string | null }> = [];
  const pageErrors: string[] = [];
  const recoverableCorsFailures: Array<{
    url: string;
    origin: string;
    consoleText: string;
    resourceFailureText: string | null;
    recovered: boolean;
    observedAt: number;
  }> = [];
  let pendingOptionalCorsResourceFailures = 0;
  let lastOptionalCorsAt = 0;

  if (options?.allowRecoveredProductionCors) {
    page.on("response", (response) => {
      const failure = [...recoverableCorsFailures]
        .reverse()
        .find((candidate) => !candidate.recovered && candidate.url === response.url());
      if (!failure || response.status() !== 200) return;
      const allowOrigin = response.headers()["access-control-allow-origin"]?.trim();
      if (allowOrigin === failure.origin) failure.recovered = true;
    });
  }

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (pendingOptionalCorsResourceFailures > 0 && Date.now() - lastOptionalCorsAt > 5_000) {
      pendingOptionalCorsResourceFailures = 0;
    }
    const recoveredCorsMatch = options?.allowRecoveredProductionCors
      ? text.match(/^Access to XMLHttpRequest at '([^']+)' from origin '(https:\/\/hakwonplus\.com)' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource\.?$/i)
      : null;
    if (recoveredCorsMatch) {
      const requestUrl = new URL(recoveredCorsMatch[1]!);
      if (requestUrl.protocol === "https:" && requestUrl.hostname === "api.hakwonplus.com") {
        recoverableCorsFailures.push({
          url: requestUrl.href,
          origin: recoveredCorsMatch[2]!,
          consoleText: text,
          resourceFailureText: null,
          recovered: false,
          observedAt: Date.now(),
        });
        return;
      }
    }
    if (options?.allowRecoveredProductionCors && isFailedResourceFromBlockedCors(text)) {
      const failure = [...recoverableCorsFailures]
        .reverse()
        .find((candidate) => candidate.resourceFailureText === null && Date.now() - candidate.observedAt <= 5_000);
      if (failure) {
        failure.resourceFailureText = text;
        return;
      }
    }
    if (!options?.allowRecoveredProductionCors && isOptionalNotificationCors(text)) {
      pendingOptionalCorsResourceFailures += 1;
      lastOptionalCorsAt = Date.now();
      return;
    }
    if (pendingOptionalCorsResourceFailures > 0 && isFailedResourceFromBlockedCors(text)) {
      pendingOptionalCorsResourceFailures -= 1;
      return;
    }
    if (options?.allowNeutralizedCloudflareBeaconIntegrity && isNeutralizedCloudflareBeaconIntegrity(text)) return;
    if (allowed(text, extra)) return;
    let url: string | null = null;
    try { url = msg.location()?.url || null; } catch { /* best-effort only */ }
    consoleErrors.push({ text, url });
  });

  page.on("pageerror", (err) => {
    const text = err.message;
    if (allowed(text, extra)) return;
    pageErrors.push(text);
  });

  return {
    assertZeroDefects() {
      const unresolvedRecoveredCors = recoverableCorsFailures.filter(
        (failure) => !failure.recovered || failure.resourceFailureText === null,
      );
      const entries = [
        ...consoleErrors.map((c) => ({ text: c.text, url: c.url, line: `console.error: ${c.text}` })),
        ...pageErrors.map((p) => ({ text: p, url: null as string | null, line: `pageerror: ${p}` })),
        ...unresolvedRecoveredCors.flatMap((failure) => [
          { text: failure.consoleText, url: failure.url, line: `console.error: ${failure.consoleText}` },
          ...(failure.resourceFailureText
            ? [{ text: failure.resourceFailureText, url: failure.url, line: `console.error: ${failure.resourceFailureText}` }]
            : []),
        ]),
      ];
      if (entries.length === 0) return;

      // PII-free classification of what tripped the gate: a fixed vocabulary
      // (category/source) plus a count, never the raw message. This lets the
      // release canary distinguish e.g. a recovered-transport side effect
      // from a genuine app regression without exposing any page content.
      let pageOrigin: string | null = null;
      try { pageOrigin = new URL(page.url()).origin; } catch { /* about:blank etc. */ }
      const apiOrigin = options?.apiOrigin ?? null;
      const classified = entries.map((entry) => ({ ...entry,
        category: classifyDefectCategory(entry.text), source: classifyDefectSource(entry.url, pageOrigin, apiOrigin) }));
      const defectCounts = new Map<string, number>();
      for (const { category, source } of classified) {
        const key = `${category}:${source}`;
        defectCounts.set(key, (defectCounts.get(key) ?? 0) + 1);
      }
      for (const [key, count] of defectCounts) {
        const [category, source] = key.split(":") as [DefectCategory, DefectSource];
        emit({ releaseStrictBrowserDefect: { schema: "strict-browser-defect/v1", category, source, count } });
      }

      // A route-fetch retry that recovers the request still leaves the
      // browser's own first-attempt net::ERR_* console.error behind -- that
      // is harness (SSM tunnel) noise, not a product defect: the app already
      // received a successful response. Absorb up to exactly as many net-err/
      // api defects as this context itself recovered at the transport level
      // (never more, so an unrelated regression in the same category still
      // fails), and publish both the absorbed count and the cap so this
      // stays auditable.
      const recoveredTransportCap = Math.max(0, Math.trunc(options?.recoveredTransportCount?.() ?? 0));
      let suppressedNetErrDefects = 0;
      const remaining = classified.filter(({ category, source }) => {
        if (category !== "net-err" || source !== "api" || suppressedNetErrDefects >= recoveredTransportCap) return true;
        suppressedNetErrDefects += 1;
        return false;
      });
      if (suppressedNetErrDefects > 0 || recoveredTransportCap > 0) {
        emit({ releaseStrictBrowserSuppression: { schema: "strict-browser-suppression/v1",
          suppressedNetErrDefects, recoveredTransportCount: recoveredTransportCap } });
      }
      const lines = remaining.map((entry) => entry.line);
      if (lines.length === 0) return;

      const body = lines.join("\n---\n");
      if (mode === "report") {
        // fail 없이 관찰 전용 — 테스트 주석 + stderr 경고
        try {
          baseTest.info().annotations.push({
            type: "strict-browser-defect",
            description: body,
          });
        } catch { /* outside test context */ }
        console.warn(`[strict-browser][report] ${lines.length} defect(s):\n${body}`);
        return;
      }

      // strict 모드: 기존 동작
      expect(lines, `브라우저 결함(콘솔 error / pageerror):\n${body}`).toEqual([]);
    },
  };
}

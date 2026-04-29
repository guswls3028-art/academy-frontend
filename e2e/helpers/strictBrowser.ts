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
  // iframe sandbox 정당한 동작 — about:srcdoc 안에서 'allow-scripts' 미설정은
  // 의도된 보안 조치. 페이지 내 iframe 미리보기/embed (메시지 미리보기 등) 시 발생.
  // spec logic 과 무관, sandbox 자체가 보안 기능.
  /Blocked script execution in 'about:srcdoc'/i,
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

export type StrictBrowserGuards = {
  /** 누적 콘솔 error·pageerror 가 허용 목록 외 있으면 모드에 따라 실패/경고 */
  assertZeroDefects: () => void;
};

/**
 * 페이지에 리스너 부착. 테스트 종료 전 반드시 assertZeroDefects 호출.
 */
export function attachStrictBrowserGuards(
  page: Page,
  options?: { extraIgnore?: RegExp[] }
): StrictBrowserGuards {
  const mode = resolveMode();
  if (mode === "off") {
    return { assertZeroDefects() { /* noop */ } };
  }

  const extra = options?.extraIgnore ?? [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (allowed(text, extra)) return;
    consoleErrors.push(text);
  });

  page.on("pageerror", (err) => {
    const text = err.message;
    if (allowed(text, extra)) return;
    pageErrors.push(text);
  });

  return {
    assertZeroDefects() {
      const lines = [
        ...consoleErrors.map((c) => `console.error: ${c}`),
        ...pageErrors.map((p) => `pageerror: ${p}`),
      ];
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
        // eslint-disable-next-line no-console
        console.warn(`[strict-browser][report] ${lines.length} defect(s):\n${body}`);
        return;
      }

      // strict 모드: 기존 동작
      expect(lines, `브라우저 결함(콘솔 error / pageerror):\n${body}`).toEqual([]);
    },
  };
}

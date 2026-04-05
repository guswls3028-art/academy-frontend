/**
 * E2E 엄격 기본값: 콘솔 error + 미처리 pageerror 는 허용 목록 외 전부 실패.
 * (API/스모크만으로 완료 불인정 — 브라우저에서 버그 없음이 기본 가정)
 */
import { expect, type Page } from "@playwright/test";

const DEFAULT_IGNORE: RegExp[] = [
  /chrome-extension:/i,
  /moz-extension:/i,
  /ResizeObserver loop/i,
];

function allowed(text: string, extra: RegExp[]): boolean {
  return [...DEFAULT_IGNORE, ...extra].some((re) => re.test(text));
}

export type StrictBrowserGuards = {
  /** 누적 콘솔 error·pageerror 가 허용 목록 외 있으면 테스트 실패 */
  assertZeroDefects: () => void;
};

/**
 * 페이지에 리스너 부착. 테스트 종료 전 반드시 assertZeroDefects 호출.
 */
export function attachStrictBrowserGuards(
  page: Page,
  options?: { extraIgnore?: RegExp[] }
): StrictBrowserGuards {
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
      expect(lines, `브라우저 결함(콘솔 error / pageerror):\n${lines.join("\n---\n")}`).toEqual([]);
    },
  };
}

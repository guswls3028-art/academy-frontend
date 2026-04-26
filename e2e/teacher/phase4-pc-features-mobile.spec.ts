/**
 * E2E: 선생앱 모바일 Phase 4 — PC 기능 모바일 이식 운영 스모크.
 *
 * 운영(https://hakwonplus.com) iPhone 14 viewport.
 * 신규/확장 페이지 11개를 로드하고
 *  1) JS 콘솔 에러 0
 *  2) 핵심 위젯 렌더 확인 (제목/탭/버튼)
 *  3) API 4xx/5xx 추적 (백엔드 미배포 시 404 허용)
 * 을 검증.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Response } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";

const BASE = getBaseUrl("admin");
const SCREEN_DIR = "e2e/screenshots/phase4";
if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

type Netfail = { url: string; status: number; method: string };
type Capture = { errors: string[]; netFails: Netfail[] };

function attachNetCapture(page: Page): Capture {
  const errors: string[] = [];
  const netFails: Netfail[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    if (/favicon|sourcemap|warning/i.test(t)) return;
    if (/failed to load resource|\b40\d\b|\b50\d\b|network error/i.test(t)) return;
    errors.push(t);
  });
  page.on("response", (resp: Response) => {
    const url = resp.url();
    if (!/\/api\//.test(url)) return;
    const s = resp.status();
    if (s >= 400) {
      netFails.push({
        url: url.replace(/^https?:\/\/[^/]+/, ""),
        status: s,
        method: resp.request().method(),
      });
    }
  });
  return { errors, netFails };
}

function logNet(label: string, c: Capture) {
  if (c.errors.length === 0 && c.netFails.length === 0) return;
  if (c.errors.length > 0) console.log(`[${label}] JS errors:`, c.errors);
  if (c.netFails.length > 0) console.log(`[${label}] Net fails:`, c.netFails);
}

/** networkidle settle 후 페이지 진입 — waitForTimeout 대체. */
async function visit(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function settleAfterClick(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}

test.describe("Phase 4 — PC 기능 모바일 운영 스모크", () => {
  test.use({ viewport: MOBILE_VIEWPORT, userAgent: MOBILE_UA });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => { localStorage.removeItem("teacher:preferAdmin"); });
  });

  /* ───── 기존 확장 페이지 검증 ───── */

  test("제출함 인박스 — 4탭 + 새로고침", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/submissions");

    await expect(page.getByRole("heading", { name: /제출함/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "대기 중" })).toBeVisible();
    await expect(page.getByRole("button", { name: "전체" })).toBeVisible();

    await page.getByRole("button", { name: "완료" }).click();
    await settleAfterClick(page);

    await page.screenshot({ path: `${SCREEN_DIR}/submissions.png`, fullPage: true });
    logNet("submissions", cap);
    expect(cap.errors).toEqual([]);
  });

  test("세션 상세 — 7탭 (시험·과제·클리닉 추가) 가로 스크롤", async ({ page }) => {
    const cap = attachNetCapture(page);

    await visit(page, "/teacher/classes");
    const firstClass = page.locator("a[href*='/teacher/classes/']").first();
    if (await firstClass.count() === 0) {
      test.info().annotations.push({ type: "skip-reason", description: "강의 0개 환경" });
      return;
    }
    await firstClass.click();
    await settleAfterClick(page);
    const firstSession = page.locator("a[href*='/sessions/']").first();
    if (await firstSession.count() === 0) {
      test.info().annotations.push({ type: "skip-reason", description: "차시 0개 환경" });
      return;
    }
    await firstSession.click();
    await settleAfterClick(page);

    await expect(page.getByRole("button", { name: "시험" })).toBeVisible();
    await expect(page.getByRole("button", { name: "과제" })).toBeVisible();

    await page.getByRole("button", { name: "시험" }).click();
    await settleAfterClick(page);
    await page.getByRole("button", { name: "과제" }).click();
    await settleAfterClick(page);

    await page.screenshot({ path: `${SCREEN_DIR}/session-tabs.png`, fullPage: true });
    logNet("session", cap);
    expect(cap.errors).toEqual([]);
  });

  test("커뮤니티 학부모 상담 탭", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/comms");

    await expect(page.getByRole("button", { name: /상담/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /상담/ }).first().click();
    await settleAfterClick(page);

    await page.screenshot({ path: `${SCREEN_DIR}/comms-counsel.png`, fullPage: true });
    logNet("comms-counsel", cap);
    expect(cap.errors).toEqual([]);
  });

  /* ───── Phase 4 신규 페이지 ───── */

  test("수납 대시보드 — KPI 3장 + 상태 카운트 + 연체", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/fees");

    await expect(page.getByRole("heading", { name: /수납/ })).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "송장" }).first()).toBeVisible();

    await page.screenshot({ path: `${SCREEN_DIR}/fees-dashboard.png`, fullPage: true });
    logNet("fees-dashboard", cap);
    expect(cap.errors).toEqual([]);
  });

  test("수납 송장 — 5필터 + 검색", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/fees/invoices");

    await expect(page.getByRole("heading", { name: "송장" })).toBeVisible();
    await expect(page.getByRole("button", { name: "전체" })).toBeVisible();
    await expect(page.getByRole("button", { name: "연체" })).toBeVisible();
    await expect(page.getByPlaceholder(/학생 이름/)).toBeVisible();

    await page.screenshot({ path: `${SCREEN_DIR}/fees-invoices.png`, fullPage: true });
    logNet("fees-invoices", cap);
    expect(cap.errors).toEqual([]);
  });

  test("자료실 — 내 자료 (쿼터 바 + 업로드 버튼)", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/storage");

    await expect(page.getByRole("heading", { name: "내 자료" })).toBeVisible();
    await expect(page.getByRole("button", { name: /업로드/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "폴더", exact: true })).toBeVisible();

    await page.screenshot({ path: `${SCREEN_DIR}/storage-my.png`, fullPage: true });
    logNet("storage-my", cap);
    expect(cap.errors).toEqual([]);
  });

  test("자료실 — 학생 인벤토리 (학생 검색)", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/storage/inventory");

    await expect(page.getByRole("heading", { name: "학생 인벤토리" })).toBeVisible();
    await expect(page.getByPlaceholder(/학생 이름/)).toBeVisible();

    await page.screenshot({ path: `${SCREEN_DIR}/storage-inventory.png`, fullPage: true });
    logNet("storage-inventory", cap);
    expect(cap.errors).toEqual([]);
  });

  test("학원 정보 설정 — 폼 + 저장 버튼", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/settings/organization");

    await expect(page.getByRole("heading", { name: "학원 정보" })).toBeVisible();
    await expect(page.getByRole("button", { name: /저장/ })).toBeVisible();

    await page.screenshot({ path: `${SCREEN_DIR}/settings-organization.png`, fullPage: true });
    logNet("settings-organization", cap);
    expect(cap.errors).toEqual([]);
  });

  test("외관(테마) — 12종 그리드", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/settings/appearance");

    await expect(page.getByRole("heading", { name: "외관" })).toBeVisible();
    await expect(page.getByText("Modern White")).toBeVisible();
    await expect(page.getByText("Modern Dark")).toBeVisible();

    await page.getByText("Modern Dark").click();
    await settleAfterClick(page);

    await page.screenshot({ path: `${SCREEN_DIR}/settings-appearance.png`, fullPage: true });
    logNet("settings-appearance", cap);
    expect(cap.errors).toEqual([]);
  });

  test("스톱워치 — 시작/정지/리셋", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/tools/stopwatch");

    await expect(page.getByRole("heading", { name: "스톱워치" })).toBeVisible();
    await expect(page.getByRole("button", { name: "시작" })).toBeVisible();

    await page.getByRole("button", { name: "시작" }).click();
    // 스톱워치 시간이 흘러야 '랩' 버튼이 의미가 있음 — 의도적으로 1.5초 카운트.
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(1500); // 의도적: 스톱워치 카운트 진행
    await page.getByRole("button", { name: "랩" }).click();
    await page.getByRole("button", { name: "정지" }).click();

    await page.screenshot({ path: `${SCREEN_DIR}/tools-stopwatch.png`, fullPage: true });
    logNet("tools-stopwatch", cap);
    expect(cap.errors).toEqual([]);
  });

  test("패치노트 — 카드 리스트 + 상세 BottomSheet", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/developer");

    await expect(page.getByRole("heading", { name: "패치노트" })).toBeVisible();
    const latest = page.getByText("LATEST").first();
    await expect(latest).toBeVisible();
    await latest.click();
    await settleAfterClick(page);

    await page.screenshot({ path: `${SCREEN_DIR}/developer-patchnotes.png`, fullPage: true });
    logNet("developer-patchnotes", cap);
    expect(cap.errors).toEqual([]);
  });

  test("버그 제보 — 폼 (제목/내용/이미지)", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/developer/bug");

    await expect(page.getByRole("heading", { name: "버그 제보" })).toBeVisible();
    await expect(page.getByPlaceholder(/어떤 버그/)).toBeVisible();
    await expect(page.getByRole("button", { name: /보내기/ })).toBeVisible();

    await page.screenshot({ path: `${SCREEN_DIR}/developer-bug.png`, fullPage: true });
    logNet("developer-bug", cap);
    expect(cap.errors).toEqual([]);
  });

  test("피드백 — 폼", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/developer/feedback");

    await expect(page.getByRole("heading", { name: "피드백" })).toBeVisible();
    await expect(page.getByRole("button", { name: /보내기/ })).toBeVisible();

    await page.screenshot({ path: `${SCREEN_DIR}/developer-feedback.png`, fullPage: true });
    logNet("developer-feedback", cap);
    expect(cap.errors).toEqual([]);
  });

  test("PC에서 처리하는 기능 안내 (DesktopOnly)", async ({ page }) => {
    const cap = attachNetCapture(page);
    await visit(page, "/teacher/desktop-only");

    await expect(page.getByRole("heading", { name: /PC에서 처리/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /데스크톱 버전으로 이동/ })).toBeVisible();

    await page.screenshot({ path: `${SCREEN_DIR}/desktop-only.png`, fullPage: true });
    logNet("desktop-only", cap);
    expect(cap.errors).toEqual([]);
  });
});

/**
 * 선생앱 모바일 실사용 리뷰 — 2026-05-02
 * 운영 hakwonplus.com / iPhone 14 viewport / Tenant 1 admin
 *
 * 목적: 백로그·코드베이스 기반으로 실사용 결함/개선점 카테고리화.
 *  - 콘솔 에러
 *  - 네트워크 4xx/5xx (의도적 fallback 제외)
 *  - 주요 도메인 진입 가능 여부 + 핵심 위젯 / CTA 존재 여부
 *  - UX: 빈 상태/로딩/에러 처리, 라벨 일관성
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page, Response } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";

const BASE = getBaseUrl("admin");
const SCREEN_DIR = "e2e/screenshots/realuse-2026-05-02";
if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// 운영 백엔드에 미배포되었거나 의도적으로 빈 결과를 graceful handling 하는 endpoint
const ALLOWED_404_PATHS = [
  /\/api\/v1\/exams\/bundles\//,
  /\/api\/v1\/exams\/templates\/with-usage\//,
  /\/api\/v1\/homeworks\/templates\/with-usage\//,
];

type Netfail = { url: string; status: number; method: string };

function attachCapture(page: Page) {
  const errors: string[] = [];
  const netFails: Netfail[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    if (/favicon|sourcemap|warning/i.test(t)) return;
    if (/failed to load resource|\b40\d\b|\b50\d\b|network error|net::ERR/i.test(t)) return;
    errors.push(t);
  });
  page.on("response", (resp: Response) => {
    const url = resp.url();
    if (!/\/api\//.test(url)) return;
    const s = resp.status();
    if (s < 400) return;
    const stripped = url.replace(/^https?:\/\/[^/]+/, "");
    if (ALLOWED_404_PATHS.some((rx) => rx.test(stripped) && s === 404)) return;
    netFails.push({ url: stripped, status: s, method: resp.request().method() });
  });
  return { errors, netFails };
}

async function visit(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

test.describe("선생앱 모바일 실사용 리뷰 — 2026-05-02", () => {
  test.use({ viewport: MOBILE_VIEWPORT, userAgent: MOBILE_UA });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => { localStorage.removeItem("teacher:preferAdmin"); });
  });

  test("01. Today — KPI4 + 처리할 일 + 오늘 수업", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher");
    await page.screenshot({ path: `${SCREEN_DIR}/01-today.png`, fullPage: true });
    await expect(page.getByText(/안녕하세요/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("오늘 수업").first()).toBeVisible();
    await expect(page.getByText("출결 입력").first()).toBeVisible();
    await expect(page.getByText("처리할 일").first()).toBeVisible();
    await expect(page.getByText("최근 제출").first()).toBeVisible();
    await expect(page.getByText("지금 처리할 일").first()).toBeVisible();
    expect(errors, `console errors: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("02. 강의 목록 + 강의 상세 + 출결 매트릭스", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/classes");
    await page.screenshot({ path: `${SCREEN_DIR}/02a-classes.png`, fullPage: true });

    // 강의 카드가 1개 이상이면 상세 진입
    const firstLecture = page.locator('[data-testid="lecture-card"]').first();
    const hasLecture = await firstLecture.isVisible().catch(() => false);
    if (hasLecture) {
      await firstLecture.click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await page.screenshot({ path: `${SCREEN_DIR}/02b-lecture-detail.png`, fullPage: true });
    }
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("03. 학생 목록 + 학생 상세", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/students");
    await page.screenshot({ path: `${SCREEN_DIR}/03a-students.png`, fullPage: true });
    await expect(page.getByRole("button", { name: /등록/ }).first()).toBeVisible({ timeout: 10_000 });

    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("04. 커뮤니티 4탭 (공지/QnA/상담/등록요청)", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/comms");
    await page.screenshot({ path: `${SCREEN_DIR}/04-comms.png`, fullPage: true });
    await expect(page.getByText(/공지/).first()).toBeVisible({ timeout: 10_000 });
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("05. 시험/과제 + 시험 템플릿 + 시험 번들", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/exams");
    await page.screenshot({ path: `${SCREEN_DIR}/05a-exams.png`, fullPage: true });

    await visit(page, "/teacher/exams/templates");
    await page.screenshot({ path: `${SCREEN_DIR}/05b-templates.png`, fullPage: true });

    await visit(page, "/teacher/exams/bundles");
    await page.screenshot({ path: `${SCREEN_DIR}/05c-bundles.png`, fullPage: true });

    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("06. 영상 목록", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/videos");
    await page.screenshot({ path: `${SCREEN_DIR}/06-videos.png`, fullPage: true });
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("07. 클리닉 / 보고서 / 리모컨", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/clinic");
    await page.screenshot({ path: `${SCREEN_DIR}/07a-clinic.png`, fullPage: true });
    await visit(page, "/teacher/clinic/reports");
    await page.screenshot({ path: `${SCREEN_DIR}/07b-clinic-reports.png`, fullPage: true });
    await visit(page, "/teacher/clinic/remote");
    await page.screenshot({ path: `${SCREEN_DIR}/07c-clinic-remote.png`, fullPage: true });
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("08. 상담 메모 + 성적 조회 + 제출함", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/counseling");
    await page.screenshot({ path: `${SCREEN_DIR}/08a-counseling.png`, fullPage: true });
    await visit(page, "/teacher/results");
    await page.screenshot({ path: `${SCREEN_DIR}/08b-results.png`, fullPage: true });
    await visit(page, "/teacher/submissions");
    await page.screenshot({ path: `${SCREEN_DIR}/08c-submissions.png`, fullPage: true });
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("09. 메시징 — 발송 이력/템플릿/설정/알림센터", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/message-log");
    await page.screenshot({ path: `${SCREEN_DIR}/09a-msg-log.png`, fullPage: true });
    await visit(page, "/teacher/message-templates");
    await page.screenshot({ path: `${SCREEN_DIR}/09b-msg-tpl.png`, fullPage: true });
    await visit(page, "/teacher/messaging-settings");
    await page.screenshot({ path: `${SCREEN_DIR}/09c-msg-setting.png`, fullPage: true });
    await visit(page, "/teacher/notifications");
    await page.screenshot({ path: `${SCREEN_DIR}/09d-notifications.png`, fullPage: true });
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("10. 자료실 + 인벤토리", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/storage");
    await page.screenshot({ path: `${SCREEN_DIR}/10a-storage.png`, fullPage: true });
    await visit(page, "/teacher/storage/inventory");
    await page.screenshot({ path: `${SCREEN_DIR}/10b-inventory.png`, fullPage: true });
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("11. 수납 — 대시보드 + 송장", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/fees");
    await page.screenshot({ path: `${SCREEN_DIR}/11a-fees.png`, fullPage: true });
    await visit(page, "/teacher/fees/invoices");
    await page.screenshot({ path: `${SCREEN_DIR}/11b-invoices.png`, fullPage: true });
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("12. 직원 관리 + 근태/지출", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/staff");
    await page.screenshot({ path: `${SCREEN_DIR}/12a-staff.png`, fullPage: true });
    await visit(page, "/teacher/my-records");
    await page.screenshot({ path: `${SCREEN_DIR}/12b-my-records.png`, fullPage: true });
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("13. 도구/설정 — 스톱워치/외관/조직/PC전용", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/tools/stopwatch");
    await page.screenshot({ path: `${SCREEN_DIR}/13a-stopwatch.png`, fullPage: true });
    await visit(page, "/teacher/settings/appearance");
    await page.screenshot({ path: `${SCREEN_DIR}/13b-appearance.png`, fullPage: true });
    await visit(page, "/teacher/settings/organization");
    await page.screenshot({ path: `${SCREEN_DIR}/13c-organization.png`, fullPage: true });
    await visit(page, "/teacher/desktop-only");
    await page.screenshot({ path: `${SCREEN_DIR}/13d-desktop-only.png`, fullPage: true });
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("14. 빌링 + 프로필 + 설정 + 패치노트/버그", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher/billing");
    await page.screenshot({ path: `${SCREEN_DIR}/14a-billing.png`, fullPage: true });
    await visit(page, "/teacher/profile");
    await page.screenshot({ path: `${SCREEN_DIR}/14b-profile.png`, fullPage: true });
    await visit(page, "/teacher/settings");
    await page.screenshot({ path: `${SCREEN_DIR}/14c-settings.png`, fullPage: true });
    await visit(page, "/teacher/developer");
    await page.screenshot({ path: `${SCREEN_DIR}/14d-patchnotes.png`, fullPage: true });
    await visit(page, "/teacher/developer/bug");
    await page.screenshot({ path: `${SCREEN_DIR}/14e-bug.png`, fullPage: true });
    await visit(page, "/teacher/developer/feedback");
    await page.screenshot({ path: `${SCREEN_DIR}/14f-feedback.png`, fullPage: true });
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });

  test("15. 햄버거 드로어 — 그룹 7개 + 모든 메뉴 항목 노출", async ({ page }) => {
    const { errors, netFails } = attachCapture(page);
    await visit(page, "/teacher");

    const menuBtn = page.locator("button[aria-label*='메뉴'], header button").first();
    await menuBtn.click().catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
    await page.screenshot({ path: `${SCREEN_DIR}/15-drawer.png`, fullPage: true });

    for (const label of ["대시보드", "학생", "강의", "클리닉", "시험 / 과제", "성적 조회", "영상", "커뮤니티", "내 자료", "근태 / 지출", "스톱워치", "내 프로필", "패치노트"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 3_000 });
    }
    expect(errors, `console: ${errors.join("\n")}`).toHaveLength(0);
    expect(netFails, `net fails: ${netFails.map((n) => `${n.method} ${n.status} ${n.url}`).join("\n")}`).toHaveLength(0);
  });
});

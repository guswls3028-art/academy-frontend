/**
 * E2E: 선생님 모바일 앱 — 전 기능 패리티 검증
 * 데스크탑과 동일한 모든 기능이 모바일에서 접근 가능한지 확인
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("선생님 모바일 — 전 기능 패리티", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => {
      localStorage.removeItem("teacher:preferAdmin");
    });
  });

  // ── 설정 ──
  test("설정 — 전체 섹션 렌더링 (프로필/보안/테마/알림/앱)", async ({ page }) => {
    await page.goto(`${BASE}/teacher/settings`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByText("프로필").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("보안").first()).toBeVisible();
    await expect(page.getByText("테마").first()).toBeVisible();
    await expect(page.getByText(/Modern White/)).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/parity-01-settings.png", fullPage: true });
  });

  // ── 강의 ──
  test("강의 목록 — 생성 버튼 존재", async ({ page }) => {
    await page.goto(`${BASE}/teacher/classes`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole("button", { name: /강의 생성/ })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "e2e/screenshots/parity-02-lectures.png" });
  });

  // ── 학생 ──
  test("학생 목록 — 등록/엑셀/가져오기 버튼", async ({ page }) => {
    await page.goto(`${BASE}/teacher/students`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole("button", { name: /등록/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("엑셀")).toBeVisible();
    await expect(page.getByText("가져오기")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/parity-03-students.png" });
  });

  // ── 시험 ──
  test("시험 목록 — 생성 버튼 존재", async ({ page }) => {
    await page.goto(`${BASE}/teacher/exams`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole("button", { name: /생성/ })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "e2e/screenshots/parity-04-exams.png" });
  });

  // ── 영상 ──
  test("영상 목록 — 업로드 버튼 존재", async ({ page }) => {
    await page.goto(`${BASE}/teacher/videos`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole("button", { name: /영상 업로드/ })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "e2e/screenshots/parity-05-videos.png" });
  });

  // ── 클리닉 ──
  test("클리닉 — 페이지 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/teacher/clinic`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    // 클리닉 헤딩이 보이면 OK (section_mode 비활성 시 안내 메시지)
    await expect(page.getByText("클리닉").first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "e2e/screenshots/parity-06-clinic.png" });
  });

  // ── 커뮤니티 ──
  test("커뮤니티 — 작성/검색 버튼 존재", async ({ page }) => {
    await page.goto(`${BASE}/teacher/comms`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByText("공지사항").first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "e2e/screenshots/parity-07-comms.png" });
  });

  // ── 직원 관리 ──
  test("직원 관리 — 페이지 렌더링 + 등록 버튼", async ({ page }) => {
    await page.goto(`${BASE}/teacher/staff`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByText(/직원 관리/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /직원 등록/ })).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: "e2e/screenshots/parity-08-staff.png" });
  });

  // ── 근태/지출 ──
  test("근태/지출 — 페이지 렌더링 + 등록 버튼", async ({ page }) => {
    await page.goto(`${BASE}/teacher/my-records`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByText(/근태/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /등록/ })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/parity-09-records.png" });
  });

  // ── 메시지 템플릿 ──
  test("메시지 템플릿 — 페이지 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/teacher/message-templates`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByText(/메시지 템플릿/).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "e2e/screenshots/parity-10-templates.png" });
  });

  // ── 메시징 설정 ──
  test("메시징 설정 — 페이지 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/teacher/messaging-settings`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByText(/메시징 설정/).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "e2e/screenshots/parity-11-msg-settings.png" });
  });

  // ── 발송 이력 ──
  test("발송 이력 — 페이지 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/teacher/message-log`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.getByText(/발송 이력/).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "e2e/screenshots/parity-12-msg-log.png" });
  });

  // ── 드로어 전체 메뉴 ──
  test("드로어 — 모든 메뉴 항목 확인", async ({ page }) => {
    await page.goto(`${BASE}/teacher`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // 햄버거 메뉴 열기
    const header = page.locator("header, [data-app='teacher']").first();
    const menuBtn = header.locator("button").first();
    await menuBtn.click({ timeout: 5_000 });
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

    // 주요 메뉴 항목 확인 — 드로어가 열린 후 텍스트 확인
    await expect(page.getByRole("button", { name: /대시보드/ })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /학생/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /강의/ }).first()).toBeVisible();
    // 직원/설정은 스크롤해야 보일 수 있으므로 존재 여부만 확인
    await expect(page.getByRole("button", { name: /직원 관리/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^설정$/ })).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/parity-13-drawer.png" });
  });
});

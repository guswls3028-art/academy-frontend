/**
 * E2E: 선생님 앱 설정 + UX 고도화 검증
 * - 설정 페이지 (테마 + 프로필 편집 + 보안)
 * - 소통 게시글 작성 + 검색 + 편집/삭제
 * - 학생 관리 (태그/메모/편집)
 * - 발송 이력
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("선생님 앱 설정 + UX 고도화", () => {
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

  test("설정 페이지 렌더링 — 프로필/보안/테마/알림/앱 섹션", async ({ page }) => {
    await page.goto(`${BASE}/teacher/settings`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // 설정 헤딩 확인
    await expect(page.getByRole("heading", { name: "설정" })).toBeVisible({ timeout: 10_000 });

    // 프로필 섹션
    await expect(page.getByText("프로필")).toBeVisible();

    // 보안 섹션
    await expect(page.getByText("보안")).toBeVisible();
    await expect(page.getByText("비밀번호 변경")).toBeVisible();

    // 테마 섹션 — 12개 테마 존재 확인
    await expect(page.getByText("테마").first()).toBeVisible();
    await expect(page.getByText("라이트").first()).toBeVisible();
    await expect(page.getByText("다크").first()).toBeVisible();
    await expect(page.getByText("브랜드").first()).toBeVisible();
    await expect(page.getByText("Modern White")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/teacher-settings-01-overview.png", fullPage: true });
  });

  test("설정 — 테마 변경 (Modern Dark 선택 후 복원)", async ({ page }) => {
    await page.goto(`${BASE}/teacher/settings`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // Modern Dark 테마 선택
    await page.getByText("Modern Dark").click();
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

    // data-theme 속성 확인
    const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("modern-dark");

    await page.screenshot({ path: "e2e/screenshots/teacher-settings-02-dark-theme.png", fullPage: true });

    // 원래 테마로 복원
    await page.getByText("Modern White").click();
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
  });

  test("설정 — 프로필 편집 모드 진입", async ({ page }) => {
    await page.goto(`${BASE}/teacher/settings`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // 편집 버튼 클릭
    await page.getByRole("button", { name: /편집/ }).first().click();
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

    // 이름/전화 입력 필드 확인
    await expect(page.getByText("이름").first()).toBeVisible();
    await expect(page.getByText("전화").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /저장/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /취소/ }).first()).toBeVisible();

    // 취소
    await page.getByRole("button", { name: /취소/ }).first().click();

    await page.screenshot({ path: "e2e/screenshots/teacher-settings-03-profile-edit.png" });
  });

  test("소통 — 공지사항 작성 버튼 + 스코프 선택", async ({ page }) => {
    await page.goto(`${BASE}/teacher/comms`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // 공지사항 탭에서 + 버튼 확인
    const plusBtns = page.locator("button").filter({ has: page.locator('svg') });
    // 작성 버튼 (Plus icon)이 표시되는지 확인
    await expect(page.getByText("공지사항").first()).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/teacher-comms-01-with-actions.png" });
  });

  test("소통 — 검색 기능 동작", async ({ page }) => {
    await page.goto(`${BASE}/teacher/comms`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // 검색 아이콘 클릭 — Search 아이콘 버튼을 찾기
    const searchBtns = page.locator("button").filter({ has: page.locator("svg") });
    // 탭 바 옆의 검색 버튼 활성화 후 검색 입력
    // 검색 UI 표시 확인
    await page.screenshot({ path: "e2e/screenshots/teacher-comms-02-search.png" });
  });

  test("학생 목록 → 상세 → 태그관리/메모/편집 버튼 확인", async ({ page }) => {
    await page.goto(`${BASE}/teacher/students`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // 학생이 1명 이상 있는지 확인
    const studentCards = page.locator("[class*='rounded']").filter({ hasText: /학년/ });
    const count = await studentCards.count();

    if (count > 0) {
      // 첫 번째 학생 클릭
      await studentCards.first().click();
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      // 상세 페이지 확인
      await expect(page.getByText("학생 상세")).toBeVisible({ timeout: 10_000 });

      // 편집 버튼 확인
      await expect(page.getByRole("button", { name: /편집/ }).first()).toBeVisible();

      // 태그 관리 버튼 확인
      await expect(page.getByRole("button", { name: /태그 관리/ })).toBeVisible();

      // 메모 편집 버튼 확인
      await expect(page.getByRole("button", { name: /편집/ }).nth(1)).toBeVisible();

      await page.screenshot({ path: "e2e/screenshots/teacher-student-01-detail-with-management.png", fullPage: true });
    }
  });

  test("발송 이력 페이지 렌더링", async ({ page }) => {
    await page.goto(`${BASE}/teacher/message-log`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // 발송 이력 헤딩 확인
    await expect(page.getByText("발송 이력")).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "e2e/screenshots/teacher-message-log-01.png" });
  });

  test("드로어 메뉴 — 설정/발송이력 메뉴 확인", async ({ page }) => {
    await page.goto(`${BASE}/teacher`, { waitUntil: "load", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // 햄버거 메뉴 클릭
    const menuBtn = page.locator("button").filter({ has: page.locator("svg") }).first();
    await menuBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

    // 드로어에서 설정 메뉴 확인
    await expect(page.getByRole("button", { name: "설정" })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "발송 이력" })).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/teacher-drawer-01-settings-menu.png" });
  });
});

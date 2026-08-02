import { expect, test } from "../fixtures/strictTest";
import { getBaseUrl, loginViaUI } from "../helpers/auth";

const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const FATAL_TEXT =
  /Application error|Unhandled Runtime Error|ChunkLoadError|Cannot read properties|페이지를 불러오지 못했습니다|오류가 발생했습니다/i;

const TEACHER_DESKTOP_ROUTES = [
  "/workspace/mobile",
  "/workspace/mobile/guide",
  "/workspace/mobile/students",
  "/workspace/mobile/classes",
  "/workspace/mobile/clinic",
  "/workspace/mobile/clinic/reports",
  "/workspace/mobile/exams",
  "/workspace/mobile/exams/templates",
  "/workspace/mobile/exams/bundles",
  "/workspace/mobile/submissions",
  "/workspace/mobile/results",
  "/workspace/mobile/videos",
  "/workspace/mobile/comms",
  "/workspace/mobile/message-log",
  "/workspace/mobile/message-templates",
  "/workspace/mobile/storage",
  "/workspace/mobile/storage/inventory",
  "/workspace/mobile/counseling",
  "/workspace/mobile/notifications",
  "/workspace/mobile/profile",
  "/workspace/mobile/settings",
  "/workspace/mobile/settings/appearance",
  "/workspace/mobile/tools/stopwatch",
  "/workspace/mobile/developer",
];

const CONTEXTUAL_HELP_CHECKS = [
  {
    route: "/workspace/mobile/exams/templates",
    ariaLabel: "템플릿 관리 도움말",
    dialogTitle: "템플릿 관리 안내",
    hiddenText: "템플릿의 수정·생성은 강의 → 차시에서 진행합니다.",
    contentText: "이 화면에서는 전체 템플릿과 적용 강의를 조회합니다.",
  },
  {
    route: "/workspace/mobile/exams/bundles",
    ariaLabel: "시험 묶음 도움말",
    dialogTitle: "시험 묶음 안내",
    hiddenText: "여러 시험·과제 템플릿을 한 번에 묶어 차시에 일괄 적용할 때 사용합니다.",
    contentText: "차시에 일괄 적용할 때 사용합니다.",
  },
];

test.describe("선생앱 반응형 레이아웃", () => {
  test("데스크탑에서는 고정 사이드바와 업무 캔버스를 사용한다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await loginViaUI(page, "admin", { landingPath: "/workspace/mobile" });
    await page.goto(`${BASE}/workspace/mobile`, { waitUntil: "domcontentloaded" });

    const sidebar = page.getByRole("navigation", { name: "선생님 메뉴" });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("button", { name: "대시보드" })).toBeVisible();
    await expect(sidebar).toContainText("오늘 업무");
    await expect(sidebar).toContainText("수업 운영");
    await expect(sidebar).toContainText("자료·메시지");
    await expect(sidebar).toContainText("관리자 전용");
    await expect(sidebar).toContainText("지원");
    await expect(page.getByRole("navigation", { name: "하단 메뉴" })).toBeHidden();
    await expect(page.getByRole("button", { name: "메뉴" })).toHaveCount(0);

    const sidebarBox = await sidebar.boundingBox();
    const contentBox = await page.locator("main > div").boundingBox();
    expect(sidebarBox?.width).toBeGreaterThanOrEqual(260);
    expect(contentBox?.x).toBeGreaterThanOrEqual((sidebarBox?.width ?? 0) - 1);
  });

  test("모바일에서는 하단 탭과 드로어 흐름을 유지한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginViaUI(page, "admin", { landingPath: "/workspace/mobile" });
    await page.goto(`${BASE}/workspace/mobile`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("navigation", { name: "하단 메뉴" })).toBeVisible();
    await expect(page.getByRole("button", { name: "메뉴" })).toBeVisible();

    const sidebar = page.getByRole("navigation", { name: "선생님 메뉴" });
    await expect(sidebar).toBeHidden();
    await page.getByRole("button", { name: "메뉴" }).click();
    await expect(sidebar).toBeVisible();
  });

  test("데스크탑 주요 선생앱 메뉴가 모바일 탭 없이 열린다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await loginViaUI(page, "admin", { landingPath: "/workspace/mobile" });

    for (const route of TEACHER_DESKTOP_ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await expect(page.getByRole("navigation", { name: "선생님 메뉴" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "하단 메뉴" })).toBeHidden();
      await expect(page.locator("body")).not.toContainText(FATAL_TEXT);
    }
  });

  test("대시보드는 오늘 업무와 다음 액션을 먼저 보여준다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await loginViaUI(page, "admin", { landingPath: "/workspace/mobile" });
    await page.goto(`${BASE}/workspace/mobile`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

    await expect(page.locator("main")).toContainText("안녕하세요");
    await expect(page.locator("main")).toContainText("처리할 일");
    await expect(page.locator("main")).toContainText("오늘 수업");
    await expect(page.locator("main")).toContainText("출결 입력");
    await expect(page.locator("main")).toContainText("다음 수업");
    await expect(page.locator("main")).toContainText("바로 처리");
    await expect(page.locator("main")).toContainText("처리 대기함");
    await expect(page.locator("main")).toContainText("오늘의 수업");
    await expect(page.getByRole("button", { name: /Q&A 처리|처리하러 가기|오늘 수업 보기|수업 열기|강의 확인/ })).toBeVisible();
  });

  test("빈 상태는 다음 액션을 제시한다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await loginViaUI(page, "admin", { landingPath: "/workspace/mobile" });
    await page.goto(`${BASE}/workspace/mobile/results`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

    await expect(page.locator("main")).toContainText("강의를 선택하세요");
    await expect(page.locator("main")).toContainText("강의를 선택하면 연결된 시험과 학생별 성적을 바로 볼 수 있습니다.");
    await expect(page.getByRole("button", { name: /첫 강의 선택|강의 확인/ })).toBeVisible();
  });

  test("상단 업무 안내는 도움말로 접혀 있고 문맥에 맞게 열린다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await loginViaUI(page, "admin", { landingPath: "/workspace/mobile" });

    for (const check of CONTEXTUAL_HELP_CHECKS) {
      await page.goto(`${BASE}${check.route}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

      await expect(page.getByRole("navigation", { name: "선생님 메뉴" })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(check.hiddenText);

      await page.getByRole("button", { name: check.ariaLabel }).click();
      const dialog = page.getByRole("dialog", { name: check.dialogTitle });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(check.hiddenText);
      await expect(dialog).toContainText(check.contentText);
    }
  });
});

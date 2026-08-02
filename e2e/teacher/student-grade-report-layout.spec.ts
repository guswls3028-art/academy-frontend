import { expect, test } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

function isLocalBase(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  })).toString("base64url");
  return `e30.${payload}.layout`;
}

const initialLayout = {
  version: 1 as const,
  sections: [
    { id: "score_trend", visible: true },
    { id: "score_comparison", visible: true },
    { id: "lecture_average", visible: true },
    { id: "improvement_priority", visible: true },
    { id: "exam_summary", visible: true },
    { id: "rank_position", visible: true },
    { id: "weakest_lecture", visible: true },
    { id: "homework_summary", visible: true },
  ],
};

test.describe("학생 성적표 구성", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock interaction spec.");
  test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

  test("학원 관리자는 표시 여부와 순서를 미리 본 뒤 저장한다", async ({ page }) => {
    let savedLayout: unknown = null;
    await page.addInitScript(({ token }) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", "layout-refresh");
      localStorage.setItem("tenant_code", "ymath");
      sessionStorage.setItem("tenantCode", "ymath");
    }, { token: fakeJwt() });

    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
      if (path.endsWith("/core/program/")) {
        return route.fulfill({ json: {
          tenantCode: "ymath",
          display_name: "Ymath",
          is_active: true,
          ui_config: {},
          feature_flags: {},
        } });
      }
      if (path.endsWith("/core/me/")) {
        return route.fulfill({ json: {
          id: 1,
          username: "ymath-owner",
          name: "원장",
          is_staff: true,
          is_superuser: false,
          tenantRole: "owner",
          linkedStudents: [],
        } });
      }
      if (path.endsWith("/core/tenant-info/")) {
        return route.fulfill({ json: {
          name: "Ymath",
          phone: "",
          headquarters_phone: "",
          academies: [{ name: "Ymath", phone: "" }],
        } });
      }
      if (path.endsWith("/core/student-grade-report-layout/")) {
        if (request.method() === "PATCH") {
          savedLayout = request.postDataJSON();
          return route.fulfill({ json: savedLayout });
        }
        return route.fulfill({ json: initialLayout });
      }
      return route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
    });

    await page.goto(`${BASE}/workspace/mobile/settings/organization`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "학생 성적표 구성" })).toBeVisible();

    await page.getByRole("switch", { name: "보완 우선순위 숨기기" }).click();
    await expect(page.getByRole("switch", { name: "보완 우선순위 표시하기" })).toBeVisible();
    await page.getByRole("button", { name: "성적 비교 위로 이동" }).click();

    const preview = page.getByRole("complementary", { name: "학생 화면 미리보기" });
    await expect(preview.locator("div").filter({ hasText: /^1성적 비교$/ })).toBeVisible();
    await expect(preview).not.toContainText("보완 우선순위");
    await page.getByRole("button", { name: "구성 저장" }).click();

    await expect.poll(() => savedLayout).not.toBeNull();
    const savedSections = (savedLayout as { sections: Array<{ id: string; visible: boolean }> }).sections;
    expect(savedSections.slice(0, 4)).toEqual([
      { id: "score_comparison", visible: true },
      { id: "score_trend", visible: true },
      { id: "lecture_average", visible: true },
      { id: "improvement_priority", visible: false },
    ]);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole("heading", { name: "학생 성적표 구성" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/student-grade-report-layout/teacher-mobile-390.png", fullPage: true });
  });
});

import { expect, test } from "./fixtures/strictTest";
import { ADMIN_WORKFLOWS } from "../src/shared/ui/guide/content/adminWorkflows";
import { TEACHER_WORKFLOWS } from "../src/shared/ui/guide/content/teacherWorkflows";
import { STUDENT_WORKFLOWS } from "../src/shared/ui/guide/content/studentWorkflows";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const GUIDES = [
  { role: "admin", label: "관리자·선생님", articles: ADMIN_WORKFLOWS },
  { role: "teacher", label: "직원·강사", articles: TEACHER_WORKFLOWS },
  { role: "student", label: "학생", articles: STUDENT_WORKFLOWS },
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/core/program/**", (route) => route.fulfill({
    json: { tenantCode: "hakwonplus", display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true },
  }));
});

for (const width of [1366, 390]) {
  test(`anonymous full guide keeps role content, recovery and reading position at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/promo/guide`);
    for (const guide of GUIDES) {
      await page.getByRole("group", { name: "가이드 이용 역할" }).getByRole("button", { name: guide.label, exact: true }).click();
      await expect(page.getByRole("heading", { name: `${guide.label} 사용 가이드`, exact: true })).toBeVisible();
      const contents = page.getByRole("navigation", { name: "주요 기능 이용 순서" });
      await expect(contents.getByRole("button")).toHaveCount(guide.articles.length);
      const article = guide.articles[0];
      await page.getByRole("searchbox").fill(article.title);
      await contents.getByRole("button").filter({ hasText: article.title }).first().press("Enter");
      const body = page.getByRole("article", { name: article.title, exact: true });
      await expect(body).toBeVisible();
      for (const step of article.steps) {
        await expect(body.getByRole("heading", { name: step.title, exact: true })).toBeVisible();
        await expect(body.getByText(step.description, { exact: true })).toBeVisible();
      }
      await expect(body.getByRole("heading", { name: "여기까지 확인하면 완료" })).toBeVisible();
      for (const item of article.completion) await expect(body.getByText(item, { exact: true })).toBeVisible();
      const recovery = article.troubleshooting[0];
      await body.locator("summary").filter({ hasText: recovery.title }).click();
      await expect(body.getByText(recovery.description, { exact: true })).toBeVisible();
      await expect(page.locator('main a[href^="/workspace"], main a[href^="/student"], main a[href^="/teacher"], main a[href^="/admin"]')).toHaveCount(0);
      await page.reload();
      await expect(body).toBeVisible();
      await expect(page.getByRole("searchbox")).toHaveValue(article.title);
      expect(new URL(page.url()).searchParams.get("topic")).toBe(article.id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await testInfo.attach(`public-guide-${guide.role}-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    }
    await page.getByRole("searchbox").fill("없는안내-검색복구-qa");
    await expect(page.getByText("일치하는 안내가 없습니다. 검색어를 줄이거나 다른 분류를 선택해 주세요.")).toBeVisible();
    await page.getByRole("button", { name: "검색 초기화", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "주요 기능 이용 순서" }).getByRole("button")).toHaveCount(STUDENT_WORKFLOWS.length);
    await page.goto(`${BASE}/promo/guide?role=teacher&topic=missing-topic`);
    await page.getByRole("button", { name: "전체 가이드 보기", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "주요 기능 이용 순서" }).getByRole("button")).toHaveCount(TEACHER_WORKFLOWS.length);
  });

  test(`promo entry explains onboarding, planned payments and callback at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/promo`);
    await expect(page.getByText(/개발자가 직접 프로그램을 소개하고 직원·강사분들께/)).toBeVisible();
    await expect(page.getByText(/원비·교재비 온라인 결제 기능은 도입 예정입니다/)).toBeVisible();
    await expect(page.getByText(/현재는 온라인 결제를 지원하지 않으며/)).toBeVisible();
    const guideLink = page.getByRole("link", { name: "전체 사용 가이드 보기", exact: true });
    await guideLink.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await testInfo.attach(`promo-guidance-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    await guideLink.click();
    await expect(page.getByRole("heading", { name: "관리자·선생님 사용 가이드" })).toBeVisible();
    await page.getByRole("link", { name: "도입 전 자주 묻는 질문 →" }).click();
    await expect(page.getByText(/원비·교재비 온라인 결제 기능은 도입 예정입니다/)).toBeVisible();
    await page.goto(`${BASE}/promo/contact`);
    await expect(page.getByText("통화 연결이 어려울 경우 문자를 남겨주시면 확인 후 연락드리겠습니다.")).toBeVisible();
    await expect(page.getByRole("link", { name: "전화 문의하기" }).first()).toContainText("010-3121-7466");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });
}

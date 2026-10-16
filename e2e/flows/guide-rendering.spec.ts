/** Read-only live guide journeys. All assertions are required. */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");

for (const scenario of [
  { name: "관리자", role: "admin" as const, path: "/workspace/guide", title: "학원 운영, 처음부터 끝까지", topic: "register-student", article: "학생 등록과 계정 안내" },
  { name: "선생님 모바일", role: "admin" as const, path: "/workspace/mobile/guide", title: "현장 업무를 한 흐름으로", topic: "attendance", article: "모바일 출결 입력" },
  { name: "학생", role: "student" as const, path: "/student/guide", title: "수업부터 제출과 결과까지", topic: "submit-assignment", article: "과제 사진·동영상 제출" },
]) {
  test(`${scenario.name} 가이드에서 안내를 읽고 새로고침해 이어간다`, async ({ page }) => {
    await loginViaUI(page, scenario.role);
    await gotoAndSettle(page, BASE + scenario.path, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: scenario.title })).toBeVisible();
    await page.getByRole("navigation", { name: "주요 기능 이용 순서" })
      .getByRole("button", { name: new RegExp(scenario.article) }).click();
    await expect(page).toHaveURL(new RegExp(`topic=${scenario.topic}`));
    const article = page.getByRole("article");
    await expect(article.getByRole("heading", { name: "순서대로 따라하기" })).toBeVisible();
    await expect(article.getByRole("heading", { name: "여기까지 확인하면 완료" })).toBeVisible();
    await expect(article.getByRole("link", { name: scenario.article + " 화면 열기" })).toBeVisible();
    await page.reload();
    await expect(article.getByRole("heading", { level: 2, name: scenario.article })).toBeVisible();
  });
}

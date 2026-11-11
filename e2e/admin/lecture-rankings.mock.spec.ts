import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type Total = { score: number | null; max_score: number; selected_count: number; scored_count: number; complete: boolean };
const total = (score: number | null, max: number): Total => ({
  score, max_score: max, selected_count: 1, scored_count: score == null ? 0 : 1, complete: score != null,
});
const STUDENTS = [
  { enrollment_id: 1, student_name: "김가람" },
  { enrollment_id: 2, student_name: "박나래" },
  { enrollment_id: 3, student_name: "이다온" },
  { enrollment_id: 4, student_name: "최라온" },
];
// [exam, homework] per student per session. null = 결시·미확정 (서버 합계에서 제외)
const SCORES: Record<number, Array<[number | null, number | null]>> = {
  301: [[90, 10], [80, 10], [95, 0], [null, null]],
  302: [[85, 10], [95, 10], [90, 5], [70, 10]],
};

function sessionScores(sessionId: number) {
  return {
    meta: { exams: [], homeworks: [], session_title: `${sessionId}`, lecture_title: "주간반" },
    rows: STUDENTS.map((student, index) => {
      const [exam, homework] = SCORES[sessionId][index];
      return {
        ...student,
        exams: [],
        homeworks: [],
        updated_at: "2026-11-01T00:00:00Z",
        exam_total: total(exam, 100),
        homework_total: total(homework, 10),
      };
    }),
  };
}

async function seed(page: Page) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");
  const scoreRequests: number[] = [];
  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify(body),
    });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/lectures/lectures/101/") {
      return json({ id: 101, title: "주간반", name: "관리자", subject: "수학", start_date: "2026-09-01", end_date: null, is_active: true, color: "#3b82f6", chip_label: "주" });
    }
    if (path === "/lectures/sessions/" && url.searchParams.get("lecture") === "101") {
      return json([
        { id: 301, lecture: 101, order: 1, regular_order: 1, session_type: "REGULAR", title: "1주차", date: "2026-09-01" },
        { id: 302, lecture: 101, order: 2, regular_order: 2, session_type: "REGULAR", title: "2주차", date: "2026-09-08" },
      ]);
    }
    const scores = path.match(/^\/results\/admin\/sessions\/(\d+)\/scores\/$/);
    if (scores) {
      scoreRequests.push(Number(scores[1]));
      return json(sessionScores(Number(scores[1])));
    }
    if (path === "/staffs/me/") {
      return json({ is_authenticated: true, is_superuser: true, is_staff: true, is_payroll_manager: true, is_owner: true, owner_display_name: "관리자" });
    }
    return json({ count: 0, results: [] });
  });
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  return { scoreRequests };
}

async function rankingRows(page: Page) {
  return page.locator("section[aria-labelledby='lecture-rankings-title'] tbody tr").evaluateAll((rows) =>
    rows.map((row) => {
      const cells = row.querySelectorAll("td");
      return `${cells[0]?.textContent?.trim()} ${cells[1]?.textContent?.trim()} ${cells[2]?.textContent?.replace(/\s+/g, "")}`;
    }));
}

test.describe("강의 순위 · 명예의 전당", () => {
  test("여러 차시 종합·시험 순위, 공동 등수, URL 복원과 명예의 전당 출력", async ({ page }, testInfo) => {
    const { scoreRequests } = await seed(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/lectures/101/rankings?from=301&to=302&scope=all`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "순위 · 명예의 전당" })).toBeVisible();

    // 종합: 김가람 195, 박나래 195(공동 1등), 이다온 190, 최라온 80 (결시 차시는 0점이 아니라 미반영)
    await expect.poll(() => rankingRows(page)).toEqual([
      "1등 김가람 195/220",
      "1등 박나래 195/220",
      "3등 이다온 190/220",
      "4등 최라온 80/220",
    ]);
    await expect(page.locator("tbody tr").nth(3)).toContainText("미반영 2");
    expect(new Set(scoreRequests)).toEqual(new Set([301, 302]));

    await page.getByRole("group", { name: "순위 기준" }).getByRole("button", { name: "시험", exact: true }).click();
    await expect.poll(() => rankingRows(page)).toEqual([
      "1등 이다온 185/200",
      "2등 김가람 175/200",
      "2등 박나래 175/200",
      "4등 최라온 70/200",
    ]);
    await expect(page).toHaveURL(/scope=exam/);
    await page.reload();
    await expect.poll(() => rankingRows(page)).toEqual([
      "1등 이다온 185/200",
      "2등 김가람 175/200",
      "2등 박나래 175/200",
      "4등 최라온 70/200",
    ]);

    await page.getByRole("button", { name: "명예의 전당 출력" }).click();
    const dialog = page.getByRole("dialog", { name: "명예의 전당 출력" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "1~3등" }).click();
    await expect(dialog).toContainText("3명 출력");
    const poster = page.frameLocator("iframe[title='명예의 전당 미리보기']");
    await expect(poster.locator("h1")).toHaveText("명예의 전당");
    await expect(poster.locator("li.entry")).toHaveCount(3);
    await expect(poster.locator("li.entry").first()).toContainText("이다온");
    await expect(poster.locator("body")).not.toContainText("최라온");
    await expect(poster.locator(".score").first()).toContainText("185");
    await dialog.getByLabel("점수 표시").uncheck();
    await expect(poster.locator(".score")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("rankings-print-1366.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "순위 · 명예의 전당" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath("rankings-390.png"), animations: "disabled", fullPage: true });
  });
});

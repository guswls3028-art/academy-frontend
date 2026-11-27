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
  // The same test can be linked to two sessions. Its checkbox is session-local.
  const memoryId = sessionId + 100;
  const mockId = 730;
  const mockScores = sessionId === 301 ? [55, 80, null, 0] : [90, 60, null, 0];
  return {
    meta: { exams: [
      { exam_id: memoryId, title: "화학 암기테스트", max_score: 100 },
      { exam_id: mockId, title: "주간 모의고사", max_score: 100 },
    ], total_config: { exam_ids: [memoryId] }, homeworks: [], session_title: `${sessionId}`, lecture_title: "주간반" },
    rows: STUDENTS.map((student, index) => {
      const [exam, homework] = SCORES[sessionId][index];
      return {
        ...student,
        exams: [
          { exam_id: memoryId, ranking_score: exam, block: { score: exam, max_score: 100 } },
          ...((index === 2 && sessionId === 302) ? [] : [{
            exam_id: mockId, ranking_score: mockScores[index], block: { score: mockScores[index], max_score: 100 },
          }]),
        ],
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
        { id: 301, lecture: 101, order: 1, regular_order: 1, session_type: "REGULAR", title: "1주차", date: "2026-09-01",
          section: 7, section_type: "CLASS", section_label: "A",
          schedule_dates: [{ id: 901, label: "수요일반" }, { id: 911, label: "목요일반" }] },
        { id: 302, lecture: 101, order: 2, regular_order: 2, session_type: "REGULAR", title: "2주차", date: "2026-09-08",
          schedule_dates: [{ id: 902, label: "수요일반" }] },
      ]);
    }
    const scores = path.match(/^\/results\/admin\/sessions\/(\d+)\/scores\/$/);
    if (scores) {
      scoreRequests.push(Number(scores[1]));
      const payload = sessionScores(Number(scores[1]));
      const schedule = url.searchParams.get("schedule");
      if (schedule !== null) {
        const memberships: Record<string, number[]> = { "301.901": [1, 4], "301.911": [2], "302.902": [2, 4] };
        const allowed = memberships[`${scores[1]}.${schedule}`];
        if (!allowed) return json({ detail: "차시의 수업일을 다시 선택해 주세요." }, 400);
        payload.rows = payload.rows.filter(row => allowed.includes(row.enrollment_id));
      }
      return json(payload);
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
  test("PC에서 반·차시·시험을 바꾸며 비교하고 같은 범위를 출력한다", async ({ page }, testInfo) => {
    await seed(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/lectures/101/rankings?from=301&to=302&scope=exam`);
    const section = page.locator("section[aria-labelledby='lecture-rankings-title']");
    await section.getByLabel("수업반").selectOption({ label: "수요일반" });
    await section.locator("summary").click();
    await section.getByRole("searchbox").fill("모의고사");
    await section.getByRole("button", { name: "검색 결과 2개만 선택" }).click();
    const expected = ["1등 박나래 60/100", "2등 김가람 55/100", "3등 최라온 0/200"];
    await expect.poll(() => rankingRows(page)).toEqual(expected);
    const detail = section.getByRole("button", { name: "박나래 점수 상세" });
    await detail.click();
    await expect(section.locator("dl")).toContainText("2주차");
    await expect(section.locator("dl")).toContainText("60 / 100점");
    for (const width of [1366, 1100]) {
      await page.setViewportSize({ width, height: 900 });
      const filters = await section.getByLabel("순위 조건").boundingBox();
      const table = await section.getByRole("table").boundingBox();
      expect(filters!.x + filters!.width).toBeLessThanOrEqual(table!.x);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await section.screenshot({ path: testInfo.outputPath(`class-comparison-${width}.png`), animations: "disabled" });
    }
    await detail.click();
    await section.getByLabel("끝 차시").selectOption("301");
    await expect.poll(() => rankingRows(page)).toEqual(["1등 김가람 55/100", "2등 최라온 0/100"]);
    await section.getByLabel("끝 차시").selectOption("302");
    await page.reload();
    await expect.poll(() => rankingRows(page)).toEqual(expected);
    await section.getByRole("button", { name: "명예의 전당 출력" }).click();
    const poster = page.frameLocator("iframe[title='명예의 전당 미리보기']");
    await expect(poster.locator(".subtitle")).toContainText("수요일반 · 선택 시험 2개 · 주간 모의고사");
    await expect(poster.locator("li.entry").first()).toContainText("박나래");
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await section.getByLabel("수업반").selectOption({ label: "목요일반" });
    await expect.poll(() => rankingRows(page)).toEqual(["1등 박나래 80/100"]);
    await section.getByLabel("시작 차시").selectOption("302");
    await expect(section.getByText("이 기간에 선택한 반의 수업이 없습니다")).toBeVisible();
    await expect(section.getByRole("button", { name: "명예의 전당 출력" })).toBeDisabled();
    await section.getByRole("button", { name: "전체 반 보기" }).click();
    await expect.poll(async () => (await rankingRows(page))[0]).toBe("1등 김가람 90/100");
    await section.getByLabel("시작 차시").selectOption("301");
    await section.getByLabel("수업반").selectOption({ label: "A반 (개별 차시)" });
    await expect.poll(async () => (await rankingRows(page))[0]).toBe("1등 박나래 80/100");
    await section.getByLabel("시작 차시").selectOption("302");
    await expect(section.getByText("이 기간에 선택한 반의 수업이 없습니다")).toBeVisible();
    await expect(section.getByRole("button", { name: "명예의 전당 출력" })).toBeDisabled();
  });

  test("주차별 시험 체크, 검색 일괄 선택, 출력과 빈 선택 복원", async ({ page }, testInfo) => {
    const { scoreRequests } = await seed(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/lectures/101/rankings?from=301&to=302&scope=exam`);
    const filter = page.locator("details").filter({ has: page.locator("summary", { hasText: "시험 직접 선택" }) });
    await filter.locator("summary").click();
    const mock = filter.getByRole("checkbox", { name: "주간 모의고사" });
    await expect(mock).toHaveCount(2);
    await mock.first().check();
    await expect(mock.last()).not.toBeChecked();
    const search = filter.getByRole("searchbox");
    await search.fill("모의고사");
    await filter.getByRole("button", { name: "검색 결과 2개만 선택" }).click();
    const expected = ["1등 김가람 145/200", "2등 박나래 140/200", "3등 최라온 0/200", "- 이다온 —/100"];
    await expect.poll(() => rankingRows(page)).toEqual(expected);
    await page.locator("section[aria-labelledby='lecture-rankings-title']").screenshot({ path: testInfo.outputPath("ranking-comparison-1366.png"), animations: "disabled" });
    expect(scoreRequests.sort()).toEqual([301, 302]);
    await page.reload();
    await expect.poll(() => rankingRows(page)).toEqual(expected);
    await page.getByRole("button", { name: "명예의 전당 출력" }).click();
    const poster = page.frameLocator("iframe[title='명예의 전당 미리보기']");
    await expect(poster.locator(".subtitle")).toContainText("선택 시험 2개 · 주간 모의고사");
    await expect(poster.locator("li.entry").first()).toContainText("145");
    await expect(poster.locator("li.entry")).toHaveCount(3);
    await page.screenshot({ path: testInfo.outputPath("rankings-selected-print-1366.png"), animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => poster.locator(".page").evaluate((paper) =>
      paper.getBoundingClientRect().right - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath("rankings-selected-print-390.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await filter.locator("summary").click();
    await expect(mock.first()).toBeChecked();
    await expect(mock.last()).toBeChecked();
    await expect(filter.getByRole("checkbox", { name: "화학 암기테스트" }).first()).not.toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await filter.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("ranking-exams-390.png"), animations: "disabled" });
    await search.fill("미등록");
    await expect(filter).toContainText("검색 결과가 없습니다");
    await expect.poll(() => rankingRows(page)).toEqual(expected);
    await filter.getByRole("button", { name: "선택 해제" }).click();
    await page.reload();
    await expect(page.getByText("선택한 시험이 없습니다", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "명예의 전당 출력" })).toBeDisabled();
    await page.getByRole("button", { name: "차시 기본값 복원" }).click();
    await expect.poll(async () => (await rankingRows(page))[0]).toBe("1등 이다온 185/200");
  });

  test("여러 차시 종합·시험 순위, 공동 등수, URL 복원과 명예의 전당 출력", async ({ page }, testInfo) => {
    const { scoreRequests } = await seed(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/lectures/101/rankings?from=301&to=302&scope=all`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "순위 · 명예의 전당" })).toBeVisible();

    // 종합: 김가람 195, 박나래 195(공동 1등), 이다온 190, 최라온 80 (결시 차시는 0점이 아니라 미반영)
    await expect.poll(() => rankingRows(page)).toEqual([
      "공동 1등 김가람 195/220",
      "공동 1등 박나래 195/220",
      "3등 이다온 190/220",
      "4등 최라온 80/220",
    ]);
    await expect(page.locator("tbody tr").nth(3)).toContainText("미반영 2");
    expect(new Set(scoreRequests)).toEqual(new Set([301, 302]));

    await page.getByRole("group", { name: "순위 기준" }).getByRole("button", { name: "시험", exact: true }).click();
    await expect.poll(() => rankingRows(page)).toEqual([
      "1등 이다온 185/200",
      "공동 2등 김가람 175/200",
      "공동 2등 박나래 175/200",
      "4등 최라온 70/200",
    ]);
    await expect(page).toHaveURL(/scope=exam/);
    await page.reload();
    await expect.poll(() => rankingRows(page)).toEqual([
      "1등 이다온 185/200",
      "공동 2등 김가람 175/200",
      "공동 2등 박나래 175/200",
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

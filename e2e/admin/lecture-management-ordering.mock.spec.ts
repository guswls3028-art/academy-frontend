import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

type Lecture = {
  id: number;
  title: string;
  name: string;
  subject: string;
  lecture_time: string;
  start_date: string;
  end_date: string;
  color: string;
  chip_label: string;
  is_active: boolean;
  display_order: number;
  active_enrollment_count: number;
};

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

const initialLectures: Lecture[] = [
  { id: 101, title: "Alpha", name: "관리자", subject: "과학", lecture_time: "09:00~10:00", start_date: "2026-08-01", end_date: "2026-09-01", color: "#3b82f6", chip_label: "A", is_active: true, display_order: 1, active_enrollment_count: 12 },
  { id: 102, title: "Beta", name: "관리자", subject: "수학", lecture_time: "10:00~11:00", start_date: "2026-08-02", end_date: "2026-09-02", color: "#22c55e", chip_label: "B", is_active: true, display_order: 2, active_enrollment_count: 7 },
  { id: 103, title: "Gamma", name: "관리자", subject: "영어", lecture_time: "11:00~12:00", start_date: "2026-08-03", end_date: "2026-09-03", color: "#eab308", chip_label: "G", is_active: true, display_order: 3, active_enrollment_count: 17 },
];

async function seedLectureAdmin(page: Page, options?: { failFirstReorder?: boolean }) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");
  let lectures = initialLectures.map((lecture) => ({ ...lecture }));
  let failFirstReorder = options?.failFirstReorder ?? false;
  const reorderPayloads: Array<{ scope: string; ordered_ids: number[] }> = [];

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/lectures/lectures/reorder/" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON() as { scope: string; ordered_ids: number[] };
      reorderPayloads.push(payload);
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (failFirstReorder) {
        failFirstReorder = false;
        return json({ detail: "temporary failure" }, 503);
      }
      lectures = payload.ordered_ids.map((id, index) => ({
        ...lectures.find((lecture) => lecture.id === id)!,
        display_order: index + 1,
      }));
      return json(lectures);
    }
    if (path === "/lectures/lectures/" && route.request().method() === "GET") return json(lectures);
    if (path === "/lectures/lectures/101/") return json(lectures[0]);
    if (path === "/lectures/lectures/instructor-options/") return json([{ name: "관리자", type: "owner" }]);
    if (path === "/lectures/sessions/" && url.searchParams.get("lecture") === "101") {
      return json([{ id: 201, lecture: 101, order: 1, regular_order: 1, session_type: "REGULAR", title: "1차시", date: "2026-08-01" }]);
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

  return { reorderPayloads };
}

async function rowTitles(page: Page) {
  return page.locator("main tbody tr").evaluateAll((rows) => rows.map((row) => row.querySelectorAll("td")[1]?.textContent?.trim() ?? ""));
}

async function normalizedRowTitles(page: Page) {
  return (await rowTitles(page)).map((title) => title.includes("Alpha") ? "Alpha" : title.includes("Beta") ? "Beta" : "Gamma");
}

test.describe("강의 관리 영구 순서와 레이아웃", () => {
  test("목록은 작은 순서 손잡이와 강의별·전체 수강 등록 요약을 보여 준다", async ({ page }) => {
    await seedLectureAdmin(page);
    await page.goto(`${BASE}/workspace/lectures`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("강의 3개 · 수강 등록 36명", { exact: true })).toBeVisible();
    const alphaRow = page.getByRole("button", { name: "Alpha 강의 열기", exact: true }).locator("xpath=ancestor::tr");
    await expect(alphaRow.getByText("12명", { exact: true })).toBeVisible();

    const alphaHandle = page.getByRole("button", { name: "Alpha 순서 이동", exact: true });
    const handleSize = await alphaHandle.evaluate((element) => element.getBoundingClientRect().width);
    expect(handleSize).toBeLessThanOrEqual(40);
    await expect(page.getByRole("button", { name: "Alpha 아래로", exact: true })).toBeHidden();
    await alphaHandle.click();
    await expect(page.getByRole("group", { name: "Alpha 순서 변경", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Alpha 아래로", exact: true })).toBeVisible();
    await alphaHandle.press("Escape");
    await expect(page.getByRole("button", { name: "Alpha 아래로", exact: true })).toBeHidden();
  });

  test("키보드 순서 변경은 낙관 반영 후 실패 시 정확히 rollback하고 재시도한다", async ({ page }) => {
    const { reorderPayloads } = await seedLectureAdmin(page, { failFirstReorder: true });
    await page.goto(`${BASE}/workspace/lectures`, { waitUntil: "domcontentloaded" });

    const alphaHandle = page.getByRole("button", { name: "Alpha 순서 이동", exact: true });
    await expect(alphaHandle).toHaveAttribute("draggable", "true");
    await alphaHandle.focus();
    await alphaHandle.press("ArrowDown");
    await expect.poll(() => normalizedRowTitles(page)).toEqual(["Beta", "Alpha", "Gamma"]);
    await expect.poll(() => reorderPayloads.length).toBe(1);
    await expect.poll(() => normalizedRowTitles(page)).toEqual(["Alpha", "Beta", "Gamma"]);

    await alphaHandle.press("ArrowDown");
    await expect.poll(() => reorderPayloads.length).toBe(2);
    await expect.poll(() => normalizedRowTitles(page)).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(reorderPayloads[1]).toEqual({ scope: "ACTIVE", ordered_ids: [102, 101, 103] });

    const gammaHandle = page.getByRole("button", { name: "Gamma 순서 이동", exact: true });
    await expect(gammaHandle).toHaveAttribute("draggable", "true");
    await gammaHandle.dragTo(page.locator("main tbody tr").first());
    await expect.poll(() => reorderPayloads.length).toBe(3);
    expect(reorderPayloads[2]).toEqual({ scope: "ACTIVE", ordered_ids: [103, 102, 101] });
    await expect.poll(() => normalizedRowTitles(page)).toEqual(["Gamma", "Beta", "Alpha"]);

    await page.getByPlaceholder("강의 검색 (강의명/과목/강사/기간)").fill("Alpha");
    await expect(page.getByRole("button", { name: "Alpha 순서 이동", exact: true })).toBeDisabled();
    await expect(page.getByText("검색 또는 열 정렬 중에는 순서를 변경할 수 없습니다.")).toBeVisible();
  });

  test("1100px 생성 모달은 세로 과밀 없이 보이고 시간 picker가 modal과 충돌하지 않는다", async ({ page }) => {
    await seedLectureAdmin(page);
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto(`${BASE}/workspace/lectures`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "강의 추가", exact: true }).click();

    const modal = page.getByRole("dialog", { name: "강의 추가" });
    await expect(modal).toBeVisible();
    await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(680);
    const metrics = await modal.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const form = element.querySelector<HTMLElement>(".lecture-create-modal-form")!;
      return { width: rect.width, height: rect.height, formClientHeight: form.clientHeight, formScrollHeight: form.scrollHeight };
    });
    expect(metrics.width).toBeGreaterThanOrEqual(680);
    expect(metrics.height).toBeLessThanOrEqual(720);
    expect(metrics.formScrollHeight).toBeLessThanOrEqual(metrics.formClientHeight + 1);

    await page.getByRole("button", { name: "시작 시간 선택", exact: true }).click();
    const popover = page.getByRole("dialog", { name: "시간 선택" });
    const collision = await popover.evaluate((element) => {
      const pop = element.getBoundingClientRect();
      const modalRect = document.querySelector(".admin-modal")!.getBoundingClientRect();
      return { popLeft: pop.left, popRight: pop.right, modalLeft: modalRect.left, modalRight: modalRect.right };
    });
    expect(collision.popLeft).toBeGreaterThanOrEqual(collision.modalLeft);
    expect(collision.popRight).toBeLessThanOrEqual(collision.modalRight);
  });

  test("390px 생성 모달과 portaled 시간 picker는 viewport를 벗어나지 않는다", async ({ page }) => {
    await seedLectureAdmin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/workspace/lectures`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Alpha 순서 이동", exact: true }).click();
    await expect(page.getByRole("button", { name: "Alpha 아래로", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "강의 추가", exact: true }).click();

    const modal = page.getByRole("dialog", { name: "강의 추가" });
    await expect(modal).toBeVisible();
    await expect.poll(() => modal.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(360);
    await page.getByRole("button", { name: "시작 시간 선택", exact: true }).click();
    const popover = page.getByRole("dialog", { name: "시간 선택" });
    const bounds = await popover.evaluate((element) => {
      const pop = element.getBoundingClientRect();
      const modalRect = document.querySelector(".admin-modal")!.getBoundingClientRect();
      return {
        popLeft: pop.left,
        popRight: pop.right,
        popTop: pop.top,
        popBottom: pop.bottom,
        modalLeft: modalRect.left,
        modalRight: modalRect.right,
      };
    });
    expect(bounds.popLeft).toBeGreaterThanOrEqual(bounds.modalLeft);
    expect(bounds.popRight).toBeLessThanOrEqual(bounds.modalRight);
    expect(bounds.popTop).toBeGreaterThanOrEqual(8);
    expect(bounds.popBottom).toBeLessThanOrEqual(844 - 8);
  });

  test("강의 표는 1100·1366·1920에서 가용 폭을 쓰고 390px에서는 표 안에서만 스크롤한다", async ({ page }) => {
    await seedLectureAdmin(page);
    await page.goto(`${BASE}/workspace/lectures`, { waitUntil: "domcontentloaded" });

    for (const width of [1100, 1366, 1920]) {
      await page.setViewportSize({ width, height: width === 1100 ? 800 : 900 });
      const metrics = await page.locator("main table").evaluate((table) => {
        const rect = table.getBoundingClientRect();
        const owner = table.parentElement!;
        return {
          tableWidth: rect.width,
          ownerWidth: owner.getBoundingClientRect().width,
          documentScrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      expect(metrics.tableWidth).toBeGreaterThanOrEqual(metrics.ownerWidth - 1);
      expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.locator("main table").evaluate((table) => {
      const owner = table.parentElement!;
      return {
        tableWidth: table.getBoundingClientRect().width,
        ownerWidth: owner.getBoundingClientRect().width,
        ownerScrollWidth: owner.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(mobile.tableWidth).toBeGreaterThan(mobile.ownerWidth);
    expect(mobile.ownerScrollWidth).toBeGreaterThan(mobile.ownerWidth);
    expect(mobile.documentScrollWidth).toBeLessThanOrEqual(390);
  });

  test("차시 편집 dialog는 1100px main 영역 안에서 trigger 방향으로 열린다", async ({ page }) => {
    await seedLectureAdmin(page);
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto(`${BASE}/workspace/lectures/101`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "차시 설정", exact: true }).click();
    await page.getByRole("button", { name: "수정", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "차시 설정 편집" });
    const result = await dialog.evaluate((element) => {
      const main = document.querySelector("main")!.getBoundingClientRect();
      const trigger = document.querySelector('[aria-label="차시 설정"]')!.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return { dialogLeft: rect.left, dialogRight: rect.right, mainLeft: main.left, triggerLeft: trigger.left };
    });
    expect(result.dialogLeft).toBeGreaterThanOrEqual(result.mainLeft);
    expect(result.dialogLeft).toBeGreaterThanOrEqual(result.triggerLeft - 1);
    expect(result.dialogRight).toBeLessThanOrEqual(1100 - 8);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "차시 설정", exact: true })).toBeFocused();
  });
});

import type { Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function seed(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "기능 검색 route-mock 검증은 로컬 서버 전용",
  );
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
}

async function installApi(page: Page, role = "admin", payrollManager = true) {
  const state = { failPermissions: false, memo: "", patches: 0 };
  const inquiry = () => ({ id: 91, name: "QA 기능 찾기", phone: "01000000000", interest: "수강 상담", message: "QA 문의",
    source: "qa", created_at: "2026-10-10T09:00:00+09:00", read_at: null, admin_memo: state.memo });
  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/token/refresh/") {
      const access = localJwt();
      return json({ access, refresh: `${access}-refresh` });
    }
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: false,
        display_name: "학원플러스",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "admin",
        name: "관리자",
        phone: null,
        is_staff: true,
        is_superuser: false,
        tenantRole: role,
        must_change_password: false,
      });
    }
    if (path === "/staffs/me/") {
      if (state.failPermissions) return route.fulfill({ status: 400, json: { detail: "QA 권한 조회 실패" } });
      return json({ id: 12, is_payroll_manager: payrollManager });
    }
    if (path === "/core/landing/admin/consult/") {
      const params = new URL(route.request().url()).searchParams;
      const summary = { total: 1, unread: 1 };
      if (params.get("summary_only") === "true") return json({ items: [], summary });
      return json({ items: [inquiry()], summary, pagination: { page: 1, page_size: 50, pages: 1, count: 1, has_next: false, has_previous: false } });
    }
    if (path === "/core/landing/admin/consult/91/" && route.request().method() === "PATCH") {
      state.memo = route.request().postDataJSON().admin_memo;
      state.patches += 1;
      return json({ ok: true });
    }
    if (path === "/staffs/currently-working/") return json([]);
    if (path === "/lectures/attendance/arrival-overview/") {
      return json({
        today: "2026-08-12",
        range_end: "2026-08-18",
        range_days: 7,
        summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 },
        items: [],
      });
    }
    if (path.includes("pending-count") || path.includes("unread-count")) return json({ count: 0 });
    return json({ count: 0, results: [] });
  });
  return state;
}

test.describe("업무 화면 기능 검색", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await installApi(page);
    await installLocalAuthApiStubs(page);
  });

  test("데스크톱에서 검색·키보드 이동·최근 사용을 복원한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: "기능 검색" })).toBeVisible();
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: "기능 검색" });
    await expect(dialog).toBeVisible();

    const search = dialog.getByRole("textbox", { name: "메뉴 검색" });
    await expect(search).toBeFocused();
    await search.fill("매뉴얼");
    await expect(dialog.getByRole("button", { name: /가이드 메인/ })).toBeVisible();
    await search.press("Enter");
    await expect(page).toHaveURL(/\/workspace\/guide(?:\/|$)/);

    await expect(page.getByRole("button", { name: "기능 검색" })).toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(dialog.getByRole("heading", { name: "최근 사용" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /가이드 메인/ }).first()).toBeVisible();
    await page.keyboard.press("Escape");

    await page.reload();
    await expect(page.getByRole("button", { name: "기능 검색" })).toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(dialog.getByRole("heading", { name: "최근 사용" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /가이드 메인/ }).first()).toBeVisible();
  });

  test("닫기 직후 재열기에서 지연된 native close는 최근 사용 대화상자를 닫지 않는다", async ({ page }) => {
    await page.addInitScript(() => {
      const held: Array<{ dialog: HTMLDialogElement; event: Event }> = [];
      let deferClose = true;
      document.addEventListener("close", (event) => {
        const dialog = event.target;
        if (!deferClose || !(dialog instanceof HTMLDialogElement)
          || dialog.getAttribute("aria-labelledby") !== "quick-navigation-title") return;
        event.stopImmediatePropagation();
        held.push({ dialog, event });
      }, true);
      Object.assign(window, {
        pendingNavigationCloseEvents: () => held.length,
        releaseNavigationCloseEvents: () => {
          deferClose = false;
          const events = held.splice(0);
          // Replay only actual native close events after the dialog has reopened.
          events.forEach(({ dialog, event }) => dialog.dispatchEvent(event));
          return events.length;
        },
      });
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/dashboard`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "기능 검색" }).click();
    const dialog = page.getByRole("dialog", { name: "기능 검색" });
    const search = dialog.getByRole("textbox", { name: "메뉴 검색" });
    await expect(search).toBeFocused();
    await search.fill("매뉴얼");
    await expect(dialog.getByRole("button", { name: /가이드 메인/ })).toBeVisible();
    await search.press("Enter");
    await expect(page).toHaveURL(/\/workspace\/guide(?:\/|$)/);
    await expect(dialog).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => (
      window as unknown as { pendingNavigationCloseEvents: () => number }
    ).pendingNavigationCloseEvents())).toBe(1);

    await page.keyboard.press("Control+K");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "최근 사용" })).toBeVisible();
    expect(await page.evaluate(() => (
      window as unknown as { releaseNavigationCloseEvents: () => number }
    ).releaseNavigationCloseEvents())).toBe(1);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /가이드 메인/ }).first()).toBeVisible();

    // An actual native close still synchronizes parent state for the next shortcut.
    await dialog.evaluate((element) => new Promise<void>((resolve) => {
      element.addEventListener("close", () => {
        requestAnimationFrame(() => resolve());
      }, { once: true });
      (element as HTMLDialogElement).close();
    }));
    await expect(dialog).not.toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "기능 검색" }).click();
    await expect(dialog.getByRole("heading", { name: "최근 사용" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /가이드 메인/ }).first()).toBeVisible();
  });

  test("390px에서 중복 홈 대신 기능 검색을 제공하고 가로 넘침이 없다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/workspace/mobile`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("tc-topbar-go-dashboard")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "기능 검색" })).toBeVisible();
    await page.getByRole("button", { name: "기능 검색" }).focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "기능 검색" });
    const search = dialog.getByRole("textbox", { name: "메뉴 검색" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "기능 검색 닫기" })).toBeVisible();
    await search.fill("시험 묶음");
    await expect(dialog.getByRole("button", { name: /시험 묶음 자료·메시지/ })).toBeVisible();

    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      dialog: document.querySelector("[data-testid='quick-navigation-dialog']")?.scrollWidth ?? 0,
    }));
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);
    expect(overflow.dialog).toBeLessThanOrEqual(overflow.viewport);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  for (const width of [390, 1100, 1366]) {
    test(`업무 표현 검색으로 상담 메모 저장과 재조회까지 이어진다 ${width}px`, async ({ page }) => {
      const state = await installApi(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}/workspace/guide`, { waitUntil: "domcontentloaded" });
      if (width === 390) await page.getByRole("button", { name: "메뉴", exact: true }).click();
      await page.getByRole("button", { name: "기능 검색", exact: true }).click();
      const finder = page.getByRole("dialog", { name: "기능 검색", exact: true });
      await finder.getByRole("textbox", { name: "메뉴 검색" }).fill("상담 신청");
      const target = finder.getByRole("button", { name: /상담 수신함/ });
      await expect(target).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`feature-search-${width}.png`) });
      await target.click();
      await expect(page).toHaveURL(/\/workspace\/settings\/consult$/);
      const row = page.getByRole("article", { name: "상담 요청 QA 기능 찾기", exact: true });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "+ 메모 추가", exact: true }).click();
      await row.getByPlaceholder("처리 메모", { exact: true }).fill("검색에서 찾은 상담 업무\n다음 연락 일정");
      await row.getByRole("button", { name: "저장", exact: true }).click();
      await expect(row.getByText("검색에서 찾은 상담 업무\n다음 연락 일정", { exact: true })).toBeVisible();
      await page.reload();
      await expect(row.getByText("검색에서 찾은 상담 업무\n다음 연락 일정", { exact: true })).toBeVisible();
      expect(state.patches).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  }

  test("기능 찾기는 현재 업무와 관계없이 목록을 열고 상세 검색에서 원래 모바일 화면으로 돌아온다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/workspace/mobile/guide`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    await page.getByRole("button", { name: "기능 찾기", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/mobile\/desktop-only$/);
    await expect(page.getByRole("heading", { name: "기능 찾기", exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("feature-hub-390.png"), fullPage: true });
    await page.getByRole("searchbox", { name: "전체 기능 검색" }).fill("학생 복원");
    await expect(page.getByRole("button", { name: /삭제 학생 복원/ })).toBeVisible();
    await page.getByRole("button", { name: "기능 검색", exact: true }).click();
    const finder = page.getByRole("dialog", { name: "기능 검색" });
    await finder.getByRole("textbox", { name: "메뉴 검색" }).fill("학생 복원");
    await finder.getByRole("button", { name: /삭제 학생 복원/ }).click();
    await expect(page).toHaveURL(/\/workspace\/students\/deleted$/);
    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    await page.getByRole("button", { name: "모바일 버전", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/mobile\/desktop-only$/);
  });

  test("가이드에서 세부 업무를 찾고 완료 후 같은 가이드로 복귀한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/workspace/mobile/guide`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "기능 검색", exact: true }).click();
    const finder = page.getByRole("dialog", { name: "기능 검색" });
    await finder.getByRole("textbox", { name: "메뉴 검색" }).fill("학생 복원");
    await finder.getByRole("button", { name: /삭제 학생 복원/ }).click();
    await expect(page).toHaveURL(/\/workspace\/students\/deleted$/);
    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    await page.getByRole("button", { name: "모바일 버전", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/mobile\/guide$/);
  });

  test("일반 직원의 검색 결과에는 분석·검수·급여 목적지가 없다", async ({ page }) => {
    await installApi(page, "staff", false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/workspace/mobile`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "기능 검색", exact: true }).click();
    const finder = page.getByRole("dialog", { name: "기능 검색" });
    for (const name of ["매치업 분석", "적중 보고서", "문제 매칭 제안", "확정 급여·정산 내역"]) {
      await expect(finder.getByRole("button", { name: new RegExp(name) })).toHaveCount(0);
    }
    await expect(finder.getByRole("button", { name: /자료실 전체/ })).toBeVisible();
  });

  test("권한 조회 실패를 안내하고 검색어를 보존한 재시도 뒤 키보드로 급여 기능을 선택한다", async ({ page }) => {
    const state = await installApi(page);
    state.failPermissions = true;
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/workspace/guide`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "기능 검색", exact: true }).click();
    const finder = page.getByRole("dialog", { name: "기능 검색" });
    const search = finder.getByRole("textbox", { name: "메뉴 검색" });
    await search.fill("세전 세후");
    await expect(finder.getByRole("alert")).toContainText("권한 정보를 불러오지 못해");
    await expect(finder.getByRole("button", { name: /확정 급여·정산 내역/ })).toHaveCount(0);
    await search.press("ArrowDown");
    state.failPermissions = false;
    await finder.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(search).toHaveValue("세전 세후");
    await expect(finder.getByRole("button", { name: /확정 급여·정산 내역/ })).toBeVisible();
    await search.press("Enter");
    await expect(page).toHaveURL(/\/workspace\/staff\/payroll-snapshot$/);
  });

});

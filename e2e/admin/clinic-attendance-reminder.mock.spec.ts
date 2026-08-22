import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

function todayLocalISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type Participant = {
  id: number;
  session: number;
  student: number;
  student_name: string;
  status: "booked" | "attended" | "no_show";
  completed_at: string | null;
  session_date: string;
  session_start_time: string;
  session_location: string;
};

type ApiState = {
  participants: Participant[];
  remindIds: number[];
  attendancePayloads: Array<{ id: number; status: string }>;
};

async function seed(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "클리닉 운영 route-mock 검증은 로컬 dev 서버 전용",
  );
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
}

async function installApi(page: Page, state: ApiState, date: string) {
  const session = {
    id: 701,
    title: "당일 보강 클리닉",
    date,
    start_time: "18:00:00",
    duration_minutes: 90,
    location: "3층 보강실",
    max_participants: 12,
    participant_count: state.participants.length,
    booked_count: state.participants.filter((row) => row.status === "booked").length,
    pending_count: 0,
    booked_confirmed_count: state.participants.filter((row) => row.status === "booked").length,
    no_show_count: state.participants.filter((row) => row.status === "no_show").length,
  };

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "clinic-assistant",
        name: "클리닉 조교",
        is_staff: true,
        is_superuser: false,
        tenantRole: "teacher",
        must_change_password: false,
      });
    }
    if (path === "/clinic/sessions/tree/" && method === "GET") return json([session]);
    if (path === "/clinic/sessions/" && method === "GET") return json([session]);
    if (path === "/clinic/participants/" && method === "GET") {
      return json({ count: state.participants.length, results: state.participants });
    }
    const statusMatch = path.match(/^\/clinic\/participants\/(\d+)\/set_status\/$/);
    if (statusMatch && method === "PATCH") {
      const id = Number(statusMatch[1]);
      const payload = request.postDataJSON() as { status: string };
      state.attendancePayloads.push({ id, status: payload.status });
      const participant = state.participants.find((row) => row.id === id);
      if (!participant) return json({ detail: "not found" }, 404);
      participant.status = "attended";
      participant.completed_at = null;
      return json(participant);
    }
    const remindMatch = path.match(/^\/clinic\/participants\/(\d+)\/remind\/$/);
    if (remindMatch && method === "POST") {
      const id = Number(remindMatch[1]);
      state.remindIds.push(id);
      if (id === 503) {
        return json({ detail: "재촉 알림톡을 보내지 못했습니다. 알림 설정과 학생 전화번호를 확인해 주세요." }, 503);
      }
      return json({ ok: true, status: "ok", sent: 1, skipped: 0 });
    }
    if (path === "/messaging/auto-send/" && method === "GET") {
      return json([
        { trigger: "clinic_check_in", enabled: true, template_body: "참석 안내" },
        { trigger: "clinic_reminder", enabled: true, template_body: "클리닉에 참석해 주세요." },
      ]);
    }
    if (path === "/results/admin/clinic-targets/") return json([]);
    if (path === "/lectures/sections/" || path === "/staffs/currently-working/") return json([]);
    if (path.startsWith("/community/") || path.startsWith("/student/notifications/")) {
      return json({ count: 0, results: [] });
    }
    return json({ count: 0, results: [] });
  });
}

test.use({ serviceWorkers: "block" });

test("클리닉 운영은 불참 입력 없이 참석 복구와 단일 학생 재촉을 제공한다", async ({ page }, testInfo) => {
  const date = todayLocalISO();
  const state: ApiState = {
    participants: [
      {
        id: 501,
        session: 701,
        student: 1001,
        student_name: "예약 학생",
        status: "booked",
        completed_at: null,
        session_date: date,
        session_start_time: "18:00:00",
        session_location: "3층 보강실",
      },
      {
        id: 502,
        session: 701,
        student: 1002,
        student_name: "오입력 학생",
        status: "no_show",
        completed_at: `${date}T18:35:00+09:00`,
        session_date: date,
        session_start_time: "18:00:00",
        session_location: "3층 보강실",
      },
      {
        id: 503,
        session: 701,
        student: 1003,
        student_name: "설정 확인 학생",
        status: "booked",
        completed_at: null,
        session_date: date,
        session_start_time: "18:00:00",
        session_location: "3층 보강실",
      },
    ],
    remindIds: [],
    attendancePayloads: [],
  };

  await seed(page);
  await installApi(page, state, date);
  await page.setViewportSize({ width: 1366, height: 850 });
  await gotoAndSettle(page, `${BASE}/workspace/clinic/operations?date=${date}&session=701`, { timeout: 45_000 });

  const bookedCard = page.locator(".clinic-ops__card").filter({ hasText: "예약 학생" });
  const legacyCard = page.locator(".clinic-ops__card").filter({ hasText: "오입력 학생" });
  const failedCard = page.locator(".clinic-ops__card").filter({ hasText: "설정 확인 학생" });
  await expect(bookedCard.getByRole("button", { name: "참석하기" })).toBeVisible();
  await expect(bookedCard.getByRole("button", { name: "예약 학생 학생 재촉하기" })).toBeVisible();
  await expect(bookedCard.getByRole("button", { name: "클리닉 완료" })).toHaveCount(0);
  await expect(legacyCard.getByRole("button", { name: "기존 불참 기록을 참석으로 수정" })).toBeVisible();
  await expect(page.getByRole("button", { name: "불참", exact: true })).toHaveCount(0);
  await expect(legacyCard.getByText("클리닉 완료", { exact: true })).toHaveCount(0);
  await expect(page.locator(".clinic-ops__kpi--completed")).toContainText("0");

  await bookedCard.getByRole("button", { name: "예약 학생 학생 재촉하기" }).click();
  await expect.poll(() => state.remindIds).toEqual([501]);
  await expect(page.getByText("예약 학생 학생에게 재촉 알림톡을 요청했습니다.", { exact: true })).toBeVisible();

  await failedCard.getByRole("button", { name: "설정 확인 학생 학생 재촉하기" }).click();
  await expect.poll(() => state.remindIds).toEqual([501, 503]);
  await expect(page.getByText(/알림 설정과 학생 전화번호를 확인/)).toBeVisible();

  await legacyCard.getByRole("button", { name: "기존 불참 기록을 참석으로 수정" }).click();
  await legacyCard.getByRole("button", { name: "참석 확정 및 알림 발송" }).click();
  await expect.poll(() => state.attendancePayloads).toEqual([{ id: 502, status: "attended" }]);
  await expect(page.getByRole("heading", { name: "참석 처리 완료" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(bookedCard).toBeVisible();
  const mobileActions = bookedCard.locator(".clinic-ops__card-actions button");
  for (let index = 0; index < await mobileActions.count(); index += 1) {
    const box = await mobileActions.nth(index).boundingBox();
    expect(box?.height ?? 0, `mobile clinic action ${index}`).toBeGreaterThanOrEqual(43.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await bookedCard.scrollIntoViewIfNeeded();
  await bookedCard.screenshot({ path: testInfo.outputPath("clinic-attendance-reminder-390.png") });
});

test("조교 모바일 클리닉도 참석하기와 재촉하기만 노출한다", async ({ page }) => {
  const date = todayLocalISO();
  const state: ApiState = {
    participants: [
      {
        id: 601,
        session: 701,
        student: 1101,
        student_name: "모바일 예약 학생",
        status: "booked",
        completed_at: null,
        session_date: date,
        session_start_time: "18:00:00",
        session_location: "3층 보강실",
      },
      {
        id: 602,
        session: 701,
        student: 1102,
        student_name: "모바일 오입력 학생",
        status: "no_show",
        completed_at: null,
        session_date: date,
        session_start_time: "18:00:00",
        session_location: "3층 보강실",
      },
    ],
    remindIds: [],
    attendancePayloads: [],
  };

  await seed(page);
  await installApi(page, state, date);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/mobile/clinic`, { timeout: 45_000 });
  await page.getByRole("button", { name: /당일 보강 클리닉/ }).click();

  await expect(page.getByRole("button", { name: "참석하기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "재촉하기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "참석으로 수정" })).toBeVisible();
  await expect(page.getByRole("button", { name: /불참|결석/ })).toHaveCount(0);

  const actionButtons = page.getByRole("button", { name: /참석하기|재촉하기|참석으로 수정/ });
  for (let index = 0; index < await actionButtons.count(); index += 1) {
    const box = await actionButtons.nth(index).boundingBox();
    expect(box?.height ?? 0, `teacher clinic action ${index}`).toBeGreaterThanOrEqual(43.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

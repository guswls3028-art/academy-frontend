import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 9951;
const REGULAR_SESSION_ID = 9952;
const SUPPLEMENT_SESSION_ID = 9953;

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type MockState = {
  supplementTitle: string;
  patchTitles: string[];
  sessionListFailures?: number;
  sessionListRequests?: number;
};

function sessionRows(state: MockState) {
  return [
    {
      id: REGULAR_SESSION_ID,
      lecture: LECTURE_ID,
      title: "1차시 (14:00~16:00)",
      display_label: "1차시",
      order: 1,
      regular_order: 1,
      session_type: "REGULAR",
      date: "2026-08-01",
    },
    {
      id: SUPPLEMENT_SESSION_ID,
      lecture: LECTURE_ID,
      title: state.supplementTitle,
      display_label: state.supplementTitle,
      order: 2,
      regular_order: null,
      session_type: "SUPPLEMENT",
      date: "2026-08-02",
    },
  ];
}

async function installApi(page: Page, state: MockState) {
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
        isPlatformAdmin: true,
        display_name: "학원플러스",
        feature_flags: { section_mode: false },
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path === `/lectures/lectures/${LECTURE_ID}/`) {
      return json({
        id: LECTURE_ID,
        title: "고1 Hyper 정규반",
        name: "김준혁",
        subject: "수학",
        start_date: "2026-08-01",
        end_date: "2026-09-30",
        lecture_time: "토 14:00~16:00",
      });
    }
    if (path === "/lectures/sessions/" && method === "GET") {
      state.sessionListRequests = (state.sessionListRequests ?? 0) + 1;
      if ((state.sessionListFailures ?? 0) > 0) {
        state.sessionListFailures = (state.sessionListFailures ?? 0) - 1;
        return json({ detail: "일시적으로 수업 목록을 불러올 수 없습니다." }, 503);
      }
      return json(sessionRows(state));
    }
    if (path === `/lectures/sessions/${REGULAR_SESSION_ID}/`) {
      return json(sessionRows(state)[0]);
    }
    if (path === `/lectures/sessions/${SUPPLEMENT_SESSION_ID}/` && method === "PATCH") {
      const payload = request.postDataJSON() as { title?: string };
      if (payload.title) {
        state.supplementTitle = payload.title;
        state.patchTitles.push(payload.title);
      }
      return json(sessionRows(state)[1]);
    }
    if (path === `/lectures/sessions/${SUPPLEMENT_SESSION_ID}/`) {
      return json(sessionRows(state)[1]);
    }
    if (path === "/lectures/sections/") return json([]);
    if (path === "/enrollments/") return json([]);
    if (path === "/enrollments/session-enrollments/") return json([]);
    if (path === "/lectures/attendance/") return json({ count: 0, results: [] });
    if (path === "/results/admin/clinic-targets/") return json([]);
    if (path === "/staffs/currently-working/") return json([]);
    return json({ count: 0, results: [] });
  });
}

async function openLecture(page: Page, state: MockState) {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "강의 수업 구분 route-mock 검증은 로컬 dev 서버 전용");
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());
  await installApi(page, state);
  await page.goto(`${BASE}/workspace/lectures/${LECTURE_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await expect(page.getByRole("tab", { name: /정규 수업/ })).toBeVisible();
}

test("정규 수업과 보강을 따로 진입하고 보강 이름을 수정·재조회한다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉 (10:00~12:00)",
    patchTitles: [],
  };
  await openLecture(page, state);

  const regularTab = page.getByRole("tab", { name: /정규 수업/ });
  const supplementTab = page.getByRole("tab", { name: /^보강/ });
  await expect(regularTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /1차시/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /토요일 심화 클리닉/ })).toHaveCount(0);

  await supplementTab.click();
  await expect(supplementTab).toHaveAttribute("aria-selected", "true");
  const supplementCard = page.getByRole("button", { name: /토요일 심화 클리닉/ });
  await expect(supplementCard).toBeVisible();
  await expect(page.getByRole("button", { name: /1차시/ })).toHaveCount(0);

  await supplementCard.click();
  await expect(page).toHaveURL(new RegExp(`/workspace/lectures/${LECTURE_ID}/sessions/${SUPPLEMENT_SESSION_ID}/attendance`));
  await page.getByRole("button", { name: "보강 설정" }).click();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await page.getByLabel("보강 이름").fill("일요일 취약 단원 클리닉");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  await expect.poll(() => state.patchTitles).toEqual(["일요일 취약 단원 클리닉"]);
  await expect(page.getByRole("button", { name: /일요일 취약 단원 클리닉/ })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /일요일 취약 단원 클리닉/ })).toBeVisible();

  await page.getByRole("tab", { name: /정규 수업/ }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/lectures/${LECTURE_ID}/sessions/${REGULAR_SESSION_ID}/attendance`));
});

test("보강 범위의 추가 버튼은 보강 유형과 이름 입력을 바로 연다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
  };
  await openLecture(page, state);

  await page.getByRole("tab", { name: /^보강/ }).click();
  await page.getByRole("button", { name: "보강 추가" }).click();

  await expect(page.getByLabel("보강 이름")).toHaveValue("보강");
  await expect(page.getByRole("button", { name: /보강 차시 · 날짜·시간 직접 선택/ })).toHaveAttribute("aria-pressed", "true");
});

test("수업 목록 조회 실패는 기존 화면을 비우지 않고 다시 불러온다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
    sessionListFailures: 10,
  };
  await openLecture(page, state);

  const error = page.getByRole("alert");
  await expect(error).toContainText("수업 목록을 불러오지 못했습니다.");
  state.sessionListFailures = 0;
  await error.getByRole("button", { name: "다시 불러오기" }).click();

  await expect(page.getByRole("button", { name: /1차시/ })).toBeVisible();
  await expect.poll(() => state.sessionListRequests).toBeGreaterThanOrEqual(2);
});

test("수업 구분과 보강 이름은 1366·1100·390px에서 접근 가능하다", async ({ page }) => {
  const state: MockState = {
    supplementTitle: "토요일 심화 클리닉",
    patchTitles: [],
  };

  for (const viewport of [
    { width: 1366, height: 850 },
    { width: 1100, height: 760 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openLecture(page, state);
    await page.getByRole("tab", { name: /^보강/ }).click();
    await expect(page.getByRole("button", { name: /토요일 심화 클리닉/ })).toBeVisible();
  }
});

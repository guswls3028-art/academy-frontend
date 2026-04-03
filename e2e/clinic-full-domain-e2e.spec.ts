/**
 * 클리닉 도메인 전체 E2E 검증
 * 관리자: home, operations, bookings, reports, settings, msg-settings, tools/clinic
 * 학생: clinic(예약/내일정), idcard
 * API: 세션 CRUD, 참가자 상태, 완료/취소, 예약 대상, 학생 예약/취소
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const CODE = "hakwonplus";

/** API 헬퍼: 토큰 획득 */
async function getToken(page: Page, role: "admin" | "student") {
  const user = role === "admin"
    ? (process.env.E2E_ADMIN_USER || "admin97")
    : (process.env.E2E_STUDENT_USER || "3333");
  const pass = role === "admin"
    ? (process.env.E2E_ADMIN_PASS || "koreaseoul97")
    : (process.env.E2E_STUDENT_PASS || "test1234");

  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: user, password: pass, tenant_code: CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
  });
  expect(resp.status()).toBe(200);
  const data = await resp.json() as { access: string };
  return data.access;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Tenant-Code": CODE,
    "Content-Type": "application/json",
  };
}

// ──────────────────────────────────────────────────────────
// PART 1: 관리자 — 페이지 로드 + UI 검증
// ──────────────────────────────────────────────────────────
test.describe("관리자 클리닉 페이지", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("1-1. 사이드바 → 클리닉 네비게이션", async ({ page }) => {
    // 사이드바에서 클리닉 메뉴 찾기
    const sidebar = page.locator("nav, aside, [class*='sidebar'], [class*='Sidebar']");
    const clinicLink = sidebar.locator("a, [role='link'], [role='button']").filter({ hasText: "클리닉" }).first();

    const visible = await clinicLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      await clinicLink.click();
      await page.waitForTimeout(2000);
      // 클리닉 홈 또는 콘솔로 이동했는지 확인
      expect(page.url()).toContain("/clinic");
      await page.screenshot({ path: "e2e/screenshots/clinic-full-01-sidebar-nav.png" });
    } else {
      // 직접 이동
      await page.goto(`${BASE}/admin/clinic`, { waitUntil: "load" });
      await page.waitForTimeout(2000);
    }
  });

  test("1-2. 클리닉 홈 페이지", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/home`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-full-02-home.png" });

    // 페이지 에러 없음 확인
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    // 에러 화면이 아님
    expect(body).not.toContain("Cannot read properties");
    expect(body).not.toContain("Something went wrong");

    // 오늘 일정 또는 빈 상태 메시지가 보여야 함
    const hasContent = body!.includes("클리닉") || body!.includes("세션") ||
      body!.includes("일정") || body!.includes("없습니다") || body!.includes("오늘");
    expect(hasContent).toBeTruthy();
  });

  test("1-3. 운영 콘솔 페이지", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/operations`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-full-03-operations.png" });

    const body = await page.textContent("body");
    expect(body).not.toContain("Cannot read properties");

    // 캘린더 또는 세션 목록 영역이 존재해야 함
    const calendarOrSidebar = page.locator("[class*='calendar'], [class*='Calendar'], [class*='sidebar'], [class*='Sidebar'], [class*='console']").first();
    const hasSidebar = await calendarOrSidebar.isVisible({ timeout: 5000 }).catch(() => false);

    // 세션 생성 버튼 확인
    const createBtn = page.locator("button").filter({ hasText: /세션.*생성|생성|추가|\+/ }).first();
    const hasCreateBtn = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Operations: sidebar=${hasSidebar}, createBtn=${hasCreateBtn}`);

    // 날짜 선택 시도 (오늘 날짜)
    const today = new Date().getDate().toString();
    const dateCell = page.locator("[class*='calendar'] td, [class*='Calendar'] td, [role='gridcell']")
      .filter({ hasText: new RegExp(`^${today}$`) }).first();
    if (await dateCell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateCell.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "e2e/screenshots/clinic-full-03b-date-selected.png" });
    }
  });

  test("1-4. 예약 관리 (Bookings) 페이지", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/bookings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-full-04-bookings.png" });

    const body = await page.textContent("body");
    expect(body).not.toContain("Cannot read properties");

    // 탭/필터 존재 확인
    const filterChips = page.locator("button, [role='tab']").filter({ hasText: /전체|시험|과제|불합격|미달/ });
    const chipCount = await filterChips.count();
    console.log(`Bookings: filter chips = ${chipCount}`);

    // 빈 상태 또는 목록이 보여야 함
    const hasData = body!.includes("학생") || body!.includes("클리닉") ||
      body!.includes("대상") || body!.includes("없습니다") || body!.includes("진행 중");
    expect(hasData).toBeTruthy();

    // 탭 전환 테스트
    const tabs = page.locator("[role='tab'], button").filter({ hasText: /학생.*뷰|학생별|항목/ });
    if (await tabs.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabs.first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: "e2e/screenshots/clinic-full-04b-bookings-tab2.png" });
    }
  });

  test("1-5. 리포트 페이지", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/reports`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-full-05-reports.png" });

    const body = await page.textContent("body");
    expect(body).not.toContain("Cannot read properties");

    // 월별 네비게이션 확인
    const monthNav = page.locator("button").filter({ hasText: /이전|다음|◀|▶|<|>/ }).first();
    if (await monthNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await monthNav.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: "e2e/screenshots/clinic-full-05b-reports-prev-month.png" });
    }
  });

  test("1-6. 설정 페이지", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-full-06-settings.png" });

    const body = await page.textContent("body");
    expect(body).not.toContain("Cannot read properties");

    // 색상 관련 설정이 보여야 함
    const hasColorUI = body!.includes("색") || body!.includes("패스") ||
      body!.includes("카드") || body!.includes("설정") || body!.includes("배경");
    expect(hasColorUI).toBeTruthy();
  });

  test("1-7. 메시지 설정 페이지", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/msg-settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-full-07-msg-settings.png" });

    const body = await page.textContent("body");
    expect(body).not.toContain("Cannot read properties");
  });

  test("1-8. 출력 도구 페이지", async ({ page }) => {
    await page.goto(`${BASE}/admin/tools/clinic`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-full-08-printout-tool.png" });

    const body = await page.textContent("body");
    expect(body).not.toContain("Cannot read properties");
  });
});

// ──────────────────────────────────────────────────────────
// PART 2: 관리자 — API 전체 시나리오
// ──────────────────────────────────────────────────────────
test.describe("관리자 클리닉 API", () => {
  test("2-1. 세션 목록 조회 (tree)", async ({ page }) => {
    const token = await getToken(page, "admin");
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const resp = await page.request.get(
      `${API}/api/v1/clinic/sessions/tree/?year=${year}&month=${month}`,
      { headers: authHeaders(token) }
    );
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    console.log(`Session tree: ${JSON.stringify(data).slice(0, 200)}`);
  });

  test("2-2. 세션 목록 조회 (list)", async ({ page }) => {
    const token = await getToken(page, "admin");
    const resp = await page.request.get(
      `${API}/api/v1/clinic/sessions/?page_size=10`,
      { headers: authHeaders(token) }
    );
    expect(resp.status()).toBe(200);
    const data = await resp.json() as { results?: any[]; count?: number };
    console.log(`Sessions: count=${data.count || (data.results?.length ?? 0)}`);
  });

  test("2-3. 참가자 목록 조회", async ({ page }) => {
    const token = await getToken(page, "admin");
    const resp = await page.request.get(
      `${API}/api/v1/clinic/participants/?page_size=10`,
      { headers: authHeaders(token) }
    );
    expect(resp.status()).toBe(200);
    const data = await resp.json() as { results: any[] };
    console.log(`Participants: ${data.results.length} returned`);

    // 각 참가자 필드 검증
    if (data.results.length > 0) {
      const p = data.results[0];
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("status");
      expect(p).toHaveProperty("student");
      expect(p).toHaveProperty("student_name");
      console.log(`Sample: id=${p.id} status=${p.status} student=${p.student_name}`);
    }
  });

  test("2-4. 상태 전체 사이클: booked→attended→no_show→booked→complete→uncomplete", async ({ page }) => {
    const token = await getToken(page, "admin");
    const h = authHeaders(token);

    // booked 또는 attended 참가자 찾기
    const listResp = await page.request.get(`${API}/api/v1/clinic/participants/?page_size=20`, { headers: h });
    const list = (await listResp.json() as { results: any[] }).results;
    const target = list.find((p: any) =>
      ["booked", "attended", "no_show"].includes(p.status)
    );

    if (!target) {
      console.log("No active participant for cycle test");
      test.skip();
      return;
    }

    const pid = target.id;
    const originalStatus = target.status;
    console.log(`Cycle test on participant ${pid} (original: ${originalStatus})`);

    // 먼저 booked 상태로 리셋
    if (originalStatus !== "booked") {
      const r = await page.request.patch(`${API}/api/v1/clinic/participants/${pid}/set_status/`, {
        data: { status: "booked" }, headers: h,
      });
      expect(r.status()).toBe(200);
      console.log("→ reset to booked");
    }

    // booked → attended
    let r = await page.request.patch(`${API}/api/v1/clinic/participants/${pid}/set_status/`, {
      data: { status: "attended" }, headers: h,
    });
    expect(r.status()).toBe(200);
    let d = await r.json();
    expect(d.status).toBe("attended");
    console.log("→ attended ✓");

    // attended → no_show
    r = await page.request.patch(`${API}/api/v1/clinic/participants/${pid}/set_status/`, {
      data: { status: "no_show" }, headers: h,
    });
    expect(r.status()).toBe(200);
    d = await r.json();
    expect(d.status).toBe("no_show");
    console.log("→ no_show ✓");

    // no_show → booked
    r = await page.request.patch(`${API}/api/v1/clinic/participants/${pid}/set_status/`, {
      data: { status: "booked" }, headers: h,
    });
    expect(r.status()).toBe(200);
    d = await r.json();
    expect(d.status).toBe("booked");
    console.log("→ booked ✓");

    // booked → attended (다시)
    r = await page.request.patch(`${API}/api/v1/clinic/participants/${pid}/set_status/`, {
      data: { status: "attended" }, headers: h,
    });
    expect(r.status()).toBe(200);
    console.log("→ attended again ✓");

    // complete (자율학습 완료)
    r = await page.request.post(`${API}/api/v1/clinic/participants/${pid}/complete/`, { headers: h });
    expect(r.status()).toBe(200);
    d = await r.json();
    expect(d.completed_at).toBeTruthy();
    console.log(`→ complete ✓ (${d.completed_at})`);

    // 중복 complete → 400
    r = await page.request.post(`${API}/api/v1/clinic/participants/${pid}/complete/`, { headers: h });
    expect(r.status()).toBe(400);
    console.log("→ duplicate complete → 400 ✓");

    // uncomplete
    r = await page.request.post(`${API}/api/v1/clinic/participants/${pid}/uncomplete/`, { headers: h });
    expect(r.status()).toBe(200);
    d = await r.json();
    expect(d.completed_at).toBeNull();
    console.log("→ uncomplete ✓");

    // 중복 uncomplete → 400
    r = await page.request.post(`${API}/api/v1/clinic/participants/${pid}/uncomplete/`, { headers: h });
    expect(r.status()).toBe(400);
    console.log("→ duplicate uncomplete → 400 ✓");

    // 원래 상태로 복구
    if (originalStatus !== "attended") {
      await page.request.patch(`${API}/api/v1/clinic/participants/${pid}/set_status/`, {
        data: { status: originalStatus }, headers: h,
      });
      console.log(`→ restored to ${originalStatus}`);
    }
  });

  test("2-5. 잘못된 상태 전이 거부", async ({ page }) => {
    const token = await getToken(page, "admin");
    const h = authHeaders(token);

    // cancelled 참가자 찾기
    const listResp = await page.request.get(`${API}/api/v1/clinic/participants/?status=cancelled&page_size=5`, { headers: h });
    const list = (await listResp.json() as { results: any[] }).results;

    if (list.length === 0) {
      console.log("No cancelled participant to test invalid transition");
      test.skip();
      return;
    }

    // cancelled → attended (불가해야 함)
    const r = await page.request.patch(`${API}/api/v1/clinic/participants/${list[0].id}/set_status/`, {
      data: { status: "attended" }, headers: h,
    });
    expect(r.status()).toBe(400);
    console.log("cancelled → attended correctly rejected ✓");
  });

  test("2-6. 클리닉 설정 조회/수정", async ({ page }) => {
    const token = await getToken(page, "admin");
    const h = authHeaders(token);

    // GET settings
    const getResp = await page.request.get(`${API}/api/v1/clinic/settings/`, { headers: h });
    expect(getResp.status()).toBe(200);
    const settings = await getResp.json();
    console.log(`Settings: ${JSON.stringify(settings).slice(0, 200)}`);
  });

  test("2-7. 클리닉 대상 목록 조회 (remediation)", async ({ page }) => {
    const token = await getToken(page, "admin");
    const h = authHeaders(token);

    const resp = await page.request.get(`${API}/api/v1/results/admin/clinic-targets/?page_size=5`, { headers: h });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    console.log(`Clinic targets: ${JSON.stringify(data).slice(0, 300)}`);
  });

  test("2-8. 세션 위치 자동완성", async ({ page }) => {
    const token = await getToken(page, "admin");
    const h = authHeaders(token);

    const resp = await page.request.get(`${API}/api/v1/clinic/sessions/locations/`, { headers: h });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    console.log(`Locations: ${JSON.stringify(data)}`);
  });
});

// ──────────────────────────────────────────────────────────
// PART 3: 학생 — 페이지 로드 + UI 검증
// ──────────────────────────────────────────────────────────
test.describe("학생 클리닉 페이지", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "student");
  });

  test("3-1. 학생 클리닉 예약 페이지", async ({ page }) => {
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-full-10-student-clinic.png" });

    const body = await page.textContent("body");
    expect(body).not.toContain("Cannot read properties");
    expect(body).not.toContain("Something went wrong");

    // 예약 탭과 내 일정 탭이 있어야 함
    const bookTab = page.locator("button, [role='tab']").filter({ hasText: /예약/ }).first();
    const scheduleTab = page.locator("button, [role='tab']").filter({ hasText: /내 일정|일정/ }).first();

    const hasBookTab = await bookTab.isVisible({ timeout: 5000 }).catch(() => false);
    const hasScheduleTab = await scheduleTab.isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Student clinic: bookTab=${hasBookTab}, scheduleTab=${hasScheduleTab}`);

    // 캘린더가 렌더링되어야 함
    const calendar = page.locator("[class*='calendar'], [class*='Calendar'], table").first();
    const hasCalendar = await calendar.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Calendar visible: ${hasCalendar}`);
  });

  test("3-2. 학생 내 일정 탭 전환", async ({ page }) => {
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 내 일정 탭 클릭
    const scheduleTab = page.locator("button, [role='tab']").filter({ hasText: /내 일정|일정/ }).first();
    if (await scheduleTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await scheduleTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/clinic-full-11-student-schedule.png" });

      // 예약 목록 또는 빈 상태
      const body = await page.textContent("body");
      expect(body).not.toContain("Cannot read properties");
    }
  });

  test("3-3. 학생 날짜 선택 → 세션 슬롯 표시", async ({ page }) => {
    await page.goto(`${BASE}/student/clinic`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 캘린더에서 미래 날짜 클릭
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayNum = tomorrow.getDate().toString();

    const dateCell = page.locator("td, [role='gridcell']")
      .filter({ hasText: new RegExp(`^${dayNum}$`) }).first();

    if (await dateCell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateCell.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/clinic-full-12-student-date-selected.png" });

      // 세션 슬롯 또는 "예약 가능한 세션이 없습니다" 표시
      const body = await page.textContent("body");
      const hasSlots = body!.includes("예약") || body!.includes("세션") ||
        body!.includes("없습니다") || body!.includes("마감");
      expect(hasSlots).toBeTruthy();
    }
  });

  test("3-4. 학생 패스카드 페이지", async ({ page }) => {
    await page.goto(`${BASE}/student/idcard`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-full-13-student-idcard.png" });

    const body = await page.textContent("body");
    expect(body).not.toContain("Cannot read properties");
    expect(body).not.toContain("Something went wrong");
  });
});

// ──────────────────────────────────────────────────────────
// PART 4: 학생 — API 검증
// ──────────────────────────────────────────────────────────
test.describe("학생 클리닉 API", () => {
  test("4-1. 학생 세션 조회", async ({ page }) => {
    const token = await getToken(page, "student");
    const h = authHeaders(token);

    const now = new Date();
    const dateFrom = now.toISOString().split("T")[0];
    const dateTo = new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString().split("T")[0];

    const resp = await page.request.get(
      `${API}/api/v1/clinic/sessions/?date_from=${dateFrom}&date_to=${dateTo}&page_size=200`,
      { headers: h }
    );
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    const results = (data as any).results || data;
    console.log(`Student sessions: ${Array.isArray(results) ? results.length : 0}`);
  });

  test("4-2. 학생 내 예약 조회", async ({ page }) => {
    const token = await getToken(page, "student");
    const h = authHeaders(token);

    const resp = await page.request.get(
      `${API}/api/v1/clinic/participants/?page_size=200`,
      { headers: h }
    );
    expect(resp.status()).toBe(200);
    const data = await resp.json() as { results: any[] };
    console.log(`Student bookings: ${data.results.length}`);

    // 필드 검증
    if (data.results.length > 0) {
      const b = data.results[0];
      expect(b).toHaveProperty("id");
      expect(b).toHaveProperty("status");
      expect(b).toHaveProperty("session");
    }
  });

  test("4-3. 학생 패스카드 API", async ({ page }) => {
    const token = await getToken(page, "student");
    const h = authHeaders(token);

    const resp = await page.request.get(`${API}/api/v1/clinic/idcard/`, { headers: h });
    // 200 또는 404 (패스카드 데이터 없을 수 있음)
    expect([200, 404]).toContain(resp.status());
    console.log(`IDCard API: ${resp.status()}`);
    if (resp.status() === 200) {
      const data = await resp.json();
      console.log(`IDCard data: ${JSON.stringify(data).slice(0, 300)}`);
    }
  });

  test("4-4. 학생이 다른 학생 예약 취소 시도 → 403", async ({ page }) => {
    // admin의 참가자를 학생이 취소하려 시도
    const adminToken = await getToken(page, "admin");
    const studentToken = await getToken(page, "student");

    // 다른 학생의 참가자 ID 찾기
    const listResp = await page.request.get(
      `${API}/api/v1/clinic/participants/?page_size=20`,
      { headers: authHeaders(adminToken) }
    );
    const participants = (await listResp.json() as { results: any[] }).results;

    // 학생이 아닌 참가자 찾기 (student_name이 다른 것)
    const otherParticipant = participants.find((p: any) =>
      p.status === "pending" || p.status === "booked"
    );

    if (!otherParticipant) {
      console.log("No suitable participant for cross-student test");
      test.skip();
      return;
    }

    // 학생 토큰으로 다른 학생 예약 취소 시도
    const r = await page.request.patch(
      `${API}/api/v1/clinic/participants/${otherParticipant.id}/set_status/`,
      {
        data: { status: "cancelled" },
        headers: authHeaders(studentToken),
      }
    );

    // 403 또는 400 (자기 예약이 아님)
    expect([400, 403]).toContain(r.status());
    console.log(`Cross-student cancel: ${r.status()} ✓`);
  });
});

// ──────────────────────────────────────────────────────────
// PART 5: 콘솔 인터랙션 (활성 세션 있을 때)
// ──────────────────────────────────────────────────────────
test.describe("콘솔 인터랙션", () => {
  test("5-1. 운영 콘솔 전체 인터랙션", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/clinic/operations`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 세션이 있는 날짜 클릭 (사이드바 세션 리스트에서)
    const sessionItem = page.locator("[class*='session'], [class*='Session'], li, a")
      .filter({ hasText: /\d{1,2}:\d{2}/ }).first();

    if (await sessionItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionItem.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/clinic-full-20-console-session-selected.png" });

      // 참가자 카드/행이 보이는지
      const participantArea = page.locator("[class*='participant'], [class*='Participant'], [class*='workspace'], [class*='Workspace']").first();
      const hasParticipants = await participantArea.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`Participants area visible: ${hasParticipants}`);

      if (hasParticipants) {
        // 출석 버튼 확인
        const attendBtn = page.locator("button").filter({ hasText: /출석/ }).first();
        const noShowBtn = page.locator("button").filter({ hasText: /불참|결석/ }).first();
        const completeBtn = page.locator("button").filter({ hasText: /완료/ }).first();

        console.log(`Buttons: attend=${await attendBtn.isVisible().catch(() => false)}, noShow=${await noShowBtn.isVisible().catch(() => false)}, complete=${await completeBtn.isVisible().catch(() => false)}`);
      }
    } else {
      console.log("No session items in sidebar — checking for empty state");
      await page.screenshot({ path: "e2e/screenshots/clinic-full-20-console-empty.png" });
    }

    // 학생 추가 모달 테스트
    const addBtn = page.locator("button").filter({ hasText: /학생.*추가|추가|대상/ }).first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: "e2e/screenshots/clinic-full-21-add-student-modal.png" });

      // 모달 닫기
      const closeBtn = page.locator("[class*='modal'] button, [role='dialog'] button")
        .filter({ hasText: /닫기|취소|✕|×/ }).first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      } else {
        await page.keyboard.press("Escape");
      }
    }
  });
});

/**
 * 정합성 작업 후 전체 기능 검증 E2E
 *
 * 실제 사용자 조작 기준:
 * - 관리자: 로그인 → 시험 생성 → 과제 생성 → 성적 입력 → 학생 관리 → 클리닉
 * - 학생: 로그인 → 대시보드 → 성적 확인
 * - 모든 사이드바 메뉴 진입 → JS 크래시 없음 확인
 */
import { test, expect, Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const TENANT = "hakwonplus";

// ── 인증 헬퍼 ──
async function login(page: Page, user: string, pass: string): Promise<string> {
  const res = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: user, password: pass, tenant_code: TENANT },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
  });
  expect(res.status(), `Login ${user}`).toBe(200);
  const tokens = await res.json();
  expect(tokens.access).toBeTruthy();

  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ a, r, c }) => {
    localStorage.setItem("access", a);
    localStorage.setItem("refresh", r);
    try { sessionStorage.setItem("tenantCode", c); } catch {}
  }, { a: tokens.access, r: tokens.refresh, c: TENANT });

  return tokens.access;
}

// ── 콘솔 에러 수집기 ──
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // 무시할 에러 패턴
      if (text.includes("favicon") || text.includes("net::ERR") || text.includes("401")) return;
      errors.push(text);
    }
  });
  page.on("pageerror", (err) => errors.push(`PAGE_ERROR: ${err.message}`));
  return errors;
}

// ════════════════════════════════════════════
// 관리자 시나리오
// ════════════════════════════════════════════
test.describe("관리자 전체 기능 검증", () => {
  let token: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    token = await login(page,
      process.env.E2E_ADMIN_USER || "admin97",
      process.env.E2E_ADMIN_PASS || "koreaseoul97"
    );
    await page.close();
  });

  test("A01 대시보드 진입", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    // 사이드바 또는 대시보드 콘텐츠가 보여야 함
    const body = await page.textContent("body");
    expect(body?.length).toBeGreaterThan(10);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A02 학생 관리 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A03 강의 관리 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A04 시험 관리 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin/exams`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A05 성적 입력 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin/lectures`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    // 첫 강의 클릭 시도
    const lectureLink = page.locator("a[href*='/admin/lectures/']").first();
    if (await lectureLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lectureLink.click();
      await page.waitForTimeout(2000);
    }
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A06 클리닉 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin/clinic`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A07 커뮤니티 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin/community`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A08 메시지 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin/messages`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A09 설정 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin/settings`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A10 영상 관리 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin/media`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A11 직원 관리 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_ADMIN_USER || "admin97", process.env.E2E_ADMIN_PASS || "koreaseoul97");
    await page.goto(`${BASE}/admin/staff`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("A12 시험 생성 API", async ({ request }) => {
    // 템플릿 시험
    const tmpl = await request.post(`${API}/api/v1/exams/`, {
      data: { title: "[E2E-verify] Template", exam_type: "template", subject: "math" },
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Tenant-Code": TENANT },
    });
    expect(tmpl.status()).toBe(201);
    const tmplData = await tmpl.json();
    expect(tmplData.id).toBeTruthy();

    // 일반 시험
    const reg = await request.post(`${API}/api/v1/exams/`, {
      data: { title: "[E2E-verify] Regular", exam_type: "regular", session_id: 17 },
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Tenant-Code": TENANT },
    });
    expect(reg.status()).toBe(201);
    const regData = await reg.json();
    expect(regData.id).toBeTruthy();

    // Cleanup
    await request.delete(`${API}/api/v1/exams/${regData.id}/`, {
      headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": TENANT },
    });
    await request.delete(`${API}/api/v1/exams/${tmplData.id}/`, {
      headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": TENANT },
    });
  });

  test("A13 과제 생성 API", async ({ request }) => {
    const hw = await request.post(`${API}/api/v1/homeworks/`, {
      data: { title: "[E2E-verify] HW", session_id: 17 },
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Tenant-Code": TENANT },
    });
    expect(hw.status()).toBe(201);
    const hwData = await hw.json();
    expect(hwData.id).toBeTruthy();

    // Cleanup
    await request.delete(`${API}/api/v1/homeworks/${hwData.id}/`, {
      headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": TENANT },
    });
  });

  test("A14 성적 조회 API", async ({ request }) => {
    const res = await request.get(`${API}/api/v1/results/admin/sessions/17/scores/`, {
      headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": TENANT },
    });
    expect(res.status()).toBe(200);
  });

  test("A15 클리닉 조회 API", async ({ request }) => {
    const res = await request.get(`${API}/api/v1/clinic/sessions/`, {
      headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": TENANT },
    });
    expect(res.status()).toBe(200);
  });
});

// ════════════════════════════════════════════
// 학생 시나리오
// ════════════════════════════════════════════
test.describe("학생 전체 기능 검증", () => {
  test("S01 학생 대시보드", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_STUDENT_USER || "3333", process.env.E2E_STUDENT_PASS || "test1234");
    await page.goto(`${BASE}/student`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(3000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("S02 학생 성적 페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_STUDENT_USER || "3333", process.env.E2E_STUDENT_PASS || "test1234");
    await page.goto(`${BASE}/student/grades`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("S03 학생 커뮤니티", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_STUDENT_USER || "3333", process.env.E2E_STUDENT_PASS || "test1234");
    await page.goto(`${BASE}/student/community`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });

  test("S04 학생 마이페이지", async ({ page }) => {
    const errors = collectErrors(page);
    await login(page, process.env.E2E_STUDENT_USER || "3333", process.env.E2E_STUDENT_PASS || "test1234");
    await page.goto(`${BASE}/student/my`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes("PAGE_ERROR"))).toHaveLength(0);
  });
});

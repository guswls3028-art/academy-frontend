import path from "node:path";

import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 7721;
const SESSION_ID = 7722;
const CLINIC_SECTION_ID = 7723;
const WORKBENCH_CSS = path.resolve(
  process.cwd(),
  "src/app_admin/domains/clinic/styles/clinic/12-operations-workbench.css",
);

function fakeJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installApi(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "차시 클리닉 route-mock 검증은 로컬 dev 서버 전용",
  );
  const token = fakeJwt();
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, token);

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/token/refresh/") return json({ access: token, refresh: `${token}-refresh` });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        is_active: true,
        feature_flags: { section_mode: true, clinic_mode: "regular" },
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
      });
    }
    if (path === `/lectures/sessions/${SESSION_ID}/`) {
      return json({
        id: SESSION_ID,
        lecture: LECTURE_ID,
        order: 3,
        regular_order: 3,
        title: "3차시",
        session_type: "REGULAR",
        date: "2026-08-21",
        section: null,
      });
    }
    if (path === "/lectures/sessions/") {
      return json([{
        id: 7730,
        lecture: LECTURE_ID,
        order: 3,
        regular_order: 3,
        title: "클리닉 A반 3차시",
        session_type: "REGULAR",
        date: "2026-08-22",
        section: CLINIC_SECTION_ID,
      }]);
    }
    if (path === "/lectures/sections/") {
      return json([{
        id: CLINIC_SECTION_ID,
        tenant: 1,
        lecture: LECTURE_ID,
        label: "A",
        section_type: "CLINIC",
        section_type_display: "클리닉",
        day_of_week: 5,
        day_of_week_display: "토",
        start_time: "16:00:00",
        end_time: "17:30:00",
        location: "2층 학습실",
        max_capacity: 12,
        is_active: true,
        assignment_count: 3,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      }]);
    }
    if (path === "/lectures/section-assignments/") {
      return json([1001, 1002, 1003].map((enrollment, index) => ({
        id: 7800 + index,
        tenant: 1,
        enrollment,
        class_section: 7700,
        clinic_section: CLINIC_SECTION_ID,
        source: "MANUAL",
        source_display: "수동",
        student_name: ["실제대상 학생", "미응시 학생", "정상 학생"][index],
        student_id: 7900 + index,
        lecture_id: LECTURE_ID,
        class_section_label: "A",
        clinic_section_label: "A",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-01T00:00:00Z",
      })));
    }
    if (path === "/enrollments/session-enrollments/") {
      return json([1001, 1002, 1003].map((enrollment, index) => ({
        id: 8000 + index,
        session: SESSION_ID,
        enrollment,
        student_id: 7900 + index,
        student_name: ["실제대상 학생", "미응시 학생", "정상 학생"][index],
      })));
    }
    if (path === "/results/admin/clinic-targets/") {
      return json([
        {
          enrollment_id: 1001,
          student_id: 7900,
          student_name: "실제대상 학생",
          session_title: "3차시",
          session_id: SESSION_ID,
          lecture_id: LECTURE_ID,
          clinic_reason: "exam",
          reason: "score",
          source_type: "exam",
          source_id: 8101,
          clinic_link_id: 8201,
          exam_score: 55,
          cutline_score: 70,
          created_at: "2026-08-21T10:00:00Z",
        },
        {
          enrollment_id: 1002,
          student_id: 7901,
          student_name: "미응시 학생",
          session_title: "3차시",
          session_id: SESSION_ID,
          lecture_id: LECTURE_ID,
          clinic_reason: "exam",
          reason: "missing",
          source_type: "exam",
          source_id: 8101,
          created_at: "2026-08-21T10:00:00Z",
        },
      ]);
    }
    return json({ count: 0, results: [] });
  });
}

test("미응시 검토 대기와 실제 클리닉 대상을 분리해 표시한다", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page);
  await page.goto(`${BASE}/workspace/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/clinic`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  const targetKpi = page.locator(".clinic-tab__kpi").filter({ hasText: "클리닉 대상" });
  const pendingKpi = page.locator(".clinic-tab__kpi").filter({ hasText: "미응시 확인" });
  await expect(targetKpi).toContainText("1");
  await expect(pendingKpi).toContainText("1");

  const actualRow = page.locator(".clinic-tab__row").filter({ hasText: "실제대상 학생" });
  const pendingRow = page.locator(".clinic-tab__row").filter({ hasText: "미응시 학생" });
  const normalRow = page.locator(".clinic-tab__row").filter({ hasText: "정상 학생" });
  await expect(actualRow).toContainText("시험 미통과");
  await expect(pendingRow).toContainText("미응시 확인 필요");
  await expect(pendingRow).not.toContainText("시험 미통과");
  await expect(normalRow).toContainText("정상");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("클리닉 작업대의 긴 한글 제목은 desktop과 390px에서 잘리지 않는다", async ({ page }) => {
  await page.setContent(`
    <main style="width: min(320px, calc(100vw - 32px)); margin: 16px;">
      <section class="clinic-workbench__active-panel">
        <strong class="clinic-workbench__target-title" data-testid="target-title">
          부교재 매우 긴 산화 환원과 화학 평형 확인 과제와 추가 복습 범위
        </strong>
      </section>
    </main>
  `);
  await page.addStyleTag({ path: WORKBENCH_CSS });

  const title = page.getByTestId("target-title");
  await expect(title).toHaveText(
    "부교재 매우 긴 산화 환원과 화학 평형 확인 과제와 추가 복습 범위",
  );

  for (const viewport of [
    { width: 1366, height: 850 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const metrics = await title.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        lineHeight: Number.parseFloat(style.lineHeight),
        overflowWrap: style.overflowWrap,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      };
    });

    expect(metrics.whiteSpace).toBe("normal");
    expect(metrics.overflowWrap).toBe("anywhere");
    expect(metrics.textOverflow).toBe("clip");
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.lineHeight * 1.5);
  }
});

test("desktop 학생 작업대 운영 버튼은 세로로 찌그러지지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.setContent(`
    <style>
      .clinic-ops__drawer-status-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        width: 580px;
      }

      .clinic-ops__drawer-status-btn {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px 16px;
        border: 1px solid #d0d5dd;
        font-size: 14px;
        line-height: 22px;
      }

      .clinic-ops__drawer-status-btn--manage,
      .clinic-ops__drawer-status-btn--cancel {
        flex: 1 1 132px;
      }

      .clinic-ops__drawer-status-btn > i {
        width: 16px;
        height: 16px;
        flex: 0 0 16px;
      }
    </style>
    <section class="clinic-workbench">
      <div class="clinic-ops__drawer-status-actions" data-testid="drawer-actions">
        <button class="clinic-ops__drawer-status-btn"><i></i><span>등원</span></button>
        <button class="clinic-ops__drawer-status-btn"><i></i><span>재촉</span></button>
        <button class="clinic-ops__drawer-status-btn"><i></i><span>결석</span></button>
        <button class="clinic-ops__drawer-status-btn"><i></i><span>미등원 하원</span></button>
        <button class="clinic-ops__drawer-status-btn clinic-ops__drawer-status-btn--manage"><i></i><span>일정 변경</span></button>
        <button class="clinic-ops__drawer-status-btn clinic-ops__drawer-status-btn--cancel"><i></i><span>명단에서 빼기</span></button>
      </div>
    </section>
  `);
  await page.addStyleTag({ path: WORKBENCH_CSS });

  const metrics = await page.getByTestId("drawer-actions").evaluate((element) => {
    const style = getComputedStyle(element);
    const buttons = Array.from(element.querySelectorAll("button"));
    const rows = new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top)));
    return {
      display: style.display,
      columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      rows: rows.size,
      buttons: buttons.map((button) => {
        const box = button.getBoundingClientRect();
        const label = button.querySelector("span")?.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          right: box.right,
          labelHeight: label?.height ?? 0,
        };
      }),
      right: element.getBoundingClientRect().right,
    };
  });

  expect(metrics.display).toBe("grid");
  expect(metrics.columns).toBe(3);
  expect(metrics.rows).toBe(2);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  for (const button of metrics.buttons) {
    expect(button.width).toBeGreaterThan(170);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeLessThanOrEqual(48);
    expect(button.labelHeight).toBeLessThanOrEqual(24);
    expect(button.right).toBeLessThanOrEqual(metrics.right + 1);
  }
});

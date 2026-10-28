import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5198";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

for (const width of [390, 1366]) {
  test(`계정 안내 접수·최종 전달과 최초 안내 복구 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installTenantOneInitScript(page);
    const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript((token) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", `${token}-refresh`);
    }, `e30.${payload}.signature`);
    let pending = true;
    let attempts = 0;
    let historyFailure = false;
    await page.route("**/api/v1/**", async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
      if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "검증 교사", username: "teacher", is_staff: true, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false } });
      if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
      if (path === "/students/71/") return route.fulfill({ json: { id: 71, name: "검증학생", grade: 2, enrollments: [], tags: [], custom_fields: {}, is_active: true } });
      if (path.endsWith("/grades/")) return route.fulfill({ json: { exams: [], homeworks: [], exam_trend: [], exam_summary: { average_score_pct: null, total: 0 } } });
      if (path.endsWith("/account-notifications/")) {
        if (route.request().method() === "POST") {
          expect(route.request().postDataJSON()).toEqual({ target: "initial" });
          attempts += 1;
          if (attempts === 1) return route.fulfill({ status: 503, json: { detail: "최초 안내 접수 실패. 연락처를 확인한 뒤 다시 요청해 주세요." } });
          pending = false;
          return route.fulfill({ json: { message: "최초 계정 안내 발송을 요청했습니다." } });
        }
        if (historyFailure) return route.fulfill({ status: 400, json: { detail: "조회 실패" } });
        return route.fulfill({ json: {
          initial_notice: { status: pending ? "action_required" : "not_pending", message: pending ? "수강은 확정됐지만 최초 안내 접수가 완료되지 않았습니다." : "첫 수강 계정 안내 대기가 없습니다." },
          results: [1, 2, 3].map(id => ({ id, status: "sent", success: true, sent_at: "2026-10-28T12:29:00Z", notification_type: id === 1 ? "registration_approved_student" : "registration_approved_parent", recipient_summary: "010-****-1234" })),
        } });
      }
      const log = path.match(/^\/messaging\/log\/(\d+)\/$/);
      if (log) {
        expect(url.searchParams.get("verify_provider")).toBe("true");
        const id = Number(log[1]);
        return route.fulfill({ json: { provider_delivery_status: id === 1 ? "delivered" : id === 2 ? "failed" : "unavailable", provider_status_code: id === 1 ? "4000" : id === 2 ? "3058" : "", provider_delivery_failure_reason: id === 2 ? "전송경로 없음(3058): 등록된 번호를 확인해 주세요. 이 결과만으로 카카오톡 미가입이나 차단 여부를 단정할 수 없습니다." : "공급사 최종 상태를 확인하지 못했습니다.", provider_delivery_checked_at: "2026-10-28T14:00:00Z" } });
      }
      return route.fulfill({ json: { count: 0, results: [] } });
    });
    await gotoAndSettle(page, `${BASE}/workspace/mobile/students/71?tab=info`);
    const history = page.getByRole("region", { name: "계정 안내 발송 내역" });
    await expect(history.getByText("발송 접수", { exact: true })).toHaveCount(3);
    for (const [index, label] of ["최종 전달 성공", "최종 전달 실패", "최종 전달 확인 불가"].entries()) {
      await history.getByRole("button", { name: "최종 전달 확인" }).nth(index).click();
      await expect(history.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(history.getByText(/전송경로 없음/)).toBeVisible();
    await history.screenshot({ path: test.info().outputPath(`account-delivery-${width}.png`) });
    await history.getByRole("button", { name: "최초 안내 다시 요청" }).click();
    await expect(history.getByRole("alert")).toContainText("최초 안내 접수 실패");
    await history.getByRole("button", { name: "최초 안내 다시 요청" }).click();
    await expect(history.getByRole("button", { name: "최초 안내 다시 요청" })).toHaveCount(0);
    expect(attempts).toBe(2);
    await page.reload();
    await expect(history.getByText("첫 수강 계정 안내 대기가 없습니다.")).toBeVisible();
    historyFailure = true;
    await history.getByRole("button", { name: "내역 새로고침" }).click();
    await expect(history.getByRole("alert")).toContainText("계정 안내 이력을 불러오지 못했습니다.");
    historyFailure = false;
    await history.getByRole("button", { name: "다시 시도", exact: true }).click();
    await expect(history.getByText("발송 접수", { exact: true })).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await history.screenshot({ path: test.info().outputPath(`account-notices-${width}.png`) });
  });

  test(`학생 상세의 정보 정리와 실패 복구·메모 저장 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installTenantOneInitScript(page);
    const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript((token) => {
      localStorage.setItem("access", token);
      localStorage.setItem("refresh", `${token}-refresh`);
    }, `e30.${payload}.signature`);
    let failed = true;
    let memoFailed = true;
    let memo = "이전 상담 기록";
    let accountRequests = 0;
    const address = "서울특별시 아주 긴 도로명과 건물 이름을 가진 합성 주소 100동 200호";
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
      if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
      if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "검증 교사", username: "teacher", is_staff: true, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false } });
      if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
      if (path === "/students/71/") {
        if (route.request().method() === "PATCH") {
          if (memoFailed) return route.fulfill({ status: 400, json: { detail: "메모 저장을 다시 시도해 주세요." } });
          memo = route.request().postDataJSON().memo;
        } else if (failed) return route.fulfill({ status: 400, json: { detail: "일시 조회 오류" } });
        return route.fulfill({ json: { id: 71, name: "이름이아주긴검증학생", high_school: "긴이름검증고등학교", grade: 2, address, memo, enrollments: [], tags: [], custom_fields: {}, is_active: true } });
      }
      if (path.endsWith("/grades/")) return route.fulfill({ json: { exams: [], homeworks: [], exam_trend: [], exam_summary: { average_score_pct: null, total: 0 } } });
      if (path.endsWith("/account-notifications/")) {
        accountRequests += 1;
        return route.fulfill({ status: 400, json: { detail: "계정 이력 조회 실패" } });
      }
      return route.fulfill({ json: { count: 0, results: [] } });
    });
    await gotoAndSettle(page, `${BASE}/workspace/mobile/students/71`);
    await expect(page.getByText("학생 정보를 불러오지 못했습니다", { exact: true })).toBeVisible();
    failed = false;
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    const navigation = page.getByRole("navigation", { name: "학생 기록" });
    await expect(navigation).toBeInViewport();
    expect(accountRequests).toBe(0);
    await page.screenshot({ path: test.info().outputPath(`student-detail-${width}.png`) });
    await navigation.getByRole("button", { name: "정보", exact: true }).click();
    await expect(page.getByText(address, { exact: true })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "계정 안내 이력을 불러오지 못했습니다." })).toBeVisible();
    expect(accountRequests).toBeGreaterThan(0);
    await expect(page.getByText("최근 아이디/비밀번호 알림톡 이력이 없습니다.")).toHaveCount(0);
    await page.getByRole("button", { name: "학생 메모 편집", exact: true }).click();
    await page.getByRole("textbox", { name: "학생 메모" }).fill("다음 상담에서 확인할 내용");
    await navigation.getByRole("button", { name: "수강", exact: true }).click();
    await navigation.getByRole("button", { name: "정보", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "학생 메모" })).toHaveValue("다음 상담에서 확인할 내용");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "메모 저장을 다시 시도해 주세요." })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "학생 메모" })).toHaveValue("다음 상담에서 확인할 내용");
    memoFailed = false;
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("다음 상담에서 확인할 내용", { exact: true })).toBeVisible();
    await page.reload();
    await expect(navigation.getByRole("button", { name: "정보", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("다음 상담에서 확인할 내용", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`student-info-${width}.png`), fullPage: true });
  });
}

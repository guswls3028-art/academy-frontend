import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5198";
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(BASE), "Local synthetic API only");
test.use({ serviceWorkers: "block" });

for (const width of [390, 1366]) {
  test(`클리닉 전체 학생 선택·검색 유지·저장 복구 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installTenantOneInitScript(page);
    const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
    await page.addInitScript((token) => { localStorage.setItem("access", token); localStorage.setItem("refresh", `${token}-refresh`); }, `e30.${payload}.signature`);
    const date = new Date().toLocaleDateString("sv-SE");
    const students = Array.from({ length: 52 }, (_, index) => ({ id: index + 1, name: `검증학생${String(index + 1).padStart(3, "0")}`, grade: 2, high_school: "검증고등학교" }));
    const searched = { id: 77, name: "다른검색학생", grade: 1, high_school: "합성고등학교" };
    const existingIds = students.slice(0, 50).map((student) => student.id);
    let nextFailed = true;
    let saveFailed = true;
    let savedIds: number[] = [];
    let submissions = 0;
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api\/v1/, "");
      if (path === "/core/program/") return route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "검증 학원", is_active: true, feature_flags: {} } });
      if (path === "/core/me/") return route.fulfill({ json: { id: 12, name: "검증 교사", username: "teacher", is_staff: true, tenantRole: "teacher", must_change_password: false, first_login_guide_required: false } });
      if (path === "/core/subscription/") return route.fulfill({ json: { plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 } });
      if (path === "/clinic/sessions/") return route.fulfill({ json: [{ id: 701, title: "학생선택검증 클리닉", date, start_time: "17:00:00", end_time: "18:00:00", max_participants: 100, participant_count: existingIds.length + savedIds.length, allow_multi_slot_booking: false }] });
      if (path === "/students/") {
        if (url.searchParams.get("search")) return route.fulfill({ json: { count: 1, results: [searched] } });
        const pageNumber = Number(url.searchParams.get("page") || 1);
        if (pageNumber === 2 && nextFailed) return route.fulfill({ status: 400, json: { detail: "추가 조회 실패" } });
        return route.fulfill({ json: { count: students.length, results: students.slice((pageNumber - 1) * 50, pageNumber * 50) } });
      }
      const participantRows = (ids: number[]) => ids.map((id) => ({ id: 7000 + id, session: 701, student: id, student_name: [...students, searched].find((student) => student.id === id)!.name, status: "booked" }));
      if (path === "/clinic/participants/bulk-create/") {
        submissions += 1;
        if (saveFailed) return route.fulfill({ status: 400, json: { detail: "선택한 학생을 다시 확인해 주세요." } });
        const data = request.postDataJSON();
        expect(data.session_ids).toEqual([701]);
        savedIds = data.student_ids;
        return route.fulfill({ status: 201, json: { count: savedIds.length, participants: participantRows(savedIds) } });
      }
      if (path === "/clinic/participants/") return route.fulfill({ json: { count: existingIds.length + savedIds.length, results: participantRows([...existingIds, ...savedIds]) } });
      return route.fulfill({ json: { count: 0, results: [] } });
    });
    await page.goto(`${BASE}/workspace/mobile/clinic`);
    await page.getByRole("button", { name: /학생선택검증 클리닉/ }).click();
    await page.getByRole("button", { name: "학생 추가", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "학생 추가" });
    await expect(sheet.getByText("현재 목록의 학생은 이미 등록되어 있습니다. 학생 더 보기로 계속 확인해 주세요.")).toBeVisible();
    await expect(sheet.getByText("추가 가능한 학생이 없습니다", { exact: true })).toHaveCount(0);
    await sheet.getByRole("button", { name: "학생 더 보기" }).click();
    await expect(sheet.getByRole("alert")).toContainText("학생 목록을 더 불러오지 못했습니다");
    nextFailed = false;
    await sheet.getByRole("button", { name: "다시 시도" }).click();
    await sheet.locator('button[aria-pressed]').filter({ hasText: "검증학생051" }).click();
    await sheet.getByRole("searchbox", { name: "학생 이름 또는 전화번호 검색" }).fill("다른");
    await sheet.locator('button[aria-pressed]').filter({ hasText: "다른검색학생" }).click();
    const selection = sheet.getByRole("region", { name: "선택한 학생" });
    await expect(selection).toContainText("검증학생051");
    await expect(selection).toContainText("다른검색학생");
    await selection.getByRole("button", { name: "검증학생051 선택 해제" }).click();
    await expect(selection).not.toContainText("검증학생051");
    await sheet.getByRole("searchbox").fill("");
    await sheet.locator('button[aria-pressed]').filter({ hasText: "검증학생051" }).click();
    await sheet.getByRole("button", { name: "2명 추가", exact: true }).click();
    await expect(sheet.getByRole("alert")).toContainText("선택한 학생을 다시 확인해 주세요.");
    await expect(selection).toContainText("선택한 학생 2명");
    expect(await sheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`clinic-selection-${width}.png`) });
    saveFailed = false;
    await sheet.getByRole("button", { name: "2명 추가", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    expect(submissions).toBe(2);
    expect(savedIds.sort((a, b) => a - b)).toEqual([51, 77]);

    await page.getByRole("button", { name: "학생 추가", exact: true }).click();
    await sheet.locator('button[aria-pressed]').filter({ hasText: "검증학생052" }).click();
    saveFailed = true;
    await sheet.getByRole("button", { name: "1명 추가", exact: true }).click();
    await expect(sheet.getByRole("alert")).toContainText("선택한 학생을 다시 확인해 주세요.");
    await sheet.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await page.getByRole("button", { name: "학생 추가", exact: true }).click();
    await expect(sheet.getByRole("alert")).toHaveCount(0);
    await expect(sheet.getByRole("region", { name: "선택한 학생" })).toHaveCount(0);
    await sheet.getByRole("button", { name: "닫기", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: /학생선택검증 클리닉/ }).click();
    await expect(page.getByText("검증학생051", { exact: true })).toBeVisible();
    await expect(page.getByText("다른검색학생", { exact: true })).toBeVisible();
  });
}

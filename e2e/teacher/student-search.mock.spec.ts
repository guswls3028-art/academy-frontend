import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
test.use({ serviceWorkers: "block" });

for (const surface of ["enrollment", "inventory"] as const) {
  for (const width of [1366, 390]) {
    test(`${surface} ${width}px 학생 검색은 입력을 모으고 오류 복구 후 작업을 이어간다`, async ({ page }, info) => {
      // Install before application timers exist; keep them running until typing starts.
      await page.clock.install();
      const shortSheet = width === 390 && surface === "enrollment";
      await page.setViewportSize({ width, height: shortSheet ? 600 : 900 });
      await installTenantOneInitScript(page);
      const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: "hakwonplus" })).toString("base64url");
      await page.addInitScript((token) => {
        localStorage.setItem("access", token);
        localStorage.setItem("refresh", `${token}-refresh`);
      }, `e30.${payload}.signature`);
      const student = { id: 901, name: "김학생", ps_number: "qa-search-901", is_managed: true, enrollments: [], tags: [] };
      const searches: string[] = [];
      let failing = true;
      let enrolled = false;
      let receipt: import("../../src/shared/api/contracts/registrationNotices").RegistrationReceipt | null = null;
      await page.route("**/api/v1/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api\/v1/, "");
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
        const json = (body: unknown, status = 200) => route.fulfill({ json: body, status });
        if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "검색 검증 학원", is_active: true, feature_flags: {} });
        if (path === "/core/me/") return json({ id: 12, name: "검색 담당자", username: "search-owner", is_staff: true, tenantRole: "owner", must_change_password: false, first_login_guide_required: false });
        if (path === "/core/subscription/") return json({ plan: "all", subscription_status: "active", is_subscription_active: true, days_remaining: 30 });
        if (path === "/lectures/lectures/9965/") return json({ id: 9965, title: "검색 검증 강의", is_active: true });
        if (path === "/enrollments/register-with-notices/" && request.method() === "POST") {
          const body = request.postDataJSON();
          expect(body).toEqual({ lecture: 9965, students: [901], request_id: expect.any(String), student_notice: "auto", parent_notice: "auto" });
          receipt = { lecture: 9965, request_id: body.request_id, students: [{ id: 901, name: student.name,
            student: { status: "no_recipient", log_id: null }, parent: { status: "queued", log_id: null } }] };
          enrolled = true;
          return json(receipt, 201);
        }
        if (path === "/enrollments/registration-notices/") return receipt ? json(receipt) : route.fulfill({ status: 204 });
        if (path === "/enrollments/") return json(enrolled ? [{ id: 9901, student, status: "ACTIVE" }] : []);
        if (path === "/students/") {
          const search = url.searchParams.get("search") || "";
          searches.push(search);
          if (search === "실패" && failing) return json({ detail: "검색 일시 실패" }, 400);
          const results = shortSheet && !search ? [student, ...Array.from({ length: 15 }, (_, i) => ({
            ...student, id: 902 + i, ps_number: `qa-search-${902 + i}`, name: `검증 학생 ${i + 1}`,
          }))] : [student];
          return json({ count: results.length, page_size: 50, results });
        }
        if (path === "/storage/inventory/") return json({ files: [], folders: [] });
        return json({ count: 0, results: [], next: null });
      });
      await page.goto(`${BASE}/workspace/mobile/${surface === "enrollment" ? "classes/9965?tab=students" : "storage/inventory"}`);
      if (surface === "enrollment") await page.getByRole("button", { name: "수강생 등록", exact: true }).first().click();
      const panel = surface === "enrollment" ? page.getByRole("dialog", { name: "수강생 등록" }) : page.getByRole("main");
      const input = panel.getByPlaceholder(surface === "enrollment" ? "학생 이름/전화 검색" : "학생 이름, 전화번호", { exact: true });
      await expect(panel.getByText("김학생", { exact: true })).toBeVisible();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
      await input.dispatchEvent("compositionstart");
      for (const value of ["김", "김학", "김학생"]) {
        await input.fill(value);
        await page.clock.runFor(100);
      }
      expect(searches.filter(Boolean)).toEqual([]);
      await page.clock.runFor(300);
      await expect.poll(() => searches.filter(Boolean)).toEqual(["김학생"]);
      // Resume query notification/render timers after the measured typing window.
      await page.clock.resume();
      await expect(panel.getByText("김학생", { exact: true })).toBeVisible();
      expect(searches.filter(Boolean)).toEqual(["김학생"]);
      await expect(input).toBeFocused();
      await input.dispatchEvent("compositionend");
      await input.fill("실패");
      await expect(panel.getByText(/학생 명단을 불러오지 못했습니다/)).toBeVisible();
      await expect(panel.getByText(/^(검색 결과 없음|검색된 학생이 없습니다)$/)).toHaveCount(0);
      failing = false;
      await panel.getByRole("button", { name: "다시 시도", exact: true }).click();
      await expect(panel.getByText("김학생", { exact: true })).toBeVisible();
      await info.attach(`student-search-${surface}-${width}.png`, {
        body: await panel.screenshot(), contentType: "image/png",
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await panel.getByText("김학생", { exact: true }).click();
      if (surface === "enrollment") {
        const save = panel.getByRole("button", { name: "1명 등록", exact: true });
        if (shortSheet) {
          await input.fill("");
          await expect(panel.getByText("검증 학생 15", { exact: true })).toBeAttached();
          const summary = panel.getByRole("group", { name: "등록 시 알림톡 안내" });
          await expect(summary).toContainText("첫 수강 확정 시 학생·학부모에게");
          await expect(summary).toBeInViewport({ ratio: 1 });
          await expect(save).toBeInViewport({ ratio: 1 });
          await panel.getByText("수신자별 발송 설정", { exact: true }).click();
          const parentDelivery = panel.getByRole("combobox", { name: "학부모 안내 발송" });
          await parentDelivery.selectOption("skip");
          await expect(summary).toContainText("학부모 발송 안 함");
          await input.scrollIntoViewIfNeeded();
          await expect(input).toBeInViewport({ ratio: 1 });
          await expect(summary).toBeInViewport({ ratio: 1 });
          await expect(save).toBeInViewport({ ratio: 1 });
          await info.attach("teacher-enrollment-short.png", { body: await panel.screenshot(), contentType: "image/png" });
          await parentDelivery.selectOption("auto");
        }
        await save.click();
        await expect(panel).toHaveCount(0);
        expect(enrolled).toBe(true);
        await page.reload();
        const results = page.getByRole("region", { name: "최근 등록 알림톡 결과" });
        await expect(results.getByRole("group", { name: "학생", exact: true })).toContainText("연락처 없음");
        await expect(results.getByRole("group", { name: "학부모", exact: true })).toContainText("발송 대기");
        await expect(page.getByRole("main").getByText("김학생", { exact: true }).last()).toBeVisible();
      } else {
        await expect(panel.getByText("배포된 자료가 없습니다", { exact: true })).toBeVisible();
        await expect(panel.getByRole("button", { name: "파일 업로드", exact: true })).toBeVisible();
      }
    });
  }
}

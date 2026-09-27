import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function seed(page: Page, isOldLectureActive: () => boolean): Promise<void> {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, localJwt());

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (["/core/program/", "/core/me/", "/token/refresh/", "/results/admin/clinic-targets/"].includes(path)) {
      return route.fallback();
    }
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const student = {
      id: 101,
      name: "검수 학생",
      ps_number: "test-101",
      is_managed: true,
      enrollments: [
        { id: 201, lecture: 301, lecture_name: "지난 화학", lecture_chip_label: "화학", lecture_active: isOldLectureActive(), status: "ACTIVE" },
        { id: 202, lecture: 302, lecture_name: "현재 생물", lecture_chip_label: "생물", lecture_active: true, status: "ACTIVE" },
      ],
    };
    if (path === "/students/" && request.method() === "GET") {
      return route.fulfill({ json: { count: 1, results: [student] } });
    }
    if (path === "/students/101/" && request.method() === "GET") {
      return route.fulfill({ json: student });
    }
    return route.fulfill({ json: { count: 0, results: [] } });
  });
}

test.use({ serviceWorkers: "block" });

for (const width of [390, 1366]) {
  test(`강의 종료 뒤 학생 이름에는 현재 수강 딱지만 남고 새로고침에도 유지된다 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    let oldLectureActive = true;
    await seed(page, () => oldLectureActive);

    await page.goto(`${BASE}/workspace/mobile/students`, { waitUntil: "commit" });
    await expect(page.getByText("학생 관리", { exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('[data-lecture-chip][title="지난 화학"]')).toBeVisible();
    await expect(page.locator('[data-lecture-chip][title="현재 생물"]')).toBeVisible();

    oldLectureActive = false;
    await page.reload({ waitUntil: "commit" });
    await expect(page.getByText("검수 학생")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-lecture-chip][title="지난 화학"]')).toHaveCount(0);
    await expect(page.locator('[data-lecture-chip][title="현재 생물"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

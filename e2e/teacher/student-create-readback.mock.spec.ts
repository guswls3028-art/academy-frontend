import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function installTeacherStudentPage(
  page: Page,
  onCreateStudent: (payload: Record<string, unknown>) => void,
): Promise<void> {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  const token = localJwt();
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, token);

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (
      path === "/core/program/"
      || path === "/core/me/"
      || path === "/token/refresh/"
      || path === "/results/admin/clinic-targets/"
    ) {
      return route.fallback();
    }
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, body: "" });
    if (path === "/students/" && request.method() === "GET") {
      return route.fulfill({ json: { count: 0, results: [] } });
    }
    if (path === "/students/" && request.method() === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      onCreateStudent(payload);
      return route.fulfill({
        json: {
          id: 101,
          ...payload,
          ps_number: payload.ps_number,
          is_managed: true,
        },
      });
    }
    return route.fulfill({ json: { count: 0, results: [] } });
  });
}

test.use({ serviceWorkers: "block" });

test("390px 선생님 등록은 실제 로그인 ID와 학생 화면 검수 동선을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let createPayload: Record<string, unknown> | null = null;
  await installTeacherStudentPage(page, (payload) => {
    createPayload = payload;
  });

  await page.goto(`${BASE}/workspace/mobile/students`, { waitUntil: "commit" });
  await expect(page.getByText("학생 관리", { exact: true })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "추가", exact: true }).click();

  const sheet = page.getByRole("dialog", { name: "학생 추가" });
  await sheet.getByPlaceholder("학생 이름").fill("즉시검수 학생");
  await sheet.getByPlaceholder("010-").nth(0).fill("01080001111");
  await sheet.getByPlaceholder("010-").nth(1).fill("01070001111");
  await sheet.getByRole("button", { name: "등록", exact: true }).click();

  await expect.poll(() => createPayload).not.toBeNull();
  expect(createPayload).toMatchObject({
    phone: "01080001111",
    ps_number: "01080001111",
  });
  await expect(sheet.getByText("등록 완료 · 계정 준비됨", { exact: true })).toBeVisible();
  await expect(sheet.getByText("01080001111", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "학생 화면 바로 검수" })).toBeVisible();
  expect(await sheet.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});

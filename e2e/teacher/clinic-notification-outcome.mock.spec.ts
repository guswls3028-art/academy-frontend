import type { Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { todayLocalISO } from "../../src/shared/utils/localDate";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    tenant_code: "hakwonplus",
    user_id: 71,
  })).toString("base64url");
  return `e30.${payload}.sig`;
}

test.use({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "block",
});

test("교사 클리닉은 업무 성공과 알림톡 일부 실패를 분리하고 상태를 새로고침 후 보존한다", async ({ page }) => {
  test.setTimeout(90_000);
  const date = todayLocalISO();
  const session = {
    id: 901,
    title: "알림 결과 검증 클리닉",
    date,
    start_time: "18:00:00",
    end_time: "19:00:00",
    duration_minutes: 60,
    location: "클리닉실",
    participant_count: 1,
    booked_count: 1,
    max_participants: 10,
    is_full: false,
  };
  let participant = {
    id: 902,
    session: session.id,
    student: 903,
    student_name: "알림학생",
    status: "booked",
    checked_in_at: null as string | null,
    is_late: false,
  };
  const statusPayloads: unknown[] = [];
  const reminderPayloads: unknown[] = [];

  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", token);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
    localStorage.setItem("teacher:preferAdmin", "0");
  }, fakeJwt());

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
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
        id: 71,
        username: "teacher",
        name: "담당 선생님",
        is_staff: true,
        is_superuser: false,
        tenantRole: "teacher",
        must_change_password: false,
      });
    }
    if (path === "/clinic/sessions/" && request.method() === "GET") return json([session]);
    if (path === "/clinic/participants/" && request.method() === "GET") {
      return json({ count: 1, results: [participant] });
    }
    if (path === `/clinic/participants/${participant.id}/remind/` && request.method() === "POST") {
      reminderPayloads.push(request.postDataJSON());
      return json({ ok: true, status: "ok", sent: 1, skipped: 1 });
    }
    if (path === `/clinic/participants/${participant.id}/set_status/` && request.method() === "PATCH") {
      const payload = request.postDataJSON();
      statusPayloads.push(payload);
      participant = {
        ...participant,
        status: "attended",
        checked_in_at: `${date}T18:01:00+09:00`,
      };
      return json({
        ...participant,
        notification: {
          requested: 2,
          failed: 1,
          send_to: "both",
        },
      });
    }
    return json({ count: 0, results: [] });
  });

  await page.goto(`${BASE}/workspace/mobile/clinic`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  const clinicCard = page.getByRole("button", { name: /알림 결과 검증 클리닉/ });
  await expect(clinicCard).toBeVisible({ timeout: 30_000 });
  await clinicCard.dispatchEvent("click");
  const checkInButton = page.getByRole("button", { name: "등원", exact: true });
  await expect(checkInButton).toBeVisible();

  await page.getByRole("button", { name: "재촉", exact: true }).click();
  await page.getByRole("dialog", { name: "등원 재촉" })
    .getByRole("button", { name: "재촉 발송" })
    .click();
  await expect.poll(() => reminderPayloads).toEqual([{
    mode: "once",
    send_to: "student",
  }]);
  await expect(page.getByRole("status")).toHaveText(
    "재촉 처리는 완료됐지만 알림톡 요청 1건 중 1건이 실패했습니다. 수신자: 학생",
  );

  await checkInButton.click();
  await page.getByRole("dialog", { name: "등원 처리" })
    .getByRole("button", { name: "등원 확정" })
    .click();

  await expect.poll(() => statusPayloads).toEqual([{
    status: "attended",
    is_late: false,
    send_to: "both",
  }]);
  await expect(page.getByRole("status")).toHaveText(
    "등원 처리는 완료됐지만 알림톡 요청 2건 중 1건이 실패했습니다. 수신자: 학생·학부모",
  );
  expect(await page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await expect(clinicCard).toBeVisible({ timeout: 30_000 });
  await clinicCard.dispatchEvent("click");
  await expect(page.getByText("등원", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "하원", exact: true })).toBeVisible();
});

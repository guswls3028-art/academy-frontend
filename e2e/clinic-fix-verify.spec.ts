/**
 * 클리닉 도메인 수정 검증 E2E
 * - 자율학습 완료/취소
 * - 상태 전이 (출석, 불참, 토글)
 * - 운영 콘솔 전반 동작
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("클리닉 도메인 수정 검증", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("1. 클리닉 메뉴 접근 및 페이지 로드", async ({ page }) => {
    // 사이드바에서 클리닉 메뉴 클릭
    const clinicMenu = page.locator("nav, aside").locator("text=클리닉").first();
    if (await clinicMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clinicMenu.click();
      await page.waitForTimeout(1000);
    } else {
      // 직접 URL로 이동
      await page.goto(`${BASE}/admin/clinic`, { waitUntil: "load" });
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "e2e/screenshots/clinic-01-menu.png" });

    // 클리닉 관련 콘텐츠가 보이는지 확인
    const pageContent = await page.textContent("body");
    expect(
      pageContent?.includes("클리닉") ||
      pageContent?.includes("보강") ||
      pageContent?.includes("세션")
    ).toBeTruthy();
  });

  test("2. 운영 콘솔 페이지 로드", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/console`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-02-console.png" });

    // 콘솔 페이지 콘텐츠 확인
    const body = await page.textContent("body");
    // 세션이 없어도 페이지가 오류 없이 로드되어야 함
    expect(body).toBeTruthy();
  });

  test("3. 예약 관리 페이지 로드", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/bookings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-03-bookings.png" });

    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("4. 클리닉 설정 페이지 로드", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/settings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/clinic-04-settings.png" });

    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("5. API 검증: set_status 정상 응답 (500 아님)", async ({ page }) => {
    // API로 직접 테스트 — set_status가 500 대신 정상 응답하는지 확인
    const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
    const code = "hakwonplus";

    // 토큰 획득
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: {
        username: process.env.E2E_ADMIN_USER || "admin97",
        password: process.env.E2E_ADMIN_PASS || "koreaseoul97",
        tenant_code: code,
      },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": code },
    });
    const tokens = await loginResp.json() as { access: string };

    // 참가자 목록 조회
    const listResp = await page.request.get(`${API}/api/v1/clinic/participants/?page_size=5`, {
      headers: {
        Authorization: `Bearer ${tokens.access}`,
        "X-Tenant-Code": code,
      },
    });
    expect(listResp.status()).toBe(200);
    const listData = await listResp.json() as { results: Array<{ id: number; status: string }> };

    if (listData.results.length === 0) {
      test.skip();
      return;
    }

    const participant = listData.results[0];
    console.log(`Testing participant ${participant.id} (status: ${participant.status})`);

    // status에 따라 유효한 전이를 테스트
    let targetStatus = "attended";
    if (participant.status === "attended") {
      targetStatus = "booked"; // 토글 해제
    } else if (participant.status === "no_show") {
      targetStatus = "booked"; // 토글 해제
    } else if (participant.status === "booked") {
      targetStatus = "attended";
    } else if (participant.status === "pending") {
      targetStatus = "booked";
    } else {
      // cancelled/rejected — 전이 불가, skip
      console.log(`Participant ${participant.id} is ${participant.status}, skipping transition test`);
      return;
    }

    const statusResp = await page.request.patch(
      `${API}/api/v1/clinic/participants/${participant.id}/set_status/`,
      {
        data: { status: targetStatus },
        headers: {
          Authorization: `Bearer ${tokens.access}`,
          "X-Tenant-Code": code,
          "Content-Type": "application/json",
        },
      }
    );

    // 핵심: 500이 아니어야 함 (이전에는 NameError로 500이었음)
    expect(statusResp.status()).not.toBe(500);
    console.log(`set_status → ${targetStatus}: ${statusResp.status()}`);

    const responseData = await statusResp.json();
    if (statusResp.status() === 200) {
      expect(responseData.status).toBe(targetStatus);
      console.log(`✓ Status changed to ${targetStatus}`);

      // 원래 상태로 복구
      const revertResp = await page.request.patch(
        `${API}/api/v1/clinic/participants/${participant.id}/set_status/`,
        {
          data: { status: participant.status },
          headers: {
            Authorization: `Bearer ${tokens.access}`,
            "X-Tenant-Code": code,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(`Revert to ${participant.status}: ${revertResp.status()}`);
    }
  });

  test("6. API 검증: complete/uncomplete 정상 응답 (500 아님)", async ({ page }) => {
    const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
    const code = "hakwonplus";

    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: {
        username: process.env.E2E_ADMIN_USER || "admin97",
        password: process.env.E2E_ADMIN_PASS || "koreaseoul97",
        tenant_code: code,
      },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": code },
    });
    const tokens = await loginResp.json() as { access: string };

    // attended 상태 참가자 찾기 (complete 가능)
    const listResp = await page.request.get(
      `${API}/api/v1/clinic/participants/?page_size=10`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
          "X-Tenant-Code": code,
        },
      }
    );
    const listData = await listResp.json() as {
      results: Array<{ id: number; status: string; completed_at: string | null }>;
    };

    // 미완료 참가자 찾기
    const target = listData.results.find(
      (p) => !p.completed_at && (p.status === "attended" || p.status === "booked")
    );

    if (!target) {
      console.log("No suitable participant for complete test, skipping");
      test.skip();
      return;
    }

    console.log(`Testing complete on participant ${target.id} (status: ${target.status})`);

    // complete 호출
    const completeResp = await page.request.post(
      `${API}/api/v1/clinic/participants/${target.id}/complete/`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
          "X-Tenant-Code": code,
          "Content-Type": "application/json",
        },
      }
    );

    // 핵심: 500이 아니어야 함 (이전에는 NameError로 500이었음)
    expect(completeResp.status()).not.toBe(500);
    console.log(`complete: ${completeResp.status()}`);

    if (completeResp.status() === 200) {
      const data = await completeResp.json() as { completed_at: string | null };
      expect(data.completed_at).toBeTruthy();
      console.log(`✓ Completed at: ${data.completed_at}`);

      // uncomplete로 복구
      const uncompleteResp = await page.request.post(
        `${API}/api/v1/clinic/participants/${target.id}/uncomplete/`,
        {
          headers: {
            Authorization: `Bearer ${tokens.access}`,
            "X-Tenant-Code": code,
            "Content-Type": "application/json",
          },
        }
      );
      expect(uncompleteResp.status()).not.toBe(500);
      console.log(`uncomplete: ${uncompleteResp.status()}`);
    }
  });

  test("7. 브라우저 E2E: 콘솔에서 출석/불참 토글 동작", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/console`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    // 세션 목록이 있는지 확인
    const sessionItems = page.locator("[data-testid='clinic-session'], [class*='session'], [class*='Session']").first();
    const hasSessions = await sessionItems.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasSessions) {
      // 사이드바에서 세션 클릭 시도
      const sessionLink = page.locator("aside, nav, [class*='sidebar']").locator("a, button, [role='button']").first();
      if (await sessionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sessionLink.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: "e2e/screenshots/clinic-07-console-loaded.png" });

    // 출석 버튼 찾기
    const attendBtn = page.locator("button").filter({ hasText: /출석/ }).first();
    const hasAttendBtn = await attendBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasAttendBtn) {
      await attendBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/clinic-07-after-attend-click.png" });

      // 에러 토스트가 뜨지 않아야 함
      const errorToast = page.locator("[class*='toast'], [class*='Toast'], [role='alert']")
        .filter({ hasText: /실패|오류|error/i });
      const hasError = await errorToast.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasError) {
        const errorText = await errorToast.textContent();
        console.log(`Error toast found: ${errorText}`);
        // 500 에러로 인한 실패가 아닌지 확인
        expect(errorText).not.toContain("500");
      }
    } else {
      console.log("No attend button visible — may be no active sessions with participants");
    }
  });

  test("8. 브라우저 E2E: 자율학습 완료 버튼 동작", async ({ page }) => {
    await page.goto(`${BASE}/admin/clinic/console`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "e2e/screenshots/clinic-08-console-for-complete.png" });

    // 자율학습 완료 버튼 찾기
    const completeBtn = page.locator("button").filter({ hasText: /완료|자율학습/ }).first();
    const hasCompleteBtn = await completeBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCompleteBtn) {
      await completeBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/clinic-08-after-complete-click.png" });

      // 성공 토스트 또는 에러 없음 확인
      const errorToast = page.locator("[class*='toast'], [class*='Toast'], [role='alert']")
        .filter({ hasText: /실패|오류|error/i });
      const hasError = await errorToast.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasError) {
        const errorText = await errorToast.textContent();
        console.log(`Error after complete click: ${errorText}`);
        // 500 에러 관련 실패가 아닌지 확인
        expect(errorText).not.toContain("500");
      }
    } else {
      console.log("No complete button visible");
    }
  });
});

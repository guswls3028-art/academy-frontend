/**
 * 림글리쉬(Tenant 3) 클리닉 트리거 E2E — 전청조 학생
 *
 * 실제 운영 조건에서 클리닉 전체 플로우를 수행하고
 * 알림톡/문자가 01031217466으로 발송되는지 확인합니다.
 *
 * 트리거 순서:
 * 1. 기존 예약 취소 (clinic_cancelled)
 * 2. 재예약 (clinic_reservation_created)
 * 3. 입실 (clinic_check_in)
 * 4. 퇴실 (clinic_check_out)
 */
import { test, expect } from "@playwright/test";

const LIMGLISH_BASE = "https://limglish.kr";
// 로컬 백엔드 사용 — 수정된 코드로 알림 트리거 (SQS → 운영 워커 → 실발송)
const API_BASE = "http://localhost:8000";
const ADMIN_USER = "ggorno";
const ADMIN_PASS = "dlarmsgur12";
const TENANT_CODE = "limglish";

const STUDENT_NAME = "전청조";
const SESSION_ID = 331; // 4월 클리닉 세션

test.describe("림글리쉬 클리닉 트리거 E2E", () => {
  let accessToken: string;

  test.beforeAll(async ({ browser }) => {
    // API 토큰 획득
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
      data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT_CODE },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT_CODE },
    });
    expect(resp.status()).toBe(200);
    const tokens = await resp.json();
    accessToken = tokens.access;
    await ctx.close();
  });

  test("1. 로그인 → 클리닉 운영 콘솔 진입", async ({ page }) => {
    // 토큰 주입 로그인
    await page.goto(`${LIMGLISH_BASE}/login`, { waitUntil: "commit" });
    await page.evaluate(({ access, refresh, code }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
      try { sessionStorage.setItem("tenantCode", code); } catch {}
    }, { access: accessToken, refresh: "", code: TENANT_CODE });

    await page.goto(`${LIMGLISH_BASE}/admin`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);

    // 클리닉 메뉴 진입
    const clinicMenu = page.locator("text=클리닉").first();
    await clinicMenu.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "e2e/screenshots/limglish-clinic-01-menu.png" });
  });

  test("2. 전청조 예약 취소 (clinic_cancelled 트리거)", async ({ page }) => {
    // 토큰 주입 로그인
    await page.goto(`${LIMGLISH_BASE}/login`, { waitUntil: "commit" });
    await page.evaluate(({ access, code }) => {
      localStorage.setItem("access", access);
      try { sessionStorage.setItem("tenantCode", code); } catch {}
    }, { access: accessToken, code: TENANT_CODE });

    // 클리닉 운영 콘솔로 이동
    await page.goto(`${LIMGLISH_BASE}/admin/clinic/operations`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "e2e/screenshots/limglish-clinic-02-operations.png" });

    // 전청조 학생 찾기
    const studentRow = page.locator(`text=${STUDENT_NAME}`).first();
    if (await studentRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await studentRow.click();
      await page.waitForTimeout(500);

      // 상태 변경 → 취소
      const statusBtn = page.locator("button, [role=button]").filter({ hasText: /취소|cancel/i }).first();
      if (await statusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await statusBtn.click();
        await page.waitForTimeout(1000);
        // 확인 버튼
        const confirmBtn = page.locator("button").filter({ hasText: /확인|예/ }).first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
        }
      }
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/limglish-clinic-03-cancelled.png" });
    console.log(">>> clinic_cancelled trigger 완료");
  });

  test("3. API로 직접 트리거 — 취소 → 재예약 → 입실 → 퇴실", async ({ request }) => {
    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Tenant-Code": TENANT_CODE,
    };

    // 현재 예약 조회
    const listResp = await request.get(
      `${API_BASE}/api/v1/clinic/participants/?session=${SESSION_ID}`,
      { headers }
    );
    expect(listResp.status()).toBe(200);
    const participants = await listResp.json();
    console.log(">>> 현재 참가자:", JSON.stringify(participants.results?.map((p: any) => ({
      id: p.id, student_name: p.student_name, status: p.status
    }))));

    // 전청조 찾기
    const target = participants.results?.find((p: any) =>
      p.student_name?.includes("전청조") || p.student_name?.includes("청조")
    );

    let participantId = target?.id;

    // Step 1: 취소 (clinic_cancelled)
    if (participantId && target?.status !== "cancelled") {
      console.log(`>>> Step 1: 취소 (participant ${participantId})`);
      const cancelResp = await request.patch(
        `${API_BASE}/api/v1/clinic/participants/${participantId}/set_status/`,
        { headers, data: { status: "cancelled" } }
      );
      console.log(`>>> cancel response: ${cancelResp.status()}`);
      const cancelBody = await cancelResp.json().catch(() => ({}));
      console.log(`>>> cancel body:`, JSON.stringify(cancelBody));
    }

    // Step 2: 재예약 (clinic_reservation_created)
    console.log(`>>> Step 2: 재예약 (session ${SESSION_ID}, student 1452)`);
    const bookResp = await request.post(
      `${API_BASE}/api/v1/clinic/participants/`,
      { headers, data: { session: SESSION_ID, student: 1452 } }
    );
    console.log(`>>> book response: ${bookResp.status()}`);
    const bookBody = await bookResp.json().catch(() => ({}));
    console.log(`>>> book body:`, JSON.stringify(bookBody));
    participantId = bookBody.id || participantId;

    // 3초 대기 — 알림톡 발송 확인 시간
    await new Promise(r => setTimeout(r, 3000));

    // Step 3: 입실 (clinic_check_in)
    if (participantId) {
      console.log(`>>> Step 3: 입실 (participant ${participantId})`);
      const checkinResp = await request.patch(
        `${API_BASE}/api/v1/clinic/participants/${participantId}/set_status/`,
        { headers, data: { status: "attended" } }
      );
      console.log(`>>> check_in response: ${checkinResp.status()}`);
    }

    await new Promise(r => setTimeout(r, 3000));

    // Step 4: 퇴실 (clinic_check_out)
    if (participantId) {
      console.log(`>>> Step 4: 퇴실 (participant ${participantId})`);
      const checkoutResp = await request.patch(
        `${API_BASE}/api/v1/clinic/participants/${participantId}/set_status/`,
        { headers, data: { status: "completed" } }
      );
      console.log(`>>> check_out response: ${checkoutResp.status()}`);
      // completed 상태는 complete endpoint 사용해야 할 수도
      if (checkoutResp.status() !== 200) {
        // complete action 시도
        const completeResp = await request.post(
          `${API_BASE}/api/v1/clinic/participants/${participantId}/complete/`,
          { headers, data: {} }
        );
        console.log(`>>> complete response: ${completeResp.status()}`);
      }
    }

    await new Promise(r => setTimeout(r, 3000));
    console.log(">>> 모든 클리닉 트리거 완료. 01031217466 문자 수신 확인 필요.");
  });
});

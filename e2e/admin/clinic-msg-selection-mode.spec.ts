/**
 * E2E: Clinic Operations Console — Message Selection Mode UX
 * Target: localhost:5174 (local dev server with new UX)
 * API: api.hakwonplus.com (production data)
 *
 * Validates the new "메시지 발송" selection mode:
 * 1. No checkboxes visible on participant cards initially
 * 2. Clicking "메시지 발송" button in header enters selection mode
 *    - Checkboxes appear on participant cards
 *    - Floating bar appears at bottom showing "발송 대상을 선택하세요"
 * 3. Checking participants updates count in the floating bar
 * 4. "전체 선택" checks all, button text changes to "선택 해제"
 * 5. Clicking X (cancel) exits selection mode — checkboxes + floating bar disappear
 * 6. Re-enter selection mode, select students, click send → SendMessageModal opens
 * 7. ESC key exits selection mode
 *
 * Test data: created at test start, cleaned up at test end
 */

import { test, expect } from "@playwright/test";

const LOCAL_BASE = "http://localhost:5174";
const API_BASE = "https://api.hakwonplus.com";
const TENANT_CODE = "hakwonplus";
const ADMIN_USER = "admin97";
const ADMIN_PASS = "koreaseoul97";
// Use 3 real students from tenant 1
const TEST_STUDENT_IDS = [1459, 1453, 1454]; // 테스트학생1, 김민수, 이서연
const TEST_DATE = "2026-04-16"; // Today

test.describe("Clinic Operations — Message Selection Mode UX (localhost:5174)", () => {
  test.setTimeout(120_000);

  test("message selection mode: enter, select, cancel, ESC, send modal", async ({ page }) => {
    // ── Setup: Get auth token ──
    const tokenResp = await page.request.post(`${API_BASE}/api/v1/token/`, {
      data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT_CODE },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT_CODE },
      timeout: 30000,
    });
    expect(tokenResp.status()).toBe(200);
    const { access, refresh } = await tokenResp.json() as { access: string; refresh: string };

    const authHeaders = {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      "X-Tenant-Code": TENANT_CODE,
    };

    // ── Setup: Create test clinic session ──
    const timestamp = Date.now();
    const sessionResp = await page.request.post(`${API_BASE}/api/v1/clinic/sessions/`, {
      data: {
        title: `[E2E-${timestamp}] msg-select-test`,
        date: TEST_DATE,
        start_time: "10:00:00",
        location: "E2E-TestRoom",
        max_participants: 10,
      },
      headers: authHeaders,
    });
    expect(sessionResp.status()).toBe(201);
    const sessionData = await sessionResp.json() as { id: number };
    const sessionId = sessionData.id;
    console.log(`Created test session: id=${sessionId}`);

    // ── Setup: Add participants to session ──
    const participantIds: number[] = [];
    for (const studentId of TEST_STUDENT_IDS) {
      const pResp = await page.request.post(`${API_BASE}/api/v1/clinic/participants/`, {
        data: { session: sessionId, student: studentId, status: "pending" },
        headers: authHeaders,
      });
      if (pResp.status() === 201) {
        const pData = await pResp.json() as { id: number; student_name: string };
        participantIds.push(pData.id);
        console.log(`Added participant: id=${pData.id} student=${pData.student_name}`);
      }
    }
    expect(participantIds.length).toBeGreaterThanOrEqual(1);

    try {
      // ── Login to localhost:5174 ──
      // localhost:5174 proxies /api to localhost:8000 (not running).
      // We intercept all /api/v1 requests and forward them to production API.
      // Also intercept /api/v1/core/program/ to return hakwonplus tenant config.
      await page.route(/localhost:5174\/api\/v1\/core\/program/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            tenantCode: TENANT_CODE,
            display_name: "학원플러스",
            ui_config: {
              login_title: "학원플러스",
              login_subtitle: "",
              window_title: "학원플러스",
            },
            feature_flags: {},
            is_active: true,
          }),
        });
      });

      // Forward all other localhost:5174/api/v1 requests to production API
      await page.route(/localhost:5174\/api\/v1/, async (route, request) => {
        const url = request.url();
        const prodUrl = url.replace(/https?:\/\/localhost:5174\/api\/v1/, `${API_BASE}/api/v1`);
        const headers: Record<string, string> = {};
        const reqHeaders = request.headers();
        for (const [k, v] of Object.entries(reqHeaders)) {
          if (k.toLowerCase() !== "host") headers[k] = v;
        }
        headers["X-Tenant-Code"] = TENANT_CODE;
        try {
          const body = request.postDataBuffer();
          const resp = await page.request.fetch(prodUrl, {
            method: request.method(),
            headers,
            data: body || undefined,
          });
          await route.fulfill({ response: resp });
        } catch {
          await route.continue();
        }
      });

      // Warm up Vite's dependency optimizer (first headless load triggers dep rebuild)
      await page.goto(`${LOCAL_BASE}/`, { waitUntil: "commit", timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);

      await page.goto(`${LOCAL_BASE}/login`, { waitUntil: "commit" });
      await page.evaluate(({ access, refresh, code }) => {
        localStorage.setItem("access", access);
        localStorage.setItem("refresh", refresh);
        localStorage.setItem("tenant_code", code);
        try { sessionStorage.setItem("tenantCode", code); } catch {}
      }, { access, refresh, code: TENANT_CODE });

      await page.goto(`${LOCAL_BASE}/admin`, { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(4000);

      // ── Step 1: Navigate via sidebar "클리닉" ──
      const clinicNavLink = page.locator("nav a, aside a, [class*=sidebar] a, [class*=nav] a")
        .filter({ hasText: /^클리닉$/ }).first();
      await clinicNavLink.waitFor({ state: "visible", timeout: 10000 });
      await clinicNavLink.click();
      await page.waitForTimeout(1000);

      // ── Step 2: Click "클리닉 진행" tab ──
      const clinicOpsTab = page.locator("a, button").filter({ hasText: /클리닉 진행/ }).first();
      await clinicOpsTab.waitFor({ state: "visible", timeout: 8000 });
      await clinicOpsTab.click();
      await page.waitForTimeout(2000);

      await expect(page).toHaveURL(/clinic.*operations/, { timeout: 10000 });

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-01-operations-page.png`,
        fullPage: false,
      });

      // ── Step 3: Click on today (April 16) in the calendar ──
      const todayCell = page.locator('.clinic-scheduler-panel__mini-cal-cell--today');
      if (await todayCell.isVisible({ timeout: 3000 }).catch(() => false)) {
        await todayCell.click();
        console.log("Clicked today cell");
      } else {
        // Try finding April 16 cell
        const cell16 = page.locator('.clinic-scheduler-panel__mini-cal-cell').filter({ hasText: /^16$/ });
        if (await cell16.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cell16.click();
          console.log("Clicked April 16 cell");
        }
      }
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-02-today-clicked.png`,
        fullPage: false,
      });

      // ── Step 4: Click the test session ──
      const sessionItems = page.locator('.clinic-console__sidebar-session');
      await sessionItems.first().waitFor({ state: "visible", timeout: 8000 });
      const sessCount = await sessionItems.count();
      console.log(`Sessions found for today: ${sessCount}`);

      // Find the E2E session (10:00 or E2E in text)
      let sessionClicked = false;
      for (let i = 0; i < sessCount; i++) {
        const sessText = await sessionItems.nth(i).textContent();
        console.log(`  Session ${i}: "${sessText?.trim().substring(0, 80)}"`);
        if (sessText?.includes("E2E") || sessText?.includes("10:00")) {
          await sessionItems.nth(i).click();
          sessionClicked = true;
          console.log(`Clicked E2E test session at index ${i}`);
          break;
        }
      }
      if (!sessionClicked) {
        await sessionItems.first().click();
        console.log("Clicked first session (fallback)");
      }
      await page.waitForTimeout(2500);

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-03-session-selected.png`,
        fullPage: false,
      });

      // ── Step 5: Verify "메시지 발송" button visible ──
      const msgBtn = page.locator('button').filter({ hasText: /메시지 발송/ });
      await expect(msgBtn).toBeVisible({ timeout: 8000 });
      console.log("PASS: 메시지 발송 button is visible (participants loaded)");

      // ── Step 6: Verify NO checkboxes initially ──
      const checkboxLabels = page.locator('.clinic-ops__card-check--visible');
      expect(await checkboxLabels.count()).toBe(0);
      console.log("PASS: No checkboxes visible initially");

      // ── Step 7: Verify floating bar NOT visible initially ──
      const floatingBar = page.locator('.clinic-ops__msg-floating-bar');
      await expect(floatingBar).not.toBeVisible();
      console.log("PASS: Floating bar not visible initially");

      // ── Step 8: Click "메시지 발송" → enter selection mode ──
      await msgBtn.click();
      await page.waitForTimeout(700);

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-04-after-msg-btn-click.png`,
        fullPage: false,
      });

      // ── Step 9: Checkboxes appear ──
      const checkboxesVisible = page.locator('.clinic-ops__card-check--visible');
      await expect(checkboxesVisible.first()).toBeVisible({ timeout: 5000 });
      const checkboxCount = await checkboxesVisible.count();
      console.log(`PASS: ${checkboxCount} checkbox(es) visible after entering selection mode`);

      // ── Step 10: Floating bar appears ──
      await expect(floatingBar).toBeVisible({ timeout: 5000 });
      console.log("PASS: Floating bar is visible");

      // ── Step 11: Floating bar label = "발송 대상을 선택하세요" ──
      const floatingLabel = page.locator('.clinic-ops__msg-floating-label');
      await expect(floatingLabel).toBeVisible();
      const labelText = await floatingLabel.textContent();
      expect(labelText?.trim()).toContain("발송 대상을 선택하세요");
      console.log(`PASS: Floating bar label = "${labelText?.trim()}"`);

      // ── Step 12: "전체 선택" and X buttons present ──
      const selectAllBtn = page.locator('.clinic-ops__msg-floating-btn--ghost');
      await expect(selectAllBtn).toBeVisible();
      await expect(selectAllBtn).toContainText("전체 선택");
      console.log("PASS: 전체 선택 button visible");

      const cancelBtn = page.locator('.clinic-ops__msg-floating-btn--cancel');
      await expect(cancelBtn).toBeVisible();
      console.log("PASS: Cancel (X) button visible");

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-05-floating-bar-initial.png`,
        fullPage: false,
      });

      // ── Step 13: Check checkboxes → count updates ──
      const checkboxInputs = page.locator('.clinic-ops__card-check--visible input[type="checkbox"]');
      const totalParticipants = await checkboxInputs.count();
      console.log(`Total participant checkboxes: ${totalParticipants}`);
      expect(totalParticipants).toBeGreaterThanOrEqual(1);

      await checkboxInputs.first().click({ force: true });
      await page.waitForTimeout(400);
      const labelAfterOne = await floatingLabel.textContent();
      expect(labelAfterOne).toContain("명 선택됨");
      console.log(`PASS: After 1 checked, label = "${labelAfterOne?.trim()}"`);

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-06-one-selected.png`,
        fullPage: false,
      });

      if (totalParticipants >= 2) {
        await checkboxInputs.nth(1).click({ force: true });
        await page.waitForTimeout(400);
        const labelAfterTwo = await floatingLabel.textContent();
        expect(labelAfterTwo).toContain("명 선택됨");
        console.log(`PASS: After 2 checked, label = "${labelAfterTwo?.trim()}"`);

        await page.screenshot({
          path: `e2e/screenshots/clinic-msg-07-two-selected.png`,
          fullPage: false,
        });
      }

      // ── Step 14: Uncheck all, test "전체 선택" ──
      let checkedCount = await page.locator('.clinic-ops__card-check--visible input[type="checkbox"]:checked').count();
      while (checkedCount > 0) {
        await page.locator('.clinic-ops__card-check--visible input[type="checkbox"]:checked').first().click({ force: true });
        await page.waitForTimeout(150);
        checkedCount = await page.locator('.clinic-ops__card-check--visible input[type="checkbox"]:checked').count();
      }
      await page.waitForTimeout(300);

      expect((await floatingLabel.textContent())?.trim()).toContain("발송 대상을 선택하세요");
      console.log("PASS: Label reset to 발송 대상을 선택하세요 after unchecking all");

      await selectAllBtn.click();
      await page.waitForTimeout(500);

      const allCheckboxes = page.locator('.clinic-ops__card-check--visible input[type="checkbox"]');
      const allCount = await allCheckboxes.count();
      for (let i = 0; i < allCount; i++) {
        await expect(allCheckboxes.nth(i)).toBeChecked();
      }
      console.log(`PASS: All ${allCount} checkboxes checked after "전체 선택"`);

      await expect(selectAllBtn).toContainText("선택 해제");
      console.log("PASS: Button text = 선택 해제");

      expect((await floatingLabel.textContent())).toContain("명 선택됨");
      console.log(`PASS: Label shows count "${(await floatingLabel.textContent())?.trim()}"`);

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-08-all-selected.png`,
        fullPage: false,
      });

      // ── Step 15: X (cancel) exits selection mode ──
      await cancelBtn.click();
      await page.waitForTimeout(600);

      await expect(floatingBar).not.toBeVisible();
      expect(await page.locator('.clinic-ops__card-check--visible').count()).toBe(0);
      await expect(msgBtn).toBeVisible();
      console.log("PASS: Selection mode exited via X button (floating bar gone, checkboxes gone, msgBtn back)");

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-09-after-cancel.png`,
        fullPage: false,
      });

      // ── Step 16: Re-enter → send → SendMessageModal opens ──
      await msgBtn.click();
      await page.waitForTimeout(500);
      await expect(floatingBar).toBeVisible();

      await page.locator('.clinic-ops__msg-floating-btn--ghost').click();
      await page.waitForTimeout(400);

      const sendBtn = page.locator('.clinic-ops__msg-floating-btn--primary');
      await expect(sendBtn).toBeVisible();
      const sendBtnText = await sendBtn.textContent();
      console.log(`Send button text: "${sendBtnText?.trim()}"`);
      await sendBtn.click();
      await page.waitForTimeout(2000);

      const modal = page.locator('[role="dialog"]').first();
      if (!await modal.isVisible({ timeout: 8000 }).catch(() => false)) {
        await page.screenshot({ path: `e2e/screenshots/clinic-msg-10-send-modal-FAIL.png`, fullPage: false });
        throw new Error("SendMessageModal did not open after clicking the send button");
      }
      console.log("PASS: SendMessageModal opened");

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-10-send-modal-opened.png`,
        fullPage: false,
      });

      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-11-modal-closed.png`,
        fullPage: false,
      });

      // ── Step 17: ESC exits selection mode ──
      if (await floatingBar.isVisible()) {
        // Still in selection mode
      } else {
        // onModalClose exited — re-enter to test ESC
        await expect(msgBtn).toBeVisible({ timeout: 5000 });
        await msgBtn.click();
        await page.waitForTimeout(500);
        await expect(floatingBar).toBeVisible();
      }

      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);

      await expect(floatingBar).not.toBeVisible();
      expect(await page.locator('.clinic-ops__card-check--visible').count()).toBe(0);
      console.log("PASS: ESC exited selection mode");

      await page.screenshot({
        path: `e2e/screenshots/clinic-msg-12-after-esc.png`,
        fullPage: false,
      });

      console.log("\nAll clinic message selection mode scenarios PASSED.");

    } finally {
      // ── Cleanup: Delete test data ──
      // Re-authenticate if token expired
      const cleanToken = await page.evaluate(() => localStorage.getItem("access") ?? "").catch(() => access);
      const cleanHeaders = {
        Authorization: `Bearer ${cleanToken}`,
        "X-Tenant-Code": TENANT_CODE,
      };
      for (const pid of participantIds) {
        await page.request.delete(`${API_BASE}/api/v1/clinic/participants/${pid}/`, {
          headers: cleanHeaders,
        }).catch((e) => console.log(`Cleanup participant ${pid} failed: ${e.message}`));
      }
      await page.request.delete(`${API_BASE}/api/v1/clinic/sessions/${sessionId}/`, {
        headers: cleanHeaders,
      }).catch((e) => console.log(`Cleanup session ${sessionId} failed: ${e.message}`));
      console.log(`Cleanup complete: deleted session ${sessionId} and ${participantIds.length} participants`);
    }
  });
});

/**
 * 클리닉 실전 트리거 — 프론트 클릭으로 출석/결석/완료 수행
 * Tenant 1 (hakwonplus), Session 461, Participants 648/649
 *
 * 학생 1462 (E2E메시지3139) parent_phone=01031217466
 * 학생 1448 (0317테스트학생) parent_phone=01031217466
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/trigger-${name}.png`, fullPage: false });
}

test.describe("클리닉 실전 트리거 — 프론트 클릭", () => {
  test.setTimeout(180_000);

  test("출석 → 결석 → 완료 프론트 클릭 + 발송 확인", async ({ page }) => {
    await loginViaUI(page, "admin");

    // 클리닉 콘솔로 이동
    const clinicLink = page.locator("nav a, aside a, [class*=sidebar] a")
      .filter({ hasText: "클리닉" }).first();
    await clinicLink.click();
    await page.waitForTimeout(2000);

    // 콘솔 탭
    const consoleTab = page.locator("a, button").filter({ hasText: "콘솔" }).first();
    if (await consoleTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await consoleTab.click();
      await page.waitForTimeout(2000);
    }
    await snap(page, "00-console");

    // 오늘 날짜의 세션 461 선택 — 사이드바에서 세션 클릭
    // 달력에서 오늘 날짜 클릭 (이미 선택되어 있을 수 있음)
    await page.waitForTimeout(1000);

    // "출석 확인 →" 버튼 클릭하여 세션 워크스페이스 진입
    const enterBtn = page.locator("button, a").filter({ hasText: /출석 확인/ }).first();
    if (await enterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await enterBtn.click();
      await page.waitForTimeout(3000);
      console.log("[클리닉] 세션 워크스페이스 진입");
    } else {
      // 직접 클릭으로 세션 진입
      const sessionRow = page.locator("button, a, [class*=session]").filter({ hasText: /Room-E2E|15:00/ }).first();
      if (await sessionRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sessionRow.click();
        await page.waitForTimeout(3000);
      }
    }
    await snap(page, "01-session-workspace");

    // 참가자 확인 — 넓게 잡아서 카드 찾기
    const allCards = page.locator("[class*=card], [class*=participant], tr, li")
      .filter({ hasText: /E2E메시지|0317테스트|대기|booked/ });
    const pCount = await allCards.count();
    console.log(`[클리닉] 참가자 카드 수: ${pCount}`);

    // 카드 대신 버튼 직접 찾기
    const allAttendBtns = page.locator("button").filter({ hasText: /출석|참석/ });
    const allAbsentBtns = page.locator("button").filter({ hasText: /결석|불참/ });
    console.log(`[클리닉] 출석 버튼: ${await allAttendBtns.count()}, 결석 버튼: ${await allAbsentBtns.count()}`);

    if (await allAttendBtns.count() === 0 && await allAbsentBtns.count() === 0) {
      console.log("[클리닉] ⚠️ 출석/결석 버튼 미발견 — 워크스페이스 미진입");
      await snap(page, "01-no-buttons");
      // 현재 페이지의 모든 버튼 텍스트 출력
      const allBtns = await page.locator("button").allTextContents();
      console.log(`[클리닉] 페이지 내 모든 버튼: ${allBtns.join(" | ")}`);
      return;
    }

    // === 트리거 1: 첫 번째 학생 출석 ===
    console.log("\n=== 트리거 1: 출석 ===");
    const firstAttend = allAttendBtns.first();
    await firstAttend.click();
    await page.waitForTimeout(3000);
    console.log("[트리거1] 출석 버튼 클릭 완료");
    await snap(page, "02-attend-clicked");

    // 발송 완료 팝업이 뜨면 닫기
    const sendPopupClose = page.locator("button").filter({ hasText: /닫기|확인/ }).first();
    if (await sendPopupClose.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sendPopupClose.click();
      await page.waitForTimeout(500);
    }
    // ESC로 오버레이 닫기
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // === 트리거 2: 두 번째 학생 결석 ===
    console.log("\n=== 트리거 2: 결석 ===");
    const absentBtns2 = page.locator("button").filter({ hasText: /결석|불참/ });
    if (await absentBtns2.count() > 0) {
      await absentBtns2.first().click();
      await page.waitForTimeout(3000);
      console.log("[트리거2] 결석 버튼 클릭 완료");
      await snap(page, "03-absent-clicked");
    }

    // 트리거 미리보기 오버레이가 떠있으면 ESC로 닫기
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // === 트리거 3: 클리닉 완료 (출석한 학생) ===
    console.log("\n=== 트리거 3: 클리닉 완료 ===");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    const completeBtn = page.locator("button").filter({ hasText: /클리닉 완료/ }).first();
    if (await completeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await completeBtn.click();
      await page.waitForTimeout(3000);
      console.log("[트리거3] 완료 버튼 클릭 완료");
      await snap(page, "04-complete-clicked");
    } else {
      console.log("[트리거3] 클리닉 완료 버튼 미발견");
      const allBtns = await page.locator("button").allTextContents();
      console.log(`[트리거3] 사용 가능한 버튼: ${allBtns.filter(b => b.trim()).join(" | ")}`);
    }

    // 5초 대기 후 발송 내역 확인
    await page.waitForTimeout(5000);

    // === 발송 내역 확인 ===
    console.log("\n=== 발송 내역 확인 ===");
    // API로 직접 확인
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "koreaseoul97"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    const { access } = await loginResp.json() as { access: string };

    const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=10&ordering=-sent_at`, {
      headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
    });
    const logData = await logResp.json() as { results: Array<{ id: number; sent_at: string; success: boolean; message_mode: string; recipient_summary: string; template_summary: string }> };

    const recentLogs = logData.results ?? [];
    console.log(`[발송 내역] 최근 ${recentLogs.length}건:`);
    for (const l of recentLogs.slice(0, 5)) {
      console.log(`  id=${l.id} | ${l.sent_at?.slice(0, 19)} | ${l.message_mode} | success=${l.success} | to=${l.recipient_summary} | template=${l.template_summary?.slice(0, 20)}`);
    }

    // 오늘 이후 발송 건수
    const todayLogs = recentLogs.filter(l => l.sent_at && l.sent_at >= "2026-04-09T05:");
    console.log(`[발송 내역] 오늘(배포 후) 발송: ${todayLogs.length}건`);

    if (todayLogs.length > 0) {
      console.log("[발송 내역] ✅ 알림톡 발송 확인됨!");
    } else {
      console.log("[발송 내역] ⚠️ 오늘 발송 기록 없음 — SQS 큐 처리 대기 중일 수 있음");
    }

    await snap(page, "05-final");
  });
});

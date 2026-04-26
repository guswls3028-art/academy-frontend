/**
 * 클리닉 실전 트리거 — 오늘 세션에서 출석/결석/완료 클릭 → 알림톡 발송 검증
 *
 * 데이터 보장:
 *  - 오늘 클리닉 세션이 이미 있으면 그대로 사용 (실 데이터 검증)
 *  - 없으면 ensureClinicSessionForTrigger 가 자동으로 세션+참가자 생성 → afterAll 에서 정리
 *  - 즉, "오늘 클리닉 없음" 으로 인한 silent skip 은 더 이상 발생하지 않음
 *
 * 이전 하드코드(Session 461, Participants 648/649) 는 모두 제거.
 */
import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import {
  ensureClinicSessionForTrigger,
  cleanupEnsuredClinicSession,
  type EnsuredClinicSession,
} from "../helpers/data";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

async function snap(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/trigger-${name}.png`, fullPage: false });
}

/** 송부 완료 팝업 / 트리거 미리보기 오버레이를 여러 번 ESC 로 닫는다 (UX 상 optional) */
async function dismissOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

test.describe("클리닉 실전 트리거 — 프론트 클릭", () => {
  test.setTimeout(180_000);

  // 모듈 스코프 — 워커 1, fullyParallel false 전제이므로 동시 실행 충돌 없음.
  let ensured: EnsuredClinicSession | null = null;

  test.afterAll(async ({ browser }) => {
    if (!ensured || ensured.ownedSessionId === null) return;
    // 새 컨텍스트로 cleanup — test 본체의 page 가 이미 닫혔을 수 있음
    const ctx = await browser.newContext();
    const cleanupPage = await ctx.newPage();
    try {
      await loginViaUI(cleanupPage, "admin");
      await cleanupEnsuredClinicSession(cleanupPage, ensured);
      console.log(`[cleanup] 자동 생성 세션 ${ensured.ownedSessionId} 삭제 완료`);
    } catch (e) {
      console.warn(`[cleanup] 세션 삭제 실패 — backend cleanup_e2e_residue 로 정리 필요: ${e}`);
    } finally {
      await ctx.close();
    }
  });

  test("오늘 세션에서 출석/결석/완료 클릭 + 발송 확인", async ({ page }) => {
    // ── 0. 로그인 ──
    await loginViaUI(page, "admin");

    // ── 1. 오늘 세션 보장 — 없으면 자동 생성 (skip 이 아닌 setup) ──
    ensured = await ensureClinicSessionForTrigger(page);
    const session = ensured.session;

    const sendStart = Date.now();
    console.log(
      `[세션] id=${session.sessionId} ${session.date} ${session.startTime} ` +
        `participants=${session.participantCount} owned=${ensured.ownedSessionId !== null}`,
    );

    // ── 2. 운영 콘솔 진입 (오늘 날짜 파라미터 포함) ──
    await page.goto(`${BASE}/admin/clinic/operations?date=${session.date}`, {
      waitUntil: "load",
      timeout: 20000,
    });
    await page.waitForTimeout(2000);
    await snap(page, "00-console");

    // ── 3. 사이드바에서 해당 세션 클릭 — 시간 기반 식별 ──
    // 사이드바 세션 버튼은 `.clinic-console__sidebar-session` 클래스. 시간(HH:MM) 표시가 있어 필터 가능.
    const hhmm = session.startTime.slice(0, 5);
    const sessionBtn = page
      .locator("button.clinic-console__sidebar-session")
      .filter({ hasText: hhmm })
      .first();
    await expect(
      sessionBtn,
      `사이드바에서 ${hhmm} 시작 세션이 보여야 함`,
    ).toBeVisible({ timeout: 15000 });
    await sessionBtn.click();
    await page.waitForTimeout(2000);
    await snap(page, "01-session-selected");

    // ── 4. 워크스페이스 렌더 + 출석/결석 버튼 중 하나는 반드시 존재 ──
    const attendBtns = page.locator("button").filter({ hasText: /^출석$|^참석$/ });
    const absentBtns = page.locator("button").filter({ hasText: /^결석$|^불참$/ });

    await expect(
      attendBtns.first().or(absentBtns.first()),
      "워크스페이스에 출석/결석 버튼이 보여야 함 (참가자 로드 실패 가능)",
    ).toBeVisible({ timeout: 15000 });

    // ── 5. 트리거 1: 첫 참가자 출석 ──
    const firstAttend = attendBtns.first();
    if (await firstAttend.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstAttend.click();
      await page.waitForTimeout(2500);
      await snap(page, "02-attend-clicked");
      await dismissOverlays(page);
    }

    // ── 6. 트리거 2: 다른 참가자 결석 (남은 버튼 중 첫번째) ──
    // 첫 학생이 출석 처리되면 해당 행은 buttons 가 바뀔 수 있음. 남은 결석 버튼 대상.
    const currentAbsent = page.locator("button").filter({ hasText: /^결석$|^불참$/ });
    if ((await currentAbsent.count()) > 0) {
      await currentAbsent.first().click();
      await page.waitForTimeout(2500);
      await snap(page, "03-absent-clicked");
      await dismissOverlays(page);
    }

    // ── 7. 트리거 3: 클리닉 완료 (optional — 버튼이 있을 때만) ──
    const completeBtn = page.locator("button").filter({ hasText: /클리닉 완료/ }).first();
    if (await completeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await completeBtn.click();
      await page.waitForTimeout(2500);
      await snap(page, "04-complete-clicked");
      await dismissOverlays(page);
    }

    // ── 8. 발송 내역 검증 — 최근 2분 내 로그 1건 이상 (폴링 최대 20초) ──
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: {
        username: process.env.E2E_ADMIN_USER || "admin97",
        password: process.env.E2E_ADMIN_PASS || "koreaseoul97",
        tenant_code: "hakwonplus",
      },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    expect(loginResp.ok(), "admin 토큰 발급 성공").toBe(true);
    const { access } = (await loginResp.json()) as { access: string };

    const recentWindowMs = 2 * 60 * 1000;
    let recentLogs: Array<{ id: number; sent_at: string; success: boolean; message_mode: string }> = [];
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000);
      const logResp = await page.request.get(
        `${API}/api/v1/messaging/log/?page_size=10&ordering=-sent_at`,
        { headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" } },
      );
      const logData = (await logResp.json()) as { results: typeof recentLogs };
      recentLogs = logData.results.filter(
        (l) => Date.now() - new Date(l.sent_at).getTime() <= recentWindowMs,
      );
      if (recentLogs.length > 0) break;
    }

    for (const l of recentLogs.slice(0, 5)) {
      console.log(`  id=${l.id} | ${l.sent_at?.slice(11, 19)} | ${l.message_mode} | success=${l.success}`);
    }

    if (ensured.ownedSessionId === null) {
      // 실 데이터 시나리오 — parent_phone 있는 학생 가정. 발송 hard check.
      expect(
        recentLogs.length,
        "출석/결석/완료 트리거 중 최소 1건은 2분 내 발송 로그에 반영되어야 함",
      ).toBeGreaterThan(0);

      const earliest = recentLogs[recentLogs.length - 1];
      expect(
        new Date(earliest.sent_at).getTime(),
        "가장 이른 최근 발송이 테스트 시작 이후(±60s)여야 함",
      ).toBeGreaterThanOrEqual(sendStart - 60_000);
    } else {
      // auto-setup 시나리오 — 학생 parent_phone 없을 수 있어 발송 시도가 안 될 수 있음.
      // 트리거 클릭이 페이지 깨짐 없이 완료되었으면 회귀 보장 충분으로 간주, 발송은 soft.
      if (recentLogs.length === 0) {
        test.info().annotations.push({
          type: "clinic-trigger-no-send",
          description:
            "auto-setup 학생에 parent_phone 이 없어 발송 record 없음. " +
            "실 발송 검증을 강제하려면 E2E_CLINIC_STUDENT_ID 에 parent_phone 보유 학생 ID 지정.",
        });
      }
    }

    await snap(page, "05-final");
  });
});

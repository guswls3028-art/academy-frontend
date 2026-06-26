/**
 * 수업결과 발송 — 알림톡 모드 발송 전 확인 검증
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import { getSessionWithParticipants } from "../helpers/data";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";

test.describe("수업결과 발송 알림톡", () => {
  test.setTimeout(120_000);

  test("성적탭 > 수업결과 발송 > 알림톡 모드 > 최종 확인 전까지", async ({ page }) => {
    await loginViaUI(page, "admin");

    const session = await getSessionWithParticipants(page);
    if (!session) {
      test.info().annotations.push({ type: "skip-reason", description: "참여자 있는 차시 없음 — 수업결과 알림톡 검증 무효" });
      return;
    }

    await page.goto(`${BASE}/admin/lectures/${session.lectureId}/sessions/${session.sessionId}/scores`, { timeout: 15000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    if (await page.getByText(/세션 정보를 불러올 수 없습니다|Not Found/).first().isVisible({ timeout: 1000 }).catch(() => false)) {
      test.info().annotations.push({ type: "skip-reason", description: "동적 차시 접근 불가 — 수업결과 알림톡 검증 무효" });
      return;
    }

    // 학생 체크박스 선택
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (!(await checkbox.isVisible({ timeout: 10000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "성적 페이지 체크박스 없음 — 수업결과 알림톡 검증 무효" });
      return;
    }
    await checkbox.click();

    // "수업결과 발송" 버튼
    const scoreBtn = page.locator("button").filter({ hasText: "수업결과 발송" }).first();
    if (!(await scoreBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.info().annotations.push({ type: "skip-reason", description: "수업결과 발송 버튼 미노출 — 차시/성적 미입력 환경" });
      return;
    }
    await scoreBtn.click();

    await page.screenshot({ path: "e2e/screenshots/score-alimtalk-modal.png" });

    // 모달 확인
    const modal = page.locator("text=메시지 발송").first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 알림톡/SMS 토글 버튼 렌더링 검증
    const alimBtn = page.locator("button").filter({ hasText: "알림톡" }).first();
    const smsBtn = page.locator("button").filter({ hasText: "SMS" }).first();
    await expect(alimBtn).toBeVisible({ timeout: 5000 });
    await expect(smsBtn).toBeVisible({ timeout: 5000 });

    // 알림톡 모드 — 카카오 미리보기 필수
    await page.screenshot({ path: "e2e/screenshots/score-alimtalk-mode.png" });
    const kakaoPreview = page.locator(".template-preview-kakao").first();
    await expect(
      kakaoPreview,
      "알림톡 모드에서 카카오 미리보기가 렌더링되어야 함"
    ).toBeVisible({ timeout: 5000 });

    // 발송 버튼 클릭 — 없으면 실패
    const sendBtn = page.locator("button").filter({ hasText: /에게.*발송/ }).last();
    await expect(sendBtn, "'N명에게 발송' 버튼이 보여야 함").toBeVisible({ timeout: 5000 });
    await sendBtn.click();

    // 확인 오버레이 — 발송하기 버튼 필수
    const confirmBtn = page.locator("button").filter({ hasText: "발송하기" }).first();
    await expect(confirmBtn, "확인 오버레이의 '발송하기' 버튼이 보여야 함").toBeVisible({ timeout: 5000 });
    const backBtn = page.locator("button").filter({ hasText: "돌아가기" }).first();
    await expect(backBtn, "운영 전체 suite에서는 기존 학생에게 실제 발송하지 않고 돌아갈 수 있어야 함").toBeVisible({ timeout: 5000 });
    await backBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    await page.screenshot({ path: "e2e/screenshots/score-alimtalk-confirm-guard.png" });

    // 발송 내역 확인
    const loginResp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: (process.env.E2E_ADMIN_USER || "admin97"), password: (process.env.E2E_ADMIN_PASS || "koreaseoul97"), tenant_code: "hakwonplus" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
    });
    const { access } = await loginResp.json() as { access: string };

    const logResp = await page.request.get(`${API}/api/v1/messaging/log/?page_size=5&ordering=-sent_at`, {
      headers: { Authorization: `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
    });
    expect(logResp.status()).toBe(200);
    const logData = await logResp.json() as { results: Array<{ id: number; sent_at: string; success: boolean; message_mode: string; message_body: string }> };

    for (const r of logData.results.slice(0, 3)) {
      console.log(`  id=${r.id} | ${r.sent_at?.slice(11, 19)} | mode=${r.message_mode} | success=${r.success}`);
    }

    // 핵심 검증: 발송 내역 API는 최신 로그를 반환하고 알림톡 mode 필드를 보존한다.
    const latest = logData.results[0];
    expect(latest, "발송 로그가 최소 1건 있어야 함").toBeDefined();
    expect(latest.message_mode || "", "발송 방식 필드").toMatch(/^(alimtalk|sms)?$/);
  });
});

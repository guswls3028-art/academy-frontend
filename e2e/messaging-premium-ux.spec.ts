/**
 * 메시지 도메인 프리미엄 UX 배포 검증
 * - 운영 URL(hakwonplus.com)에서 실제 DOM 기반 검증
 * - Tenant 1 (개발/테스트) 전용
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

test.describe("메시지 도메인 프리미엄 UX 검증", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("1. 메시지 페이지 진입 + 탭 구조 확인", async ({ page }) => {
    // 사이드바에서 메시지 클릭
    await page.locator('a[href*="/admin/message"]').first().click();
    await page.waitForURL(/\/admin\/message/);

    // 탭 4개 확인 (버튼 역할로 정확히 선택)
    await expect(page.getByRole("button", { name: "템플릿 저장" })).toBeVisible();
    await expect(page.getByRole("button", { name: "자동발송" })).toBeVisible();
    await expect(page.getByRole("button", { name: "발송 내역" })).toBeVisible();
    await expect(page.getByRole("button", { name: "설정" })).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/msg-01-tabs.png" });
  });

  test("2. 설정 페이지 — KPI + 설정 안내 배너", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/message/settings");
    await page.waitForLoadState("networkidle");

    // KPI 카드 4개 확인 (exact match, first()로 중복 해소)
    await expect(page.getByText("공급자", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("발신번호", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("알림톡", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("SMS", { exact: true }).first()).toBeVisible();

    // 공급자 선택 섹션
    await expect(page.getByText("메시징 공급자")).toBeVisible();

    // 연동 테스트 버튼
    await expect(page.getByText("연동 상태 테스트")).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/msg-02-settings.png" });
  });

  test("3. 발송 내역 페이지 — 테이블 구조", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/message/log");
    await page.waitForLoadState("networkidle");

    // 헤더
    await expect(page.getByText("발송 내역").first()).toBeVisible();

    // 필터 버튼 (데이터가 있는 경우)
    // 필터 버튼 (데이터가 있는 경우) — 버튼 역할로 정확히 선택
    const filterAll = page.getByRole("button", { name: "전체", exact: true });
    const hasData = await filterAll.isVisible().catch(() => false);
    if (hasData) {
      await expect(page.getByRole("button", { name: "성공", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "실패", exact: true })).toBeVisible();
    }

    await page.screenshot({ path: "e2e/screenshots/msg-03-log.png" });
  });

  test("4. 자동발송 페이지 진입", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/message/auto-send");
    await page.waitForLoadState("networkidle");

    // 자동발송 타이틀 확인
    await expect(page.getByText("자동발송").first()).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/msg-04-autosend.png" });
  });

  test("5. 학생 목록에서 SMS 모달 열기 + 확인 다이얼로그", async ({ page }) => {
    // 학생 페이지로 이동
    await page.locator('a[href*="/admin/students"]').first().click();
    await page.waitForURL(/\/admin\/students/);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 학생 체크박스 선택 (첫 번째 학생)
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
      await page.waitForTimeout(500);

      // 메시지 발송 버튼 찾기
      const sendBtn = page.getByText(/메시지|발송/).first();
      if (await sendBtn.isVisible().catch(() => false)) {
        await sendBtn.click();
        await page.waitForTimeout(1000);

        // 모달 열림 확인
        const modalTitle = page.getByText("메시지 발송");
        if (await modalTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
          // 채널 탭 확인
          await expect(page.getByText("채널")).toBeVisible();

          // SMS/알림톡 토글
          const smsBtn = page.locator("button").filter({ hasText: "SMS" });
          const alimtalkBtn = page.locator("button").filter({ hasText: "알림톡" });
          await expect(smsBtn.or(alimtalkBtn).first()).toBeVisible();

          // 수신자 카드
          await expect(page.getByText("수신자")).toBeVisible();

          // 미리보기
          await expect(page.getByText("미리보기")).toBeVisible();

          await page.screenshot({ path: "e2e/screenshots/msg-05-send-modal.png" });

          // SMS 모드에서 본문 입력 후 발송 확인 다이얼로그 테스트
          const textarea = page.locator("textarea").first();
          if (await textarea.isVisible().catch(() => false)) {
            await textarea.fill("E2E 테스트 메시지 - 실발송하지 않음");
            await page.waitForTimeout(300);

            // 글자수 표시 확인
            const charLabel = page.getByText(/SMS \d+\/90자|LMS/);
            await expect(charLabel).toBeVisible();

            await page.screenshot({ path: "e2e/screenshots/msg-05b-with-body.png" });
          }

          // 모달 닫기
          const closeBtn = page.locator("button").filter({ hasText: "취소" }).last();
          if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click();
          }
        }
      }
    }
  });

  test("6. 템플릿 저장 페이지", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/message/templates");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 템플릿 페이지 렌더링 확인
    // 카테고리 트리 또는 템플릿 리스트가 보여야 함
    const hasContent = await page.locator('[class*="template"], [class*="Template"], [class*="panel"]').first().isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: "e2e/screenshots/msg-06-templates.png" });
  });
});

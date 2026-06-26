/**
 * 매치업 submit = 게시 통합 + 포탈 widget — 박철T 시각 검수 (2026-05-12).
 *
 * 배포 후 production 시각 캡처 + UI/UX 리뷰용. read-only.
 * 메모리 정책 (feedback_no_e2e_on_real_tenants): 박철T는 write 금지, read-only 시각 검수만.
 *
 * 캡처 매트릭스:
 *  1. /admin/hit-reports 진입 — 포탈 widget 상단 띠 (가로 카드 / 헤더 / 새로고침 / 전체 보기)
 *  2. 카드 hover (선택사항)
 *  3. draft 보고서 편집기 진입 — 우상단 "🌐 홈페이지에 게시" primary 버튼 + 기타 CTA 시각 위계
 *  4. submitted 보고서 진입 — "🌐 게시 중" badge + "게시 취소 · 편집" 버튼
 *  5. /landing/reports/<id> — 학원 홈페이지 detail (PDF iframe + 양방향 CTA)
 *
 * viewport: 1280 / 1366 / 1920 (메모리 feedback_ui_fix_narrow_viewport_capture).
 */
import { expect, test } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

const TCHUL = "https://tchul.com";
const SCREENSHOT_DIR = "e2e/_artifacts/matchup-portal-visual-2026-05-12";
const VIEWPORTS = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1366", width: 1366, height: 800 },
  { name: "1280", width: 1280, height: 720 },
];

for (const vp of VIEWPORTS) {
  test.describe(`매치업 포탈 widget 시각 검수 @ ${vp.name} (박철T read-only)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await loginViaUI(page, "tchul-admin");
    });

    test(`적중보고서 탭 — 포탈 widget + 카드 list`, async ({ page }) => {
      await page.goto(`${TCHUL}/admin/hit-reports`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      // eslint-disable-next-line no-restricted-syntax
      await page.waitForTimeout(2500);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${vp.name}-01-hit-reports-page-full.png`,
        fullPage: true,
      });

      // widget 영역만 클로즈업
      const widget = page.locator("text=우리 학원 매치업 게시판").first();
      if (await widget.isVisible()) {
        const widgetBox = await widget.locator("..").locator("..").locator("..").boundingBox();
        if (widgetBox) {
          await page.screenshot({
            path: `${SCREENSHOT_DIR}/${vp.name}-02-portal-widget-closeup.png`,
            clip: {
              x: Math.max(0, widgetBox.x - 8),
              y: Math.max(0, widgetBox.y - 8),
              width: Math.min(vp.width, widgetBox.width + 16),
              height: Math.min(vp.height, widgetBox.height + 16),
            },
          });
        }
      }

      // 카드 클릭 — landing 새 탭 (시각만 확인 후 close)
      const firstCard = page.locator('a[href*="/landing/reports/"]').first();
      const hasCards = await firstCard.isVisible().catch(() => false);
      if (hasCards) {
        await firstCard.hover();
        // eslint-disable-next-line no-restricted-syntax
        await page.waitForTimeout(400);
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${vp.name}-03-card-hover.png`,
          fullPage: false,
        });
      }
    });

    test(`편집기 진입 — submit/unsubmit CTA 시각 위계`, async ({ page }) => {
      await page.goto(`${TCHUL}/admin/hit-reports`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      // eslint-disable-next-line no-restricted-syntax
      await page.waitForTimeout(3000);

      // 1. draft 카드 우선 (작성 중 상태의 편집기 = "🌐 홈페이지에 게시" CTA 노출)
      const draftCard = page.locator('[data-testid="hit-report-card"][data-report-status="draft"]').first();
      const submittedCard = page.locator('[data-testid="hit-report-card"][data-report-status="submitted"]').first();

      const targetCard = (await draftCard.isVisible().catch(() => false)) ? draftCard : submittedCard;
      const targetVisible = await targetCard.isVisible().catch(() => false);

      if (!targetVisible) {
        // 카드 0건 — empty state 캡처
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${vp.name}-04-editor-empty-state.png`,
          fullPage: true,
        });
        return;
      }

      const cardStatus = await targetCard.getAttribute("data-report-status");
      const reportId = await targetCard.getAttribute("data-report-id");
      console.log(`[editor-entry] viewport=${vp.name} target reportId=${reportId} status=${cardStatus}`);

      // 카드 click → read-only PDF preview modal. "수정 →" 클릭 시 편집기 진입.
      await targetCard.scrollIntoViewIfNeeded();
      await targetCard.click();
      const previewDialog = page.getByRole("dialog", { name: "적중보고서 미리보기" });
      await expect(previewDialog).toBeVisible({ timeout: 20_000 });

      const editButton = page.locator('[data-testid="hit-report-preview-edit"]').first();
      await expect(editButton).toBeVisible({ timeout: 10_000 });
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${vp.name}-04-preview-modal.png`,
        fullPage: true,
      });
      await editButton.click();

      // 매치업 페이지 도달 + 편집기 마운트 신호 — submit/unsubmit primary CTA 존재 검증
      await page.waitForURL(/\/admin\/storage\/matchup/, { timeout: 30_000 });
      const primaryCta = page.locator(
        '[data-testid="matchup-hit-report-publish-btn"], [data-testid="matchup-hit-report-unsubmit-btn"]',
      ).first();
      await expect(primaryCta, "hit report publish/unsubmit CTA").toBeVisible({ timeout: 60_000 });

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${vp.name}-04-editor-with-publish-cta.png`,
        fullPage: true,
      });

      const ctaText = await primaryCta.textContent();
      console.log(`[editor-entry] ${vp.name} CTA found: "${ctaText?.trim()}"`);
      const ctaBox = await primaryCta.boundingBox();
      if (ctaBox) {
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${vp.name}-05-cta-buttons-closeup.png`,
          clip: {
            x: 0,
            y: Math.max(0, ctaBox.y - 16),
            width: vp.width,
            height: Math.min(vp.height, 100),
          },
        });
      }
    });

    test(`학원 홈페이지 detail — 게시된 보고서 노출`, async ({ page }) => {
      // 학원 홈페이지 진입 (게시된 첫 보고서 cardp click 우회 — 직접 /landing 진입)
      await page.goto(`${TCHUL}/landing`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      // eslint-disable-next-line no-restricted-syntax
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${vp.name}-06-landing-page.png`,
        fullPage: true,
      });

      // 적중 보고서 section 카드 1건 click → detail
      const reportCard = page.locator('a[href*="/landing/reports/"]').first();
      if (await reportCard.isVisible().catch(() => false)) {
        await reportCard.click().catch(() => {});
        // eslint-disable-next-line no-restricted-syntax
        await page.waitForTimeout(3000);
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${vp.name}-07-landing-report-detail.png`,
          fullPage: true,
        });
      }
    });
  });
}

// 매치업 deploy 정합 sanity (1회만)
test.describe("매치업 deploy 정합 sanity", () => {
  test("board-preview endpoint 라이브 응답", async ({ request }) => {
    // 인증 없는 호출 — 401 또는 403 응답 = endpoint 살아있음 신호.
    const resp = await request.get(
      "https://api.hakwonplus.com/api/v1/matchup/hit-reports/board-preview/?limit=5",
      { failOnStatusCode: false },
    );
    expect([401, 403, 400]).toContain(resp.status());
  });
});

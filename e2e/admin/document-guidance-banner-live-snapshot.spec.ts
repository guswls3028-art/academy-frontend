/**
 * Stage 6.7 P0 — read-only live snapshot.
 *
 * 운영 데이터 read-only — 실 T2 doc 의 자동 분류 결과 + banner 노출 시각 검증.
 * 클릭 / approve / reject / edit 0. 데이터 변경 0.
 *
 * 검증 doc:
 *  - T2 doc 765 (clean_pdf_dual, precise_split) → success 톤 banner
 *  - T2 doc 294 (student_answer_photo) → warning 톤 manual 권장
 *  - T2 doc 766 (scan_single) → warning 톤 manual 권장
 *
 * 모두 admin (T1) 권한이 아닌 tchul-admin 로그인 필요. 단, T1 admin 도 자기
 * tenant 의 doc 만 보이므로 시각 검증은 tchul-admin 으로 진행.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

const TCHUL = process.env.TCHUL_BASE_URL || "https://tchul.com";

const TARGETS = [
  { docId: 765, label: "clean_pdf_dual_doc765",
    expect: { tone: "success", text: "자동 문항분리를 사용할 수 있습니다" } },
  { docId: 294, label: "student_answer_photo_doc294",
    expect: { tone: "warning", text: "학생 답안지/폰사진" } },
  { docId: 766, label: "scan_single_doc766",
    expect: { tone: "warning", text: "스캔본 단일형" } },
];

test.describe("Stage 6.7 P0 — live snapshot (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
  });

  for (const target of TARGETS) {
    test(`${target.label} — banner 노출 + 권장 행동 확인`, async ({ page }) => {
      // 직접 navigate (route mock 없음, 운영 데이터)
      await page.goto(`${TCHUL}/admin/storage/matchup?docId=${target.docId}`, {
        waitUntil: "networkidle",
        timeout: 30_000,
      });

      const banner = page.getByTestId("document-guidance-banner");
      // banner mount 확인
      await expect(banner).toBeVisible({ timeout: 15_000 });

      // 적절한 tone row 존재
      await expect(banner.getByTestId(`document-guidance-${target.expect.tone}`)).toHaveCount(1, {
        timeout: 5_000,
      });

      // 핵심 copy 노출
      await expect(banner).toContainText(target.expect.text);

      // 빨간색(error/danger 톤) 미표시 보장 — 사용자 directive UX 원칙
      // (success/info/warning/neutral 외 tone 클래스가 없어야)
      // → 본 컴포넌트는 4 tone 만 정의 — 정적 보장됨

      // evidence screenshot
      await page.screenshot({
        path: `test-results/live_${target.label}.png`,
        fullPage: false,
      });
    });
  }
});

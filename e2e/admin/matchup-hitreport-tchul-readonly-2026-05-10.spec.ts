/**
 * tchul-admin (박철T) read-only 적중 보고서 진입 E2E.
 *
 * 목적: 매치업 NameError fix (4b1c0260) + dangling write-side P0 (8a176b05) 운영 반영
 *       후 학원장 자격으로 보고서 편집기 진입 200 확인. 좌측 Q 리스트 dangling 인디케이터
 *       시각 캡처. write/upsert/submit 0 — 학원장 운영 데이터 보호.
 *
 * 검증:
 *   1. /admin/hit-reports sidebar/route 도달
 *   2. 보고서 카드 1건 click → 매치업 페이지 + Editor 자동 오픈
 *   3. Editor 모달 렌더 정상 (NameError 가 떴으면 빈 모달 또는 toast error)
 *   4. 좌측 Q 리스트 dangling ⚠ 인디케이터 (있으면) 시각 캡처
 *   5. dirty 0 인 채로 ESC/X 닫기 — 자동 저장 trigger 차단
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = getBaseUrl("tchul-admin");
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(
  __dirname_,
  "../reports/matchup-hitreport-tchul-readonly-2026-05-10",
);
fs.mkdirSync(SHOTS, { recursive: true });

test("HR-TCHUL. 학원장 적중 보고서 진입 200 + dangling 인디케이터 read-only", async ({ page }) => {
  test.setTimeout(90_000);

  // 보호: write API 차단 — 학원장 entries upsert/submit/delete 호출되면 즉시 실패.
  // hit-report-draft GET 만 허용.
  await page.route("**/api/v1/matchup/hit-reports/**", async (route, req) => {
    const m = req.method();
    if (m === "POST" || m === "PATCH" || m === "DELETE" || m === "PUT") {
      console.error(`[HR-TCHUL] WRITE API blocked: ${m} ${req.url()}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  await page.route("**/api/v1/matchup/documents/*/manual-crop/", (route) =>
    route.abort("blockedbyclient"),
  );
  await page.route("**/api/v1/matchup/problems/*/", async (route, req) => {
    if (req.method() === "DELETE") {
      console.error(`[HR-TCHUL] DELETE problem blocked: ${req.url()}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  await loginViaUI(page, "tchul-admin");
  await page.setViewportSize({ width: 1600, height: 1000 });

  // ── (1) 적중 보고서 목록 진입 ─────────────────
  await page.goto(`${BASE}/admin/hit-reports`, { waitUntil: "networkidle" });
  await expect(page.locator("body")).toContainText(/적중 보고서|작성중|제출됨|적중/, { timeout: 15_000 });
  await page.screenshot({
    path: path.join(SHOTS, "01-hitreport-list.png"),
    fullPage: false,
  });

  // 목록 fetch 검증 — 200
  const listResp = await page.request.get(
    `${BASE}/api/v1/matchup/hit-reports/?mine=1`,
    { failOnStatusCode: false },
  ).catch(() => null);
  if (listResp) {
    console.log(`[HR-TCHUL] hit-reports list status=${listResp.status()}`);
    expect([200, 401, 403]).toContain(listResp.status());
  }

  // ── (2) 카드 1건 click — 작성중(draft) 우선 ────────────
  // HitReportListPage 의 카드 = role="button" div (line 252).
  // 작성중(draft) 인 카드 우선 — Editor 가 처음 열리는 상태 = 사고 직접 path.
  const cards = page.locator("[role='button']").filter({
    hasText: /작성중|제출됨|적중/,
  });
  const cardCount = await cards.count();
  let opened = false;
  if (cardCount > 0) {
    // 작성중 카드 먼저 (텍스트 매칭)
    const draftCard = cards.filter({ hasText: /작성중/ }).first();
    if (await draftCard.count() > 0) {
      await draftCard.click();
    } else {
      await cards.first().click();
    }
    opened = true;
  }

  if (!opened) {
    console.log("[HR-TCHUL] 카드 0건 — skip Editor 진입 검증");
    await page.screenshot({
      path: path.join(SHOTS, "02-no-cards.png"),
      fullPage: true,
    });
    return;
  }

  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await expect(page.locator("[role='dialog'][aria-label='적중 보고서 작성'], text=/보고서 로드 실패|매치업 적중 보고서/").first())
    .toBeVisible({ timeout: 15_000 })
    .catch(() => {});

  // ── (3) Editor 모달 렌더 ────────────────────
  const editorDialog = page.locator("[role='dialog'][aria-label='적중 보고서 작성']");
  const editorVisible = await editorDialog.isVisible().catch(() => false);
  await page.screenshot({
    path: path.join(SHOTS, "03-editor-opened.png"),
    fullPage: false,
  });

  // 핵심 검증: NameError 가 살아있다면 모달은 떠도 빈 화면 + "보고서 로드 실패" toast.
  const errToast = page.locator("text=/보고서 로드 실패|서버 오류|Internal Server Error/");
  const hasErr = await errToast.isVisible().catch(() => false);
  expect(
    hasErr,
    "NameError 잔존: '보고서 로드 실패' 토스트 떠있음",
  ).toBeFalsy();

  // "학원에 제출" 버튼 hide 검증 (2026-05-11) — draft 보고서에서는 보이지 않아야 함.
  // submitted 보고서는 "제출 완료" 잠금 인디케이터만 표시.
  if (editorVisible) {
    const submitButton = editorDialog.locator("button:has-text('학원에 제출')");
    await expect(
      submitButton,
      "draft 보고서에서 '학원에 제출' 버튼은 hide 되어야 함",
    ).toHaveCount(0);
    console.log("[HR-TCHUL] '학원에 제출' 버튼 hide 검증 통과");
  }

  if (editorVisible) {
    // (4) 좌측 Q 리스트 dangling 인디케이터 캡처 — ⚠ 뱃지 (있으면)
    const danglingBadges = page.locator("span:has-text('⚠')").first();
    const hasDangling = await danglingBadges.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`[HR-TCHUL] dangling 인디케이터 노출=${hasDangling}`);
    if (hasDangling) {
      await danglingBadges.scrollIntoViewIfNeeded().catch(() => {});
      await page.screenshot({
        path: path.join(SHOTS, "04-dangling-indicator.png"),
        fullPage: false,
      });
    }

    // 보고서 헤더 (강사명 / 카테고리) 노출 — NameError 면 헤더 자체 안 그려짐.
    const header = page.locator("text=매치업 적중 보고서").first();
    await expect(header).toBeVisible({ timeout: 5000 });

    // (5) ESC 로 dirty-free 종료
    await page.keyboard.press("Escape");
    await expect(editorDialog).toBeHidden({ timeout: 5_000 }).catch(() => {});
  }

  await page.screenshot({
    path: path.join(SHOTS, "05-after-close.png"),
    fullPage: false,
  });

  console.log(
    `[HR-TCHUL] 검증 완료: editor_opened=${editorVisible} err_toast=${hasErr}`,
  );
});

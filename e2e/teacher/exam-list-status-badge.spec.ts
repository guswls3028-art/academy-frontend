/**
 * E2E: 선생앱 시험/과제 목록 — 상태 뱃지 + 활성 우선 정렬 + Badge SSOT 마이그레이션
 *
 * 검증 대상:
 *  - /teacher (시험 탭) → "진행" / "마감" / "설정 중" 뱃지 노출
 *  - DOM 상 status 뱃지 + 제목 + 만점/과목 메타가 정상 카드 구조
 *  - 활성(OPEN) 항목이 마감(CLOSED) 항목보다 위에 노출
 *  - 과제 탭 전환 시 동일 status 뱃지 패턴
 *  - Old `ds-status-badge` raw span 신규 사용 0 (SSOT 회귀 방지)
 *
 * 실행:
 *   E2E_BASE_URL=http://localhost:5174 E2E_API_URL=http://localhost:8000 \
 *     pnpm exec playwright test e2e/teacher/exam-list-status-badge.spec.ts
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("선생앱 시험/과제 목록 — 상태 뱃지 + 정렬", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => {
      try { localStorage.removeItem("teacher:preferAdmin"); } catch { /* ignore */ }
    });
  });

  test("시험 탭: 상태 뱃지 노출 + 활성 우선 정렬 + DS Badge 사용", async ({ page }) => {
    await page.goto(`${BASE}/teacher/exams`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // 헤더 — 시험 / 과제 타이틀
    await expect(page.getByRole("heading", { name: /시험\s*\/\s*과제/ })).toBeVisible({ timeout: 10_000 });

    // 시험 탭 활성 (기본)
    const examTab = page.getByRole("button", { name: /^시험$/, exact: true });
    await expect(examTab).toBeVisible({ timeout: 10_000 });

    // 카드들이 렌더된 후 뱃지 라벨 확인
    // 데이터가 없을 수 있으므로 EmptyState도 허용
    const emptyState = page.getByText(/등록된 시험이 없습니다/);
    const hasCards = await page.locator(".ds-badge, [data-tone]").first().isVisible().catch(() => false);

    if (await emptyState.isVisible().catch(() => false)) {
      // 빈 상태도 정상 — 회귀 없음
      console.log("[E2E] 시험 데이터 없음 — empty state 렌더 OK");
      return;
    }

    expect(hasCards).toBeTruthy();

    // 상태 뱃지 라벨 — 최소 한 종류는 보여야 함
    const statusLabels = ["진행", "마감", "설정 중"];
    let foundLabel: string | null = null;
    for (const label of statusLabels) {
      if (await page.getByText(label, { exact: true }).first().isVisible().catch(() => false)) {
        foundLabel = label;
        break;
      }
    }
    expect(foundLabel, "상태 뱃지(진행/마감/설정 중) 중 최소 1개 노출").not.toBeNull();

    // 정렬: 첫 번째 보이는 카드가 OPEN(진행)이거나, OPEN이 없으면 DRAFT 다음 CLOSED — 즉
    //        "진행"이 화면에 있다면 "마감"보다 위에 있어야 함
    const progressBadge = page.getByText("진행", { exact: true }).first();
    const closedBadge = page.getByText("마감", { exact: true }).first();
    const hasProgress = await progressBadge.isVisible().catch(() => false);
    const hasClosed = await closedBadge.isVisible().catch(() => false);

    if (hasProgress && hasClosed) {
      const pBox = await progressBadge.boundingBox();
      const cBox = await closedBadge.boundingBox();
      expect(pBox && cBox, "두 뱃지 모두 좌표 측정 가능").toBeTruthy();
      if (pBox && cBox) {
        expect(pBox.y, "활성(진행) 뱃지가 마감 뱃지보다 위에 위치 — 액션 우선 정렬 회귀 방지").toBeLessThan(cBox.y);
      }
    }

    // SSOT 회귀 방지: 페이지에 raw `ds-status-badge` span이 사용되지 않아야 함.
    // (Badge SSOT 마이그레이션 — `<Badge>` 컴포넌트는 `.ds-badge` 클래스를 출력)
    const rawStatusBadgeCount = await page.locator("span.ds-status-badge").count();
    expect(rawStatusBadgeCount, "raw .ds-status-badge span 사용 0 (DS Badge SSOT)").toBe(0);
  });

  test("과제 탭 전환: 상태 뱃지 패턴 동일", async ({ page }) => {
    await page.goto(`${BASE}/teacher/exams`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // 과제 탭 클릭
    const homeworkTab = page.getByRole("button", { name: /^과제$/, exact: true });
    await expect(homeworkTab).toBeVisible({ timeout: 10_000 });
    await homeworkTab.click();
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    // 빈 상태 또는 카드
    const empty = page.getByText(/등록된 과제가 없습니다/);
    const hasEmpty = await empty.isVisible().catch(() => false);
    if (hasEmpty) {
      console.log("[E2E] 과제 데이터 없음 — empty state 렌더 OK");
      return;
    }

    // 상태 뱃지 1개 이상
    const statusLabels = ["진행", "마감", "설정 중"];
    let found = false;
    for (const label of statusLabels) {
      if (await page.getByText(label, { exact: true }).first().isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found, "과제 카드 상태 뱃지 노출").toBeTruthy();
  });
});

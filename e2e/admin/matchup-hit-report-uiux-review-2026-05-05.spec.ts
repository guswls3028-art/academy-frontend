/**
 * 매치업 적중 보고서 작성 화면 UI/UX 실사용 시각 검수 (2026-05-05).
 * tchul-admin readonly — 데이터 변경 0. click은 행/탭 진입만, 토글/입력/저장 호출 X.
 *
 * 검수 포인트:
 *  1. 헤더(제목/저장 인디케이터/액션 버튼) 노출
 *  2. 좌측 Q 리스트 — 진행률 / Q 개별 행 / EyeOff 토글 / "PDF 제외" 라벨
 *  3. 미리보기 2-pane — 시험지 + 자료 캡션의 파일명 표시
 *  4. 우측 후보 패널 — 파일명 1순위 / Q번호+카테고리+자료번호 보조 / "+ PDF에 추가" + "원본 다시 자르기"
 *  5. 1500 / 1366 / 1100 viewport에서 cramped 여부
 *  6. 코멘트 / 하단 요약 textarea
 */
import { test } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = getBaseUrl("tchul-admin");
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-hit-report-uiux-2026-05-05");
fs.mkdirSync(SHOTS, { recursive: true });

test("HR-UIUX. tchul 적중 보고서 작성 화면 시각 검수", async ({ page }) => {
  test.setTimeout(120_000);
  await loginViaUI(page, "tchul-admin");

  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(`${BASE}/admin/hit-reports`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // 1. 보고서 리스트 풀샷
  await page.screenshot({
    path: path.join(SHOTS, "01-list-1500.png"),
    fullPage: true,
  });

  // 2. 작성중(draft) 카드 클릭 → 보고서 편집기 자동 오픈
  const draftCard = page.locator("a, button, div").filter({ hasText: /작성중|draft/i }).first();
  // 카드 자체가 click target이 아닐 수 있으니 일반 카드 첫번째도 시도
  const reportCard = page.locator("[data-testid^='hit-report-card'], a[href*='/admin/storage/matchup']").first();
  let opened = false;
  if (await reportCard.count() > 0) {
    await reportCard.click();
    opened = true;
  } else if (await draftCard.count() > 0) {
    await draftCard.click();
    opened = true;
  }

  if (!opened) {
    console.log("[HR-UIUX] 보고서 카드 진입 못함 — 직접 매치업 페이지로");
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    // 시험지 doc 행 click → 보고서 작성 버튼
    const testRow = page.locator("[data-testid='matchup-doc-row']").first();
    if (await testRow.count() > 0) {
      await testRow.click();
      await page.waitForTimeout(1500);
      const reportBtn = page.locator("button").filter({ hasText: /적중\s*보고서|보고서\s*작성/ }).first();
      if (await reportBtn.count() > 0) {
        await reportBtn.click();
        opened = true;
      }
    }
  }

  if (!opened) {
    console.log("[HR-UIUX] 편집기 진입 실패 — 종료");
    await page.screenshot({ path: path.join(SHOTS, "00-failed-entry.png"), fullPage: true });
    return;
  }

  // 편집기 로딩 대기 (시험지 문항별 후보 검색 10~30초)
  await page.waitForSelector("[role='dialog'][aria-label*='보고서']", { timeout: 60_000 });
  // 후보 검색 완료 = "검색하고 있습니다" 텍스트 사라짐 (또는 후보 카드 등장)
  try {
    await page.waitForSelector("text=시험지 문항별 학원 자료를 검색", {
      state: "detached", timeout: 60_000,
    });
  } catch {
    console.log("[HR-UIUX] 검색 spinner 안 사라짐 — 그래도 진행");
  }
  await page.waitForTimeout(2500);

  // 3. 1500px 편집기 풀샷
  await page.screenshot({
    path: path.join(SHOTS, "02-editor-1500-full.png"),
    fullPage: false,
  });

  // 4. 헤더 영역 (제목 + 저장 인디케이터 + 액션 버튼들)
  await page.screenshot({
    path: path.join(SHOTS, "03-editor-header.png"),
    clip: { x: 0, y: 0, width: 1500, height: 80 },
  });

  // 5. 좌측 Q 리스트 (진행률 + 개별 행 + 토글)
  await page.screenshot({
    path: path.join(SHOTS, "04-q-sidebar.png"),
    clip: { x: 0, y: 80, width: 200, height: 700 },
  });

  // 6. 우측 후보 패널 (파일명 1순위 + Q+카테고리+자료번호 + PDF에 추가 + 원본 다시 자르기)
  await page.screenshot({
    path: path.join(SHOTS, "05-candidates-panel.png"),
    clip: { x: 1140, y: 80, width: 360, height: 800 },
  });

  // 7. 가운데 미리보기 2-pane (시험지 + 자료)
  await page.screenshot({
    path: path.join(SHOTS, "06-preview-2pane.png"),
    clip: { x: 200, y: 80, width: 940, height: 700 },
  });

  // 8. 1366px viewport — 좁은 화면에서 cramped 여부
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(SHOTS, "07-editor-1366-full.png"),
    fullPage: false,
  });

  // 9. 1100px viewport — narrow viewport 결함 (memory feedback 'UI fix narrow viewport')
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(SHOTS, "08-editor-1100-full.png"),
    fullPage: false,
  });

  // 10. 1500으로 복귀, 후보 카드 1개 hover로 디테일/툴팁 확인
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.waitForTimeout(500);
  const candCard = page.locator("[role='button'][aria-pressed]").nth(1); // 첫 후보
  if (await candCard.count() > 0) {
    const box = await candCard.boundingBox();
    if (box) {
      await candCard.hover();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SHOTS, "09-candidate-row-hover.png"),
        clip: {
          x: Math.max(0, box.x - 10),
          y: Math.max(0, box.y - 10),
          width: 400,
          height: Math.min(220, box.height + 40),
        },
      });
    }
  }

  // 11. 좌측 Q 행에 EyeOff 토글이 hover/visible 위치에 있는지 (행만 캡처)
  const qRow = page.locator("[role='button'][aria-pressed]").first();
  if (await qRow.count() > 0) {
    const box = await qRow.boundingBox();
    if (box) {
      await qRow.hover();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(SHOTS, "10-q-row-hover-toggle.png"),
        clip: {
          x: 0,
          y: Math.max(0, box.y - 5),
          width: 200,
          height: Math.min(60, box.height + 20),
        },
      });
    }
  }

  // 12. 다음 Q 클릭 (read-only — 단지 active 변경, mutation 없음)
  const allQ = await page.locator("[role='button'][aria-pressed]").all();
  if (allQ.length >= 5) {
    await allQ[4].click();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(SHOTS, "11-q5-active-state.png"),
      fullPage: false,
    });
  }

  console.log(`[HR-UIUX] 캡처 완료 → ${SHOTS}`);
});

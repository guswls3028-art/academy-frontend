// E2E: 클리닉 대상자 도구 — 페이지 로드 + 데이터 파싱 + 직접 편집 + PDF 다운로드
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const SAMPLE_DATA = `강의
학생
4
이름
출석
신념 모의고사
숨김
공개
교재
숨김
공개
복습과제
숨김
공개
국태민
현장
35점
진행중
90%
완료
0%
진행중
김규민
현장
90점
완료
100%
완료
100%
완료
김동욱
현장
45점
진행중
0%
진행중
100%
완료
서연우
현장
45점
진행중
80%
완료
0%
진행중
소원호
현장
55점
진행중
0%
진행중
0%
진행중
나영린
현장
80점
완료
100%
완료
0%
진행중
최태준
현장
-
-
0%
진행중
0%
진행중`;

test.describe("클리닉 대상자 도구", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    // 도구 → 클리닉 대상자 탭으로 이동
    await page.locator('a[href*="/admin/tools"]').first().click();
    await page.waitForURL(/\/admin\/tools/, { timeout: 10000 });
    const clinicTab = page.locator("a, button").filter({ hasText: "클리닉 대상자" }).first();
    await clinicTab.click();
    await page.waitForURL(/\/admin\/tools\/clinic/, { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test("페이지 로드 및 UI 구조 확인", async ({ page }) => {
    // 미리보기 영역 확인
    await expect(page.locator("#cprev")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#cprev h1")).toHaveText("클리닉 대상자 안내");

    // 3개 컬럼 헤더 확인
    await expect(page.locator("#cprev .section-hdr.both")).toContainText("시험+과제 미통과");
    await expect(page.locator("#cprev .section-hdr.exam")).toContainText("시험 미통과");
    await expect(page.locator("#cprev .section-hdr.hw")).toContainText("과제 미통과");

    // 데이터 붙여넣기 패널 확인
    await expect(page.locator("#clinic-paste-ta")).toBeVisible();

    // 스케줄 박스 확인
    await expect(page.locator("#cprev .schedule-title")).toHaveText("클리닉 일정");

    await page.screenshot({ path: "e2e/screenshots/clinic-tool-loaded.png" });
  });

  test("데이터 붙여넣기 → 파싱 → 미리보기 채워짐", async ({ page }) => {
    // 텍스트 입력
    const textarea = page.locator("#clinic-paste-ta");
    await textarea.fill(SAMPLE_DATA);

    // 생성 버튼 클릭
    await page.locator("button").filter({ hasText: "생성" }).first().click();
    await page.waitForTimeout(500);

    // 시험+과제 미통과 컬럼: 국태민(e진행+hw진행), 서연우(e진행+hw진행), 소원호(e진행+hw진행)
    // 김동욱: exam 진행중 + hw1 진행중 → both
    const bothCol = page.locator("#cprev .col").first();
    const bothInputs = bothCol.locator("input.name-input");
    const firstValue = await bothInputs.first().inputValue();
    expect(firstValue.length).toBeGreaterThan(0);

    // 과제 미통과: 나영린(hw 진행중), 최태준(hw 진행중)
    const hwCol = page.locator("#cprev .col").nth(2);
    const hwFirstValue = await hwCol.locator("input.name-input").first().inputValue();
    expect(hwFirstValue.length).toBeGreaterThan(0);

    await page.screenshot({ path: "e2e/screenshots/clinic-tool-parsed.png" });
  });

  test("미리보기에서 직접 이름 입력 + Enter로 행 추가", async ({ page }) => {
    const firstInput = page.locator("#cprev .col").first().locator("input.name-input").first();
    await firstInput.fill("테스트학생");
    await expect(firstInput).toHaveValue("테스트학생");

    // Enter → 새 행 추가
    await firstInput.press("Enter");
    await page.waitForTimeout(300);

    const inputs = page.locator("#cprev .col").first().locator("input.name-input");
    expect(await inputs.count()).toBeGreaterThanOrEqual(2);

    // 헤더 카운트 업데이트 확인
    await expect(page.locator("#cprev .col").first().locator(".section-hdr")).toContainText("1명");

    await page.screenshot({ path: "e2e/screenshots/clinic-tool-direct-edit.png" });
  });

  test("PDF 다운로드 동작", async ({ page }) => {
    // 이름 입력
    const firstInput = page.locator("#cprev .col").first().locator("input.name-input").first();
    await firstInput.fill("테스트학생");
    await page.waitForTimeout(300);

    // PDF 다운로드
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.locator("button").filter({ hasText: "PDF 다운로드" }).first().click(),
    ]);

    expect(download.suggestedFilename()).toContain("클리닉대상자");
    await page.screenshot({ path: "e2e/screenshots/clinic-tool-pdf-downloaded.png" });
  });
});

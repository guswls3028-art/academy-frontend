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
    await page.goto("https://hakwonplus.com/admin/tools", { waitUntil: "load" });
    await page.waitForTimeout(2000);
    // 클리닉 대상자 탭 클릭
    await page.locator("a, button").filter({ hasText: "클리닉 대상자" }).first().click();
    await page.waitForURL(/\/admin\/tools\/clinic/, { timeout: 10000 });
    await expect(page.locator("#cprev")).toBeVisible({ timeout: 8000 });
  });

  test("페이지 로드 및 UI 구조 확인", async ({ page }) => {
    // 미리보기 영역 확인
    await expect(page.locator("#cprev")).toBeVisible({ timeout: 8000 });
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
    await expect(page.locator("#clinic-paste-ta")).toBeVisible({ timeout: 8000 });

    // 텍스트 입력
    const textarea = page.locator("#clinic-paste-ta");
    await textarea.fill(SAMPLE_DATA);

    // 생성 버튼 클릭 — "생성"만 텍스트인 button (탭의 "PPT 생성" 등 제외)
    const genBtn = page.locator("button").filter({ hasText: /^생성$/ }).first();
    await genBtn.scrollIntoViewIfNeeded();
    await genBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "e2e/screenshots/clinic-tool-parsed-before-check.png" });

    // 파싱 결과 확인: DOM에서 직접 카운트 체크
    const counts = await page.evaluate(() => {
      const cprev = document.querySelector("#cprev");
      if (!cprev) return { both: -1, hw: -1 };
      const cols = cprev.querySelectorAll(".col");
      const getCount = (col: Element) => {
        const inputs = col.querySelectorAll("input.name-input");
        let filled = 0;
        inputs.forEach((inp) => { if ((inp as HTMLInputElement).value.trim()) filled++; });
        return filled;
      };
      return { both: getCount(cols[0]), hw: getCount(cols[2]) };
    });
    expect(counts.both).toBeGreaterThan(0);
    expect(counts.hw).toBeGreaterThan(0);

    await page.screenshot({ path: "e2e/screenshots/clinic-tool-parsed.png" });
  });

  test("미리보기에서 직접 이름 입력 + Enter로 행 추가", async ({ page }) => {
    await expect(page.locator("#cprev")).toBeVisible({ timeout: 8000 });

    const firstInput = page.locator("#cprev .col").first().locator("input.name-input").first();
    await firstInput.fill("테스트학생");
    await expect(firstInput).toHaveValue("테스트학생");

    // Enter → 새 행 추가
    await firstInput.press("Enter");
    await page.waitForTimeout(500);

    const inputs = page.locator("#cprev .col").first().locator("input.name-input");
    expect(await inputs.count()).toBeGreaterThanOrEqual(2);

    // 헤더 카운트 업데이트 확인
    await expect(page.locator("#cprev .col").first().locator(".section-hdr")).toContainText("1명");

    await page.screenshot({ path: "e2e/screenshots/clinic-tool-direct-edit.png" });
  });

  test("PDF 다운로드 동작", async ({ page }) => {
    await expect(page.locator("#cprev")).toBeVisible({ timeout: 8000 });

    // 이름 입력
    const firstInput = page.locator("#cprev .col").first().locator("input.name-input").first();
    await firstInput.fill("테스트학생");
    await page.waitForTimeout(500);

    // PDF 다운로드
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30000 }),
      page.locator("button").filter({ hasText: "PDF 다운로드" }).first().click(),
    ]);

    expect(download.suggestedFilename()).toContain("클리닉대상자");
    await page.screenshot({ path: "e2e/screenshots/clinic-tool-pdf-downloaded.png" });
  });
});

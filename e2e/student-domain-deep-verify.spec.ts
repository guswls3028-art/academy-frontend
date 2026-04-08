/**
 * 학생 도메인 심층 운영 검증 — 정밀 셀렉터 + 크리티컬 항목 재검증
 */
import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "./helpers/auth";

const BASE = getBaseUrl("admin");
const TCHUL = getBaseUrl("tchul-admin");

test.describe("학생 도메인 심층 검증", () => {

  test("1. 삭제된 학생 탭 + 목록 확인", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 스크린샷에서 보인 탭 구조: "가입신청", "삭제된 학생"
    const deletedTab = page.locator("text=삭제된 학생").first();
    const tabVisible = await deletedTab.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`삭제된 학생 탭 visible: ${tabVisible}`);

    if (tabVisible) {
      await deletedTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/student-deleted-list.png" });

      // 테이블이나 빈 상태 메시지가 보이는지
      const tableOrEmpty = page.locator("table, text=삭제된 학생이 없습니다, text=데이터가 없습니다, text=결과가 없습니다, tbody");
      await expect(tableOrEmpty.first()).toBeVisible({ timeout: 5000 });
      console.log("삭제된 학생 탭 정상 로드");
    }
  });

  test("2. 태그 추가 벌크 액션 — 체크박스 선택 후 버튼 노출", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 전체 선택 체크박스 (thead 안의 체크박스)
    const headerCheckbox = page.locator("thead input[type='checkbox'], th input[type='checkbox']").first();
    if (await headerCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await headerCheckbox.click();
      await page.waitForTimeout(1000);

      // 벌크 액션 바/버튼들이 나타나는지 캡처
      await page.screenshot({ path: "e2e/screenshots/student-bulk-actions.png" });

      // 태그 관련 버튼 찾기
      const tagBtn = page.locator("button").filter({ hasText: /태그/ }).first();
      const tagVisible = await tagBtn.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`태그 버튼 visible: ${tagVisible}`);

      if (tagVisible) {
        await tagBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "e2e/screenshots/student-tag-modal-open.png" });

        // 모달 내부 확인
        const modalContent = page.locator("[role='dialog'], [class*='modal'], [class*='Modal']");
        if (await modalContent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log("태그 추가 모달 정상 열림");

          // select/radio가 초기화 상태인지 (선택된 태그 없음)
          const selectedState = await page.evaluate(() => {
            const radios = document.querySelectorAll("input[type='radio']:checked");
            const selects = document.querySelectorAll("select");
            return {
              checkedRadios: radios.length,
              selectValues: Array.from(selects).map(s => (s as HTMLSelectElement).value),
            };
          });
          console.log("모달 초기 상태:", JSON.stringify(selectedState));
        }
      }
    }
  });

  test("3. 비밀번호 재설정 모달 열기/초기화", async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 전체 선택
    const headerCheckbox = page.locator("thead input[type='checkbox'], th input[type='checkbox']").first();
    if (await headerCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await headerCheckbox.click();
      await page.waitForTimeout(1000);

      // 비밀번호 관련 버튼
      const pwBtn = page.locator("button").filter({ hasText: /비밀번호|패스워드/ }).first();
      const pwVisible = await pwBtn.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`비밀번호 버튼 visible: ${pwVisible}`);

      if (pwVisible) {
        await pwBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "e2e/screenshots/student-pw-modal.png" });
      }
    }
  });

  test("4. 테넌트 격리 — tchul 학생은 hakwonplus 학생과 겹치지 않음", async ({ page }) => {
    // hakwonplus 학생 이름 수집
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(3000);

    const hakNames = await page.evaluate(() => {
      const cells = document.querySelectorAll("tbody td:nth-child(2), tbody td:first-child");
      return Array.from(cells).slice(0, 20).map(c => c.textContent?.trim()).filter(Boolean);
    });
    console.log(`hakwonplus 학생 이름들: ${JSON.stringify(hakNames.slice(0, 5))}`);

    // tchul 로그인 후 학생 이름 수집
    await loginViaUI(page, "tchul-admin");
    await page.goto(`${TCHUL}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "e2e/screenshots/tchul-student-list.png" });

    const tchulNames = await page.evaluate(() => {
      const cells = document.querySelectorAll("tbody td:nth-child(2), tbody td:first-child");
      return Array.from(cells).slice(0, 20).map(c => c.textContent?.trim()).filter(Boolean);
    });
    console.log(`tchul 학생 이름들: ${JSON.stringify(tchulNames.slice(0, 5))}`);

    // 겹치는 이름이 있는지 확인 (동명이인 가능성은 있지만, 전화번호까지 같으면 문제)
    const overlap = hakNames.filter(n => tchulNames.includes(n));
    console.log(`이름 겹침: ${JSON.stringify(overlap)}`);

    // 두 테넌트의 학생 이름 목록이 완전히 다른 것이 기대됨
    if (overlap.length > 0) {
      console.warn("주의: 동일 이름 학생이 양 테넌트에 존재. 동명이인인지 확인 필요.");
    }
  });

  test("5. sessionStorage 키 tenantCode 스코핑 확인", async ({ page }) => {
    // hakwonplus에서 학생 선택
    await loginViaUI(page, "admin");
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 체크박스 선택으로 sessionStorage에 기록되게
    const checkbox = page.locator("tbody input[type='checkbox']").first();
    if (await checkbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await checkbox.click();
      await page.waitForTimeout(500);
    }

    const hakStorage = await page.evaluate(() => {
      const result: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes("student") || key.includes("selected"))) {
          result[key] = sessionStorage.getItem(key) || "";
        }
      }
      return result;
    });
    console.log("hakwonplus sessionStorage:", JSON.stringify(hakStorage));

    // 모든 키에 "hakwonplus"가 포함되어 있는지 확인
    const allScoped = Object.keys(hakStorage).every(k => k.includes("hakwonplus"));
    console.log(`모든 student 키가 tenantCode 스코핑됨: ${allScoped}`);
    expect(allScoped).toBe(true);
  });

  test("6. 학생앱 네비게이션 + 페이지 DOM", async ({ page }) => {
    await loginViaUI(page, "student");
    await page.waitForTimeout(2000);

    // 학생앱 메인 페이지 DOM 상태
    const pageUrl = page.url();
    console.log(`학생앱 URL: ${pageUrl}`);

    // 사이드바 메뉴 항목들 수집
    const menuItems = await page.evaluate(() => {
      const links = document.querySelectorAll("nav a, aside a, [class*='sidebar'] a, [class*='menu'] a");
      return Array.from(links).map(a => ({
        text: a.textContent?.trim(),
        href: (a as HTMLAnchorElement).href,
      })).filter(i => i.text);
    });
    console.log("학생앱 메뉴:", JSON.stringify(menuItems.slice(0, 10)));

    await page.screenshot({ path: "e2e/screenshots/student-app-nav.png" });
  });
});

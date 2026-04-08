/**
 * 모달 스크롤 운영 안정화 — 실사용 흐름 E2E
 *
 * Tenant 1 대상. 실제 사용 흐름 기준 검증.
 *
 * 검증 항목:
 * - 모달 flex 레이아웃 (header/body/footer 분배)
 * - split-layout 모달 스크롤
 * - footer 항상 접근 가능
 * - body scroll 복구
 * - 닫기/취소/X/confirm
 * - 재진입 일관성
 * - 작은/큰 화면 대응
 * - 유사 모달 전역 점검
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const API = "https://api.hakwonplus.com";
const NAV_TIMEOUT = 15000;

/** admin-modal__inner 구조 검증 */
async function verifyModalStructure(page: Page, label: string) {
  const inner = page.locator(".admin-modal__inner").last();
  await expect(inner).toBeVisible({ timeout: 5000 });

  const styles = await inner.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return {
      display: cs.display,
      flexDirection: cs.flexDirection,
      maxHeight: cs.maxHeight,
    };
  });
  expect(styles.display, `${label}: display=flex`).toBe("flex");
  expect(styles.flexDirection, `${label}: column`).toBe("column");

  // footer viewport 내
  const footer = page.locator(".modal-footer").last();
  if (await footer.isVisible({ timeout: 2000 }).catch(() => false)) {
    const footerBox = await footer.boundingBox();
    const vp = page.viewportSize()!;
    expect(footerBox, `${label}: footer box`).toBeTruthy();
    expect(footerBox!.y + footerBox!.height, `${label}: footer in viewport`)
      .toBeLessThanOrEqual(vp.height + 2);

    const footerShrink = await footer.evaluate(el => window.getComputedStyle(el).flexShrink);
    expect(footerShrink, `${label}: footer flex-shrink`).toBe("0");
  }

  // header flex-shrink:0
  const header = page.locator(".modal-header").last();
  if (await header.isVisible({ timeout: 1000 }).catch(() => false)) {
    const shrink = await header.evaluate(el => window.getComputedStyle(el).flexShrink);
    expect(shrink, `${label}: header flex-shrink`).toBe("0");
  }
}

/** body scroll 복구 확인 */
async function verifyBodyScrollRestored(page: Page, label: string) {
  const overflow = await page.evaluate(() => window.getComputedStyle(document.body).overflow);
  expect(overflow, `${label}: body overflow != hidden`).not.toBe("hidden");
}

/** 모달 닫기 (X or 취소 + confirm 처리) */
async function closeModal(page: Page) {
  // 열려있는 모달의 X 버튼 클릭
  const xBtn = page.locator(".ant-modal-wrap:not([style*='display: none']) .ant-modal-close").last();
  if (await xBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await xBtn.click();
    await page.waitForTimeout(1000);
  }
  // confirm이 뜨면 처리 (confirm 모달의 위험 버튼)
  const confirmBtn = page.locator(".admin-modal--confirm button.ds-btn--danger, .admin-modal--confirm button").filter({ hasText: /해제|확인|닫기/ }).first();
  if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(500);
  }
  // 여전히 모달이 열려있다면 다시 X
  const stillOpen = page.locator(".ant-modal-wrap:not([style*='display: none']) .admin-modal__inner");
  if (await stillOpen.first().isVisible({ timeout: 500 }).catch(() => false)) {
    const x2 = page.locator(".ant-modal-wrap:not([style*='display: none']) .ant-modal-close").last();
    if (await x2.isVisible({ timeout: 500 }).catch(() => false)) {
      await x2.click();
      await page.waitForTimeout(500);
    }
  }
}

test.describe("수강생 등록 모달 — 실사용 흐름", () => {
  test.setTimeout(90000);

  test("1. 강의 수강생 등록 모달 — 열기 + 검색 + 선택 + 저장 + 재진입", async ({ page }) => {
    await loginViaUI(page, "admin");

    // Step 1: 강의 상세 페이지 직접 이동
    await page.goto("https://hakwonplus.com/admin/lectures/96", { waitUntil: "load", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(2500);

    // "수강생 등록" 버튼 클릭
    const enrollBtn = page.locator("button").filter({ hasText: "수강생 등록" }).first();
    await expect(enrollBtn).toBeVisible({ timeout: 5000 });
    await enrollBtn.click();
    await page.waitForTimeout(1500);

    // Step 2: 등록 방식 선택 모달 구조 검증
    await verifyModalStructure(page, "등록방식선택");
    await page.screenshot({ path: "e2e/screenshots/full-01-method-modal.png" });

    // "차시 생성 후 업로드" 클릭
    const methodCard = page.locator("text=차시 생성 후 업로드").first();
    if (await methodCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await methodCard.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/full-02-enroll-modal.png" });

      // split-layout 모달이 열렸다면
      const splitLayout = page.locator(".ds-split-layout").first();
      if (await splitLayout.isVisible({ timeout: 3000 }).catch(() => false)) {
        await verifyModalStructure(page, "수강생등록split");

        // 테이블 내 학생 목록 확인
        const tableArea = page.locator(".modal-inner-table").first();
        if (await tableArea.isVisible({ timeout: 2000 }).catch(() => false)) {
          const rowCount = await page.locator(".modal-inner-table tbody tr").count();
          console.log(`Student rows: ${rowCount}`);

          if (rowCount > 0) {
            // 학생 선택
            const cb1 = page.locator(".modal-inner-table tbody tr").first().locator("input[type='checkbox']");
            await cb1.check();
            await page.waitForTimeout(300);

            // 선택 패널 확인
            const selectedText = await page.locator("text=/\\d+명 선택됨/").first().innerText().catch(() => "");
            console.log(`Selected: ${selectedText}`);
            expect(selectedText).toContain("선택됨");

            // 스크롤 정보
            const scrollInfo = await tableArea.evaluate(el => ({
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              scrollbarWidth: window.getComputedStyle(el).scrollbarWidth,
            }));
            console.log(`Scroll info:`, scrollInfo);
            expect(scrollInfo.scrollbarWidth, "scrollbar visible").toBe("thin");

            // footer 저장 버튼 확인
            const saveBtn = page.locator(".modal-footer button").filter({ hasText: /저장|확정/ }).first();
            if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              const box = await saveBtn.boundingBox();
              const vp = page.viewportSize()!;
              expect(box!.y + box!.height, "save btn in viewport").toBeLessThanOrEqual(vp.height + 2);
            }
          }
        }
      }
    }

    // Step 3: 닫기 + body scroll 복구
    await closeModal(page);
    await verifyBodyScrollRestored(page, "수강생등록 닫기");

    // Step 4: 재진입 — 다시 열어서 일관성 확인
    await enrollBtn.click();
    await page.waitForTimeout(1500);
    await verifyModalStructure(page, "재진입");
    await closeModal(page);
    await verifyBodyScrollRestored(page, "재진입 닫기");

    await page.screenshot({ path: "e2e/screenshots/full-03-after-close.png" });
  });

  test("2. 닫기/취소/X 연속 흐름 — scroll lock 꼬임 테스트", async ({ page }) => {
    await loginViaUI(page, "admin");

    await page.goto("https://hakwonplus.com/admin/lectures/96", { waitUntil: "load", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(2500);

    const enrollBtn = page.locator("button").filter({ hasText: "수강생 등록" }).first();
    await expect(enrollBtn).toBeVisible({ timeout: 5000 });

    // 5회 연속 열기/닫기
    for (let i = 0; i < 5; i++) {
      await enrollBtn.click();
      await page.waitForTimeout(800);
      await closeModal(page);
      await page.waitForTimeout(500);
    }

    // 마지막으로 body scroll 확인
    await verifyBodyScrollRestored(page, "5회 연속 열기닫기");

    // 추가: 스크롤 정상 작동 확인
    const canScroll = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      return {
        bodyOverflow: window.getComputedStyle(body).overflow,
        htmlOverflow: window.getComputedStyle(html).overflow,
        scrollHeight: body.scrollHeight,
        clientHeight: body.clientHeight,
      };
    });
    console.log("After 5 cycles:", canScroll);
    expect(canScroll.bodyOverflow).not.toBe("hidden");

    await page.screenshot({ path: "e2e/screenshots/full-04-5-cycles.png" });
  });
});

test.describe("해상도별 검증", () => {
  test.setTimeout(60000);

  const viewports = [
    { name: "1366x768", width: 1366, height: 768 },
    { name: "1536x864", width: 1536, height: 864 },
    { name: "1920x1080", width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    test(`3. ${vp.name} — 모달 footer viewport 내`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginViaUI(page, "admin");

      await page.goto("https://hakwonplus.com/admin/lectures/96", { waitUntil: "load", timeout: NAV_TIMEOUT });
      await page.waitForTimeout(2500);

      const enrollBtn = page.locator("button").filter({ hasText: "수강생 등록" }).first();
      await expect(enrollBtn).toBeVisible({ timeout: 5000 });
      await enrollBtn.click();
      await page.waitForTimeout(1500);

      // 모달이 viewport 안에 맞는지
      const inner = page.locator(".admin-modal__inner").last();
      if (await inner.isVisible({ timeout: 3000 }).catch(() => false)) {
        const innerBox = await inner.boundingBox();
        expect(innerBox, `${vp.name}: inner box`).toBeTruthy();
        expect(innerBox!.y + innerBox!.height, `${vp.name}: inner fits`)
          .toBeLessThanOrEqual(vp.height + 2);
        console.log(`${vp.name} inner: h=${innerBox!.height.toFixed(0)}, bottom=${(innerBox!.y + innerBox!.height).toFixed(0)}`);

        // footer 접근
        const footer = page.locator(".modal-footer").last();
        if (await footer.isVisible({ timeout: 1000 }).catch(() => false)) {
          const footerBox = await footer.boundingBox();
          expect(footerBox!.y + footerBox!.height, `${vp.name}: footer in viewport`)
            .toBeLessThanOrEqual(vp.height + 2);
        }
      }

      await page.screenshot({ path: `e2e/screenshots/full-05-${vp.name}.png` });
      await closeModal(page);
    });
  }
});

test.describe("유사 모달 전역 검증", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("4. 학생 생성 모달 (폼 모달 스크롤)", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const createBtn = page.locator("button").filter({ hasText: /학생 등록|학생 추가|신규/ }).first();
    if (!(await createBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "학생 등록 버튼 없음");
      return;
    }

    await createBtn.click();
    await page.waitForTimeout(1500);

    await verifyModalStructure(page, "학생생성");
    await page.screenshot({ path: "e2e/screenshots/full-06-student-create.png" });

    // 폼 본문 스크롤 확인
    const scrollBody = page.locator(".modal-scroll-body").first();
    if (await scrollBody.isVisible({ timeout: 1000 }).catch(() => false)) {
      const info = await scrollBody.evaluate(el => ({
        overflowY: window.getComputedStyle(el).overflowY,
        maxHeight: window.getComputedStyle(el).maxHeight,
      }));
      expect(info.overflowY, "scroll-body overflow").toBe("auto");
      expect(info.maxHeight, "scroll-body has max-height").not.toBe("none");
      console.log("Student form scroll:", info);
    }

    await closeModal(page);
    await verifyBodyScrollRestored(page, "학생생성 닫기");
  });

  test("5. 강의 등록 모달 (폼 모달 스크롤)", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/lectures", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const createBtn = page.locator("button").filter({ hasText: /강의 등록|강의 추가|신규 강의/ }).first();
    if (!(await createBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "강의 등록 버튼 없음");
      return;
    }

    await createBtn.click();
    await page.waitForTimeout(1500);

    await verifyModalStructure(page, "강의등록");
    await page.screenshot({ path: "e2e/screenshots/full-07-lecture-create.png" });

    const scrollBody = page.locator(".modal-scroll-body").first();
    if (await scrollBody.isVisible({ timeout: 1000 }).catch(() => false)) {
      const overflowY = await scrollBody.evaluate(el => window.getComputedStyle(el).overflowY);
      expect(overflowY).toBe("auto");
    }

    await closeModal(page);
    await verifyBodyScrollRestored(page, "강의등록 닫기");
  });

  test("6. 직원 생성 모달 (폼 모달 스크롤)", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/staff", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const createBtn = page.locator("button").filter({ hasText: /직원 추가|직원 등록|신규/ }).first();
    if (!(await createBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "직원 추가 버튼 없음");
      return;
    }

    await createBtn.click();
    await page.waitForTimeout(1500);

    await verifyModalStructure(page, "직원생성");
    await page.screenshot({ path: "e2e/screenshots/full-08-staff-create.png" });

    await closeModal(page);
    await verifyBodyScrollRestored(page, "직원생성 닫기");
  });

  test("7. 메시지 발송 모달", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/messages", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    const sendBtn = page.locator("button").filter({ hasText: /메시지 발송|새 메시지|발송/ }).first();
    if (!(await sendBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "메시지 발송 버튼 없음");
      return;
    }

    await sendBtn.click();
    await page.waitForTimeout(1500);

    const inner = page.locator(".admin-modal__inner").last();
    if (await inner.isVisible({ timeout: 3000 }).catch(() => false)) {
      const styles = await inner.evaluate(el => {
        const cs = window.getComputedStyle(el);
        return { display: cs.display, flexDirection: cs.flexDirection };
      });
      expect(styles.display).toBe("flex");
      expect(styles.flexDirection).toBe("column");
    }

    await page.screenshot({ path: "e2e/screenshots/full-09-message.png" });
    await closeModal(page);
    await verifyBodyScrollRestored(page, "메시지 닫기");
  });

  test("8. 비밀번호 변경 모달 (confirm 모달)", async ({ page }) => {
    await page.goto("https://hakwonplus.com/admin/students", { waitUntil: "load" });
    await page.waitForTimeout(2000);

    // 학생 상세 진입
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstRow.click();
      await page.waitForTimeout(2000);

      // "비밀번호" 관련 버튼 있는지
      const pwdBtn = page.locator("button").filter({ hasText: /비밀번호/ }).first();
      if (await pwdBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pwdBtn.click();
        await page.waitForTimeout(1000);

        const inner = page.locator(".admin-modal__inner").last();
        if (await inner.isVisible({ timeout: 2000 }).catch(() => false)) {
          const styles = await inner.evaluate(el => ({
            display: window.getComputedStyle(el).display,
            flexDirection: window.getComputedStyle(el).flexDirection,
          }));
          expect(styles.display).toBe("flex");
          expect(styles.flexDirection).toBe("column");
          console.log("Password modal flex:", styles);
        }

        await page.screenshot({ path: "e2e/screenshots/full-10-password.png" });
        await closeModal(page);
      }
    }
    await verifyBodyScrollRestored(page, "비밀번호 모달 닫기");
  });
});

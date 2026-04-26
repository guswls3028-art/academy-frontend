import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

const VIEWPORTS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1024x600", width: 1024, height: 600 },
  { name: "390x844", width: 390, height: 844 },
];

async function firstVisible(locator: ReturnType<Page["locator"]>) {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const el = locator.nth(i);
    if (await el.isVisible().catch(() => false)) return el;
  }
  return null;
}

async function openSendMessageModal(page: Page): Promise<{ ok: boolean; reason?: string }> {
  await gotoAndSettle(page, `${BASE}/admin/students`, { settleMs: 1000 });
  const rowCheckbox = page.locator("tbody input[type='checkbox']").first();
  const hasRow = await rowCheckbox.isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasRow) {
    const emptyText = await page.locator("body").innerText().catch(() => "");
    const reason = emptyText.includes("학생이 없습니다")
      ? "학생 목록 empty state"
      : `row checkbox not found (url=${page.url()})`;
    console.log(`[MEASURE][send] ${reason}`);
    return { ok: false, reason };
  }
  await rowCheckbox.check();

  const sendBtn = page.getByRole("button", { name: /메시지 발송/ }).first();
  await expect(sendBtn).toBeVisible({ timeout: 10000 });
  await sendBtn.click();

  const cancelBtn = page.getByRole("button", { name: /^취소$/ }).last();
  await expect(cancelBtn).toBeVisible({ timeout: 10000 });
  return { ok: true };
}

async function openLectureCreateModal(page: Page): Promise<{ ok: boolean; reason?: string }> {
  await gotoAndSettle(page, `${BASE}/admin/lectures`, { settleMs: 1200 });
  const createBtn = page.locator("button").filter({ hasText: /강의 추가|\+ 강의 추가/ }).first();
  const hasCreate = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasCreate) {
    const emptyText = await page.locator("body").innerText().catch(() => "");
    const reason = emptyText.includes("표시할 강의가 없습니다.")
      ? "lecture empty state (create button hidden in current mobile layout)"
      : `lecture create button not found (url=${page.url()})`;
    console.log(`[MEASURE][lecture] ${reason}`);
    return { ok: false, reason };
  }
  await createBtn.click();

  const modalCreateBtn = page.getByRole("button", { name: /^등록$/ }).last();
  await expect(modalCreateBtn).toBeVisible({ timeout: 10000 });
  return { ok: true };
}

async function openWorkbox(page: Page): Promise<boolean> {
  await gotoAndSettle(page, `${BASE}/admin/dashboard`, { settleMs: 800 });
  const workboxBtn = page.locator("button[title='진행 상황']").first();
  const hasWorkbox = await workboxBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasWorkbox) {
    console.log("[MEASURE][workbox] trigger button not found on this viewport");
    return false;
  }
  await workboxBtn.click();
  const panel = page.locator(".alarm-panel--workbox-style").first();
  await expect(panel).toBeVisible({ timeout: 10000 });
  return true;
}

test.describe("UIUX viewport measured checks", () => {
  test.setTimeout(240_000);

  test("모달/패널 하단 접근성 실측", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("teacher:preferAdmin", "1");
      } catch {
        // ignore
      }
    });
    await loginViaUI(page, "admin");

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // 1) 메시지 발송 모달: 발송 버튼의 뷰포트 내 존재 여부
      const sendModal = await openSendMessageModal(page);
      if (sendModal.ok) {
        const sendButton = await firstVisible(
          page.locator("button").filter({ hasText: /에게 알림톡 발송|발송하기|대상 선택 필요/ }),
        );
        expect(sendButton, `send button visible @${vp.name}`).not.toBeNull();
        if (sendButton) {
          const box = await sendButton.boundingBox();
          expect(box, `send button bbox @${vp.name}`).not.toBeNull();
          if (box) {
            const inViewport = box.y + box.height <= vp.height;
            console.log(`[MEASURE][send][${vp.name}] y=${box.y.toFixed(1)} h=${box.height.toFixed(1)} vpH=${vp.height} inViewport=${inViewport}`);
            expect(inViewport, `send button in viewport @${vp.name}`).toBeTruthy();
          }
        }
        await page.keyboard.press("Escape");
      } else {
        console.log(`[MEASURE][send][${vp.name}] skipped: ${sendModal.reason}`);
      }

      // 2) 강의 생성 모달: 등록 버튼의 뷰포트 내 존재 여부
      const lectureModal = await openLectureCreateModal(page);
      if (lectureModal.ok) {
        const lectureButton = await firstVisible(
          page.locator("button").filter({ hasText: /^등록$/ }),
        );
        expect(lectureButton, `lecture submit visible @${vp.name}`).not.toBeNull();
        if (lectureButton) {
          const box = await lectureButton.boundingBox();
          expect(box, `lecture submit bbox @${vp.name}`).not.toBeNull();
          if (box) {
            const inViewport = box.y + box.height <= vp.height;
            console.log(`[MEASURE][lecture][${vp.name}] y=${box.y.toFixed(1)} h=${box.height.toFixed(1)} vpH=${vp.height} inViewport=${inViewport}`);
            expect(inViewport, `lecture submit in viewport @${vp.name}`).toBeTruthy();
          }
        }
        await page.keyboard.press("Escape");
      } else {
        console.log(`[MEASURE][lecture][${vp.name}] skipped: ${lectureModal.reason}`);
      }

      // 3) Workbox: 패널 하단이 뷰포트 내 존재 여부
      const workboxOpened = await openWorkbox(page);
      if (workboxOpened) {
        const panel = page.locator(".alarm-panel--workbox-style").first();
        const pbox = await panel.boundingBox();
        expect(pbox, `workbox panel bbox @${vp.name}`).not.toBeNull();
        if (pbox) {
          const panelInViewport = pbox.y + pbox.height <= vp.height;
          console.log(`[MEASURE][workbox][${vp.name}] y=${pbox.y.toFixed(1)} h=${pbox.height.toFixed(1)} vpH=${vp.height} inViewport=${panelInViewport}`);
          expect(panelInViewport, `workbox panel in viewport @${vp.name}`).toBeTruthy();
        }
        await page.keyboard.press("Escape");
      } else {
        console.log(`[MEASURE][workbox][${vp.name}] skipped: 작업박스 버튼 미노출`);
      }
    }
  });
});


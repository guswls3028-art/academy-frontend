/**
 * 사이드바 스크롤 동작 검증 (프로덕션)
 *
 * 목표: 짧은 화면(노트북 + 시스템 배율 high)에서 하단 메뉴 클릭 가능?
 *  - sidebar-scroll 컨테이너 overflow 발생 시 자체 스크롤
 *  - 마지막 nav-item이 scrollIntoView 후 viewport 안에 위치
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "../helpers/auth";

// 짧은 화면 시뮬레이션: 1366 x 520 (≈ 노트북 1366x768에서 150% 배율)
test.use({ viewport: { width: 1366, height: 520 } });

test("[E2E-sidebar-scroll] 짧은 뷰포트에서 하단 메뉴까지 스크롤 도달", async ({ page }) => {
  await loginViaUI(page, "admin");

  await page.waitForSelector(".sidebar-scroll", { timeout: 15000 });
  const scroll = page.locator(".sidebar-scroll").first();
  await expect(scroll).toBeVisible();

  const m = await scroll.evaluate((el) => ({
    clientHeight: (el as HTMLElement).clientHeight,
    scrollHeight: (el as HTMLElement).scrollHeight,
    overflowY: getComputedStyle(el).overflowY,
  }));
  console.log("[sidebar metrics]", m);

  // 짧은 뷰포트에서 nav가 길면 overflow가 발생해야 함
  // (그래야 스크롤 의미가 있음 — 만약 안 발생하면 메뉴가 짧다는 뜻이라 통과 처리)
  const items = page.locator(".sidebar-scroll .nav-item");
  const count = await items.count();
  expect(count).toBeGreaterThan(3);
  expect(m.overflowY).toBe("auto");

  if (m.scrollHeight > m.clientHeight) {
    const last = items.last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();

    const scrollTop = await scroll.evaluate(
      (el) => (el as HTMLElement).scrollTop,
    );
    expect(scrollTop).toBeGreaterThan(0);
    console.log(
      `[ok] last item reached via scroll (scrollTop=${scrollTop}, items=${count})`,
    );
  } else {
    console.log(
      `[ok] no overflow at this viewport (items=${count}, scrollHeight=${m.scrollHeight}, clientHeight=${m.clientHeight})`,
    );
  }
});

// PATH: e2e/admin/workbox-smoke-2026-05-08.spec.ts
//
// asyncStatus 작업상태바/진행바 smoke (2026-05-08).
// asyncStatus prerequisite (sourceId 4-arg) + lint baseline (inline style disable
// 주석) commit 후 작업상태바 클릭/삭제/진행률 표시 시각 검증.
//
// destructive 동작(실 task 삭제) 절대 X — UI 노출 + DOM 존재만 확인.

import { test, expect } from "@playwright/test";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const ADMIN_USER = "admin97";
const ADMIN_PASS = "koreaseoul97";
const TENANT = "hakwonplus";

const ARTIFACTS = "_artifacts/sessions/workbox-smoke-2026-05-08";

test.describe("작업상태바 smoke", () => {
  test.setTimeout(120_000);

  test("작업박스 트리거 + 패널 + 진행바/액션 UI 시각 확인", async ({ page }) => {
    page.on("pageerror", (e) => console.error("[PAGEERROR]", e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const t = msg.text();
        if (t.includes("destroyOnClose")) return;
        console.error("[CONSOLE.error]", t);
      }
    });

    const resp = await page.request.post(`${API}/api/v1/token/`, {
      data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": TENANT },
      timeout: 60_000,
    });
    expect(resp.status()).toBe(200);
    const tokens = await resp.json() as { access: string; refresh: string };

    await page.addInitScript(({ access, refresh }) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);
    }, { access: tokens.access, refresh: tokens.refresh });

    // 매치업 페이지 진입 — processing doc 있으면 작업박스에 자동 등록됨
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 작업박스 트리거 버튼 — aria-label 기반 (testid 없음)
    const trigger = page.getByRole("button", { name: /작업박스/ }).first();
    const triggerCount = await trigger.count();
    console.error("[VERIFY] workbox trigger count =", triggerCount);
    expect(triggerCount).toBeGreaterThan(0);

    // 트리거 click → 패널 펼침
    await trigger.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${ARTIFACTS}/01-workbox-open.png`, fullPage: true });

    // 패널 안 task 행 (.async-status-bar__item)
    const items = page.locator(".async-status-bar__item");
    const itemCount = await items.count();
    console.error("[VERIFY] workbox items count =", itemCount);

    // 진행바 (.async-status-bar__progress-fill) — processing task 있을 때만 노출
    const progressFills = page.locator(".async-status-bar__progress-fill");
    const progressCount = await progressFills.count();
    console.error("[VERIFY] progress-fill count =", progressCount,
      "(0 가능 — processing task 없음)");

    if (itemCount > 0) {
      // 첫 행 hover → 액션 버튼 (.async-status-bar__item-actions) 노출 확인
      await items.first().hover();
      await page.waitForTimeout(300);
      const actions = page.locator(".async-status-bar__item-actions").first();
      const actionsCount = await actions.count();
      console.error("[VERIFY] item-actions count =", actionsCount);
      await items.first().screenshot({ path: `${ARTIFACTS}/02-item-row.png` });

      // 진행바가 있으면 width inline style 존재 확인 (애니메이션 정상 노출)
      if (progressCount > 0) {
        const fillStyle = await progressFills.first().getAttribute("style");
        console.error("[VERIFY] first progress style =", fillStyle);
        await progressFills.first().screenshot({ path: `${ARTIFACTS}/03-progress-fill.png` });
      } else {
        console.error("[VERIFY] no processing task — 진행바 시각 검증 skip (정상, destructive 회피)");
      }
    } else {
      console.error("[VERIFY] task 0건 — 빈 패널 시각만 캡처 (정상)");
    }

    // 닫기 — ESC 또는 외부 클릭
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${ARTIFACTS}/04-workbox-closed.png`, fullPage: true });
  });
});

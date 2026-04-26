/**
 * 박철(tchul) 직책 표기 검증 — 운영 환경
 *
 * 목적: tchul-admin (01035023313 / 727258) 계정으로 로그인해
 *  /admin/settings/profile 페이지의 직책(대표/강사/조교) 표기를 캡처.
 *
 * 1) 캡처 + 텍스트 추출
 * 2) 백엔드 /core/me/ 응답 (tenantRole, is_staff, is_superuser, name) 직접 호출
 *    → 데이터 vs 표시 라벨 정합 검증
 *
 * 출력: e2e/reports/tchul-park-role/*.png + 콘솔 로그
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

test.setTimeout(120_000);

const BASE = getBaseUrl("tchul-admin");

test("tchul park role label — production capture", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaUI(page, "tchul-admin");

  // ── /core/me/ 직접 호출 — 원본 데이터 ──
  const meResp = await page.evaluate(async () => {
    const r = await fetch("/core/me/", { credentials: "include" });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  console.log("[ME RAW]", JSON.stringify(meResp, null, 2));

  // ── 프로필 페이지 진입 ──
  await page.goto(`${BASE}/admin/settings/profile`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: `e2e/reports/tchul-park-role/profile-full.png`,
    fullPage: true,
  });

  // 화면 위 직책 라벨 추출 (StaffRoleAvatar 옆 span 등)
  const bodyText = await page.locator("body").innerText();
  const matches = bodyText.match(/(대표|강사|조교)/g);
  console.log("[ROLE LABELS ON PAGE]", JSON.stringify(matches));

  // 아바타 카드 영역 좁혀서 캡처 (이름 + 라벨 잘 보이는 부분)
  const card = page.locator('main').first();
  if (await card.count()) {
    await card.first().screenshot({
      path: `e2e/reports/tchul-park-role/profile-card.png`,
    }).catch(() => {});
  }

  // ── 헤더 우상단 프로필 드롭다운 — 이름과 직책 함께 표시 ──
  await page.goto(`${BASE}/admin/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: `e2e/reports/tchul-park-role/dashboard-with-header.png`,
    fullPage: false,
  });

  expect(meResp.status).toBe(200);
});

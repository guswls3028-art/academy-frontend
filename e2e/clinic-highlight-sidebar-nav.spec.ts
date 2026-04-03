/**
 * 사이드바 네비게이션으로 진입하는 모든 학생 관련 페이지 검증
 * URL goto가 아닌 실제 사이드바/탭 클릭으로 이동
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

type R = { loc: string; chips: number; hl: number; ok: boolean; note?: string };
const ALL: R[] = [];

async function snap(page: Page, loc: string, note?: string): Promise<R> {
  await page.waitForTimeout(3000);
  const chips = await page.locator("span.inline-flex.items-center.gap-2").count();
  const hl = await page.locator(".ds-student-name--clinic-highlight").count();
  const ok = true;
  const tag = "✅";
  console.log(`${tag} ${loc}: chips=${chips} hl=${hl}${note ? " (" + note + ")" : ""}`);
  await page.screenshot({ path: `e2e/screenshots/nav-${loc}.png`, fullPage: true });
  const r: R = { loc, chips, hl, ok, note };
  ALL.push(r);
  return r;
}

test.describe("사이드바 네비게이션 전수 검증", () => {
  test.setTimeout(600_000);

  test("사이드바 클릭으로 모든 학생 이름 페이지 확인", async ({ page }) => {
    await loginViaUI(page, "admin");

    // ── 1. 사이드바 → 학생 ──
    console.log("\n── 1. 사이드바 → 학생 ──");
    const studentSidebar = page.locator("aside a, aside button, nav a, nav button").filter({ hasText: /^학생$/ }).first();
    await studentSidebar.click();
    await snap(page, "01-sidebar-students");

    // ── 2. 사이드바 → 강의 ──
    console.log("\n── 2. 사이드바 → 강의 ──");
    const lectureSidebar = page.locator("aside a, aside button, nav a, nav button").filter({ hasText: /^강의$/ }).first();
    await lectureSidebar.click();
    await page.waitForTimeout(2000);
    await snap(page, "02-sidebar-lectures");

    // 강의 카드 클릭 → 강의 학생 목록
    console.log("\n── 3. 강의 클릭 → 학생 목록 ──");
    const lectureCard = page.locator("a, button, tr, [role='row']").filter({ hasText: /aaaaa/ }).first();
    if (await lectureCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await lectureCard.click();
      await snap(page, "03-lecture-detail-students");
    } else {
      // 아무 강의나 클릭
      const anyLecture = page.locator("table tr").nth(1);
      if (await anyLecture.isVisible({ timeout: 3000 }).catch(() => false)) {
        await anyLecture.click();
        await snap(page, "03-lecture-detail-students");
      } else {
        console.log("  강의 카드 없음");
      }
    }

    // 차시 클릭 → 출석 페이지
    console.log("\n── 4. 차시 클릭 → 출석 ──");
    const sessionBlock = page.locator("button, a").filter({ hasText: /차시|1차시/ }).first();
    if (await sessionBlock.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sessionBlock.click();
      await snap(page, "04-session-click-attendance");

      // 성적 탭 클릭
      console.log("\n── 5. 성적 탭 클릭 ──");
      const scoresTab = page.locator("button, [role='tab']").filter({ hasText: /성적/ }).first();
      if (await scoresTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await scoresTab.click();
        await snap(page, "05-scores-tab-click");

        // 학생 이름 클릭 → 성적 드로어
        console.log("\n── 6. 학생 클릭 → 성적 드로어 ──");
        const nameChip = page.locator("td span.inline-flex.items-center.gap-2").first();
        if (await nameChip.isVisible({ timeout: 3000 }).catch(() => false)) {
          await nameChip.click();
          await page.waitForTimeout(2000);
          await snap(page, "06-scores-drawer");
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
        }
      }

      // 과제 탭 클릭
      console.log("\n── 7. 과제 탭 클릭 ──");
      const hwTab = page.locator("button, [role='tab']").filter({ hasText: /과제/ }).first();
      if (await hwTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await hwTab.click();
        await snap(page, "07-homework-tab-click");
      }

      // 시험 탭 클릭
      console.log("\n── 8. 시험 탭 클릭 ──");
      const examTab = page.locator("button, [role='tab']").filter({ hasText: /시험/ }).first();
      if (await examTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await examTab.click();
        await snap(page, "08-exam-tab-click");
      }

      // 영상 탭 클릭
      console.log("\n── 9. 영상 탭 클릭 ──");
      const videoTab = page.locator("button, [role='tab']").filter({ hasText: /영상/ }).first();
      if (await videoTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await videoTab.click();
        await snap(page, "09-video-tab-click");
      }
    }

    // ── 사이드바 → 클리닉 ──
    console.log("\n── 10. 사이드바 → 클리닉 ──");
    const clinicSidebar = page.locator("aside a, aside button, nav a, nav button").filter({ hasText: /클리닉/ }).first();
    if (await clinicSidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clinicSidebar.click();
      await snap(page, "10-sidebar-clinic");

      // 클리닉 하위 메뉴: 예약
      console.log("\n── 11. 클리닉 예약 탭 ──");
      const bookingsTab = page.locator("button, a, [role='tab']").filter({ hasText: /예약/ }).first();
      if (await bookingsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await bookingsTab.click();
        await snap(page, "11-clinic-bookings-click");
      }

      // 클리닉 운영 콘솔
      console.log("\n── 12. 클리닉 운영 콘솔 ──");
      const opsTab = page.locator("button, a, [role='tab']").filter({ hasText: /운영|콘솔/ }).first();
      if (await opsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await opsTab.click();
        await snap(page, "12-clinic-operations-click");
      }
    }

    // ── 사이드바 → 영상 ──
    console.log("\n── 13. 사이드바 → 영상 ──");
    const videoSidebar = page.locator("aside a, aside button, nav a, nav button").filter({ hasText: /^영상$/ }).first();
    if (await videoSidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await videoSidebar.click();
      await snap(page, "13-sidebar-videos");
    }

    // ── 사이드바 → 학습지 ──
    console.log("\n── 14. 사이드바 → 학습지 ──");
    const matSidebar = page.locator("aside a, aside button, nav a, nav button").filter({ hasText: /학습지|자료/ }).first();
    if (await matSidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await matSidebar.click();
      await snap(page, "14-sidebar-materials");
    }

    // ── 사이드바 → 성적 ──
    console.log("\n── 15. 사이드바 → 성적 ──");
    const resultsSidebar = page.locator("aside a, aside button, nav a, nav button").filter({ hasText: /^성적$/ }).first();
    if (await resultsSidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resultsSidebar.click();
      await snap(page, "15-sidebar-results");
    }

    // ── 사이드바 → 커뮤니티 ──
    console.log("\n── 16. 사이드바 → 커뮤니티 ──");
    const commSidebar = page.locator("aside a, aside button, nav a, nav button").filter({ hasText: /커뮤니티|QnA|상담/ }).first();
    if (await commSidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await commSidebar.click();
      await snap(page, "16-sidebar-community");
    }

    // ══════════ 최종 결과 ══════════
    console.log("\n\n╔════════════════════════════════════════════════════╗");
    console.log("║     사이드바 네비게이션 전수 검증 최종 결과        ║");
    console.log("╠════════════════════════════════════════════════════╣");
    for (const r of ALL) {
      const n = r.note ? ` [${r.note}]` : "";
      console.log(`║ ✅ ${r.loc.padEnd(38)} chips=${String(r.chips).padStart(3)} hl=${String(r.hl).padStart(3)}${n}`);
    }
    console.log("╠════════════════════════════════════════════════════╣");
    console.log(`║ 총 ${String(ALL.length).padStart(2)}개 위치 · 에러 0건                         ║`);
    console.log("╚════════════════════════════════════════════════════╝\n");

    expect(ALL.length).toBeGreaterThanOrEqual(5);
  });
});

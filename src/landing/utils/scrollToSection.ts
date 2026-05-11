// PATH: src/landing/utils/scrollToSection.ts
// 랜딩 section anchor scroll SSOT (2026-05-12 cycle 11).
//
// 이전엔 4곳에 offset 70 / 116 흩어짐:
//   - LandingNavBar.handleNav (70)
//   - LandingFooter (70)
//   - PublicLandingPage hash tryScroll (70)
//   - LandingSectionTabs.onClick (116)
//
// 결함: NavBar/Footer 메뉴 클릭 시 70만 보정 → scroll > 200 시점 fixed strip(48px)이
// section header 덮어 title 가려짐. 116으로 통일 + hero scroll 0 clamp.

// NavBar height 64 + Strip height 48 + breathing 4 = 116.
// hero section 가는 경우 0 clamp (browser가 negative scroll top을 0으로 처리).
export const LANDING_SCROLL_OFFSET = 116;

/**
 * data-stype 값으로 section 찾아 scrollTo + history hash 갱신.
 * `sticky LandingSectionTabs` + `LandingNavBar` 두 고정 영역에 가리지 않도록 보정.
 *
 * @returns true if section found and scrolled, false otherwise.
 */
export function scrollToLandingSection(stype: string, opts?: { updateHash?: boolean }): boolean {
  const el = document.querySelector(`section[data-stype="${stype}"]`) as HTMLElement | null;
  if (!el) return false;
  const top = Math.max(0, el.offsetTop - LANDING_SCROLL_OFFSET);
  window.scrollTo({ top, behavior: "smooth" });
  if (opts?.updateHash !== false) {
    try { window.history.replaceState(null, "", `/landing#${stype}`); } catch { /* noop */ }
  }
  return true;
}

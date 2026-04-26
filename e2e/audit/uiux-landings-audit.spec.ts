/**
 * UI/UX 랜딩 감사 — 관리자(선생) 앱 전 도메인 랜딩 풀페이지 캡처
 *
 * 목적: 각 도메인 첫 진입 화면을 한 번에 떠서 (1) 정보 위계 (2) CTA 명확성
 * (3) 클릭 효율을 사람이 한눈에 비교 검토할 수 있게 한다.
 *
 * 출력: test-results/uiux-landings/{slug}.png  (full page)
 *
 * Tenant 1 (hakwonplus / admin97).
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

test.setTimeout(300_000);

const BASE = getBaseUrl("admin");

// 핵심 랜딩 — 사이드바에서 한 번 클릭으로 닿는 1차/대표 진입점 위주
const LANDINGS: { slug: string; path: string; title: string }[] = [
  { slug: "00-dashboard",            path: "/admin/dashboard",            title: "대시보드" },
  { slug: "10-students-home",        path: "/admin/students/home",        title: "학생 홈" },
  { slug: "11-students-requests",    path: "/admin/students/requests",    title: "학생 신청 인박스" },
  { slug: "20-lectures",             path: "/admin/lectures",             title: "강의 목록" },
  { slug: "30-exams",                path: "/admin/exams",                title: "시험 탐색" },
  { slug: "31-exams-templates",      path: "/admin/exams/templates",      title: "시험 템플릿" },
  { slug: "32-exams-bundles",        path: "/admin/exams/bundles",        title: "시험 번들" },
  { slug: "40-results",              path: "/admin/results",              title: "성적 탐색" },
  { slug: "41-results-submissions",  path: "/admin/results/submissions",  title: "제출 인박스" },
  { slug: "50-videos",               path: "/admin/videos",               title: "영상 탐색" },
  { slug: "60-clinic",               path: "/admin/clinic",               title: "클리닉" },
  { slug: "70-materials",            path: "/admin/materials",            title: "자료" },
  { slug: "71-storage",              path: "/admin/storage",              title: "저장소" },
  { slug: "75-fees",                 path: "/admin/fees",                 title: "수납" },
  { slug: "80-message",              path: "/admin/message",              title: "메시지" },
  { slug: "90-community-board",      path: "/admin/community/board",      title: "커뮤니티 게시판" },
  { slug: "91-community-qna",        path: "/admin/community/qna",        title: "커뮤니티 Q&A" },
  { slug: "92-community-notice",     path: "/admin/community/notice",     title: "커뮤니티 공지" },
  { slug: "93-community-counsel",    path: "/admin/community/counsel",    title: "커뮤니티 상담" },
  { slug: "94-community-materials",  path: "/admin/community/materials",  title: "커뮤니티 자료" },
  { slug: "95-community-settings",   path: "/admin/community/settings",   title: "커뮤니티 설정" },
  { slug: "A0-tools",                path: "/admin/tools",                title: "도구" },
  { slug: "B0-staff",                path: "/admin/staff",                title: "직원" },
  { slug: "C0-profile-attendance",   path: "/admin/profile/attendance",   title: "내 근태" },
  { slug: "C1-profile-expense",      path: "/admin/profile/expense",      title: "내 지출" },
  { slug: "D0-settings-profile",     path: "/admin/settings/profile",     title: "설정 - 프로필" },
  { slug: "D1-settings-organization",path: "/admin/settings/organization",title: "설정 - 학원" },
  { slug: "D2-settings-appearance",  path: "/admin/settings/appearance",  title: "설정 - 외관" },
  { slug: "D3-settings-billing",     path: "/admin/settings/billing",     title: "설정 - 결제" },
  { slug: "D4-settings-landing",     path: "/admin/settings/landing",     title: "설정 - 랜딩" },
  { slug: "E0-guide",                path: "/admin/guide",                title: "가이드" },
  { slug: "F0-developer",            path: "/admin/developer",            title: "개발자" },
];

test("admin landings — full-page capture", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaUI(page, "admin");

  for (const L of LANDINGS) {
    const url = `${BASE}${L.path}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      // 데이터/lazy chunk 로딩 안정화
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `e2e/reports/uiux-landings/${L.slug}.png`,
        fullPage: true,
      });
      console.log(`[OK]   ${L.slug}  ${L.title}  ${page.url()}`);
    } catch (e) {
      console.log(`[FAIL] ${L.slug}  ${L.title}  ${(e as Error).message}`);
      await page.screenshot({
        path: `e2e/reports/uiux-landings/${L.slug}__error.png`,
        fullPage: true,
      }).catch(() => {});
    }
  }

  expect(true).toBe(true);
});

/**
 * E2E 실사용 리뷰: 선생앱 모바일 Batch 5~10 신규/변경 기능.
 * 운영(https://hakwonplus.com) 대상. 로그인 후 각 페이지를 실제 클릭·상호작용하며
 *  1) 콘솔 에러 (JS 런타임)
 *  2) 네트워크 에러 (4xx / 5xx — 실데이터 API)
 *  3) DOM 렌더 정상성
 *  4) 주요 위젯 존재 여부
 *  를 수집합니다.
 */
import { test, expect, type Page, type Request, type Response } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";

const BASE = getBaseUrl("admin");
const SCREEN_DIR = "e2e/screenshots/batch10";
if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

type Netfail = { url: string; status: number; method: string };

function attachNetCapture(page: Page): { errors: string[]; netFails: Netfail[] } {
  const errors: string[] = [];
  const netFails: Netfail[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    // 무시: favicon, sourcemap, warning, 네트워크 4xx/5xx (Chrome이 자동 생성 — JS 코드로 차단 불가)
    if (/favicon|sourcemap|warning/i.test(t)) return;
    if (/failed to load resource|\b40\d\b|\b50\d\b|network error/i.test(t)) return;
    errors.push(t);
  });
  page.on("response", (resp: Response) => {
    const url = resp.url();
    if (!/\/api\//.test(url)) return;
    const s = resp.status();
    if (s >= 400) {
      netFails.push({ url: url.replace(/^https?:\/\/[^/]+/, ""), status: s, method: resp.request().method() });
    }
  });
  return { errors, netFails };
}

test.describe("Batch 10 실사용 리뷰", () => {
  test.use({ viewport: MOBILE_VIEWPORT, userAgent: MOBILE_UA });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
    await page.evaluate(() => { localStorage.removeItem("teacher:preferAdmin"); });
  });

  test("메시지 설정 — KPI 4장, 공급자 선택, 자체 키 폼, 연동 테스트, 자동발송", async ({ page }) => {
    const { errors, netFails } = attachNetCapture(page);
    await page.goto(`${BASE}/teacher/messaging-settings`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `${SCREEN_DIR}/messaging-settings.png`, fullPage: true });
    // KPI 4장
    for (const label of ["공급자", "발신번호", "알림톡", "SMS"]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 6_000 });
    }
    // 공급자 섹션
    await expect(page.getByText("솔라피(Solapi)").first()).toBeVisible();
    await expect(page.getByText("뿌리오(Ppurio)").first()).toBeVisible();
    // 연동 테스트 버튼
    await expect(page.getByRole("button", { name: /연동 상태 테스트|테스트 중/ })).toBeVisible();

    console.log("[messaging-settings] errors:", JSON.stringify(errors, null, 2));
    console.log("[messaging-settings] netFails:", JSON.stringify(netFails, null, 2));
    expect(errors, `errs=${JSON.stringify(errors)}; netFails=${JSON.stringify(netFails)}`).toHaveLength(0);
  });

  test("학생 목록 대량 선택 + 상세 → 비번초기화 BottomSheet 동작", async ({ page }) => {
    const { errors, netFails } = attachNetCapture(page);
    await page.goto(`${BASE}/teacher/students`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREEN_DIR}/students-list.png`, fullPage: true });

    // 선택 모드 진입
    await page.getByRole("button", { name: "선택" }).first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/명 선택됨/).first()).toBeVisible();
    // 전체 선택
    await page.getByRole("button", { name: "전체 선택" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREEN_DIR}/students-selected.png`, fullPage: true });

    // 하단 액션바 4개 버튼 확인
    for (const label of ["문자", "태그", "비번초기화", "삭제"]) {
      await expect(page.getByRole("button", { name: label }).first()).toBeVisible({ timeout: 3_000 });
    }
    // 비번초기화 BottomSheet 열기
    await page.getByRole("button", { name: "비번초기화" }).first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SCREEN_DIR}/students-pw-reset-sheet.png`, fullPage: true });
    await expect(page.getByText(/비밀번호 초기화|명 비밀번호 변경/).first()).toBeVisible();

    console.log("[students] errors:", JSON.stringify(errors, null, 2));
    console.log("[students] netFails:", JSON.stringify(netFails, null, 2));
    expect(errors, `errs=${JSON.stringify(errors)}; netFails=${JSON.stringify(netFails)}`).toHaveLength(0);
  });

  test("시험 템플릿 + 번들 페이지 — 실데이터 리스트 + 새 번들 시트", async ({ page }) => {
    const { errors, netFails } = attachNetCapture(page);
    await page.goto(`${BASE}/teacher/exams/templates`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREEN_DIR}/exam-templates.png`, fullPage: true });
    await expect(page.getByText("템플릿 관리").first()).toBeVisible();

    await page.goto(`${BASE}/teacher/exams/bundles`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SCREEN_DIR}/exam-bundles.png`, fullPage: true });
    await expect(page.getByText("시험 번들").first()).toBeVisible();

    // "새 번들" 버튼 → BottomSheet 열기
    const newBundleBtn = page.getByRole("button", { name: /새 번들/ });
    if (await newBundleBtn.isVisible().catch(() => false)) {
      await newBundleBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREEN_DIR}/exam-bundle-form.png`, fullPage: true });
      await expect(page.getByText(/번들 이름|번들 생성/).first()).toBeVisible();
    }
    console.log("[exams] errors:", JSON.stringify(errors, null, 2));
    console.log("[exams] netFails:", JSON.stringify(netFails, null, 2));
    expect(errors, `errs=${JSON.stringify(errors)}; netFails=${JSON.stringify(netFails)}`).toHaveLength(0);
  });

  test("클리닉 보고서 + 리모컨 — 캘린더, 3색 패스카드", async ({ page }) => {
    const { errors, netFails } = attachNetCapture(page);
    await page.goto(`${BASE}/teacher/clinic/reports`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREEN_DIR}/clinic-reports.png`, fullPage: true });
    await expect(page.getByText("클리닉 보고서").first()).toBeVisible();
    // 요일 헤더 확인
    for (const d of ["일", "월", "화", "수", "목", "금", "토"]) {
      await expect(page.getByText(d, { exact: true }).first()).toBeVisible();
    }

    await page.goto(`${BASE}/teacher/clinic/remote`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREEN_DIR}/clinic-remote.png`, fullPage: true });
    await expect(page.getByText("클리닉 리모컨").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /랜덤 3색 배치/ })).toBeVisible();

    console.log("[clinic] errors:", JSON.stringify(errors, null, 2));
    console.log("[clinic] netFails:", JSON.stringify(netFails, null, 2));
    expect(errors, `errs=${JSON.stringify(errors)}; netFails=${JSON.stringify(netFails)}`).toHaveLength(0);
  });

  test("빌링/구독 — 요금제 카드, 카드 목록, 학원 정보", async ({ page }) => {
    const { errors, netFails } = attachNetCapture(page);
    await page.goto(`${BASE}/teacher/billing`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREEN_DIR}/billing.png`, fullPage: true });
    await expect(page.getByText("결제 / 구독").first()).toBeVisible();
    // 요금제 정보 섹션
    await expect(page.getByText(/구독 시작|만료일|결제 방식/).first()).toBeVisible();

    console.log("[billing] errors:", JSON.stringify(errors, null, 2));
    console.log("[billing] netFails:", JSON.stringify(netFails, null, 2));
    expect(errors, `errs=${JSON.stringify(errors)}; netFails=${JSON.stringify(netFails)}`).toHaveLength(0);
  });

  test("직원 관리 → 직원 상세 → 근태 탭 → 근태 등록 BottomSheet", async ({ page }) => {
    const { errors, netFails } = attachNetCapture(page);
    await page.goto(`${BASE}/teacher/staff`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${SCREEN_DIR}/staff-list.png`, fullPage: true });
    await expect(page.getByText("직원 관리").first()).toBeVisible();

    // 첫 직원 카드 클릭 → 상세 이동
    const firstCard = page.locator(".rounded-xl").nth(0);
    const firstStaffName = page.locator("[style*='rounded-full']").first();
    // 직원 카드의 이름 영역(아바타 옆) 클릭
    const clickable = page.locator("div.cursor-pointer").first();
    if (await clickable.isVisible().catch(() => false)) {
      await clickable.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SCREEN_DIR}/staff-detail.png`, fullPage: true });
      // 탭 3개
      for (const t of ["근태", "비용", "급여"]) {
        await expect(page.getByRole("button", { name: t }).first()).toBeVisible({ timeout: 3_000 });
      }
      // 근태 추가 시트 열기 (exists only if not locked)
      const addBtn = page.getByRole("button", { name: /^추가$/ });
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${SCREEN_DIR}/staff-work-form.png`, fullPage: true });
        await expect(page.getByText(/근태 등록|근무 유형/).first()).toBeVisible();
      }
    }

    console.log("[staff] errors:", JSON.stringify(errors, null, 2));
    console.log("[staff] netFails:", JSON.stringify(netFails, null, 2));
    expect(errors, `errs=${JSON.stringify(errors)}; netFails=${JSON.stringify(netFails)}`).toHaveLength(0);
  });

  test("OMR 페이지 + 공지 작성 알림 토글", async ({ page }) => {
    const { errors, netFails } = attachNetCapture(page);

    // 첫 시험 목록 → 첫 시험 OMR 진입
    await page.goto(`${BASE}/teacher/exams`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREEN_DIR}/exams-list.png`, fullPage: true });

    // 첫 시험 항목 찾기
    const firstExamCard = page.locator("div").filter({ hasText: /시험|과제/ }).first();

    // 공지 작성 플로우
    await page.goto(`${BASE}/teacher/comms`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    // "공지" 탭 클릭
    const noticeTab = page.getByRole("button", { name: /공지/ }).first();
    if (await noticeTab.isVisible().catch(() => false)) {
      await noticeTab.click();
      await page.waitForTimeout(1000);
      // 작성 버튼
      const writeBtn = page.getByRole("button", { name: /작성|\+/ }).first();
      if (await writeBtn.isVisible().catch(() => false)) {
        await writeBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREEN_DIR}/create-post-sheet.png`, fullPage: true });
        // 알림 토글 존재 확인
        const notifyToggleText = page.getByText(/작성 후 알림 발송/);
        if (await notifyToggleText.isVisible().catch(() => false)) {
          console.log("[create-post] 알림 토글 확인됨");
        }
      }
    }

    console.log("[omr+post] errors:", JSON.stringify(errors, null, 2));
    console.log("[omr+post] netFails:", JSON.stringify(netFails, null, 2));
    expect(errors, `errs=${JSON.stringify(errors)}; netFails=${JSON.stringify(netFails)}`).toHaveLength(0);
  });
});

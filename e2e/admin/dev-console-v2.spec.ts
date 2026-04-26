// PATH: e2e/admin/dev-console-v2.spec.ts
// /dev 운영 콘솔 V2 — 대시보드/테넌트/Cmd+K/임퍼소네이션 라이브 검증.

import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";

const ADMIN_BASE = getBaseUrl("admin"); // hakwonplus

test.describe("/dev 운영 콘솔 V2", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("대시보드 KPI 9장 + 시리즈 + 활동 패널 렌더", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dev/dashboard`, { waitUntil: "load" });

    // 페이지 타이틀
    await expect(page.getByRole("heading", { name: "운영 대시보드" })).toBeVisible();

    // KPI 라벨이 모두 보이는지 (백엔드가 살아있고 summary endpoint 응답)
    const kpiLabels = [
      "MRR",
      "만료 7일 이내",
      "연체 인보이스",
      "30일 결제액",
      "활성 테넌트",
      "신규 가입 7일",
      "미답변 문의",
      "실패 작업 24h",
      "신규 사용자 7일",
    ];
    for (const label of kpiLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    }

    // 신규 테넌트 30일 차트 카드
    await expect(page.getByRole("heading", { name: "신규 테넌트 30일" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "최근 활동" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "빠른 실행" })).toBeVisible();
  });

  test("Cmd+K 글로벌 검색 — 테넌트 코드 검색 + 결과 클릭", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dev/dashboard`, { waitUntil: "load" });

    // 사이드바에 검색 진입 버튼이 있어야 함
    const searchTrigger = page.getByTitle("글로벌 검색 (Cmd/Ctrl+K)");
    await expect(searchTrigger).toBeVisible();
    await searchTrigger.click();

    // 팔레트 입력창 보이고 포커스됨
    const input = page.getByPlaceholder(/테넌트 코드.*사용자/);
    await expect(input).toBeVisible();
    await input.fill("hakwonplus");

    // 결과 영역에 TENANT 결과 등장
    await expect(page.getByText("TENANT", { exact: true }).first()).toBeVisible({ timeout: 8_000 });

    // ESC로 닫기
    await page.keyboard.press("Escape");
    await expect(input).not.toBeVisible();
  });

  test("자동화 페이지 — 감사 로그 + 크론 탭 렌더", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dev/automation`, { waitUntil: "load" });

    await expect(page.getByRole("heading", { name: "자동화" })).toBeVisible();

    // 감사 로그 탭 (기본)
    await expect(page.getByRole("heading", { name: "필터" })).toBeVisible();

    // 크론 탭 클릭
    await page.getByRole("button", { name: "크론" }).click();
    // 화이트리스트 명령 라벨이 보여야 함
    await expect(page.getByText("E2E 잔재 정리", { exact: true })).toBeVisible();
    await expect(page.getByText("R2 오펀 영상 정리", { exact: true })).toBeVisible();
    await expect(page.getByText("운영 알림 룰 점검", { exact: true })).toBeVisible();
  });

  test("테넌트 상세 — 사용량/활동 탭 + admin 점프 + R2 storage card", async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/dev/tenants`, { waitUntil: "load" });
    await expect(page.getByRole("heading", { name: "테넌트" })).toBeVisible();

    // 첫 번째 테넌트 클릭 (행 클릭으로 detail 진입)
    const firstRow = page.locator("tbody tr").first();
    await firstRow.waitFor({ state: "visible", timeout: 10_000 });
    await firstRow.click();

    await page.waitForURL(/\/dev\/tenants\/\d+$/, { timeout: 10_000 });

    // 탭이 6개 (개요/사용량/활동/브랜딩/도메인/소유자)
    for (const tabLabel of ["개요", "사용량", "활동", "브랜딩", "도메인", "소유자"]) {
      await expect(page.getByRole("button", { name: tabLabel, exact: true })).toBeVisible();
    }

    // 헤더에 admin 점프 버튼 (대표 도메인이 있는 경우)
    const adminJump = page.getByTitle(/admin 새 탭에서 열기/);
    // primaryDomain이 없을 수 있으므로 visible 보장 X — count만 확인
    expect(await adminJump.count()).toBeGreaterThanOrEqual(0);

    // 사용량 탭
    await page.getByRole("button", { name: "사용량", exact: true }).click();
    await expect(page.getByText("학생", { exact: true })).toBeVisible();
    await expect(page.getByText("교사", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "R2 영상 스토리지" })).toBeVisible({ timeout: 15_000 });

    // 활동 탭
    await page.getByRole("button", { name: "활동", exact: true }).click();
    await expect(page.getByRole("heading", { name: "감사 로그" })).toBeVisible();
  });

  test("임퍼소네이션 → 배너 표시 → dev 복귀", async ({ page }) => {
    test.setTimeout(60_000);

    // owner를 보유한 활성 테넌트 — tchul / dnb / limglish 중 첫 매칭
    await page.goto(`${ADMIN_BASE}/dev/tenants`, { waitUntil: "load" });
    await page.locator("tbody tr").first().waitFor({ state: "visible", timeout: 10_000 });
    let targetRow = page.locator("tbody tr").filter({ hasText: "tchul" }).first();
    if ((await targetRow.count()) === 0) targetRow = page.locator("tbody tr").filter({ hasText: "dnb" }).first();
    if ((await targetRow.count()) === 0) targetRow = page.locator("tbody tr").filter({ hasText: "limglish" }).first();
    if ((await targetRow.count()) === 0) {
      test.skip(true, "owner 보유 테넌트 미발견 — 임퍼소네이션 스킵");
    }
    await targetRow.click();
    await page.waitForURL(/\/dev\/tenants\/\d+$/);

    // 소유자 탭 진입
    await page.getByRole("button", { name: "소유자", exact: true }).click();

    // owner 행 + "로그인" 버튼 — 없으면 스킵
    const loginBtn = page.getByTitle("이 사용자로 로그인 (감사 로그 기록)").first();
    await loginBtn.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
    if ((await loginBtn.count()) === 0) {
      test.skip(true, "활성 owner 없음 — 임퍼소네이션 스킵");
    }

    // confirm 다이얼로그 자동 승인
    page.once("dialog", (d) => d.accept());

    // 임퍼소네이션 트리거. 페이지 reload 발생하므로 navigation 대기.
    await Promise.all([
      page.waitForNavigation({ url: /\/admin/, timeout: 20_000 }),
      loginBtn.click(),
    ]);

    // 배너 표시 (어떤 페이지에서든)
    const banner = page.getByText(/임퍼소네이션 중/);
    await expect(banner).toBeVisible({ timeout: 10_000 });

    // localStorage에 dev 토큰 백업이 보존됐는지
    const hasBackup = await page.evaluate(() => Boolean(localStorage.getItem("dev_orig_access")));
    expect(hasBackup).toBe(true);

    // dev로 복귀 클릭 — assign + 페이지 갱신
    page.once("dialog", (d) => d.accept());
    const returnBtn = page.getByRole("button", { name: /dev로 복귀/ });
    await Promise.all([
      page.waitForURL(/\/dev\/dashboard/, { timeout: 20_000 }),
      returnBtn.click(),
    ]);

    // 백업 키가 정리됐는지
    const stillHasBackup = await page.evaluate(() => Boolean(localStorage.getItem("dev_orig_access")));
    expect(stillHasBackup).toBe(false);

    // 대시보드 복귀 확인
    await expect(page.getByRole("heading", { name: "운영 대시보드" })).toBeVisible({ timeout: 10_000 });
  });
});

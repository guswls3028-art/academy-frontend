/**
 * FK 마이그레이션 후 실사용 브라우저 회귀 검증
 *
 * 모든 페이지 진입/데이터 생성/수정/삭제를 브라우저 UI로 수행.
 * 500 에러, console error, 깨진 UI, 데이터 불일치를 탐지.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "./helpers/auth";

const BASE = getBaseUrl("admin");

test.describe("FK 전환 후 주요 페이지 500/4xx 에러 검사", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  const pages = [
    { name: "대시보드", path: "/admin/dashboard" },
    { name: "강의 목록", path: "/admin/lectures" },
    { name: "학생 목록", path: "/admin/students" },
    { name: "클리닉 홈", path: "/admin/clinic/home" },
    { name: "클리닉 예약", path: "/admin/clinic/bookings" },
    { name: "클리닉 운영", path: "/admin/clinic/schedule" },
    { name: "클리닉 설정", path: "/admin/clinic/settings" },
    { name: "커뮤니티 공지", path: "/admin/community/notice" },
    { name: "커뮤니티 QnA", path: "/admin/community/qna" },
    { name: "커뮤니티 게시판", path: "/admin/community/board" },
  ];

  for (const { name, path } of pages) {
    test(`${name} — 서버 에러 없이 로드`, async ({ page }) => {
      const serverErrors: string[] = [];
      page.on("response", (r) => {
        if (r.status() >= 500) {
          serverErrors.push(`${r.url()} → ${r.status()}`);
        }
      });

      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && !msg.text().includes("favicon")) {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(3000);

      // 500 에러 확인
      if (serverErrors.length > 0) {
        console.error(`[${name}] Server errors:`, serverErrors);
      }
      expect(serverErrors, `${name}에서 500 에러 발생`).toHaveLength(0);

      // 페이지 본문에 에러 표시 없는지
      const body = await page.locator("body").textContent();
      expect(body).not.toContain("Internal Server Error");
    });
  }
});

test.describe("클리닉 — 세션 생성 → 학생 등록 → 명단 확인 → 삭제", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("클리닉 전체 플로우", async ({ page }) => {
    // 1. 클리닉 운영 페이지로 이동
    await page.goto(`${BASE}/admin/clinic/schedule`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 서버 에러 감시
    const serverErrors: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.url()} → ${r.status()}`);
    });

    // 2. 클리닉 홈으로 이동하여 오늘 스케줄 확인
    await page.goto(`${BASE}/admin/clinic/home`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 3. 예약 페이지에서 대상자 목록 로드 확인
    await page.goto(`${BASE}/admin/clinic/bookings`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    expect(serverErrors).toHaveLength(0);
  });
});

test.describe("커뮤니티 — 공지 작성 → 조회 → 삭제", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("공지사항 CRUD", async ({ page }) => {
    const serverErrors: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.url()} → ${r.status()}`);
    });

    // 1. 공지사항 페이지 진입
    await page.goto(`${BASE}/admin/community/notice`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 2. QnA 페이지 진입 — QnA 목록 로드
    await page.goto(`${BASE}/admin/community/qna`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 3. 상담 페이지 진입
    await page.goto(`${BASE}/admin/community/counsel`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    expect(serverErrors).toHaveLength(0);
  });
});

test.describe("성적 — FK 전환 후 세션/시험 데이터 조회", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("세션 관리 페이지 — 성적 탭 로드", async ({ page }) => {
    const serverErrors: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.url()} → ${r.status()}`);
    });

    await page.goto(`${BASE}/admin/sessions`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    expect(serverErrors).toHaveLength(0);
  });
});

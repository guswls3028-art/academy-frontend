import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { getBaseUrl, loginViaUI } from "./helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "./helpers/localAuthApiStubs";

const TS = Date.now();

function createE2eJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400 }),
  ).toString("base64url");
  return `e30.${payload}.e2e`;
}

async function installClinicToolLocalApiFallbacks(page: Page, access: string) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }

    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/token/") || pathname.endsWith("/token/refresh/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: { access, refresh: "e2e-local-refresh" },
      });
      return;
    }

    if (pathname.endsWith("/core/program/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          tenantCode: "hakwonplus",
          isPlatformAdmin: true,
          display_name: "학원플러스",
          ui_config: { login_title: "학원플러스", login_subtitle: "학원 관리 시스템" },
          feature_flags: {},
          is_active: true,
        },
      });
      return;
    }

    if (pathname.endsWith("/core/me/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          id: 12,
          username: "t1_admin97",
          name: "관리자",
          phone: null,
          is_staff: true,
          is_superuser: true,
          tenantRole: "admin",
          linkedStudentId: null,
          linkedStudentName: null,
          linkedStudents: null,
          must_change_password: false,
        },
      });
      return;
    }

    if (pathname.endsWith("/staffs/me/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: { id: 12, name: "관리자", role: "admin", user: 12 },
      });
      return;
    }

    if (pathname.endsWith("/results/admin/clinic-targets/") || pathname.endsWith("/staffs/currently-working/")) {
      await route.fulfill({ status: 200, contentType: "application/json", json: [] });
      return;
    }

    const emptyListPayload = { count: 0, next: null, previous: null, results: [] };
    await route.fulfill({ status: 200, contentType: "application/json", json: emptyListPayload });
  });
}

async function openClinicTool(page: Page) {
  const baseUrl = getBaseUrl("admin");
  const isLocal = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl);
  const localAccessToken = createE2eJwt();

  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  if (isLocal) {
    await page.route("**/version.json?*", async (route) => {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "" });
    });
    await installClinicToolLocalApiFallbacks(page, localAccessToken);
    await page.addInitScript((access) => {
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", "e2e-local-refresh");
      localStorage.setItem("tenant_code", "hakwonplus");
      sessionStorage.setItem("tenantCode", "hakwonplus");
    }, localAccessToken);
  } else {
    await loginViaUI(page, "admin");
  }

  await page.goto(`${baseUrl}/admin/tools/clinic`, { waitUntil: "load" });
  await expect(page).toHaveURL(/\/admin\/tools\/clinic/);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(page.locator("#clinic-paste-ta")).toBeEditable({ timeout: 15_000 });
}

const EXTERNAL_PLATFORM_PASTE = `강의
학생
클리닉
상담
공지
메시지
질의응답
관리자
박철
중대
2026 1학기 기말 중대부고
날짜
05/17
전체
10명
현장
7명
지각
1명
영상
1명
조퇴
1명
미정
0명
검색어 입력 (초성 검색 가능)
이름
출석
교재 지권의 변화와 판구조론
숨김
공개
부교재(메인자료) 지권의 변화와 판구조론
숨김
공개
지권의 변화 킬러 모의고사
숨김
공개
신념 모의고사 지권의 변화와 판구조론
숨김
공개
1
강민채
영상
-
진행
-
진행
-
진행
-
진행
2
권라임
현장
100%
완료
100%
완료
100%
완료
91점
완료
3
권유나
현장
100%
완료
50%
진행
+1
미제출
진행
+1
60점
완료
37
안수빈
지각
미제출
진행
+1
미제출
진행
+1
미제출
진행
+1
미응시
진행
+1
38
양다현
조퇴
미제출
진행
+1
미제출
진행
+1
미제출
진행
+1
22.5점
진행
+1
47
이서윤
현장
미제출
진행
+1
미제출
진행
+1
미제출
진행
+1
45.5점
진행
+1
48
이서윤
현장
100%
완료
100%
완료
미제출
진행
+1
65점
완료
62
전우현
현장
0%
진행
+1
20%
진행
+1
미제출
진행
+1
14점
진행
+1
74
황유림
현장
80%
완료
80%
완료
미제출
진행
+1
82.5점
완료
75
황이안
현장
0%
진행
+1
40%
진행
+1
미제출
진행
+1
44점
진행
+1
New
동시 정렬 기능`;

const EXTERNAL_PLATFORM_PASTE_WITH_TARGET_LABEL = EXTERNAL_PLATFORM_PASTE
  .replace(
    `전체
10명
현장
7명
지각
1명
영상
1명
조퇴
1명`,
    `전체
75명
현장
69명
영상
5명
조퇴
1명`,
  )
  .replace(
    `검색어 입력 (초성 검색 가능)
이름`,
    `검색어 입력 (초성 검색 가능)
75명을 대상으로
이름`,
  );

test.describe("클리닉 대상자 생성기 — 타 플랫폼 복붙 형식", () => {
  test("미제출 값이 있어도 최종 상태가 완료이면 클리닉 대상에서 제외한다", async ({ page }) => {
    await openClinicTool(page);

    await page.locator("#clinic-paste-ta").fill([
      "이예리",
      "현장",
      "미제출",
      "완료",
      "85점",
      "완료",
      "김미달",
      "현장",
      "0%",
      "진행",
      "40점",
      "진행",
    ].join("\n"));
    await page.getByRole("button", { name: "생성", exact: true }).click();

    const frame = page.frameLocator("#cprev");
    await expect(frame.locator(".columns")).toContainText("김미달", { timeout: 8000 });
    await expect(frame.locator(".columns")).not.toContainText("이예리");
    await expect(frame.locator(".section-header.both")).toContainText("(1명)");
    await expect(frame.locator(".footer-left")).toContainText("클리닉 대상 1명 / 전체 출석 2명");
  });

  test("진행/+1 형식과 동명이인을 파싱하고 실제 PDF를 내려받는다", async ({ page }) => {
    await openClinicTool(page);

    await page.locator("#clinic-paste-ta").fill(EXTERNAL_PLATFORM_PASTE);
    await page.getByRole("button", { name: "생성", exact: true }).click();

    const frame = page.frameLocator("#cprev");
    await expect(frame.locator(".section-header.both")).toContainText("(5명)", { timeout: 8000 });
    await expect(frame.locator(".section-header.exam")).toContainText("(0명)");
    await expect(frame.locator(".section-header.hw")).toContainText("(3명)");
    await expect(frame.locator(".footer-left")).toContainText("클리닉 대상 8명 / 전체 출석 9명");

    await expect(frame.locator('[data-field="sessionTitle"]')).toContainText("2026 1학기 기말 중대부고");
    await expect(frame.locator('[data-field="lectureTitle"]')).toContainText("중대");
    await expect(frame.locator('[data-field="date"]')).toContainText("05/17");

    await expect(frame.locator('[data-field="both"]')).toContainText("안수빈");
    await expect(frame.locator('[data-field="both"]')).toContainText("양다현");
    await expect(frame.locator('[data-field="both"]')).toContainText("전우현");
    await expect(frame.locator('[data-field="both"]')).toContainText("황이안");
    await expect(frame.locator('[data-field="hwOnly"]')).toContainText("권유나");
    await expect(frame.locator('[data-field="hwOnly"]')).toContainText("황유림");
    await expect(frame.locator(".name-text").filter({ hasText: /^이서윤$/ })).toHaveCount(2);
    await expect(frame.locator(".columns")).not.toContainText("강민채");
    await expect(frame.locator(".columns")).not.toContainText("권라임");

    await mkdir("e2e-out", { recursive: true });
    await frame.locator(".page").screenshot({ path: `e2e-out/clinic-external-format-${TS}.png` });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.getByRole("button", { name: "PDF 다운로드" }).click(),
    ]);
    const pdfPath = path.resolve("e2e-out", `clinic-external-format-${TS}.pdf`);
    await download.saveAs(pdfPath);

    const pdf = await readFile(pdfPath);
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
  });

  test("75명을 대상으로 안내문과 헤더 출석 합계를 함께 처리한다", async ({ page }) => {
    await openClinicTool(page);

    await page.locator("#clinic-paste-ta").fill(EXTERNAL_PLATFORM_PASTE_WITH_TARGET_LABEL);
    await page.getByRole("button", { name: "생성", exact: true }).click();

    const frame = page.frameLocator("#cprev");
    await expect(frame.locator(".section-header.both")).toContainText("(5명)", { timeout: 8000 });
    await expect(frame.locator(".section-header.exam")).toContainText("(0명)");
    await expect(frame.locator(".section-header.hw")).toContainText("(3명)");
    await expect(frame.locator(".footer-left")).toContainText("클리닉 대상 8명 / 전체 출석 70명");
    await expect(frame.locator(".columns")).not.toContainText("75명을 대상으로");
    await expect(frame.locator(".columns")).not.toContainText("강민채");
    await expect(frame.locator('[data-field="both"]')).toContainText("안수빈");
    await expect(frame.locator('[data-field="hwOnly"]')).toContainText("권유나");

    await mkdir("e2e-out", { recursive: true });
    await frame.locator(".page").screenshot({ path: `e2e-out/clinic-external-format-target-label-${TS}.png` });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.getByRole("button", { name: "PDF 다운로드" }).click(),
    ]);
    const pdfPath = path.resolve("e2e-out", `clinic-external-format-target-label-${TS}.pdf`);
    await download.saveAs(pdfPath);

    const pdf = await readFile(pdfPath);
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
  });
});

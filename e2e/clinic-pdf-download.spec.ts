import { test, expect, type Page } from "./fixtures/strictTest";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { getBaseUrl, loginViaUI } from "./helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "./helpers/localAuthApiStubs";

const TS = Date.now();

function isLocalBaseUrl(url: string) {
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(url);
}

function createLocalJwt() {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: now + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
}

async function openClinicTool(page: Page) {
  const baseUrl = getBaseUrl("admin");
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  if (isLocalBaseUrl(baseUrl)) {
    await page.route("**/version.json?*", async (route) => {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "" });
    });
    const token = createLocalJwt();
    await page.addInitScript((jwt) => {
      localStorage.setItem("access", jwt);
      localStorage.setItem("refresh", `${jwt}-refresh`);
      localStorage.setItem("tenant_code", "hakwonplus");
      localStorage.setItem("ui.sidebar.collapsed", "0");
      sessionStorage.setItem("tenantCode", "hakwonplus");
    }, token);
  } else {
    await loginViaUI(page, "admin");
  }
  await page.goto(`${baseUrl}/workspace/tools/clinic`, { waitUntil: "load" });
  await expect(page).toHaveURL(/\/workspace\/tools\/clinic/);
  await expect(page.locator("#clinic-paste-ta")).toBeVisible({ timeout: 30_000 });
}

async function openScoreClinicPreviewWithLocalStubs(page: Page) {
  const baseUrl = getBaseUrl("admin");
  test.skip(!isLocalBaseUrl(baseUrl), "성적탭 API stub 검증은 로컬 dev 서버 전용");

  const token = createLocalJwt();
  await page.route("**/version.json?*", async (route) => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "" });
  });
  const corsHeaders = {
    "access-control-allow-origin": baseUrl,
    "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
  };
  const scoreRows = [
    {
      enrollment_id: 9101,
      student_id: 9101,
      student_name: "이예리",
      exams: [
        {
          exam_id: 3101,
          title: "주간평가",
          pass_score: 70,
          block: {
            score: 50,
            max_score: 100,
            passed: false,
            clinic_required: false,
            is_locked: false,
            lock_reason: null,
            objective_score: 50,
            subjective_score: 0,
            remediated: null,
            final_pass: false,
            achievement: "FAIL",
            meta: null,
          },
          items: [],
          attempt_count: 1,
          clinic_link_id: null,
          attempts: [],
        },
      ],
      homeworks: [
        {
          homework_id: 4101,
          title: "오늘 과제",
          block: {
            score: null,
            max_score: 100,
            passed: false,
            clinic_required: false,
            is_locked: false,
            lock_reason: null,
            meta: { status: "NOT_SUBMITTED" },
          },
          attempt_count: 1,
          clinic_link_id: null,
        },
      ],
      updated_at: new Date().toISOString(),
      clinic_required: false,
      progress_completed: true,
      progress_status: "completed",
      name_highlight_clinic_target: false,
    },
    {
      enrollment_id: 9102,
      student_id: 9102,
      student_name: "박보강",
      exams: [
        {
          exam_id: 3101,
          title: "주간평가",
          pass_score: 70,
          block: {
            score: 55,
            max_score: 100,
            passed: false,
            clinic_required: false,
            is_locked: false,
            lock_reason: null,
            objective_score: 55,
            subjective_score: 0,
            remediated: true,
            final_pass: true,
            achievement: "REMEDIATED",
            meta: null,
          },
          items: [],
          attempt_count: 2,
          clinic_link_id: null,
          attempts: [],
        },
      ],
      homeworks: [],
      updated_at: new Date().toISOString(),
      clinic_required: false,
      progress_completed: false,
      progress_status: "in_progress",
      name_highlight_clinic_target: false,
    },
    {
      enrollment_id: 9103,
      student_id: 9103,
      student_name: "김미달",
      exams: [
        {
          exam_id: 3101,
          title: "주간평가",
          pass_score: 70,
          block: {
            score: 42,
            max_score: 100,
            passed: false,
            clinic_required: true,
            is_locked: false,
            lock_reason: null,
            objective_score: 42,
            subjective_score: 0,
            remediated: false,
            final_pass: false,
            achievement: "FAIL",
            meta: null,
          },
          items: [],
          attempt_count: 1,
          clinic_link_id: 7103,
          attempts: [],
        },
      ],
      homeworks: [],
      updated_at: new Date().toISOString(),
      clinic_required: true,
      progress_completed: false,
      progress_status: "in_progress",
      name_highlight_clinic_target: true,
    },
  ];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/token/refresh/")) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { access: token, refresh: `${token}-refresh` } });
      return;
    }
    if (pathname.endsWith("/core/program/")) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        json: { tenantCode: "hakwonplus", isPlatformAdmin: true, display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true },
      });
      return;
    }
    if (pathname.endsWith("/core/me/")) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        json: { id: 12, username: "t1_admin97", name: "관리자", is_staff: true, is_superuser: true, tenantRole: "admin", must_change_password: false },
      });
      return;
    }
    if (pathname.endsWith("/lectures/lectures/990001/")) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { id: 990001, title: "테스트 강의" } });
      return;
    }
    if (pathname.endsWith("/lectures/sessions/990002/")) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { id: 990002, lecture: 990001, order: 1, title: "1주차" } });
      return;
    }
    if (pathname.endsWith("/lectures/attendance/")) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        json: {
          count: 3,
          next: null,
          previous: null,
          page_size: 500,
          results: scoreRows.map((row, idx) => ({
            id: 8000 + idx,
            enrollment_id: row.enrollment_id,
            student_id: row.student_id,
            student_name: row.student_name,
            status: "PRESENT",
          })),
        },
      });
      return;
    }
    if (pathname.endsWith("/results/admin/sessions/990002/scores/")) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        json: {
          meta: {
            session_title: "1주차",
            lecture_title: "테스트 강의",
            lecture_id: 990001,
            exams: [{ exam_id: 3101, title: "주간평가", pass_score: 70, max_score: 100, display_order: 1, questions: [] }],
            homeworks: [{ homework_id: 4101, title: "오늘 과제", unit: null, max_score: 100, display_order: 1 }],
          },
          rows: scoreRows,
        },
      });
      return;
    }
    if (pathname.endsWith("/results/admin/sessions/990002/score-draft/")) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { changes: [] } });
      return;
    }
    if (pathname.endsWith("/results/admin/clinic-targets/") || pathname.endsWith("/staffs/currently-working/")) {
      await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: [] });
      return;
    }
    await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", json: { count: 0, next: null, previous: null, results: [] } });
  });
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, token);

  await page.goto(`${baseUrl}/workspace/lectures/990001/sessions/990002/scores`, { waitUntil: "load" });
  await expect(page.getByRole("button", { name: "성적 도구" })).toBeVisible({ timeout: 30_000 });
}

test.describe("클리닉 대상자 생성기 PDF 다운로드", () => {
  test("도구탭과 성적탭은 공통 출력 renderer를 공유한다", async () => {
    const [toolSource, rendererSource, moduleLoaderSource] = await Promise.all([
      readFile(path.resolve("src/app_admin/domains/tools/clinic/pages/ClinicPrintoutPage.tsx"), "utf8"),
      readFile(path.resolve("src/app_admin/domains/scores/utils/clinicPdfGenerator.ts"), "utf8"),
      readFile(path.resolve("src/shared/utils/pdfModules.ts"), "utf8"),
    ]);

    expect(rendererSource).toContain("export function buildClinicPrintHtml");
    expect(toolSource).toContain("buildClinicPrintHtml");
    expect(toolSource).not.toContain('<div class="header"');
    expect(toolSource).not.toContain('<div class="columns"');
    expect(toolSource).not.toContain('<div class="schedule-box"');
    expect(toolSource).not.toContain('class="name-row single');
    expect(moduleLoaderSource).toContain('import("html2canvas")');
    expect(moduleLoaderSource).toContain('import("jspdf")');
    expect(moduleLoaderSource).not.toContain("cdn.jsdelivr.net");
  });

  test("생성기 작업 흐름이 1366px과 1100px에서 겹치거나 잘리지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await openClinicTool(page);
    await page.locator("#clinic-paste-ta").fill([
      "시험+과제: 김민준, 이서연",
      "시험: 박도윤",
      "과제: 최하은, 정시우",
    ].join("\n"));
    await page.getByRole("button", { name: "명단 만들기", exact: true }).click();

    await expect(page.getByRole("heading", { name: "클리닉 대상자 명단 만들기", exact: true })).toBeVisible();
    await expect(page.getByText("5명 명단 준비됨", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "PDF 다운로드", exact: true })).toBeEnabled();
    await expect(page.frameLocator("#cprev").locator(".name-text").filter({ hasText: "김민준" })).toBeVisible();

    const inspectLayout = () => page.evaluate(() => {
      const preview = document.querySelector<HTMLElement>("[aria-labelledby='clinic-preview-heading']");
      const editor = document.querySelector<HTMLElement>("[aria-label='명단 만들기 설정']");
      const workspace = preview?.parentElement;
      const root = workspace?.parentElement;
      const hero = root?.querySelector<HTMLElement>("header");
      const metrics = document.querySelector<HTMLElement>("[aria-label='현재 분류 결과']");
      const scaleBox = preview?.querySelector<HTMLElement>("iframe")?.parentElement?.parentElement;
      const canvas = scaleBox?.parentElement;
      const previewRect = preview?.getBoundingClientRect();
      const editorRect = editor?.getBoundingClientRect();
      const rootRect = root?.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect();
      const scaleBoxRect = scaleBox?.getBoundingClientRect();
      const editorPanels = editor
        ? Array.from(editor.children).map((element) => (element as HTMLElement).getBoundingClientRect())
        : [];
      const visibleMetricRects = metrics
        ? Array.from(metrics.children)
          .map((element) => (element as HTMLElement).getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0)
        : [];
      const insideRoot = (rect: DOMRect) => !!rootRect
        && rect.left >= rootRect.left - 1
        && rect.right <= rootRect.right + 1;
      const hasHorizontalOverflow = (element: Element | null | undefined) => {
        if (!(element instanceof HTMLElement)) return true;
        return element.scrollWidth > element.clientWidth + 1;
      };
      return {
        previewWidth: previewRect?.width ?? 0,
        editorWidth: editorRect?.width ?? 0,
        rootWidth: rootRect?.width ?? 0,
        coreInsideRoot: [hero?.getBoundingClientRect(), workspace?.getBoundingClientRect(), previewRect, editorRect]
          .filter((rect): rect is DOMRect => rect != null)
          .every(insideRoot),
        metricsInsideRoot: visibleMetricRects.every(insideRoot),
        panelsInsideRoot: editorPanels.every(insideRoot),
        hasHorizontalOverflow: [root, hero, metrics, workspace, editor, ...Array.from(editor?.children ?? [])]
          .some(hasHorizontalOverflow),
        scaleBoxInsideCanvas: !!canvasRect && !!scaleBoxRect
          && scaleBoxRect.left >= canvasRect.left - 1
          && scaleBoxRect.right <= canvasRect.right + 1,
        editorIsSingleColumn: editorPanels.length < 2
          || Math.abs(editorPanels[0].left - editorPanels[1].left) <= 1,
        overlaps: !!previewRect && !!editorRect && !(
          previewRect.right <= editorRect.left ||
          editorRect.right <= previewRect.left ||
          previewRect.bottom <= editorRect.top ||
          editorRect.bottom <= previewRect.top
        ),
      };
    });

    await mkdir("e2e-out", { recursive: true });
    const layout1366 = await inspectLayout();
    expect(layout1366.previewWidth).toBeGreaterThan(600);
    expect(layout1366.editorWidth).toBeGreaterThan(600);
    expect(layout1366.coreInsideRoot).toBe(true);
    expect(layout1366.metricsInsideRoot).toBe(true);
    expect(layout1366.panelsInsideRoot).toBe(true);
    expect(layout1366.hasHorizontalOverflow).toBe(false);
    expect(layout1366.scaleBoxInsideCanvas).toBe(true);
    expect(layout1366.editorIsSingleColumn).toBe(true);
    expect(layout1366.overlaps).toBe(false);
    await page.screenshot({ path: `e2e-out/clinic-generator-1366-${TS}.png`, fullPage: true });

    await page.setViewportSize({ width: 1100, height: 900 });
    const layout1100 = await inspectLayout();
    expect(layout1100.previewWidth).toBeGreaterThan(500);
    expect(layout1100.editorWidth).toBeGreaterThan(500);
    expect(layout1100.coreInsideRoot).toBe(true);
    expect(layout1100.metricsInsideRoot).toBe(true);
    expect(layout1100.panelsInsideRoot).toBe(true);
    expect(layout1100.hasHorizontalOverflow).toBe(false);
    expect(layout1100.scaleBoxInsideCanvas).toBe(true);
    expect(layout1100.editorIsSingleColumn).toBe(true);
    expect(layout1100.overlaps).toBe(false);
    await page.screenshot({ path: `e2e-out/clinic-generator-1100-${TS}.png`, fullPage: true });
  });

  test("게시용 명단에서 분류를 구분하고 짧은 이름을 크게 보여준다", async ({ page }) => {
    await openClinicTool(page);

    const makeNames = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`);
    const bothNames = makeNames("양민준", 48);
    const examNames = makeNames("김서연", 44);
    const hwNames = makeNames("박도윤", 40);
    const allNames = [...bothNames, ...examNames, ...hwNames];
    await page.locator("#clinic-paste-ta").fill([
      `시험+과제: ${bothNames.join(", ")}`,
      `시험: ${examNames.join(", ")}`,
      `과제: ${hwNames.join(", ")}`,
    ].join("\n"));
    await page.getByRole("button", { name: "명단 만들기", exact: true }).click();

    const frame = page.frameLocator("#cprev");
    await expect(frame.locator(".name-text").filter({ hasText: bothNames[0] }).first()).toBeVisible({ timeout: 8000 });
    const visibility = await frame.locator(".page").evaluate((node, expectedNames) => {
      const pageEl = node as HTMLElement;
      const clipped = Array.from(pageEl.querySelectorAll(".name-text"))
        .filter((textNode) => expectedNames.includes((textNode.textContent || "").trim()))
        .filter((textNode) => {
          const el = textNode as HTMLElement;
          const cs = getComputedStyle(el);
          const textRect = el.getBoundingClientRect();
          const rowRect = (el.closest(".name-row.single, .name-cell") as HTMLElement | null)?.getBoundingClientRect() ?? textRect;
          const range = document.createRange();
          range.selectNodeContents(el);
          const lineRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
          range.detach();
          const lineOutsideBox = lineRects.some((rect) =>
            rect.left < textRect.left - 1 ||
            rect.right > textRect.right + 1 ||
            rect.top < rowRect.top - 1 ||
            rect.bottom > rowRect.bottom + 1
          );
          return (
            cs.overflow === "hidden" ||
            cs.textOverflow === "ellipsis" ||
            cs.whiteSpace === "nowrap" ||
            lineOutsideBox
          );
        });
      const firstCell = pageEl.querySelector(".name-cell") as HTMLElement | null;
      const alignmentRows = Array.from(pageEl.querySelectorAll<HTMLElement>(".name-row.single, .name-cell"))
        .filter((row) => row.querySelector(".name-text")?.textContent?.trim());
      const alignmentMetrics = alignmentRows.map((row) => {
        const checkbox = row.querySelector<HTMLElement>(".checkbox");
        const text = row.querySelector<HTMLElement>(".name-text");
        if (!checkbox || !text) return null;
        const checkboxRect = checkbox.getBoundingClientRect();
        const textRect = text.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(text);
        const lineRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
        range.detach();
        return {
          centerDelta: Math.abs(
            checkboxRect.top + checkboxRect.height / 2 - (textRect.top + textRect.height / 2),
          ),
          gap: textRect.left - checkboxRect.right,
          minLineLeftGap: Math.min(...lineRects.map((rect) => rect.left - checkboxRect.right)),
          maxLineRightOverflow: Math.max(...lineRects.map((rect) => rect.right - textRect.right)),
        };
      }).filter((metric): metric is { centerDelta: number; gap: number; minLineLeftGap: number; maxLineRightOverflow: number } => metric != null);
      const sectionBackgrounds = [
        ".section-header.both",
        ".section-header.exam",
        ".section-header.hw",
      ].flatMap((selector) => {
        const el = pageEl.querySelector(selector) as HTMLElement | null;
        if (!el) return [];
        return [getComputedStyle(el).backgroundColor];
      });
      return {
        pageClass: pageEl.className,
        nameCount: pageEl.querySelectorAll(".name-text").length,
        pairedNameCount: pageEl.querySelectorAll(".name-cell .name-text").length,
        nameCellFontSize: firstCell ? parseFloat(getComputedStyle(firstCell).fontSize) : 0,
        alignment: {
          rowCount: alignmentMetrics.length,
          maxCenterDelta: Math.max(0, ...alignmentMetrics.map((metric) => metric.centerDelta)),
          maxGap: Math.max(0, ...alignmentMetrics.map((metric) => metric.gap)),
          minGap: Math.min(...alignmentMetrics.map((metric) => metric.gap)),
          minLineLeftGap: Math.min(...alignmentMetrics.map((metric) => metric.minLineLeftGap)),
          maxLineRightOverflow: Math.max(0, ...alignmentMetrics.map((metric) => metric.maxLineRightOverflow)),
        },
        distinctSectionBackgrounds: new Set(sectionBackgrounds).size,
        clippedCount: clipped.length,
      };
    }, allNames);

    expect(visibility.pageClass).toContain("page--dense");
    expect(visibility.nameCount).toBe(132);
    expect(visibility.pairedNameCount).toBe(132);
    expect(visibility.nameCellFontSize).toBeGreaterThanOrEqual(27);
    expect(visibility.alignment.rowCount).toBe(132);
    expect(visibility.alignment.maxCenterDelta).toBeLessThanOrEqual(1.5);
    expect(visibility.alignment.maxGap).toBeLessThanOrEqual(6);
    expect(visibility.alignment.minGap).toBeGreaterThanOrEqual(0);
    expect(visibility.alignment.minLineLeftGap).toBeGreaterThanOrEqual(0);
    expect(visibility.alignment.maxLineRightOverflow).toBeLessThanOrEqual(1);
    expect(visibility.distinctSectionBackgrounds).toBe(3);
    expect(visibility.clippedCount).toBe(0);
  });

  test("소수 인원 인쇄에서도 체크박스와 이름이 한 줄로 붙는다", async ({ page }) => {
    await openClinicTool(page);

    await page.locator("#clinic-paste-ta").fill([
      "시험+과제: 박철2, 박철3",
      "시험: 박철",
      "과제: 김민수, 김민수2",
    ].join("\n"));
    await page.getByRole("button", { name: "명단 만들기", exact: true }).click();

    const frame = page.frameLocator("#cprev");
    await expect(frame.locator(".name-text").filter({ hasText: "박철2" }).first()).toBeVisible({ timeout: 8000 });
    const alignment = await frame.locator(".page").evaluate((node) => {
      const pageEl = node as HTMLElement;
      const rows = Array.from(pageEl.querySelectorAll<HTMLElement>(".name-row.single, .name-cell"))
        .filter((row) => row.querySelector(".name-text")?.textContent?.trim());
      const metrics = rows.map((row) => {
        const checkbox = row.querySelector<HTMLElement>(".checkbox");
        const text = row.querySelector<HTMLElement>(".name-text");
        if (!checkbox || !text) return null;
        const checkboxRect = checkbox.getBoundingClientRect();
        const textRect = text.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(text);
        const lineRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
        range.detach();
        return {
          fontSize: parseFloat(getComputedStyle(row).fontSize),
          centerDelta: Math.abs(
            checkboxRect.top + checkboxRect.height / 2 - (textRect.top + textRect.height / 2),
          ),
          gap: textRect.left - checkboxRect.right,
          minLineLeftGap: Math.min(...lineRects.map((rect) => rect.left - checkboxRect.right)),
          maxLineRightOverflow: Math.max(...lineRects.map((rect) => rect.right - textRect.right)),
        };
      }).filter((metric): metric is { fontSize: number; centerDelta: number; gap: number; minLineLeftGap: number; maxLineRightOverflow: number } => metric != null);
      return {
        pageClass: pageEl.className,
        rowCount: metrics.length,
        minFontSize: Math.min(...metrics.map((metric) => metric.fontSize)),
        maxCenterDelta: Math.max(0, ...metrics.map((metric) => metric.centerDelta)),
        maxGap: Math.max(0, ...metrics.map((metric) => metric.gap)),
        minGap: Math.min(...metrics.map((metric) => metric.gap)),
        minLineLeftGap: Math.min(...metrics.map((metric) => metric.minLineLeftGap)),
        maxLineRightOverflow: Math.max(0, ...metrics.map((metric) => metric.maxLineRightOverflow)),
      };
    });

    expect(alignment.pageClass).toContain("page--comfortable");
    expect(alignment.rowCount).toBe(5);
    expect(alignment.minFontSize).toBeGreaterThanOrEqual(38);
    expect(alignment.maxCenterDelta).toBeLessThanOrEqual(1.5);
    expect(alignment.maxGap).toBeLessThanOrEqual(6);
    expect(alignment.minGap).toBeGreaterThanOrEqual(0);
    expect(alignment.minLineLeftGap).toBeGreaterThanOrEqual(0);
    expect(alignment.maxLineRightOverflow).toBeLessThanOrEqual(1);
  });

  test("성적탭 클리닉 미리보기는 완료 상태와 보강합격 학생을 제외한다", async ({ page }) => {
    await openScoreClinicPreviewWithLocalStubs(page);

    await page.getByRole("button", { name: "성적 도구" }).click();
    await page.locator("button").filter({ hasText: "클리닉 대상" }).first().click();

    const frame = page.frameLocator('iframe[title="클리닉 대상자 미리보기"]');
    await expect(frame.locator(".columns")).toContainText("김미달", { timeout: 10_000 });
    await expect(frame.locator(".columns")).not.toContainText("이예리");
    await expect(frame.locator(".columns")).not.toContainText("박보강");
    await expect(frame.locator(".footer-left")).toContainText("클리닉 대상 1명 / 전체 출석 3명");
  });

  test("긴 이름을 자르지 않고 실제 PDF를 내려받는다", async ({ page }) => {
    await openClinicTool(page);

    const longNames = Array.from({ length: 18 }, (_, i) =>
      `[E2E-${TS}]김가나다라마바사아자${String(i + 1).padStart(2, "0")}`,
    );
    await page.locator("#clinic-paste-ta").fill(`시험: ${longNames.join(", ")}`);
    await page.getByRole("button", { name: "명단 만들기", exact: true }).click();

    const frame = page.frameLocator("#cprev");
    await expect(frame.locator(".name-text").filter({ hasText: longNames[0] }).first()).toBeVisible({ timeout: 8000 });
    await expect(frame.locator("body")).toContainText(longNames[0]);
    await expect(frame.locator(".footer-left").first()).toContainText(`전체 출석 ${longNames.length}명`);
    const pageSizes = await frame.locator(".page").evaluateAll((nodes) => {
      return nodes.map((node) => {
        const pageEl = node as HTMLElement;
        const rect = pageEl.getBoundingClientRect();
        const scheduleRect = pageEl.querySelector(".schedule-box")?.getBoundingClientRect();
        const footerRect = pageEl.querySelector(".footer")?.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          ratio: rect.width / rect.height,
          scheduleInPage: !!scheduleRect && scheduleRect.top >= rect.top - 1 && scheduleRect.bottom <= rect.bottom + 1,
          footerInPage: !!footerRect && footerRect.top >= rect.top - 1 && footerRect.bottom <= rect.bottom + 1,
        };
      });
    });
    expect(pageSizes.length).toBeGreaterThan(1);
    for (const pageSize of pageSizes) {
      expect(pageSize.width).toBeGreaterThan(1100);
      expect(pageSize.height).toBeGreaterThan(1550);
      expect(pageSize.ratio).toBeCloseTo(297 / 420, 2);
      expect(pageSize.scheduleInPage).toBe(true);
      expect(pageSize.footerInPage).toBe(true);
    }

    const clipping = await frame.locator(".name-text").evaluateAll((nodes, expectedNames) => {
      return nodes
        .filter((node) => expectedNames.includes((node.textContent || "").trim()))
        .map((node) => {
          const el = node as HTMLElement;
          const cs = getComputedStyle(el);
          const textRect = el.getBoundingClientRect();
          const rowRect = (el.closest(".name-row.single, .name-cell") as HTMLElement | null)?.getBoundingClientRect() ?? textRect;
          const range = document.createRange();
          range.selectNodeContents(el);
          const lineRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
          range.detach();
          const lineOutsideBox = lineRects.some((rect) =>
            rect.left < textRect.left - 1 ||
            rect.right > textRect.right + 1 ||
            rect.top < rowRect.top - 1 ||
            rect.bottom > rowRect.bottom + 1
          );
          return {
            text: el.textContent?.trim() || "",
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
            overflow: cs.overflow,
            textOverflow: cs.textOverflow,
            whiteSpace: cs.whiteSpace,
            lineOutsideBox,
          };
        })
        .filter((item) =>
          item.overflow === "hidden" ||
          item.textOverflow === "ellipsis" ||
          item.whiteSpace === "nowrap" ||
          item.lineOutsideBox
        );
    }, longNames);
    expect(clipping).toEqual([]);

    const wrapAlignment = await frame.locator(".name-row.single").evaluateAll((rows, expectedNames) => {
      const metrics = rows
        .filter((row) => expectedNames.includes((row.querySelector(".name-text")?.textContent || "").trim()))
        .map((row) => {
          const checkbox = row.querySelector<HTMLElement>(".checkbox");
          const text = row.querySelector<HTMLElement>(".name-text");
          if (!checkbox || !text) return null;
          const checkboxRect = checkbox.getBoundingClientRect();
          const textRect = text.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(text);
          const lineRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
          range.detach();
          return {
            fontSize: parseFloat(getComputedStyle(row as HTMLElement).fontSize),
            minLineLeftGap: Math.min(...lineRects.map((rect) => rect.left - checkboxRect.right)),
            maxLineRightOverflow: Math.max(0, ...lineRects.map((rect) => rect.right - textRect.right)),
          };
        })
        .filter((metric): metric is { fontSize: number; minLineLeftGap: number; maxLineRightOverflow: number } => metric != null);
      return {
        minFontSize: Math.min(...metrics.map((metric) => metric.fontSize)),
        minLineLeftGap: Math.min(...metrics.map((metric) => metric.minLineLeftGap)),
        maxLineRightOverflow: Math.max(0, ...metrics.map((metric) => metric.maxLineRightOverflow)),
      };
    }, longNames);
    expect(wrapAlignment.minFontSize).toBeGreaterThanOrEqual(20);
    expect(wrapAlignment.minLineLeftGap).toBeGreaterThanOrEqual(0);
    expect(wrapAlignment.maxLineRightOverflow).toBeLessThanOrEqual(1);

    await mkdir("e2e-out", { recursive: true });
    await frame.locator(".page").first().screenshot({ path: `e2e-out/clinic-pdf-long-names-${TS}.png` });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.getByRole("button", { name: "PDF 다운로드" }).click(),
    ]);
    const pdfPath = path.resolve("e2e-out", `clinic-pdf-long-names-${TS}.pdf`);
    await download.saveAs(pdfPath);

    const pdf = await readFile(pdfPath);
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
    expect(pdf.length).toBeLessThan(5_000_000);
  });

  test("84명과 100명을 여러 장에 모두 보존하고 일정 줄바꿈을 유지한다", async ({ page }) => {
    test.setTimeout(120_000);
    await openClinicTool(page);

    const makeNames = (count: number) =>
      Array.from({ length: count }, (_, index) => `대상${String(index + 1).padStart(3, "0")}`);
    const generateRoster = async (names: string[]) => {
      await page.locator("#clinic-paste-ta").fill(`시험: ${names.join(", ")}`);
      await page.getByRole("button", { name: "명단 만들기", exact: true }).click();
      await expect(page.frameLocator("#cprev").locator(".name-text").filter({ hasText: names[names.length - 1] }).first())
        .toBeVisible({ timeout: 10_000 });
    };
    const inspectPreview = async (expectedNames: string[]) => {
      const frame = page.frameLocator("#cprev");
      return frame.locator("body").evaluate((body, names) => {
        const pages = Array.from(body.querySelectorAll<HTMLElement>(".page"));
        const renderedNames = Array.from(body.querySelectorAll<HTMLElement>(".name-text"))
          .map((element) => element.textContent?.trim() || "");
        const exactCounts = names.map((name) => renderedNames.filter((rendered) => rendered === name).length);
        const contained = pages.every((pageEl) => {
          if (
            pageEl.scrollHeight > pageEl.clientHeight + 2
            || pageEl.scrollWidth > pageEl.clientWidth + 2
          ) {
            return false;
          }
          return Array.from(pageEl.querySelectorAll<HTMLElement>(".name-list")).every((list) => {
            if (list.scrollHeight > list.clientHeight + 2 || list.scrollWidth > list.clientWidth + 2) {
              return false;
            }
            const listRect = list.getBoundingClientRect();
            return Array.from(list.querySelectorAll<HTMLElement>(".name-row")).every((row) => {
              const rowRect = row.getBoundingClientRect();
              return rowRect.top >= listRect.top - 2 && rowRect.bottom <= listRect.bottom + 2;
            });
          });
        });
        return {
          pageCount: pages.length,
          declaredPageCount: Number(body.dataset.clinicPageCount),
          declaredStudentCount: Number(body.dataset.clinicStudentCount),
          renderedNames,
          exactCounts,
          contained,
          pageNumbers: pages.map((pageEl) => pageEl.querySelector(".page-number")?.textContent?.trim() || ""),
        };
      }, expectedNames);
    };

    const names84 = makeNames(84);
    await generateRoster(names84);
    const preview84 = await inspectPreview(names84);
    expect(preview84.pageCount).toBeGreaterThan(1);
    expect(preview84.pageCount).toBe(preview84.declaredPageCount);
    expect(preview84.declaredStudentCount).toBe(84);
    expect(preview84.renderedNames).toEqual(names84);
    expect(preview84.exactCounts.every((count) => count === 1)).toBe(true);
    expect(preview84.contained).toBe(true);

    const names100 = makeNames(100);
    await generateRoster(names100);
    const frame = page.frameLocator("#cprev");
    await frame.locator('[data-field="schedule"]').evaluate((element) => {
      (element as HTMLElement).focus();
      element.innerHTML = "<div>오후 7시까지 본관</div><div>오답노트 지참</div><div>지각하지 않기</div>";
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
      (element as HTMLElement).blur();
    });
    await expect(frame.locator(".schedule-content")).toHaveCount(2);
    const schedules = await frame.locator(".schedule-content").evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).innerText.replace(/\r\n?/g, "\n").trim()),
    );
    expect(schedules).toEqual([
      "오후 7시까지 본관\n오답노트 지참\n지각하지 않기",
      "오후 7시까지 본관\n오답노트 지참\n지각하지 않기",
    ]);

    const preview100 = await inspectPreview(names100);
    expect(preview100.pageCount).toBeGreaterThan(1);
    expect(preview100.pageCount).toBe(preview100.declaredPageCount);
    expect(preview100.declaredStudentCount).toBe(100);
    expect(preview100.renderedNames).toEqual(names100);
    expect(preview100.exactCounts.every((count) => count === 1)).toBe(true);
    expect(preview100.contained).toBe(true);
    expect(preview100.pageNumbers).toEqual(
      Array.from({ length: preview100.pageCount }, (_, index) => `${index + 1} / ${preview100.pageCount}쪽`),
    );

    const previewScaleHeight = await page.locator("#cprev").evaluate((iframe) =>
      (iframe.parentElement?.parentElement as HTMLElement | null)?.getBoundingClientRect().height ?? 0,
    );
    expect(previewScaleHeight).toBeGreaterThan(800);

    await mkdir("e2e-out", { recursive: true });
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.getByRole("button", { name: "PDF 다운로드" }).click(),
    ]);
    const pdfPath = path.resolve("e2e-out", `clinic-pdf-100-students-${TS}.pdf`);
    await download.saveAs(pdfPath);
    const pdfBytes = await readFile(pdfPath);
    expect(pdfBytes.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const pdf = await PDFDocument.load(pdfBytes);
    expect(pdf.getPageCount()).toBe(preview100.pageCount);
    for (const pdfPage of pdf.getPages()) {
      const { width, height } = pdfPage.getSize();
      expect(width).toBeCloseTo(841.89, 0);
      expect(height).toBeCloseTo(1190.55, 0);
      expect(width).toBeLessThan(height);
    }
  });
});

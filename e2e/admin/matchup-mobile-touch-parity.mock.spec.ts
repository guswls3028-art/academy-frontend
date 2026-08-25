import fs from "node:fs";
import type { Locator, Page, Route } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
const DOC_ID = 993_901;

function isLocalBase(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function fakeJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 }),
  ).toString("base64url");
  return `e30.${payload}.sig`;
}

const documentPayload = {
  id: DOC_ID,
  title: "[E2E] 모바일 직접 자르기",
  category: "[E2E]",
  subject: "수학",
  grade_level: "고1",
  original_name: "mobile-crop.pdf",
  size_bytes: 1_024,
  content_type: "application/pdf",
  status: "done",
  ai_job_id: "",
  problem_count: 0,
  error_message: "",
  inventory_file_id: 1,
  created_at: "2026-08-25T00:00:00Z",
  updated_at: "2026-08-25T00:00:00Z",
  meta: {
    source_type: "school_exam_pdf",
    upload_intent: "school_exam_pdf",
    indexable: true,
    paper_type_summary: {
      primary: "clean_pdf_single",
      distribution: { clean_pdf_single: 1 },
      low_confidence_ratio: 0,
      warnings: [],
    },
  },
};

const pageImage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1120"><rect width="800" height="1120" fill="white"/><text x="60" y="120" font-size="42">1. mobile crop fixture</text><rect x="55" y="160" width="690" height="260" fill="none" stroke="black" stroke-width="3"/></svg>',
)}`;

async function installMocks(page: Page, options: { failFirstPages?: boolean } = {}) {
  const apiRequests: Array<{ method: string; path: string }> = [];
  let pageReads = 0;
  let pageReadsAllowed = !options.failFirstPages;

  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", "hakwonplus");
    localStorage.setItem("matchup:tree-width:hakwonplus:user:41", "520");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { access: fakeJwt(), refresh: fakeJwt() });

  const json = (route: Route, body: unknown, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    apiRequests.push({ method: request.method(), path });

    if (path === "/core/program/") {
      return json(route, {
        tenantCode: "hakwonplus",
        display_name: "모바일 패리티 학원",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json(route, {
        id: 41,
        username: "e2e-owner",
        name: "E2E 원장",
        phone: null,
        is_staff: true,
        is_superuser: false,
        tenantRole: "owner",
        must_change_password: false,
      });
    }
    if (path === "/staffs/me/") {
      return json(route, {
        is_authenticated: true,
        is_superuser: false,
        is_staff: true,
        is_owner: true,
        is_payroll_manager: false,
        staff_id: 41,
        assigned_work_types: [],
      });
    }
    if (path === "/matchup/documents/" && request.method() === "GET") {
      return json(route, [documentPayload]);
    }
    if (path === "/matchup/problems/" && request.method() === "GET") {
      return json(route, []);
    }
    if (path === `/matchup/documents/${DOC_ID}/pages/` && request.method() === "GET") {
      pageReads += 1;
      if (!pageReadsAllowed) {
        return json(route, { detail: "temporary fixture error" }, 503);
      }
      return json(route, {
        doc_id: DOC_ID,
        is_pdf: true,
        page_count: 1,
        pages: [{ index: 0, url: pageImage, width: 800, height: 1_120 }],
      });
    }
    if (path === `/matchup/documents/${DOC_ID}/manual-crop/` && request.method() === "POST") {
      return json(route, {
        id: 993_902,
        document_id: DOC_ID,
        number: 1,
        text: "",
        image_key: "e2e/manual-crop.png",
        meta: { manual: true, page_index: 0, bbox_norm: [0.1, 0.1, 0.5, 0.25] },
        created_at: "2026-08-25T00:00:00Z",
      });
    }
    if (path === "/matchup/categories/") return json(route, []);
    if (path === "/matchup/hit-reports/board-preview/") {
      return json(route, { reports: [], total_published: 0 });
    }
    if (path === "/results/admin/clinic-targets/") return json(route, []);
    if (path === `/matchup/documents/${DOC_ID}/hit-report-draft/`) {
      return json(route, { report: null, entries: [] });
    }
    return json(route, { count: 0, results: [] });
  });

  return {
    apiRequests,
    getPageReads: () => pageReads,
    allowPageReads: () => { pageReadsAllowed = true; },
  };
}

async function openCropModal(page: Page) {
  await page.goto(`${BASE}/workspace/storage/matchup?docId=${DOC_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("matchup-doc-manual-crop-btn")).toBeVisible();
  await page.getByTestId("matchup-doc-manual-crop-btn").click();
  await expect(page.getByTestId("matchup-manual-crop-modal")).toBeVisible();
}

async function expectNoDocumentOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth <= window.innerWidth,
    root: document.documentElement.scrollWidth <= window.innerWidth,
  }))).toEqual({ body: true, root: true });
}

async function drawTouchBox(canvas: Locator) {
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(300);
  if (!box) throw new Error("crop canvas has no bounding box");
  await canvas.evaluate((element, rect) => {
    element.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
      isPrimary: true,
      clientX: rect.x + rect.width * 0.12,
      clientY: rect.y + rect.height * 0.12,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
      isPrimary: true,
      clientX: rect.x + rect.width * 0.68,
      clientY: rect.y + rect.height * 0.38,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      pointerType: "touch",
      pointerId: 7,
      isPrimary: true,
      clientX: rect.x + rect.width * 0.68,
      clientY: rect.y + rect.height * 0.38,
    }));
  }, box);
  await expect(canvas.page().getByTestId("matchup-crop-draft")).toBeVisible();
}

test.use({ serviceWorkers: "block" });
test.skip(!isLocalBase(BASE), "Local route-mock spec. Set E2E_BASE_URL to localhost to run.");

test("390px: persisted desktop tree width cannot crop the canonical matchup workflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installMocks(page);
  await page.goto(`${BASE}/workspace/storage/matchup?docId=${DOC_ID}`, { waitUntil: "domcontentloaded" });

  const tree = page.getByTestId("matchup-doc-tree");
  await expect(tree).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("matchup:tree-width:hakwonplus:user:41"),
  )).toBe("520");
  await expect.poll(() => tree.evaluate((element) => element.style.width)).toBe("100%");
  await expect.poll(async () => (await tree.boundingBox())?.width ?? 0).toBeLessThanOrEqual(366);
  await expectNoDocumentOverflow(page);
});

test("390px: page, touch crop, number, save stack in order and preserve unsaved work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { apiRequests } = await installMocks(page);
  await openCropModal(page);

  const modal = page.getByTestId("matchup-manual-crop-modal");
  await expect(modal).toHaveAttribute("data-layout", "mobile-stacked");
  const closeButton = page.getByRole("button", { name: "직접 자르기 닫기" });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);

  const pageRail = page.getByTestId("matchup-crop-page-rail");
  const canvas = page.getByTestId("matchup-crop-canvas");
  const inspector = page.getByTestId("matchup-crop-inspector");
  const order = await page.evaluate(() => {
    const rail = document.querySelector('[data-testid="matchup-crop-page-rail"]');
    const crop = document.querySelector('[data-testid="matchup-crop-canvas"]');
    const panel = document.querySelector('[data-testid="matchup-crop-inspector"]');
    return [rail, crop, panel].map((node) => node?.getBoundingClientRect().top ?? -1);
  });
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);
  await expect(pageRail).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(inspector).toBeVisible();

  await drawTouchBox(canvas);

  await closeButton.click();
  await expect(page.getByRole("alertdialog", { name: "작업을 닫을까요?" })).toBeVisible();
  await page.getByRole("button", { name: "계속 작업" }).click();
  await expect(page.getByTestId("matchup-crop-draft")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("matchup-crop-draft")).toHaveCount(0);
  await expect(modal).toBeVisible();

  await drawTouchBox(canvas);

  await page.getByTestId("matchup-crop-number-input").fill("1");
  await page.getByTestId("matchup-crop-save-btn").click();
  await expect(page.getByTestId("matchup-crop-problem-row")).toHaveCount(1);
  const productMutations = apiRequests.filter(({ method, path }) => (
    method !== "GET"
    && path !== "/matchup/problems/presign/"
    && !/^\/matchup\/problems\/\d+\/similar\/$/.test(path)
  ));
  expect(productMutations).toEqual([
    { method: "POST", path: `/matchup/documents/${DOC_ID}/manual-crop/` },
  ]);
  await expectNoDocumentOverflow(page);
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(page.getByTestId("matchup-doc-manual-crop-btn")).toBeFocused();
});

test("390px: page load failure has an explicit retry without a product mutation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { apiRequests, getPageReads, allowPageReads } = await installMocks(page, { failFirstPages: true });
  await openCropModal(page);

  await expect(page.getByText("페이지 로드 실패")).toBeVisible();
  allowPageReads();
  await page.getByRole("button", { name: "페이지 다시 불러오기" }).click();
  await expect(page.getByTestId("matchup-crop-canvas")).toBeVisible();
  expect(getPageReads()).toBeGreaterThanOrEqual(2);
  expect(apiRequests.filter(({ method }) => method !== "GET")).toEqual([]);
});

test("1366px: existing three-column crop contract remains intact", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await installMocks(page);
  await openCropModal(page);

  const modal = page.getByTestId("matchup-manual-crop-modal");
  await expect(modal).toHaveAttribute("data-layout", "desktop-3-column");
  const widths = await page.evaluate(() => ({
    rail: document.querySelector('[data-testid="matchup-crop-page-rail"]')?.getBoundingClientRect().width ?? 0,
    inspector: document.querySelector('[data-testid="matchup-crop-inspector"]')?.getBoundingClientRect().width ?? 0,
  }));
  expect(widths.rail).toBe(110);
  expect(widths.inspector).toBe(280);
  await expectNoDocumentOverflow(page);
});

test("mobile storage copy no longer presents matchup as PC-only", () => {
  const source = fs.readFileSync(
    "src/app_teacher/domains/storage/pages/MyStoragePage.tsx",
    "utf8",
  );
  expect(source).not.toContain("매치업은 PC 전용");
  expect(source).not.toContain("PC에서 진행합니다");
  expect(source).not.toContain("PC에서 매치업 열기");
});

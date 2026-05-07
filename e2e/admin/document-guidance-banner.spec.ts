/**
 * Stage 6.7-policy P0 — DocumentGuidanceBanner mock-route smoke.
 *
 * paper_type primary + processing_quality + indexable 조합 별 안내 배너 렌더 검증.
 * 운영 데이터 미접촉 — page.route 로 doc 메타 mock.
 *
 * 검증 시나리오:
 *  1) clean_pdf_dual + precise_split + indexable=true → success 톤 1줄
 *  2) student_answer_photo + page_fallback + indexable=false → warning 다수
 *  3) scan_dual + coarse_split → warning 1 + info 1
 *  4) unknown + needs_review → warning 다수
 *  5) explanation/answer_key (non_question) + indexable=false → neutral
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";
import type { Route } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API_BASE = process.env.E2E_API_URL || "https://api.hakwonplus.com";

type DocSpec = {
  id: number;
  title: string;
  paper_type: string;
  processing_quality?: string;
  indexable?: boolean;
  bbox_null_ratio?: number;
};

const SPECS: Record<string, DocSpec> = {
  clean_dual_precise: {
    id: 990001, title: "[E2E] clean_pdf_dual precise",
    paper_type: "clean_pdf_dual", processing_quality: "precise_split",
    indexable: true, bbox_null_ratio: 0.0,
  },
  sap_page_fallback: {
    id: 990002, title: "[E2E] student_answer_photo page_fallback",
    paper_type: "student_answer_photo", processing_quality: "page_fallback",
    indexable: false, bbox_null_ratio: 0.85,
  },
  scan_dual_coarse: {
    id: 990003, title: "[E2E] scan_dual coarse_split",
    paper_type: "scan_dual", processing_quality: "coarse_split",
    indexable: true, bbox_null_ratio: 0.4,
  },
  unknown_needs_review: {
    id: 990004, title: "[E2E] unknown needs_review",
    paper_type: "unknown", processing_quality: "needs_review",
    indexable: false, bbox_null_ratio: 0.6,
  },
  non_question_indexable_false: {
    id: 990005, title: "[E2E] non_question (해설지)",
    paper_type: "non_question", processing_quality: "no_problems",
    indexable: false, bbox_null_ratio: undefined,
  },
};

function buildDocPayload(spec: DocSpec) {
  return {
    id: spec.id,
    title: spec.title,
    category: "[E2E] guidance",
    subject: "test",
    grade_level: "test",
    original_name: `${spec.title}.pdf`,
    size_bytes: 1024,
    content_type: "application/pdf",
    status: "done",
    ai_job_id: "test-job",
    problem_count: 1,
    error_message: "",
    inventory_file_id: 1,
    created_at: "2026-05-08T00:00:00Z",
    updated_at: "2026-05-08T00:00:00Z",
    meta: {
      paper_type_summary: {
        primary: spec.paper_type,
        distribution: { [spec.paper_type]: 1 },
        low_confidence_ratio: 0,
        warnings: [],
      },
      processing_quality: spec.processing_quality,
      indexable: spec.indexable,
      ...(spec.bbox_null_ratio !== undefined ? { bbox_null_ratio: spec.bbox_null_ratio } : {}),
    },
  };
}

async function mockDocRoutes(page: import("@playwright/test").Page, spec: DocSpec) {
  const payload = buildDocPayload(spec);
  await page.route(`${API_BASE}/api/v1/matchup/documents/`, async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify([payload]),
      });
      return;
    }
    await route.continue();
  });
  await page.route(`${API_BASE}/api/v1/matchup/problems/**`, async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  await page.route(`${API_BASE}/api/v1/matchup/categories/`, async (route: Route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify([{ name: "[E2E] guidance", total: 1, tests: 0, references: 1 }]),
    });
  });
}

async function selectDoc(page: import("@playwright/test").Page, docId: number) {
  await page.goto(`${BASE}/admin/storage/matchup?docId=${docId}`, { waitUntil: "networkidle" });
  // wait until banner mounts
  await page.waitForSelector("[data-testid='document-guidance-banner']", { timeout: 15000 });
}

test.describe("DocumentGuidanceBanner — paper_type + quality + indexable", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("clean_pdf_dual + precise_split + indexable=true → success tone (single line)", async ({ page }) => {
    const spec = SPECS.clean_dual_precise;
    await mockDocRoutes(page, spec);
    await selectDoc(page, spec.id);
    const banner = page.getByTestId("document-guidance-banner");
    await expect(banner).toHaveAttribute("data-paper-type", "clean_pdf_dual");
    await expect(banner).toHaveAttribute("data-quality", "precise_split");
    await expect(banner).toHaveAttribute("data-indexable", "true");
    // success row 1개 표시 (paper_type + precise_split 중복 제거 정책)
    await expect(banner.getByTestId("document-guidance-success")).toHaveCount(1);
    // 빨간색 (warning/danger) 표시 X
    await expect(banner.getByTestId("document-guidance-warning")).toHaveCount(0);
    await expect(banner).toContainText("자동 문항분리를 사용할 수 있습니다");
  });

  test("student_answer_photo + page_fallback + indexable=false → warning + neutral", async ({ page }) => {
    const spec = SPECS.sap_page_fallback;
    await mockDocRoutes(page, spec);
    await selectDoc(page, spec.id);
    const banner = page.getByTestId("document-guidance-banner");
    await expect(banner).toHaveAttribute("data-paper-type", "student_answer_photo");
    await expect(banner).toHaveAttribute("data-quality", "page_fallback");
    await expect(banner).toHaveAttribute("data-indexable", "false");
    // 학원장에게 manual 우선 권장 + indexable=false 명시
    await expect(banner).toContainText("학생 답안지/폰사진");
    await expect(banner).toContainText("수동 자르기를 권장");
    await expect(banner).toContainText("매치업 검색·비교 풀에서 제외된 상태");
    // warning row 2개 (paper_type + quality)
    const warnings = banner.getByTestId("document-guidance-warning");
    await expect(warnings).toHaveCount(2);
    // success row 0개
    await expect(banner.getByTestId("document-guidance-success")).toHaveCount(0);
  });

  test("scan_dual + coarse_split → warning + info", async ({ page }) => {
    const spec = SPECS.scan_dual_coarse;
    await mockDocRoutes(page, spec);
    await selectDoc(page, spec.id);
    const banner = page.getByTestId("document-guidance-banner");
    await expect(banner).toHaveAttribute("data-paper-type", "scan_dual");
    await expect(banner).toHaveAttribute("data-quality", "coarse_split");
    await expect(banner).toContainText("스캔본 2단형");
    await expect(banner).toContainText("일부 문항 경계가 넓을 수 있습니다");
    await expect(banner.getByTestId("document-guidance-warning")).toHaveCount(1);
    await expect(banner.getByTestId("document-guidance-info")).toHaveCount(1);
  });

  test("unknown + needs_review + indexable=false → warning 다수", async ({ page }) => {
    const spec = SPECS.unknown_needs_review;
    await mockDocRoutes(page, spec);
    await selectDoc(page, spec.id);
    const banner = page.getByTestId("document-guidance-banner");
    await expect(banner).toContainText("자료 유형을 확정하지 못했습니다");
    await expect(banner).toContainText("검수가 필요한 자동분리 결과");
    await expect(banner).toContainText("매치업 검색·비교 풀에서 제외된 상태");
  });

  test("non_question + no_problems + indexable=false → neutral 톤", async ({ page }) => {
    const spec = SPECS.non_question_indexable_false;
    await mockDocRoutes(page, spec);
    await selectDoc(page, spec.id);
    const banner = page.getByTestId("document-guidance-banner");
    await expect(banner).toContainText("표지·정답지·해설지");
    await expect(banner).toContainText("매치업 검색·비교 풀에서 제외된 상태");
    // error 톤 0
    await expect(banner.getByTestId("document-guidance-warning")).toHaveCount(1);  // no_problems quality → warning
  });

  test("status=done + paper_type 없을 때는 안 띄움", async ({ page }) => {
    const spec: DocSpec = {
      id: 990010, title: "[E2E] no meta",
      paper_type: "", processing_quality: undefined, indexable: undefined,
    };
    const payload = {
      ...buildDocPayload(spec),
      meta: {},  // override — guidance 없음
    };
    await page.route(`${API_BASE}/api/v1/matchup/documents/`, async (route: Route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify([payload]),
        });
        return;
      }
      await route.continue();
    });
    await page.route(`${API_BASE}/api/v1/matchup/problems/**`, async (route: Route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
    await page.route(`${API_BASE}/api/v1/matchup/categories/`, async (route: Route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
    await page.goto(`${BASE}/admin/storage/matchup?docId=${spec.id}`, { waitUntil: "networkidle" });
    // banner 자체가 mount 안 됨
    await expect(page.getByTestId("document-guidance-banner")).toHaveCount(0);
  });
});

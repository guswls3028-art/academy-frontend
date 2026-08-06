import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/strictTest";

const BASE = process.env.E2E_LOCAL_BASE_URL || "http://127.0.0.1:5174";

const snapshot = {
  schema_version: "problem-review-report/v1",
  metadata: {
    title: "2026 언남고 1학기 중간고사 생명과학 문제 분석",
    school: "언남고등학교",
    subject: "생명과학",
    grade: "2학년",
    exam_name: "2026학년도 1학기 중간고사",
  },
  summary: {
    one_line: "자료 해석과 개념 연결을 함께 확인한 시험입니다.",
    character: "핵심 개념을 알고도 표와 조건을 끝까지 연결해야 해결할 수 있는 문항이 고르게 배치되었습니다.",
    total_questions: 25,
    total_points: "100점",
    student_burden: "후반부 복합 자료 문항과 서술형에서 체감 부담이 높았습니다.",
  },
  assessment_axes: [
    { title: "자료 해석", description: "표와 실험 조건에서 필요한 근거를 골라냅니다." },
    { title: "개념 연결", description: "세포와 유전 단원의 개념을 함께 적용합니다." },
  ],
  domains: [
    { name: "세포와 물질대사", question_numbers: ["1", "2", "3"], points: "30점", ratio: "30%", insight: "기본 개념과 적용을 함께 확인했습니다." },
    { name: "유전", question_numbers: ["18", "19", "20"], points: "35점", ratio: "35%", insight: "조건 조합과 확률 해석이 변별을 만들었습니다." },
  ],
  difficulty: {
    distribution: [
      { label: "중", question_numbers: ["1", "2"], points: "40점", note: "개념 확인" },
      { label: "상", question_numbers: ["19", "20"], points: "25점", note: "복합 적용" },
    ],
    grade_estimate_note: "실제 등급 컷은 학교 성적 발표 후 확인이 필요합니다.",
  },
  questions: [
    { number: 1, unit: "세포", answer: "③", points: "4점", difficulty: "중", key_point: "세포 소기관의 기능을 구분합니다.", trap: "구조와 기능을 뒤바꾸기 쉽습니다." },
    { number: 20, unit: "유전", answer: "⑤", points: "5점", difficulty: "상", key_point: "가계도 조건을 순서대로 결합합니다.", trap: "한 조건만으로 유전자형을 확정하기 쉽습니다." },
  ],
  key_items: [
    { rank: 1, title: "가계도 복합 추론", question_numbers: ["20"], reason: "여러 조건을 동시에 적용해야 합니다.", collapse_point: "첫 조건만 보고 유전자형을 확정합니다.", prescription: "조건마다 가능한 경우를 표로 지웁니다." },
  ],
  failure_patterns: [],
  parent_guidance: { avoid: [], recommended: ["조건을 표로 구조화하는 연습이 필요합니다."] },
  conclusion: { headline: "조건을 구조화하는 연습이 다음 시험의 변별 문항을 바꿉니다.", actions: ["복합 조건 표시하기", "오답 선지 근거 쓰기"] },
};

const card = {
  id: 71,
  title: snapshot.metadata.title,
  description: snapshot.summary.one_line,
  status: "published",
  published_at: "2026-08-06T06:00:00+09:00",
  snapshot_at: "2026-08-06T06:00:00+09:00",
  view_count: 12,
  pdf_url: "/api/v1/landing-public/problem-review-showcase/71/pdf/?tenant=tchul",
  metadata: snapshot.metadata,
  summary: snapshot.summary,
  difficulty: snapshot.difficulty,
};

async function installRoutes(page: Page) {
  await page.addInitScript(() => localStorage.setItem("tenant_code", "tchul"));
  await page.route("**/api/v1/core/program/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ tenantCode: "tchul", display_name: "박철 과학", feature_flags: {}, is_active: true }),
  }));
  await page.route("**/api/v1/core/landing/public/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      has_landing: true,
      template_key: "premium_dark",
      config: {
        brand_name: "박철 과학",
        template_key: "premium_dark",
        tagline: "통합과학을 더 분명하게",
        subtitle: "학교별 시험 흐름을 읽고 다음 수업으로 연결합니다.",
        cta_text: "수강 문의",
        cta_link: "#contact",
        contact: { inquiries: [{ label: "두각학원", phone: "02-556-1988" }] },
        sections: [{ type: "hit_reports", enabled: true, order: 1, items: [] }],
      },
    }),
  }));
  await page.route("**/api/v1/landing-public/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/problem-review-showcase/71/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...card, snapshot }) });
    }
    if (path.endsWith("/problem-review-showcase/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: 1, results: [card] }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ count: 0, results: [] }) });
  });
  await page.route("**/api/v1/matchup/landing/public/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ reports: [] }),
  }));
}

test("홈 시험 분석 카드에서 네이티브 리포트로 이어지고 390px에서도 넘치지 않는다", async ({ page }, testInfo) => {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 검증 전용");
  await installRoutes(page);

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}/landing`, { waitUntil: "load", timeout: 75_000 });
  await expect(page.getByRole("heading", { name: /시험이 끝나면/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /언남고.*중간고사.*문제 분석/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("problem-analysis-home-1366.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "load", timeout: 75_000 });
  await expect(page.getByRole("heading", { name: /시험이 끝나면/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("problem-analysis-home-390.png"), fullPage: true });

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}/landing/analysis/71`, { waitUntil: "load", timeout: 75_000 });
  await expect(page.getByRole("heading", { name: snapshot.metadata.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "전 문항 근거표" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "점수는 어디에서 갈렸나" })).toBeVisible();
  await expect(page.getByText(/실제 정답률과 학교 성적 분포가 없는 항목/)).toBeVisible();
  await expect(page.getByText("가계도 복합 추론")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /분석 PDF 전체본/ })).toHaveAttribute("href", /problem-review-showcase\/71\/pdf/);
  await page.screenshot({ path: testInfo.outputPath("problem-analysis-detail-1366.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "load", timeout: 75_000 });
  await expect(page.getByRole("heading", { name: snapshot.metadata.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("problem-analysis-detail-390.png"), fullPage: true });
});

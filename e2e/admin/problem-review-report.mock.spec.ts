import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const REPORT_ID = "f90f0bda-7544-4b4a-b673-2d2b671f4815";

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

function sampleDraft() {
  return {
    schema_version: "problem-review-report/v2",
    metadata: {
      title: "아카데미고 통합과학 중간고사 문제 리뷰",
      school: "아카데미고",
      subject: "통합과학",
      grade: "1학년",
      exam_name: "1학기 중간고사",
      exam_date: "2026-04-24",
      duration: "50분",
      total_score: "100점",
      instructor_name: "김과학",
      audience: "학생·학부모",
      report_purpose: "exam_analysis",
    },
    summary: {
      one_line: "개념 연결과 자료 해석을 함께 확인한 시험입니다.",
      character: "단순 암기보다 조건을 끝까지 읽고 연결하는 힘을 확인했습니다.",
      total_questions: 2,
      total_points: "100점",
      student_burden: "후반 복합 자료 문항에서 체감 부담이 높았습니다.",
    },
    assessment_axes: [
      { title: "개념 연결", description: "서로 다른 단원의 개념을 한 문항에서 연결합니다." },
      { title: "자료 해석", description: "표와 그래프의 조건을 비교합니다." },
    ],
    domains: [{
      name: "물질과 규칙성",
      question_numbers: ["1", "2"],
      points: "100점",
      ratio: "100%",
      insight: "핵심 개념과 적용을 균형 있게 확인합니다.",
    }],
    difficulty: { distribution: [], grade_estimate_note: "실제 등급 컷은 학교 결과 확인이 필요합니다." },
    questions: [
      {
        number: 1,
        source_number: 1,
        unit: "원소의 생성",
        answer: "3",
        points: "40점",
        difficulty: "중",
        thinking_action: "확인",
        key_point: "별의 진화 순서를 구분합니다.",
        trap: "생성 시기를 뒤바꾸기 쉽습니다.",
        validity: "조건과 정답이 일치합니다.",
        review_note: "표현을 한 번 더 확인합니다.",
        source_excerpt: "1. 별의 진화 과정에서 생성되는 원소를 고르시오.",
        confidence: "high",
        review_status: "unverified",
      },
      {
        number: 2,
        source_number: 2,
        unit: "주기율",
        answer: "5",
        points: "60점",
        difficulty: "상",
        thinking_action: "복합",
        key_point: "주기적 성질을 자료에 적용합니다.",
        trap: "원자 번호와 족을 혼동하기 쉽습니다.",
        validity: "선지 간 중복이 없습니다.",
        review_note: "변별 문항으로 적절합니다.",
        source_excerpt: "2. 자료를 보고 원소의 주기적 성질을 추론하시오.",
        confidence: "medium",
        review_status: "unverified",
      },
    ],
    key_items: [{
      rank: 1,
      title: "자료 해석 변별 문항",
      question_numbers: ["2"],
      reason: "두 조건을 동시에 적용해야 합니다.",
      collapse_point: "첫 조건만 보고 답을 고르기 쉽습니다.",
      prescription: "조건을 표에 표시하는 연습이 필요합니다.",
      evidence: "가계도 자료와 두 조건을 함께 사용합니다.",
      collapse_branches: ["첫 조건만 적용", "후보를 너무 일찍 확정", "마지막 조건을 누락"],
      recovery_steps: ["조건 분리", "후보 표 작성", "교집합 확인", "역대입 검산"],
      learning_point: "조건을 표로 분리합니다.",
    }],
    failure_patterns: [{ title: "조건 누락", symptom: "첫 조건만 적용합니다.", cause: "조건 표시 부족", prescription: "조건마다 표시합니다." }],
    parent_guidance: { avoid: ["공부를 안 했다"], recommended: ["복합 조건 정리가 더 필요합니다"] },
    recovery_protocol: { within_72_hours: ["오답 근거 표시"], within_two_weeks: ["조건표 반복"], next_exam: ["역대입 검산"] },
    achievement_bands: [{ label: "개념 확인", signal: "기본 조건을 찾음", prescription: "조건을 문장으로 씁니다." }],
    conclusion: { headline: "조건을 구조화하는 연습이 다음 성적을 만듭니다.", actions: ["복합 조건 표시하기", "오답 선지의 이유 쓰기"] },
    warnings: [],
  };
}

async function installApp(page: Page) {
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localJwt());

  const state = {
    version: 1,
    draft: sampleDraft(),
    savedOneLine: "",
    publishedVersion: 0,
    finalizedVersion: 0,
  };
  const reviewReadiness = () => {
    const questions = state.draft.questions.map((question, index) => ({
      index,
      number: question.number,
      ready: question.review_status === "verified",
      issues: question.review_status === "verified" ? [] : ["원문·정답 대조"],
    }));
    const verified = questions.filter((question) => question.ready).length;
    const ready = verified === questions.length;
    return {
      ready_for_finalize: ready,
      is_finalized: ready && state.finalizedVersion === state.version,
      fingerprint: "abcdef0123456789",
      finalized_at: state.finalizedVersion === state.version ? "2026-08-06T06:00:00+09:00" : null,
      total_questions: questions.length,
      verified_questions: verified,
      unresolved_questions: questions.length - verified,
      progress_percent: ready ? 100 : Math.round((verified / questions.length) * 70 + 30),
      sections: [
        { key: "metadata", label: "시험 기본 정보", ready: true },
        { key: "summary", label: "총평", ready: true },
        { key: "questions", label: "전 문항 원문·정답 대조", ready },
      ],
      questions,
    };
  };
  const report = () => ({
    id: REPORT_ID,
    status: "draft",
    title: state.draft.metadata.title,
    source_name: "아카데미고_중간고사.pdf",
    source_summary: { file_count: 1, question_count: 2 },
    version: state.version,
    last_error: "",
    draft: state.draft,
    created_at: "2026-08-06T00:00:00+09:00",
    updated_at: "2026-08-06T00:05:00+09:00",
    artifacts: [],
    review_readiness: reviewReadiness(),
  });

  await page.route("**/mock-files/**", (route) => {
    const pptx = route.request().url().endsWith(".pptx");
    return route.fulfill({
      status: 200,
      headers: { "Content-Disposition": `attachment; filename=problem-review.${pptx ? "pptx" : "pdf"}` },
      contentType: pptx ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "application/pdf",
      body: pptx ? "PKmock-pptx" : "%PDF-1.4\nmock\n%%EOF",
    });
  });
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", isPlatformAdmin: true, display_name: "학원플러스", feature_flags: {}, is_active: true });
    if (path === "/core/me/") return json({ id: 12, username: "review_teacher", name: "김과학", is_staff: true, is_superuser: false, tenantRole: "teacher", must_change_password: false });
    if (path === "/tools/problem-review/reports/" && method === "GET") return json({ reports: [report()] });
    if (path === `/tools/problem-review/reports/${REPORT_ID}/` && method === "GET") return json(report());
    if (path === `/tools/problem-review/reports/${REPORT_ID}/` && method === "PATCH") {
      const payload = request.postDataJSON() as { version: number; draft: ReturnType<typeof sampleDraft> };
      if (payload.version !== state.version) return json({ detail: "다른 화면에서 리포트가 수정되었습니다." }, 409);
      state.version += 1;
      state.finalizedVersion = 0;
      state.draft = payload.draft;
      state.savedOneLine = payload.draft.summary.one_line;
      return json(report());
    }
    if (path === `/tools/problem-review/reports/${REPORT_ID}/verification/` && method === "POST") {
      const payload = request.postDataJSON() as { version: number };
      if (payload.version !== state.version || !reviewReadiness().ready_for_finalize) return json({ detail: "남은 검수 항목을 확인해 주세요." }, 409);
      state.finalizedVersion = state.version;
      return json(report());
    }
    if (path === `/tools/problem-review/reports/${REPORT_ID}/publication/` && method === "POST") {
      const payload = request.postDataJSON() as { version: number };
      state.publishedVersion = payload.version;
      return json({
        id: 91,
        title: state.draft.metadata.title,
        status: "published",
        published_at: "2026-08-06T06:00:00+09:00",
        public_url: "/landing/analysis/91",
        pdf_url: "/api/v1/landing-public/problem-review-showcase/91/pdf/?tenant=hakwonplus",
      });
    }
    if (path === `/tools/problem-review/reports/${REPORT_ID}/exports/` && method === "POST") {
      const format = (request.postDataJSON() as { output_format: "pdf" | "pptx" }).output_format;
      return json({ id: `00000000-0000-4000-8000-00000000000${format === "pdf" ? "1" : "2"}`, job_id: `export-${format}`, status: "pending", output_format: format, report_version: state.version, source_fingerprint: "abcdef0123456789", filename: "", content_type: "", size_bytes: 0, sha256: "", error_message: "", verified: true, created_at: "2026-08-06T00:06:00+09:00", updated_at: "2026-08-06T00:06:00+09:00" }, 202);
    }
    const exportMatch = path.match(new RegExp(`/tools/problem-review/reports/${REPORT_ID}/exports/(.+)/`));
    if (exportMatch) {
      const format = exportMatch[1].endsWith("2") || exportMatch[1].includes("pptx") ? "pptx" : "pdf";
      const artifact = { id: exportMatch[1], job_id: `export-${format}`, status: "ready", download_url: `${BASE}/mock-files/problem-review.${format}`, filename: `아카데미고_문제리뷰_v${state.version}_abcdef01.${format}`, size_bytes: 24, output_format: format, report_version: state.version, source_fingerprint: "abcdef0123456789", content_type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation", sha256: "1234", error_message: "", verified: true, created_at: "2026-08-06T00:06:00+09:00", updated_at: "2026-08-06T00:06:01+09:00" };
      return json({ ...artifact, progress: { percent: 100, step_name_display: "다운로드 준비 완료" }, result: artifact });
    }
    return json({ count: 0, results: [] });
  });
  return state;
}

test("문제 리뷰를 검수 저장하고 PDF·PPTX로 내려받으며 390px에서도 넘치지 않는다", async ({ page }, testInfo) => {
  test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "문제 리뷰 route-mock 검증은 로컬 dev 서버 전용");
  const state = await installApp(page);

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}/workspace/tools/problem-review`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expect(page.getByRole("heading", { name: /시험의 증거를 잇고/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: /아카데미고 통합과학 중간고사 문제 리뷰/ }).click();
  await expect(page.getByText("선생님 최종 검수 현황")).toBeVisible();
  await expect(page.getByRole("button", { name: "미검수 2", exact: true })).toBeVisible();
  await expect(page.getByLabel("시험 한 줄 평")).toHaveValue("개념 연결과 자료 해석을 함께 확인한 시험입니다.");
  await expect(page.getByLabel("실패 패턴 1 증상")).toHaveValue("첫 조건만 적용합니다.");
  await page.getByLabel("시험 한 줄 평").fill("자료 해석의 근거를 끝까지 확인한 시험입니다.");
  await page.getByRole("button", { name: "변경 저장" }).click();
  await expect.poll(() => state.savedOneLine).toBe("자료 해석의 근거를 끝까지 확인한 시험입니다.");
  await expect(page.getByText("자료 해석의 근거를 끝까지 확인한 시험입니다.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "대조 완료로 표시" }).click();
  await page.getByRole("button", { name: "대조 완료로 표시" }).click();
  await expect(page.getByText("모든 문항 대조를 마쳤습니다.")).toBeVisible();
  await page.getByRole("button", { name: "최종 검수 확정" }).click();
  await expect(page.getByText("현재 버전은 최종 검수 완료")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "홈페이지 공개" }).click();
  await expect.poll(() => state.publishedVersion).toBe(3);
  await expect(page.getByRole("button", { name: "공개본 보기" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "생성·받기", exact: true }).first().click();
  expect((await download).suggestedFilename()).toBe("아카데미고_문제리뷰_v3_abcdef01.pdf");
  const pptxDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "생성·받기", exact: true }).nth(1).click();
  expect((await pptxDownload).suggestedFilename()).toBe("아카데미고_문제리뷰_v3_abcdef01.pptx");
  await page.screenshot({ path: testInfo.outputPath("problem-review-editor-1366.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: /아카데미고 통합과학 중간고사 문제 리뷰/ }).click();
  await expect(page.getByLabel("시험 한 줄 평")).toHaveValue("자료 해석의 근거를 끝까지 확인한 시험입니다.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "생성·받기", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "미리보기" }).click();
  await expect(page.getByRole("button", { name: "미리보기 닫기" })).toBeVisible();
  await page.getByRole("button", { name: "미리보기 닫기" }).click();
  await page.getByRole("heading", { name: "확정된 검수본을 내려받으세요" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("problem-review-editor-390.png"), fullPage: true });
});

/**
 * 박철T 매치업 실태 정밀 audit — 학원장 평가 3점 갭 원인 진단.
 *
 * 가설:
 *   H1. 문항 분리 실패율이 매우 높다 (좌 pane Q1/Q2가 같은 페이지로 보임).
 *   H2. 매치업 자동 추천 (similar) 작동률이 0에 가깝다.
 *
 * 측정:
 *   M1. 193 doc 의 problem_count 분포 / page-as-problem 판정 비율
 *   M2. 무작위 problem 30건의 similar API top-K 매칭 분포 + 0건 비율
 *   M3. 박철T가 만든 8 hit-report 의 exam_count 대비 자동 후보 추출률
 */
import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import { loginViaUI } from "../helpers/auth";

const SHOT_DIR = "e2e/_artifacts/matchup-actual-defect-audit-2026-05-05";
const API = "https://api.hakwonplus.com";

test.beforeAll(() => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
});

test("학원장 실측 갭 원인 진단", async ({ page }) => {
  test.setTimeout(180_000);
  await loginViaUI(page, "tchul-admin");
  const tok = await page.evaluate(() => localStorage.getItem("access"));
  expect(tok).toBeTruthy();

  const H = {
    Authorization: `Bearer ${tok}`,
    "X-Tenant-Code": "tchul",
  };

  // M1: doc problem_count 분포
  const docResp = await page.request.get(`${API}/api/v1/matchup/documents/`, {
    headers: H,
    timeout: 60_000,
  });
  expect(docResp.status()).toBe(200);
  const docPayload = await docResp.json();
  const docs: Array<{
    id: number;
    title: string;
    source_type?: string;
    problem_count?: number;
    page_count?: number;
    status?: string;
    meta?: Record<string, unknown>;
  }> = Array.isArray(docPayload)
    ? docPayload
    : docPayload.documents ?? docPayload.results ?? [];
  console.log(`docs total=${docs.length}`);
  if (docs.length > 0) {
    fs.writeFileSync(
      `${SHOT_DIR}/00-doc-list-shape.json`,
      JSON.stringify({ keys: Object.keys(docs[0]), sample: docs.slice(0, 3) }, null, 2),
    );
  }

  const bySrc: Record<string, { docs: number; problems: number; pages: number }> = {};
  const pageAsProblemDocs: typeof docs = [];
  for (const d of docs) {
    const k = d.source_type ?? "(none)";
    bySrc[k] ??= { docs: 0, problems: 0, pages: 0 };
    bySrc[k].docs += 1;
    bySrc[k].problems += d.problem_count ?? 0;
    bySrc[k].pages += d.page_count ?? 0;
    // page-as-problem 휴리스틱: problem_count <= page_count + 2 그리고 problem_count > 0
    const pc = d.problem_count ?? 0;
    const pg = d.page_count ?? 0;
    if (pc > 0 && pg > 0 && pc <= pg + 2) {
      pageAsProblemDocs.push(d);
    }
  }
  fs.writeFileSync(
    `${SHOT_DIR}/01-source-type-distribution.json`,
    JSON.stringify(bySrc, null, 2),
  );
  fs.writeFileSync(
    `${SHOT_DIR}/02-page-as-problem-suspect.json`,
    JSON.stringify(
      {
        suspect_count: pageAsProblemDocs.length,
        total_with_problems: docs.filter((d) => (d.problem_count ?? 0) > 0).length,
        sample: pageAsProblemDocs.slice(0, 30).map((d) => ({
          id: d.id,
          title: d.title,
          source_type: d.source_type,
          problem_count: d.problem_count,
          page_count: d.page_count,
        })),
      },
      null,
      2,
    ),
  );

  // M2: 무작위 problem 30건의 similar 매칭 — 처리된 doc 별로 problems 가져와 합산 (전체 list timeout 회피)
  const docsWithProblems = docs.filter((d) => (d.problem_count ?? 0) > 0);
  const allProblems: Array<{ id: number; document_id: number; number?: number }> = [];
  // 30개 표본만 — 너무 많이 안 걷음
  const docSample = docsWithProblems
    .sort(() => Math.random() - 0.5)
    .slice(0, 15);
  for (const d of docSample) {
    try {
      const r = await page.request.get(
        `${API}/api/v1/matchup/problems/?document_id=${d.id}`,
        { headers: H, timeout: 30_000 },
      );
      if (r.status() !== 200) continue;
      const list = (await r.json()) as Array<{ id: number; document_id: number; number?: number }>;
      for (const p of list) allProblems.push(p);
    } catch (e) {
      console.log(`doc ${d.id} problems fetch failed`);
    }
  }
  console.log(`problems sample-pool=${allProblems.length}`);
  const sample: Array<{ id: number; document_id: number; n_results: number; topSim: number; }> = [];
  const N = 30;
  const step = Math.max(1, Math.floor(allProblems.length / N));
  for (let i = 0; i < allProblems.length && sample.length < N; i += step) {
    const p = allProblems[i];
    const sResp = await page.request.post(`${API}/api/v1/matchup/problems/${p.id}/similar/`, {
      headers: { ...H, "Content-Type": "application/json" },
      data: { top_k: 10 },
      timeout: 30_000,
    });
    if (sResp.status() !== 200) {
      sample.push({ id: p.id, document_id: p.document_id, n_results: -1, topSim: 0 });
      continue;
    }
    const sJson = (await sResp.json()) as { results?: Array<{ similarity: number }> };
    const r = sJson.results ?? [];
    sample.push({
      id: p.id,
      document_id: p.document_id,
      n_results: r.length,
      topSim: r[0]?.similarity ?? 0,
    });
  }
  const zeroResult = sample.filter((s) => s.n_results === 0).length;
  const lowSim = sample.filter((s) => s.n_results > 0 && s.topSim < 0.6).length;
  const directHit = sample.filter((s) => s.topSim >= 0.85).length;
  fs.writeFileSync(
    `${SHOT_DIR}/03-similar-sample.json`,
    JSON.stringify(
      {
        sampled: sample.length,
        zeroResult,
        lowSim,
        directHit,
        avgTopSim:
          sample.reduce((a, b) => a + (b.topSim || 0), 0) / Math.max(1, sample.length),
        detail: sample,
      },
      null,
      2,
    ),
  );

  // M2.5: 문항 분리 실제 작동률 — 사용자 핵심 진단 "거의 하나도 안됐다"
  //   problem.meta.bbox = null  → 페이지 폴백 (문항 단위 X)
  //   problem_count / page_count → 1.0 근처면 page-as-problem 폴백, 2~6이면 정상
  //   text 길이 분포 — 짧으면(수백 자) 문항, 길면(수천 자) 페이지 통째
  const splitDocs = docs.filter(
    (d) => (d.problem_count ?? 0) > 0 && (d.source_type ?? "") !== "explanation"
      && (d.source_type ?? "") !== "answer_key"
  );
  const splitStats: Array<{
    id: number;
    title: string;
    source_type: string;
    pcount: number;
    pgcount: number;
    ratio: number;
    bbox_null_rate: number;
    avg_text_len: number;
  }> = [];
  for (const d of splitDocs.slice(0, 30)) {
    try {
      const r = await page.request.get(
        `${API}/api/v1/matchup/problems/?document_id=${d.id}`,
        { headers: H, timeout: 30_000 },
      );
      if (r.status() !== 200) continue;
      const list = (await r.json()) as Array<{
        id: number;
        meta?: { bbox?: unknown } | null;
        text?: string;
      }>;
      const total = list.length || 1;
      const bboxNull = list.filter((p) => !(p.meta && p.meta.bbox)).length;
      const avgLen =
        list.reduce((a, b) => a + (b.text || "").length, 0) / total;
      splitStats.push({
        id: d.id,
        title: d.title,
        source_type: d.source_type ?? "",
        pcount: total,
        pgcount: d.page_count ?? 0,
        ratio: (d.page_count ?? 0) > 0 ? total / (d.page_count ?? 1) : 0,
        bbox_null_rate: bboxNull / total,
        avg_text_len: avgLen,
      });
    } catch {
      // skip
    }
  }
  // 집계
  const docsBboxAllNull = splitStats.filter((s) => s.bbox_null_rate >= 0.95).length;
  const docsBboxNoneNull = splitStats.filter((s) => s.bbox_null_rate <= 0.05).length;
  const avgRatio =
    splitStats.reduce((a, b) => a + b.ratio, 0) / Math.max(1, splitStats.length);
  const avgTextLen =
    splitStats.reduce((a, b) => a + b.avg_text_len, 0) / Math.max(1, splitStats.length);
  const lowRatioDocs = splitStats.filter((s) => s.ratio > 0 && s.ratio <= 1.2).length;

  fs.writeFileSync(
    `${SHOT_DIR}/05-question-split-stats.json`,
    JSON.stringify(
      {
        sampled: splitStats.length,
        docs_bbox_all_null: docsBboxAllNull,
        docs_bbox_no_null: docsBboxNoneNull,
        avg_ratio_problem_per_page: avgRatio,
        avg_text_len_chars: avgTextLen,
        page_as_problem_suspect_docs: lowRatioDocs,
        detail: splitStats,
      },
      null,
      2,
    ),
  );

  // M3: hit-report exam 후보 추출률
  const hrResp = await page.request.get(
    `${API}/api/v1/matchup/hit-reports/?mine=false`,
    { headers: H },
  );
  const hrJson = await hrResp.json();
  const reports = hrJson.reports ?? [];
  console.log(`hit-reports=${reports.length}`);
  const reportSummaries: Array<{
    id: number;
    title: string;
    exam_count: number;
    auto_candidate_for_q1: number;
    sample_q1_top_sim: number;
    sample_q1_problem_id: number | null;
  }> = [];
  for (const r of reports.slice(0, 5)) {
    // draft 상세 조회
    const detailResp = await page.request.get(
      `${API}/api/v1/matchup/hit-reports/${r.id}/draft/`,
      { headers: H, timeout: 30_000 },
    );
    if (detailResp.status() !== 200) {
      reportSummaries.push({
        id: r.id,
        title: r.title || r.document_title,
        exam_count: r.exam_count,
        auto_candidate_for_q1: -1,
        sample_q1_top_sim: 0,
        sample_q1_problem_id: null,
      });
      continue;
    }
    const detail = await detailResp.json();
    // 첫 exam_problem 의 candidates 길이
    const examProblems = detail.exam_problems ?? [];
    const q1 = examProblems[0];
    const cands = q1?.candidates ?? [];
    reportSummaries.push({
      id: r.id,
      title: r.title || r.document_title,
      exam_count: examProblems.length,
      auto_candidate_for_q1: cands.length,
      sample_q1_top_sim: cands[0]?.similarity ?? 0,
      sample_q1_problem_id: q1?.id ?? null,
    });
  }
  fs.writeFileSync(
    `${SHOT_DIR}/04-hitreport-candidate-coverage.json`,
    JSON.stringify(reportSummaries, null, 2),
  );

  // 요약
  const summary = {
    docs_total: docs.length,
    docs_with_problems: docs.filter((d) => (d.problem_count ?? 0) > 0).length,
    page_as_problem_suspect: pageAsProblemDocs.length,
    sample_problems_evaluated: sample.length,
    similar_zero_result_rate: zeroResult / Math.max(1, sample.length),
    similar_avg_top_sim:
      sample.reduce((a, b) => a + (b.topSim || 0), 0) / Math.max(1, sample.length),
    direct_hit_rate: directHit / Math.max(1, sample.length),
    hit_reports_sampled: reportSummaries.length,
    avg_q1_candidates: reportSummaries.length
      ? reportSummaries.reduce((a, b) => a + Math.max(0, b.auto_candidate_for_q1), 0) /
        reportSummaries.length
      : 0,
  };
  fs.writeFileSync(`${SHOT_DIR}/00-summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
});

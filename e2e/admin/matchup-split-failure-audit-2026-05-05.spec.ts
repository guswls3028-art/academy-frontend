/**
 * 박철T 매치업 문항 분리 실태 전수 audit — 자동 추천 검사 이전 단계.
 *
 * 사용자 진단: "문항도 못자르는데 추천 검사는 개뿔."
 *
 * 목적: 카테고리 격리 fix 와 무관하게, 매치업 풀에 들어가는 problem 데이터 자체가
 * 문항 단위로 잘렸는지 측정. 안 잘렸으면 매칭 알고리즘과 무관하게 가치 0.
 *
 * 측정 단위 (193 doc 전수):
 *   M1. bbox null 비율 — 100%면 완전 page-as-problem 폴백
 *   M2. avg_text_len — 1000+ 자면 페이지 통째 OCR
 *   M3. problem_count vs doc.meta.page_count_meta (있으면) — ratio ≤ 1.2 페이지 폴백 의심
 *   M4. doc.meta.segmentation_method — anchor / vlm_split / page_fallback / etc
 *   M5. doc.meta.paper_type_summary primary — unknown / non_question / clean_pdf_*
 *   M6. doc.meta.has_text_pages, doc.meta.vlm_used (boolean) — 환경 신호
 *
 * 출력: 폴백 원인 카테고리 분포 — 본질 fix 우선순위 결정용.
 */
import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import { loginViaUI } from "../helpers/auth";

const SHOT_DIR = "e2e/_artifacts/matchup-split-failure-audit-2026-05-05";
const API = "https://api.hakwonplus.com";

test.beforeAll(() => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
});

test("박철T 193 doc 전수 문항 분리 실태", async ({ page }) => {
  test.setTimeout(600_000);
  await loginViaUI(page, "tchul-admin");
  const tok = await page.evaluate(() => localStorage.getItem("access"));
  expect(tok).toBeTruthy();

  const H = {
    Authorization: `Bearer ${tok}`,
    "X-Tenant-Code": "tchul",
  };

  // 1. doc 전체 + 상세 meta
  const docResp = await page.request.get(`${API}/api/v1/matchup/documents/`, {
    headers: H,
    timeout: 60_000,
  });
  expect(docResp.status()).toBe(200);
  const payload = await docResp.json();
  const docs: Array<Record<string, unknown>> = Array.isArray(payload)
    ? payload
    : (payload.documents ?? payload.results ?? []);
  console.log(`docs total=${docs.length}`);

  // 첫 doc 의 키 보존
  if (docs.length > 0) {
    fs.writeFileSync(
      `${SHOT_DIR}/00-doc-shape.json`,
      JSON.stringify({ keys: Object.keys(docs[0]), sample: docs[0] }, null, 2),
    );
  }

  // 2. 각 doc 의 problems detail 가져와서 bbox null 비율 측정
  type DocStat = {
    id: number;
    title: string;
    source_type: string;
    category: string;
    pcount: number;
    bbox_null: number;
    bbox_filled: number;
    bbox_null_rate: number;
    avg_text_len: number;
    max_text_len: number;
    seg_method: string;
    paper_type_primary: string;
    has_text_pages: boolean | null;
    vlm_used: boolean | null;
    processing_quality: string;
    fail_reason: string;  // 분류 결과 — "ok" / "page_fallback" / "no_problems" / "page_long_text" / "unknown"
  };

  const stats: DocStat[] = [];
  let i = 0;
  for (const d of docs) {
    i += 1;
    if (i % 25 === 0) console.log(`progress ${i}/${docs.length}`);
    const docId = d.id as number;
    const title = String(d.title ?? "");
    const srcType = String(d.source_type ?? "");
    const category = String(d.category ?? "");
    const pcount = Number(d.problem_count ?? 0);
    const meta = (d.meta ?? {}) as Record<string, unknown>;
    const segMethod = String(meta.segmentation_method ?? "");
    const ptSummary = (meta.paper_type_summary ?? {}) as Record<string, unknown>;
    const ptPrimary = String(ptSummary.primary ?? "");
    const hasText = meta.has_text_pages == null ? null : Boolean(meta.has_text_pages);
    const vlmUsed = meta.vlm_used == null ? null : Boolean(meta.vlm_used);
    const procQuality = String(meta.processing_quality ?? "");

    let bboxNull = 0;
    let bboxFilled = 0;
    let totalLen = 0;
    let maxLen = 0;
    let actualPCount = 0;

    if (pcount > 0) {
      try {
        const r = await page.request.get(
          `${API}/api/v1/matchup/problems/?document_id=${docId}`,
          { headers: H, timeout: 30_000 },
        );
        if (r.status() === 200) {
          const list = (await r.json()) as Array<{
            id: number;
            meta?: Record<string, unknown> | null;
            text?: string;
          }>;
          actualPCount = list.length;
          for (const p of list) {
            const pm = (p.meta ?? {}) as Record<string, unknown>;
            if (pm.bbox) bboxFilled += 1;
            else bboxNull += 1;
            const tlen = (p.text ?? "").length;
            totalLen += tlen;
            if (tlen > maxLen) maxLen = tlen;
          }
        }
      } catch {
        // skip
      }
    }
    const denom = actualPCount || 1;
    const bboxNullRate = bboxNull / denom;
    const avgLen = totalLen / denom;

    // 분류 — 결함 카테고리화
    let failReason: string;
    if (actualPCount === 0) failReason = "no_problems";
    else if (bboxNullRate >= 0.9 && avgLen >= 800) failReason = "page_fallback_long_text";
    else if (bboxNullRate >= 0.9) failReason = "page_fallback_short";
    else if (bboxNullRate >= 0.5) failReason = "partial_fallback";
    else failReason = "ok";

    stats.push({
      id: docId,
      title,
      source_type: srcType,
      category,
      pcount: actualPCount,
      bbox_null: bboxNull,
      bbox_filled: bboxFilled,
      bbox_null_rate: bboxNullRate,
      avg_text_len: avgLen,
      max_text_len: maxLen,
      seg_method: segMethod,
      paper_type_primary: ptPrimary,
      has_text_pages: hasText,
      vlm_used: vlmUsed,
      processing_quality: procQuality,
      fail_reason: failReason,
    });
  }

  // 3. 집계
  const byFail: Record<string, number> = {};
  const byFailBySrc: Record<string, Record<string, number>> = {};
  const bySrc: Record<string, number> = {};
  const bySegMethod: Record<string, number> = {};
  const byPaperType: Record<string, number> = {};
  for (const s of stats) {
    byFail[s.fail_reason] = (byFail[s.fail_reason] ?? 0) + 1;
    bySrc[s.source_type] = (bySrc[s.source_type] ?? 0) + 1;
    bySegMethod[s.seg_method || "(none)"] = (bySegMethod[s.seg_method || "(none)"] ?? 0) + 1;
    byPaperType[s.paper_type_primary || "(none)"] =
      (byPaperType[s.paper_type_primary || "(none)"] ?? 0) + 1;
    byFailBySrc[s.source_type] ??= {};
    byFailBySrc[s.source_type][s.fail_reason] =
      (byFailBySrc[s.source_type][s.fail_reason] ?? 0) + 1;
  }

  // 폴백 doc 만 별도 풀 detail
  const failedDocs = stats.filter(
    (s) => s.fail_reason !== "ok" && s.source_type !== "explanation"
      && s.source_type !== "answer_key",
  );

  fs.writeFileSync(
    `${SHOT_DIR}/01-aggregate.json`,
    JSON.stringify(
      {
        total_docs: stats.length,
        by_fail_reason: byFail,
        by_source_type: bySrc,
        by_seg_method: bySegMethod,
        by_paper_type_primary: byPaperType,
        by_fail_x_source_type: byFailBySrc,
        ok_count: byFail.ok ?? 0,
        ok_rate: ((byFail.ok ?? 0) / Math.max(1, stats.length)),
        failed_total: failedDocs.length,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    `${SHOT_DIR}/02-all-docs-stats.json`,
    JSON.stringify(stats, null, 2),
  );
  fs.writeFileSync(
    `${SHOT_DIR}/03-failed-docs.json`,
    JSON.stringify(failedDocs, null, 2),
  );

  console.log("---AGGREGATE---");
  console.log(`total ${stats.length} | ok ${byFail.ok ?? 0} (${(((byFail.ok ?? 0) / Math.max(1, stats.length)) * 100).toFixed(1)}%)`);
  console.log("by_fail_reason:", JSON.stringify(byFail));
  console.log("by_seg_method:", JSON.stringify(bySegMethod));
  console.log("by_paper_type:", JSON.stringify(byPaperType));
});

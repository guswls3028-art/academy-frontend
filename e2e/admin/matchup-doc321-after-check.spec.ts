/**
 * doc 321 reanalyze 결과 측정 — list endpoint 으로 doc detail + problems.
 */
import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import { loginViaUI } from "../helpers/auth";

const SHOT_DIR = "e2e/_artifacts/matchup-single-reanalyze-trial-2026-05-05";
const API = "https://api.hakwonplus.com";
const TARGET_DOC = 321;

test("doc 321 reanalyze 결과 측정", async ({ page }) => {
  test.setTimeout(120_000);
  await loginViaUI(page, "tchul-admin");
  const tok = await page.evaluate(() => localStorage.getItem("access"));
  expect(tok).toBeTruthy();
  const H = { Authorization: `Bearer ${tok}`, "X-Tenant-Code": "tchul" };

  // doc list에서 321 찾기
  const dr = await page.request.get(`${API}/api/v1/matchup/documents/`, {
    headers: H,
    timeout: 60_000,
  });
  expect(dr.status()).toBe(200);
  const payload = await dr.json();
  const docs = (payload.documents ?? payload.results ?? payload) as Array<Record<string, unknown>>;
  console.log(`docs total=${docs.length}, payload keys=${Object.keys(payload)}`);
  const doc = docs.find((d) => Number(d.id) === TARGET_DOC);
  if (!doc) {
    fs.writeFileSync(
      `${SHOT_DIR}/04-debug.json`,
      JSON.stringify({ docs_count: docs.length, payload_keys: Object.keys(payload), first_3: docs.slice(0, 3) }, null, 2),
    );
  }
  expect(doc, `doc ${TARGET_DOC} 없음 — debug 04-debug.json`).toBeTruthy();

  // problems
  const pr = await page.request.get(
    `${API}/api/v1/matchup/problems/?document_id=${TARGET_DOC}`,
    { headers: H, timeout: 30_000 },
  );
  const list = (await pr.json()) as Array<{
    meta?: Record<string, unknown> | null;
    text?: string;
    number?: number;
  }>;
  let bboxNull = 0;
  let bboxFilled = 0;
  let totalLen = 0;
  for (const p of list) {
    if (p.meta && p.meta.bbox) bboxFilled += 1;
    else bboxNull += 1;
    totalLen += (p.text ?? "").length;
  }
  const meta = (doc!.meta ?? {}) as Record<string, unknown>;
  const result = {
    status: doc!.status,
    problem_count_db: list.length,
    problem_count_meta: doc!.problem_count,
    bbox_null: bboxNull,
    bbox_filled: bboxFilled,
    bbox_null_rate: list.length > 0 ? bboxNull / list.length : 0,
    avg_text_len: list.length > 0 ? totalLen / list.length : 0,
    seg_method: meta.segmentation_method ?? "",
    paper_type_primary:
      (meta.paper_type_summary as { primary?: string } | undefined)?.primary ?? "",
    processing_quality: meta.processing_quality ?? "",
    has_text_pages: meta.has_text_pages,
    vlm_used: meta.vlm_used,
    updated_at: doc!.updated_at,
    error_message: doc!.error_message,
    sample_first_problem: {
      number: list[0]?.number,
      bbox: list[0]?.meta?.bbox ?? null,
      text_head: (list[0]?.text ?? "").slice(0, 400),
    },
  };
  fs.writeFileSync(
    `${SHOT_DIR}/04-after-check.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
});

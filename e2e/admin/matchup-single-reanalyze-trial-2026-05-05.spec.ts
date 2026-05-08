/**
 * 박철T 폴백 doc 1건 reanalyze 시험 — 새 정책(c30800aa + 875f63f3) 적용 후
 * 분리 정확도 회복 가능 여부 측정.
 *
 * 대상: doc 321 "항상성과 호르몬 메인자료" — 46 problems all bbox=null,
 *       avg_text_len 1374 (페이지 통째 OCR), 박철 본인 메인 자료.
 *
 * 측정:
 *   - reanalyze API 200 OK
 *   - 워커 처리 후 problem_count / bbox_null_rate / avg_text_len / seg_method
 *     / processing_quality 변화
 *
 * 안전: 1건만, 다른 doc 영향 없음. 학원장 manual crop 보존(meta__manual=True).
 */
import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import { loginViaUI } from "../helpers/auth";

const SHOT_DIR = "e2e/_artifacts/matchup-single-reanalyze-trial-2026-05-05";
const API = "https://api.hakwonplus.com";
const TARGET_DOC = 321;

test.beforeAll(() => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
});

async function snapshotDoc(
  page: import("@playwright/test").Page,
  H: Record<string, string>,
  docId: number,
): Promise<Record<string, unknown>> {
  // doc 메타
  const dr = await page.request.get(`${API}/api/v1/matchup/documents/${docId}/`, {
    headers: H,
    timeout: 30_000,
  });
  if (dr.status() !== 200) {
    return { _error: `doc fetch ${dr.status()}` };
  }
  const doc = await dr.json();
  // problems
  const pr = await page.request.get(
    `${API}/api/v1/matchup/problems/?document_id=${docId}`,
    { headers: H, timeout: 30_000 },
  );
  let bboxNull = 0;
  let bboxFilled = 0;
  let totalLen = 0;
  let pCount = 0;
  if (pr.status() === 200) {
    const list = (await pr.json()) as Array<{
      meta?: Record<string, unknown> | null;
      text?: string;
    }>;
    pCount = list.length;
    for (const p of list) {
      if (p.meta && p.meta.bbox) bboxFilled += 1;
      else bboxNull += 1;
      totalLen += (p.text ?? "").length;
    }
  }
  return {
    status: doc.status,
    problem_count_db: pCount,
    problem_count_meta: doc.problem_count,
    bbox_null: bboxNull,
    bbox_filled: bboxFilled,
    bbox_null_rate: pCount > 0 ? bboxNull / pCount : 0,
    avg_text_len: pCount > 0 ? totalLen / pCount : 0,
    seg_method: doc.meta?.segmentation_method ?? "",
    paper_type_primary: doc.meta?.paper_type_summary?.primary ?? "",
    processing_quality: doc.meta?.processing_quality ?? "",
    has_text_pages: doc.meta?.has_text_pages,
    vlm_used: doc.meta?.vlm_used,
    updated_at: doc.updated_at,
  };
}

test("doc 321 reanalyze 시험 + before/after 측정", async ({ page }) => {
  test.setTimeout(420_000);
  await loginViaUI(page, "tchul-admin");
  const tok = await page.evaluate(() => localStorage.getItem("access"));
  expect(tok).toBeTruthy();
  const H = {
    Authorization: `Bearer ${tok}`,
    "X-Tenant-Code": "tchul",
    "Content-Type": "application/json",
  };

  // 1. before snapshot
  const before = await snapshotDoc(page, H, TARGET_DOC);
  fs.writeFileSync(
    `${SHOT_DIR}/01-before.json`,
    JSON.stringify(before, null, 2),
  );
  console.log("BEFORE:", JSON.stringify(before));

  // 2. reanalyze 호출
  const rr = await page.request.post(
    `${API}/api/v1/matchup/documents/${TARGET_DOC}/reanalyze/`,
    {
      headers: H,
      data: {},
      timeout: 30_000,
    },
  );
  console.log(`reanalyze dispatch status=${rr.status()}`);
  const rrBody = await rr.text();
  fs.writeFileSync(`${SHOT_DIR}/02-dispatch.json`, JSON.stringify({
    status: rr.status(),
    body: rrBody.slice(0, 2000),
  }, null, 2));

  if (rr.status() !== 200 && rr.status() !== 202) {
    test.fail(true, `reanalyze dispatch failed ${rr.status()}: ${rrBody}`);
    return;
  }

  // 3. polling — 최대 6분 워커 처리 대기
  const startedAt = Date.now();
  let lastSnapshot: Record<string, unknown> | null = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(12_000);
    const snap = await snapshotDoc(page, H, TARGET_DOC);
    lastSnapshot = snap;
    console.log(
      `poll ${i + 1}: status=${snap.status} pcount=${snap.problem_count_db} ` +
      `bbox_null_rate=${snap.bbox_null_rate} updated_at=${snap.updated_at}`,
    );
    if (snap.status === "done" || snap.status === "failed") {
      // updated_at이 reanalyze 이후로 갱신됐고 status가 done이면 처리 완료
      const upd = String(snap.updated_at ?? "");
      const beforeUpd = String((before as { updated_at?: string }).updated_at ?? "");
      if (upd && upd !== beforeUpd && snap.status === "done") {
        console.log("→ reanalyze 처리 완료");
        break;
      }
      if (snap.status === "failed") {
        console.log("→ reanalyze 실패");
        break;
      }
    }
  }
  const elapsedSec = (Date.now() - startedAt) / 1000;
  console.log(`elapsed=${elapsedSec}s`);

  // 4. after snapshot
  const after = await snapshotDoc(page, H, TARGET_DOC);
  fs.writeFileSync(
    `${SHOT_DIR}/03-after.json`,
    JSON.stringify(after, null, 2),
  );
  console.log("AFTER:", JSON.stringify(after));

  // 5. delta
  const delta = {
    elapsed_sec: elapsedSec,
    problem_count_change:
      Number(after.problem_count_db) - Number(before.problem_count_db),
    bbox_null_rate_before: before.bbox_null_rate,
    bbox_null_rate_after: after.bbox_null_rate,
    avg_text_len_before: before.avg_text_len,
    avg_text_len_after: after.avg_text_len,
    seg_method_before: before.seg_method,
    seg_method_after: after.seg_method,
    processing_quality_before: before.processing_quality,
    processing_quality_after: after.processing_quality,
    bbox_filled_before: before.bbox_filled,
    bbox_filled_after: after.bbox_filled,
  };
  fs.writeFileSync(
    `${SHOT_DIR}/00-delta.json`,
    JSON.stringify(delta, null, 2),
  );
  console.log("DELTA:", JSON.stringify(delta, null, 2));
});

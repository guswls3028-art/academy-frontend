/**
 * 폴백 doc 의 problem text 내용 직접 검수 — anchor 패턴 진단.
 *
 * 박철 메인 자료 (321 항상성과 호르몬 메인자료, 313 신경계 메인자료)와
 * 학교 시험지 (305 26-1m 단대부고 내지) 의 page-as-problem 텍스트 보면
 * 왜 anchor splitter 가 문제 번호를 못 잡는지 즉시 알 수 있음.
 */
import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import { loginViaUI } from "../helpers/auth";

const SHOT_DIR = "e2e/_artifacts/matchup-fallback-text-inspect-2026-05-05";
const API = "https://api.hakwonplus.com";

test.beforeAll(() => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
});

test("폴백 doc problem text 진단", async ({ page }) => {
  test.setTimeout(120_000);
  await loginViaUI(page, "tchul-admin");
  const tok = await page.evaluate(() => localStorage.getItem("access"));
  expect(tok).toBeTruthy();
  const H = { Authorization: `Bearer ${tok}`, "X-Tenant-Code": "tchul" };

  const targets = [
    { id: 321, label: "박철 메인자료-항상성과호르몬" },
    { id: 313, label: "박철 메인자료-신경계" },
    { id: 309, label: "박철 메인자료-물질대사" },
    { id: 305, label: "단대부고-내지(폴백)" },
    { id: 302, label: "개포고-내지(폴백)" },
    { id: 326, label: "1-1단원-생명과학의이해" },
  ];

  const result: Array<Record<string, unknown>> = [];
  for (const t of targets) {
    const r = await page.request.get(
      `${API}/api/v1/matchup/problems/?document_id=${t.id}`,
      { headers: H, timeout: 30_000 },
    );
    if (r.status() !== 200) {
      result.push({ id: t.id, label: t.label, status: r.status() });
      continue;
    }
    const list = (await r.json()) as Array<{
      id: number;
      number: number;
      text?: string;
      meta?: Record<string, unknown> | null;
    }>;
    // 첫 3 problem 의 text 앞 800자 추출
    const samples = list.slice(0, 3).map((p) => ({
      pid: p.id,
      number: p.number,
      bbox: p.meta?.bbox ?? null,
      text_head: (p.text ?? "").slice(0, 800),
      text_total_len: (p.text ?? "").length,
    }));
    result.push({
      id: t.id,
      label: t.label,
      problem_count: list.length,
      samples,
    });
  }

  fs.writeFileSync(
    `${SHOT_DIR}/01-problem-text-samples.json`,
    JSON.stringify(result, null, 2),
  );
  console.log("samples saved:", result.length);
});

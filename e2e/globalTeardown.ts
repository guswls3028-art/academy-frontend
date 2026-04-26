/**
 * E2E global teardown — `E2E_STRICT=report` 모드에서 모든 spec 의 strict-browser
 * defect annotation 을 단일 JSON 파일로 수집한다.
 *
 * 운영자 검토 흐름:
 *   1. PR 또는 manual run 종료 후
 *   2. test-results/strict-defects.json 다운로드
 *   3. 파일을 보고 spec 별 console.error/pageerror 분류
 *   4. 깨끗하면 .env.e2e 의 E2E_STRICT 를 strict 로 플립
 *
 * playwright.config.ts 의 globalTeardown 으로 등록 — config 미수정 시 미동작.
 */
import * as fs from "fs";
import * as path from "path";
import type { FullConfig } from "@playwright/test";

interface DefectEntry {
  spec: string;
  test: string;
  description: string;
}

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  // strict 모드에선 spec 가 자체 fail 처리하므로 별도 수집 불필요.
  if ((process.env.E2E_STRICT || "").toLowerCase() === "strict") return;
  if ((process.env.E2E_STRICT || "").toLowerCase() === "off") return;

  const reportFile = path.resolve("test-results", ".last-run.json");
  // playwright 가 마지막 run 결과를 JSON 으로 dump 한 곳 — 환경에 따라 다를 수 있어 fallback.
  // 가장 신뢰 가능한 소스는 playwright-report/data/<hash>.json. 단, 현재 reporter 가
  // ['list', 'html'] 이라 명시적 JSON 이 없을 수 있음 — 따라서 best-effort 로 처리.
  const htmlReportDir = path.resolve("playwright-report");

  const defects: DefectEntry[] = [];

  // playwright-report/data/*.json 안에 spec 별 결과가 들어있다.
  // 각 결과 의 annotations[].type === "strict-browser-defect" 를 모은다.
  try {
    const dataDir = path.join(htmlReportDir, "data");
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
      for (const f of files) {
        try {
          const raw = fs.readFileSync(path.join(dataDir, f), "utf-8");
          const j = JSON.parse(raw);
          // 구조는 playwright html-reporter 내부 포맷. defensive 탐색.
          collectFromAny(j, defects);
        } catch { /* skip malformed */ }
      }
    }
  } catch (e) {
    console.warn(`[globalTeardown] strict defect 수집 중 오류 (무시): ${(e as Error).message}`);
  }

  if (defects.length === 0) {
    console.log("[globalTeardown] strict-browser-defect annotation 0건 — baseline 클린");
  } else {
    const outDir = path.resolve("test-results");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, "strict-defects.json");
    fs.writeFileSync(
      outFile,
      JSON.stringify({ collected_at: new Date().toISOString(), count: defects.length, defects }, null, 2),
      "utf-8",
    );
    console.log(`[globalTeardown] strict-browser-defect ${defects.length} 건 수집 → ${outFile}`);
    if (!fs.existsSync(reportFile)) {
      console.log("[globalTeardown] tip: pnpm exec playwright show-report 로 spec 별 annotation 확인 가능.");
    }
  }
}

function collectFromAny(node: unknown, out: DefectEntry[], specPath = "?", testTitle = "?"): void {
  if (node === null || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  // playwright 내부 노드의 typed shapes — defensive.
  const file = typeof obj.file === "string" ? obj.file : (typeof obj.location === "object" && obj.location !== null ? (obj.location as Record<string, unknown>).file as string : specPath);
  const title = typeof obj.title === "string" ? obj.title : testTitle;
  const nextSpec = typeof file === "string" ? file : specPath;
  const nextTest = typeof title === "string" ? title : testTitle;

  // annotations 배열 발견 시 strict-browser-defect 만 추출.
  if (Array.isArray(obj.annotations)) {
    for (const a of obj.annotations) {
      if (
        a && typeof a === "object" &&
        (a as Record<string, unknown>).type === "strict-browser-defect"
      ) {
        const desc = (a as Record<string, unknown>).description;
        out.push({
          spec: nextSpec,
          test: nextTest,
          description: typeof desc === "string" ? desc : JSON.stringify(desc),
        });
      }
    }
  }

  // 자식 컬렉션 재귀 — children/tests/results/suites 등 어떤 키든.
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (Array.isArray(v)) {
      for (const child of v) collectFromAny(child, out, nextSpec, nextTest);
    } else if (v && typeof v === "object") {
      collectFromAny(v, out, nextSpec, nextTest);
    }
  }
}

/**
 * 박철T(T2) 매치업 실사용 만족도 평가 — 학원장 자격 read-only 시각 검수.
 *
 * 목적: 매치업 도메인 실제 산출물(매치업 메인/검수 UI/HitReport 리스트/편집기 2-pane/PDF/ZIP)을
 * 학원장 관점에서 캡처해 만족도 점수를 매김. 직접 결과물을 봐야 함 — 메트릭/회귀 PASS만으로는 판단 X.
 *
 * read-only — 새 doc 업로드/삭제/edit/submit 없음. PDF/ZIP은 다운로드만, 발송 없음.
 */
import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { loginViaUI } from "../helpers/auth";

const BASE = "https://tchul.com";
const SHOT_DIR = "e2e/_artifacts/matchup-realuse-eval-2026-05-05";
const DOWNLOAD_DIR = path.join(SHOT_DIR, "downloads");

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
});

test.describe("박철T 매치업 실사용 만족도 평가 (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "tchul-admin");
  });

  test("01 매치업 메인 — doc 리스트 + 카테고리 분포", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: `${SHOT_DIR}/01-matchup-main.png`,
      fullPage: true,
    });

    const rows = page.locator('[data-testid="matchup-doc-row"]');
    const count = await rows.count();
    console.log(`[01] doc rows visible: ${count}`);

    // 카테고리 트리 텍스트 캡쳐 — 분포 일별 데이터로 보존
    const treeText = await page.locator("body").innerText();
    fs.writeFileSync(`${SHOT_DIR}/01-page-text.txt`, treeText);
    expect(count).toBeGreaterThan(0);
  });

  test("02 doc detail — 검수 UI / 결함 doc 시각", async ({ page }) => {
    const titles = ["통합과학", "은광", "중대부고", "언남", "박철"];
    await page.goto(`${BASE}/admin/storage/matchup`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(2000);

    let opened = 0;
    for (const t of titles) {
      const row = page
        .locator('[data-testid="matchup-doc-row"]')
        .filter({ hasText: t })
        .first();
      if (!(await row.isVisible().catch(() => false))) {
        console.log(`[02] SKIP "${t}" not visible`);
        continue;
      }
      await row.click();
      await page.waitForTimeout(2500);
      const safe = t.replace(/[^\w가-힣]/g, "_");
      await page.screenshot({
        path: `${SHOT_DIR}/02-doc-${safe}.png`,
        fullPage: true,
      });
      opened += 1;
      // 다음 doc 클릭으로 패널 갱신 — 모달 닫기 X (메인 페이지 좌우 패널)
    }
    console.log(`[02] opened ${opened}/${titles.length}`);
    expect(opened).toBeGreaterThan(0);
  });

  test("03 HitReport 리스트 — 진행률 + draft alert", async ({ page }) => {
    await page.goto(`${BASE}/admin/hit-reports`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: `${SHOT_DIR}/03-hit-reports-list.png`,
      fullPage: true,
    });

    const text = await page.locator("body").innerText();
    fs.writeFileSync(`${SHOT_DIR}/03-page-text.txt`, text);

    // 통산 적중률 / 작성중 N건 / 카드 보이는지 점검
    const hasReportCard = await page.locator('[role="button"]').count();
    console.log(`[03] interactive items: ${hasReportCard}`);
  });

  test("04 HitReport 편집기 — 2-pane + 후보 리스트", async ({ page }) => {
    await page.goto(`${BASE}/admin/hit-reports`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(2500);

    const card = page.locator('[role="button"]').filter({ hasText: /작성|제출/ }).first();
    const visible = await card.isVisible().catch(() => false);
    if (!visible) {
      console.log("[04] no card");
      test.skip(true, "no hit report card");
      return;
    }
    await card.click();
    await page.waitForTimeout(4000);
    await page.screenshot({
      path: `${SHOT_DIR}/04-editor-overview.png`,
      fullPage: true,
    });

    // 후보 리스트가 있다면 두 번째 문항 클릭 캡쳐 — 다양성 보강
    const qList = page.locator('[data-testid^="hit-q-"]');
    const qCount = await qList.count();
    console.log(`[04] q items: ${qCount}`);
    if (qCount >= 2) {
      await qList.nth(1).click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: `${SHOT_DIR}/04-editor-q2.png`,
        fullPage: true,
      });
    }
  });

  test("05 PDF/ZIP 산출물 다운로드 시도", async ({ page }) => {
    await page.goto(`${BASE}/admin/hit-reports`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(2500);

    const card = page.locator('[role="button"]').filter({ hasText: /작성|제출/ }).first();
    if (!(await card.isVisible().catch(() => false))) {
      test.skip(true, "no card");
      return;
    }
    await card.click();
    await page.waitForTimeout(4000);

    const accessToken = await page.evaluate(() => localStorage.getItem("access"));
    expect(accessToken).toBeTruthy();

    // 보고서 ID 추출 — URL/state 쪽에 노출 안 될 수 있으니 API list로 첫 id 가져오기
    const listResp = await page.request.get(
      "https://api.hakwonplus.com/api/v1/matchup/hit-reports/?mine=false",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Tenant-Code": "tchul",
        },
        timeout: 30_000,
      },
    );
    expect(listResp.status(), "hit-report list API").toBe(200);
    const listJson = await listResp.json();
    const reports = listJson.reports ?? listJson.results ?? [];
    fs.writeFileSync(
      `${SHOT_DIR}/05-list-summary.json`,
      JSON.stringify({ summary: listJson.summary, total: reports.length, sample: reports.slice(0, 3) }, null, 2),
    );
    console.log(`[05] reports total=${reports.length}`);
    if (reports.length === 0) {
      test.skip(true, "no report");
      return;
    }

    // 첫 번째 보고서로 PDF/ZIP 시도
    const reportId = reports[0].id;
    console.log(`[05] reportId=${reportId}`);

    // PDF 시도 — 큐레이트된 게 없으면 400/422일 수도. 응답 헤더만 보존.
    const pdfResp = await page.request.get(
      `https://api.hakwonplus.com/api/v1/matchup/hit-reports/${reportId}/curated.pdf`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Tenant-Code": "tchul",
        },
        timeout: 90_000,
      },
    );
    console.log(`[05] PDF status=${pdfResp.status()}`);
    const pdfHeaders = pdfResp.headers();
    fs.writeFileSync(
      `${SHOT_DIR}/05-pdf-headers.json`,
      JSON.stringify({ status: pdfResp.status(), headers: pdfHeaders }, null, 2),
    );
    if (pdfResp.status() === 200) {
      const buf = await pdfResp.body();
      fs.writeFileSync(path.join(DOWNLOAD_DIR, `report-${reportId}.pdf`), buf);
      const head = buf.slice(0, 8).toString();
      console.log(`[05] PDF bytes=${buf.length} head="${head}"`);
      fs.writeFileSync(
        `${SHOT_DIR}/05-pdf-summary.txt`,
        `bytes=${buf.length}\nhead=${head}\n`,
      );
    } else {
      const body = await pdfResp.text();
      fs.writeFileSync(`${SHOT_DIR}/05-pdf-error.txt`, body.slice(0, 4000));
    }

    // ZIP 시도
    const zipResp = await page.request.get(
      `https://api.hakwonplus.com/api/v1/matchup/hit-reports/${reportId}/share.zip`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Tenant-Code": "tchul",
        },
        timeout: 120_000,
      },
    );
    console.log(`[05] ZIP status=${zipResp.status()}`);
    fs.writeFileSync(
      `${SHOT_DIR}/05-zip-headers.json`,
      JSON.stringify({ status: zipResp.status(), headers: zipResp.headers() }, null, 2),
    );
    if (zipResp.status() === 200) {
      const buf = await zipResp.body();
      fs.writeFileSync(path.join(DOWNLOAD_DIR, `report-${reportId}.zip`), buf);
      const head = buf.slice(0, 4).toString("hex");
      console.log(`[05] ZIP bytes=${buf.length} head=${head}`);
      fs.writeFileSync(
        `${SHOT_DIR}/05-zip-summary.txt`,
        `bytes=${buf.length}\nhead-hex=${head}\n`,
      );
    } else {
      const body = await zipResp.text();
      fs.writeFileSync(`${SHOT_DIR}/05-zip-error.txt`, body.slice(0, 4000));
    }
  });

  test("06 매치업 통계 / 카테고리 풀 사이즈 (API)", async ({ page }) => {
    const accessToken = await page.evaluate(async () => {
      // 강제 fresh: localStorage 빈 상태 가능 → 한번 더 dashboard 거쳐 토큰 확보
      return localStorage.getItem("access");
    });
    if (!accessToken) {
      // 로그인 페이지 거쳐 dashboard로 이동
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    }
    const tok = await page.evaluate(() => localStorage.getItem("access"));
    expect(tok).toBeTruthy();

    const docResp = await page.request.get(
      "https://api.hakwonplus.com/api/v1/matchup/documents/",
      {
        headers: {
          Authorization: `Bearer ${tok}`,
          "X-Tenant-Code": "tchul",
        },
        timeout: 60_000,
      },
    );
    expect(docResp.status(), "matchup documents API").toBe(200);
    const docJson = await docResp.json();
    const docs: Array<Record<string, unknown>> = docJson.documents ?? docJson.results ?? docJson;
    const total = docs.length;
    const byCat: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let totalProblems = 0;
    for (const d of docs) {
      const cat = String(d.category ?? d.category_name ?? "(none)");
      byCat[cat] = (byCat[cat] ?? 0) + 1;
      const src = String(d.source_type ?? "(none)");
      bySource[src] = (bySource[src] ?? 0) + 1;
      const pc = Number((d as { problem_count?: number }).problem_count ?? 0);
      if (Number.isFinite(pc)) totalProblems += pc;
    }
    const sample = docs.slice(0, 5).map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      source_type: d.source_type,
      problem_count: (d as { problem_count?: number }).problem_count,
      status: d.status,
    }));
    fs.writeFileSync(
      `${SHOT_DIR}/06-doc-stats.json`,
      JSON.stringify({ total, totalProblems, byCat, bySource, sample }, null, 2),
    );
    console.log(`[06] total=${total} problems=${totalProblems}`);
  });
});

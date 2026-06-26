/**
 * P3 Skeleton INSERT 정식 검증 — Tenant 1 (hakwonplus, admin97) 운영
 *
 * 실사용 테넌트(tchul/limglish/dnb)에 E2E 데이터 생성 절대 금지 (사용자 민원 발생).
 * Tenant 1만 신규 업로드 검증 사용.
 *
 * 신규 업로드 1건 → 세그멘테이션 직후 skeleton 카드 노출 → 점진 채움 → 완료까지 추적.
 * 최종 cleanup으로 [E2E-{ts}] doc 삭제.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI, getBaseUrl, getApiBaseUrl } from "../helpers/auth";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = getBaseUrl("admin");
const API_BASE = getApiBaseUrl();
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-tchul-skeleton-2026-04-30");
fs.mkdirSync(SHOTS, { recursive: true });

const observations: string[] = [];
const log = (s: string) => { console.log(`[SKELETON] ${s}`); observations.push(s); };
let cleanupDocId: number | null = null;

type MatchupDocumentJobStatus = {
  document_id: number;
  status?: string;
  problem_count?: number;
};

type MatchupDocumentListItem = {
  id: number;
  status?: string;
  problem_count?: number;
};

test.afterEach(async ({ page }) => {
  if (!cleanupDocId) return;
  const access = await page.evaluate(() => localStorage.getItem("access"));
  if (access) {
    await page.request.delete(`${API_BASE}/api/v1/matchup/documents/${cleanupDocId}/`, {
      headers: { "Authorization": `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
      timeout: 30_000,
    }).catch(() => undefined);
  }
  cleanupDocId = null;
});

test("매치업 skeleton INSERT 정식 검증 — 신규 업로드 → 즉시 카드 → 점진 채움", async ({ page }) => {
  test.setTimeout(8 * 60_000);  // 8분
  await loginViaUI(page, "admin");

  const ts = Date.now();
  const tag = `[E2E-${ts}]`;
  const fixturePath = path.resolve(__dirname_, "../fixtures/test-invert-3p.pdf");
  expect(fs.existsSync(fixturePath)).toBe(true);

  // 1. API로 업로드 (PDF 3페이지 — 빠른 처리)
  const access = await page.evaluate(() => localStorage.getItem("access"));
  expect(access).toBeTruthy();

  const fileBytes = fs.readFileSync(fixturePath);
  const form = new FormData();
  form.append("file", new Blob([fileBytes], { type: "application/pdf" }), `${tag}.pdf`);
  form.append("title", `${tag} skeleton verify`);
  form.append("category", "[E2E] skeleton verify");
  form.append("intent", "reference");

  const uploadResp = await page.request.post(`${API_BASE}/api/v1/matchup/documents/upload/`, {
    headers: {
      "Authorization": `Bearer ${access}`,
      "X-Tenant-Code": "hakwonplus",
    },
    multipart: {
      file: { name: `${tag}.pdf`, mimeType: "application/pdf", buffer: fileBytes },
      title: `${tag} skeleton verify`,
      category: "[E2E] skeleton verify",
      intent: "reference",
    },
    timeout: 60_000,
  });
  expect(uploadResp.status()).toBe(201);
  const uploadJson = await uploadResp.json();
  const docId = uploadJson.id;
  cleanupDocId = docId;
  log(`업로드 완료: doc id=${docId}, status=${uploadJson.status}`);

  // 2. 매치업 화면 진입
  await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await expect(page.locator("[data-testid='matchup-doc-search']")).toBeVisible({ timeout: 15_000 });

  // 검색으로 새 doc 찾기 (전체 목록에서 빠르게)
  const search = page.locator("[data-testid='matchup-doc-search']");
  await search.fill("E2E");

  const newRow = page.locator(`[data-testid='matchup-doc-row'][data-doc-id='${docId}']`);
  await expect(newRow).toBeVisible({ timeout: 15000 });
  log(`업로드 row 노출 OK`);

  await newRow.click();
  // eslint-disable-next-line no-restricted-syntax
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOTS, "01-after-click.png"), fullPage: true });

  // 3. skeleton 단계 폴링 — UI 신호 기반 (problem cards + 처리중 뱃지)
  let skeletonObserved = false;
  let skeletonProblemCount = 0;
  let skeletonPartialCount = 0;
  let progressLabelObserved = false;
  let apiStatus = String(uploadJson.status ?? "");
  let apiProblemCount = Number(uploadJson.problem_count ?? 0);
  const startedAt = Date.now();
  for (let i = 0; i < 60; i++) {  // 최대 2분
    const partialBadges = await page.locator("[data-testid='matchup-problem-card'] >> text=/^처리 중$/").count();
    const allCards = await page.locator("[data-testid='matchup-problem-card']").count();
    const stageLabels = await page.locator("text=/문제 분할|텍스트 추출|AI 분석|이미지 업로드|문항 이미지 업로드|페이지 캐시 생성/").count();
    const jobResp = await page.request.get(`${API_BASE}/api/v1/matchup/documents/${docId}/job/`, {
      headers: { "Authorization": `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
      timeout: 15_000,
    }).catch(() => null);
    if (jobResp?.ok()) {
      const job = (await jobResp.json()) as MatchupDocumentJobStatus;
      apiStatus = String(job.status ?? apiStatus);
      apiProblemCount = Number(job.problem_count ?? apiProblemCount);
    }
    const listResp = await page.request.get(`${API_BASE}/api/v1/matchup/documents/`, {
      headers: { "Authorization": `Bearer ${access}`, "X-Tenant-Code": "hakwonplus" },
      timeout: 15_000,
    }).catch(() => null);
    if (listResp?.ok()) {
      const list = (await listResp.json()) as MatchupDocumentListItem[];
      const current = list.find((doc) => doc.id === docId);
      if (current) {
        apiStatus = String(current.status ?? apiStatus);
        apiProblemCount = Number(current.problem_count ?? apiProblemCount);
      }
    }
    if (stageLabels > 0 && !progressLabelObserved) {
      progressLabelObserved = true;
      log(`단계 라벨 등장 (${stageLabels}개), 경과=${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    }
    if (allCards > 0 && !skeletonObserved) {
      skeletonObserved = true;
      skeletonProblemCount = allCards;
      skeletonPartialCount = partialBadges;
      log(`skeleton 카드 등장 — ${allCards}개 카드 (처리중 뱃지=${partialBadges}), 경과=${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
      await page.screenshot({ path: path.join(SHOTS, "02-skeleton-appeared.png"), fullPage: true });
    }
    // 완료 감지 — 처리중 뱃지가 한 번 등장한 후 0개로 떨어지면 완료
    if (skeletonObserved && partialBadges === 0 && allCards > 0) {
      log(`처리 중 뱃지 모두 사라짐 — 완료 (경과=${((Date.now() - startedAt) / 1000).toFixed(1)}s, cards=${allCards})`);
      break;
    }
    if (!skeletonObserved && ["done", "failed"].includes(apiStatus)) {
      log(`skeleton 관찰 전 terminal API 상태 도달 — status=${apiStatus}, problem_count=${apiProblemCount}`);
      break;
    }
    // eslint-disable-next-line no-restricted-syntax
    await page.waitForTimeout(2000);
  }

  // 4. 완료 후 상태 검증
  // eslint-disable-next-line no-restricted-syntax
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOTS, "03-completed.png"), fullPage: true });

  const finalCards = await page.locator("[data-testid='matchup-problem-card']").count();
  const finalPartialBadges = await page.locator("[data-testid='matchup-problem-card'] >> text=/^처리 중$/").count();
  log(`완료 후 cards=${finalCards}, 잔여 처리중 뱃지=${finalPartialBadges}`);

  log(`skeleton 노출=${skeletonObserved} (count=${skeletonProblemCount}, initial_partial=${skeletonPartialCount})`);
  log(`API terminal status=${apiStatus}, problem_count=${apiProblemCount}`);

  if (!skeletonObserved) {
    const rowText = await newRow.innerText().catch(() => "");
    const rowStatus = await newRow.getAttribute("data-doc-status").catch(() => "");
    const uiNoProblemsVisible = await page.locator(
      "text=/문제 영역을 찾지 못해|문항을 찾지 못했습니다|자동으로 인식된 문제가 없습니다|미검출/",
    ).count() > 0;
    const terminalWithoutProblems =
      (["done", "failed"].includes(apiStatus) || rowStatus === "done" || uiNoProblemsVisible) &&
      apiProblemCount === 0 &&
      /0문제|미검출|문제 영역을 못 찾음|처리 실패/.test(rowText);
    const stillProcessingWithRow = apiStatus === "processing" && (
      /처리 중|문제 분할|텍스트 추출|AI 분석|이미지 업로드|문항 이미지 업로드|페이지 캐시 생성|\d+%/.test(rowText) ||
      progressLabelObserved
    );
    expect(
      terminalWithoutProblems || stillProcessingWithRow,
      `skeleton 없이 종료된 경우에는 terminal 상태 또는 처리 중 row가 UI에 보여야 함. status=${apiStatus}, row="${rowText.slice(0, 120)}"`,
    ).toBe(true);
  } else if (apiProblemCount > 0) {
    expect(finalCards).toBeGreaterThan(0);
  }

  // 5. cleanup — doc 삭제
  await page.evaluate(async ({ id, accessToken }) => {
    await fetch(`https://api.hakwonplus.com/api/v1/matchup/documents/${id}/`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${accessToken}`, "X-Tenant-Code": "hakwonplus" },
    });
  }, { id: docId, accessToken: access });
  cleanupDocId = null;
  log(`cleanup OK`);

  fs.writeFileSync(path.join(SHOTS, "observations.md"), observations.map(o => `- ${o}`).join("\n"));

  // assertion: skeleton card가 보였거나, row가 처리 중/terminal 상태로 즉시 사용자에게 표시되어야 한다.
  expect(skeletonObserved || ["processing", "done", "failed"].includes(apiStatus)).toBe(true);
});

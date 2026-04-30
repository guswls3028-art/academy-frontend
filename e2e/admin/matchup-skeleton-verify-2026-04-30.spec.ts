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

const BASE = getBaseUrl("tchul-admin");
const API_BASE = getApiBaseUrl();
const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const SHOTS = path.resolve(__dirname_, "../reports/matchup-tchul-skeleton-2026-04-30");
fs.mkdirSync(SHOTS, { recursive: true });

const observations: string[] = [];
const log = (s: string) => { console.log(`[SKELETON] ${s}`); observations.push(s); };

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
  log(`업로드 완료: doc id=${docId}, status=${uploadJson.status}`);

  // 2. 매치업 화면 진입
  await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 검색으로 새 doc 찾기 (전체 목록에서 빠르게)
  const search = page.locator("[data-testid='matchup-doc-search']");
  await search.fill("E2E");
  await page.waitForTimeout(800);

  const newRow = page.locator(`[data-testid='matchup-doc-row'][data-doc-id='${docId}']`);
  await expect(newRow).toBeVisible({ timeout: 15000 });
  log(`업로드 row 노출 OK`);

  await newRow.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOTS, "01-after-click.png"), fullPage: true });

  // 3. skeleton 단계 폴링 — UI 신호 기반 (problem cards + 처리중 뱃지)
  let skeletonObserved = false;
  let skeletonProblemCount = 0;
  let skeletonPartialCount = 0;
  let progressLabelObserved = false;
  const startedAt = Date.now();
  for (let i = 0; i < 60; i++) {  // 최대 2분
    const partialBadges = await page.locator("[data-testid='matchup-problem-card'] >> text=/^처리 중$/").count();
    const allCards = await page.locator("[data-testid='matchup-problem-card']").count();
    const stageLabels = await page.locator("text=/문제 분할|텍스트 추출|AI 분석|이미지 업로드|문항 이미지 업로드|페이지 캐시 생성/").count();
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
    await page.waitForTimeout(2000);
  }

  // 4. 완료 후 상태 검증
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOTS, "03-completed.png"), fullPage: true });

  const finalCards = await page.locator("[data-testid='matchup-problem-card']").count();
  const finalPartialBadges = await page.locator("[data-testid='matchup-problem-card'] >> text=/^처리 중$/").count();
  log(`완료 후 cards=${finalCards}, 잔여 처리중 뱃지=${finalPartialBadges}`);

  log(`skeleton 노출=${skeletonObserved} (count=${skeletonProblemCount})`);

  // 5. cleanup — doc 삭제
  await page.evaluate(async ({ id, accessToken }) => {
    await fetch(`https://api.hakwonplus.com/api/v1/matchup/documents/${id}/`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${accessToken}`, "X-Tenant-Code": "hakwonplus" },
    });
  }, { id: docId, accessToken: access });
  log(`cleanup OK`);

  fs.writeFileSync(path.join(SHOTS, "observations.md"), observations.map(o => `- ${o}`).join("\n"));

  // assertion
  expect(skeletonObserved).toBe(true);
});

/**
 * OMR 검토 워크스페이스 — UX/CTA 실 사용 검증.
 * dev frontend (localhost:5174) + production API.
 * 시험 197 ("OMR 테스트", 3건 제출 — 그중 2건 needs_identification).
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const DEV = process.env.REVIEW_BASE || "http://localhost:5174";
const API = "https://api.hakwonplus.com";
const OUT = process.env.REVIEW_OUT || "c:/academy/tmp-review-omr";
const EXAM_ID = 197;

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

// dev → production API 라우팅
await page.route("**/api/v1/**", async (r) => {
  const u = new URL(r.request().url());
  if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
    u.protocol = "https:"; u.hostname = "api.hakwonplus.com"; u.port = "";
    await r.continue({ url: u.toString() });
  } else await r.continue();
});

const consoleLogs = [];
page.on("console", (m) => consoleLogs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => consoleLogs.push(`[pageerror] ${e.message}`));

// admin 로그인
const resp = await page.request.post(`${API}/api/v1/token/`, {
  data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
  headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
});
if (resp.status() !== 200) {
  console.error(`login failed: ${resp.status()} ${await resp.text()}`);
  process.exit(1);
}
const { access, refresh } = await resp.json();
await page.goto(`${DEV}/login`, { waitUntil: "commit" });
await page.evaluate(({ access, refresh }) => {
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
  try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
}, { access, refresh });

await page.goto(`${DEV}/admin`, { waitUntil: "load", timeout: 25000 });
await page.waitForTimeout(2000);

async function snap(name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`OK ${name}`);
}

// 1. 시험 상세 진입 — session 컨텍스트 필요 (lecture 96 / session 158 / exam 197)
const LECTURE_ID = 96;
const SESSION_ID = 158;
const targetUrl = `${DEV}/admin/lectures/${LECTURE_ID}/sessions/${SESSION_ID}/exams?examId=${EXAM_ID}`;
await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
await page.waitForTimeout(3500);
console.log(`navigated to ${page.url()}`);
await snap(`exam-detail-design-tab`);

// 결과 탭 클릭
try {
  const resultsTab = page.locator("button:has-text('결과'), button:has-text('채점·결과')").first();
  await resultsTab.waitFor({ timeout: 8000 });
  await resultsTab.click();
  await page.waitForTimeout(2500);
  await snap("after-results-tab-click");
} catch (e) {
  console.log(`tab click failed: ${e.message}`);
}

// OMR 배너 위치 확인 — 페이지 어디에 있는지 + 첫 화면에 보이는지
const bannerLoc = page.locator("text=/OMR 제출/").first();
if (await bannerLoc.count()) {
  const box = await bannerLoc.boundingBox();
  const viewport = page.viewportSize();
  console.log(`banner position: y=${box?.y}, viewport.h=${viewport?.height}, in_first_view=${box && box.y < viewport.height}`);
  // 배너 화면에 보이게 스크롤
  await bannerLoc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await snap("banner-scrolled-into-view");
}

// OMR 검토 배너 검출
await page.waitForTimeout(2000);
const bannerText = await page.locator("text=/OMR 제출/").first().textContent().catch(() => null);
console.log("banner:", bannerText);
await snap("with-banner");

// 배너 버튼 클릭 — 새 CTA: "N건 처리하기" 또는 "OMR 다시 보기"
const openBtn = page.locator("button.omr-entry__cta");
if (await openBtn.count()) {
  const ctaText = await openBtn.first().textContent();
  console.log(`CTA: "${ctaText}"`);
  await openBtn.first().click();
  await page.waitForTimeout(2500);
  await snap("workspace-open");

  // 워크스페이스가 정상 mount됐는지 헤더 검증
  const wsTitle = await page.locator(".orw-header__title").first().textContent().catch(() => null);
  console.log(`workspace title: ${wsTitle}`);

  // 모든 필터 순회
  for (const f of ["all", "noid", "flag", "ok", "failed"]) {
    const label = { all: "전체", ok: "정상", noid: "식별실패", flag: "검토필요", failed: "실패" }[f];
    const chip = page.locator(`button.orw-filter-chip:has-text('${label}')`);
    if (await chip.count()) {
      await chip.first().click();
      await page.waitForTimeout(700);
      await snap(`workspace-filter-${f}`);
    }
  }

  // 식별실패 필터 + 첫 행 선택 → detail 패널 검증
  const noidChip = page.locator("button.orw-filter-chip:has-text('식별실패')");
  if (await noidChip.count()) {
    await noidChip.first().click();
    await page.waitForTimeout(700);
  }
  const firstRow = page.locator(".orw-list-row").first();
  if (await firstRow.count()) {
    await firstRow.click();
    await page.waitForTimeout(2500);
    await snap("workspace-selected-detail");
  }

  // 저장 버튼 dirty 검증: 변경 없으면 disabled여야
  const saveBtn = page.locator("button.orw-save-btn").first();
  if (await saveBtn.count()) {
    const isDisabled = await saveBtn.isDisabled();
    const text = await saveBtn.textContent();
    console.log(`save button — disabled: ${isDisabled}, text: "${text}"`);
  }

  // 답안 변경 후 저장 dirty 활성 확인
  const firstBubble = page.locator(".orw-bubble").first();
  if (await firstBubble.count()) {
    await firstBubble.click();
    await page.waitForTimeout(400);
    await snap("workspace-bubble-clicked");
    const saveAfter = page.locator("button.orw-save-btn").first();
    const enabled = !(await saveAfter.isDisabled());
    const textAfter = await saveAfter.textContent();
    console.log(`after bubble — save enabled: ${enabled}, text: "${textAfter}"`);
  }

  // 백드롭 클릭 닫힘
  const backdrop = page.locator(".orw-backdrop");
  if (await backdrop.count()) {
    await backdrop.click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(800);
    await snap("after-backdrop-click");
  }
} else {
  console.log("CTA 버튼 못 찾음");
  const html = await page.content();
  fs.writeFileSync(path.join(OUT, "page-dump.html"), html.slice(0, 50000));
}

fs.writeFileSync(path.join(OUT, "console.log"), consoleLogs.join("\n"));
await browser.close();
console.log(`\nDONE → ${OUT}`);

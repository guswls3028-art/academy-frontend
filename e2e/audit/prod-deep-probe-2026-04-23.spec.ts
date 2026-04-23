/**
 * 운영 심층 검증 (2026-04-23) — 1차 감사에서 포착된 의심점 재현
 *
 * 1. 시험/영상 1차시 선택 후 로딩 스피너 지속 여부
 * 2. 클리닉 탭별 진입 렌더
 * 3. 메시지 템플릿 클릭 모달 렌더
 * 4. 학생 상세 탭 전환 (수강/시험/과제/클리닉/질문)
 * 5. 학생앱(student) 로그인 → 메인 → 주요 탭
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "../helpers/auth";
import * as fs from "fs";
import * as path from "path";

const DIR = "e2e/screenshots/prod-audit-2026-04-23/deep";
const REPORT = "e2e/reports/prod-deep-probe-2026-04-23.md";

type Finding = { area: string; level: "FAIL" | "WARN" | "INFO"; msg: string };
const findings: Finding[] = [];

async function shot(page: Page, name: string) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage: true }).catch(() => {});
}

async function waitSettled(page: Page, ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function bodyHasText(page: Page, re: RegExp): Promise<boolean> {
  const t = (await page.locator("body").innerText().catch(() => "")) || "";
  return re.test(t);
}

test.describe.configure({ mode: "serial" });

test.describe("운영 심층 검증 (hakwonplus.com / 2026-04-23)", () => {
  test.setTimeout(300_000);

  test("관리자 심층 + 학생앱 핵심 흐름", async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const page = await adminCtx.newPage();
    await loginViaUI(page, "admin");
    await waitSettled(page);

    /* ──────────── 1. 시험: 1차시 클릭 후 로딩 지속? ──────────── */
    await page.goto(getBaseUrl("admin") + "/admin/exams", { waitUntil: "load" });
    await waitSettled(page, 2000);
    await shot(page, "exams-initial");

    // 좌측 트리에서 차수/회차 항목 클릭 (첫번째 2단 node)
    const examSubNode = page.locator("text=/\\d+차시/").first();
    if (await examSubNode.count() > 0) {
      await examSubNode.click().catch(()=>{});
      await waitSettled(page, 3000);
      await shot(page, "exams-after-click-3s");
      // 추가로 더 기다려서 스피너 해제되는지
      await page.waitForTimeout(5000);
      await shot(page, "exams-after-click-8s");
      const stuck = await bodyHasText(page, /시험 목록 불러오는 중/);
      if (stuck) {
        findings.push({ area: "exams", level: "FAIL", msg: "차시 선택 후 8초 지나도 '시험 목록 불러오는 중' 스피너가 해제되지 않음" });
      } else {
        findings.push({ area: "exams", level: "INFO", msg: "차시 선택 후 로딩 정상 종료 (8초 내)" });
      }
    } else {
      findings.push({ area: "exams", level: "INFO", msg: "시험 차시 노드 없음 (데이터 없음)" });
    }

    /* ──────────── 2. 영상: 1차시 클릭 후 로딩 지속? ──────────── */
    await page.goto(getBaseUrl("admin") + "/admin/videos", { waitUntil: "load" });
    await waitSettled(page, 2000);
    await shot(page, "videos-initial");

    const vidSubNode = page.locator("text=/\\d+차시/").first();
    if (await vidSubNode.count() > 0) {
      await vidSubNode.click().catch(()=>{});
      await waitSettled(page, 3000);
      await shot(page, "videos-after-click-3s");
      await page.waitForTimeout(5000);
      await shot(page, "videos-after-click-8s");
      const stuck = await bodyHasText(page, /영상 목록 불러오는 중/);
      if (stuck) {
        findings.push({ area: "videos", level: "FAIL", msg: "차시 선택 후 8초 지나도 '영상 목록 불러오는 중' 스피너가 해제되지 않음" });
      } else {
        findings.push({ area: "videos", level: "INFO", msg: "차시 선택 후 로딩 정상 종료 (8초 내)" });
      }
    } else {
      findings.push({ area: "videos", level: "INFO", msg: "영상 차시 노드 없음" });
    }

    /* ──────────── 3. 클리닉 각 탭 ──────────── */
    await page.goto(getBaseUrl("admin") + "/admin/clinic", { waitUntil: "load" });
    await waitSettled(page, 1500);
    const clinicTabs = ["오늘", "클리닉 진행", "진행중 항목", "패스카드", "메시지 설정"];
    for (const tab of clinicTabs) {
      const btn = page.locator(`button:has-text("${tab}"), a:has-text("${tab}")`).first();
      if (await btn.count() === 0) continue;
      await btn.click({ timeout: 5000 }).catch(()=>{});
      await waitSettled(page, 1500);
      await shot(page, `clinic-tab-${tab.replace(/\s/g,'_')}`);
      const len = ((await page.locator("main, [role='main'], body").innerText().catch(() => "")) || "").length;
      if (len < 60) {
        findings.push({ area: "clinic", level: "FAIL", msg: `[${tab}] 탭 내용이 거의 없음 (${len}자)` });
      }
    }

    /* ──────────── 4. 메시지 템플릿 → 편집 모달 ──────────── */
    await page.goto(getBaseUrl("admin") + "/admin/message", { waitUntil: "load" });
    await waitSettled(page, 1500);
    // 템플릿 카드의 "수정" 버튼(연필 아이콘)에 대응되는 버튼 탐색 — aria-label 혹은 title 기반
    const editBtn = page.locator("[aria-label*='수정'], button[title*='수정']").first();
    if (await editBtn.count() > 0) {
      await editBtn.click().catch(()=>{});
      await waitSettled(page, 1500);
      await shot(page, "message-template-edit-modal");
      const modalVisible = await page.locator("[role='dialog'], .modal, .ModalBase").first().isVisible().catch(()=>false);
      if (!modalVisible) {
        findings.push({ area: "message", level: "WARN", msg: "템플릿 수정 버튼 클릭 후 모달이 보이지 않음" });
      } else {
        findings.push({ area: "message", level: "INFO", msg: "템플릿 수정 모달 정상 오픈" });
      }
      // 모달 닫기
      await page.keyboard.press("Escape").catch(()=>{});
    } else {
      findings.push({ area: "message", level: "INFO", msg: "수정 버튼 미발견 (템플릿 없음 또는 라벨 변경)" });
    }

    /* ──────────── 5. 학생 상세 탭 순회 ──────────── */
    await page.goto(getBaseUrl("admin") + "/admin/students", { waitUntil: "load" });
    await waitSettled(page, 1500);
    // 첫 행 클릭
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.count() > 0) {
      await firstRow.click().catch(()=>{});
      await waitSettled(page, 1500);
      const tabs = ["수강", "시험", "과제", "클리닉", "질문"];
      for (const tab of tabs) {
        const t = page.locator(`[role='dialog'] button:has-text("${tab}"), [role='dialog'] [role='tab']:has-text("${tab}")`).first();
        if (await t.count() === 0) continue;
        await t.click().catch(()=>{});
        await page.waitForTimeout(800);
        await shot(page, `student-detail-tab-${tab}`);
      }
      findings.push({ area: "student-detail", level: "INFO", msg: "학생 상세 탭 순회 완료" });
    }

    await adminCtx.close();

    /* ──────────── 6. 학생앱 로그인 + 주요 탭 ──────────── */
    const stuCtx = await browser.newContext();
    const spage = await stuCtx.newPage();
    try {
      await loginViaUI(spage, "student");
      await waitSettled(spage, 2000);
      await shot(spage, "student-app-home");
      const url = spage.url();
      findings.push({ area: "student-app", level: "INFO", msg: `학생앱 로그인 성공 (url=${url})` });

      // 학생앱은 보통 하단/상단 탭 기반. 텍스트 기반 탐색.
      const stuTabs = ["홈", "수업", "과제", "시험", "클리닉", "커뮤니티", "마이"];
      for (const tab of stuTabs) {
        const btn = spage.locator(`a:has-text("${tab}"), button:has-text("${tab}"), nav :text("${tab}")`).first();
        if (await btn.count() === 0) continue;
        await btn.click({ timeout: 4000 }).catch(()=>{});
        await waitSettled(spage, 1200);
        await shot(spage, `student-app-tab-${tab}`);
        const bt = (await spage.locator("body").innerText().catch(()=>"") || "").length;
        if (bt < 50) findings.push({ area: "student-app", level: "WARN", msg: `[${tab}] 탭 본문이 너무 짧음 (${bt}자)` });
      }
    } catch (e) {
      findings.push({ area: "student-app", level: "FAIL", msg: `학생앱 로그인/네비 실패: ${String(e).slice(0,200)}` });
    }
    await stuCtx.close();

    /* ──────────── 리포트 작성 ──────────── */
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, renderReport(findings), "utf-8");

    const fails = findings.filter(f => f.level === "FAIL");
    console.log(`\n=== Deep probe 결과 ===\nFAIL=${fails.length} WARN=${findings.filter(f=>f.level==='WARN').length} INFO=${findings.filter(f=>f.level==='INFO').length}\nReport: ${REPORT}\n`);
    expect.soft(fails, `FAIL 항목:\n${fails.map(f=>`- [${f.area}] ${f.msg}`).join("\n")}`).toHaveLength(0);
  });
});

function renderReport(list: Finding[]) {
  const by = new Map<string, Finding[]>();
  for (const f of list) {
    const a = by.get(f.area) || [];
    a.push(f); by.set(f.area, a);
  }
  const lines: string[] = [];
  lines.push("# 운영 심층 검증 — 2026-04-23\n");
  lines.push(`- FAIL=${list.filter(f=>f.level==='FAIL').length}  WARN=${list.filter(f=>f.level==='WARN').length}  INFO=${list.filter(f=>f.level==='INFO').length}\n`);
  for (const [area, arr] of by) {
    lines.push(`## ${area}`);
    for (const f of arr) lines.push(`- [${f.level}] ${f.msg}`);
    lines.push("");
  }
  return lines.join("\n");
}

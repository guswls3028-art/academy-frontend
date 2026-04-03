/**
 * 디자인 감사 — 성적 발송 모달 전 상태 상세 캡처
 * 1400x900 뷰포트, 각 상태별 full 캡처
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";
const API = "http://localhost:8000";
const DIR = "e2e/screenshots/audit";

async function login(page: import("@playwright/test").Page) {
  const r = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
  });
  const { access } = await r.json() as { access: string };
  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access }) => {
    localStorage.setItem("access", access);
    try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
  }, { access });
}

test("디자인 감사 — grades 모달 전 상태", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);

  // 성적 탭 진입
  await page.goto(`${BASE}/admin/lectures/92/sessions/90/scores`, { waitUntil: "load" });
  await page.waitForTimeout(6000);
  // 학생 이름 로드 대기
  await page.locator("text=김민수").first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});

  // 학생 1명 선택
  const cbs = page.locator("input[type='checkbox']");
  const cbCount = await cbs.count();
  console.log(`>>> 체크박스 ${cbCount}개`);
  let checked = false;
  for (let i = 0; i < cbCount; i++) {
    const cb = cbs.nth(i);
    if (await cb.isVisible({ timeout: 500 }).catch(() => false)) {
      await cb.check({ force: true });
      checked = true;
      console.log(`>>> checkbox ${i} checked`);
      break;
    }
  }
  if (!checked) { console.log(">>> 체크 실패"); return; }
  await page.waitForTimeout(800);

  // 모달 열기
  const sendBtn = page.locator("button").filter({ hasText: /성적 발송|수업결과 발송/ }).first();
  const btnVisible = await sendBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`>>> 발송 버튼: ${btnVisible}`);
  if (!btnVisible) { await page.screenshot({ path: `${DIR}/00-no-btn.png` }); return; }
  await sendBtn.click();
  await page.waitForTimeout(4000);

  // ── 1. 기본 상태 (양식 로드됨, 본문 있음) ──
  await page.screenshot({ path: `${DIR}/01-default.png` });

  // ── 2. 양식 패널 열기 ──
  const tplBtn = page.locator("button").filter({ hasText: /양식 바꾸기/ }).first();
  await tplBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/02-panel-open.png` });

  // ── 3. 더보기 메뉴 열기 (첫 사용자 양식) ──
  const moreBtn = page.locator("button").filter({ hasText: "⋯" }).first();
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/03-more-menu.png` });
    // 메뉴 닫기 — 검색 입력란 클릭 (모달 내부)
    const searchInput = page.locator("input[placeholder*='양식 검색']").first();
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) await searchInput.click();
    await page.waitForTimeout(300);
  }

  // ── 4. 직접 입력 선택 ──
  const freeBtn = page.locator("button").filter({ hasText: /직접 작성/ }).first();
  if (await freeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await freeBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/04-free-input.png` });
  }

  // ── 5. 빈 상태에서 본문 입력 ──
  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 5000 });
  await textarea.fill("#{학생이름}님 성적 안내\n\n[시험]\n#{시험목록}\n\n[요약]\n#{전체요약}");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/05-with-text.png` });

  // ── 6. 변수 삽입 영역 확인 ──
  // 스크롤해서 변수 영역 보이게
  const varLabel = page.locator("text=변수 삽입").first();
  await varLabel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/06-variables.png` });

  // ── 7. + 시험 추가 클릭 ──
  const addExam = page.locator("button").filter({ hasText: /시험 추가/ }).first();
  if (await addExam.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addExam.click();
    await page.waitForTimeout(300);
    await addExam.click(); // 2번 클릭해서 시험2까지
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/07-exams-added.png` });
  }

  // ── 8. 개별 변수 펼치기 ──
  const foldBtn = page.locator("button").filter({ hasText: /개별 변수/ }).first();
  if (await foldBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await foldBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/08-individual-vars.png` });
    await foldBtn.click(); // 다시 접기
    await page.waitForTimeout(300);
  }

  // ── 9. 새 이름으로 저장 폼 ──
  const saveBtn = page.locator("button").filter({ hasText: "새 이름으로 저장" }).first();
  if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/09-save-form.png` });
    // 취소
    const cancelSave = page.locator("button").filter({ hasText: /^취소$/ }).nth(0);
    if (await cancelSave.isVisible({ timeout: 1000 }).catch(() => false)) await cancelSave.click();
    await page.waitForTimeout(300);
  }

  // ── 10. 양식 선택 후 수정됨 상태 ──
  await tplBtn.click();
  await page.waitForTimeout(800);
  // 첫 사용자 양식 카드 클릭
  const mySection = page.locator("text=내 양식");
  if (await mySection.isVisible({ timeout: 2000 }).catch(() => false)) {
    // 내 양식 다음 형제 카드의 첫 번째 클릭 영역
    const cards = page.locator("div").filter({ has: page.locator("text=내 양식") }).locator("~ div button").first();
    // 대신 양식 카드를 직접 찾기
  }
  // 패널 닫기
  const closeBtn = page.locator("button").filter({ hasText: /^닫기$/ }).first();
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) await closeBtn.click();
  await page.waitForTimeout(300);

  // 본문 수정 → 수정됨
  const currentBody = await textarea.inputValue();
  await textarea.fill(currentBody + "\n\n추가 문구 테스트");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/10-modified.png` });

  // ── 11. 긴 본문 + 미리보기 스크롤 ──
  const longBody = Array.from({ length: 25 }, (_, i) => `${i + 1}번째 줄: 시험 결과를 안내드립니다. 점수 확인 부탁드립니다.`).join("\n");
  await textarea.fill(longBody);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/11-long-content.png` });

  // ── 12. 글자수 경고 (2000자 초과) ──
  const overBody = "가".repeat(2010);
  await textarea.fill(overBody);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/12-over-limit.png` });

  console.log(">>> 디자인 감사 스크린샷 12장 수집 완료");
});

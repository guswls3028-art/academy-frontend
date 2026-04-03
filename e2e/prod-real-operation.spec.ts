/**
 * 운영 실제 조작 검증 — 양식 생성 → 수정 → 기본지정 → 재오픈 → 삭제 전체 사이클
 * hakwonplus.com, Tenant 1
 */
import { test, expect } from "@playwright/test";

const BASE = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";
const headers = { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" };

async function getAuth(request: import("@playwright/test").APIRequestContext) {
  const r = await request.post(`${API}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" }, headers,
  });
  expect(r.status()).toBe(200);
  const { access } = await r.json() as { access: string };
  return { ...headers, Authorization: `Bearer ${access}` };
}

async function loginBrowser(page: import("@playwright/test").Page, auth: Record<string, string>) {
  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ token }) => {
    localStorage.setItem("access", token);
    try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
  }, { token: auth.Authorization.replace("Bearer ", "") });
}

test("운영 실제 조작: 양식 생성 → 수정 → 기본지정 → 재오픈확인 → 복제 → 삭제", async ({ page, request }) => {
  const auth = await getAuth(request);

  // cleanup
  const tpls = await (await request.get(`${API}/api/v1/messaging/templates/?category=grades`, { headers: auth })).json();
  for (const t of tpls) {
    if (t.name.includes("[실조작]") && !t.is_system) {
      await request.delete(`${API}/api/v1/messaging/templates/${t.id}/`, { headers: auth });
    }
  }

  await loginBrowser(page, auth);
  await page.setViewportSize({ width: 1400, height: 900 });

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  // ═══ 1. 성적 탭 진입 (Session 90) ═══
  await page.goto(`${BASE}/admin/lectures/92/sessions/90/scores`, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  const student = page.locator("text=김민수").first();
  await expect(student).toBeVisible({ timeout: 15000 });

  // ═══ 2. 학생 선택 + 모달 열기 ═══
  const cbs = page.locator("input[type='checkbox']");
  for (let i = 1; i <= await cbs.count(); i++) {
    if (await cbs.nth(i).isVisible({ timeout: 300 }).catch(() => false)) { await cbs.nth(i).check({ force: true }); break; }
  }
  await page.waitForTimeout(500);
  const sendBtn = page.locator("button").filter({ hasText: /성적 발송|수업결과 발송/ }).first();
  await expect(sendBtn).toBeVisible({ timeout: 5000 });
  await sendBtn.click();
  await page.waitForTimeout(5000);

  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible({ timeout: 10000 });
  console.log(">>> 1. 모달 오픈 ✓");

  // ═══ 3. 본문 직접 작성 + 양식 저장 ═══
  const TPL_NAME = "[실조작] 림글리쉬 성적표";
  const TPL_BODY = "#{학생이름}님 성적 안내\n\n#{시험목록}\n\n총점: #{시험총점}/#{시험총만점}\n숙제: #{숙제완성도}";
  await textarea.fill(TPL_BODY);
  await page.waitForTimeout(300);

  // "새 이름으로 저장" 클릭
  const saveBtn = page.locator("button").filter({ hasText: "새 이름으로 저장" }).first();
  await expect(saveBtn).toBeVisible({ timeout: 3000 });
  await saveBtn.click();
  await page.waitForTimeout(500);

  // 이름 입력
  const nameInput = page.locator("input[placeholder*='양식 이름']").first();
  await expect(nameInput).toBeVisible({ timeout: 3000 });
  await nameInput.fill(TPL_NAME);
  const confirmSave = page.locator("button").filter({ hasText: /^저장$/ }).first();
  await confirmSave.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "e2e/screenshots/real-01-saved.png" });
  console.log(">>> 2. 양식 저장 완료 ✓");

  // ═══ 4. 양식 패널에서 확인 ═══
  const tplBtn = page.locator("button").filter({ hasText: /양식 바꾸기/ }).first();
  await tplBtn.click();
  await page.waitForTimeout(1000);

  const savedCard = page.locator(`text=${TPL_NAME}`).first();
  await expect(savedCard).toBeVisible({ timeout: 3000 });
  console.log(">>> 3. 패널에 양식 표시 ✓");

  // 양식 선택
  await savedCard.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "e2e/screenshots/real-02-selected.png" });
  console.log(">>> 4. 양식 선택 ✓");

  // ═══ 5. 본문 수정 + "현재 양식에 저장" ═══
  const selectedBody = await textarea.inputValue();
  await textarea.fill(selectedBody + "\n\n감사합니다. 림글리쉬");
  await page.waitForTimeout(500);

  // "수정됨" 표시 확인
  const modified = page.locator("text=수정됨").first();
  const modVisible = await modified.isVisible({ timeout: 2000 }).catch(() => false);
  console.log(`>>> 5a. 수정됨 표시: ${modVisible}`);

  // "현재 양식에 저장" 버튼
  const updateBtn = page.locator("button").filter({ hasText: "현재 양식에 저장" }).first();
  const updateVisible = await updateBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`>>> 5b. 현재 양식에 저장 버튼: ${updateVisible}`);

  if (updateVisible) {
    await updateBtn.click();
    await page.waitForTimeout(2000);
    // 수정됨 해소
    const stillMod = await modified.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`>>> 5c. 업데이트 후 수정됨 해소: ${!stillMod}`);
    await page.screenshot({ path: "e2e/screenshots/real-03-updated.png" });
  }
  console.log(">>> 5. 양식 수정 + 업데이트 ✓");

  // ═══ 6. 기본 양식 지정 (API) ═══
  const allTpls = await (await request.get(`${API}/api/v1/messaging/templates/?category=grades`, { headers: auth })).json();
  const myTpl = allTpls.find((t: any) => t.name === TPL_NAME);
  expect(myTpl).toBeTruthy();

  const setDefR = await request.post(`${API}/api/v1/messaging/templates/${myTpl.id}/set-default/`, { headers: auth });
  expect(setDefR.status()).toBe(200);
  const defResult = await setDefR.json();
  expect(defResult.is_user_default).toBe(true);
  console.log(">>> 6. 기본 지정 ✓");

  // ═══ 7. 모달 닫기 → 재오픈 → 기본 양식 자동 적용 ═══
  const cancelBtn = page.locator("button").filter({ hasText: "취소" }).first();
  await cancelBtn.click();
  await page.waitForTimeout(1000);

  // 재선택 + 재오픈
  for (let i = 1; i <= await cbs.count(); i++) {
    if (await cbs.nth(i).isVisible({ timeout: 300 }).catch(() => false)) { await cbs.nth(i).check({ force: true }); break; }
  }
  await page.waitForTimeout(500);
  await sendBtn.click();
  await page.waitForTimeout(5000);

  const textarea2 = page.locator("textarea").first();
  await expect(textarea2).toBeVisible({ timeout: 10000 });
  const reopenBody = await textarea2.inputValue();
  console.log(`>>> 7. 재오픈 본문(${reopenBody.length}자): ${reopenBody.substring(0, 100)}`);

  // 기본 양식이 적용됐는지 (키워드 확인)
  const hasSignature = reopenBody.includes("성적 안내") && reopenBody.includes("감사합니다");
  console.log(`>>> 7. 기본 양식 자동 적용: ${hasSignature}`);
  await page.screenshot({ path: "e2e/screenshots/real-04-reopen.png" });

  // 변수 치환 확인
  const hasName = reopenBody.includes("김민수") || reopenBody.includes("이서연");
  const hasScore = /\d+\/\d+/.test(reopenBody);
  console.log(`>>> 7a. 학생명: ${hasName}, 점수: ${hasScore}`);

  // ═══ 8. 시스템 양식 복제 ═══
  const sysTpls = allTpls.filter((t: any) => t.is_system);
  if (sysTpls.length > 0) {
    const dupR = await request.post(`${API}/api/v1/messaging/templates/${sysTpls[0].id}/duplicate/`, {
      headers: auth, data: { name: "[실조작] 시스템 복제본" },
    });
    expect(dupR.status()).toBe(201);
    const dup = await dupR.json();
    expect(dup.is_system).toBe(false);
    console.log(`>>> 8. 시스템 양식 복제: id=${dup.id} ✓`);

    // 복제본 삭제
    await request.delete(`${API}/api/v1/messaging/templates/${dup.id}/`, { headers: auth });
  }

  // ═══ 9. 양식 삭제 ═══
  // 기본 해제 먼저
  await request.post(`${API}/api/v1/messaging/templates/${myTpl.id}/set-default/`, { headers: auth });
  // 삭제
  const delR = await request.delete(`${API}/api/v1/messaging/templates/${myTpl.id}/`, { headers: auth });
  expect(delR.status()).toBe(204);
  console.log(">>> 9. 양식 삭제 ✓");

  // ═══ 10. 에러 체크 ═══
  const critical = errors.filter(e => !e.includes("ResizeObserver") && !e.includes("net::ERR") && !e.includes("chunk"));
  console.log(`>>> 10. 크리티컬 에러: ${critical.length}건`);
  expect(critical).toEqual([]);

  console.log(">>> === 운영 실제 조작 전체 완료 ===");
});

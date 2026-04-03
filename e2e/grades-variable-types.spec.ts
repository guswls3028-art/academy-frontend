/**
 * 성적 양식 변수 유형별 검증 — 목록형 vs 개별 변수
 *
 * 데이터: Session 90 (시험 2개, 과제 1개)
 * 검증: 목록형 변수(#{시험목록}, #{과제목록}, #{전체요약})와 개별 변수(#{시험1}~#{시험5}) 모두 확인
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";
const API = "http://localhost:8000";

async function getAuth(request: import("@playwright/test").APIRequestContext) {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username: "admin97", password: "koreaseoul97", tenant_code: "hakwonplus" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus" },
  });
  return { "Content-Type": "application/json", "X-Tenant-Code": "hakwonplus", Authorization: `Bearer ${(await resp.json() as any).access}` };
}

async function openScoreModal(page: import("@playwright/test").Page, auth: Record<string, string>) {
  const token = auth.Authorization.replace("Bearer ", "");
  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access }) => {
    localStorage.setItem("access", access);
    try { sessionStorage.setItem("tenantCode", "hakwonplus"); } catch {}
  }, { access: token });

  await page.goto(`${BASE}/admin/lectures/92/sessions/90/scores`, { waitUntil: "load" });
  await page.waitForTimeout(4000);

  // 학생 선택
  const cbs = page.locator("input[type='checkbox']");
  for (let i = 1; i <= await cbs.count(); i++) {
    const cb = cbs.nth(i);
    if (await cb.isVisible({ timeout: 500 }).catch(() => false)) { await cb.check({ force: true }); break; }
  }
  await page.waitForTimeout(500);

  // 성적 발송
  const sendBtn = page.locator("button").filter({ hasText: /성적 발송|수업결과 발송/ }).first();
  await sendBtn.click();
  await page.waitForTimeout(4000);
  return page.locator("textarea").first();
}

test("목록형 양식 — 시험 2개/과제 1개 자동 렌더링", async ({ page, request }) => {
  const auth = await getAuth(request);

  // Setup: 목록형 양식을 기본으로 세팅
  const tpls = await (await request.get(`${API}/api/v1/messaging/templates/?category=grades`, { headers: auth })).json();
  // cleanup old E2E
  for (const t of tpls) { if (t.name.includes("[E2E") && !t.is_system) await request.delete(`${API}/api/v1/messaging/templates/${t.id}/`, { headers: auth }); }
  // create list-type + set default
  const listBody = "#{학생이름}님 성적 안내드립니다.\n\n[시험 결과]\n#{시험목록}\n\n[과제 결과]\n#{과제목록}\n\n[요약]\n#{전체요약}\n총점: #{시험총점}/#{시험총만점}";
  const created = await (await request.post(`${API}/api/v1/messaging/templates/`, { headers: auth, data: { category: "grades", name: "[E2E] 목록형 양식", body: listBody } })).json();
  await request.post(`${API}/api/v1/messaging/templates/${created.id}/set-default/`, { headers: auth });
  // create individual-type
  const indivBody = "#{학생이름}님 성적표\n\n[시험]\n#{시험1명}: #{시험1}/#{시험1만점}\n#{시험2명}: #{시험2}/#{시험2만점}\n#{시험3명}: #{시험3}/#{시험3만점}\n#{시험4명}: #{시험4}/#{시험4만점}\n#{시험5명}: #{시험5}/#{시험5만점}\n\n[과제]\n#{과제1명}: #{과제1}/#{과제1만점}\n#{과제2명}: #{과제2}/#{과제2만점}\n#{과제3명}: #{과제3}/#{과제3만점}\n\n총점: #{시험총점}/#{시험총만점}\n숙제: #{숙제완성도}";
  await request.post(`${API}/api/v1/messaging/templates/`, { headers: auth, data: { category: "grades", name: "[E2E] 개별 변수 양식", body: indivBody } });

  const textarea = await openScoreModal(page, auth);
  await expect(textarea).toBeVisible({ timeout: 8000 });

  const body = await textarea.inputValue();
  console.log("=== 목록형 양식 치환 결과 ===");
  console.log(body);
  console.log("=== END ===");

  await page.screenshot({ path: "e2e/screenshots/var-01-list-type.png" });

  // 검증: 양식 본문이 치환되었는지 (기본 양식에 따라 "성적 안내" 또는 "성적표")
  expect(body).toMatch(/성적 안내|성적표/);
  // 시험목록: 2개 시험이 모두 나열
  expect(body).toContain("단원평가 1");
  expect(body).toContain("단원평가 2");
  // 과제목록: 1개 과제
  expect(body).toContain("복습과제");
  // 전체요약: 합격 정보
  expect(body).toMatch(/합격|합불|완료/);
  // 총점
  expect(body).toContain("113/150");

  // #{시험목록} #{과제목록} 원문이 남아있으면 안 됨
  expect(body).not.toContain("#{시험목록}");
  expect(body).not.toContain("#{과제목록}");
  expect(body).not.toContain("#{전체요약}");

  console.log(">>> 목록형 양식 검증 PASS ✓");
});

test("개별 변수 양식 — 미사용 시험3~5 자동 제거", async ({ page, request }) => {
  const auth = await getAuth(request);

  // Setup: cleanup + 개별 양식 재생성 + 기본 지정
  const tpls = await (await request.get(`${API}/api/v1/messaging/templates/?category=grades`, { headers: auth })).json();
  for (const t of tpls) { if (t.name.includes("[E2E") && !t.is_system) await request.delete(`${API}/api/v1/messaging/templates/${t.id}/`, { headers: auth }); }
  const indivBody = "#{학생이름}님 성적표\n\n[시험]\n#{시험1명}: #{시험1}/#{시험1만점}\n#{시험2명}: #{시험2}/#{시험2만점}\n#{시험3명}: #{시험3}/#{시험3만점}\n#{시험4명}: #{시험4}/#{시험4만점}\n#{시험5명}: #{시험5}/#{시험5만점}\n\n[과제]\n#{과제1명}: #{과제1}/#{과제1만점}\n#{과제2명}: #{과제2}/#{과제2만점}\n#{과제3명}: #{과제3}/#{과제3만점}\n\n총점: #{시험총점}/#{시험총만점}\n숙제: #{숙제완성도}";
  const created = await (await request.post(`${API}/api/v1/messaging/templates/`, { headers: auth, data: { category: "grades", name: "[E2E] 개별 변수 양식", body: indivBody } })).json();
  await request.post(`${API}/api/v1/messaging/templates/${created.id}/set-default/`, { headers: auth });

  const textarea = await openScoreModal(page, auth);
  await expect(textarea).toBeVisible({ timeout: 8000 });

  const body = await textarea.inputValue();
  console.log("=== 개별 변수 양식 치환 결과 ===");
  console.log(body);
  console.log("=== END ===");

  await page.screenshot({ path: "e2e/screenshots/var-02-individual-type.png" });

  // 시험 1, 2는 있어야 함
  expect(body).toContain("단원평가 1");
  expect(body).toContain("단원평가 2");

  // 시험 3, 4, 5는 없어야 함 (미사용 제거)
  expect(body).not.toMatch(/시험3명|시험4명|시험5명/);
  // 빈 슬롯 잔여물 없어야 함
  expect(body).not.toMatch(/: *-\/-/);
  expect(body).not.toMatch(/^- *: *-\s*$/m);

  // 과제 1개는 있고, 2~3은 없어야 함
  expect(body).toContain("복습과제");
  expect(body).not.toMatch(/과제2명|과제3명/);

  // 총점, 숙제완성도
  expect(body).toContain("113/150");
  expect(body).toContain("완료");

  // 원문 변수 잔여물 없음
  expect(body).not.toMatch(/#\{[^}]+\}/);

  console.log(">>> 개별 변수 양식 검증 PASS ✓");
});

test("변수 블록 UI — 그룹 구분 + 목록형 변수 표시", async ({ page, request }) => {
  const auth = await getAuth(request);
  const textarea = await openScoreModal(page, auth);
  await expect(textarea).toBeVisible({ timeout: 8000 });

  // 변수 삽입 영역 확인
  const listLabel = page.locator("text=📋 목록형");
  await expect(listLabel).toBeVisible({ timeout: 3000 });
  console.log(">>> 목록형 그룹 라벨 표시 ✓");

  const summaryLabel = page.locator("div").filter({ hasText: /^요약$/ }).first();
  await expect(summaryLabel).toBeVisible({ timeout: 3000 });
  console.log(">>> 요약 그룹 라벨 표시 ✓");

  // 목록형 변수 버튼 확인
  const examListBtn = page.locator("button").filter({ hasText: "📋 시험 목록" }).first();
  await expect(examListBtn).toBeVisible({ timeout: 3000 });
  console.log(">>> 시험 목록 버튼 표시 ✓");

  const hwListBtn = page.locator("button").filter({ hasText: "📋 과제 목록" }).first();
  await expect(hwListBtn).toBeVisible({ timeout: 3000 });
  console.log(">>> 과제 목록 버튼 표시 ✓");

  const fullSummaryBtn = page.locator("button").filter({ hasText: "📋 전체 요약" }).first();
  await expect(fullSummaryBtn).toBeVisible({ timeout: 3000 });
  console.log(">>> 전체 요약 버튼 표시 ✓");

  // 개별 변수는 접이식 (기본 접힘)
  const foldBtn = page.locator("button").filter({ hasText: /시험\/과제 개별 변수/ }).first();
  await expect(foldBtn).toBeVisible({ timeout: 3000 });

  // 펼치기
  await foldBtn.click();
  await page.waitForTimeout(500);

  // 개별 라벨 확인
  const exam1NameBtn = page.locator("button").filter({ hasText: "시험 1 이름" }).first();
  await expect(exam1NameBtn).toBeVisible({ timeout: 2000 });
  console.log(">>> 시험 1 이름 버튼 표시 ✓");

  const exam1ScoreBtn = page.locator("button").filter({ hasText: "시험 1 점수" }).first();
  await expect(exam1ScoreBtn).toBeVisible({ timeout: 2000 });
  console.log(">>> 시험 1 점수 버튼 표시 ✓");

  await page.screenshot({ path: "e2e/screenshots/var-03-block-groups.png" });
  console.log(">>> 변수 블록 UI 그룹 검증 PASS ✓");
});

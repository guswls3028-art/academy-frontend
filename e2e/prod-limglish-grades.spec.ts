/**
 * 운영 검증 — 림글리쉬 테넌트 성적 발송 모달
 * grades 카테고리에서 양식 관리 + 변수 그룹 UI 확인
 */
import { test, expect } from "@playwright/test";

const BASE = "https://limglish.kr";
const API = "https://api.hakwonplus.com";

test("림글리쉬 운영: 성적 발송 모달 grades 검증", async ({ page }) => {
  // 로그인
  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: "ggorno", password: "limglish1126", tenant_code: "limglish" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "limglish" },
  });
  expect(resp.status()).toBe(200);
  const { access } = await resp.json() as { access: string };

  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access }) => {
    localStorage.setItem("access", access);
    try { sessionStorage.setItem("tenantCode", "limglish"); } catch {}
  }, { access });

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  // 성적 진입 — session 82 (림글리쉬 기존 테스트 데이터)
  await page.goto(`${BASE}/admin/lectures/13/sessions/82/scores`, { waitUntil: "load" });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "e2e/screenshots/prod-lim-01-scores.png" });

  // 학생 체크
  const cbs = page.locator("input[type='checkbox']");
  const cbCount = await cbs.count();
  console.log(`>>> 체크박스: ${cbCount}개`);

  if (cbCount >= 2) {
    await cbs.nth(1).check({ force: true });
    await page.waitForTimeout(500);

    // 수업결과 발송 버튼
    const sendBtn = page.locator("button").filter({ hasText: /성적 발송|수업결과 발송/ }).first();
    if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sendBtn.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: "e2e/screenshots/prod-lim-02-modal.png" });

      const textarea = page.locator("textarea").first();
      if (await textarea.isVisible({ timeout: 8000 }).catch(() => false)) {
        const body = await textarea.inputValue();
        console.log(`>>> 본문 길이: ${body.length}`);
        console.log(`>>> 본문 시작: ${body.substring(0, 150)}`);

        // grades 카테고리 변수 영역 확인
        const varSection = page.locator("text=변수 삽입").first();
        const varVisible = await varSection.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`>>> 변수 삽입 영역: ${varVisible}`);

        // 목록형 변수 버튼 (grades 전용)
        const listBtn = page.locator("button").filter({ hasText: /시험 목록/ }).first();
        const listVisible = await listBtn.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`>>> 시험 목록 버튼(grades): ${listVisible}`);

        // + 시험 추가 버튼
        const addExamBtn = page.locator("button").filter({ hasText: /시험 추가/ }).first();
        const addVisible = await addExamBtn.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`>>> + 시험 추가 버튼: ${addVisible}`);

        // 양식 바꾸기
        const tplBtn = page.locator("button").filter({ hasText: /양식 바꾸기/ }).first();
        if (await tplBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await tplBtn.click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: "e2e/screenshots/prod-lim-03-panel.png" });

          // 내 양식 또는 시스템 양식
          const mySection = page.locator("text=내 양식").first();
          const myVisible = await mySection.isVisible({ timeout: 2000 }).catch(() => false);
          const sysSection = page.locator("text=시스템 기본 양식").first();
          const sysVisible = await sysSection.isVisible({ timeout: 2000 }).catch(() => false);
          console.log(`>>> 내 양식: ${myVisible}, 시스템 양식: ${sysVisible}`);

          const closeBtn = page.locator("button").filter({ hasText: /^닫기$/ }).first();
          if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) await closeBtn.click();
        }

        await page.screenshot({ path: "e2e/screenshots/prod-lim-04-final.png" });
      } else {
        console.log(">>> textarea 안 보임 — 모달이 안 열렸을 수 있음");
      }
    } else {
      console.log(">>> 발송 버튼 없음");
    }
  } else {
    console.log(">>> 체크박스 부족 — 성적 데이터 없을 수 있음");
  }

  const critical = errors.filter(e => !e.includes("ResizeObserver") && !e.includes("net::ERR") && !e.includes("chunk"));
  console.log(`>>> 크리티컬 에러: ${critical.length}건`);
  if (critical.length > 0) console.log(">>> Errors:", critical.join("\n"));
  console.log(">>> 림글리쉬 운영 검증 완료");
});

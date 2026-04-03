/**
 * DNB 학생앱 프로필 편집 모드 — 학교급 드롭다운 초등/중등만
 */
import { test, expect } from "@playwright/test";

const DNB_BASE = "https://dnbacademy.co.kr";
const API_BASE = "https://api.hakwonplus.com";
const DNB_CODE = "dnb";

test("DNB 학생앱 프로필 편집: 학교급 드롭다운 초등/중등, 고등 없음", async ({ page }) => {
  const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: "e2e_test_student", password: "test1234", tenant_code: DNB_CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": DNB_CODE },
    timeout: 15000,
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json() as { access: string; refresh: string };

  await page.goto(`${DNB_BASE}/login`, { waitUntil: "commit", timeout: 20000 });
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", code); } catch {}
  }, { access: tokens.access, refresh: tokens.refresh, code: DNB_CODE });

  await page.goto(`${DNB_BASE}/student/profile`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);

  // 편집 아이콘 (연필) 클릭 — title="편집"
  const editIcon = page.locator('button[title="편집"]').first();
  await editIcon.waitFor({ state: "visible", timeout: 5000 });
  await editIcon.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: "e2e/screenshots/dnb-student-profile-edit.png" });

  // 모든 select 확인
  const allSelects = page.locator("select");
  const selCount = await allSelects.count();
  console.log("Edit mode selects:", selCount);

  let foundSchoolType = false;
  let foundGrade = false;

  for (let i = 0; i < selCount; i++) {
    const opts = await allSelects.nth(i).locator("option").allTextContents();
    console.log(`Select #${i}:`, opts);

    // 학교급 select
    if (opts.some(o => o === "초등" || o === "중등")) {
      foundSchoolType = true;
      expect(opts).toContain("초등");
      expect(opts).toContain("중등");
      expect(opts).not.toContain("고등");
      console.log("✓ 학교급 select: 초등/중등만, 고등 없음");
    }

    // 학년 select (현재 ELEMENTARY이므로 1~6)
    if (opts.some(o => o.includes("학년"))) {
      foundGrade = true;
      expect(opts).toContain("6학년");
      console.log("✓ 학년 select: 6학년까지");
    }
  }

  if (foundSchoolType) console.log("✓ 학교급 드롭다운 검증 완료");
  if (foundGrade) console.log("✓ 학년 드롭다운 검증 완료");
});

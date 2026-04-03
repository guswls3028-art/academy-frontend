/**
 * 데이터 정합성 감사 — API 응답 필드 vs 오버레이 DOM 표시 교차 검증
 */
import { test, expect } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const PROD = "https://hakwonplus.com";
const API = "https://api.hakwonplus.com";

test.use({ viewport: { width: 1440, height: 900 } });

test("학생 상세 — API 응답 필드 vs 오버레이 DOM 표시 교차 검증", async ({ page }) => {
  await loginViaUI(page, "admin");

  const token = await page.evaluate(() => localStorage.getItem("access"));

  // 1. API에서 학생 상세 데이터 가져오기
  const listResp = await page.request.get(`${API}/api/v1/students/?page_size=3`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  const listData = await listResp.json() as any;
  // 데이터가 풍부한 학생 선택 (enrollments 있는)
  const students = listData.results || [];
  const targetStudent = students.find((s: any) => s.enrollments?.length > 0) || students[0];
  const studentId = targetStudent?.id;
  console.log(`[정합성] 학생 ID: ${studentId}, 이름: ${targetStudent?.name}`);

  const detailResp = await page.request.get(`${API}/api/v1/students/${studentId}/`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  const apiData = await detailResp.json() as any;

  // 2. API 응답 전체 필드 출력
  console.log("\n=== [API 응답 필드] ===");
  const apiFields = Object.keys(apiData);
  console.log(`필드 목록 (${apiFields.length}개): ${apiFields.join(", ")}`);
  console.log(`\n  name: ${apiData.name}`);
  console.log(`  ps_number: ${apiData.ps_number}`);
  console.log(`  omr_code: ${apiData.omr_code}`);
  console.log(`  gender: ${apiData.gender}`);
  console.log(`  grade: ${apiData.grade}`);
  console.log(`  school_type: ${apiData.school_type}`);
  console.log(`  phone: ${apiData.phone}`);
  console.log(`  parent_phone: ${apiData.parent_phone}`);
  console.log(`  high_school: ${apiData.high_school}`);
  console.log(`  high_school_class: ${apiData.high_school_class}`);
  console.log(`  major: ${apiData.major}`);
  console.log(`  middle_school: ${apiData.middle_school}`);
  console.log(`  origin_middle_school: ${apiData.origin_middle_school}`);
  console.log(`  address: ${apiData.address}`);
  console.log(`  memo: ${apiData.memo}`);
  console.log(`  is_active: ${apiData.is_active}`);
  console.log(`  is_managed: ${apiData.is_managed}`);
  console.log(`  uses_identifier: ${apiData.uses_identifier}`);
  console.log(`  profile_photo_url: ${apiData.profile_photo_url ? "있음" : "없음"}`);
  console.log(`  tags: ${JSON.stringify(apiData.tags?.map((t: any) => t.name))}`);
  console.log(`  enrollments: ${apiData.enrollments?.length}개`);
  console.log(`  created_at: ${apiData.created_at}`);
  console.log(`  deleted_at: ${apiData.deleted_at}`);

  // 3. 오버레이 열기
  await page.goto(`${PROD}/admin/students/${studentId}`, { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const panel = page.locator(".ds-overlay-panel");
  await expect(panel).toBeVisible({ timeout: 10000 });

  // 4. DOM에서 표시된 정보 수집
  console.log("\n=== [DOM 표시 필드] ===");

  const infoRows = panel.locator(".ds-overlay-info-row");
  const rowCount = await infoRows.count();
  const domFields: Record<string, string> = {};
  for (let i = 0; i < rowCount; i++) {
    const label = await infoRows.nth(i).locator(".ds-overlay-info-row__label").innerText().catch(() => "");
    const value = await infoRows.nth(i).locator(".ds-overlay-info-row__value").innerText().catch(() => "");
    if (label) {
      domFields[label] = value;
      console.log(`  ${label}: "${value}"`);
    }
  }

  // 5. 교차 검증 — 누락 필드 확인
  console.log("\n=== [교차 검증] ===");

  // API에 있는데 DOM에 안 보이는 필드
  const fieldMapping: Record<string, string> = {
    "ps_number": "아이디",  // 헤더 배지에 표시
    "omr_code": "식별코드",
    "parent_phone": "학부모 전화",
    "phone": "학생 전화",
    "gender": "성별",
    "grade": "학년",
    "high_school": "학교",
    "high_school_class": "반",
    "major": "계열",
    "origin_middle_school": "출신중학교",
    "address": "주소",
    "created_at": "등록일",
    "memo": "메모",
  };

  const missing: string[] = [];
  for (const [apiField, domLabel] of Object.entries(fieldMapping)) {
    const apiValue = apiData[apiField];
    const inDom = domFields[domLabel] !== undefined;
    const hasValue = apiValue !== null && apiValue !== undefined && apiValue !== "";

    if (hasValue && !inDom) {
      missing.push(`${domLabel}(${apiField}): API="${apiValue}" → DOM에 없음`);
    }
  }

  if (missing.length > 0) {
    console.log("⚠ 누락 필드:");
    missing.forEach(m => console.log(`  - ${m}`));
  } else {
    console.log("✓ 유효 데이터 모두 DOM에 표시됨");
  }

  // 6. 값 불일치 검증
  const mismatches: string[] = [];
  for (const [apiField, domLabel] of Object.entries(fieldMapping)) {
    const apiValue = apiData[apiField];
    const domValue = domFields[domLabel];
    if (apiValue && domValue && domValue !== "-") {
      // 간단한 포함 검증 (포맷 차이 허용)
      const apiStr = String(apiValue).replace(/[-\s]/g, "");
      const domStr = String(domValue).replace(/[-\s]/g, "").replace(/학년|copy|복사/g, "");
      if (!domStr.includes(apiStr) && !apiStr.includes(domStr)) {
        // 날짜/전화번호 포맷 차이 허용
        const apiDigits = apiStr.replace(/\D/g, "");
        const domDigits = domStr.replace(/\D/g, "");
        if (apiDigits && domDigits && !domDigits.includes(apiDigits) && !apiDigits.includes(domDigits)) {
          mismatches.push(`${domLabel}: API="${apiValue}" vs DOM="${domValue}"`);
        }
      }
    }
  }

  if (mismatches.length > 0) {
    console.log("⚠ 값 불일치:");
    mismatches.forEach(m => console.log(`  - ${m}`));
  } else {
    console.log("✓ 표시된 값 모두 API 데이터와 일치");
  }

  // 7. 통계 데이터 검증
  const statLabels = panel.locator(".ds-overlay-stat-card__label");
  const statValues = panel.locator(".ds-overlay-stat-card__value");
  const statCount = await statLabels.count();
  console.log(`\n=== [통계 카드 검증] (${statCount}개) ===`);
  for (let i = 0; i < statCount; i++) {
    const label = await statLabels.nth(i).innerText();
    const value = await statValues.nth(i).innerText();
    console.log(`  ${label}: ${value}`);
  }

  // 8. 수강 탭 데이터 vs API enrollments
  const apiEnrollCount = apiData.enrollments?.length ?? 0;
  console.log(`\n=== [수강 검증] API enrollments: ${apiEnrollCount}개 ===`);
  for (const en of (apiData.enrollments || [])) {
    console.log(`  - ${en.lecture_name || en.lectureName} (${en.status})`);
  }

  await page.screenshot({ path: "e2e/screenshots/data-audit-student.png", fullPage: false });
});

test("직원 상세 — API 응답 필드 vs 오버레이 DOM 표시 교차 검증", async ({ page }) => {
  await loginViaUI(page, "admin");

  const token = await page.evaluate(() => localStorage.getItem("access"));

  const listResp = await page.request.get(`${API}/api/v1/staffs/?page_size=5`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  const listData = await listResp.json() as any;
  const staffId = listData.results?.[0]?.id;
  console.log(`[정합성] 직원 ID: ${staffId}`);

  const detailResp = await page.request.get(`${API}/api/v1/staffs/${staffId}/`, {
    headers: { Authorization: `Bearer ${token}`, "X-Tenant-Code": "hakwonplus" },
  });
  const apiData = await detailResp.json() as any;

  console.log("\n=== [직원 API 응답 필드] ===");
  console.log(`필드: ${Object.keys(apiData).join(", ")}`);
  console.log(`  name: ${apiData.name}`);
  console.log(`  phone: ${apiData.phone}`);
  console.log(`  user_username: ${apiData.user_username}`);
  console.log(`  user_is_staff: ${apiData.user_is_staff}`);
  console.log(`  is_active: ${apiData.is_active}`);
  console.log(`  is_manager: ${apiData.is_manager}`);
  console.log(`  pay_type: ${apiData.pay_type}`);
  console.log(`  role: ${apiData.role}`);
  console.log(`  profile_photo_url: ${apiData.profile_photo_url ? "있음" : "없음"}`);
  console.log(`  staff_work_types: ${apiData.staff_work_types?.length ?? 0}개`);
  console.log(`  created_at: ${apiData.created_at}`);

  // 오버레이 열기
  await page.goto(`${PROD}/admin/staff/${staffId}`, { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const panel = page.locator(".ds-overlay-panel");
  if (!await panel.isVisible({ timeout: 10000 }).catch(() => false)) {
    console.log("[정합성] 직원 오버레이 미표시");
    return;
  }

  const infoRows = panel.locator(".ds-overlay-info-row");
  const rowCount = await infoRows.count();
  console.log(`\n=== [직원 DOM 표시 필드] (${rowCount}행) ===`);
  const domFields: Record<string, string> = {};
  for (let i = 0; i < rowCount; i++) {
    const label = await infoRows.nth(i).locator(".ds-overlay-info-row__label").innerText().catch(() => "");
    const value = await infoRows.nth(i).locator(".ds-overlay-info-row__value").innerText().catch(() => "");
    if (label) {
      domFields[label] = value;
      console.log(`  ${label}: "${value}"`);
    }
  }

  // 누락 검증
  console.log("\n=== [직원 교차 검증] ===");
  const staffFieldMap: Record<string, string> = {
    "user_username": "계정",
    "phone": "전화번호",
    "pay_type": "급여유형",
    "role": "역할",
    "is_manager": "관리자",
    "created_at": "등록일",
  };
  const missing: string[] = [];
  for (const [apiField, domLabel] of Object.entries(staffFieldMap)) {
    const apiValue = apiData[apiField];
    const inDom = domFields[domLabel] !== undefined;
    if (apiValue !== null && apiValue !== undefined && apiValue !== "" && !inDom) {
      missing.push(`${domLabel}(${apiField}): API="${apiValue}" → DOM에 없음`);
    }
  }
  if (missing.length > 0) {
    console.log("⚠ 누락 필드:");
    missing.forEach(m => console.log(`  - ${m}`));
  } else {
    console.log("✓ 유효 데이터 모두 표시됨");
  }

  await page.screenshot({ path: "e2e/screenshots/data-audit-staff.png", fullPage: false });
});

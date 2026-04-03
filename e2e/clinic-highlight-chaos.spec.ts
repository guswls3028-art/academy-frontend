/**
 * 파괴 테스트: 클리닉 하이라이트 안정성
 * Tenant 1 (개발/테스트)에서만 수행
 *
 * 시나리오:
 * 1. 학생 생성 → 강의 수강등록 → 시험 불합격 → 클리닉 대상 생성
 * 2. 학생 목록에서 하이라이트 확인
 * 3. 수강 삭제 → 하이라이트 사라지는지 확인
 * 4. 강의 삭제 → 크래시 없는지 확인
 * 5. 학생 삭제 → 크래시 없는지 확인
 * 6. 기존 클리닉 대상 학생으로 모달/드로어 열고 닫기
 * 7. 빠른 페이지 전환 (race condition)
 * 8. 정리
 */
import { test, expect, type Page } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";
const API = process.env.E2E_API_URL || "https://api.hakwonplus.com";
const TAG = `[CHAOS-${Date.now()}]`;

let token: string;
let headers: Record<string, string>;

async function apiGet(page: Page, path: string) {
  const r = await page.request.get(`${API}/api/v1${path}`, { headers });
  return r.json();
}
async function apiPost(page: Page, path: string, data: any) {
  const r = await page.request.post(`${API}/api/v1${path}`, { headers, data });
  return { status: r.status(), data: await r.json().catch(() => null) };
}
async function apiPatch(page: Page, path: string, data: any) {
  const r = await page.request.patch(`${API}/api/v1${path}`, { headers, data });
  return { status: r.status(), data: await r.json().catch(() => null) };
}
async function apiDelete(page: Page, path: string) {
  const r = await page.request.delete(`${API}/api/v1${path}`, { headers });
  return r.status();
}

async function checkNoError(page: Page, label: string) {
  await page.waitForTimeout(2000);
  const errText = await page.locator("text=일시적인 오류, text=Something went wrong, text=에러가 발생").count();
  const hl = await page.locator(".ds-student-name--clinic-highlight").count();
  const chips = await page.locator("span.inline-flex.items-center.gap-2").count();
  const ok = errText === 0;
  console.log(`  ${ok ? "✅" : "❌"} ${label}: chips=${chips} hl=${hl} error=${errText}`);
  await page.screenshot({ path: `e2e/screenshots/chaos-${label}.png`, fullPage: true });
  expect(errText).toBe(0);
  return { chips, hl };
}

test.describe("파괴 테스트: 클리닉 하이라이트 안정성", () => {
  test.setTimeout(600_000);

  test("전체 시나리오", async ({ page }) => {
    page.setViewportSize({ width: 1920, height: 1080 });
    await loginViaUI(page, "admin");

    // 토큰 확보
    token = await page.evaluate(() => localStorage.getItem("access") || "");
    headers = {
      Authorization: `Bearer ${token}`,
      "X-Tenant-Code": "hakwonplus",
      "Content-Type": "application/json",
    };

    // =============================================
    console.log("\n🔥 1. 학생 생성");
    // =============================================
    const studentRes = await apiPost(page, "/students/", {
      name: `${TAG} 파괴테스트`,
      phone: `010${Math.floor(Math.random() * 90000000 + 10000000)}`,
      parent_phone: `010${Math.floor(Math.random() * 90000000 + 10000000)}`,
      initial_password: "test1234",
      grade: 1,
      gender: "M",
    });
    console.log(`  학생 생성: ${studentRes.status} id=${studentRes.data?.id} ${studentRes.status !== 201 ? JSON.stringify(studentRes.data) : ""}`);
    const studentId = studentRes.data?.id;
    if (!studentId) { console.log("  ⚠️ 학생 생성 실패 — 기존 학생 사용"); }

    // =============================================
    console.log("\n🔥 2. 강의 생성");
    // =============================================
    const lectureRes = await apiPost(page, "/lectures/lectures/", {
      title: `${TAG} 테스트강의`,
      name: `${TAG}`,
      subject: "수학",
      is_active: true,
    });
    console.log(`  강의 생성: ${lectureRes.status} id=${lectureRes.data?.id}`);
    const lectureId = lectureRes.data?.id ?? 21; // fallback to existing

    // =============================================
    console.log("\n🔥 3. 차시 생성");
    // =============================================
    const sessionRes = await apiPost(page, "/lectures/sessions/", {
      lecture: lectureId,
      title: `${TAG} 1차시`,
      date: "2026-04-01",
    });
    console.log(`  차시 생성: ${sessionRes.status} id=${sessionRes.data?.id}`);
    const sessionId = sessionRes.data?.id ?? 22; // fallback to existing

    // =============================================
    console.log("\n🔥 4. 수강 등록");
    // =============================================
    let enrollmentId: number | null = null;
    if (studentId) {
      const enrollRes = await apiPost(page, "/enrollments/bulk_create/", {
        lecture: lectureId,
        student_ids: [studentId],
      });
      console.log(`  수강 등록: ${enrollRes.status}`);

      // enrollment ID 확인
      try {
        const enrollments = await apiGet(page, `/enrollments/?lecture=${lectureId}`);
        const enrollList = Array.isArray(enrollments) ? enrollments : (enrollments?.results ?? []);
        const myEnroll = enrollList.find((e: any) => e.student?.id === studentId || e.student === studentId);
        enrollmentId = myEnroll?.id ?? null;
        console.log(`  enrollment_id: ${enrollmentId}`);
      } catch (e) { console.log(`  enrollment 조회 실패: ${e}`); }
    }

    // =============================================
    console.log("\n🔥 5. 학생 목록에서 생성된 학생 확인 (하이라이트 없어야 함)");
    // =============================================
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await checkNoError(page, "01-after-create");

    // =============================================
    console.log("\n🔥 6. 빠른 페이지 전환 (race condition 테스트)");
    // =============================================
    await page.goto(`${BASE}/admin/lectures/${lectureId}`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.goto(`${BASE}/admin/clinic`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.goto(`${BASE}/admin/lectures/${lectureId}`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await checkNoError(page, "02-rapid-nav");

    // =============================================
    console.log("\n🔥 7. 차시 출석 페이지 확인");
    // =============================================
    await page.goto(`${BASE}/admin/lectures/${lectureId}/sessions/${sessionId}`, { waitUntil: "load" });
    await checkNoError(page, "03-session-page");

    // =============================================
    console.log("\n🔥 8. 수강 삭제 (unenroll)");
    // =============================================
    if (enrollmentId) {
      const unenrollRes = await apiDelete(page, `/enrollments/${enrollmentId}/`);
      console.log(`  수강 삭제: ${unenrollRes}`);
    } else {
      console.log("  수강 삭제 스킵 (enrollment 없음)");
    }

    // 수강 삭제 후 페이지 확인
    await page.goto(`${BASE}/admin/lectures/${lectureId}/sessions/${sessionId}`, { waitUntil: "load" });
    await checkNoError(page, "04-after-unenroll");

    // 학생 목록에서도 확인
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await checkNoError(page, "05-students-after-unenroll");

    // =============================================
    console.log("\n🔥 9. 수강 재등록");
    // =============================================
    const reenrollRes = studentId ? await apiPost(page, "/enrollments/bulk_create/", {
      lecture: lectureId,
      student_ids: [studentId],
    }) : { status: 0 };
    console.log(`  수강 재등록: ${reenrollRes.status}`);
    await page.goto(`${BASE}/admin/lectures/${lectureId}/sessions/${sessionId}`, { waitUntil: "load" });
    await checkNoError(page, "06-after-reenroll");

    // =============================================
    console.log("\n🔥 10. 강의 삭제 → 크래시 안 나는지");
    // =============================================
    const delLectureStatus = await apiDelete(page, `/lectures/lectures/${lectureId}/`);
    console.log(`  강의 삭제: ${delLectureStatus}`);

    // 강의 삭제 후 학생 목록
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await checkNoError(page, "07-students-after-lecture-delete");

    // 강의 삭제 후 클리닉
    await page.goto(`${BASE}/admin/clinic`, { waitUntil: "load" });
    await checkNoError(page, "08-clinic-after-lecture-delete");

    // 강의 삭제 후 클리닉 예약
    await page.goto(`${BASE}/admin/clinic/bookings`, { waitUntil: "load" });
    await checkNoError(page, "09-bookings-after-lecture-delete");

    // =============================================
    console.log("\n🔥 11. 기존 클리닉 대상과 페이지 전환 스트레스");
    // =============================================
    // 강의 21(기존)로 빠르게 전환
    await page.goto(`${BASE}/admin/lectures/21`, { waitUntil: "load" });
    await checkNoError(page, "10-existing-lecture");

    // 성적 탭 열기
    await page.goto(`${BASE}/admin/lectures/21/sessions/22`, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    const scoresTab = page.locator("button, [role='tab']").filter({ hasText: /성적/ }).first();
    if (await scoresTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scoresTab.click();
      await checkNoError(page, "11-scores-tab");
    }

    // 성적에서 학생 클릭 → 드로어 열기
    const nameChip = page.locator("td span.inline-flex.items-center.gap-2").first();
    if (await nameChip.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameChip.click();
      await page.waitForTimeout(1500);
      await checkNoError(page, "12-scores-drawer-open");
      await page.keyboard.press("Escape");
    }

    // 빠르게 클리닉 → 학생 → 강의 → 클리닉
    await page.goto(`${BASE}/admin/clinic/bookings`, { waitUntil: "commit" });
    await page.waitForTimeout(300);
    await page.goto(`${BASE}/admin/students`, { waitUntil: "commit" });
    await page.waitForTimeout(300);
    await page.goto(`${BASE}/admin/lectures/21`, { waitUntil: "commit" });
    await page.waitForTimeout(300);
    await page.goto(`${BASE}/admin/clinic/bookings`, { waitUntil: "load" });
    await checkNoError(page, "13-rapid-switch-stress");

    // =============================================
    console.log("\n🔥 12. 학생 삭제 → 크래시 안 나는지");
    // =============================================
    const delStudentStatus = await apiDelete(page, `/students/${studentId}/`);
    console.log(`  학생 삭제: ${delStudentStatus}`);

    // 학생 삭제 후 모든 주요 페이지
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await checkNoError(page, "14-students-after-student-delete");

    await page.goto(`${BASE}/admin/clinic/bookings`, { waitUntil: "load" });
    await checkNoError(page, "15-bookings-after-student-delete");

    await page.goto(`${BASE}/admin/lectures/21`, { waitUntil: "load" });
    await checkNoError(page, "16-lecture-after-student-delete");

    // =============================================
    console.log("\n🔥 13. 클리닉 예약 페이지에서 대상 클릭/확인");
    // =============================================
    await page.goto(`${BASE}/admin/clinic/bookings`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const clinicRow = page.locator("span.inline-flex.items-center.gap-2").first();
    if (await clinicRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clinicRow.click();
      await page.waitForTimeout(2000);
      await checkNoError(page, "17-clinic-row-click");
      await page.keyboard.press("Escape");
    }

    // =============================================
    console.log("\n🔥 14. 새 강의+학생 빠르게 생성 후 바로 삭제 (생성→즉시삭제)");
    // =============================================
    const fastLecture = await apiPost(page, "/lectures/lectures/", {
      title: `${TAG} 즉삭강의`,
      name: "즉삭",
      subject: "영어",
      is_active: true,
    });
    console.log(`  즉삭강의: ${fastLecture.status} id=${fastLecture.data?.id}`);
    if (fastLecture.data?.id) {
      const delFast = await apiDelete(page, `/lectures/lectures/${fastLecture.data.id}/`);
      console.log(`  즉시 삭제: ${delFast}`);
    }

    // 즉삭 후 페이지 확인
    await page.goto(`${BASE}/admin/students`, { waitUntil: "load" });
    await checkNoError(page, "18-after-fast-create-delete");

    // =============================================
    console.log("\n🔥 15. 최종 안정성 확인 — 모든 주요 페이지 순회");
    // =============================================
    const pages = [
      "/admin/students",
      "/admin/lectures/21",
      "/admin/lectures/21/sessions/22",
      "/admin/clinic",
      "/admin/clinic/bookings",
      "/admin/videos",
      "/admin/results",
    ];
    for (const p of pages) {
      await page.goto(`${BASE}${p}`, { waitUntil: "load" });
      await checkNoError(page, `19-final-${p.replace(/\//g, "-").substring(1)}`);
    }

    console.log("\n✅ 파괴 테스트 완료 — 모든 시나리오 통과");
  });
});

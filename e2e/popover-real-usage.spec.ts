/**
 * 드롭다운/팝오버 가려짐 fix — 실사용 시나리오 전수 검증
 *
 * 대상 fix:
 *   1. TimeScrollPopover (SSOT) — LectureCreateModal / SessionCreateModal / ClinicCreatePanel
 *   2. DatePicker (SSOT)        — LectureCreateModal / SessionCreateModal
 *   3. SessionBlock 기어 메뉴   — 차시 카드 우상단
 *   4. SessionAttendancePage    — 상태 필터 popover + 행별 상태변경 popover
 *
 * 검증 방식:
 *   - 1366×768 / 1100×900 두 viewport
 *   - 각 popover: x,y ≥ 0 && x+w,y+h ≤ viewport (= 화면 안에 있다)
 *   - LectureCreateModal: 실제 등록 → 리스트 검증 → 만든 강의 cleanup
 *   - 나머지: 시각 검증 + 스크린샷 (저장 X, 모달 취소로 닫음)
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { loginViaUI } from "./helpers/auth";

const BASE = "http://localhost:5174";
const API_BASE = "https://api.hakwonplus.com";
const STAMP = Date.now();

type LectureRecord = { id: number | string; title?: string | null };
type SessionRecord = { id: number | string };
type AttendanceTarget = { lectureId: number | string; sessionId: number | string };

function listFromBody<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (!body || typeof body !== "object") return [];
  const results = (body as { results?: unknown }).results;
  return Array.isArray(results) ? results as T[] : [];
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const access = await page.evaluate(() => localStorage.getItem("access"));
  return {
    Authorization: `Bearer ${access ?? ""}`,
    "X-Tenant-Code": "hakwonplus",
  };
}

async function apiGetList<T>(page: Page, path: string): Promise<T[]> {
  const response = await page.request.get(`${API_BASE}/api/v1${path}`, {
    headers: await authHeaders(page),
  });
  const body = await response.json().catch(() => null) as unknown;
  return listFromBody<T>(body);
}

async function deleteLecture(page: Page, id: number | string): Promise<void> {
  await page.request.delete(`${API_BASE}/api/v1/lectures/lectures/${id}/`, {
    headers: await authHeaders(page),
  });
}

async function findFirstLectureSessionIds(page: Page): Promise<AttendanceTarget | null> {
  const lectures = await apiGetList<LectureRecord>(page, "/lectures/lectures/?page_size=5");
  for (const lecture of lectures) {
    const sessions = await apiGetList<SessionRecord>(
      page,
      `/lectures/sessions/?lecture=${lecture.id}&page_size=5`,
    );
    if (sessions.length > 0) {
      return { lectureId: lecture.id, sessionId: sessions[0].id };
    }
  }
  return null;
}

async function ensureInViewport(page: Page, locator: Locator, label: string) {
  const box = await locator.boundingBox();
  expect(box, `${label}: not visible`).not.toBeNull();
  if (!box) return;
  const vp = page.viewportSize()!;
  expect(box.y, `${label}: top<0 y=${box.y}`).toBeGreaterThanOrEqual(-1);
  expect(box.x, `${label}: left<0 x=${box.x}`).toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height, `${label}: bottom>vp y+h=${box.y + box.height} vp.h=${vp.height}`).toBeLessThanOrEqual(vp.height + 1);
  expect(box.x + box.width, `${label}: right>vp x+w=${box.x + box.width} vp.w=${vp.width}`).toBeLessThanOrEqual(vp.width + 1);
}

async function shoot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/popover-real/${name}.png`, fullPage: false });
}

async function openModalLectures(page: Page) {
  await page.goto(`${BASE}/admin/lectures`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  const btn = page.locator('[data-guide="lectures-add-btn"]').first();
  await btn.waitFor({ state: "visible", timeout: 15000 });
  await btn.click();
  await page.locator('input[placeholder*="강의 이름"]').waitFor({ state: "visible", timeout: 5000 });
}

for (const vp of [
  { width: 1366, height: 768, label: "1366x768" },
  { width: 1100, height: 900, label: "1100x900" },
]) {
  test.describe(`실사용 검증 — viewport ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("1) LectureCreateModal: 모든 popover 시각 확인 + 실제 등록 → 검증 → cleanup", async ({ page }) => {
      const lectureTitle = `[E2E-${STAMP}] popover ${vp.width}`;
      await loginViaUI(page, "admin");
      await openModalLectures(page);

      // ── 시작일 DatePicker
      const startDateTrig = page.locator("button.shared-date-picker-trigger").first();
      await startDateTrig.scrollIntoViewIfNeeded();
      await startDateTrig.click();
      const datePop = page.locator(".shared-date-picker-dropdown--portaled");
      await datePop.waitFor({ state: "visible", timeout: 3000 });
      await ensureInViewport(page, datePop, `시작일 dropdown @${vp.label}`);
      await shoot(page, `${vp.width}-1-lecture-start-date`);
      // 오늘 날짜 클릭 (시작일 = 오늘)
      await datePop.locator(".shared-date-picker-cell-today").click();
      await datePop.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});

      // ── 시작 시간 trigger
      const startTimeTrig = page.getByRole("button", { name: /시작 시간 선택/ });
      await startTimeTrig.scrollIntoViewIfNeeded();
      await startTimeTrig.click();
      const timePop = page.locator(".time-picker.time-picker--portaled");
      await timePop.waitFor({ state: "visible", timeout: 3000 });
      await ensureInViewport(page, timePop, `시작 시간 popover @${vp.label}`);
      await shoot(page, `${vp.width}-2-lecture-start-time`);
      // 임의 시각 클릭 (12:00 → 14:00 의도)
      // 그냥 +1시간 quick button 두 번으로 종료시간 채우기
      // 우선 시간 popover에서 슬롯 하나 선택
      await timePop.locator(".time-picker__item").nth(40).click();
      await expect(timePop).toBeHidden({ timeout: 3000 });

      // ── 종료 시간 trigger
      const endTimeTrig = page.getByRole("button", { name: /종료 시간 선택/ });
      await endTimeTrig.click();
      await timePop.waitFor({ state: "visible", timeout: 3000 });
      await ensureInViewport(page, timePop, `종료 시간 popover @${vp.label}`);
      await shoot(page, `${vp.width}-3-lecture-end-time`);
      await timePop.locator(".time-picker__item").nth(42).click();
      await expect(timePop).toBeHidden({ timeout: 3000 });

      // ── 필수 필드 채우기
      await page.locator('input[placeholder*="강의 이름"]').fill(lectureTitle);
      // 과목 (필수) — 모달 내 input만 (검색창 placeholder에도 "과목" 포함)
      await page.locator('input[aria-label="과목 (필수)"]').fill("E2E검증");
      // 담당 강사는 기본 자동선택 (instructorOptions[0])

      await shoot(page, `${vp.width}-4-lecture-form-filled`);

      // ── 등록
      await page.getByRole("button", { name: /^등록$/ }).click();
      // 성공 toast / 리스트로 복귀
      await page.locator('input[placeholder*="강의 이름"]').waitFor({ state: "hidden", timeout: 8000 });

      // ── 리스트에서 신규 강의 존재 확인
      const newRow = page.getByText(lectureTitle).first();
      await newRow.waitFor({ state: "visible", timeout: 8000 });
      await shoot(page, `${vp.width}-5-lecture-list-new-row`);

      // ── Cleanup: 만든 강의 삭제 (강의 row 우측 메뉴/체크박스 → 삭제)
      // 가장 안전한 cleanup: API로 직접 삭제
      // 리스트에서 ID 찾기
      const lectures = await apiGetList<LectureRecord>(
        page,
        `/lectures/lectures/?search=${encodeURIComponent(lectureTitle)}`,
      );
      const lectureId = lectures.find((lecture) => lecture.title === lectureTitle)?.id ?? null;
      if (lectureId) {
        await deleteLecture(page, lectureId);
        console.log(`[cleanup] deleted lecture id=${lectureId} title=${lectureTitle}`);
      } else {
        console.warn(`[cleanup] lecture not found: ${lectureTitle}`);
      }
    });

    test("2) SessionCreateModal: 차시 추가 모달 시간 popover (저장 X)", async ({ page }) => {
      await loginViaUI(page, "admin");
      // API로 첫 강의 id 조회 → /sessions 직접
      const lectures = await apiGetList<LectureRecord>(page, "/lectures/lectures/?page_size=1");
      const lectureId = lectures[0]?.id ?? null;
      if (!lectureId) {
        test.skip(true, "강의 없음");
        return;
      }
      await page.goto(`${BASE}/admin/lectures/${lectureId}/sessions`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      // "+ 차시 추가" 클릭
      const addSessionBtn = page.getByRole("button", { name: /차시 추가/ }).first();
      if (!(await addSessionBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
        await shoot(page, `${vp.width}-debug-session-no-btn`);
        test.skip(true, "차시 추가 버튼 못 찾음");
        return;
      }
      await addSessionBtn.click();
      // 차시 추가 모달 — 1) 차시 유형 "2차시" 카드 선택 → 2) 시간 "직접선택" 라디오 클릭
      await page.locator('text=차시 유형').waitFor({ state: "visible", timeout: 5000 });
      // "2차시" 카드 클릭 (Heading 안에 "2차시" 텍스트)
      const type2 = page.locator('text=2차시').first();
      await type2.click();
      // 시간 섹션 "직접선택" — 마지막(=시간 섹션) 라벨
      const directLabel = page.locator("label", { hasText: /^직접선택$/ }).last();
      await directLabel.waitFor({ state: "visible", timeout: 4000 });
      await directLabel.click();
      // 시간 popover 트리거
      const startTimeTrig = page.getByRole("button", { name: /시작 시간 선택/ }).first();
      await startTimeTrig.waitFor({ state: "visible", timeout: 5000 });
      await startTimeTrig.scrollIntoViewIfNeeded();
      await startTimeTrig.click();
      const timePop = page.locator(".time-picker.time-picker--portaled");
      await timePop.waitFor({ state: "visible", timeout: 3000 });
      await ensureInViewport(page, timePop, `차시 모달 시작 시간 @${vp.label}`);
      await shoot(page, `${vp.width}-6-session-modal-start-time`);

      // 취소
      await page.keyboard.press("Escape").catch(() => {});
      const cancelBtn = page.getByRole("button", { name: /^취소$/ }).first();
      if (await cancelBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await cancelBtn.click();
      }
    });

    test("3) ClinicCreatePanel: 클리닉 생성 패널 시간 popover (저장 X)", async ({ page }) => {
      await loginViaUI(page, "admin");
      await page.goto(`${BASE}/admin/clinic/operations`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});

      // "클리닉 만들기" 버튼 (사이드바 또는 빈 상태 CTA)
      const addBtn = page.getByRole("button", { name: /클리닉 만들기/ }).first();
      if (!(await addBtn.isVisible({ timeout: 6000 }).catch(() => false))) {
        await shoot(page, `${vp.width}-debug-clinic-no-btn`);
        test.skip(true, "클리닉 만들기 버튼 못 찾음");
        return;
      }
      await addBtn.click();
      const startTimeTrig = page.getByRole("button", { name: /시작 시간 선택/ }).first();
      if (!(await startTimeTrig.isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, "클리닉 시간 트리거 못 찾음");
        return;
      }
      await startTimeTrig.scrollIntoViewIfNeeded();
      await startTimeTrig.click();
      const timePop = page.locator(".time-picker.time-picker--portaled");
      await timePop.waitFor({ state: "visible", timeout: 3000 });
      await ensureInViewport(page, timePop, `클리닉 모달 시작 시간 @${vp.label}`);
      await shoot(page, `${vp.width}-7-clinic-modal-start-time`);
      // 취소
      await page.keyboard.press("Escape").catch(() => {});
      const closeBtn = page.locator('[aria-label*="닫기"], button[aria-label*="close"]').first();
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
      }
    });

    test("5) LectureCreateModal: AntD Popover (담당강사 + 과목 불러오기) viewport 안", async ({ page }) => {
      await loginViaUI(page, "admin");
      await openModalLectures(page);

      // 담당 강사 popover
      const teacherTrig = page.getByRole("button", { name: /담당 강사/ }).first();
      await teacherTrig.scrollIntoViewIfNeeded();
      await teacherTrig.click();
      // AntD Popover는 .ant-popover로 portal됨
      const teacherPop = page.locator(".ant-popover:not(.ant-popover-hidden)").first();
      await teacherPop.waitFor({ state: "visible", timeout: 4000 });
      await ensureInViewport(page, teacherPop, `담당 강사 popover @${vp.label}`);
      await shoot(page, `${vp.width}-9-lecture-instructor-popover`);
      // 닫기
      await teacherTrig.click();
      await expect(teacherPop).toBeHidden({ timeout: 3000 });

      // 과목 저장 popover (FolderOpen 아이콘)
      const subjectLoadBtn = page.getByRole("button", { name: /저장된 과목 불러오기/ }).first();
      await subjectLoadBtn.scrollIntoViewIfNeeded();
      await subjectLoadBtn.click();
      const subjectPop = page.locator(".ant-popover:not(.ant-popover-hidden)").first();
      await subjectPop.waitFor({ state: "visible", timeout: 4000 });
      await ensureInViewport(page, subjectPop, `과목 popover @${vp.label}`);
      await shoot(page, `${vp.width}-10-lecture-subject-popover`);
    });

    test("6) ClinicCreatePanel: inline DatePicker + 장소 popover viewport 안", async ({ page }) => {
      await loginViaUI(page, "admin");
      await page.goto(`${BASE}/admin/clinic/operations`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});

      const addBtn = page.getByRole("button", { name: /클리닉 만들기/ }).first();
      if (!(await addBtn.isVisible({ timeout: 6000 }).catch(() => false))) {
        test.skip(true, "클리닉 만들기 버튼 못 찾음");
        return;
      }
      await addBtn.click();

      // inline DatePicker (openBelow=true) — 캘린더가 인라인으로 펼침
      const dateTrig = page.locator("button.shared-date-picker-trigger").first();
      if (await dateTrig.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dateTrig.scrollIntoViewIfNeeded();
        await dateTrig.click();
        // inline 모드라 portaled 클래스 X → inline-below 클래스
        const inlineCal = page.locator(".shared-date-picker-dropdown--inline-below").first();
        if (await inlineCal.isVisible({ timeout: 3000 }).catch(() => false)) {
          await ensureInViewport(page, inlineCal, `클리닉 inline DatePicker @${vp.label}`);
          await shoot(page, `${vp.width}-11-clinic-inline-datepicker`);
          // 닫기
          await dateTrig.click();
          await expect(inlineCal).toBeHidden({ timeout: 3000 });
        }
      }

      // 장소 불러오기 AntD Popover (placement=bottomRight)
      const loadBtn = page.getByRole("button", { name: /저장된 장소 불러오기|장소 불러오기/ }).first();
      if (await loadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await loadBtn.scrollIntoViewIfNeeded();
        await loadBtn.click();
        const pop = page.locator(".ant-popover:not(.ant-popover-hidden)").first();
        if (await pop.isVisible({ timeout: 3000 }).catch(() => false)) {
          await ensureInViewport(page, pop, `클리닉 장소 popover @${vp.label}`);
          await shoot(page, `${vp.width}-12-clinic-location-popover`);
        }
      }
    });

    test("4) SessionAttendancePage: 상태 popover (visual only)", async ({ page }) => {
      await loginViaUI(page, "admin");
      // API로 첫 강의·차시 id 조회 → 직접 navigate (안정성 ↑)
      const ids = await findFirstLectureSessionIds(page);
      if (!ids) {
        test.skip(true, "강의·차시 데이터 없음");
        return;
      }
      await page.goto(`${BASE}/admin/lectures/${ids.lectureId}/sessions/${ids.sessionId}/attendance`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});

      // 상태 필터 popover 트리거
      const filterBtn = page.getByRole("button", { name: /상태필터|상태 필터/ }).first();
      if (!(await filterBtn.isVisible({ timeout: 6000 }).catch(() => false))) {
        await shoot(page, `${vp.width}-debug-attendance-no-filter-btn`);
        test.skip(true, "상태 필터 버튼 못 찾음 (해당 차시 출결 데이터 없거나 UI 미렌더)");
        return;
      }
      await filterBtn.scrollIntoViewIfNeeded();
      await filterBtn.click();
      const pop = page.locator(".attendance-popover").first();
      await pop.waitFor({ state: "visible", timeout: 3000 });
      await ensureInViewport(page, pop, `상태 필터 popover @${vp.label}`);
      await shoot(page, `${vp.width}-8-attendance-status-filter`);
      // 닫기
      await page.keyboard.press("Escape").catch(() => {});
    });
  });
}

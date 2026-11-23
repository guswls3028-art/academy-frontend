import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/strictTest';
import { installTenantOneInitScript } from '../helpers/localAuthApiStubs';
import type { SessionScheduleDraft, SessionSchedules } from '../../src/shared/api/contracts/sessionSchedules';
import type { LectureScheduleSettings } from '../../src/app_admin/domains/lectures/lectureScheduleSettings';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:5174';
const path = '/workspace/lectures/9901/sessions/9902';
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), 'Local synthetic API only');
test.use({ serviceWorkers: 'block' });
const roster = [
  { enrollment_id: 31, student_name: '김수연' },
  { enrollment_id: 32, student_name: '이목현' },
  { enrollment_id: 33, student_name: '박새봄' },
];
type CreateRequest = { create_request_id: string; title: string; date: string; initial_schedules: Pick<SessionScheduleDraft, 'label' | 'date'>[] };
type CreatedSession = { id: number; lecture: number; title: string; date: string; order: number; regular_order: number; session_type: string; schedule_dates: CreateRequest['initial_schedules'] };
async function capture(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await test.info().attach(name, { path, contentType: 'image/png' });
}
function fixture(configured = false) {
  const state = {
    config: { version: 'v1', schedules: configured ? [
      { id: 71, label: '수요일반', date: '2026-11-04', start_time: '16:00', end_time: '18:00', enrollment_ids: [31] },
      { id: 72, label: '목요일반', date: '2026-11-05', start_time: null, end_time: null, enrollment_ids: [32] },
    ] : [], roster, unassigned_enrollment_ids: configured ? [33] : [31, 32, 33] } as SessionSchedules,
    puts: [] as { version: string; schedules: SessionScheduleDraft[] }[],
    creates: [] as CreateRequest[],
    created: null as CreatedSession | null,
    lectureSettings: null as LectureScheduleSettings | null,
    legacySection: false,
    lecturePatches: [] as LectureScheduleSettings[],
    rejectLectureSettings: false,
    copies: [] as { version: string; source_session: number }[],
    bulk: [] as { session: number; schedule?: string }[],
    presentEnrollmentIds: new Set<number>(),
    scoresByEnrollment: new Map<number, number>(),
    reads: [] as { kind: string; scope: string | null }[],
    failSave: 0, failRead: false, failSessionList: false, failScores: false, failAttendance: false, attendanceFilled: 0,
    loseCreateResponse: false, loseTransferResponse: false,
  };
  return state;
}
async function install(page: Page, state: ReturnType<typeof fixture>) {
  await installTenantOneInitScript(page);
  const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 12, tenant_code: 'hakwonplus' })).toString('base64url');
  await page.addInitScript(jwt => { localStorage.setItem('access', jwt); localStorage.setItem('refresh', `${jwt}-refresh`); }, `e30.${payload}.sig`);
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    if (endpoint === '/core/program/') return json({ tenantCode: 'hakwonplus', isPlatformAdmin: true, display_name: '학원플러스', feature_flags: { section_mode: state.legacySection }, is_active: true });
    if (endpoint === '/core/me/') return json({ id: 12, username: 'admin', name: '관리자', is_staff: true, is_superuser: true, tenantRole: 'admin', must_change_password: false });
    if (endpoint === '/results/admin/teacher-dashboard-counts/') return json({ qna_pending: 0, counsel_pending: 0, submission_pending: 0, homework_review_pending: 0, homework_review_by_homework: {}, video_failed: 0 });
    if (endpoint === '/lectures/attendance/arrival-overview/') return json({ generated_at: '2026-11-05T00:00:00Z', today: '2026-11-05', tomorrow: '2026-11-06', range_end: '2026-11-11', range_days: 7, soon_window_minutes: 60, summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 }, items: [] });
    if (endpoint === '/lectures/lectures/instructor-options/') return json([{ name: '관리자', type: 'owner' }]);
    if (endpoint === '/lectures/sections/' && state.legacySection) return json([{ id: 41, label: 'A', section_type: 'CLASS', is_active: true, day_of_week_display: '수요일', start_time: '16:00' }]);
    if (endpoint === '/lectures/lectures/9901/' || endpoint === '/lectures/lectures/9901/schedule-settings/') {
      if (endpoint.endsWith('/schedule-settings/') && method === 'PATCH') {
        if (state.rejectLectureSettings) return json({ detail: '일정 설정을 저장할 수 없습니다.' }, 404);
        const { schedule_mode, schedule_defaults } = request.postDataJSON() as LectureScheduleSettings;
        state.lectureSettings = { schedule_mode, schedule_defaults };
        state.lecturePatches.push(state.lectureSettings);
      }
      return json({ id: 9901, title: '요일별 수업', color: '#2563eb', chip_label: '수업', ...(state.lectureSettings && {
        name: '관리자', subject: '수학', start_date: '2026-11-04', lecture_time: '16:00~18:00', ...state.lectureSettings,
      }) });
    }
    const current = { id: 9902, lecture: 9901, lecture_title: '요일별 수업', title: '2차시', order: 2, regular_order: 2, session_type: 'REGULAR', date: '2026-11-04', schedule_dates: state.config.schedules, attendance_filled: state.attendanceFilled, attendance_total: 1 };
    const previous = { ...current, id: 9900, title: '1차시', order: 1, regular_order: 1, date: '2026-10-28', schedule_dates: [], section: state.legacySection ? 41 : null };
    if (endpoint === '/lectures/sessions/9902/') return json(current);
    if (endpoint === '/lectures/sessions/9900/') return json(previous);
    if (endpoint === '/lectures/sessions/9903/' && state.created) return json(state.created);
    if (endpoint === '/lectures/sessions/9900/schedules/' && method === 'GET') return json(fixture().config);
    if (endpoint === '/lectures/sessions/' && state.failSessionList) return json({ detail: '차시 목록 조회 실패' }, 400);
    if (endpoint === '/lectures/sessions/with-schedules/' && method === 'POST') {
      const body: CreateRequest = request.postDataJSON();
      state.creates.push(body);
      if (state.created) {
        expect(body).toEqual(state.creates[0]);
      } else {
        state.created = { id: 9903, lecture: 9901, title: body.title, date: body.date, order: 3, regular_order: 3, session_type: 'REGULAR', schedule_dates: body.initial_schedules };
      }
      if (state.loseCreateResponse) {
        state.loseCreateResponse = false;
        return json({ detail: '응답 확인 실패' }, 503);
      }
      return json(state.created, 201);
    }
    if (endpoint === '/lectures/sessions/') {
      const results = url.searchParams.has('date') ? [current] : [previous, current, ...(state.created ? [state.created] : [])];
      return json({ count: results.length, results });
    }
    if (endpoint === '/enrollments/session-enrollments/') return json({ count: 3, results: roster.map(s => ({ id: s.enrollment_id + 300, session: 9902, enrollment: s.enrollment_id, student_id: s.enrollment_id + 200, student_name: s.student_name, enrollment_status: 'ACTIVE' })) });
    if (endpoint === '/exams/') return json({ count: 1, results: [{ id: 81, title: '공통 시험', max_score: 100, pass_score: 60 }] });
    if (endpoint === '/results/admin/exams/81/results/') return json({ count: 3, results: roster.map(s => ({ ...s, score: 80, final_score: 80, exam_score: 80, max_score: 100 })) });
    if (endpoint === '/lectures/sessions/9902/schedules/') {
      if (method === 'GET') return state.failRead ? json({ detail: '수업일 조회 실패' }, 400) : json(state.config);
      if (method === 'PUT') {
        const body = request.postDataJSON(); state.puts.push(body);
        if (state.failSave) return json({ detail: state.failSave === 409 ? '동시 수정' : '입력 내용을 확인해 주세요.' }, state.failSave);
        expect(body.version).toBe(state.config.version);
        const ids = body.schedules.flatMap((s: SessionScheduleDraft) => s.enrollment_ids);
        expect(new Set(ids).size).toBe(ids.length);
        state.config = { ...state.config, version: `v${state.puts.length + 1}`, schedules: body.schedules.map((s: SessionScheduleDraft, i: number) => ({ ...s, id: s.id ?? 71 + i })), unassigned_enrollment_ids: roster.filter(s => !ids.includes(s.enrollment_id)).map(s => s.enrollment_id) };
        if (state.loseTransferResponse) {
          state.loseTransferResponse = false;
          return json({ detail: '응답 확인 실패' }, 503);
        }
        return json(state.config);
      }
      if (method === 'POST') {
        expect(state.config.schedules).toHaveLength(0);
        state.copies.push(request.postDataJSON());
        expect(state.copies.at(-1)).toEqual({ version: state.config.version, source_session: 9900 });
        state.config = { ...fixture(true).config, version: 'copied', schedules: [{ ...fixture(true).config.schedules[0], enrollment_ids: [31, 33] }], unassigned_enrollment_ids: [32] };
        return json(state.config);
      }
    }
    const scope = url.searchParams.get('schedule');
    const ids = scope === null ? roster.map(s => s.enrollment_id) : scope === '0' ? state.config.unassigned_enrollment_ids : state.config.schedules.find(s => String(s.id) === scope)?.enrollment_ids ?? [];
    const students = roster.filter(s => ids.includes(s.enrollment_id));
    if (endpoint === '/lectures/attendance/' && method === 'GET') {
      state.reads.push({ kind: 'attendance', scope });
      if (state.failAttendance && scope !== null) return json({ detail: '출결 조회 실패' }, 400);
      return json({ count: students.length, page_size: 50, next: null, results: students.map(s => ({ id: s.enrollment_id + 100, enrollment_id: s.enrollment_id, student_id: s.enrollment_id + 200, name: s.student_name, student_name: s.student_name, status: state.presentEnrollmentIds.has(s.enrollment_id) ? 'PRESENT' : 'UNSET' })) });
    }
    if (endpoint === '/lectures/attendance/bulk_set_present/') {
      const body = request.postDataJSON() as { session: number; schedule?: string };
      state.bulk.push(body);
      const targets = body.schedule === undefined ? roster.map(s => s.enrollment_id) : body.schedule === '0' ? state.config.unassigned_enrollment_ids : state.config.schedules.find(s => String(s.id) === body.schedule)?.enrollment_ids ?? [];
      const updated = targets.filter(id => !state.presentEnrollmentIds.has(id)).length;
      targets.forEach(id => state.presentEnrollmentIds.add(id));
      return json({ updated, session: 9902, undo_token: null, undo_expires_in: null });
    }
    if (endpoint === '/results/admin/sessions/9902/scores/') {
      state.reads.push({ kind: 'scores', scope });
      if (state.failScores) return json({ detail: '성적 조회 실패' }, 400);
      return json({ meta: { session_title: '2차시', lecture_title: '요일별 수업', lecture_id: 9901, exams: [{ exam_id: 81, title: '공통 시험', max_score: 100, pass_score: 60, objective_max_score: 100, subjective_max_score: 0 }], homeworks: [] }, rows: students.map(s => ({ ...s, student_id: s.enrollment_id + 200, exams: [{ exam_id: 81, title: '공통 시험', block: { score: state.scoresByEnrollment.get(s.enrollment_id) ?? 80, max_score: 100, passed: true, objective_score: 80, subjective_score: 0, is_locked: false, meta: {} } }], homeworks: [], updated_at: '2026-11-04T00:00:00Z' })) });
    }
    if (endpoint === '/results/admin/sessions/9900/scores/') {
      return json({ meta: { session_title: '1차시', lecture_title: '요일별 수업', lecture_id: 9901, exams: [], homeworks: [] }, rows: [] });
    }
    if (endpoint.endsWith('/score-draft/')) return json({ changes: [] });
    return json({ count: 0, next: null, results: [] });
  });
}

for (const width of [390, 1366]) test(`저장한 강의의 반별 기본 일정은 새 공통 차시에 적용된다 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = fixture(true);
  state.lectureSettings = { schedule_mode: 'SINGLE', schedule_defaults: [] };
  state.legacySection = true;
  await install(page, state);
  await page.goto(`${BASE}/workspace/lectures/9901`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('수업 A반', { exact: true })).toBeVisible();
  const settings = page.getByRole('button', { name: '강의 설정', exact: true });
  await settings.click();
  const edit = page.getByRole('dialog', { name: '강의 수정', exact: true });
  const mode = edit.getByLabel('수업 운영 방식');
  await expect(mode).toHaveValue('SINGLE');
  await expect(edit.getByLabel('1번째 반 이름')).toHaveCount(0);
  await mode.selectOption('SPLIT');
  await edit.getByLabel('1번째 반 이름').fill('수요일 A반');
  await edit.getByLabel('1번째 반 기본 요일').selectOption('3');
  await edit.getByLabel('2번째 반 이름').fill('목요일 B반');
  await edit.getByLabel('2번째 반 기본 요일').selectOption('4');
  await edit.getByRole('button', { name: '반 추가', exact: true }).click();
  await edit.getByLabel('3번째 반 이름').fill('금요일 C반');
  await edit.getByLabel('3번째 반 기본 요일').selectOption('5');
  await edit.getByLabel('3번째 반 이름').scrollIntoViewIfNeeded();
  await capture(page, `lecture-schedule-setting-${width}`);
  const form = edit.locator('.lecture-create-modal-form');
  expect(await form.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  state.rejectLectureSettings = true;
  await edit.getByRole('button', { name: '수정', exact: true }).click();
  await expect(edit.getByRole('alert')).toContainText('일정 설정을 저장할 수 없습니다.');
  await expect(edit.getByLabel('3번째 반 이름')).toHaveValue('금요일 C반');
  expect(state.lecturePatches).toEqual([]);
  state.rejectLectureSettings = false;
  await edit.getByRole('button', { name: '수정', exact: true }).click();
  await expect(edit).toBeHidden();
  expect(state.lecturePatches).toEqual([{ schedule_mode: 'SPLIT', schedule_defaults: [
    { label: '수요일 A반', weekday: 3 }, { label: '목요일 B반', weekday: 4 }, { label: '금요일 C반', weekday: 5 },
  ] }]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settings.click();
  await expect(mode).toHaveValue('SPLIT');
  await expect(edit.getByLabel('3번째 반 기본 요일')).toHaveValue('5');
  await edit.getByRole('button', { name: '취소', exact: true }).click();
  const commonAdd = page.getByRole('button', { name: '공통 차시 수업 추가', exact: true });
  await commonAdd.click();
  const create = page.getByRole('dialog', { name: '차시 추가', exact: true });
  await create.getByRole('button', { name: /정규 차시 추가/ }).click();
  await expect(create.getByLabel('수업일 1 이름')).toHaveValue('수요일 A반');
  await expect(create.getByLabel('수업일 2 이름')).toHaveValue('목요일 B반');
  await expect(create.getByLabel('수업일 3 이름')).toHaveValue('금요일 C반');
  await create.getByLabel('수업일 2 이름').fill('목요일 이름 변경 초안');
  await create.getByRole('button', { name: /^보강/ }).first().click();
  await expect(create.getByLabel('수업일 2 이름')).toHaveCount(0);
  await expect(create.getByRole('button', { name: '날짜 선택', exact: true })).toBeVisible();
  await create.getByRole('button', { name: /정규 차시 추가/ }).click();
  await expect(create.getByLabel('수업일 2 이름')).toHaveValue('목요일 이름 변경 초안');
  await create.getByLabel('수업일 2 이름').fill('목요일 B반');
  await create.getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('alertdialog', { name: '차시 생성 최종 확인', exact: true }).getByRole('button', { name: '확인하고 추가', exact: true }).click();
  await expect(create).toBeHidden();
  const savedDates = state.created?.schedule_dates;
  expect(savedDates?.map(({ label, date }) => [label, date])).toEqual([
    ['수요일 A반', '2026-11-11'], ['목요일 B반', '2026-11-12'], ['금요일 C반', '2026-11-13'],
  ]);
  await expect(page.getByText('수업 A반', { exact: true })).toBeVisible();
  await settings.click();
  await mode.selectOption('SINGLE');
  await edit.getByRole('button', { name: '수정', exact: true }).click();
  await expect(edit).toBeHidden();
  await commonAdd.click();
  await create.getByRole('button', { name: /정규 차시 추가/ }).click();
  await expect(create.getByLabel('수업일 1 이름')).toHaveCount(0);
  expect(state.created?.schedule_dates).toEqual(savedDates);
  expect(state.puts).toEqual([]);
});

for (const width of [390, 1366]) test(`새 차시에서 여러 수업일을 작성하고 안전하게 재시도한다 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = fixture();
  state.loseCreateResponse = true;
  await install(page, state);
  const entry = width === 390 ? '/workspace/lectures/9901' : `${path}/attendance`;
  await page.goto(`${BASE}${entry}`, { waitUntil: 'domcontentloaded' });
  const addSession = page.getByRole('button', { name: '수업 추가', exact: true });
  await expect(addSession).toBeVisible();
  await addSession.click();
  const create = page.getByRole('dialog', { name: '차시 추가', exact: true });
  await create.getByRole('button', { name: /정규 차시 추가/ }).click();
  const days = create.getByRole('region', { name: '차시 수업일', exact: true });
  for (let index = 0; index < 3; index++) await days.getByRole('button', { name: '수업일 추가', exact: true }).click();
  await days.getByRole('button', { name: '수업일 4 제거', exact: true }).click();
  await expect(days.getByLabel('수업일 1 이름', { exact: true })).toHaveAttribute('placeholder', '수요일반');
  await days.getByLabel('수업일 2 이름', { exact: true }).fill('목요일반');
  await days.getByLabel('수업일 3 이름', { exact: true }).fill('토요일반');
  await days.getByRole('button', { name: '수업일 3 날짜', exact: true }).click();
  await page.getByRole('dialog', { name: '날짜 선택', exact: true }).getByRole('button', { name: '14', exact: true }).click();
  await days.getByLabel('수업일 3 이름', { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, `session-create-days-${width}`);
  expect(await days.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(await days.evaluate(element => element.clientWidth));
  await create.getByRole('button', { name: '저장', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: '차시 생성 최종 확인', exact: true });
  await expect(confirm).toContainText('2026-11-14');
  await confirm.getByRole('button', { name: '확인하고 추가', exact: true }).click();
  await expect(create.getByRole('alert')).toContainText('같은 요청');
  await expect(days.getByLabel('수업일 3 이름', { exact: true })).toBeDisabled();
  expect(state.creates).toHaveLength(1);
  expect(state.creates[0].create_request_id).toMatch(/^[\da-f-]{36}$/);
  await create.getByRole('button', { name: '같은 요청 다시 보내기', exact: true }).click();
  await expect(create).toBeHidden();
  expect(state.creates).toHaveLength(2);
  expect(state.created?.schedule_dates).toEqual([
    { label: '수요일반', date: '2026-11-11' },
    { label: '목요일반', date: '2026-11-12' },
    { label: '토요일반', date: '2026-11-14' },
  ]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('region', { name: '3차시 차시 카드', exact: true })).toHaveCount(1);
});

for (const width of [390, 1366]) test(`이번 차시의 학생만 새 수업일로 옮긴다 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 700 : 900 });
  const state = fixture(true);
  state.presentEnrollmentIds.add(32);
  await install(page, state);
  await page.goto(`${BASE}${path}/attendance?schedule=71`);
  const strip = page.getByRole('region', { name: '수업일 선택', exact: true });
  const studentLink = page.getByRole('link', { name: '이목현 학생 상세 열기', exact: true });
  await expect(studentLink).toHaveCount(0);
  await strip.getByRole('button', { name: '학생 수업일 변경', exact: true }).click();
  const move = page.getByRole('dialog', { name: '학생 수업일 변경', exact: true });
  await expect(move.getByLabel('옮길 수업일')).toHaveValue('71');
  await move.getByRole('searchbox', { name: '학생 이름 검색', exact: true }).fill('목현');
  await move.getByRole('radio', { name: /이목현.*목요일반/ }).check();
  await expect(move.getByRole('status')).toContainText('목요일반');
  await expect(move.getByRole('status')).toContainText('수요일반');
  await capture(page, `session-student-move-${width}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const change = move.getByRole('button', { name: '수업일 변경', exact: true });
  state.config = { ...state.config, version: 'concurrent', schedules: state.config.schedules.map(day => day.id === 72 ? { ...day, label: '목요일 심화반' } : day) };
  state.failSave = 409;
  await change.click();
  await expect(move.getByRole('alert')).toContainText('최신 배정을 불러왔습니다');
  await expect(move.getByRole('status')).toContainText('목요일 심화반');
  expect(state.config.schedules[1].enrollment_ids).toEqual([32]);
  state.failSave = 0;
  state.loseTransferResponse = true;
  await change.click();
  await expect(move).toBeHidden();
  expect(state.puts).toHaveLength(2);
  expect(state.puts[1].version).toBe('concurrent');
  expect(state.config.schedules.map(day => day.enrollment_ids)).toEqual([[31, 32], []]);
  expect(state.config.unassigned_enrollment_ids).toEqual([33]);
  await expect(studentLink).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(studentLink).toBeVisible();
  expect([...state.presentEnrollmentIds]).toEqual([32]);
  await strip.getByRole('button', { name: /^목요일 심화반/ }).click();
  await expect(page).toHaveURL(/schedule=72/);
  await expect(studentLink).toHaveCount(0);
});

for (const width of [390, 1366]) test(`수업일 작성·배정·저장·reload·출결/성적 범위 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = fixture(); await install(page, state);
  const strip = page.getByRole('region', { name: '수업일 선택' });
  await page.goto(`${BASE}/workspace/lectures/9901`, { waitUntil: 'domcontentloaded' });
  const sessionCard = page.getByRole('region', { name: '2차시 차시 카드', exact: true });
  await expect(sessionCard).toBeVisible();
  const gear = sessionCard.getByRole('button', { name: '차시 설정', exact: true });
  await gear.focus();
  await gear.press('Enter');
  await page.getByRole('menu', { name: '차시 설정 메뉴' }).getByRole('button', { name: '수정', exact: true }).click();
  await page.getByRole('dialog', { name: '차시 설정 편집' }).getByRole('button', { name: '수업일 관리', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '수업일 관리' });
  await modal.getByRole('button', { name: '수업일 추가' }).click();
  await modal.getByLabel('수업일 1 이름').fill('수요일반');
  await modal.getByLabel('학생 검색').fill('김');
  await modal.getByRole('checkbox', { name: '검색 결과 전체 선택', exact: true }).check();
  await modal.getByRole('button', { name: '선택 학생 배정' }).click();
  await modal.getByRole('button', { name: '수업일 추가' }).click();
  await modal.getByLabel('수업일 2 이름').fill('목요일반');
  await modal.getByLabel('날짜', { exact: true }).click();
  await page.getByRole('dialog', { name: '날짜 선택', exact: true }).getByRole('button', { name: '5', exact: true }).click();
  await modal.getByLabel('학생 검색').fill('이');
  await modal.getByRole('checkbox', { name: '검색 결과 전체 선택', exact: true }).check();
  await modal.getByRole('button', { name: '선택 학생 배정' }).click();
  await modal.getByRole('button', { name: '수업일 추가', exact: true }).click();
  await modal.getByLabel('수업일 3 이름', { exact: true }).fill('금요일반');
  await modal.getByLabel('날짜', { exact: true }).click();
  await page.getByRole('dialog', { name: '날짜 선택', exact: true }).getByRole('button', { name: '6', exact: true }).click();
  await modal.getByLabel('학생 검색', { exact: true }).fill('박새봄');
  const fridayStudent = modal.getByRole('checkbox', { name: /박새봄/ });
  await fridayStudent.check();
  await modal.getByRole('button', { name: '선택 학생 배정', exact: true }).click();
  const days = modal.getByRole('region', { name: '수업일 목록', exact: true });
  await days.getByRole('button', { name: /^수요일반/ }).click();
  await expect(modal.getByLabel('수업일 1 이름', { exact: true })).toHaveValue('수요일반');
  await expect(modal.getByLabel('수업일 3 이름', { exact: true })).toHaveCount(0);
  await days.getByRole('button', { name: /^금요일반/ }).click();
  await modal.getByLabel('수업일 3 이름', { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, `schedule-manager-${width}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await modal.getByRole('button', { name: '저장', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(state.puts[0].schedules.map(s => [s.label, s.date, s.enrollment_ids])).toEqual([
    ['수요일반', '2026-11-04', [31]],
    ['목요일반', '2026-11-05', [32]],
    ['금요일반', '2026-11-06', [33]],
  ]);
  await page.goto(`${BASE}${path}/attendance`);
  await expect(sessionCard.getByRole('region', { name: '수업일 선택', exact: true })).toBeVisible();
  await expect(strip.getByText('수업일 3개', { exact: true })).toBeVisible();
  await capture(page, `schedule-card-${width}`);
  await strip.getByRole('button', { name: /^금요일반/ }).click();
  await expect(page).toHaveURL(/schedule=73/);
  await expect(page.getByText('2026-11-06 · 금요일반', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '박새봄 학생 상세 열기', exact: true })).toBeVisible();
  await strip.getByRole('button', { name: '수업일 수정 · 금요일반', exact: true }).click();
  await expect(modal.getByLabel('수업일 3 이름', { exact: true })).toHaveValue('금요일반');
  await modal.getByLabel('날짜', { exact: true }).click();
  await page.getByRole('dialog', { name: '날짜 선택', exact: true }).getByRole('button', { name: '13', exact: true }).click();
  await modal.getByLabel('학생 검색', { exact: true }).fill('박새봄');
  await fridayStudent.check();
  await modal.getByRole('button', { name: '배정 해제', exact: true }).click();
  await modal.getByRole('button', { name: '저장', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByText('2026-11-13 · 금요일반', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '박새봄 학생 상세 열기', exact: true })).toHaveCount(0);
  expect(state.puts.at(-1)?.schedules.find(s => s.label === '금요일반')).toMatchObject({ id: 73, date: '2026-11-13', enrollment_ids: [] });
  await strip.getByRole('button', { name: /^수요일반/ }).click();
  await expect(page).toHaveURL(/schedule=71/);
  await expect(page.getByText('2026-11-04 · 수요일반', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기' })).toBeVisible();
  await expect(page.getByRole('link', { name: '이목현 학생 상세 열기' })).toHaveCount(0);
  await expect(strip.getByRole('status')).toHaveCount(0);
  await page.getByRole('link', { name: '김수연 학생 상세 열기' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기' })).toBeInViewport();
  await capture(page, `schedule-attendance-${width}`);
  await page.getByRole('tab', { name: '성적', exact: true }).click();
  await expect(page).toHaveURL(/scores\?schedule=71/);
  await expect(page.getByRole('checkbox', { name: '김수연 선택', exact: true })).toBeVisible();
  await expect(page.locator('.scores-entry-page').getByText('성적 불러오는 중…', { exact: true })).toBeHidden();
  await expect(page.getByRole('group', { name: '성적 편집과 출력', exact: true }).getByRole('status')).toContainText('성적표 수정 잠김');
  await page.getByRole('checkbox', { name: '김수연 선택', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('checkbox', { name: '김수연 선택', exact: true })).toBeInViewport();
  await capture(page, `schedule-scores-${width}`);
  await page.getByRole('checkbox', { name: '김수연 선택', exact: true }).check();
  await strip.getByRole('button', { name: /^목요일반/ }).click();
  const thursdayHeading = page.getByText('2026-11-05 · 목요일반', { exact: true });
  await expect(thursdayHeading).toBeVisible();
  await thursdayHeading.scrollIntoViewIfNeeded();
  await capture(page, `schedule-thursday-header-${width}`);
  await expect(page.getByRole('checkbox', { name: '이목현 선택', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: '김수연 선택', exact: true })).toHaveCount(0);
  await strip.getByRole('button', { name: /^미배정/ }).click();
  await expect(page.getByText('수업일 미배정', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '박새봄 선택', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '출결', exact: true }).click();
  await expect(page).toHaveURL(/attendance\?schedule=0/);
  await expect(page.getByRole('group', { name: '박새봄 출결 상태 선택', exact: true }).getByRole('button', { pressed: true })).toHaveText('미입력');
  await page.getByRole('button', { name: '출결 도구', exact: true }).click();
  await expect(page).toHaveURL(/attendance\?schedule=0$/);
  const tools = page.getByRole('dialog', { name: '출결 도구', exact: true });
  await expect(tools.getByRole('heading', { name: '출결 도구', exact: true })).toBeVisible();
  const scopedTools = tools.getByRole('region', { name: '수업일 명단 도구', exact: true });
  await expect(scopedTools.getByText('현장 출석은 선택한 수업일에 적용됩니다. 엑셀에는 강의 전체 출결 기록이 담깁니다.', { exact: true })).toBeVisible();
  const readsBeforeSave = state.reads.filter(r => r.kind === 'attendance' && r.scope === '0').length;
  await scopedTools.getByRole('button', { name: '수업일 현장 출석', exact: true }).click();
  await expect(page.getByText('선택한 수업일을 현장 출석으로 바꿀까요?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '전체 현장 적용', exact: true }).click();
  await expect.poll(() => state.bulk).toEqual([{ session: 9902, schedule: '0' }]);
  await expect(tools).toBeHidden();
  await expect(page).toHaveURL(/attendance\?schedule=0$/);
  await expect.poll(() => state.reads.filter(r => r.kind === 'attendance' && r.scope === '0').length).toBeGreaterThan(readsBeforeSave);
  await expect(page.getByRole('group', { name: '박새봄 출결 상태 선택', exact: true }).getByRole('button', { pressed: true })).toHaveText('현장');
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/attendance\?schedule=0$/);
  await expect(page.getByRole('group', { name: '박새봄 출결 상태 선택', exact: true }).getByRole('button', { pressed: true })).toHaveText('현장');
  await page.getByRole('button', { name: '출결 도구', exact: true }).click();
  await tools.getByRole('button', { name: '대화상자 종료' }).click();
  await expect(page).toHaveURL(/attendance\?schedule=0$/);
  await strip.getByRole('button', { name: /^수요일반/ }).click();
  await expect(page).toHaveURL(/attendance\?schedule=71$/);
  await expect(tools).toBeHidden();
  await expect(page.getByRole('group', { name: '김수연 출결 상태 선택', exact: true }).getByRole('button', { pressed: true })).toHaveText('미입력');
  await expect(page.getByRole('link', { name: '박새봄 학생 상세 열기', exact: true })).toHaveCount(0);
  await expect.poll(() => state.reads.some(r => r.kind === 'scores' && r.scope === '0')).toBe(true);

  // Bookmarked tool URLs still retain the current schedule when dismissed.
  await page.goto(`${page.url()}&view=tools`);
  await expect(tools).toBeVisible();
  await tools.getByRole('button', { name: '대화상자 종료' }).click();
  await expect(page).toHaveURL(/attendance\?schedule=71$/);
  const thursday = strip.getByRole('button', { name: /^목요일반/ });
  await thursday.click();
  await expect(page).toHaveURL(/attendance\?schedule=72$/);
  await expect(tools).toBeHidden();
  await expect(page.getByRole('link', { name: '이목현 학생 상세 열기', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/attendance\?schedule=72$/);
  await expect(page.getByRole('link', { name: '이목현 학생 상세 열기', exact: true })).toBeVisible();
  await capture(page, `schedule-rapid-list-navigation-${width}`);
});

for (const width of [390, 1366]) test(`성적 탭이 열리는 중에 누른 수업일이 유지된다 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = fixture(true); await install(page, state);
  await page.goto(`${BASE}${path}/attendance?schedule=71`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기', exact: true })).toBeVisible();
  const thursday = page.getByRole('region', { name: '수업일 선택', exact: true }).getByRole('button', { name: /^목요일반/ });
  // Reproduce the window where browser history has moved and React still renders the previous tab.
  await page.evaluate((url) => window.history.replaceState(window.history.state, '', url), `${path}/scores?schedule=71`);
  await expect(page).toHaveURL(/scores\?schedule=71$/);
  await thursday.click();

  await expect(page).toHaveURL(/scores\?schedule=72$/);
  await expect(thursday).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('checkbox', { name: '이목현 선택', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '김수연 선택', exact: true })).toHaveCount(0);
  expect(state.reads).toContainEqual({ kind: 'scores', scope: '72' });
});

for (const [width, action] of [[390, "manage"], [1366, "manage"], [390, "add"], [1366, "pencil"], [1366, "gear"]] as const) test(`성적 초안을 읽는 중에도 수업일별 명단을 조회한다 ${width}px ${action}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = fixture(true); await install(page, state);
  const draftPath = '/api/v1/results/admin/sessions/9902/score-draft/';
  let releaseDraft!: () => void;
  const draftGate = new Promise<void>(resolve => { releaseDraft = resolve; });
  let draftRequested = false;
  const writes: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (/^\/api\/v1\/(results|lectures)\//.test(url.pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(request.method());
    }
  });
  await page.route(url => url.pathname === draftPath, async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    draftRequested = true;
    await draftGate;
    await route.fulfill({ json: { changes: [], active_editors: [] } });
  });
  try {
    await page.goto(`${BASE}${path}/scores?schedule=71`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('checkbox', { name: '김수연 선택', exact: true })).toBeVisible();
    await expect.poll(() => draftRequested, { timeout: 8_000 }).toBe(true);
    expect(writes).toEqual([]);
    const strip = page.getByRole('region', { name: '수업일 선택', exact: true });
    const manage = strip.getByRole('button', { name: '수업일 관리', exact: true });
    const pending = strip.getByRole('status').filter({ hasText: '이전 성적 입력을 확인하는 중…' });
    await expect(pending).toBeVisible();
    const queued = strip.getByRole('status').filter({ hasText: '수업일 관리를 열기 전에 이전 성적 입력을 확인하는 중…' });
    await expect(manage).toBeEnabled();
    const add = strip.getByRole('button', { name: '수업일 추가', exact: true });
    const pencil = strip.getByRole('button', { name: '수업일 수정 · 수요일반', exact: true });
    await expect(add).toBeEnabled();
    await expect(pencil).toBeEnabled();
    const modal = page.getByRole('dialog', { name: '수업일 관리', exact: true });
    await manage.click();
    await expect(queued).toBeVisible();
    await expect(modal).toBeHidden();
    const thursday = strip.getByRole('button', { name: /^목요일반/ });
    await thursday.click();
    await expect(page).toHaveURL(/scores\?schedule=72$/);
    await expect(page.getByRole('checkbox', { name: '이목현 선택', exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: '김수연 선택', exact: true })).toHaveCount(0);
    expect(state.reads).toContainEqual({ kind: 'scores', scope: '72' });
    expect(writes).toEqual([]);

    await expect(queued).toBeHidden();
    await expect(manage).toBeEnabled();
    if (action === 'gear') {
      const openSettings = async (label: string) => {
        const card = page.getByRole('region', { name: `${label} 차시 카드`, exact: true });
        await card.getByRole('button', { name: '차시 설정', exact: true }).press('Enter');
        await page.getByRole('menu', { name: '차시 설정 메뉴' }).getByRole('button', { name: '수정', exact: true }).click();
        return page.getByRole('dialog', { name: '차시 설정 편집' });
      };
      const previous = await openSettings('1차시');
      await expect(previous.getByRole('button', { name: '수업일 관리', exact: true })).toBeDisabled();
      await previous.getByRole('button', { name: '취소', exact: true }).click();
      const current = await openSettings('2차시');
      await current.getByLabel('차시 이름 (선택)', { exact: true }).fill('저장하지 않은 이름');
      await current.getByRole('button', { name: '수업일 관리', exact: true }).click();
      const discard = page.getByRole('alertdialog', { name: '저장하지 않은 차시 수정이 있습니다', exact: true });
      await expect(discard).toBeVisible();
      await discard.getByRole('button', { name: '취소', exact: true }).click();
      await expect(current.getByLabel('차시 이름 (선택)', { exact: true })).toHaveValue('저장하지 않은 이름');
      await expect(queued).toHaveCount(0);
      await current.getByRole('button', { name: '수업일 관리', exact: true }).click();
      await discard.getByRole('button', { name: '수업일 관리 열기', exact: true }).click();
    } else {
      await (action === 'add' ? add : action === 'pencil' ? pencil : manage).click();
    }
    await expect(queued).toBeVisible();
    await expect(modal).toBeHidden();
    const draftResponse = page.waitForResponse(response => new URL(response.url()).pathname === draftPath && response.request().method() === 'GET');
    releaseDraft();
    expect((await draftResponse).status()).toBe(200);
    await expect(thursday).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('checkbox', { name: '이목현 선택', exact: true })).toBeVisible();
    await expect(pending).toBeHidden();
    await expect(modal).toBeVisible();
    if (action === 'add') {
      const name = modal.getByLabel('수업일 3 이름', { exact: true });
      await expect(name).toHaveValue('');
      await name.click();
      await expect(name).toBeFocused();
      await page.keyboard.insertText('새 수업일');
      await expect(name).toHaveValue('새 수업일');
    } else {
      if (action !== 'pencil') {
        await expect(modal.getByLabel('수업일 2 이름', { exact: true })).toHaveValue('목요일반');
        await modal.getByRole('region', { name: '수업일 목록', exact: true }).getByRole('button', { name: /^수요일반/ }).click();
      }
      const name = modal.getByLabel('수업일 1 이름', { exact: true });
      await expect(name).toHaveValue('수요일반');
      await name.fill('수요일 편집 중');
      await expect(name).toHaveValue('수요일 편집 중');
    }
    expect(writes).toEqual([]);
  } finally {
    releaseDraft();
  }
});

for (const width of [390, 1366]) test(`다른 반의 성적 초안은 전체 성적을 확인한 뒤에만 복원한다 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = fixture(true); await install(page, state);
  const resultsPath = '/api/v1/results/admin';
  const draftPath = `${resultsPath}/sessions/9902/score-draft/`;
  let changes = [
    { type: 'examTotal', examId: 81, enrollmentId: 31, score: 63, maxScore: 100 },
    { type: 'examTotal', examId: 81, enrollmentId: 32, score: 74, maxScore: 100 },
  ];
  const expectedChanges = [...changes];
  let releaseDraft!: () => void;
  const draftGate = new Promise<void>(resolve => { releaseDraft = resolve; });
  let releaseRestore!: () => void;
  const restoreGate = new Promise<void>(resolve => { releaseRestore = resolve; });
  let holdRestore = true;
  const writes: { method: string; path: string; scope: string | null }[] = [];
  page.on('request', request => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith(resultsPath) && ['PUT', 'POST', 'PATCH'].includes(request.method())) {
      writes.push({ method: request.method(), path: pathname, scope: new URL(page.url()).searchParams.get('schedule') });
    }
  });
  await page.route(url => url.pathname === draftPath, async route => {
    if (route.request().method() === 'PUT') {
      expect(route.request().postDataJSON().changes).toEqual(expectedChanges);
      if (holdRestore) {
        holdRestore = false;
        await restoreGate;
      }
    } else {
      await draftGate;
    }
    await route.fulfill({ json: { changes, active_editors: [] } });
  });
  await page.route(url => url.pathname === `${draftPath}commit/`, async route => {
    changes = [];
    await route.fulfill({ status: 204 });
  });
  await page.route('**/results/admin/exams/81/enrollments/*/score/', async route => {
    const enrollmentId = Number(new URL(route.request().url()).pathname.split('/').at(-3));
    const { score } = route.request().postDataJSON();
    state.scoresByEnrollment.set(enrollmentId, score);
    await route.fulfill({ json: { score } });
  });

  try {
    await page.goto(`${BASE}${path}/scores?schedule=71`, { waitUntil: 'domcontentloaded' });
    const wed = page.getByRole('checkbox', { name: '김수연 선택', exact: true });
    const thu = page.getByRole('checkbox', { name: '이목현 선택', exact: true });
    await expect(wed).toBeVisible();
    await page.getByRole('region', { name: '수업일 선택', exact: true }).getByRole('button', { name: /^목요일반/ }).click();
    await expect(page).toHaveURL(/scores\?schedule=72$/);
    await expect(thu).toBeVisible();
    await expect(wed).toHaveCount(0);
    const strip = page.getByRole('region', { name: '수업일 선택', exact: true });
    const management = page.getByRole('dialog', { name: '수업일 관리', exact: true });
    await strip.getByRole('button', { name: '수업일 관리', exact: true }).click();
    const queued = strip.getByRole('status').filter({ hasText: '수업일 관리를 열기 전에 이전 성적 입력을 확인하는 중…' });
    await expect(queued).toBeVisible();
    releaseDraft();

    const review = page.getByRole('dialog', { name: /임시저장된 변경 2건/ });
    const values = review.getByRole('list', { name: '복원할 성적 변경' });
    const restore = review.getByRole('button', { name: '복원 후 수정', exact: true });
    await expect(review).toBeVisible();
    await expect(queued).toBeHidden();
    await expect(management).toBeHidden();
    expect(writes).toEqual([]);
    await expect(restore).toHaveCount(0);
    await review.getByRole('button', { name: '전체 성적에서 초안 확인', exact: true }).click();
    await expect(page).toHaveURL(/scores$/);
    await expect(wed).toBeVisible();
    await expect(thu).toBeVisible();
    await expect(restore).toBeEnabled();
    await expect(values.getByRole('listitem')).toHaveText(['김수연 · 공통 시험 · 총점 63점', '이목현 · 공통 시험 · 총점 74점']);
    expect(writes).toEqual([]);

    const restoreSent = page.waitForRequest(request => new URL(request.url()).pathname === draftPath && request.method() === 'PUT');
    await restore.click();
    await restoreSent;
    await page.goBack();
    await expect(page).toHaveURL(/scores\?schedule=72$/);
    await expect(wed).toHaveCount(0);
    releaseRestore();
    const reviewAll = review.getByRole('button', { name: '전체 성적에서 초안 확인', exact: true });
    await expect(reviewAll).toBeEnabled();
    expect(writes).toEqual([{ method: 'PUT', path: draftPath, scope: null }]);
    expect(changes).toEqual(expectedChanges);
    await reviewAll.click();
    await expect(page).toHaveURL(/scores$/);
    await expect(values.getByRole('listitem')).toHaveCount(2);
    await restore.click();
    await expect.poll(() => [...state.scoresByEnrollment].sort(([a], [b]) => a - b)).toEqual([[31, 63], [32, 74]]);
    await expect.poll(() => changes).toEqual([]);
    expect(writes.every(write => write.scope === null)).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^김수연 선택 .*63\/100/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^이목현 선택 .*74\/100/ })).toBeVisible();
  } finally {
    releaseDraft();
    releaseRestore();
  }
});

test('성적표에서 사라진 평가의 초안은 계속 보존하고 재확인할 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = fixture(true); await install(page, state);
  const changedAssessment = { type: 'examTotal', examId: 99, enrollmentId: 31, score: 63, maxScore: 100 };
  const draftPath = '/api/v1/results/admin/sessions/9902/score-draft/';
  const writes: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/results/admin/') && ['PUT', 'POST', 'PATCH'].includes(request.method())) {
      writes.push(request.method());
    }
  });
  await page.route(url => url.pathname === draftPath, route => route.fulfill({ json: { changes: [changedAssessment], active_editors: [] } }));
  await page.goto(`${BASE}${path}/scores`, { waitUntil: 'domcontentloaded' });
  const review = page.getByRole('dialog', { name: /임시저장된 변경 1건/ });
  await expect(review.getByRole('button', { name: '성적표 다시 불러오기' })).toBeEnabled();
  await expect(review.getByRole('button', { name: '복원 후 수정' })).toHaveCount(0);
  await review.getByRole('button', { name: '성적표 다시 불러오기' }).click();
  await expect.poll(() => state.reads.filter(read => read.kind === 'scores' && read.scope === null).length).toBeGreaterThanOrEqual(2);
  await review.getByRole('button', { name: '나중에 확인' }).click();
  await expect(review).toBeHidden();
  await expect(page.getByRole('checkbox', { name: '김수연 선택', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '보존된 임시저장 확인' }).click();
  await expect(review.getByRole('button', { name: '성적표 다시 불러오기' })).toBeVisible();
  expect(writes).toEqual([]);
});

for (const width of [390, 1366]) test(`수업일 전환 저장 대기 중 다른 탭으로 이동하면 되돌아가지 않는다 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = fixture(true); await install(page, state);
  let releaseSave!: () => void;
  const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
  let releases = 0;
  let completed = 0;
  await page.route('**/api/v1/results/admin/sessions/9902/score-draft/commit/', async route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON().release_lease).toBe(true);
    releases += 1;
    await saveGate;
    await route.fulfill({ status: 204, body: '' });
    completed += 1;
  });
  try {
    await page.goto(`${BASE}${path}/scores?schedule=71`, { waitUntil: 'domcontentloaded' });
    const edit = page.getByRole('group', { name: '성적 편집과 출력', exact: true }).getByRole('button', { name: '수정', exact: true });
    await expect(edit).toBeEnabled();
    await edit.click();
    await expect(page.getByRole('button', { name: '점수 입력 마침', exact: true })).toBeVisible();
    await page.getByRole('region', { name: '수업일 선택' }).getByRole('button', { name: /^목요일반/ }).click();
    await expect.poll(() => releases).toBe(1);
    await expect(page.getByRole('region', { name: '수업일 선택' })).toHaveAttribute('aria-busy', 'true');
    await expect(page).toHaveURL(/scores\?schedule=71$/);
    await page.getByRole('tab', { name: '출결', exact: true }).click();
    await expect(page).toHaveURL(/attendance\?schedule=71$/);
    await expect(page.getByRole('link', { name: '김수연 학생 상세 열기', exact: true })).toBeVisible();
    releaseSave();
    await expect.poll(() => completed).toBeGreaterThanOrEqual(1);
    await expect(page.getByRole('region', { name: '수업일 선택' })).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('group', { name: '김수연 출결 상태 선택', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/attendance\?schedule=71$/);
    await page.reload();
    await expect(page).toHaveURL(/attendance\?schedule=71$/);
    await expect(page.getByRole('link', { name: '김수연 학생 상세 열기', exact: true })).toBeVisible();
    expect(state.reads.some(r => r.kind === 'scores' && r.scope === '72')).toBe(false);
    await capture(page, `schedule-pending-save-navigation-${width}`);
  } finally {
    releaseSave();
  }
});

test('다른 차시의 수업일 관리는 현재 성적 편집을 저장한 뒤 연다', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await install(page, fixture(true));
  let releaseSave!: () => void;
  const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
  let releases = 0;
  await page.route('**/api/v1/results/admin/sessions/9902/score-draft/commit/', async route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON().release_lease).toBe(true);
    releases += 1;
    if (releases === 1) {
      await route.fulfill({ status: 500, json: { detail: '입력 잠금 해제 실패' } });
      return;
    }
    await saveGate;
    await route.fulfill({ status: 204, body: '' });
  });
  try {
    await page.goto(`${BASE}${path}/scores?schedule=71`, { waitUntil: 'domcontentloaded' });
    const scoreControls = page.getByRole('group', { name: '성적 편집과 출력', exact: true });
    await scoreControls.getByRole('button', { name: '수정', exact: true }).click();
    await expect(scoreControls.getByRole('button', { name: '점수 입력 마침', exact: true })).toBeVisible();
    const previousCard = page.getByRole('region', { name: '1차시 차시 카드', exact: true });
    const openPreviousSchedules = async () => {
      await previousCard.getByRole('button', { name: '차시 설정', exact: true }).press('Enter');
      await page.getByRole('menu', { name: '차시 설정 메뉴' }).getByRole('button', { name: '수정', exact: true }).click();
      await page.getByRole('dialog', { name: '차시 설정 편집' }).getByRole('button', { name: '수업일 관리', exact: true }).click();
    };
    const modal = page.getByRole('dialog', { name: '수업일 관리', exact: true });
    const strip = page.getByRole('region', { name: '수업일 선택', exact: true });
    await openPreviousSchedules();
    await expect.poll(() => releases).toBe(1);
    await expect(strip).toHaveAttribute('aria-busy', 'false');
    await expect(page).toHaveURL(/sessions\/9902\/scores\?schedule=71$/);
    await expect(modal).toBeHidden();
    await openPreviousSchedules();
    await expect.poll(() => releases).toBe(2);
    await expect(page).toHaveURL(/sessions\/9902\/scores\?schedule=71$/);
    await expect(modal).toBeHidden();
    releaseSave();
    await expect(page).toHaveURL(/sessions\/9900\/scores$/);
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', { name: '수업일 추가', exact: true })).toBeEnabled();
  } finally {
    releaseSave();
  }
});

for (const width of [390, 1366]) test(`저장 실패·닫기 후 입력 보존·409 최신 내용 확인·복사 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = fixture(true); await install(page, state);
  await page.goto(`${BASE}${path}/attendance?schedule=71`);
  await page.getByRole('button', { name: '수업일 관리', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '수업일 관리' });
  const days = modal.getByRole('region', { name: '수업일 목록', exact: true });
  await days.getByRole('button', { name: /^수요일반/ }).click();
  const firstCard = modal.getByRole('region', { name: '수업일 1', exact: true });
  const timeDetails = firstCard.locator('details');
  const timeSummary = timeDetails.locator('summary').filter({ hasText: '시간 설정 (선택)' });
  await expect(timeSummary).toContainText('16:00 ~ 18:00');
  await expect(timeDetails).toHaveJSProperty('open', false);
  await timeSummary.focus();
  await expect(timeSummary).toBeFocused();
  await timeSummary.press('Enter');
  await expect(timeDetails).toHaveJSProperty('open', true);
  await expect(firstCard.getByRole('group', { name: '수업일 1 시간 (선택)', exact: true })).toBeVisible();
  for (const target of [modal, firstCard]) {
    const size = await target.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
    expect(size.scroll).toBeLessThanOrEqual(size.client);
  }
  await modal.getByLabel('수업일 1 이름', { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, `schedule-time-expanded-${width}`);
  await timeSummary.press('Space');
  await expect(timeDetails).toHaveJSProperty('open', false);
  await expect(timeSummary).toBeFocused();
  await modal.getByLabel('수업일 1 이름').fill('수요일 심화반');
  state.failSave = 400;
  await modal.getByRole('button', { name: '저장', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('입력 내용을 확인');
  await expect(modal.getByLabel('수업일 1 이름')).toHaveValue('수요일 심화반');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '수업일 관리', exact: true }).click();
  await expect(modal.getByLabel('수업일 1 이름')).toHaveValue('수요일 심화반');
  state.config = { ...state.config, version: 'other-edit', schedules: state.config.schedules.map(s => ({ ...s, label: `${s.label} 최신` })) };
  state.failSave = 409;
  await modal.getByRole('button', { name: '저장', exact: true }).click();
  await expect(modal.getByRole('alert')).toContainText('작성 내용은 보관 중');
  await modal.getByLabel('수업일 1 이름', { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, `schedule-conflict-${width}`);
  await expect(modal.getByLabel('수업일 1 이름')).toHaveValue('수요일 심화반');
  await modal.getByRole('button', { name: '최신 내용으로 다시 시작' }).click();
  await page.getByRole('button', { name: '최신 내용 불러오기', exact: true }).click();
  await expect(modal.getByLabel('수업일 1 이름')).toHaveValue('수요일반 최신');
  await modal.getByLabel('수업일 1 이름', { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, `schedule-recovered-${width}`);
  state.failSave = 0;
  await modal.getByLabel('수업일 1 이름').fill('수요일 심화반');
  await modal.getByRole('button', { name: '저장', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(state.puts.at(-1)?.version).toBe('other-edit');
  await page.getByRole('button', { name: '수업일 관리', exact: true }).click();
  await days.getByRole('button', { name: /^수요일 심화반/ }).click();
  await modal.getByRole('button', { name: '수업일 1 삭제', exact: true }).click();
  await days.getByRole('button', { name: /^목요일반 최신/ }).click();
  await modal.getByRole('button', { name: '수업일 1 삭제', exact: true }).click();
  await modal.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.locator('[data-confirm-dialog]')).toContainText('2026-11-04');
  await page.getByRole('button', { name: '원래 날짜로 돌아가기', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page).toHaveURL(/schedule=71/);
  await expect(page.getByRole('alert').filter({ hasText: '선택한 수업일을 찾을 수 없습니다' })).toBeVisible();
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기' })).toHaveCount(0);
  await page.getByRole('button', { name: '수업일 관리', exact: true }).click();
  await modal.locator('summary').filter({ hasText: '이전 차시에서 가져오기' }).click();
  await modal.getByRole('button', { name: '가져와 저장', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: '이전 차시의 수업일을 가져올까요?' });
  await expect(confirmation).toContainText('당일 옮긴 학생이 포함됩니다');
  await confirmation.getByRole('button', { name: '가져와 저장', exact: true }).click();
  await expect(modal.getByLabel('수업일 1 이름')).toHaveValue('수요일반');
  await expect(days.getByRole('button', { name: /^수요일반.*2명/ })).toBeVisible();
  await modal.getByRole('button', { name: '닫기', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /^수요일반.*2명/ })).toBeVisible();
});

test('조회 실패와 잘못된 범위가 전체 명단으로 대체되지 않는다', async ({ page }) => {
  const state = fixture(true); state.failRead = true; await install(page, state);
  await page.goto(`${BASE}${path}/attendance?schedule=71`);
  await expect(page.getByRole('alert').filter({ hasText: '수업일 정보를 불러오지 못했습니다' })).toBeVisible();
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기' })).toHaveCount(0);
  expect(state.reads.filter(r => r.kind === 'scores')).toHaveLength(0);
  state.failRead = false;
  await page.getByRole('button', { name: '수업일 다시 불러오기' }).click();
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기' })).toBeVisible();
  state.failScores = true;
  await page.getByRole('tab', { name: '성적', exact: true }).click();
  await expect.poll(() => state.reads.filter(r => r.kind === 'scores').length).toBeGreaterThan(0);
  await expect(page.getByRole('checkbox', { name: '이목현 선택' })).toHaveCount(0);
  expect(state.reads.filter(r => r.kind === 'scores').every(r => r.scope === '71')).toBe(true);
  await page.goto(`${BASE}${path}/attendance?schedule=999`);
  await expect(page.getByRole('alert').filter({ hasText: '선택한 수업일을 찾을 수 없습니다' })).toBeVisible();
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기' })).toHaveCount(0);
});

test('차시 목록을 불러오지 못해도 현재 차시의 수업일을 관리할 수 있다', async ({ page }) => {
  const state = fixture(true);
  state.failSessionList = true;
  await install(page, state);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}${path}/attendance`, { waitUntil: 'domcontentloaded' });
  const card = page.getByRole('region', { name: '2차시 차시 카드', exact: true });
  await card.getByRole('button', { name: /^목요일반/ }).click();
  await expect(page).toHaveURL(/schedule=72/);
  await card.getByRole('button', { name: '수업일 관리', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '수업일 관리', exact: true });
  await expect(modal.getByLabel('수업일 2 이름', { exact: true })).toHaveValue('목요일반');
});

test('수업일 선택 직후 관리 창을 열면 방금 고른 반을 표시한다', async ({ page }) => {
  const state = fixture(true);
  state.failSessionList = true;
  await install(page, state);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}${path}/attendance?schedule=71`, { waitUntil: 'domcontentloaded' });
  const card = page.getByRole('region', { name: '2차시 차시 카드', exact: true });
  await expect(card.getByRole('button', { name: /^수요일반/ })).toHaveAttribute('aria-pressed', 'true');
  // The URL changes before the visible card commits its new selection.
  await page.evaluate((url) => window.history.replaceState(window.history.state, '', url), `${path}/attendance?schedule=72`);
  await card.getByRole('button', { name: '수업일 관리', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '수업일 관리', exact: true });
  await expect(modal.getByLabel('수업일 2 이름', { exact: true })).toHaveValue('목요일반');
});

test('닫힌 초안도 SPA 이탈을 확인하고 취소하면 보존한다', async ({ page }) => {
  const state = fixture(); await install(page, state);
  await page.goto(`${BASE}${path}/attendance`);
  const scopes = page.getByRole('region', { name: '2차시 차시 카드', exact: true }).getByRole('region', { name: '수업일 선택', exact: true });
  await scopes.getByRole('button', { name: '수업일 추가', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '수업일 관리' });
  await expect(modal.getByLabel('수업일 1 이름', { exact: true })).toBeVisible();
  expect(state.puts).toHaveLength(0);
  await modal.getByLabel('수업일 1 이름').fill('보존할 수요일반');
  await modal.getByRole('button', { name: '닫기', exact: true }).click();
  const lectureLink = page.getByRole('navigation', { name: '상위 경로', exact: true }).getByRole('link', { name: '요일별 수업', exact: true });
  await expect(lectureLink).toHaveAttribute('href', '/workspace/lectures/9901');
  await Promise.all([
    page.waitForEvent('dialog').then(async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('작성 내용을 버리고');
      await dialog.dismiss();
    }),
    lectureLink.click(),
  ]);
  await expect(page).toHaveURL(new RegExp(`${path}/attendance$`));
  await page.getByRole('button', { name: '수업일 관리', exact: true }).click();
  await expect(modal.getByLabel('수업일 1 이름')).toHaveValue('보존할 수요일반');
  await modal.getByRole('button', { name: '닫기', exact: true }).click();
  await Promise.all([
    page.waitForEvent('dialog').then(async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('작성 내용을 버리고');
      await dialog.accept();
    }),
    lectureLink.click(),
  ]);
  await expect(page).toHaveURL(/\/workspace\/lectures\/9901$/);
  expect(state.puts).toHaveLength(0);
});

test('교사 목요일 Today → 실제 날짜와 수업일 출석·성적', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-11-05T09:00:00+09:00'));
  const state = fixture(true);
  state.config.schedules[1] = { ...state.config.schedules[1], start_time: '16:30', end_time: '18:10' };
  state.attendanceFilled = 1;
  await install(page, state);
  await page.goto(`${BASE}/workspace/mobile`);
  const nextClass = page.getByRole('button', { name: /16:30 시작.*요일별 수업 · 목요일반.*다음 수업/ });
  await expect(nextClass).toBeVisible();
  await nextClass.scrollIntoViewIfNeeded();
  await capture(page, 'teacher-thursday-summary-390');
  await nextClass.press('Enter');
  await expect(page).toHaveURL(/classes\/9901\/sessions\/9902\?schedule=72/);
  await expect(page.getByText('2026-11-05 · 목요일반', { exact: true })).toBeVisible();
  await page.goto(`${BASE}/workspace/mobile`);
  await page.getByRole('button', { name: /수업 열기/ }).click();
  await expect(page).toHaveURL(/classes\/9901\/sessions\/9902\?schedule=72/);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}/workspace/mobile`);
  await expect(nextClass).toBeVisible();
  await capture(page, 'teacher-thursday-summary-1366');
  await nextClass.press('Space');
  await expect(page).toHaveURL(/classes\/9901\/sessions\/9902\?schedule=72/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/workspace/mobile`);
  const attendance = page.getByRole('button', { name: '요일별 수업 출석 입력', exact: true });
  await expect(attendance).toBeVisible();
  await expect(page.getByText('목요일반 · 16:30 – 18:10', { exact: true })).toBeVisible();
  await expect(page.getByText('수요일반', { exact: true })).toHaveCount(0);
  await attendance.click();
  await expect(page).toHaveURL(/attendance\/9902\?schedule=72/);
  await expect.poll(() => state.reads.some(r => r.kind === 'attendance' && r.scope === '72')).toBe(true);
  await expect(page.getByText('이목현', { exact: true })).toBeVisible();
  await expect(page.getByText('김수연', { exact: true })).toHaveCount(0);
  await page.goto(`${BASE}/workspace/mobile/classes/9901/sessions/9902?schedule=72`);
  await expect(page.getByText('2026-11-05 · 목요일반', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '성적 입력', exact: true }).click();
  await expect(page).toHaveURL(/scores\/9902\?schedule=72/);
  await expect.poll(() => state.reads.some(r => r.kind === 'scores' && r.scope === '72')).toBe(true);
  await expect(page.getByText('이목현', { exact: true })).toBeVisible();
  await expect(page.getByText('김수연', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: test.info().outputPath('teacher-thursday-scope.png'), fullPage: true });
});

test('교사 같은 날짜의 오전·오후는 반 선택 후 진입하고 stale Today는 재조회한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-11-05T09:00:00+09:00'));
  const state = fixture(true);
  state.config.schedules[0] = { ...state.config.schedules[0], label: '오전반', date: '2026-11-05', start_time: '09:00', end_time: '10:00' };
  state.config.schedules[1] = { ...state.config.schedules[1], label: '오후반', start_time: '16:00', end_time: '18:00' };
  await install(page, state);
  await page.goto(`${BASE}/workspace/mobile`);
  await page.getByRole('button', { name: /09:00 시작.*요일별 수업 · 오전반.*다음 수업/ }).click();
  await expect(page).toHaveURL(/classes\/9901\/sessions\/9902\?schedule=71/);
  await expect(page.getByText('2026-11-05 · 오전반', { exact: true })).toBeVisible();
  await page.goto(`${BASE}/workspace/mobile`);
  const score = page.getByRole('button', { name: '요일별 수업 성적 입력', exact: true });
  await expect(score).toBeDisabled();
  await page.getByRole('group', { name: '오늘 수업일 선택' }).getByRole('button', { name: '오후반 · 16:00', exact: true }).click();
  await expect(page.getByText('오후반 · 16:00 – 18:00', { exact: true })).toBeVisible();
  await expect(page.getByText('오전반 · 오후반 · 16:00 – 18:00', { exact: true })).toHaveCount(0);
  await expect(score).toBeEnabled();
  await capture(page, 'teacher-same-day-choice-390');
  await score.click();
  await expect(page).toHaveURL(/scores\/9902\?schedule=72/);
  await expect(page.getByText('2026-11-05 · 오후반 · 공통 시험의 배정 학생 성적', { exact: true })).toBeVisible();
  await expect(page.getByText('이목현', { exact: true })).toBeVisible();
  await expect(page.getByText('김수연', { exact: true })).toHaveCount(0);
  state.config.schedules = state.config.schedules.map(s => ({ ...s, date: '2026-11-04' }));
  await page.goto(`${BASE}/workspace/mobile`);
  await expect(page.getByText('오늘 수업일을 확인하지 못했습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /시작.*다음 수업/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '요일별 수업 출석 입력', exact: true })).toBeDisabled();
  await expect(score).toBeDisabled();
  state.config.schedules[1].date = '2026-11-05';
  await page.getByRole('button', { name: '수업일 다시 불러오기', exact: true }).click();
  await expect(score).toBeEnabled();
  await score.click();
  await expect(page).toHaveURL(/scores\/9902\?schedule=72/);
});

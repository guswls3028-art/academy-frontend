import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/strictTest';
import { installTenantOneInitScript } from '../helpers/localAuthApiStubs';
import type { SessionScheduleDraft, SessionSchedules } from '../../src/shared/api/contracts/sessionSchedules';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:5174';
const path = '/workspace/lectures/9901/sessions/9902';
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), 'Local synthetic API only');
test.use({ serviceWorkers: 'block' });
const roster = [
  { enrollment_id: 31, student_name: '김수연' },
  { enrollment_id: 32, student_name: '이목현' },
  { enrollment_id: 33, student_name: '박새봄' },
];
async function capture(page: Page, name: string) {
  await test.info().attach(name, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
}
function fixture(configured = false) {
  const state = {
    config: { version: 'v1', schedules: configured ? [
      { id: 71, label: '수요일반', date: '2026-11-04', start_time: '16:00', end_time: '18:00', enrollment_ids: [31] },
      { id: 72, label: '목요일반', date: '2026-11-05', start_time: null, end_time: null, enrollment_ids: [32] },
    ] : [], roster, unassigned_enrollment_ids: configured ? [33] : [31, 32, 33] } as SessionSchedules,
    puts: [] as { version: string; schedules: SessionScheduleDraft[] }[],
    copies: [] as { version: string; source_session: number }[],
    bulk: [] as { session: number; schedule?: string }[],
    presentEnrollmentIds: new Set<number>(),
    reads: [] as { kind: string; scope: string | null }[],
    failSave: 0, failRead: false, failScores: false, failAttendance: false, attendanceFilled: 0,
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
    if (endpoint === '/core/program/') return json({ tenantCode: 'hakwonplus', isPlatformAdmin: true, display_name: '학원플러스', feature_flags: {}, is_active: true });
    if (endpoint === '/core/me/') return json({ id: 12, username: 'admin', name: '관리자', is_staff: true, is_superuser: true, tenantRole: 'admin', must_change_password: false });
    if (endpoint === '/results/admin/teacher-dashboard-counts/') return json({ qna_pending: 0, counsel_pending: 0, submission_pending: 0, video_failed: 0 });
    if (endpoint === '/lectures/attendance/arrival-overview/') return json({ generated_at: '2026-11-05T00:00:00Z', today: '2026-11-05', tomorrow: '2026-11-06', range_end: '2026-11-11', range_days: 7, soon_window_minutes: 60, summary: { soon: 0, today: 0, tomorrow: 0, upcoming: 0, time_unset: 0, overdue: 0 }, items: [] });
    if (endpoint === '/lectures/lectures/9901/') return json({ id: 9901, title: '요일별 수업', color: '#2563eb', chip_label: '수업' });
    const current = { id: 9902, lecture: 9901, lecture_title: '요일별 수업', title: '2차시', order: 2, regular_order: 2, session_type: 'REGULAR', date: '2026-11-04', schedule_dates: state.config.schedules, attendance_filled: state.attendanceFilled, attendance_total: 1 };
    if (endpoint === '/lectures/sessions/9902/') return json(current);
    if (endpoint === '/lectures/sessions/') return json({ count: url.searchParams.has('date') ? 1 : 2, results: url.searchParams.has('date') ? [current] : [{ ...current, id: 9900, title: '1차시', order: 1, date: '2026-10-28' }, current] });
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
      return json({ meta: { session_title: '2차시', lecture_title: '요일별 수업', lecture_id: 9901, exams: [{ exam_id: 81, title: '공통 시험', max_score: 100, pass_score: 60, objective_max_score: 100, subjective_max_score: 0 }], homeworks: [] }, rows: students.map(s => ({ ...s, student_id: s.enrollment_id + 200, exams: [{ exam_id: 81, title: '공통 시험', block: { score: 80, max_score: 100, passed: true, objective_score: 80, subjective_score: 0, is_locked: false, meta: {} } }], homeworks: [], updated_at: '2026-11-04T00:00:00Z' })) });
    }
    if (endpoint.endsWith('/score-draft/')) return json({ changes: [] });
    return json({ count: 0, next: null, results: [] });
  });
}

for (const width of [390, 1366]) test(`수업일 작성·배정·저장·reload·출결/성적 범위 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = fixture(); await install(page, state);
  await page.goto(`${BASE}${path}/attendance`);
  const strip = page.getByRole('region', { name: '수업일 선택' });
  await expect(strip.getByRole('button')).toHaveCount(1);
  await strip.getByRole('button', { name: '수업일 관리' }).click();
  const modal = page.getByRole('dialog', { name: '수업일 관리' });
  await modal.getByRole('button', { name: '수업일 추가' }).click();
  await modal.getByLabel('수업일 1 이름').fill('수요일반');
  await modal.getByLabel('학생 검색').fill('김');
  await modal.getByRole('button', { name: '검색 결과 전체 선택' }).click();
  await modal.getByRole('button', { name: '선택 학생 배정' }).click();
  await modal.getByRole('button', { name: '수업일 추가' }).click();
  await modal.getByLabel('수업일 2 이름').fill('목요일반');
  await modal.getByRole('region', { name: '수업일 2', exact: true }).getByLabel('날짜').click();
  await page.getByRole('dialog', { name: '날짜 선택', exact: true }).getByRole('button', { name: '5', exact: true }).click();
  await modal.getByLabel('학생 검색').fill('이');
  await modal.getByRole('button', { name: '검색 결과 전체 선택' }).click();
  await modal.getByRole('button', { name: '선택 학생 배정' }).click();
  await modal.getByLabel('수업일 1 이름', { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, `schedule-manager-${width}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await modal.getByRole('button', { name: '저장', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(state.puts[0].schedules.map(s => [s.label, s.date, s.enrollment_ids])).toEqual([['수요일반', '2026-11-04', [31]], ['목요일반', '2026-11-05', [32]]]);
  await page.reload();
  await expect(page.getByText('기본 수업일: 2026-11-04', { exact: true })).toBeVisible();
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
  await expect(page.getByRole('button', { name: '박새봄 출결 상태 변경', exact: true })).toHaveText('미입력');
  await page.getByRole('button', { name: '출결 도구', exact: true }).click();
  await expect(page).toHaveURL(/attendance\?schedule=0&view=tools$/);
  const tools = page.getByRole('region', { name: '출결 도구', exact: true });
  await expect(tools.getByRole('heading', { name: '출결 도구', exact: true })).toBeVisible();
  const scopedTools = tools.getByRole('region', { name: '수업일 명단 도구', exact: true });
  await expect(scopedTools.getByText('선택한 수업일의 출결을 일괄 변경합니다. 엑셀은 강의 전체의 출결 기록입니다.', { exact: true })).toBeVisible();
  const readsBeforeSave = state.reads.filter(r => r.kind === 'attendance' && r.scope === '0').length;
  await scopedTools.getByRole('button', { name: '수업일 현장 출석', exact: true }).click();
  await expect(page.getByText('선택한 수업일을 현장 출석으로 바꿀까요?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '전체 현장 적용', exact: true }).click();
  await expect.poll(() => state.bulk).toEqual([{ session: 9902, schedule: '0' }]);
  await expect(page).toHaveURL(/attendance\?schedule=0$/);
  await expect.poll(() => state.reads.filter(r => r.kind === 'attendance' && r.scope === '0').length).toBeGreaterThan(readsBeforeSave);
  await expect(page.getByRole('button', { name: '박새봄 출결 상태 변경', exact: true })).toHaveText('현장');
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/attendance\?schedule=0$/);
  await expect(page.getByRole('button', { name: '박새봄 출결 상태 변경', exact: true })).toHaveText('현장');
  await page.getByRole('button', { name: '출결 도구', exact: true }).click();
  await page.getByRole('link', { name: '← 출결 명단', exact: true }).click();
  await expect(page).toHaveURL(/attendance\?schedule=0$/);
  await strip.getByRole('button', { name: /^수요일반/ }).click();
  await expect(page).toHaveURL(/attendance\?schedule=71$/);
  await expect(tools).toBeHidden();
  await expect(page.getByRole('button', { name: '김수연 출결 상태 변경', exact: true })).toHaveText('미입력');
  await expect(page.getByRole('link', { name: '박새봄 학생 상세 열기', exact: true })).toHaveCount(0);
  await expect.poll(() => state.reads.some(r => r.kind === 'scores' && r.scope === '0')).toBe(true);

  // This same-turn handler boundary check is NOT trusted pointer evidence.
  // Keep the ordinary pointer sequence above and async navigation below.
  // The visible controls call their real handlers without DOM/URL injection.
  await page.getByRole('button', { name: '출결 도구', exact: true }).click();
  const backToList = page.getByRole('link', { name: '← 출결 명단', exact: true });
  const thursday = strip.getByRole('button', { name: /^목요일반/ });
  await expect(backToList).toBeVisible();
  await thursday.scrollIntoViewIfNeeded();
  await expect(thursday).toBeInViewport();
  await expect(backToList).toBeInViewport();
  await expect(thursday).toBeEnabled();
  const thursdayHandle = await thursday.elementHandle();
  await backToList.evaluate((link, button) => {
    if (!(link instanceof HTMLAnchorElement) || !(button instanceof HTMLButtonElement)) throw new Error('Missing navigation controls');
    link.click();
    button.click();
  }, thursdayHandle);
  await thursdayHandle?.dispose();
  await expect(page).toHaveURL(/attendance\?schedule=72$/);
  await expect(tools).toBeHidden();
  await expect(page.getByRole('link', { name: '이목현 학생 상세 열기', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/attendance\?schedule=72$/);
  await expect(page.getByRole('link', { name: '이목현 학생 상세 열기', exact: true })).toBeVisible();
  await capture(page, `schedule-rapid-list-navigation-${width}`);
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
    await page.goto(`${BASE}${path}/scores?schedule=71`);
    await page.getByRole('button', { name: '수정', exact: true }).click();
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
    await expect(page.getByRole('button', { name: '김수연 출결 상태 변경', exact: true })).toBeVisible();
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

for (const width of [390, 1366]) test(`저장 실패·닫기 후 입력 보존·409 최신 내용 확인·복사 ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = fixture(true); await install(page, state);
  await page.goto(`${BASE}${path}/attendance?schedule=71`);
  await page.getByRole('button', { name: '수업일 관리', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '수업일 관리' });
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
  await expect(modal.getByRole('button', { name: '이전 차시에서 가져오기' })).toBeDisabled();
  await modal.getByRole('button', { name: '수업일 1 삭제', exact: true }).click();
  await modal.getByRole('button', { name: '수업일 1 삭제', exact: true }).click();
  await modal.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.locator('[data-confirm-dialog]')).toContainText('2026-11-04');
  await page.getByRole('button', { name: '원래 날짜로 돌아가기', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page).toHaveURL(/schedule=71/);
  await expect(page.getByRole('alert').filter({ hasText: '선택한 수업일을 찾을 수 없습니다' })).toBeVisible();
  await expect(page.getByRole('link', { name: '김수연 학생 상세 열기' })).toHaveCount(0);
  await page.getByRole('button', { name: '수업일 관리', exact: true }).click();
  await modal.getByRole('button', { name: '이전 차시에서 가져오기' }).click();
  await page.getByRole('button', { name: '가져와 저장', exact: true }).click();
  await expect(modal.getByLabel('수업일 1 이름')).toHaveValue('수요일반');
  await expect(modal.getByText('2명 배정', { exact: true })).toBeVisible();
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

test('닫힌 초안도 SPA 이탈을 확인하고 취소하면 보존한다', async ({ page }) => {
  const state = fixture(); await install(page, state);
  await page.goto(`${BASE}${path}/attendance`);
  await page.getByRole('button', { name: '수업일 관리', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '수업일 관리' });
  await modal.getByRole('button', { name: '수업일 추가' }).click();
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

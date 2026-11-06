import type { APIRequestContext, Locator, Page, TestInfo } from '@playwright/test';
import type { SessionSchedules } from '../../src/shared/api/contracts/sessionSchedules';
import { expect } from '../fixtures/strictTest';
import { acknowledgeInitialAccountPromptsIfVisible } from './firstLoginGuide';
import { assertQaStudentParentRuntime, assertNoHorizontalOverflow, expectApi, installQaStudentParentBoundary, QA_BASE, seedBrowserAuth, type QaFamily, type QaTokens } from './qaStudentParentScenario';
import { attachStrictBrowserGuards } from './strictBrowser';
import { gotoAndSettle } from './wait';

async function assign(modal: Locator, name: string) {
  await modal.getByLabel('학생 검색').fill(name);
  await modal.getByRole('button', { name: '검색 결과 전체 선택', exact: true }).click();
  await expect(modal.getByText('1명 선택', { exact: true })).toBeVisible();
  await modal.getByRole('button', { name: '선택 학생 배정', exact: true }).click();
}

/** Existing assessment canary step only: no added test or production execution path. */
export async function verifySessionSchedules(
  parentPage: Page, request: APIRequestContext, admin: QaTokens, student: QaTokens,
  family: QaFamily, scope: { lectureId: number; sessionId: number; enrollmentIds: number[] }, testInfo: TestInfo,
) {
  assertQaStudentParentRuntime();
  expect(family.students.length).toBeGreaterThanOrEqual(2);
  const endpoint = `/lectures/sessions/${scope.sessionId}/schedules/`;
  const initial = await expectApi<SessionSchedules>(request, 'GET', endpoint, admin.access);
  expect(initial.schedules, 'Only the newly created, unconfigured synthetic session is owned here').toEqual([]);
  const base = await expectApi<{ date: string }>(request, 'GET', `/lectures/sessions/${scope.sessionId}/`, admin.access);
  const month = base.date.slice(0, 7);
  const first = new Date(`${month}-01T12:00:00Z`);
  const wedDay = 1 + ((3 - first.getUTCDay() + 7) % 7);
  const wedDate = `${month}-${String(wedDay).padStart(2, '0')}`;
  const thuDate = `${month}-${String(wedDay + 1).padStart(2, '0')}`;
  const [primary, peer] = family.students;
  const primaryId = initial.roster.find(s => s.student_name === primary.name)?.enrollment_id;
  const peerId = initial.roster.find(s => s.student_name === peer.name)?.enrollment_id;
  expect(scope.enrollmentIds).toContain(primaryId);
  expect(scope.enrollmentIds).toContain(peerId);
  expect(primaryId).not.toBe(peerId);
  const attendancePath = `/lectures/attendance/?session=${scope.sessionId}&page_size=500`;
  type AttendanceSnapshot = { results: { id: number; enrollment_id: number; status: string }[] };
  const attendanceBefore = await expectApi<AttendanceSnapshot>(request, 'GET', attendancePath, admin.access);
  const scoresPath = `/results/admin/sessions/${scope.sessionId}/scores/`;
  const scoresBefore = await expectApi<{ rows: unknown[] }>(request, 'GET', scoresPath, admin.access);
  const browser = parentPage.context().browser()!;
  const adminContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await adminContext.newPage();
  const studentPage = await studentContext.newPage();
  const boundary = await installQaStudentParentBoundary(page, request);
  const studentBoundary = await installQaStudentParentBoundary(studentPage, request);
  const guards = attachStrictBrowserGuards(page);
  const studentGuards = attachStrictBrowserGuards(studentPage);
  const route = `${QA_BASE}/workspace/lectures/${scope.lectureId}/sessions/${scope.sessionId}`;
  try {
    await seedBrowserAuth(page, admin);
    await seedBrowserAuth(studentPage, student);
    await gotoAndSettle(page, `${route}/attendance`);
    await acknowledgeInitialAccountPromptsIfVisible(page);
    await page.getByRole('button', { name: '수업일 관리', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '수업일 관리', exact: true });
    for (const [index, label, day, studentName] of [[1, '수요일반', wedDay, primary.name], [2, '목요일반', wedDay + 1, peer.name]] as const) {
      await modal.getByRole('button', { name: '수업일 추가', exact: true }).click();
      await modal.getByLabel(`수업일 ${index} 이름`, { exact: true }).fill(label);
      await modal.getByRole('region', { name: `수업일 ${index}`, exact: true }).getByLabel('날짜', { exact: true }).click();
      await page.getByRole('dialog', { name: '날짜 선택', exact: true }).getByRole('button', { name: String(day), exact: true }).click();
      await assign(modal, studentName);
    }
    await modal.getByLabel('수업일 1 이름', { exact: true }).scrollIntoViewIfNeeded();
    await testInfo.attach('session-schedules-admin-populated-1366.png', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png',
    });
    const saveResponse = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/v1${endpoint}`);
    await modal.getByRole('button', { name: '저장', exact: true }).click();
    expect((await saveResponse).status()).toBe(200);
    await expect(modal).toBeHidden();
    const saved = await expectApi<SessionSchedules>(request, 'GET', endpoint, admin.access);
    const wed = saved.schedules.find(s => s.label === '수요일반')!;
    const thu = saved.schedules.find(s => s.label === '목요일반')!;
    expect(wed).toMatchObject({ date: wedDate, enrollment_ids: [primaryId] });
    expect(thu).toMatchObject({ date: thuDate, enrollment_ids: [peerId] });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const strip = page.getByRole('region', { name: '수업일 선택' });
    await strip.getByRole('button', { name: /^수요일반/ }).click();
    await expect(page.getByText(`${wedDate} · 수요일반`, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: `${primary.name} 학생 상세 열기`, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: `${peer.name} 학생 상세 열기`, exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: '성적', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`scores\\?schedule=${wed.id}$`));
    await expect(page.getByRole('checkbox', { name: `${primary.name} 선택`, exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: `${peer.name} 선택`, exact: true })).toHaveCount(0);
    await strip.getByRole('button', { name: /^목요일반/ }).click();
    await expect(page.getByRole('checkbox', { name: `${peer.name} 선택`, exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: `${primary.name} 선택`, exact: true })).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`scores\\?schedule=${thu.id}$`));
    await expect(page.getByText(`${thuDate} · 목요일반`, { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: `${peer.name} 선택`, exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: `${primary.name} 선택`, exact: true })).toHaveCount(0);
    await expect(page.locator('.scores-entry-page').getByText('성적 불러오는 중…', { exact: true })).toBeHidden();
    await page.getByRole('checkbox', { name: `${peer.name} 선택`, exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('checkbox', { name: `${peer.name} 선택`, exact: true })).toBeInViewport();
    await testInfo.attach('session-schedules-admin-scores-reloaded-1366.png', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png',
    });
    await gotoAndSettle(studentPage, `${QA_BASE}/student/sessions/${scope.sessionId}`);
    await acknowledgeInitialAccountPromptsIfVisible(studentPage);
    await expect(studentPage.getByText(/수요일반 · 날짜:/)).toBeVisible();
    const projection = await expectApi<{ date: string | null; schedule_label: string | null; schedule_configured: boolean }>(request, 'GET', `/student/sessions/${scope.sessionId}/`, student.access);
    expect(projection).toMatchObject({ date: wedDate, schedule_label: '수요일반', schedule_configured: true });
    await studentPage.reload({ waitUntil: 'domcontentloaded' });
    await expect(studentPage.getByText(/수요일반 · 날짜:/)).toBeVisible();
    await assertNoHorizontalOverflow(studentPage);
    await testInfo.attach('session-schedules-student-assigned-reloaded-390.png', {
      body: await studentPage.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png',
    });

    // Another authorized editor mutates this same synthetic configuration; the UI must retain its draft on 409.
    await page.getByRole('button', { name: '수업일 관리', exact: true }).click();
    await modal.getByLabel('수업일 1 이름', { exact: true }).fill('수요일 작성 중');
    const concurrent = await expectApi<SessionSchedules>(request, 'PUT', endpoint, admin.access, {
      version: saved.version, schedules: saved.schedules.map(s => ({ ...s, label: `${s.label} 최신` })),
    });
    const staleResponse = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/v1${endpoint}`);
    await modal.getByRole('button', { name: '저장', exact: true }).click();
    expect((await staleResponse).status()).toBe(409);
    await expect(modal.getByRole('alert')).toContainText('작성 내용은 보관 중');
    await expect(modal.getByLabel('수업일 1 이름', { exact: true })).toHaveValue('수요일 작성 중');
    expect((await expectApi<SessionSchedules>(request, 'GET', endpoint, admin.access)).version).toBe(concurrent.version);
    await modal.getByLabel('수업일 1 이름', { exact: true }).scrollIntoViewIfNeeded();
    await testInfo.attach('session-schedules-admin-conflict-409-1366.png', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png',
    });
    await modal.getByRole('button', { name: '최신 내용으로 다시 시작', exact: true }).click();
    await page.getByRole('button', { name: '최신 내용 불러오기', exact: true }).click();
    await expect(modal.getByLabel('수업일 1 이름', { exact: true })).toHaveValue('수요일반 최신');
    await modal.getByRole('button', { name: '수업일 1 삭제', exact: true }).click();
    await modal.getByRole('button', { name: '수업일 1 삭제', exact: true }).click();
    await modal.getByRole('button', { name: '저장', exact: true }).click();
    const removal = page.locator('[data-confirm-dialog]');
    await expect(removal).toContainText(base.date);
    await expect(removal).toContainText('기록은 그대로 유지');
    await removal.getByRole('button', { name: '원래 날짜로 돌아가기', exact: true }).click();
    await expect(modal).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`schedule=${thu.id}$`));
    await expect(page.getByRole('alert').filter({ hasText: '선택한 수업일을 찾을 수 없습니다' })).toBeVisible();
    expect((await expectApi<SessionSchedules>(request, 'GET', endpoint, admin.access)).schedules).toEqual([]);
    const restoredStudent = await expectApi<{ date: string; schedule_configured: boolean }>(request, 'GET', `/student/sessions/${scope.sessionId}/`, student.access);
    expect(restoredStudent).toMatchObject({ date: base.date, schedule_configured: false });
    await studentPage.reload({ waitUntil: 'domcontentloaded' });
    await expect(studentPage.getByText(/수요일반 · 날짜:/)).toHaveCount(0);
    const snapshot = (value: AttendanceSnapshot) => value.results.map(r => ({ id: r.id, enrollment_id: r.enrollment_id, status: r.status })).sort((a, b) => a.id - b.id);
    expect(snapshot(await expectApi<AttendanceSnapshot>(request, 'GET', attendancePath, admin.access))).toEqual(snapshot(attendanceBefore));
    expect((await expectApi<{ rows: unknown[] }>(request, 'GET', scoresPath, admin.access)).rows).toEqual(scoresBefore.rows);
    await testInfo.attach('session-schedules-real-api', { body: JSON.stringify({ sessionId: scope.sessionId, wedDate, thuDate, restoredOriginalDate: base.date, attendanceRecordsPreserved: true, scoreRowsPreserved: true }), contentType: 'application/json' });
    boundary.assertClean(); studentBoundary.assertClean(); guards.assertZeroDefects(); studentGuards.assertZeroDefects();
  } finally {
    // Restore even on assertion failure, using a fresh concurrency token; outer fixture owns session/family cleanup.
    try {
      const latest = await expectApi<SessionSchedules>(request, 'GET', endpoint, admin.access);
      if (latest.schedules.length) await expectApi(request, 'PUT', endpoint, admin.access, { version: latest.version, schedules: [] });
      expect((await expectApi<SessionSchedules>(request, 'GET', endpoint, admin.access)).schedules).toEqual([]);
    } finally { await adminContext.close(); await studentContext.close(); }
  }
}

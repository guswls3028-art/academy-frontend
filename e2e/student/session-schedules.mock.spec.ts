import { expect, test } from '../fixtures/strictTest';
import { installTenantOneInitScript } from '../helpers/localAuthApiStubs';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:5174';
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), 'Local synthetic API only');
test.use({ serviceWorkers: 'block' });

for (const role of ['student', 'parent']) for (const width of [390, 1366]) {
  test(`개인 배정 날짜·미배정·일반 차시 보존 ${role} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-11-05T09:00:00+09:00'));
    await installTenantOneInitScript(page);
    const payload = Buffer.from(JSON.stringify({ exp: 2_000_000_000, user_id: 11, tenant_code: 'hakwonplus' })).toString('base64url');
    await page.addInitScript(jwt => { localStorage.setItem('access', jwt); localStorage.setItem('refresh', `${jwt}-refresh`); }, `e30.${payload}.sig`);
    const sessions = [
      { id: 201, title: '배정 대기 수업', date: null, schedule_configured: true, schedule_label: null, type: 'session' },
      { id: 202, title: '요일별 수업', date: '2026-11-05', schedule_configured: true, schedule_label: '목요일반', start_time: '16:00', end_time: '18:00', type: 'session' },
      { id: 203, title: '일반 수업', date: '2026-11-05', type: 'session' },
    ];
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
      const json = (body: unknown) => route.fulfill({ json: body });
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
      if (path === '/core/program/') return json({ tenantCode: 'hakwonplus', display_name: '학원플러스', is_active: true, feature_flags: {} });
      if (path === '/core/me/') return json({ id: 11, name: '수업일 검증', username: 'schedule-reader', is_staff: false, tenantRole: role, linkedStudents: role === 'parent' ? [{ id: 11, name: '수업 학생' }] : [] });
      if (path === '/student/me/') return json({ id: 11, name: '수업 학생', username: 'schedule-student', is_student: true, isParentReadOnly: role === 'parent' });
      if (path === '/student/sessions/me/') return json(sessions);
      const detail = path.match(/^\/student\/sessions\/(\d+)\/$/);
      if (detail) return json({ ...sessions.find(s => s.id === Number(detail[1])), exam_ids: [] });
      return json({ results: [], count: 0, next: null, notices: [], today_sessions: [], badges: {} });
    });
    await page.goto(`${BASE}/student/sessions`);
    const unassigned = page.getByRole('region', { name: '수업일 미배정', exact: true });
    await expect(unassigned.locator('a[href="/student/sessions/201"]')).toContainText('수업일 미배정');
    await page.getByRole('button', { name: '5', exact: true, disabled: false }).click();
    await expect(page.locator('a[href="/student/sessions/202"]')).toContainText('목요일반');
    await expect(page.locator('a[href="/student/sessions/203"]')).toContainText('일반 수업');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: test.info().outputPath(`schedule-calendar-${role}-${width}.png`), fullPage: true });
    await unassigned.locator('a').click();
    await expect(page.getByText('수업일 미배정', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '영상으로 이동', exact: true })).toHaveAttribute('href', '/student/video/sessions/201');
    await page.reload();
    await expect(page.getByText('수업일 미배정', { exact: true })).toBeVisible();
    await page.goto(`${BASE}/student/sessions/202`);
    await expect(page.getByText(/목요일반 · 날짜:/)).toContainText('16:00 ~ 18:00');
    await page.goto(`${BASE}/student/sessions/203`);
    await expect(page.getByText('수업일 미배정', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^날짜:/)).toBeVisible();
  });
}

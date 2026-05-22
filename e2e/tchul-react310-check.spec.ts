import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test('tchul.com/landing/reports - React #310 fix confirm', async ({ browser }) => {
  // Fresh incognito context
  const context = await browser.newContext({
    storageState: undefined,
  });
  const page = await context.newPage();

  const reactErrors: string[] = [];
  const allErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      allErrors.push(text);
      if (
        text.includes('Minified React error') ||
        text.includes('#310') ||
        text.includes('rendered more hooks') ||
        text.includes('React error')
      ) {
        reactErrors.push(text);
      }
    }
  });

  page.on('pageerror', err => {
    allErrors.push('PAGE ERROR: ' + err.message);
    if (
      err.message.includes('Minified React error') ||
      err.message.includes('#310') ||
      err.message.includes('rendered more hooks')
    ) {
      reactErrors.push('PAGE ERROR: ' + err.message);
    }
  });

  // Track chunk URLs
  const chunkURLs: string[] = [];
  page.on('response', resp => {
    const url = resp.url();
    if (url.includes('LandingReportsListPage')) {
      chunkURLs.push(url);
    }
  });

  await page.goto('https://tchul.com/landing/reports', { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('body').waitFor({ state: 'visible', timeout: 10000 });

  const screenshotDir = 'e2e/screenshots/tchul-react310-confirm';
  fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, 'result.png'), fullPage: true });

  // Check for error overlay
  const errorMsgCount = await page.locator('text=일시적인 오류가 발생했습니다').count();
  const emptyStateCount = await page.locator('text=등록된 적중 보고서가 없습니다').count();

  // Log findings
  console.log('=== React #310 Fix Confirmation ===');
  console.log('React errors found:', reactErrors.length, reactErrors);
  console.log('All console errors:', allErrors.length, allErrors.slice(0, 10));
  console.log('"일시적인 오류" visible:', errorMsgCount);
  console.log('"등록된 적중 보고서가 없습니다" visible:', emptyStateCount);
  console.log('LandingReportsListPage chunk URLs:', chunkURLs);

  // Assertions
  expect(reactErrors, 'React errors must be absent').toHaveLength(0);
  expect(errorMsgCount, '"일시적인 오류" must NOT be visible').toBe(0);

  // Page must show either report cards or empty state — body must be rendered
  const bodyText = await page.locator('body').innerText();
  const hasContent = emptyStateCount > 0 || bodyText.length > 100;
  expect(hasContent, 'Page must have rendered content').toBe(true);

  await context.close();
});

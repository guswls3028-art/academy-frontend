import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";
import type { AgentSnapshot } from "../../src/app_dev/domains/agentSessions/api";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");
test.use({ serviceWorkers: "block" });
test.skip(!["localhost", "127.0.0.1"].includes(new URL(BASE).hostname), "Local metadata fixtures only");

function snapshot(): AgentSnapshot {
  const now = new Date().toISOString();
  return { schema: 1, collected_at: now, source_status: "connected", stale_after_seconds: 90, truncated: false, source_errors: [], nodes: [
    { id: "codex:root", provider: "codex", parent_id: null, title: "플랫폼 안정화", role: "총괄", status: "running", evidence: "last_turn", updated_at: now },
    { id: "codex:review", provider: "codex", parent_id: "codex:root", title: "코드 검수", role: "reviewer", status: "running", evidence: "last_turn", updated_at: now },
    { id: "claude:root", provider: "claude", parent_id: null, title: "화면 검토", role: "시각 검토", status: "waiting", evidence: "runtime", updated_at: now },
    { id: "claude:child", provider: "claude", parent_id: "claude:root", title: "모바일의 긴 한국어 문항과 담당 위계가 겹치지 않는지 확인하는 화면 검토", role: "디자인", status: "completed", evidence: "last_turn", updated_at: now },
    { id: "codex:orphan", provider: "codex", parent_id: "codex:missing", title: "과거 에이전트", role: "검토", status: "unknown", evidence: "unknown", updated_at: null },
  ] };
}

async function stub(page: Page, username = "admin97", tenantCode = "hakwonplus") {
  const jwt = `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: tenantCode })).toString("base64url")}.e2e`;
  await page.addInitScript(({ jwt, tenantCode }) => {
    localStorage.setItem("access", jwt); localStorage.setItem("refresh", "mock-session-board-refresh");
    localStorage.setItem("tenant_code", tenantCode); sessionStorage.setItem("tenantCode", tenantCode);
  }, { jwt, tenantCode });
  await page.route("**/api/v1/**", route => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/v1/core/program/**", route => route.fulfill({ json: { tenantCode, isPlatformAdmin: true, display_name: "학원플러스", ui_config: {}, feature_flags: {}, is_active: true } }));
  await page.route("**/api/v1/core/me/", route => route.fulfill({ json: { id: 97, username, name: "개발자", is_staff: true, is_superuser: true, tenantRole: "owner", must_change_password: false, first_login_guide_required: false } }));
  const control = { body: snapshot(), status: 200, methods: [] as string[] };
  await page.route("**/api/v1/core/dev/agent-sessions/", route => {
    control.methods.push(route.request().method());
    return route.fulfill({ status: control.status, json: control.status === 200 ? control.body : { detail: "temporary_failure" } });
  });
  return control;
}

for (const width of [1366, 390]) {
  test(`세션 조직도 조회·담당 관계·필터·재진입은 읽기 전용이다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    const control = await stub(page);
    await gotoAndSettle(page, `${BASE}/dev/agent-sessions`);
    await expect(page.getByRole("heading", { name: "AI 작업 상황판", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "세션 현황 요약" })).toContainText("세션2");
    await expect(page.getByRole("region", { name: "세션 현황 요약" })).toContainText("하위 에이전트 3");
    await expect(page.getByText("상위 기록 없음", { exact: false })).toBeVisible();
    await page.getByLabel("세션·담당 역할 검색").fill("코드 검수");
    await expect(page.getByRole("button", { name: /플랫폼 안정화.*Codex/ })).toBeVisible();
    await page.getByRole("button", { name: /코드 검수.*Codex/ }).click();
    const detail = page.getByRole("complementary", { name: "선택한 세션 상세" });
    await expect(detail).toContainText("reviewer");
    await expect(detail).toContainText("플랫폼 안정화");
    await page.getByLabel("세션·담당 역할 검색").fill("");
    await page.getByLabel("AI 제공자", { exact: true }).selectOption("claude");
    await expect(page.getByRole("button", { name: /^화면 검토.*Claude/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /플랫폼 안정화.*Codex/ })).toHaveCount(0);
    await page.getByLabel("AI 제공자", { exact: true }).selectOption("all");
    await page.getByLabel("세션·담당 역할 검색").fill("존재하지않는업무");
    await expect(page.getByRole("heading", { name: "일치하는 세션이 없습니다" })).toBeVisible();
    await page.getByRole("button", { name: "필터 초기화" }).click();
    await page.getByRole("button", { name: "모두 접기" }).click();
    await expect(page.getByRole("button", { name: /코드 검수.*Codex/ })).toHaveCount(0);
    await page.getByRole("button", { name: "플랫폼 안정화 하위 에이전트 펼치기" }).click();
    await expect(page.getByRole("button", { name: /코드 검수.*Codex/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: /코드 검수.*Codex/ })).toBeVisible();
    expect(control.methods.length).toBeGreaterThan(1);
    expect(control.methods.every(method => method === "GET")).toBe(true);
    await expect(page.getByRole("button", { name: /^(세션 실행|세션 중지|메시지 보내기)$/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`agent-board-${width}.png`), fullPage: true });
  });
}

test("오래된 자료·조회 실패를 0건으로 바꾸지 않고 새로고침으로 복구한다", async ({ page }) => {
  const control = await stub(page);
  control.body.collected_at = new Date(Date.now() - 180_000).toISOString();
  control.body.source_status = "stale";
  await gotoAndSettle(page, `${BASE}/dev/agent-sessions`);
  await expect(page.getByText("최신 현황 연결 끊김", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /플랫폼 안정화.*Codex/ })).toBeVisible();
  control.status = 503;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "마지막으로 수집한 기록" })).toBeVisible();
  control.status = 200; control.body = snapshot();
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(page.getByText("현황 연결됨", { exact: true })).toBeVisible();
  control.body.source_errors = ["claude"];
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Claude 기록 수집이 불완전합니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: /플랫폼 안정화.*Codex/ })).toBeVisible();
  control.body.nodes = [];
  control.body.source_errors = ["codex", "claude"];
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("heading", { name: "세션 기록을 확인할 수 없습니다" })).toBeVisible();
  await expect(page.getByRole("region", { name: "세션 현황 요약" })).toHaveCount(0);
  control.body.source_errors = [];
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("heading", { name: "표시할 세션이 없습니다" })).toBeVisible();
  control.body.source_status = "unavailable"; control.body.collected_at = null;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByRole("heading", { name: "개발 PC 연결을 기다리고 있습니다" })).toBeVisible();
});

for (const [username, tenant] of [["another-owner", "hakwonplus"], ["admin97", "tchul"]]) {
  test(`${tenant}/${username} 계정에는 메뉴와 스냅샷을 제공하지 않는다`, async ({ page }) => {
    const control = await stub(page, username, tenant);
    await gotoAndSettle(page, `${BASE}/dev/agent-sessions`);
    if (tenant === "hakwonplus") await expect(page.getByRole("heading", { name: "접근 권한이 없습니다" })).toBeVisible();
    else await expect(page).toHaveURL(/\/workspace\/dashboard/);
    await expect(page.getByRole("link", { name: /AI 작업 상황판/ })).toHaveCount(0);
    expect(control.methods).toHaveLength(0);
  });
}

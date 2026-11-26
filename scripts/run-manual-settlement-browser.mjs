/** Runs from the disposable Django billing browser fixture. Input is private stdin. */
import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect as browserExpect } from "@playwright/test";
import { preview } from "vite";
import { artifactFingerprint } from "./run-development-release-canary.mjs";

const fixture = JSON.parse(readFileSync(0, "utf8"));
const api = new URL(fixture.api);
assert.equal(api.protocol, "http:");
assert.equal(api.hostname, "127.0.0.1");
assert.ok(api.port && api.origin === fixture.api);
assert.equal(fixture.schools.length, 2);
assert.equal(fixture.operator.code, "9999");
const [, nonce] = /^qa-billing-operator-([0-9a-f]{10})$/.exec(fixture.operator.username) || [];
assert.ok(nonce);
assert.deepEqual(fixture.schools.map(s => [s.code, s.manual, s.username]),
  ["none", "tax"].map(suffix => [`qa-ymath-realuse-bank-${nonce}-${suffix}`, suffix === "tax", "ymath-qa-organization-owner"]));

const transfer = "/api/v1/billing/bank-transfer/";
const queue = "/api/v1/billing/admin/bank-transfer/notices/";
const loopback = { host: "127.0.0.1", port: 0, proxy: { "/api": { target: api.origin, changeOrigin: true } } };
assert.ok(process.env.BILLING_QA_DIST, "Provide the built frontend dist directory");
const dist = realpathSync(process.env.BILLING_QA_DIST);
const revision = JSON.parse(readFileSync(join(dist, "version.json"), "utf8")).version;
assert.match(process.env.BILLING_QA_REVISION || "", /^[a-f0-9]{40}$/);
assert.equal(revision, process.env.BILLING_QA_REVISION, "Unexpected frontend artifact");
const fingerprint = artifactFingerprint(dist);
const expect = browserExpect.configure({ timeout: 20000 });
const web = await preview({ configFile: false, envDir: false, build: { outDir: dist }, preview: loopback });
let browser;
let stage = "startup";

async function actor(person, viewport, origin) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  await context.routeWebSocket("**/*", socket => socket.close());
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    // Preserve the compiled application. Only the disposable API receives these requests.
    if (url.origin === "https://api.hakwonplus.com" && url.pathname.startsWith("/api/")) {
      const response = await route.fetch({ url: api.origin + url.pathname + url.search, maxRedirects: 0 });
      await route.fulfill({ response });
      await response.dispose();
      return;
    }
    await route.abort();
  });
  const response = await context.request.post(api.origin + "/api/v1/token/", {
    headers: { "X-Tenant-Code": person.code }, maxRedirects: 0,
    data: { tenant_code: person.code, username: person.username, password: person.password },
  });
  assert.equal(response.status(), 200, "fixture login");
  const { access, refresh } = await response.json();
  assert.ok(access && refresh);
  const headers = { Authorization: `Bearer ${access}`, "X-Tenant-Code": person.code };
  const read = async path => {
    const result = await context.request.get(api.origin + path, { headers, maxRedirects: 0 });
    assert.equal(result.status(), 200, path);
    return result.json();
  };
  const me = await read("/api/v1/core/me/");
  assert.equal(me.tenantRole, "owner");
  assert.equal(me.is_superuser, false);
  const program = await read("/api/v1/core/program/");
  assert.equal(program.tenantCode, person.code);
  assert.equal(program.isPlatformAdmin, person.code === "9999");
  context.setDefaultNavigationTimeout(60000);
  await context.addInitScript(({ origin, access, refresh, code }) => {
    if (location.origin !== origin || sessionStorage.getItem("billingQaLogin") === code) return;
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("tenant_code", code);
    sessionStorage.setItem("tenantCode", code);
    sessionStorage.setItem("billingQaLogin", code);
  }, { origin, code: person.code, access, refresh });
  return { context, page: await context.newPage(), headers, read };
}

async function action(page, path, method, click, status) {
  const [response] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === path && r.request().method() === method),
    click(),
  ]);
  assert.equal(response.status(), status, method + " " + path);
  return response.json();
}

async function dismissGuide(page, code) {
  const guide = page.locator(`[data-first-login-tenant="${code}"] [role="dialog"]`);
  if (await guide.waitFor({ state: "visible", timeout: 2000 }).then(() => true, () => false)) {
    await guide.getByRole("button", { name: "확인", exact: true }).click();
  }
}

try {
  const http = web.httpServer;
  const origin = "http://127.0.0.1:" + http.address().port;
  console.log("Billing browser bundle", revision, fingerprint);
  browser = await chromium.launch({
    channel: process.env.BILLING_QA_CHANNEL || undefined,
    args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"],
  });
  const reviewer = await actor(fixture.operator, { width: 1365, height: 900 }, origin);
  for (const school of fixture.schools) {
    const owner = await actor(school, { width: school.manual ? 1365 : 390, height: 900 }, origin);
    try {
      const page = owner.page;
      stage = "opening school billing";
      await page.goto(origin + "/workspace/settings/billing", { waitUntil: "domcontentloaded" });
      const section = page.getByRole("region", { name: "계좌이체로 이용료 납부" });
      await expect(section).toBeVisible({ timeout: 30000 });
      await dismissGuide(page, school.code);
      stage = "activating invoice";
      await section.getByRole("button", { name: "계좌이체 선택하기" }).click();
      const activated = await action(page, transfer + "activate/", "POST",
        () => page.getByRole("button", { name: "계좌이체로 변경", exact: true }).click(), 200);
      const [invoice] = activated.invoices;
      assert.equal(invoice.status, "PENDING");
      stage = "submitting transfer";
      const depositor = school.manual ? "QA manual" : "QA no receipt";
      await section.getByLabel("입금자명 (통장 표시 이름)").fill(depositor);
      await section.getByRole("checkbox").setChecked(school.manual);
      if (school.manual) {
        await section.getByPlaceholder("사업자등록증의 상호").fill("QA Academy");
        await section.getByPlaceholder("사업자등록증의 대표자명").fill("QA Owner");
        await section.getByPlaceholder("000-00-00000").fill("0000000107");
        await section.getByPlaceholder("세금계산서를 받을 이메일").fill("qa@example.invalid");
      }
      const submitted = await action(page, transfer + "notices/", "POST",
        () => section.getByRole("button", { name: "입금 확인 요청하기" }).click(), 201);
      assert.equal(submitted.invoice, invoice.id);
      assert.equal(submitted.status, "SUBMITTED");
      assert.equal(submitted.tax_invoice_requested, school.manual);
      assert.equal(submitted.receipt_kind, school.manual ? "BUSINESS_TAX" : "NONE");
      assert.equal(submitted.automatic_receipt, false);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(section.getByText("입금 확인 요청이 접수되었습니다", { exact: true })).toBeVisible();
      const confirm = queue + submitted.id + "/confirm/";
      const denied = await owner.context.request.post(api.origin + confirm, { headers: owner.headers, maxRedirects: 0 });
      assert.equal(denied.status(), 403);
      stage = "confirming as platform operator";
      await reviewer.page.goto(origin + "/dev/billing", { waitUntil: "domcontentloaded" });
      const notices = reviewer.page.getByRole("button", { name: /입금 신고/ });
      await expect(notices).toBeVisible({ timeout: 30000 });
      await dismissGuide(reviewer.page, fixture.operator.code);
      await notices.click();
      const row = reviewer.page.getByRole("row").filter({ hasText: invoice.invoice_number });
      await expect(row).toContainText(depositor);
      reviewer.page.once("dialog", async dialog => {
        if (dialog.message().includes(invoice.invoice_number)) await dialog.accept();
        else await dialog.dismiss();
      });
      const confirmed = await action(reviewer.page, confirm, "POST",
        () => row.getByRole("button", { name: "입금 확인", exact: true }).click(), 200);
      assert.equal(confirmed.status, "CONFIRMED");
      const replay = await reviewer.context.request.post(api.origin + confirm, { headers: reviewer.headers, maxRedirects: 0 });
      assert.equal(replay.status(), 200);
      stage = "reloading the operator queue";
      await reviewer.page.reload({ waitUntil: "domcontentloaded" });
      await notices.click();
      const refreshed = await reviewer.read(queue + "?actionable=true");
      // Only pending work and manual receipts awaiting issuance stay in this queue.
      assert.equal(refreshed.results.some(item => item.id === submitted.id), school.manual);
      if (school.manual) await expect(row.getByRole("cell", { name: "입금 확인", exact: true })).toBeVisible();
      else await expect(reviewer.page.getByText("입금 확인 요청이 없습니다.", { exact: true })).toBeVisible();
      stage = "reading persisted result";
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(section.getByText("입금이 확인되었습니다", { exact: true })).toBeVisible();
      const summary = await owner.read(transfer);
      const paid = summary.invoices.find(item => item.id === invoice.id);
      assert.equal(paid.status, "PAID");
      assert.equal(paid.bank_transfer_notice.id, submitted.id);
      assert.equal(paid.bank_transfer_notice.tax_invoice_status, school.manual ? "READY" : "NOT_REQUESTED");
      await page.goto(origin + "/dev/billing", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/workspace(?:[/?#]|$)/);
      console.log(school.manual ? "MANUAL_RECEIPT_BROWSER_PASS" : "NO_RECEIPT_BROWSER_PASS");
    } finally {
      await owner.context.close();
    }
  }
  await reviewer.context.close();
  assert.equal(artifactFingerprint(dist), fingerprint, "Frontend artifact changed during QA");
} catch (error) {
  console.error("Billing browser failure at " + stage + ": " + error.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  try { await browser?.close(); }
  finally {
    await new Promise(resolve => web.httpServer.close(resolve));
  }
}

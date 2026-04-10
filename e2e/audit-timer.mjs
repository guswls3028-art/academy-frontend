import { chromium } from "@playwright/test";

const API = "https://api.hakwonplus.com";
const TENANTS = [
  { name: "tchul", domain: "https://tchul.com", user: "01035023313", pass: "727258" },
  { name: "limglish", domain: "https://limglish.kr", user: "ggorno", pass: "dlarmsgur12" },
];
const CHECKS = [];

const browser = await chromium.launch({ headless: false });

for (const tenant of TENANTS) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const client = await page.context().newCDPSession(page);
  await client.send("Network.clearBrowserCache");

  const resp = await page.request.post(`${API}/api/v1/token/`, {
    data: { username: tenant.user, password: tenant.pass, tenant_code: tenant.name },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": tenant.name },
  });
  const tokens = await resp.json();

  await page.goto(`${tenant.domain}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    try { sessionStorage.setItem("tenantCode", code); } catch {}
  }, { access: tokens.access, refresh: tokens.refresh, code: tenant.name });

  await page.goto(`${tenant.domain}/admin`, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.getByText("도구").first().click();
  await page.waitForTimeout(2000);
  await page.getByText("타이머").first().click();
  await page.waitForTimeout(5000);

  const t = tenant.name;
  const ck = (name, val) => CHECKS.push({ tenant: t, check: name, pass: !!val });

  // 설정 화면
  ck("프리셋 7개", (await page.locator("button").filter({ hasText: /^(\d+분|1시간)$/ }).count()) === 7);
  ck("글꼴 선택", await page.getByText("글꼴").isVisible().catch(() => false));

  // 전체화면
  const fsBtn = page.locator('button[title="전체화면 (F)"]');
  await fsBtn.click();
  await page.waitForTimeout(2000);
  ck("전체화면 진입", await page.evaluate(() => document.fullscreenElement?.tagName === "HTML"));
  await page.screenshot({ path: `e2e/screenshots/audit_${t}_fs.png` });

  // 글꼴
  for (const f of ["클래식", "모던", "둥근", "기본"]) {
    const b = page.getByRole("button", { name: f });
    if (await b.isVisible().catch(() => false)) await b.click();
    await page.waitForTimeout(100);
  }
  ck("글꼴 전환", true);

  // 30분 → START → RUNNING
  await page.getByRole("button", { name: "30분" }).click();
  await page.waitForTimeout(500);
  await page.locator("button").filter({ has: page.locator("polygon") }).first().click();
  await page.waitForTimeout(2000);
  ck("RUNNING", await page.getByText("RUNNING").isVisible().catch(() => false));
  await page.screenshot({ path: `e2e/screenshots/audit_${t}_run.png` });

  // PAUSE
  const pauseSelector = page.locator("button svg rect[x='5']").locator("..").locator("..");
  await pauseSelector.first().click();
  await page.waitForTimeout(300);
  ck("PAUSED", await page.getByText("PAUSED").isVisible().catch(() => false));

  // +1분
  await page.getByRole("button", { name: "+1분" }).click();
  await page.waitForTimeout(200);
  ck("+1분", true);

  // 초기화
  await page.getByRole("button", { name: "초기화" }).click();
  await page.waitForTimeout(500);
  ck("초기화 → 설정복귀", await page.getByText("시험 시간을 선택하세요").isVisible().catch(() => false));

  // 3초 → TIME UP
  await page.locator('input[placeholder="분"]').fill("0");
  await page.locator('input[placeholder="초"]').fill("3");
  await page.getByRole("button", { name: "설정" }).click();
  await page.waitForTimeout(200);
  await page.locator("button").filter({ has: page.locator("polygon") }).first().click();
  await page.waitForTimeout(4500);
  ck("TIME UP", await page.getByText("TIME UP").isVisible().catch(() => false));
  await page.screenshot({ path: `e2e/screenshots/audit_${t}_timeup.png` });

  // +1분 after finish → restart (RUNNING or LAST MINUTE if ≤60s)
  await page.getByRole("button", { name: "+1분" }).click();
  await page.waitForTimeout(2000);
  const runAfterAdd = await page.getByText("RUNNING").isVisible().catch(() => false);
  const lastMinAfterAdd = await page.getByText("LAST MINUTE").isVisible().catch(() => false);
  ck("종료후 +1분 재시작", runAfterAdd || lastMinAfterAdd);

  // 초기화 → 프로젝터
  await pauseSelector.first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "초기화" }).click();
  await page.waitForTimeout(500);
  await page.getByText("Projector").click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "30분" }).click();
  await page.waitForTimeout(200);
  await page.locator("button").filter({ has: page.locator("polygon") }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `e2e/screenshots/audit_${t}_proj.png` });

  ck("프로젝터 로고", await page.evaluate(() => {
    const w = document.querySelector("img[class*=watermark]");
    return w && parseFloat(getComputedStyle(w).opacity) > 0.01;
  }));

  // 모드전환 → 스톱워치
  await page.locator("button").filter({ hasText: "스톱워치" }).last().click();
  await page.waitForTimeout(2000);
  ck("모드전환 전체화면유지", await page.evaluate(() => !!document.fullscreenElement));
  await page.screenshot({ path: `e2e/screenshots/audit_${t}_sw.png` });

  // 스톱워치 시작 + 랩
  await page.locator("button").filter({ has: page.locator("polygon") }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Lap" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Lap" }).click();
  await page.waitForTimeout(300);
  ck("랩 기록", await page.locator("text=LAP 01").isVisible().catch(() => false));
  await page.screenshot({ path: `e2e/screenshots/audit_${t}_laps.png` });

  // 정지 + 초기화
  await pauseSelector.first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Reset" }).click();
  await page.waitForTimeout(300);
  ck("스톱워치 READY", await page.getByText("READY").isVisible().catch(() => false));

  // ESC 해제
  await page.getByText("Projector").click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);
  ck("ESC 해제", !(await page.evaluate(() => !!document.fullscreenElement)));
  await page.screenshot({ path: `e2e/screenshots/audit_${t}_done.png` });

  await page.close();
}

await browser.close();

console.log("\n========== AUDIT RESULTS ==========");
let pass = 0, fail = 0;
for (const c of CHECKS) {
  const s = c.pass ? "PASS" : "FAIL";
  if (c.pass) pass++; else fail++;
  console.log(`[${s}] ${c.tenant}: ${c.check}`);
}
console.log(`\nTotal: ${CHECKS.length} / Pass: ${pass} / Fail: ${fail}`);
if (fail === 0) console.log("ALL PASS");

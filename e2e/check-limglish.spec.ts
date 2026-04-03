import { test } from "@playwright/test";

test("림글리시 뿌리오 연동 상태 확인", async ({ page }) => {
  // 림글리시 로그인 (owner 계정)
  const resp = await page.request.post("https://api.hakwonplus.com/api/v1/token/", {
    data: { username: "01035023313", password: "727258", tenant_code: "limglish" },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": "limglish" },
  });
  console.log("login status:", resp.status());
  if (resp.status() !== 200) {
    const body = await resp.text();
    console.log("login fail:", body);
    // tchul 계정으로 시도
    const resp2 = await page.request.post("https://api.hakwonplus.com/api/v1/token/", {
      data: { username: "01035023313", password: "727258", tenant_code: "tchul" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "tchul" },
    });
    console.log("tchul login:", resp2.status());
  }

  // limglish 도메인으로 접속 시도
  await page.goto("https://limglish.com/login", { waitUntil: "load", timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: "e2e/screenshots/limglish-login.png" });
  console.log("page url:", page.url());

  // 모든 테넌트 코드 확인
  const tenants = await page.request.get("https://api.hakwonplus.com/api/v1/tenants/public/");
  if (tenants.status() === 200) {
    const data = await tenants.json();
    const list = Array.isArray(data) ? data : (data.results ?? []);
    for (const t of list) {
      if (t.code?.includes("lim") || t.name?.includes("림") || t.code?.includes("eng")) {
        console.log(`tenant: code=${t.code} name=${t.name} domain=${t.domain}`);
      }
    }
  }
});

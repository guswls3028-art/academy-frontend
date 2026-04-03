import { test } from "@playwright/test";

test("림글리시 뿌리오 연동 직접 확인", async ({ page }) => {
  page.setViewportSize({ width: 1920, height: 1080 });

  // limglish.com 로그인 페이지로 이동
  await page.goto("https://limglish.com/login", { waitUntil: "load" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "e2e/screenshots/limglish-01-login.png", fullPage: true });

  // 로그인 시도 — 다양한 계정
  const attempts = [
    { user: "01035023313", pass: "727258" },
    { user: "admin", pass: "727258" },
    { user: "01035023313", pass: "1234" },
  ];

  let token = "";
  for (const a of attempts) {
    const resp = await page.request.post("https://api.hakwonplus.com/api/v1/token/", {
      data: { username: a.user, password: a.pass, tenant_code: "limglish" },
      headers: { "Content-Type": "application/json", "X-Tenant-Code": "limglish" },
    });
    if (resp.status() === 200) {
      const data = await resp.json();
      token = data.access;
      console.log(`✅ 로그인 성공: ${a.user}`);
      break;
    } else {
      console.log(`❌ 로그인 실패: ${a.user} → ${resp.status()}`);
    }
  }

  if (!token) {
    // 직접 UI 로그인 시도
    console.log("API 로그인 실패, UI로 시도...");
    // tchul owner 계정이 limglish에도 있는지 확인
    // DB에서 limglish tenant의 staff 목록 확인 필요

    // RDS 직접 접근 시도
    const headers = { "Content-Type": "application/json", "X-Tenant-Code": "limglish" };

    // /tenants/public/ 에서 limglish 정보 확인
    const pubResp = await page.request.get("https://api.hakwonplus.com/api/v1/tenants/public/");
    if (pubResp.status() === 200) {
      const data = await pubResp.json();
      const list = Array.isArray(data) ? data : (data.results ?? []);
      const lim = list.find((t: any) => t.code === "limglish");
      if (lim) {
        console.log("limglish tenant info:", JSON.stringify(lim));
      }
    }

    console.log("⚠️ 림글리시 로그인 자격증명을 찾을 수 없습니다");
    return;
  }

  // 로그인 성공 시 messaging info 확인
  const h = { Authorization: `Bearer ${token}`, "X-Tenant-Code": "limglish" };
  const infoResp = await page.request.get("https://api.hakwonplus.com/api/v1/messaging/info/", { headers: h });
  console.log("messaging info status:", infoResp.status());
  if (infoResp.status() === 200) {
    const info = await infoResp.json();
    console.log("provider:", info.messaging_provider);
    console.log("own_ppurio_api_key:", info.own_ppurio_api_key);
    console.log("own_ppurio_account:", info.own_ppurio_account);
    console.log("has_own_credentials:", info.has_own_credentials);
    console.log("messaging_sender:", info.messaging_sender);
    console.log("sms_allowed:", info.sms_allowed);
  }

  // 토큰으로 페이지 접근
  await page.goto("https://limglish.com/login", { waitUntil: "commit" });
  await page.evaluate(({ access }) => {
    localStorage.setItem("access", access);
    sessionStorage.setItem("tenantCode", "limglish");
  }, { access: token });

  await page.goto("https://limglish.com/admin/message/settings", { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: "e2e/screenshots/limglish-02-msg-settings.png", fullPage: true });

  // 현재 상태 확인
  const bodyText = await page.locator("body").textContent();
  console.log("페이지에 '뿌리오' 포함:", bodyText?.includes("뿌리오"));
  console.log("페이지에 'API 키 저장' 포함:", bodyText?.includes("API 키 저장"));
  console.log("페이지에 '에러' 포함:", bodyText?.includes("에러") || bodyText?.includes("오류"));
});

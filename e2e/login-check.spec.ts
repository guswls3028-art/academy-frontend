import { test, expect } from "@playwright/test";

test("로그인 동작 확인", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(`PAGE_ERROR: ${err.message}`));

  await page.goto("https://hakwonplus.com/login", { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "e2e/screenshots/login-01.png" });

  // 로그인 폼 찾기
  const idInput = page.locator("input[name='username'], input[placeholder*='아이디'], input[type='text']").first();
  const visible = await idInput.isVisible({ timeout: 5000 }).catch(() => false);
  console.log("ID input visible:", visible);

  if (!visible) {
    // 로그인 버튼이 먼저 보일 수 있음 (모달 열기)
    const openBtn = page.locator("button").filter({ hasText: /로그인|시작/ }).first();
    if (await openBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("로그인 모달 열기 버튼 발견");
      await openBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: "e2e/screenshots/login-01b.png" });
  }

  const pwInput = page.locator("input[name='password'], input[type='password']").first();
  const loginBtn = page.locator("button[type='submit']").first();

  const idVis = await idInput.isVisible({ timeout: 3000 }).catch(() => false);
  const pwVis = await pwInput.isVisible({ timeout: 3000 }).catch(() => false);
  const btnVis = await loginBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`Forms: id=${idVis}, pw=${pwVis}, btn=${btnVis}`);

  if (idVis && pwVis) {
    await idInput.fill("admin97");
    await pwInput.fill("koreaseoul97");
    await page.screenshot({ path: "e2e/screenshots/login-02.png" });

    if (btnVis) await loginBtn.click();
    else await pwInput.press("Enter");

    await page.waitForTimeout(5000);
    await page.screenshot({ path: "e2e/screenshots/login-03.png" });

    console.log("URL after login:", page.url());

    const alert = page.locator("[role='alert'], .text-red-500, .text-danger, .error-message").first();
    if (await alert.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("ERROR MSG:", await alert.textContent());
    }
  }

  const pageErrors = errors.filter(e => e.includes("PAGE_ERROR"));
  console.log(`Page errors: ${pageErrors.length}`);
  if (pageErrors.length > 0) console.log(pageErrors.join("\n"));
  console.log(`Console errors: ${errors.length}`);
});

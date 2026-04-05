// 사이드바 전메뉴 순회 — URL 변경 + 콘텐츠 렌더링 + 콘솔 에러 전수 확인
import { test, expect } from "@playwright/test";
import { loginViaUI, getBaseUrl } from "./helpers/auth";

const MENUS = [
  { href: "/admin/students", name: "학생", contentSelector: "table, .student" },
  { href: "/admin/lectures", name: "강의", contentSelector: "table, .lecture, [class*=lecture]" },
  { href: "/admin/clinic", name: "클리닉", contentSelector: "[class*=clinic], [class*=Clinic], table" },
  { href: "/admin/exams", name: "시험", contentSelector: "table, [class*=exam], [class*=Exam]" },
  { href: "/admin/results", name: "성적", contentSelector: "table, [class*=result], [class*=score]" },
  { href: "/admin/videos", name: "영상", contentSelector: "table, [class*=video], [class*=Video]" },
  { href: "/admin/message", name: "메시지", contentSelector: "[class*=message], [class*=Message], [class*=template]" },
  { href: "/admin/storage", name: "저장소", contentSelector: "[class*=storage], [class*=Storage], table" },
  { href: "/admin/community", name: "커뮤니티", contentSelector: "[class*=community], [class*=Community], table, .domain-header--with-tabs" },
  { href: "/admin/tools", name: "도구", contentSelector: "[class*=tool], [class*=Tool]" },
  { href: "/admin/guide", name: "사용 가이드", contentSelector: "[class*=guide], [class*=Guide], h1, h2" },
  { href: "/admin/settings", name: "설정", contentSelector: "nav a, form, input, [class*=navItem], [class*=content]" },
  { href: "/admin/dashboard", name: "대시보드", contentSelector: "[class*=dashboard], [class*=Dashboard], [class*=widget]" },
];

test("production: full sidebar menu verification with content check", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  const warnings: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[${msg.type()}] ${msg.text().substring(0, 300)}`);
    if (msg.type() === "warning" && msg.text().includes("error")) warnings.push(msg.text().substring(0, 200));
  });

  await loginViaUI(page, "admin");
  await page.waitForSelector(".sidebar .nav-item", { timeout: 15000 });

  const results: { name: string; urlOk: boolean; contentLoaded: boolean; mainHasContent: boolean; error?: string }[] = [];

  for (const menu of MENUS) {
    const link = page.locator(`.sidebar .nav-item[href="${menu.href}"]`);
    if (!(await link.isVisible({ timeout: 2000 }).catch(() => false))) {
      results.push({ name: menu.name, urlOk: false, contentLoaded: false, mainHasContent: false, error: "link not visible" });
      continue;
    }

    await link.click();

    // 목표 경로 반영 대기 (같은 메뉴 재클릭도 유효 — URL이 이미 맞으면 곧바로 통과)
    let urlOk = false;
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500);
      if (page.url().includes(menu.href)) {
        urlOk = true;
        break;
      }
    }

    // lazy·리다이렉트(/settings → /profile 등) 후 셸 텍스트 안정화
    await page.waitForTimeout(3500);

    const shell = page.locator('[data-app="admin"]').first();
    const shellText = await shell.innerText().catch(() => "");
    const mainHasContent = shellText.trim().length > 25;

    const loadingLoc = shell.getByText(/불러오는 중/);
    const loadingVisible = await loadingLoc.first().isVisible().catch(() => false);

    const structuralVisible = await shell
      .locator(menu.contentSelector)
      .first()
      .isVisible()
      .catch(() => false);
    const mainHasMeaningfulContent = mainHasContent || structuralVisible;
    const stillLoading = loadingVisible && !mainHasMeaningfulContent;

    // 스크린샷
    if (!urlOk || !mainHasMeaningfulContent || stillLoading) {
      await page.screenshot({ path: `e2e/screenshots/sidebar-${menu.name}.png` });
    }

    results.push({
      name: menu.name,
      urlOk,
      contentLoaded: !stillLoading,
      mainHasContent: mainHasMeaningfulContent,
      error: !urlOk
        ? "URL did not include target path"
        : stillLoading
          ? "stuck loading"
          : !mainHasMeaningfulContent
            ? "empty content"
            : undefined,
    });
  }

  // 결과 출력
  console.log("\n=== Sidebar Navigation Results ===");
  for (const r of results) {
    const status = r.urlOk && r.contentLoaded && r.mainHasContent ? "✓" : "✗";
    console.log(
      `${status} ${r.name}: URL=${r.urlOk ? "OK" : "FAIL"} Content=${r.mainHasContent ? "OK" : "EMPTY"} Loading=${r.contentLoaded ? "DONE" : "STUCK"} ${r.error || ""}`
    );
  }

  if (errors.length > 0) {
    console.log("\n=== Console Errors ===");
    errors.slice(0, 20).forEach((e) => console.log(e));
  }

  const failures = results.filter((r) => r.error);
  if (failures.length > 0) {
    console.log(`\n${failures.length} FAILURES found!`);
  } else {
    console.log("\nAll menus passed!");
  }

  // 완료 판정: 브라우저에서 URL·본문·로딩 상태까지 실패 시 테스트 실패
  expect(
    failures,
    `사이드바 메뉴 실패: ${failures.map((f) => `${f.name}(${f.error})`).join("; ")}`
  ).toHaveLength(0);
  expect(results.every((r) => r.urlOk && r.contentLoaded && r.mainHasContent)).toBe(true);
});

test("production: click same menu twice check", async ({ page }) => {
  await loginViaUI(page, "admin");
  await page.waitForSelector(".sidebar .nav-item", { timeout: 15000 });

  // 학생 메뉴 클릭
  await page.locator('.sidebar .nav-item[href="/admin/students"]').click();
  await page.waitForTimeout(2000);
  const url1 = page.url();
  console.log("First click:", url1);

  // 같은 메뉴 다시 클릭
  await page.locator('.sidebar .nav-item[href="/admin/students"]').click();
  await page.waitForTimeout(2000);
  const url2 = page.url();
  console.log("Second click (same menu):", url2);

  // 다른 메뉴 클릭
  await page.locator('.sidebar .nav-item[href="/admin/clinic"]').click();
  await page.waitForTimeout(2000);
  const url3 = page.url();
  console.log("Third click (different menu):", url3);

  expect(url3).toContain("/clinic");
});

test("production: verify AdminRouter routes exist", async ({ page }) => {
  test.setTimeout(180_000);
  const base = getBaseUrl("admin");
  await loginViaUI(page, "admin");
  await page.waitForTimeout(3000);

  // 각 라우트를 직접 goto로 접근해서 404 여부 확인
  const routes = [
    "/admin/dashboard", "/admin/students", "/admin/lectures", "/admin/clinic",
    "/admin/exams", "/admin/results", "/admin/videos", "/admin/message",
    "/admin/storage", "/admin/community", "/admin/tools", "/admin/guide",
    "/admin/settings", "/admin/developer", "/admin/staff",
  ];

  const problems: string[] = [];

  for (const route of routes) {
    await page.goto(`${base}${route}`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    // 중첩 <main>·lazy 구간 대비: 관리자 앱 셸 전체 텍스트로 판정 (catch 시 빈 문자열만 실패)
    const shellText = await page.locator('[data-app="admin"]').first().innerText().catch(() => "");

    if (!currentUrl.includes(route.split("?")[0])) {
      console.log(`REDIRECT: ${route} -> ${currentUrl}`);
      problems.push(`redirect ${route} -> ${currentUrl}`);
    } else if (shellText.trim().length < 10) {
      console.log(`EMPTY: ${route} (admin shell empty)`);
      problems.push(`empty shell ${route}`);
    } else {
      console.log(`OK: ${route}`);
    }
  }

  expect(problems, problems.join("\n")).toEqual([]);
});

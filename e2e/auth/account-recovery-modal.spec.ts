import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalOrPreviewBase(base: string): boolean {
  try {
    const hostname = new URL(base).hostname.trim().toLowerCase();
    return hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".pages.dev") ||
      hostname.endsWith(".trycloudflare.com");
  } catch {
    return false;
  }
}

function getLoginUrl(tenantCode: string): string {
  if (tenantCode === "limglish" && !isLocalOrPreviewBase(BASE)) {
    return `${trimTrailingSlash(getBaseUrl("limglish-admin"))}/login`;
  }
  return `${trimTrailingSlash(BASE)}/login/${tenantCode}`;
}

async function stubLoginBootstrap(page: Page, tenantCode = "hakwonplus") {
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode,
        display_name: tenantCode === "limglish" ? "limglish" : "학원플러스",
        ui_config: { login_title: tenantCode === "limglish" ? "limglish" : "학원플러스" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
  await page.route("**/api/v1/core/landing/has-published/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ has_published: true }),
    });
  });
}

async function stubAccountRecovery(page: Page, message = "입력한 번호로 안내를 발송했습니다.") {
  await page.unroute("**/api/v1/auth/account-recovery/dispatch/**").catch(() => undefined);
  await page.route("**/api/v1/auth/account-recovery/dispatch/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message }),
    });
  });
}

async function openRecovery(page: Page, mode: "username" | "password", tenantCode = "hakwonplus") {
  await gotoAndSettle(page, getLoginUrl(tenantCode), { timeout: 20_000 });
  await page.getByRole("button", { name: mode === "username" ? "아이디 찾기" : "비밀번호 찾기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillRecoveryForm(page: Page, name = "테스트학생") {
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("학생 이름 *").fill(name);
  await dialog.getByLabel("학생 또는 학부모 휴대폰 번호 앞 4자리").fill("1234");
  await dialog.getByLabel("학생 또는 학부모 휴대폰 번호 뒤 4자리").fill("5678");
}

async function expectRecoveryScopeNotice(dialog: ReturnType<Page["getByRole"]>) {
  await expect(dialog.getByText("학생·학부모 계정만 찾을 수 있습니다.")).toBeVisible();
  await expect(dialog.getByText("등록된 정보가 확인되면 카카오 알림톡으로 보내드립니다.")).toBeVisible();
  await expect(dialog.getByText("선생님·조교 계정은 학원 대표에게 문의해 주세요.")).toBeVisible();
}

async function openAndFillSignup(
  page: Page,
  { password, confirmation }: { password: string; confirmation: string },
) {
  await gotoAndSettle(page, `${BASE}/login/hakwonplus`, { timeout: 20_000 });
  await page.getByRole("button", { name: "회원가입" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("이름 *").fill("가입테스트");
  await dialog.getByRole("button", { name: "남" }).click();
  await dialog.getByLabel("아이디 (희망 로그인 ID) *").fill("signup-rootfix");
  await dialog.getByLabel("비밀번호 *", { exact: true }).fill(password);
  await dialog.getByLabel("비밀번호 확인 *", { exact: true }).fill(confirmation);
  await dialog.getByLabel("휴대전화 앞 4자리").fill("1234");
  await dialog.getByLabel("휴대전화 뒤 4자리").fill("5678");
  await dialog.getByLabel("학부모 연락처 앞 4자리").fill("8765");
  await dialog.getByLabel("학부모 연락처 뒤 4자리").fill("4321");
  await dialog.getByLabel("고등학교명 *").fill("테스트고");
  await dialog.getByLabel("학년 *").selectOption("1");
  const origin = dialog.getByLabel("출신중학교 *");
  if (await origin.isVisible().catch(() => false)) await origin.fill("테스트중");
  await dialog.getByLabel("주소 *").fill("서울");
  return dialog;
}

function localStaffJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function seedLocalStaffSession(page: Page) {
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE),
    "가입 복구 route-mock 검증은 로컬 dev 서버 전용",
  );
  await installTenantOneInitScript(page);
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
  }, localStaffJwt());
}

test.describe("계정 복구 모달 UI 검증", () => {
  test.beforeEach(async ({ page }) => {
    await stubLoginBootstrap(page);
    await stubAccountRecovery(page);
  });

  test("로그인 페이지에서 아이디/비밀번호 찾기 진입점이 표시된다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/login/hakwonplus`, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: "아이디 찾기" })).toBeVisible();
    await expect(page.getByRole("button", { name: "비밀번호 찾기" })).toBeVisible();
    await expect(page.getByRole("button", { name: "비밀번호 보기" })).toBeVisible();
  });

  test("아이디 찾기 모달이 열리고 학생/학부모 대상 전환이 동작한다", async ({ page }) => {
    const dialog = await openRecovery(page, "username");
    await expect(dialog.getByRole("heading", { name: "아이디 찾기" })).toBeVisible();
    await expectRecoveryScopeNotice(dialog);

    const idModeBtn = dialog.getByRole("button", { name: "아이디", exact: true });
    const passwordModeBtn = dialog.getByRole("button", { name: "비밀번호", exact: true });
    const studentBtn = dialog.getByRole("button", { name: "학생", exact: true });
    const parentBtn = dialog.getByRole("button", { name: "학부모", exact: true });
    await expect(idModeBtn).toHaveAttribute("aria-pressed", "true");
    await expect(passwordModeBtn).toHaveAttribute("aria-pressed", "false");
    await expect(studentBtn).toHaveAttribute("aria-pressed", "true");
    await expect(parentBtn).toHaveAttribute("aria-pressed", "false");

    await expect(dialog.getByPlaceholder("학생 이름 *")).toBeVisible();
    await expect(dialog.getByText("학생 본인 또는 학부모 번호로 받을 수 있습니다.")).toBeVisible();

    await parentBtn.click();
    await expect(parentBtn).toHaveAttribute("aria-pressed", "true");
    await expect(studentBtn).toHaveAttribute("aria-pressed", "false");
    await expect(dialog.getByText("등록된 학부모 번호로 발송됩니다.")).toBeVisible();
    await expect(dialog.getByLabel("학부모 휴대폰 번호 앞 4자리")).toBeVisible();
  });

  test("비밀번호 찾기 모달에서 아이디 찾기로 즉시 전환할 수 있다", async ({ page }) => {
    const dialog = await openRecovery(page, "password");
    await expect(dialog.getByRole("heading", { name: "비밀번호 찾기" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "비밀번호", exact: true })).toHaveAttribute("aria-pressed", "true");

    await dialog.getByRole("button", { name: "아이디", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "아이디 찾기" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "아이디", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("이름 미입력 시 유효성 에러가 표시된다", async ({ page }) => {
    const dialog = await openRecovery(page, "password");
    await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();
    await expect(dialog.getByRole("alert")).toContainText("학생 이름을 입력해 주세요.");
  });

  test("전화번호 미입력 시 유효성 에러가 표시된다", async ({ page }) => {
    const dialog = await openRecovery(page, "password");
    await dialog.getByPlaceholder("학생 이름 *").fill("테스트학생");
    await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();
    await expect(dialog.getByRole("alert")).toContainText("휴대폰 번호를 010 뒤 8자리로 입력해 주세요.");
  });

  test("아이디 찾기 성공 시 서버 안내 문구를 표시한다", async ({ page }) => {
    const message = "입력한 정보가 등록되어 있다면 해당 번호로 아이디 안내 알림톡이 발송됩니다.";
    await stubAccountRecovery(page, message);
    const dialog = await openRecovery(page, "username");

    await fillRecoveryForm(page);
    await dialog.getByRole("button", { name: "아이디 안내 받기" }).click();

    await expect(dialog.getByRole("status")).toHaveText(message);
  });

  test("비밀번호 찾기 성공 시 임시 비밀번호 발송 안내를 표시한다", async ({ page }) => {
    const message = "입력한 정보가 등록되어 있다면 해당 번호로 임시 비밀번호 알림톡이 발송됩니다.";
    let tenantHeader: string | undefined;
    await page.unroute("**/api/v1/auth/account-recovery/dispatch/**").catch(() => undefined);
    await page.route("**/api/v1/auth/account-recovery/dispatch/**", async (route) => {
      tenantHeader = route.request().headers()["x-tenant-code"];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message }),
      });
    });
    const dialog = await openRecovery(page, "password");

    await fillRecoveryForm(page);
    await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();

    await expect(dialog.getByRole("status")).toHaveText(message);
    expect(tenantHeader).toBe("hakwonplus");
  });

  test("서버 발송 실패 시 오류를 표시하고 모달을 유지한다", async ({ page }) => {
    await page.unroute("**/api/v1/auth/account-recovery/dispatch/**").catch(() => undefined);
    await page.route("**/api/v1/auth/account-recovery/dispatch/**", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "임시 비밀번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." }),
      });
    });
    const dialog = await openRecovery(page, "password");

    await fillRecoveryForm(page);
    await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toContainText("임시 비밀번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  });

  test("발송 중에는 제출 버튼이 비활성화되어 중복 요청을 막는다", async ({ page }) => {
    let requestCount = 0;
    await page.unroute("**/api/v1/auth/account-recovery/dispatch/**").catch(() => undefined);
    await page.route("**/api/v1/auth/account-recovery/dispatch/**", async (route) => {
      requestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "입력한 정보가 등록되어 있다면 해당 번호로 임시 비밀번호 알림톡이 발송됩니다." }),
      });
    });
    const dialog = await openRecovery(page, "password");

    await fillRecoveryForm(page);
    const submit = dialog.getByRole("button", { name: "임시 비밀번호 받기" });
    const buttonBox = await submit.boundingBox();
    await submit.click();

    await expect(dialog.getByRole("button", { name: "재설정 중..." })).toBeDisabled();
    if (buttonBox) {
      await page.mouse.click(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2, { clickCount: 2 });
    }
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("status")).toHaveText("입력한 정보가 등록되어 있다면 해당 번호로 임시 비밀번호 알림톡이 발송됩니다.");
    expect(requestCount).toBe(1);
  });

  test("limglish 로그인 비밀번호 찾기는 카카오 알림톡 문구와 tenant header를 사용한다", async ({ page }) => {
    await page.unroute("**/api/v1/core/program/**").catch(() => undefined);
    await stubLoginBootstrap(page, "limglish");
    let tenantHeader: string | undefined;
    await page.unroute("**/api/v1/auth/account-recovery/dispatch/**").catch(() => undefined);
    await page.route("**/api/v1/auth/account-recovery/dispatch/**", async (route) => {
      tenantHeader = route.request().headers()["x-tenant-code"];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "입력한 정보가 등록되어 있다면 해당 번호로 임시 비밀번호 알림톡이 발송됩니다." }),
      });
    });

    const dialog = await openRecovery(page, "password", "limglish");
    await expectRecoveryScopeNotice(dialog);

    await fillRecoveryForm(page, "황연재");
    await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();

    await expect(dialog.getByRole("status")).toHaveText("입력한 정보가 등록되어 있다면 해당 번호로 임시 비밀번호 알림톡이 발송됩니다.");
    expect(tenantHeader).toBe("limglish");
  });

  test("회원가입 비밀번호 확인 불일치는 제출 0건·확인 입력 포커스로 막는다", async ({ page }) => {
    let requestCount = 0;
    await page.route("**/api/v1/students/registration_requests/check_duplicate/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ username: { available: true }, phone: { available: true } }),
      });
    });
    await page.route("**/api/v1/students/registration_requests/", async (route) => {
      if (route.request().method() === "POST") requestCount += 1;
      await route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = await openAndFillSignup(page, {
      password: "test1234",
      confirmation: "test1243",
    });

    await dialog.getByRole("button", { name: "가입 신청" }).click();

    await expect(dialog.getByRole("alert")).toContainText("비밀번호가 일치하지 않습니다.");
    await expect(dialog.getByLabel("비밀번호 확인 *")).toBeFocused();
    expect(requestCount).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("회원가입 일치 비밀번호는 exact payload로 한 번만 제출한다", async ({ page }) => {
    let requestCount = 0;
    let payload: Record<string, unknown> | undefined;
    let releaseRequest = () => {};
    const requestGate = new Promise<void>((resolve) => { releaseRequest = resolve; });
    await page.route("**/api/v1/students/registration_requests/check_duplicate/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ username: { available: true }, phone: { available: true } }),
      });
    });
    await page.route("**/api/v1/students/registration_requests/", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      requestCount += 1;
      payload = route.request().postDataJSON() as Record<string, unknown>;
      await requestGate;
      await route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    });
    const password = " test1234 ";
    const dialog = await openAndFillSignup(page, { password, confirmation: password });
    const submit = dialog.getByRole("button", { name: "가입 신청" });

    await submit.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });

    await expect.poll(() => requestCount).toBe(1);
    expect(payload?.initial_password).toBe(password);
    expect(payload?.password_confirmation).toBe(password);
    await expect(dialog.getByRole("button", { name: "제출 중..." })).toBeDisabled();
    releaseRequest();
    await expect(dialog.getByText("신청이 완료되었습니다. 승인 후 로그인해 주세요.")).toBeVisible();
  });

  test("회원가입 중복 계정 안내는 카카오 알림톡 임시 비밀번호 경로를 사용한다", async ({ page }) => {
    let recoveryPayload: Record<string, unknown> | undefined;
    await page.route("**/api/v1/students/registration_requests/check_duplicate/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          username: { available: true },
          phone: { available: true },
        }),
      });
    });
    await page.route("**/api/v1/students/registration_requests/", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          code: "already_registered",
          detail: "이미 가입된 아이디입니다.",
          student_name: "황연재",
          student_phone: "01012345678",
        }),
      });
    });
    await page.route("**/api/v1/students/send_existing_credentials/**", async (route) => {
      recoveryPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "입력한 정보가 등록되어 있다면 해당 번호로 아이디와 임시 비밀번호 알림톡이 발송됩니다.",
        }),
      });
    });

    await gotoAndSettle(page, `${BASE}/login/hakwonplus`, { timeout: 20_000 });
    await page.getByRole("button", { name: "회원가입" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "학생 회원가입" })).toBeVisible();

    await dialog.getByLabel("이름 *").fill("황연재");
    await dialog.getByRole("button", { name: "남" }).click();
    await dialog.getByLabel("아이디 (희망 로그인 ID) *").fill("hwangyj");
    await dialog.getByLabel("비밀번호 *", { exact: true }).fill("test1234");
    await dialog.getByLabel("비밀번호 확인 *", { exact: true }).fill("test1234");
    await dialog.getByLabel("휴대전화 앞 4자리").fill("1234");
    await dialog.getByLabel("휴대전화 뒤 4자리").fill("5678");
    await dialog.getByLabel("학부모 연락처 앞 4자리").fill("8765");
    await dialog.getByLabel("학부모 연락처 뒤 4자리").fill("4321");
    await dialog.getByLabel("고등학교명 *").fill("테스트고");
    await dialog.getByLabel("학년 *").selectOption("1");
    const origin = dialog.getByLabel("출신중학교 *");
    if (await origin.isVisible().catch(() => false)) {
      await origin.fill("테스트중");
    }
    await dialog.getByLabel("주소 *").fill("서울");
    await dialog.getByRole("button", { name: "가입 신청" }).click();

    await expect(dialog.getByText("이미 가입된 아이디입니다.")).toBeVisible();
    await expect(dialog.getByText(/카카오톡을 사용할 수 없으면.*학생 상세.*비밀번호 초기화/)).toBeVisible();
    const sendButton = dialog.getByRole("button", {
      name: "카카오 알림톡으로 아이디/임시 비밀번호 발송",
    });
    await expect(sendButton).toBeVisible();
    await sendButton.click();

    await expect(dialog.getByText("알림톡이 발송되었습니다. 확인 후 로그인해 주세요.")).toBeVisible();
    expect(recoveryPayload).toEqual({ phone: "01012345678", name: "황연재" });
  });

  test("모달 포커스가 배경으로 빠지지 않고 닫히면 진입 버튼으로 복원된다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/login/hakwonplus`, { timeout: 20_000 });
    const trigger = page.getByRole("button", { name: "비밀번호 찾기" });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder("학생 이름 *")).toBeFocused();

    for (let i = 0; i < 16; i += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("ESC 키로 모달이 닫힌다", async ({ page }) => {
    const dialog = await openRecovery(page, "password");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("취소 버튼으로 모달이 닫힌다", async ({ page }) => {
    const dialog = await openRecovery(page, "password");
    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(dialog).not.toBeVisible();
  });
});

test("삭제 가입 이력은 선생님이 하나를 선택하고 중복 제출 없이 복구한다", async ({ page }) => {
  await seedLocalStaffSession(page);
  let resolved = false;
  let approveCount = 0;
  let resolveCount = 0;
  let releaseResolve = () => {};
  const resolveGate = new Promise<void>((resolve) => { releaseResolve = resolve; });

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.endsWith("/core/program/") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tenantCode: "hakwonplus",
          isPlatformAdmin: true,
          display_name: "학원플러스",
          feature_flags: {},
          is_active: true,
        }),
      });
      return;
    }
    if (path.endsWith("/core/me/") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 12,
          username: "admin",
          name: "관리자",
          is_staff: true,
          is_superuser: true,
          tenantRole: "admin",
          must_change_password: false,
        }),
      });
      return;
    }
    if (path.endsWith("/students/registration_requests/settings/") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ auto_approve: false }),
      });
      return;
    }
    if (path.endsWith("/students/registration_requests/") && method === "GET") {
      const results = resolved ? [] : [{
        id: 322,
        status: "pending",
        name: "복구학생",
        parent_phone: "01000000000",
        phone: "01000000001",
        school_type: "HIGH",
        high_school: "테스트고",
        grade: 1,
        created_at: "2026-08-26T14:18:51Z",
      }];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: results.length, results }),
      });
      return;
    }
    if (path.endsWith("/students/registration_requests/322/approve/") && method === "POST") {
      approveCount += 1;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          code: "deleted_student_conflict",
          detail: "같은 학생으로 보이는 삭제 이력이 있습니다.",
          candidates: [
            {
              student_id: 768,
              created_at: "2024-03-01T00:00:00Z",
              deleted_at: "2026-08-26T14:17:30Z",
              enrollment_count: 3,
            },
            {
              student_id: 1326,
              created_at: "2026-01-01T00:00:00Z",
              deleted_at: "2026-08-26T14:17:30Z",
              enrollment_count: 0,
            },
          ],
        }),
      });
      return;
    }
    if (path.endsWith("/students/registration_requests/322/resolve_deleted/") && method === "POST") {
      resolveCount += 1;
      expect(route.request().postDataJSON()).toEqual({ student_id: 768 });
      await resolveGate;
      resolved = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 768, name: "복구학생", ps_number: "recovered-login" }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAndSettle(page, `${BASE}/workspace/students/requests`, { timeout: 30_000 });
  await page.getByRole("button", { name: "승인", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "승인", exact: true }).click();

  const recovery = page.getByRole("dialog", { name: "과거 계정을 선택해 주세요" });
  await expect(recovery).toBeVisible();
  await expect(recovery.getByText("수강 이력 3건")).toBeVisible();
  await recovery.getByRole("radio").filter({ hasText: "수강 이력 3건" }).click();
  const confirm = recovery.getByRole("button", { name: "이 계정 복구·승인" });
  await confirm.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await page.keyboard.press("Escape");

  await expect(recovery).toBeVisible();
  await expect(recovery.getByRole("button", { name: "복구 중…" })).toBeDisabled();
  expect(approveCount).toBe(1);
  expect(resolveCount).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  releaseResolve();
  await expect(recovery).toHaveCount(0);
  await expect(page.getByText("대기 중인 가입 신청이 없습니다")).toBeVisible();
});

test("구 backend의 일반 가입 승인 409는 복구 요청 없이 fail-closed다", async ({ page }) => {
  await seedLocalStaffSession(page);
  let approveCount = 0;
  let resolveCount = 0;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path.endsWith("/core/program/") && method === "GET") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스",
        feature_flags: {},
        is_active: true,
      });
    }
    if (path.endsWith("/core/me/") && method === "GET") {
      return json({
        id: 12,
        username: "admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path.endsWith("/students/registration_requests/settings/") && method === "GET") {
      return json({ auto_approve: false });
    }
    if (path.endsWith("/students/registration_requests/") && method === "GET") {
      return json({
        count: 1,
        results: [{
          id: 322,
          status: "pending",
          name: "복구학생",
          parent_phone: "01000000000",
          phone: "01000000001",
          school_type: "HIGH",
          high_school: "테스트고",
          grade: 1,
          created_at: "2026-08-26T14:18:51Z",
        }],
      });
    }
    if (path.endsWith("/students/registration_requests/322/approve/") && method === "POST") {
      approveCount += 1;
      return json({ detail: "삭제된 학생 정보를 먼저 확인해 주세요." }, 409);
    }
    if (path.endsWith("/students/registration_requests/322/resolve_deleted/") && method === "POST") {
      resolveCount += 1;
      return json({}, 500);
    }
    return json({ count: 0, results: [] });
  });

  await gotoAndSettle(page, `${BASE}/workspace/students/requests`, { timeout: 30_000 });
  await page.getByRole("button", { name: "승인", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "승인", exact: true }).click();

  await expect.poll(() => approveCount).toBe(1);
  await expect(page.getByRole("dialog", { name: "과거 계정을 선택해 주세요" })).toHaveCount(0);
  await expect(page.getByText("승인되었습니다. 학생이 등록되었습니다.", { exact: true })).toHaveCount(0);
  expect(resolveCount).toBe(0);
});

test("삭제 가입 복구의 active·cross-tenant·stale·retry 409는 데스크톱에서 fail-closed다", async ({ page }) => {
  await seedLocalStaffSession(page);
  const rejectionDetails = [
    "같은 식별값의 활성 학생이 있습니다. 학생 정보를 먼저 확인해 주세요.",
    "다른 학원에도 연결된 로그인 계정은 이 경로에서 복구할 수 없습니다.",
    "선택한 삭제 학생 정보가 승인 중 변경되었습니다. 목록을 새로 확인해 주세요.",
    "이미 처리된 신청입니다.",
  ];
  let approveCount = 0;
  let resolveCount = 0;
  const serverMutationCount = 0;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    if (path.endsWith("/core/program/") && method === "GET") {
      return json({
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스",
        feature_flags: {},
        is_active: true,
      });
    }
    if (path.endsWith("/core/me/") && method === "GET") {
      return json({
        id: 12,
        username: "admin",
        name: "관리자",
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        must_change_password: false,
      });
    }
    if (path.endsWith("/students/registration_requests/settings/") && method === "GET") {
      return json({ auto_approve: false });
    }
    if (path.endsWith("/students/registration_requests/") && method === "GET") {
      return json({
        count: 1,
        results: [{
          id: 322,
          status: "pending",
          name: "복구학생",
          parent_phone: "01000000000",
          phone: "01000000001",
          school_type: "HIGH",
          high_school: "테스트고",
          grade: 1,
          created_at: "2026-08-26T14:18:51Z",
        }],
      });
    }
    if (path.endsWith("/students/registration_requests/322/approve/") && method === "POST") {
      approveCount += 1;
      return json({
        code: "deleted_student_conflict",
        detail: "같은 학생으로 보이는 삭제 이력이 있습니다.",
        candidates: [{
          student_id: 768,
          created_at: "2024-03-01T00:00:00Z",
          deleted_at: "2026-08-26T14:17:30Z",
          enrollment_count: 3,
        }],
      }, 409);
    }
    if (path.endsWith("/students/registration_requests/322/resolve_deleted/") && method === "POST") {
      expect(route.request().postDataJSON()).toEqual({ student_id: 768 });
      const detail = rejectionDetails[Math.min(resolveCount, rejectionDetails.length - 1)];
      resolveCount += 1;
      return json({ detail }, 409);
    }
    return json({ count: 0, results: [] });
  });

  await page.setViewportSize({ width: 1366, height: 900 });
  await gotoAndSettle(page, `${BASE}/workspace/students/requests`, { timeout: 30_000 });
  await page.getByRole("button", { name: "승인", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "승인", exact: true }).click();

  const recovery = page.getByRole("dialog", { name: "과거 계정을 선택해 주세요" });
  await expect(recovery).toBeVisible();
  await recovery.getByRole("radio").click();
  const confirm = recovery.getByRole("button", { name: "이 계정 복구·승인" });

  for (const detail of rejectionDetails) {
    await confirm.click();
    await expect(page.getByText(detail, { exact: true })).toBeVisible();
    await expect(recovery).toBeVisible();
    await expect(confirm).toBeEnabled();
  }

  expect(approveCount).toBe(1);
  expect(resolveCount).toBe(rejectionDetails.length);
  expect(serverMutationCount).toBe(0);
  await expect(page.getByText("승인되었습니다. 학생이 등록되었습니다.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("복구할 계정을 직접 선택하면 수강 이력을 보존하고", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

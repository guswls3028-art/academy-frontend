import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");

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
  await gotoAndSettle(page, `${BASE}/login/${tenantCode}`, { timeout: 20_000 });
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
    await expect(dialog.getByText("이메일은 사용하지 않습니다. 등록된 정보가 확인되면 카카오 알림톡으로 보내드립니다.")).toBeVisible();

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
    await expect(dialog.getByText("이메일은 사용하지 않습니다. 등록된 정보가 확인되면 카카오 알림톡으로 보내드립니다.")).toBeVisible();

    await fillRecoveryForm(page, "황연재");
    await dialog.getByRole("button", { name: "임시 비밀번호 받기" }).click();

    await expect(dialog.getByRole("status")).toHaveText("입력한 정보가 등록되어 있다면 해당 번호로 임시 비밀번호 알림톡이 발송됩니다.");
    expect(tenantHeader).toBe("limglish");
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
    await dialog.getByLabel("비밀번호 *").fill("test1234");
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

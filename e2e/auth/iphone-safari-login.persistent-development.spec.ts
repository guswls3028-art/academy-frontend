import fs from "node:fs";

import { expect, test, type Page } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

type LoginRole = "student" | "parent" | "staff";

type LoginAccount = {
  role: LoginRole;
  username: string;
  landing_path: string;
};

type LoginManifest = {
  schema_version: number;
  tenant_code: string;
  account_count: number;
  accounts: LoginAccount[];
};

const BASE = (process.env.E2E_BASE_URL || "").replace(/\/+$/, "");
const API = (process.env.E2E_API_URL || "").replace(/\/+$/, "");
const MANIFEST_PATH = (process.env.E2E_LOGIN_UAT_MANIFEST || "").trim();
const PASSWORD = (process.env.YMATH_REALUSE_SCENARIO_PASSWORD || "").trim();

function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

function loadManifest(): LoginManifest {
  const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as {
    login_manifest?: LoginManifest;
  } & Partial<LoginManifest>;
  return parsed.login_manifest ?? parsed as LoginManifest;
}

function validateManifest(manifest: LoginManifest): void {
  expect(isLoopbackUrl(BASE), "frontend UAT origin must be loopback-only").toBe(true);
  expect(isLoopbackUrl(API), "persistent-development API must be loopback-only").toBe(true);
  expect(manifest.schema_version).toBe(1);
  expect(manifest.tenant_code).toMatch(/^qa-ymath-realuse-/);
  expect(manifest.account_count).toBe(30);
  expect(manifest.accounts).toHaveLength(30);
  expect(new Set(manifest.accounts.map((account) => account.username)).size).toBe(30);
  for (const role of ["student", "parent", "staff"] as const) {
    expect(manifest.accounts.filter((account) => account.role === role)).toHaveLength(10);
  }
  for (const account of manifest.accounts) {
    expect(Object.keys(account).sort()).toEqual(["landing_path", "role", "username"]);
    expect(account.landing_path).toBe(account.role === "staff" ? "/workspace/mobile" : "/student");
  }
}

async function dismissFirstLoginGuide(page: Page): Promise<void> {
  const guide = page.getByRole("dialog", { name: "계정 안내" });
  if (await guide.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await guide.getByRole("button", { name: "확인", exact: true }).click();
    await expect(guide).not.toBeVisible();
  }
}

async function logoutAndVerify(page: Page, role: LoginRole): Promise<void> {
  if (role === "staff") {
    await page.getByRole("button", { name: "프로필 메뉴" }).click();
    await page.getByRole("menuitem", { name: "로그아웃", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    const drawer = page.getByRole("dialog", { name: "메뉴" });
    await drawer.getByRole("button", { name: "로그아웃" }).click();
    await page.locator(".stu-logout-dialog__confirm").click();
  }

  await expect(page).toHaveURL(`${BASE}/`, { timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => {
    const pointer = localStorage.getItem("academy:auth-active-generation:v1");
    return {
      pointer,
      activeEnvelope: pointer
        ? localStorage.getItem(`academy:auth-tokens:v1:${pointer}`)
        : null,
      legacyAccess: localStorage.getItem("access"),
      legacyRefresh: localStorage.getItem("refresh"),
    };
  })).toMatchObject({
    activeEnvelope: null,
    legacyAccess: null,
    legacyRefresh: null,
  });
  expect(await page.evaluate(() => (
    localStorage.getItem("academy:auth-active-generation:v1")
  ))).toBeTruthy();
}

test.use({ serviceWorkers: "block" });
test.use({ screenshot: "off", trace: "off", video: "off" });
test.setTimeout(900_000);

const missing = [
  ["E2E_BASE_URL", BASE],
  ["E2E_API_URL", API],
  ["E2E_LOGIN_UAT_MANIFEST", MANIFEST_PATH],
  ["YMATH_REALUSE_SCENARIO_PASSWORD", PASSWORD],
].filter(([, value]) => !value).map(([name]) => name);
if (missing.length) {
  throw new Error(`Missing required iPhone login UAT environment: ${missing.join(", ")}`);
}
if (process.env.E2E_ALLOW_PRODUCTION_WRITES !== "0") {
  throw new Error("iPhone login UAT requires E2E_ALLOW_PRODUCTION_WRITES=0.");
}

test.describe("persistent-development iPhone Safari login UAT", () => {
  test.describe.configure({ retries: 0 });

  test("30 synthetic accounts reach their role landing and log out", async ({ page }) => {
    const manifest = loadManifest();
    validateManifest(manifest);
    await page.setViewportSize({ width: 390, height: 844 });

    for (const account of manifest.accounts) {
      await gotoAndSettle(page, `${BASE}/login/${manifest.tenant_code}`, { timeout: 45_000 });
      await page.getByTestId("login-username").fill(account.username);
      await page.getByTestId("login-password").fill(PASSWORD);
      await page.getByTestId("login-submit").click();

      await expect(page).toHaveURL(new RegExp(`${account.landing_path}(?:/|$)`), { timeout: 45_000 });
      await dismissFirstLoginGuide(page);
      await logoutAndVerify(page, account.role);
    }
  });
});

import { expect, test, type Page } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

type LoginRole = "student" | "parent" | "staff";
type StoredAuthSession = { access: string; refresh: string; generation: string };

const AUTH_ACTIVE_GENERATION_KEY = "academy:auth-active-generation:v1";
const AUTH_GENERATION_PREFIX = "academy:auth-tokens:v1:";
const STORAGE_ERROR_MESSAGE =
  "이 브라우저에 로그인 정보를 저장하지 못했습니다. Safari의 개인정보 보호 설정을 확인한 뒤 다시 시도해 주세요.";

async function seedAuthSession(
  page: Page,
  session: StoredAuthSession,
): Promise<void> {
  await page.evaluate(({ pointerKey, generationPrefix, value }) => {
    const storage = window["localStorage"];
    storage.setItem(`${generationPrefix}${value.generation}`, JSON.stringify(value));
    storage.setItem(pointerKey, value.generation);
  }, {
    pointerKey: AUTH_ACTIVE_GENERATION_KEY,
    generationPrefix: AUTH_GENERATION_PREFIX,
    value: session,
  });
}

async function readAuthSession(page: Page): Promise<StoredAuthSession | null> {
  return page.evaluate(({ pointerKey, generationPrefix }) => {
    const storage = window["localStorage"];
    const generation = storage.getItem(pointerKey);
    const raw = generation ? storage.getItem(`${generationPrefix}${generation}`) : null;
    return raw ? JSON.parse(raw) as StoredAuthSession : null;
  }, { pointerKey: AUTH_ACTIVE_GENERATION_KEY, generationPrefix: AUTH_GENERATION_PREFIX });
}

type StorageReadFault = "getter" | "getItem";

async function installStorageReadFault(page: Page, fault: StorageReadFault): Promise<void> {
  await page.evaluate(({ selectedFault, pointerKey }) => {
    type FaultWindow = typeof window & { __restoreAuthStorage?: () => void };
    const faultWindow = window as FaultWindow;
    if (selectedFault === "getter") {
      const ownDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
      faultWindow.__restoreAuthStorage = () => {
        if (ownDescriptor) Object.defineProperty(window, "localStorage", ownDescriptor);
        else Reflect.deleteProperty(window, "localStorage");
      };
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() { throw new DOMException("blocked getter", "SecurityError"); },
      });
      return;
    }
    const original = Storage.prototype.getItem;
    faultWindow.__restoreAuthStorage = () => { Storage.prototype.getItem = original; };
    Storage.prototype.getItem = function getItem(key: string) {
      if (key === pointerKey) throw new DOMException("blocked getItem", "SecurityError");
      return original.call(this, key);
    };
  }, { selectedFault: fault, pointerKey: AUTH_ACTIVE_GENERATION_KEY });
}

async function restoreStorageFault(page: Page): Promise<void> {
  await page.evaluate(() => {
    const faultWindow = window as typeof window & { __restoreAuthStorage?: () => void };
    faultWindow.__restoreAuthStorage?.();
    delete faultWindow.__restoreAuthStorage;
  });
}

function createE2eJwt(generation = "default"): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400, generation }),
  ).toString("base64url");
  return `e30.${payload}.e2e`;
}

async function stubLoginFlow(page: Page, role: LoginRole) {
  const requests: Array<{ username?: string; password?: string; tenant_code?: string }> = [];
  const access = createE2eJwt(`${role}-login`);
  const refresh = `mock-${role}-refresh`;

  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/core/program/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tenantCode: "godmin",
        display_name: "신과함께",
        ui_config: { login_title: "신과함께" },
        feature_flags: {},
        is_active: true,
      }),
    });
  });
  await page.route("**/api/v1/core/landing/has-published/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ has_published: false }),
    });
  });
  await page.route("**/api/v1/token/", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access, refresh }),
    });
  });
  await page.route("**/api/v1/core/me/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 901,
        username: "student.id-20",
        name: "모바일 로그인 점검",
        is_staff: role === "staff",
        is_superuser: false,
        tenantRole: role,
        linkedStudents: role === "parent" ? [{ id: 902, name: "연결 학생" }] : null,
        must_change_password: false,
        first_login_guide_required: false,
      }),
    });
  });

  return { requests, access, refresh };
}

async function openLogin(page: Page) {
  await gotoAndSettle(page, `${BASE}/login/godmin`, { timeout: 30_000 });
  await expect(page.getByRole("form", { name: "로그인 폼" })).toBeVisible();
}

test.use({ serviceWorkers: "block" });

for (const role of ["student", "parent", "staff"] as const) {
  test(`iPhone 로그인은 ${role} 입력값을 바꾸지 않고 역할 홈까지 이동한다`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await stubLoginFlow(page, role);
    await openLogin(page);

    const username = page.getByTestId("login-username");
    const password = page.getByTestId("login-password");
    await expect(username).toHaveAttribute("autocapitalize", "none");
    await expect(username).toHaveAttribute("autocorrect", "off");
    await expect(username).toHaveAttribute("spellcheck", "false");
    await expect(password).toHaveAttribute("autocapitalize", "none");
    await expect(password).toHaveAttribute("autocorrect", "off");
    await expect(password).toHaveAttribute("spellcheck", "false");

    await username.fill("student.id-20");
    await password.fill("Case-Sensitive-Pw");
    await page.getByTestId("login-submit").click({ timeout: 30_000 });

    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0]).toEqual({
      username: "student.id-20",
      password: "Case-Sensitive-Pw",
      tenant_code: "godmin",
    });
    await expect.poll(() => readAuthSession(page)).toMatchObject({
      access: state.access,
      refresh: state.refresh,
    });
    await expect(page).toHaveURL(role === "staff" ? /\/workspace\/mobile(?:\/|$)/ : /\/student(?:\/|$)/);
  });
}

for (const device of [
  { name: "iPhone", viewport: { width: 390, height: 844 } },
  { name: "Galaxy", viewport: { width: 360, height: 800 } },
] as const) {
  test(`${device.name} 휴대폰형 아이디는 하이픈과 전각 숫자를 정규화해 로그인한다`, async ({ page }) => {
    await page.setViewportSize(device.viewport);
    const state = await stubLoginFlow(page, "student");
    await openLogin(page);

    await page.getByTestId("login-username").fill(" ０１０-１２３４-５６７８ ");
    await page.getByTestId("login-password").fill("Case-Sensitive-Pw");
    await page.getByTestId("login-submit").click({ timeout: 30_000 });

    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0]).toEqual({
      username: "01012345678",
      password: "Case-Sensitive-Pw",
      tenant_code: "godmin",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1);
  });
}

test("generation envelope와 active pointer 저장 실패는 기존 세션을 보존한다", async ({ context }) => {
  for (const failedTarget of ["generation", "pointer"] as const) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await stubLoginFlow(page, "student");
    await openLogin(page);
    const previous = {
      access: "previous-access",
      refresh: "previous-refresh",
      generation: `previous-generation-${failedTarget}`,
    };
    await seedAuthSession(page, previous);

    await page.evaluate(({ pointerKey, generationPrefix, target }) => {
      const storage = window["localStorage"];
      const originalSetItem = Storage.prototype.setItem;
      let failed = false;
      Storage.prototype.setItem = function setItem(key: string, value: string) {
        const targeted = target === "pointer"
          ? key === pointerKey
          : key.startsWith(generationPrefix);
        if (this === storage && targeted && !failed) {
          failed = true;
          throw new DOMException("blocked", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    }, {
      pointerKey: AUTH_ACTIVE_GENERATION_KEY,
      generationPrefix: AUTH_GENERATION_PREFIX,
      target: failedTarget,
    });

    await page.getByTestId("login-username").fill("student.id-20");
    await page.getByTestId("login-password").fill("Case-Sensitive-Pw");
    await page.getByTestId("login-submit").click({ timeout: 30_000 });

    await expect(page.getByRole("alert")).toHaveText(STORAGE_ERROR_MESSAGE);
    await expect.poll(() => readAuthSession(page)).toEqual(previous);
    await expect(page).toHaveURL(/\/login\/godmin$/);
    await page.close();
  }
});

test("login storage getter/getItem SecurityError는 typed Safari 안내로 끝난다", async ({ context }) => {
  for (const fault of ["getter", "getItem"] as const) {
    const page = await context.newPage();
    await stubLoginFlow(page, "student");
    await openLogin(page);
    await installStorageReadFault(page, fault);
    await page.getByTestId("login-username").fill("student.id-20");
    await page.getByTestId("login-password").fill("Case-Sensitive-Pw");
    await page.getByTestId("login-submit").click({ timeout: 30_000 });
    await expect(page.getByRole("alert")).toHaveText(STORAGE_ERROR_MESSAGE);
    await restoreStorageFault(page);
    expect(await readAuthSession(page)).toBeNull();
    await expect(page).toHaveURL(/\/login\/godmin$/);
    await page.close();
  }
});

test("login pointer publish 후 검증 SecurityError는 pointer-envelope self-consistency를 보존한다", async ({ page }) => {
  const state = await stubLoginFlow(page, "student");
  await openLogin(page);
  await seedAuthSession(page, {
    access: "previous-access",
    refresh: "previous-refresh",
    generation: "previous-generation",
  });
  await page.evaluate((pointerKey) => {
    const storage = window["localStorage"];
    const originalSetItem = Storage.prototype.setItem;
    const originalGetItem = Storage.prototype.getItem;
    let failVerification = false;
    (window as typeof window & { __restoreAuthStorage?: () => void }).__restoreAuthStorage = () => {
      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.getItem = originalGetItem;
    };
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      const result = originalSetItem.call(this, key, value);
      if (this === storage && key === pointerKey) failVerification = true;
      return result;
    };
    Storage.prototype.getItem = function getItem(key: string) {
      if (this === storage && key === pointerKey && failVerification) {
        failVerification = false;
        throw new DOMException("post-set verification blocked", "SecurityError");
      }
      return originalGetItem.call(this, key);
    };
  }, AUTH_ACTIVE_GENERATION_KEY);

  const result = await page.evaluate(async () => {
    const { login } = await new Function(
      "return import('/src/auth/api/auth.api.ts')",
    )() as { login: (username: string, password: string) => Promise<unknown> };
    return login("student.id-20", "Case-Sensitive-Pw").then(
      () => ({ status: "unexpected-success" }),
      (error: { name?: string; code?: string; message?: string }) => ({
        status: "failed",
        name: error?.name,
        code: error?.code,
        message: error?.message,
      }),
    );
  });

  expect(result).toEqual({
    status: "failed",
    name: "AuthTokenStorageError",
    code: "AUTH_TOKEN_STORAGE_PUBLICATION_UNKNOWN",
    message: STORAGE_ERROR_MESSAGE,
  });
  await restoreStorageFault(page);
  await expect.poll(() => readAuthSession(page)).toMatchObject({
    access: state.access,
    refresh: state.refresh,
  });
});

type LockMode = "supported" | "unsupported";

async function installNavigatorLocksMode(page: Page, mode: LockMode): Promise<void> {
  await page.addInitScript((selectedMode) => {
    let tail = Promise.resolve();
    const value = selectedMode === "supported" ? {
      request: <T>(_name: string, callback: () => T | Promise<T>) => {
        const pending = tail.then(callback, callback);
        tail = pending.then(() => undefined, () => undefined);
        return pending;
      },
    } : undefined;
    Object.defineProperty(navigator, "locks", { configurable: true, value });
  }, mode);
}

async function loginAsAccountB(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await stubLoginFlow(page, "staff");
  await openLogin(page);
  await page.getByTestId("login-username").fill("staff.account-b");
  await page.getByTestId("login-password").fill("Account-B-Pw");
  await page.getByTestId("login-submit").click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/workspace\/mobile(?:\/|$)/);
  return state;
}

for (const lockMode of ["supported", "unsupported"] as const) {
  test(`지연된 A refresh는 B 로그인을 덮지 않는다 (${lockMode})`, async ({ page, context }) => {
    await installNavigatorLocksMode(page, lockMode);
    await page.route("**/api/v1/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    let releaseRefresh!: () => void;
    const refreshRelease = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    let markRefreshRequested!: () => void;
    const refreshRequested = new Promise<void>((resolve) => { markRefreshRequested = resolve; });
    const staleRotatedAccess = createE2eJwt(`stale-a-${lockMode}`);
    await page.route("**/api/v1/token/refresh/", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ refresh: "refresh-a" });
      markRefreshRequested();
      await refreshRelease;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: staleRotatedAccess, refresh: "rotated-refresh-a" }),
      });
    });

    const raceAuthorizations: string[] = [];
    await page.route("**/api/v1/race/", async (route) => {
      raceAuthorizations.push(route.request().headers().authorization || "");
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.goto(`${BASE}/robots.txt`);
    const expiredPayload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }),
    ).toString("base64url");
    await seedAuthSession(page, {
      access: `e30.${expiredPayload}.expired`,
      refresh: "refresh-a",
      generation: `account-a-${lockMode}`,
    });

    const requestResult = page.evaluate(async () => {
      const { default: api } = await new Function(
        "return import('/src/shared/api/axios.ts')",
      )() as { default: { get: (url: string) => Promise<unknown> } };
      return api.get("/race/").then(() => "ok", () => "failed");
    });
    await refreshRequested;

    const accountBPage = await context.newPage();
    const accountB = await loginAsAccountB(accountBPage);
    releaseRefresh();

    await expect(requestResult).resolves.toBe("failed");
    await expect.poll(() => readAuthSession(accountBPage)).toMatchObject({
      access: accountB.access,
      refresh: accountB.refresh,
    });
    expect(raceAuthorizations).toEqual([]);
  });

  test(`A 요청의 지연된 401은 B 세션을 지우지 않는다 (${lockMode})`, async ({ page, context }) => {
    await installNavigatorLocksMode(page, lockMode);
    await page.route("**/api/v1/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    let releaseUnauthorized!: () => void;
    const unauthorizedRelease = new Promise<void>((resolve) => { releaseUnauthorized = resolve; });
    let markRaceRequested!: () => void;
    const raceRequested = new Promise<void>((resolve) => { markRaceRequested = resolve; });
    let refreshCalls = 0;
    await page.route("**/api/v1/token/refresh/", async (route) => {
      refreshCalls += 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    });
    await page.route("**/api/v1/race-401/", async (route) => {
      markRaceRequested();
      await unauthorizedRelease;
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    await page.goto(`${BASE}/robots.txt`);
    const accessA = createE2eJwt(`account-a-${lockMode}`);
    await seedAuthSession(page, {
      access: accessA,
      refresh: "refresh-a",
      generation: `account-a-${lockMode}`,
    });

    const requestResult = page.evaluate(async () => {
      const { default: api } = await new Function(
        "return import('/src/shared/api/axios.ts')",
      )() as { default: { get: (url: string) => Promise<unknown> } };
      return api.get("/race-401/").then(() => "ok", () => "failed");
    });
    await raceRequested;

    const accountBPage = await context.newPage();
    const accountB = await loginAsAccountB(accountBPage);
    releaseUnauthorized();

    await expect(requestResult).resolves.toBe("failed");
    expect(refreshCalls).toBe(0);
    await expect.poll(async () => ({
      session: await readAuthSession(accountBPage),
      expired: await accountBPage.evaluate(() => sessionStorage.getItem("session_expired")),
    })).toMatchObject({
      session: { access: accountB.access, refresh: accountB.refresh },
      expired: null,
    });
  });
}

test("실제 직렬 Web Lock은 A refresh 게시 뒤 B login 새 generation을 순서대로 게시한다", async ({ page }) => {
  await installNavigatorLocksMode(page, "supported");
  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  let releaseRefresh!: () => void;
  const refreshRelease = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  let markRefreshRequested!: () => void;
  const refreshRequested = new Promise<void>((resolve) => { markRefreshRequested = resolve; });
  const rotatedA = createE2eJwt("rotated-account-a");
  await page.route("**/api/v1/token/refresh/", async (route) => {
    markRefreshRequested();
    await refreshRelease;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access: rotatedA, refresh: "rotated-refresh-a" }),
    });
  });

  let markLoginRequested!: () => void;
  const loginRequested = new Promise<void>((resolve) => { markLoginRequested = resolve; });
  const accessB = createE2eJwt("account-b");
  await page.route("**/api/v1/token/", async (route) => {
    markLoginRequested();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access: accessB, refresh: "refresh-b" }),
    });
  });

  let releaseRace!: () => void;
  const raceRelease = new Promise<void>((resolve) => { releaseRace = resolve; });
  const raceAuthorizations: string[] = [];
  await page.route("**/api/v1/serialized-race/", async (route) => {
    raceAuthorizations.push(route.request().headers().authorization || "");
    await raceRelease;
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto(`${BASE}/robots.txt`);
  const expiredPayload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }),
  ).toString("base64url");
  await seedAuthSession(page, {
    access: `e30.${expiredPayload}.expired`,
    refresh: "refresh-a",
    generation: "generation-a",
  });
  await page.evaluate((generationPrefix) => {
    const storage = window["localStorage"];
    const original = Storage.prototype.setItem;
    const writes: StoredAuthSession[] = [];
    (window as typeof window & { __authWrites?: StoredAuthSession[] }).__authWrites = writes;
    Storage.prototype.setItem = function setItem(name: string, value: string) {
      if (this === storage && name.startsWith(generationPrefix)) writes.push(JSON.parse(value));
      return original.call(this, name, value);
    };
  }, AUTH_GENERATION_PREFIX);

  const requestResult = page.evaluate(async () => {
    const { default: api } = await new Function(
      "return import('/src/shared/api/axios.ts')",
    )() as { default: { get: (url: string) => Promise<unknown> } };
    return api.get("/serialized-race/").then(() => "consumed", () => "canceled");
  });
  await refreshRequested;

  const loginResult = page.evaluate(async () => {
    const { login } = await new Function(
      "return import('/src/auth/api/auth.api.ts')",
    )() as { login: (username: string, password: string) => Promise<unknown> };
    await login("staff.account-b", "Account-B-Pw");
  });
  await loginRequested;
  expect(await page.evaluate(() => (
    (window as typeof window & { __authWrites?: StoredAuthSession[] }).__authWrites?.length ?? -1
  ))).toBe(0);

  releaseRefresh();
  await loginResult;
  releaseRace();

  await expect(requestResult).resolves.toBe("canceled");
  const writes = await page.evaluate(() => (
    (window as typeof window & { __authWrites?: StoredAuthSession[] }).__authWrites ?? []
  ));
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual({
    access: rotatedA,
    refresh: "rotated-refresh-a",
    generation: "generation-a",
  });
  expect(writes[1]).toMatchObject({ access: accessB, refresh: "refresh-b" });
  expect(writes[1].generation).not.toBe("generation-a");
  expect(raceAuthorizations).not.toContain(`Bearer ${accessB}`);
});

test("refresh envelope 저장 실패는 세션만료로 축약하지 않고 Safari 안내를 전달한다", async ({ page }) => {
  await installNavigatorLocksMode(page, "supported");
  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/token/refresh/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access: createE2eJwt("rotated-a"), refresh: "rotated-refresh-a" }),
    });
  });
  await openLogin(page);
  const expiredPayload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }),
  ).toString("base64url");
  const previous = {
    access: `e30.${expiredPayload}.expired`,
    refresh: "refresh-a",
    generation: "generation-a",
  };
  await seedAuthSession(page, previous);
  await page.evaluate((generationKey) => {
    const storage = window["localStorage"];
    const original = Storage.prototype.setItem;
    let failed = false;
    (window as typeof window & { __storageError?: string }).__storageError = "";
    window.addEventListener("academy-auth-token-storage-error", (event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      (window as typeof window & { __storageError?: string }).__storageError = detail?.message || "";
    });
    Storage.prototype.setItem = function setItem(name: string, value: string) {
      if (this === storage && name === generationKey && !failed) {
        failed = true;
        throw new DOMException("blocked", "QuotaExceededError");
      }
      return original.call(this, name, value);
    };
  }, `${AUTH_GENERATION_PREFIX}generation-a`);

  const result = await page.evaluate(async () => {
    const { default: api } = await new Function(
      "return import('/src/shared/api/axios.ts')",
    )() as { default: { get: (url: string) => Promise<unknown> } };
    return api.get("/storage-failure/").then(
      () => ({ status: "unexpected-success" }),
      (error: { name?: string; code?: string; message?: string }) => ({
        status: "failed",
        name: error?.name,
        code: error?.code,
        message: error?.message,
      }),
    );
  });

  expect(result).toEqual({
    status: "failed",
    name: "AuthTokenStorageError",
    code: "AUTH_TOKEN_STORAGE_FAILED",
    message: STORAGE_ERROR_MESSAGE,
  });
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __storageError?: string }).__storageError
  ))).toBe(STORAGE_ERROR_MESSAGE);
  await expect.poll(() => readAuthSession(page)).toEqual(previous);
  expect(await page.evaluate(() => sessionStorage.getItem("session_expired"))).toBeNull();
});

test("refresh storage getter/getItem SecurityError도 typed Safari 안내로 끝난다", async ({ context }) => {
  for (const fault of ["getter", "getItem"] as const) {
    const page = await context.newPage();
    await installNavigatorLocksMode(page, "supported");
    await page.route("**/api/v1/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await openLogin(page);
    const expiredPayload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }),
    ).toString("base64url");
    const previous = {
      access: `e30.${expiredPayload}.expired`,
      refresh: "refresh-a",
      generation: `generation-a-${fault}`,
    };
    await seedAuthSession(page, previous);
    await page.evaluate(() => {
      (window as typeof window & { __storageError?: string }).__storageError = "";
      window.addEventListener("academy-auth-token-storage-error", (event) => {
        const detail = (event as CustomEvent<{ message?: string }>).detail;
        (window as typeof window & { __storageError?: string }).__storageError = detail?.message || "";
      });
    });
    await installStorageReadFault(page, fault);

    const result = await page.evaluate(async () => {
      const { default: api } = await new Function(
        "return import('/src/shared/api/axios.ts')",
      )() as { default: { get: (url: string) => Promise<unknown> } };
      return api.get("/refresh-storage-read-failure/").then(
        () => ({ status: "unexpected-success" }),
        (error: { name?: string; code?: string; message?: string }) => ({
          status: "failed",
          name: error?.name,
          code: error?.code,
          message: error?.message,
        }),
      );
    });

    expect(result).toEqual({
      status: "failed",
      name: "AuthTokenStorageError",
      code: "AUTH_TOKEN_STORAGE_FAILED",
      message: STORAGE_ERROR_MESSAGE,
    });
    await expect.poll(() => page.evaluate(() => (
      (window as typeof window & { __storageError?: string }).__storageError
    ))).toBe(STORAGE_ERROR_MESSAGE);
    await restoreStorageFault(page);
    await expect.poll(() => readAuthSession(page)).toEqual(previous);
    expect(await page.evaluate(() => sessionStorage.getItem("session_expired"))).toBeNull();
    await page.close();
  }
});

test("A의 지연 200 응답은 B login 뒤 consumer에 전달되지 않는다", async ({ page, context }) => {
  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  let releaseResponse!: () => void;
  const responseRelease = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let markRequested!: () => void;
  const requested = new Promise<void>((resolve) => { markRequested = resolve; });
  await page.route("**/api/v1/delayed-account-data/", async (route) => {
    markRequested();
    await responseRelease;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ owner: "A" }) });
  });
  await page.goto(`${BASE}/robots.txt`);
  await seedAuthSession(page, {
    access: createE2eJwt("account-a"),
    refresh: "refresh-a",
    generation: "generation-a",
  });
  const requestResult = page.evaluate(async () => {
    const { default: api } = await new Function(
      "return import('/src/shared/api/axios.ts')",
    )() as { default: { get: (url: string) => Promise<{ data: unknown }> } };
    return api.get("/delayed-account-data/").then(
      (response) => {
        (window as typeof window & { __consumedAccountData?: unknown }).__consumedAccountData = response.data;
        return "consumed";
      },
      () => "canceled",
    );
  });
  await requested;
  const accountBPage = await context.newPage();
  await loginAsAccountB(accountBPage);
  releaseResponse();

  await expect(requestResult).resolves.toBe("canceled");
  expect(await page.evaluate(() => (
    (window as typeof window & { __consumedAccountData?: unknown }).__consumedAccountData
  ))).toBeUndefined();
});

test("다른 탭 account switch storage event는 기존 current user를 폐기한다", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubLoginFlow(page, "student");
  await openLogin(page);
  await page.getByTestId("login-username").fill("student.account-a");
  await page.getByTestId("login-password").fill("Account-A-Pw");
  await page.getByTestId("login-submit").click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/student(?:\/|$)/);

  const accountBPage = await context.newPage();
  await loginAsAccountB(accountBPage);
  await expect(page).toHaveURL(/\/login(?:\/|$)/);
});

test("두 page logout은 active envelope removal event로 sibling user/cache를 폐기한다", async ({ page, context }) => {
  await stubLoginFlow(page, "student");
  await openLogin(page);
  await page.getByTestId("login-username").fill("student.account-a");
  await page.getByTestId("login-password").fill("Account-A-Pw");
  await page.getByTestId("login-submit").click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/student(?:\/|$)/);

  const sibling = await context.newPage();
  await stubLoginFlow(sibling, "student");
  await gotoAndSettle(sibling, `${BASE}/student`, { timeout: 30_000 });
  await expect(sibling).toHaveURL(/\/student(?:\/|$)/);

  await page.evaluate(async () => {
    const { logout } = await new Function(
      "return import('/src/auth/api/auth.api.ts')",
    )() as { logout: () => void };
    logout();
  });

  await expect.poll(() => readAuthSession(sibling)).toBeNull();
  await expect(sibling).toHaveURL(/\/login(?:\/|$)/);
  await sibling.close();
});

test("logout active envelope removeItem 실패는 typed 안내 후 redirect하지 않는다", async ({ page }) => {
  await stubLoginFlow(page, "student");
  await openLogin(page);
  await page.getByTestId("login-username").fill("student.account-a");
  await page.getByTestId("login-password").fill("Account-A-Pw");
  await page.getByTestId("login-submit").click({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/student(?:\/|$)/);
  const previous = await readAuthSession(page);
  expect(previous).not.toBeNull();

  await page.evaluate(({ generationPrefix, generation }) => {
    const storage = window["localStorage"];
    const targetKey = `${generationPrefix}${generation}`;
    const original = Storage.prototype.removeItem;
    (window as typeof window & {
      __restoreAuthStorage?: () => void;
      __storageError?: string;
    }).__restoreAuthStorage = () => { Storage.prototype.removeItem = original; };
    (window as typeof window & { __storageError?: string }).__storageError = "";
    window.addEventListener("academy-auth-token-storage-error", (event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      (window as typeof window & { __storageError?: string }).__storageError = detail?.message || "";
    });
    Storage.prototype.removeItem = function removeItem(key: string) {
      if (this === storage && key === targetKey) {
        throw new DOMException("blocked remove", "SecurityError");
      }
      return original.call(this, key);
    };
  }, {
    generationPrefix: AUTH_GENERATION_PREFIX,
    generation: previous?.generation,
  });

  const result = await page.evaluate(async () => {
    const { logout } = await new Function(
      "return import('/src/auth/api/auth.api.ts')",
    )() as { logout: () => void };
    try {
      logout();
      return { status: "unexpected-success" };
    } catch (error) {
      const typed = error as { name?: string; code?: string; message?: string };
      return { status: "failed", name: typed.name, code: typed.code, message: typed.message };
    }
  });

  expect(result).toEqual({
    status: "failed",
    name: "AuthTokenStorageError",
    code: "AUTH_TOKEN_STORAGE_FAILED",
    message: STORAGE_ERROR_MESSAGE,
  });
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __storageError?: string }).__storageError
  ))).toBe(STORAGE_ERROR_MESSAGE);
  await restoreStorageFault(page);
  await expect.poll(() => readAuthSession(page)).toEqual(previous);
  await expect(page).toHaveURL(/\/student(?:\/|$)/);
});

test("Chromium native Web Lock은 두 page의 실제 refresh/login publisher를 직렬화한다", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium native Web Locks regression");
  const secondPage = await context.newPage();
  await Promise.all([
    page.goto(`${BASE}/robots.txt`),
    secondPage.goto(`${BASE}/robots.txt`),
  ]);
  expect(await page.evaluate(() => typeof navigator.locks?.request)).toBe("function");
  const accountA = {
    access: createE2eJwt("native-account-a"),
    refresh: "native-refresh-a",
    generation: "native-generation-a",
  };
  await seedAuthSession(page, accountA);

  const holder = page.evaluate(async () => {
    const tokenSession = await new Function(
      "return import('/src/shared/auth/tokenSession.ts')",
    )() as {
      withAuthSessionLock: <T>(callback: () => Promise<T> | T) => Promise<T>;
      publishRefreshedTokenEnvelope: (
        generation: string,
        expectedRefresh: string,
        access: string,
        refresh: string,
      ) => StoredAuthSession | null;
    };
    await tokenSession.withAuthSessionLock(async () => {
      const published = tokenSession.publishRefreshedTokenEnvelope(
        "native-generation-a",
        "native-refresh-a",
        "native-rotated-access-a",
        "native-rotated-refresh-a",
      );
      (window as typeof window & { __nativeRefreshPublished?: boolean }).__nativeRefreshPublished = Boolean(published);
      await new Promise<void>((resolve) => {
        (window as typeof window & { __releaseNativeLock?: () => void }).__releaseNativeLock = resolve;
      });
    });
  });
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __nativeRefreshPublished?: boolean }).__nativeRefreshPublished
  ))).toBe(true);

  const waiter = secondPage.evaluate(async () => {
    const { publishLoginTokenEnvelope } = await new Function(
      "return import('/src/shared/auth/tokenSession.ts')",
    )() as {
      publishLoginTokenEnvelope: (access: string, refresh: string) => Promise<StoredAuthSession>;
    };
    const published = await publishLoginTokenEnvelope("native-access-b", "native-refresh-b");
    (window as typeof window & { __nativeLoginPublished?: boolean }).__nativeLoginPublished = true;
    return published;
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(await secondPage.evaluate(() => (
    (window as typeof window & { __nativeLoginPublished?: boolean }).__nativeLoginPublished
  ))).not.toBe(true);
  await expect.poll(() => readAuthSession(secondPage)).toEqual({
    access: "native-rotated-access-a",
    refresh: "native-rotated-refresh-a",
    generation: accountA.generation,
  });
  await page.evaluate(() => {
    (window as typeof window & { __releaseNativeLock?: () => void }).__releaseNativeLock?.();
  });
  const [, accountB] = await Promise.all([holder, waiter]);
  expect(accountB.generation).not.toBe(accountA.generation);
  await expect.poll(() => readAuthSession(secondPage)).toEqual(accountB);

  const staleReplay = await page.evaluate(async () => {
    const { publishRefreshedTokenEnvelope } = await new Function(
      "return import('/src/shared/auth/tokenSession.ts')",
    )() as {
      publishRefreshedTokenEnvelope: (
        generation: string,
        expectedRefresh: string,
        access: string,
        refresh: string,
      ) => StoredAuthSession | null;
    };
    return publishRefreshedTokenEnvelope(
      "native-generation-a",
      "native-rotated-refresh-a",
      "native-stale-replay-a",
      "native-stale-refresh-a",
    );
  });
  expect(staleReplay).toBeNull();
  await expect.poll(() => readAuthSession(secondPage)).toEqual(accountB);
  await secondPage.close();
});

test("impersonation 복귀는 backup pair를 fresh generation으로 게시해 이전 응답을 취소한다", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  let releaseResponse!: () => void;
  const responseRelease = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let markRequested!: () => void;
  const requested = new Promise<void>((resolve) => { markRequested = resolve; });
  await page.route("**/api/v1/pre-impersonation-delayed/", async (route) => {
    markRequested();
    await responseRelease;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ owner: "dev-a" }) });
  });
  await page.goto(`${BASE}/robots.txt`);
  const original = {
    access: createE2eJwt("dev-before-impersonation"),
    refresh: "dev-refresh-before-impersonation",
    generation: "dev-generation-before-impersonation",
  };
  await seedAuthSession(page, original);

  const delayedResult = page.evaluate(async () => {
    const { default: api } = await new Function(
      "return import('/src/shared/api/axios.ts')",
    )() as { default: { get: (url: string) => Promise<unknown> } };
    return api.get("/pre-impersonation-delayed/").then(
      () => "consumed",
      (error: { name?: string }) => error?.name || "failed",
    );
  });
  await requested;

  const generations = await page.evaluate(async () => {
    const tokenSession = await new Function(
      "return import('/src/shared/auth/tokenSession.ts')",
    )() as {
      backupAuthSessionForImpersonation: (label: string) => void;
      publishLoginTokenEnvelope: (access: string, refresh: string) => Promise<StoredAuthSession>;
      restoreImpersonationAuthSession: () => Promise<boolean>;
      readAuthTokenEnvelope: () => StoredAuthSession | null;
    };
    tokenSession.backupAuthSessionForImpersonation("dev / owner");
    const impersonated = await tokenSession.publishLoginTokenEnvelope(
      "impersonated-access",
      "impersonated-refresh",
    );
    const restored = await tokenSession.restoreImpersonationAuthSession();
    return {
      impersonatedGeneration: impersonated.generation,
      restored,
      restoredSession: tokenSession.readAuthTokenEnvelope(),
    };
  });

  expect(generations.restored).toBe(true);
  expect(generations.impersonatedGeneration).not.toBe(original.generation);
  expect(generations.restoredSession).toMatchObject({
    access: original.access,
    refresh: original.refresh,
  });
  expect(generations.restoredSession?.generation).not.toBe(original.generation);
  expect(generations.restoredSession?.generation).not.toBe(generations.impersonatedGeneration);

  releaseResponse();
  await expect(delayedResult).resolves.toBe("CanceledError");
  await expect.poll(() => readAuthSession(page)).toEqual(generations.restoredSession);
});

test("no-lock check/write와 check/remove 교차에서도 B generation만 활성이다", async ({ page, context }) => {
  await installNavigatorLocksMode(page, "unsupported");
  await page.goto(`${BASE}/robots.txt`);
  const accountA = {
    access: createE2eJwt("account-a-interleave"),
    refresh: "refresh-a",
    generation: "generation-a-interleave",
  };
  await seedAuthSession(page, accountA);
  const capturedA = await readAuthSession(page);
  expect(capturedA).toEqual(accountA);

  const accountBPage = await context.newPage();
  const accountB = await loginAsAccountB(accountBPage);
  const activeB = await readAuthSession(accountBPage);
  expect(activeB).toMatchObject({ access: accountB.access, refresh: accountB.refresh });

  // Exact no-lock check/write interleave: A checked its generation before B
  // switched, then writes only A's generation-addressed key after the switch.
  await page.evaluate(({ generationPrefix, stale }) => {
    window["localStorage"].setItem(`${generationPrefix}${stale.generation}`, JSON.stringify(stale));
  }, {
    generationPrefix: AUTH_GENERATION_PREFIX,
    stale: { ...accountA, access: createE2eJwt("late-a-write"), refresh: "late-refresh-a" },
  });
  await expect.poll(() => readAuthSession(accountBPage)).toEqual(activeB);

  // Exact check/remove interleave uses the product cleanup API, which removes
  // only A's generation key and never the shared active pointer.
  await page.evaluate(async (generation) => {
    const { clearAuthTokenEnvelope } = await new Function(
      "return import('/src/shared/auth/tokenSession.ts')",
    )() as { clearAuthTokenEnvelope: (value: string) => boolean };
    clearAuthTokenEnvelope(generation);
  }, accountA.generation);
  await expect.poll(() => readAuthSession(accountBPage)).toEqual(activeB);
  await expect(accountBPage).toHaveURL(/\/workspace\/mobile(?:\/|$)/);
});

for (const staleError of ["403", "404", "network"] as const) {
  test(`A 지연 ${staleError}는 interceptor 최상단에서 취소되고 B user/cache를 보존한다`, async ({ page, context }) => {
    await page.route("**/api/v1/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    let releaseError!: () => void;
    const errorRelease = new Promise<void>((resolve) => { releaseError = resolve; });
    let markRequested!: () => void;
    const requested = new Promise<void>((resolve) => { markRequested = resolve; });
    if (staleError !== "network") {
      await page.route(`**/api/v1/stale-${staleError}/`, async (route) => {
        markRequested();
        await errorRelease;
        await route.fulfill({ status: Number(staleError), contentType: "application/json", body: "{}" });
      });
    }
    await page.goto(`${BASE}/robots.txt`);
    await seedAuthSession(page, {
      access: createE2eJwt(`account-a-${staleError}`),
      refresh: "refresh-a",
      generation: `generation-a-${staleError}`,
    });
    const requestResult = page.evaluate(async (kind) => {
      const { default: api } = await new Function(
        "return import('/src/shared/api/axios.ts')",
      )() as {
        default: {
          get: (url: string, config?: Record<string, unknown>) => Promise<unknown>;
        };
      };
      const config = kind === "network"
        ? {
          adapter: (requestConfig: unknown) => new Promise((_resolve, reject) => {
            const networkWindow = window as typeof window & {
              __staleNetworkStarted?: boolean;
              __releaseStaleNetwork?: () => void;
            };
            networkWindow.__staleNetworkStarted = true;
            networkWindow.__releaseStaleNetwork = () => reject({
              isAxiosError: true,
              name: "AxiosError",
              message: "Network Error",
              code: "ERR_NETWORK",
              config: requestConfig,
              toJSON: () => ({}),
            });
          }),
        }
        : undefined;
      return api.get(`/stale-${kind}/`, config).then(
        () => ({ result: "unexpected-success" }),
        (error: { name?: string; code?: string }) => ({
          result: "canceled",
          name: error?.name,
          code: error?.code,
        }),
      );
    }, staleError);
    if (staleError === "network") {
      await expect.poll(() => page.evaluate(() => (
        (window as typeof window & { __staleNetworkStarted?: boolean }).__staleNetworkStarted
      ))).toBe(true);
    } else {
      await requested;
    }

    const accountBPage = await context.newPage();
    const accountB = await loginAsAccountB(accountBPage);
    const activeB = await readAuthSession(accountBPage);
    if (staleError === "network") {
      await page.evaluate(() => {
        (window as typeof window & { __releaseStaleNetwork?: () => void }).__releaseStaleNetwork?.();
      });
    } else {
      releaseError();
    }

    await expect(requestResult).resolves.toMatchObject({ result: "canceled", name: "CanceledError" });
    await expect.poll(() => readAuthSession(accountBPage)).toEqual(activeB);
    await expect(accountBPage).toHaveURL(/\/workspace\/mobile(?:\/|$)/);
    expect(activeB).toMatchObject({ access: accountB.access, refresh: accountB.refresh });
  });
}

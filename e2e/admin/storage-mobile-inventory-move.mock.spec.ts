import { expect, test, type Page, type Route } from "../fixtures/strictTest";

const BASE = (process.env.E2E_BASE_URL || "http://127.0.0.1:5174").replace(/\/+$/, "");

type WorkspaceRole = "owner" | "admin" | "teacher" | "staff" | "student" | "parent";
type MoveReply = "success" | "conflict" | "error";
type MoveBody = {
  scope: "admin" | "student";
  type: "file" | "folder";
  source_id: string;
  target_folder_id: string | null;
  student_ps?: string;
  on_duplicate?: "overwrite" | "rename";
};

type InventoryState = {
  folders: Array<{ id: string; name: string; parentId: string | null }>;
  files: Array<{
    id: string;
    name: string;
    displayName: string;
    description: string;
    icon: string;
    folderId: string | null;
    sizeBytes: number;
    r2Key: string;
    contentType: string;
    createdAt: string;
  }>;
};

type StorageHarness = {
  moveRequests: MoveBody[];
  unexpectedMutations: string[];
  inventoryReads: Array<{ scope: string | null; studentPs: string | null }>;
  setInventoryAvailable: (available: boolean) => void;
};

function isLocalBase(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function fakeJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    exp: now + 3_600,
    tenant_code: "hakwonplus",
    user_id: 41,
  })}.sig`;
}

function createInventory(prefix: string, includeTarget = true): InventoryState {
  return {
    folders: [
      { id: "101", name: `${prefix} 원본 폴더`, parentId: null },
      { id: "102", name: `${prefix} 하위 폴더`, parentId: "101" },
      ...(includeTarget
        ? [{ id: "201", name: `${prefix} 이동 대상`, parentId: null }]
        : []),
    ],
    files: [
      {
        id: "301",
        name: `${prefix}-mobile-file.pdf`,
        displayName: `${prefix} 모바일 파일.pdf`,
        description: "",
        icon: "file",
        folderId: null,
        sizeBytes: 128,
        r2Key: `e2e/${prefix}-mobile-file.pdf`,
        contentType: "application/pdf",
        createdAt: "2026-08-26T00:00:00Z",
      },
    ],
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", json: body });
}

function applyMove(inventory: InventoryState, body: MoveBody) {
  if (body.type === "file") {
    inventory.files = inventory.files.map((file) => (
      file.id === body.source_id
        ? { ...file, folderId: body.target_folder_id }
        : file
    ));
    return;
  }
  inventory.folders = inventory.folders.map((folder) => (
    folder.id === body.source_id
      ? { ...folder, parentId: body.target_folder_id }
      : folder
  ));
}

async function installStorageMocks(
  page: Page,
  options: {
    role?: WorkspaceRole;
    moveReplies?: MoveReply[];
    includeTarget?: boolean;
    inventoryInitiallyAvailable?: boolean;
  } = {},
): Promise<StorageHarness> {
  const role = options.role ?? "owner";
  const moveReplies = [...(options.moveReplies ?? [])];
  const adminInventory = createInventory("관리자", options.includeTarget ?? true);
  const studentInventory = createInventory("학생", options.includeTarget ?? true);
  const moveRequests: MoveBody[] = [];
  const unexpectedMutations: string[] = [];
  const inventoryReads: Array<{ scope: string | null; studentPs: string | null }> = [];
  let inventoryAvailable = options.inventoryInitiallyAvailable ?? true;

  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, fakeJwt());

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path === "/core/program/") {
      return json(route, {
        tenantCode: "hakwonplus",
        display_name: "모바일 이동 학원",
        ui_config: {},
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      const isWorkspaceStaff = ["owner", "admin", "teacher", "staff"].includes(role);
      return json(route, {
        id: 41,
        username: `storage-${role}`,
        name: `저장소 ${role}`,
        phone: null,
        is_staff: isWorkspaceStaff,
        is_superuser: false,
        tenantRole: role,
        linkedStudentId: role === "student" ? 901 : null,
        linkedStudentName: role === "student" ? "학생 사용자" : null,
        must_change_password: false,
      });
    }
    if (path === "/student/me/") {
      return json(route, {
        id: 901,
        username: "storage-student",
        name: "학생 사용자",
        ps_number: "PS-001",
        is_student: true,
        isParentReadOnly: role === "parent",
      });
    }
    if (path === "/staffs/me/") {
      return json(route, {
        is_authenticated: true,
        is_owner: role === "owner",
        is_staff: true,
        staff_id: 41,
        assigned_work_types: [],
      });
    }
    if (path === "/storage/quota/") {
      return json(route, { usedBytes: 1_024, limitBytes: 1_048_576, plan: "all" });
    }
    if (path === "/students/" && method === "GET") {
      return json(route, {
        count: 1,
        page_size: 50,
        results: [{
          id: 901,
          name: "학생 사용자",
          ps_number: "PS-001",
          is_active: true,
        }],
      });
    }
    if (path === "/storage/inventory/" && method === "GET") {
      const scope = url.searchParams.get("scope");
      const studentPs = url.searchParams.get("student_ps");
      inventoryReads.push({ scope, studentPs });
      if (!inventoryAvailable) {
        return json(route, { detail: "temporary_inventory_failure" }, 503);
      }
      return json(route, scope === "student" ? studentInventory : adminInventory);
    }
    if (path === "/storage/inventory/move/" && method === "POST") {
      const body = request.postDataJSON() as MoveBody;
      moveRequests.push(body);
      const reply = moveReplies.shift() ?? "success";
      if (reply === "conflict") {
        return json(route, {
          code: "duplicate",
          existing_name: "같은 이름.pdf",
          detail: "목적지에 같은 이름이 있습니다.",
        }, 409);
      }
      if (reply === "error") {
        return json(route, { detail: "일시적인 이동 실패" }, 503);
      }
      applyMove(body.scope === "student" ? studentInventory : adminInventory, body);
      return json(route, { ok: true });
    }
    if (!["GET", "HEAD"].includes(method)) {
      unexpectedMutations.push(`${method} ${path}`);
      return json(route, { detail: "unexpected mutation" }, 500);
    }
    return json(route, { count: 0, results: [] });
  });

  return {
    moveRequests,
    unexpectedMutations,
    inventoryReads,
    setInventoryAvailable: (available) => { inventoryAvailable = available; },
  };
}

async function expectNoDocumentOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({ body: 0, document: 0 });
}

async function openMoveDialog(page: Page, sourceName: string) {
  const source = page.getByRole("button", { name: sourceName, exact: true });
  await expect(source).toBeVisible();
  await source.focus();
  await source.press("Space");
  await expect(source).toHaveAttribute("aria-pressed", "true");

  const moveButton = page.getByRole("button", { name: "이동", exact: true });
  await expect(moveButton).toBeVisible();
  expect(await moveButton.evaluate((element) => (element as HTMLElement).tabIndex)).toBe(0);
  const box = await moveButton.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await moveButton.focus();
  await moveButton.press("Enter");

  const dialog = page.getByRole("dialog", { name: "저장소 항목 이동" });
  await expect(dialog).toBeVisible();
  return { source, moveButton, dialog };
}

test.skip(!isLocalBase(BASE), "저장소 모바일 이동 route-mock은 로컬 dev 서버 전용");

test.describe("저장소 모바일 파일·폴더 이동", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    serviceWorkers: "block",
  });

  test("390px admin: 목록 실패를 빈 저장소로 바꾸지 않고 성공 재조회 전 변경을 잠근다", async ({ page }) => {
    const harness = await installStorageMocks(page, {
      role: "admin",
      inventoryInitiallyAvailable: false,
    });
    await page.goto(`${BASE}/workspace/storage/files`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const failure = page.getByRole("alert");
    await expect(failure).toContainText("저장소를 불러오지 못했습니다", { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "추가", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "파일 관리자 모바일 파일.pdf 선택" })).toHaveCount(0);
    expect(harness.unexpectedMutations).toEqual([]);

    harness.setInventoryAvailable(true);
    await failure.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByRole("button", { name: "파일 관리자 모바일 파일.pdf 선택" })).toBeVisible();
    await expect(page.getByRole("button", { name: "추가", exact: true })).toBeEnabled();
    expect(harness.inventoryReads.length).toBeGreaterThan(1);
    expect(harness.unexpectedMutations).toEqual([]);
  });

  test("390px admin: 성공 뒤 재조회 실패는 캐시 선택과 트리 변경을 다시 잠근다", async ({ page }) => {
    const harness = await installStorageMocks(page, { role: "admin" });
    await page.goto(`${BASE}/workspace/storage/files`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const source = page.getByRole("button", { name: "파일 관리자 모바일 파일.pdf 선택" });
    await expect(source).toBeVisible({ timeout: 60_000 });
    await source.focus();
    await source.press("Space");
    await expect(page.getByRole("button", { name: "삭제", exact: true })).toBeVisible();
    const recursiveDeleteButtons = page.locator('button[aria-label="하위 포함 삭제"]');
    await expect(recursiveDeleteButtons).toHaveCount(3);

    const readsBeforeFailure = harness.inventoryReads.length;
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    harness.setInventoryAvailable(false);
    await page.waitForTimeout(10_100);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });
    await expect.poll(() => harness.inventoryReads.length).toBeGreaterThan(readsBeforeFailure);

    const failure = page.getByRole("alert");
    await expect(failure).toContainText("저장소를 불러오지 못했습니다");
    await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "이동", exact: true })).toHaveCount(0);
    await expect(recursiveDeleteButtons).toHaveCount(0);
    expect(harness.unexpectedMutations).toEqual([]);

    harness.setInventoryAvailable(true);
    await failure.getByRole("button", { name: "다시 시도" }).click();
    await expect(source).toBeVisible();
    await expect(source).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);
    expect(harness.unexpectedMutations).toEqual([]);
  });

  test("390px teacher: 내 자료 조회 실패 중 폴더·업로드를 잠그고 재시도한다", async ({ page }) => {
    const harness = await installStorageMocks(page, {
      role: "teacher",
      inventoryInitiallyAvailable: false,
    });
    await page.goto(`${BASE}/workspace/mobile/storage`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const failure = page.getByRole("alert");
    await expect(failure).toContainText("자료 저장소를 불러오지 못했습니다", { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "폴더", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "업로드", exact: true })).toBeDisabled();
    expect(harness.unexpectedMutations).toEqual([]);

    harness.setInventoryAvailable(true);
    await failure.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByText("관리자 모바일 파일.pdf", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "폴더", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "업로드", exact: true })).toBeEnabled();
    expect(harness.unexpectedMutations).toEqual([]);
  });

  test("390px teacher: 학생 자료 조회 실패 중 업로드를 숨기고 같은 학생 범위로 재시도한다", async ({ page }) => {
    const harness = await installStorageMocks(page, {
      role: "teacher",
      inventoryInitiallyAvailable: false,
    });
    await page.goto(`${BASE}/workspace/mobile/storage/inventory`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.getByRole("button", { name: /학생 사용자/ }).click();

    const failure = page.getByRole("alert");
    await expect(failure).toContainText("학생 자료를 불러오지 못했습니다", { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "업로드", exact: true })).toHaveCount(0);
    expect(harness.unexpectedMutations).toEqual([]);

    harness.setInventoryAvailable(true);
    await failure.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByText("학생 모바일 파일.pdf", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "업로드", exact: true })).toBeVisible();
    expect(harness.inventoryReads).toContainEqual({ scope: "student", studentPs: "PS-001" });
    expect(harness.unexpectedMutations).toEqual([]);
  });

  test("390px student: 자료함 조회 실패를 빈 상태로 표시하지 않고 재시도 전 변경을 잠근다", async ({ page }) => {
    const harness = await installStorageMocks(page, {
      role: "student",
      inventoryInitiallyAvailable: false,
    });
    await page.goto(`${BASE}/student/inventory`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const failure = page.getByRole("alert");
    await expect(failure).toContainText("자료함을 불러오지 못했습니다", { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "새 폴더", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "파일 업로드", exact: true })).toHaveCount(0);
    expect(harness.unexpectedMutations).toEqual([]);

    harness.setInventoryAvailable(true);
    await failure.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByText("학생 모바일 파일.pdf", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "새 폴더", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "파일 업로드", exact: true })).toBeVisible();
    expect(harness.unexpectedMutations).toEqual([]);
  });

  test("390px owner: 키보드 선택, Escape 포커스 복원, 파일 이동 payload를 보존한다", async ({ page }) => {
    const harness = await installStorageMocks(page, { role: "owner" });
    await page.goto(`${BASE}/workspace/storage/files`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const { moveButton, dialog } = await openMoveDialog(page, "파일 관리자 모바일 파일.pdf 선택");
    const destination = dialog.getByLabel("이동할 폴더");
    await expect(destination.locator('option[value="__storage_root__"]')).toHaveAttribute("disabled", "");
    await destination.selectOption("201");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(moveButton).toBeFocused();
    expect(harness.moveRequests).toEqual([]);

    await moveButton.press("Enter");
    const reopened = page.getByRole("dialog", { name: "저장소 항목 이동" });
    await reopened.getByLabel("이동할 폴더").selectOption("201");
    await reopened.getByRole("button", { name: "이동", exact: true }).click();

    await expect.poll(() => harness.moveRequests).toEqual([{
      scope: "admin",
      type: "file",
      source_id: "301",
      target_folder_id: "201",
    }]);
    await expect(reopened).toHaveCount(0);
    await expect(page.getByRole("button", { name: "파일 관리자 모바일 파일.pdf 선택" })).toHaveCount(0);
    expect(harness.unexpectedMutations).toEqual([]);
    await expectNoDocumentOverflow(page);
  });

  test("390px admin: 다중 선택은 추정하지 않고 폴더 자신·하위를 목적지에서 제외한다", async ({ page }) => {
    const harness = await installStorageMocks(page, { role: "admin" });
    await page.goto(`${BASE}/workspace/storage/files`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const folder = page.getByRole("button", { name: "폴더 관리자 원본 폴더 선택" });
    const file = page.getByRole("button", { name: "파일 관리자 모바일 파일.pdf 선택" });
    await folder.click();
    await file.click({ modifiers: ["Control"] });
    await expect(page.getByText("2개 선택", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "이동", exact: true })).toHaveCount(0);
    expect(harness.moveRequests).toEqual([]);

    await page.getByRole("button", { name: "선택 해제" }).click();
    const { dialog } = await openMoveDialog(page, "폴더 관리자 원본 폴더 선택");
    const destination = dialog.getByLabel("이동할 폴더");
    await expect(destination.locator('option[value="__storage_root__"]')).toHaveAttribute("disabled", "");
    await expect(destination.locator('option[value="101"]')).toHaveAttribute("disabled", "");
    await expect(destination.locator('option[value="102"]')).toHaveAttribute("disabled", "");
    await expect(destination.locator('option[value="201"]')).not.toHaveAttribute("disabled", "");
    await destination.selectOption("201");
    await dialog.getByRole("button", { name: "이동", exact: true }).click();

    await expect.poll(() => harness.moveRequests).toEqual([{
      scope: "admin",
      type: "folder",
      source_id: "101",
      target_folder_id: "201",
    }]);
    expect(harness.unexpectedMutations).toEqual([]);
    await expectNoDocumentOverflow(page);
  });

  test("390px teacher: 학생 파일과 폴더 이동은 정확한 student_ps 범위를 유지한다", async ({ page }) => {
    const harness = await installStorageMocks(page, { role: "teacher" });
    await page.goto(`${BASE}/workspace/storage/students/PS-001`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    let opened = await openMoveDialog(page, "파일 학생 모바일 파일.pdf 선택");
    await opened.dialog.getByLabel("이동할 폴더").selectOption("201");
    await opened.dialog.getByRole("button", { name: "이동", exact: true }).click();
    await expect.poll(() => harness.moveRequests).toHaveLength(1);

    opened = await openMoveDialog(page, "폴더 학생 원본 폴더 선택");
    await opened.dialog.getByLabel("이동할 폴더").selectOption("201");
    await opened.dialog.getByRole("button", { name: "이동", exact: true }).click();

    await expect.poll(() => harness.moveRequests).toEqual([
      {
        scope: "student",
        type: "file",
        source_id: "301",
        target_folder_id: "201",
        student_ps: "PS-001",
      },
      {
        scope: "student",
        type: "folder",
        source_id: "101",
        target_folder_id: "201",
        student_ps: "PS-001",
      },
    ]);
    expect(harness.inventoryReads).toContainEqual({ scope: "student", studentPs: "PS-001" });
    expect(harness.unexpectedMutations).toEqual([]);
    await expectNoDocumentOverflow(page);
  });

  test("390px admin: 409 충돌은 기존 이름 변경 선택으로만 정확히 재시도한다", async ({ page }) => {
    const harness = await installStorageMocks(page, { role: "admin", moveReplies: ["conflict", "success"] });
    await page.goto(`${BASE}/workspace/storage/files`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const { dialog } = await openMoveDialog(page, "파일 관리자 모바일 파일.pdf 선택");
    await dialog.getByLabel("이동할 폴더").selectOption("201");
    await dialog.getByRole("button", { name: "이동", exact: true }).click();

    await expect(page.getByText("이름 충돌", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "이름 변경", exact: true }).click();
    await expect.poll(() => harness.moveRequests).toEqual([
      { scope: "admin", type: "file", source_id: "301", target_folder_id: "201" },
      { scope: "admin", type: "file", source_id: "301", target_folder_id: "201", on_duplicate: "rename" },
    ]);
    expect(harness.unexpectedMutations).toEqual([]);
  });

  test("390px admin: 5xx는 원래 위치를 복구하고 같은 대화상자에서 재시도한다", async ({ page }) => {
    const harness = await installStorageMocks(page, { role: "admin", moveReplies: ["error", "success"] });
    await page.goto(`${BASE}/workspace/storage/files`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const { dialog } = await openMoveDialog(page, "파일 관리자 모바일 파일.pdf 선택");
    await dialog.getByLabel("이동할 폴더").selectOption("201");
    const submit = dialog.getByRole("button", { name: "이동", exact: true });
    await submit.click();

    await expect.poll(() => harness.moveRequests).toHaveLength(1);
    await expect(dialog).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect(page.getByRole("button", { name: "파일 관리자 모바일 파일.pdf 선택" })).toBeAttached();

    await submit.click();
    await expect.poll(() => harness.moveRequests).toHaveLength(2);
    await expect(dialog).toHaveCount(0);
    expect(harness.moveRequests[0]).toEqual(harness.moveRequests[1]);
    expect(harness.unexpectedMutations).toEqual([]);
  });

  test("390px: 이동 가능한 목적지가 없으면 명시 상태와 mutation 0을 유지한다", async ({ page }) => {
    const harness = await installStorageMocks(page, { role: "owner", includeTarget: false });
    await page.goto(`${BASE}/workspace/storage/files`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const { dialog } = await openMoveDialog(page, "폴더 관리자 원본 폴더 선택");
    await expect(dialog.getByText("현재 항목을 옮길 수 있는 다른 폴더가 없습니다.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "이동", exact: true })).toBeDisabled();
    expect(harness.moveRequests).toEqual([]);
  });

  for (const role of ["student", "parent"] as const) {
    test(`390px ${role}: 통합 저장소 권한 밖에서는 조회·이동하지 않는다`, async ({ page }) => {
      const harness = await installStorageMocks(page, { role });
      await page.goto(`${BASE}/workspace/storage/files`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await expect(page).toHaveURL(/\/student(?:\/|$)/);
      expect(harness.inventoryReads).toEqual([]);
      expect(harness.moveRequests).toEqual([]);
      expect(harness.unexpectedMutations).toEqual([]);
    });
  }
});

test.describe("저장소 데스크톱 drag 계약", () => {
  test.use({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });

  test("1366px staff: 기존 draggable과 drag payload를 그대로 유지한다", async ({ page }) => {
    const harness = await installStorageMocks(page, { role: "staff" });
    await page.goto(`${BASE}/workspace/storage/files`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const source = page.getByRole("button", { name: "파일 관리자 모바일 파일.pdf 선택" });
    const target = page.getByRole("button", { name: "폴더 관리자 이동 대상 선택" });
    await expect(source).toHaveAttribute("draggable", "true");
    await expect(target).toHaveAttribute("draggable", "true");
    await source.dragTo(target);

    await expect.poll(() => harness.moveRequests).toEqual([{
      scope: "admin",
      type: "file",
      source_id: "301",
      target_folder_id: "201",
    }]);
    expect(harness.unexpectedMutations).toEqual([]);
    await expectNoDocumentOverflow(page);
  });
});

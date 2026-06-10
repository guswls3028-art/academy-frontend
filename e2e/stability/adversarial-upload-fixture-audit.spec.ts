/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Adversarial fixture audit for user misbehavior and upload edges.
 *
 * Covers duplicate clicks, expired-session save attempts, and attachment names
 * that real users commonly upload. All mutations are constrained to [E2E-*]
 * fixture records and cleaned afterwards.
 */
import { expect, test } from "../fixtures/strictTest";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getApiBaseUrl, getBaseUrl, loginViaUI } from "../helpers/auth";
import { gotoAndSettle, waitForCondition } from "../helpers/wait";

test.setTimeout(240_000);

const API = getApiBaseUrl().replace(/\/+$/, "");
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const CODE = "hakwonplus";
const ADMIN_USER = requiredEnv("E2E_ADMIN_USER");
const ADMIN_PASS = requiredEnv("E2E_ADMIN_PASS");
const TS = Date.now();
const RUN = `[E2E-ADV-${TS}]`;
const ORIGINAL_PW = "test1234";

type Tokens = { access: string; refresh: string };
type StudentRow = { id: number; name: string; ps_number?: string; deleted_at?: string | null };
type PostRow = { id: number; title: string; attachments?: Array<{ id: number; original_name: string }> };

const created = {
  access: "",
  studentIds: new Set<number>(),
  postIds: new Set<number>(),
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Missing required env ${name}. See frontend/.env.e2e.example.`);
}

function headers(token?: string): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    "X-Tenant-Code": CODE,
  };
}

function listFromBody<T>(body: any): T[] {
  if (Array.isArray(body)) return body as T[];
  if (Array.isArray(body?.results)) return body.results as T[];
  return [];
}

function suffix(extra = ""): string {
  return `${String(TS).slice(-8)}${extra}`;
}

function generatedPhone(offset: number): string {
  const n = (Number(String(TS).slice(-8)) + offset) % 100_000_000;
  return `010${String(n).padStart(8, "0")}`;
}

async function loginToken(request: APIRequestContext): Promise<Tokens> {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: CODE },
    headers: headers(),
    timeout: 60_000,
  });
  const body = await resp.json().catch(() => null);
  expect(resp.status(), `admin token -> ${resp.status()} ${JSON.stringify(body)}`).toBe(200);
  created.access = (body as Tokens).access;
  return body as Tokens;
}

async function apiFetch<TBody = any>(
  request: APIRequestContext,
  method: string,
  pathName: string,
  token: string | undefined,
  data?: Record<string, unknown>,
): Promise<{ status: number; body: TBody }> {
  const resp = await request.fetch(`${API}/api/v1${pathName}`, {
    method,
    headers: headers(token),
    ...(data ? { data } : {}),
    timeout: 60_000,
  });
  const text = await resp.text().catch(() => "");
  let body: any = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { status: resp.status(), body: body as TBody };
}

async function expectApi<TBody = any>(
  request: APIRequestContext,
  method: string,
  pathName: string,
  token: string | undefined,
  data?: Record<string, unknown>,
  okStatuses: number[] = [200, 201],
): Promise<TBody> {
  const out = await apiFetch<TBody>(request, method, pathName, token, data);
  expect(okStatuses, `${method} ${pathName} -> ${out.status} ${JSON.stringify(out.body)}`).toContain(out.status);
  return out.body;
}

async function cleanup(request: APIRequestContext): Promise<void> {
  if (!created.access) {
    await loginToken(request).catch(() => undefined);
  }
  if (!created.access) return;

  for (const postId of [...created.postIds]) {
    await apiFetch(request, "DELETE", `/community/posts/${postId}/`, created.access);
    created.postIds.delete(postId);
  }

  const ids = [...created.studentIds].filter((id) => Number.isFinite(id));
  if (ids.length > 0) {
    await apiFetch(request, "POST", "/students/bulk_delete/", created.access, { ids });
    await apiFetch(request, "POST", "/students/bulk_permanent_delete/", created.access, { ids });
    created.studentIds.clear();
  }
}

async function latestDialog(page: Page, text: string): Promise<Locator> {
  const dialog = page.getByRole("dialog").filter({ hasText: text }).last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

async function setFirstSwitch(dialog: Locator, checked: boolean): Promise<void> {
  const sw = dialog.getByRole("switch").first();
  await expect(sw).toBeVisible();
  const current = (await sw.getAttribute("aria-checked")) === "true";
  if (current !== checked) await sw.click();
}

async function fillParentPhone(dialog: Locator, phone: string): Promise<void> {
  await dialog.getByLabel("학부모 전화 앞 4자리").fill(phone.slice(3, 7));
  await dialog.getByLabel("학부모 전화 뒤 4자리").fill(phone.slice(7));
}

async function findStudentsByMarker(
  request: APIRequestContext,
  token: string,
  marker: string,
  deleted = false,
): Promise<StudentRow[]> {
  const params = new URLSearchParams({
    search: marker,
    page_size: "50",
    ordering: "-id",
  });
  if (deleted) params.set("deleted", "true");
  const body = await expectApi<any>(request, "GET", `/students/?${params.toString()}`, token);
  return listFromBody<StudentRow>(body).filter((row) => row.name.includes(marker) || row.ps_number?.includes(marker));
}

async function createStudentApi(
  request: APIRequestContext,
  token: string,
  name: string,
  username: string,
): Promise<StudentRow> {
  const student = await expectApi<StudentRow>(request, "POST", "/students/", token, {
    name,
    parent_phone: generatedPhone(301),
    ps_number: username,
    no_phone: true,
    school_type: "HIGH",
    high_school: "E2E고",
    grade: 1,
    gender: "M",
    initial_password: ORIGINAL_PW,
    send_welcome_message: false,
    memo: `${RUN} adversarial fixture`,
  });
  created.studentIds.add(Number(student.id));
  return student;
}

async function findMaterialPost(
  request: APIRequestContext,
  token: string,
  title: string,
): Promise<PostRow | undefined> {
  const params = new URLSearchParams({
    post_type: "materials",
    q: title,
    page_size: "20",
  });
  const body = await expectApi<any>(request, "GET", `/community/admin/posts/?${params.toString()}`, token);
  return listFromBody<PostRow>(body).find((post) => post.title === title);
}

async function createUploadFixtures(outputDir: string): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const koreanText = path.join(outputDir, `한글 공백 자료 ${suffix()}.txt`);
  const pdf = path.join(outputDir, `edge-large-${suffix()}.pdf`);
  await fs.writeFile(koreanText, `${RUN} 한글 파일명/공백 업로드 검증\n`, "utf8");
  const pdfBytes = Buffer.concat([
    Buffer.from(`%PDF-1.4\n% ${RUN} edge pdf\n1 0 obj << /Type /Catalog >> endobj\n`, "utf8"),
    Buffer.alloc(1024 * 1024, "a"),
    Buffer.from("\n%%EOF\n", "utf8"),
  ]);
  await fs.writeFile(pdf, pdfBytes);
  return [koreanText, pdf];
}

async function confirmAction(page: Page, confirmText: string): Promise<void> {
  const dialog = page.locator("[data-confirm-dialog]").last();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("button", { name: confirmText, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

async function gotoStudentsHome(page: Page): Promise<void> {
  await gotoAndSettle(page, `${BASE}/admin/students/home`, { timeout: 45_000 });
  await expect(page.locator("[data-guide='students-search']")).toBeVisible({ timeout: 45_000 });
}

async function gotoMaterialsBoard(page: Page): Promise<void> {
  await gotoAndSettle(page, `${BASE}/admin/community/materials`, { timeout: 45_000 });
  await expect(page.getByRole("button", { name: "+ 자료 등록", exact: true })).toBeVisible({ timeout: 45_000 });
}

function materialDetailBody(page: Page): Locator {
  return page.locator(".cms-detail__body").last();
}

function materialFileAddButton(page: Page): Locator {
  return materialDetailBody(page).getByRole("button", { name: "+ 파일 추가", exact: true });
}

async function openMaterialPost(page: Page, title: string): Promise<void> {
  await gotoMaterialsBoard(page);
  await page.getByLabel("자료실 검색").fill(title);
  const rowTitle = page.getByText(title, { exact: true }).first();
  await expect(rowTitle).toBeVisible({ timeout: 20_000 });
  await rowTitle.click();
  await expect(materialFileAddButton(page)).toBeVisible({ timeout: 20_000 });
}

async function visiblePageTextIncludes(page: Page, text: string): Promise<boolean> {
  const bodyText = await materialDetailBody(page).innerText({ timeout: 5_000 }).catch(() => "");
  return bodyText.includes(text);
}

test.describe.serial("[E2E] 이상행동/업로드 edge fixture 감사", () => {
  test.afterEach(async ({ request }) => {
    await cleanup(request);
  });

  test("학생 등록 저장 버튼을 빠르게 중복 클릭해도 fixture 학생은 1명만 생성된다", async ({ page, request }) => {
    const token = (await loginToken(request)).access;
    const marker = `${RUN} 중복클릭`;
    const username = `e2eadv${suffix("d")}`;

    await loginViaUI(page, "admin", { landingPath: "/admin/students/home" });
    await gotoStudentsHome(page);
    await page.getByRole("button", { name: "학생 추가", exact: true }).click({ timeout: 45_000 });
    const dialog = await latestDialog(page, "학생 등록");
    await dialog.getByText("1명만 등록", { exact: true }).click();
    await setFirstSwitch(dialog, false);
    await dialog.getByPlaceholder("이름").fill(marker);
    await dialog.getByPlaceholder("로그인 아이디").fill(username);
    await dialog.getByPlaceholder("초기 비밀번호").fill(ORIGINAL_PW);
    await fillParentPhone(dialog, generatedPhone(201));
    await dialog.getByRole("button", { name: "남자" }).click();
    await dialog.locator("select").nth(1).selectOption("1");
    await dialog.getByPlaceholder("메모").fill(`${RUN} duplicate-click guard`);
    await dialog.getByRole("button", { name: "등록", exact: true }).dblclick();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    let rows: StudentRow[] = [];
    await waitForCondition(
      async () => {
        rows = await findStudentsByMarker(request, token, marker);
        rows.forEach((row) => created.studentIds.add(Number(row.id)));
        return rows.length > 0;
      },
      { timeoutMs: 30_000, intervalMs: 1000, description: "duplicate-click student creation reflected" },
    );

    expect(rows.map((row) => row.ps_number).filter((id) => id === username)).toHaveLength(1);
    expect(rows.filter((row) => row.name === marker)).toHaveLength(1);
  });

  test("세션 만료 상태에서 저장을 눌러도 학생 수정이 적용되지 않고 로그인으로 회수된다", async ({ page, request }) => {
    const token = (await loginToken(request)).access;
    const originalName = `${RUN} 세션만료`;
    const attemptedName = `${RUN} 세션만료 저장시도`;
    const student = await createStudentApi(request, token, originalName, `e2eadv${suffix("x")}`);

    await loginViaUI(page, "admin", { landingPath: `/admin/students/${student.id}` });
    await page.getByRole("button", { name: "수정", exact: true }).click();
    const dialog = await latestDialog(page, "학생 수정");
    await dialog.getByPlaceholder("이름").fill(attemptedName);
    await page.evaluate(() => {
      localStorage.setItem("access", "expired.invalid.token");
      localStorage.removeItem("refresh");
    });
    await dialog.getByRole("button", { name: "저장", exact: true }).click();

    await expect
      .poll(
        async () => {
          const url = page.url();
          const loginVisible = await page.getByRole("button", { name: /로그인/ }).isVisible().catch(() => false);
          return /\/login/.test(url) || loginVisible;
        },
        { timeout: 20_000, intervals: [500, 1000, 2000] },
      )
      .toBe(true);

    const detail = await expectApi<StudentRow>(request, "GET", `/students/${student.id}/`, token);
    expect(detail.name).toBe(originalName);
  });

  test("자료실은 한글 파일명과 큰 PDF 첨부를 업로드·삭제할 수 있다", async ({ page, request }, testInfo) => {
    const token = (await loginToken(request)).access;
    const title = `${RUN} 업로드 edge`;
    const files = await createUploadFixtures(testInfo.outputDir);
    const fileNames = files.map((file) => path.basename(file));

    await loginViaUI(page, "admin", { landingPath: "/admin/community/materials" });
    await gotoMaterialsBoard(page);
    await page.getByRole("button", { name: "+ 자료 등록", exact: true }).click({ timeout: 45_000 });
    await page.getByPlaceholder("자료 제목을 입력하세요").fill(title);
    await page.getByRole("button", { name: "등록", exact: true }).click();

    let post: PostRow | undefined;
    await waitForCondition(
      async () => {
        post = await findMaterialPost(request, token, title);
        return !!post;
      },
      { timeoutMs: 45_000, intervalMs: 1500, description: "material edge post created" },
    );
    created.postIds.add((post as PostRow).id);

    await openMaterialPost(page, title);

    for (const file of files) {
      const uploadChooser = page.waitForEvent("filechooser");
      await materialFileAddButton(page).click();
      await (await uploadChooser).setFiles(file);
    }

    await waitForCondition(
      async () => {
        const detail = await expectApi<PostRow>(request, "GET", `/community/posts/${(post as PostRow).id}/`, token);
        const uploaded = new Set((detail.attachments ?? []).map((att) => att.original_name));
        return fileNames.every((name) => uploaded.has(name));
      },
      { timeoutMs: 60_000, intervalMs: 1500, description: "edge attachments uploaded" },
    );

    await openMaterialPost(page, title);
    for (const fileName of fileNames) {
      await expect
        .poll(() => visiblePageTextIncludes(page, fileName), {
          timeout: 20_000,
          intervals: [500, 1000, 2000],
          message: `attachment ${fileName} is visible in material detail`,
        })
        .toBe(true);
    }

    for (;;) {
      const detail = await expectApi<PostRow>(request, "GET", `/community/posts/${(post as PostRow).id}/`, token);
      const [target] = detail.attachments ?? [];
      if (!target) break;

      await expect
        .poll(() => visiblePageTextIncludes(page, target.original_name), {
          timeout: 20_000,
          intervals: [500, 1000, 2000],
          message: `attachment ${target.original_name} is visible before delete`,
        })
        .toBe(true);
      const removeButton = materialDetailBody(page)
        .locator(".cms-attach__inline-item")
        .filter({ hasText: target.original_name })
        .locator(".cms-attach__item-remove:not([disabled])")
        .first();
      await expect(removeButton).toBeVisible({ timeout: 20_000 });
      await removeButton.scrollIntoViewIfNeeded();
      const deleteResponse = page.waitForResponse(
        (resp) =>
          resp.request().method() === "DELETE" &&
          resp.url().includes(`/community/posts/${(post as PostRow).id}/attachments/${target.id}/`),
        { timeout: 30_000 },
      ).catch(() => undefined);
      await removeButton.click();
      await confirmAction(page, "삭제");
      const response = await deleteResponse;
      if (response) expect(response.status()).toBe(204);
      await waitForCondition(
        async () => {
          const nextDetail = await expectApi<PostRow>(request, "GET", `/community/posts/${(post as PostRow).id}/`, token);
          return !(nextDetail.attachments ?? []).some((att) => att.id === target.id);
        },
        { timeoutMs: 30_000, intervalMs: 1000, description: "edge attachment id deleted" },
      );
    }
    await waitForCondition(
      async () => {
        const detail = await expectApi<PostRow>(request, "GET", `/community/posts/${(post as PostRow).id}/`, token);
        return (detail.attachments ?? []).length === 0;
      },
      { timeoutMs: 30_000, intervalMs: 1000, description: "edge attachments deleted" },
    );

    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await confirmAction(page, "삭제");
    await waitForCondition(
      async () => {
        const out = await apiFetch(request, "GET", `/community/posts/${(post as PostRow).id}/`, token);
        return out.status === 404;
      },
      { timeoutMs: 30_000, intervalMs: 1000, description: "edge material post deleted" },
    );
    created.postIds.delete((post as PostRow).id);
  });
});

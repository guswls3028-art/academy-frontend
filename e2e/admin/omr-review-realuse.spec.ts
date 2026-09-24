/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OMR 업로드/검토/재채점 실사용 canary.
 *
 * production-shaped development API로 격리 강의/차시/학생/혼합형 시험/OMR PDF를
 * 만들고, 실제 업로드·AI worker·검토·서술형 수기 채점·재접속을 통과한 뒤
 * 학생/관리자 projection까지 확인한다.
 */
import { test, expect } from "../fixtures/strictTest";
import type { APIRequestContext, Page, Response } from "@playwright/test";
import { PDFDocument, rgb } from "pdf-lib";
import { getApiBaseUrl, getBaseUrl, loginTokenViaRequest } from "../helpers/auth";
import { gotoAndSettle, waitForRenderSettled } from "../helpers/wait";
import { emitOmrCleanupStatus, safeLectureSessionDeleteBlocker } from "../helpers/releaseApiBoundary";
import { installQaStudentParentBoundary } from "../helpers/qaStudentParentScenario";

test.setTimeout(600_000);

const API = getApiBaseUrl().replace(/\/+$/, "");
const BASE = getBaseUrl("admin").replace(/\/+$/, "");
const CODE = process.env.E2E_TENANT_CODE?.trim() || "";
const ADMIN_USER = process.env.E2E_ADMIN_USER?.trim() || "";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS?.trim() || "";
const STUDENT_PASS = process.env.E2E_STUDENT_PASS?.trim() || "";
const TS = Date.now();
const TODAY_KST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

const LECTURE_TITLE = `[E2E-${TS}] OMR실사용`;
const SESSION_TITLE = `[E2E-${TS}] OMR 1차시`;
// The tenant is disposable; use a normal title so analytics do not exclude the
// fixture as an E2E-tagged exam and accidentally make pending-score checks vacuous.
const EXAM_TITLE = `OMR 혼합형 실사용 검증 ${TS}`;
const STUDENT_NAME = `[E2E-${TS}] OMR학생`;
const STUDENT_USER = `e2eomr${String(TS).slice(-8)}`;
const CONTROLLED_PHONE = `010${String(TS).slice(-8)}`;
const EXPECTED_ANSWERS = Array.from({ length: 30 }, (_, index) => String((index % 5) + 1));
const EXPECTED_OBJECTIVE_SCORE = 30;
const EXPECTED_WRITTEN_SCORES = [8, 9] as const;
const EXPECTED_SCORE = EXPECTED_OBJECTIVE_SCORE
  + EXPECTED_WRITTEN_SCORES.reduce((sum, score) => sum + score, 0);

function requireIsolatedScenario(): void {
  if (!/^qa-ymath-realuse-[a-z0-9-]+$/.test(CODE)) {
    throw new Error("OMR real-use requires an exact disposable qa-ymath-realuse-* tenant");
  }
  if (!STUDENT_PASS) {
    throw new Error("OMR real-use requires E2E_STUDENT_PASS from the isolated development scenario");
  }
  if (!ADMIN_USER || !ADMIN_PASS) {
    throw new Error("OMR real-use requires the configured isolated development admin credentials");
  }
}

type Tokens = { access: string; refresh: string };
type RealUseRole = "admin" | "staff" | "student" | "parent";
type BrowserAccountExpectation = {
  role: RealUseRole;
  username: string;
  password: string;
};
type CurrentUser = {
  tenantRole?: string | null;
  must_change_password?: boolean;
  first_login_guide_required?: boolean;
};

type CreatedState = {
  adminAccess?: string;
  lectureId?: number;
  sessionId?: number;
  examId?: number;
  studentId?: number;
  enrollmentId?: number;
  sessionEnrollmentIds: number[];
  submissionIds: number[];
  scoreEditorClientIds: Set<string>;
  staffId?: number;
  staffAccess?: string;
  staffScoreEditorClientIds: Set<string>;
};

const created: CreatedState = { sessionEnrollmentIds: [], submissionIds: [], scoreEditorClientIds: new Set(), staffScoreEditorClientIds: new Set() };

function headers(token: string, contentType = "application/json"): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": contentType,
    "X-Tenant-Code": CODE,
  };
}

async function loginToken(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<Tokens> {
  const resp = await request.post(`${API}/api/v1/token/`, {
    data: { username, password, tenant_code: CODE },
    headers: { "Content-Type": "application/json", "X-Tenant-Code": CODE },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(200);
  return await resp.json() as Tokens;
}

async function apiFetch<TBody = any>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string,
  data?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; body: TBody }> {
  const resp = await request.fetch(`${API}/api/v1${path}`, {
    method,
    headers: { ...headers(token), ...extraHeaders },
    ...(data ? { data } : {}),
    timeout: 90_000,
  });
  let body: any = null;
  try { body = await resp.json(); } catch { body = null; }
  return { status: resp.status(), body };
}

async function expectApi<TBody = any>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string,
  data?: Record<string, unknown>,
  okStatuses: number[] = [200, 201],
): Promise<TBody> {
  const out = await apiFetch<TBody>(request, method, path, token, data);
  expect(
    okStatuses,
    `${method} ${path} -> ${out.status} ${JSON.stringify(out.body)}`,
  ).toContain(out.status);
  return out.body;
}

async function expectParentApi<TBody = any>(
  request: APIRequestContext,
  path: string,
  token: string,
  studentId: number,
): Promise<TBody> {
  const response = await request.get(`${API}/api/v1${path}`, {
    headers: {
      ...headers(token),
      "X-Student-Id": String(studentId),
    },
    timeout: 90_000,
  });
  let body: any = null;
  try { body = await response.json(); } catch { body = null; }
  expect(
    response.status(),
    `GET ${path} as parent -> ${response.status()} ${JSON.stringify(body)}`,
  ).toBe(200);
  return body as TBody;
}

function matchesApiResponse(response: Response, method: string, pathname: string): boolean {
  return response.request().method() === method
    && new URL(response.url()).pathname === `/api/v1${pathname}`;
}

async function readCurrentUserResponse(response: Response): Promise<CurrentUser> {
  expect(response.status(), `GET /core/me/ -> ${response.status()}`).toBe(200);
  return await response.json() as CurrentUser;
}

async function completeInitialAccountPrompts(
  page: Page,
  currentUser: CurrentUser,
  expected: BrowserAccountExpectation,
): Promise<void> {
  expect(currentUser.tenantRole).toBe(expected.role);
  expect(typeof currentUser.must_change_password).toBe("boolean");
  expect(typeof currentUser.first_login_guide_required).toBe("boolean");

  const passwordDialog = page.getByRole("dialog", { name: "비밀번호 변경 권장" });
  const passwordRecommendationRequired = Boolean(
    currentUser.must_change_password
      && (expected.role === "student" || expected.role === "parent"),
  );
  if (passwordRecommendationRequired) {
    await expect(passwordDialog).toBeVisible({ timeout: 10_000 });
    await expect(passwordDialog).toContainText("나중에 변경해도 계속 이용할 수 있습니다");
    await passwordDialog
      .getByRole("button", { name: "위험을 이해했고 나중에", exact: true })
      .click();
    await expect(passwordDialog).toBeHidden();
  } else {
    await expect(passwordDialog).toBeHidden();
  }

  const firstLoginDialog = page.getByRole("dialog", { name: "계정 안내" });
  if (!currentUser.first_login_guide_required) {
    await expect(firstLoginDialog).toBeHidden();
    return;
  }

  await expect(firstLoginDialog).toBeVisible({ timeout: 10_000 });
  const completionResponsePromise = page.waitForResponse(
    (response) => matchesApiResponse(response, "POST", "/core/me/first-login-guide/complete/"),
    { timeout: 30_000 },
  );
  await firstLoginDialog.getByRole("button", { name: "확인", exact: true }).click();
  const completionResponse = await completionResponsePromise;
  expect(
    completionResponse.status(),
    `POST /core/me/first-login-guide/complete/ -> ${completionResponse.status()}`,
  ).toBe(200);
  const completionBody = await completionResponse.json() as CurrentUser;
  expect(completionBody.first_login_guide_required).toBe(false);
  await expect(firstLoginDialog).toBeHidden();
}

async function loginBrowserAsRealUser(
  page: Page,
  landingPath: string,
  expected: BrowserAccountExpectation,
): Promise<void> {
  const hostname = new URL(BASE).hostname.trim().toLowerCase();
  const requiresTenantPath = hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname.endsWith(".pages.dev")
    || hostname.endsWith(".trycloudflare.com");
  const loginPath = requiresTenantPath ? `/login/${encodeURIComponent(CODE)}` : "/login";

  await gotoAndSettle(page, `${BASE}${loginPath}`, { timeout: 45_000 });
  const previousGeneration = await page.evaluate(() => (
    localStorage.getItem("academy:auth-active-generation:v1")
  ));
  const loginForm = page.getByRole("form", { name: "로그인 폼" });
  await expect(loginForm).toBeVisible();
  await page.getByTestId("login-username").fill(expected.username);
  await page.getByTestId("login-password").fill(expected.password);
  const loginResponsePromise = page.waitForResponse(
    (response) => matchesApiResponse(response, "POST", "/token/"),
    { timeout: 30_000 },
  );
  const currentUserResponsePromise = page.waitForResponse(
    (response) => matchesApiResponse(response, "GET", "/core/me/") && response.status() === 200,
    { timeout: 30_000 },
  );
  await page.getByTestId("login-submit").click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status(), `POST /token/ -> ${loginResponse.status()}`).toBe(200);
  const currentUser = await readCurrentUserResponse(await currentUserResponsePromise);
  expect(currentUser.tenantRole).toBe(expected.role);

  const activeSession = await page.evaluate(() => {
    const generation = localStorage.getItem("academy:auth-active-generation:v1");
    const raw = generation
      ? localStorage.getItem(`academy:auth-tokens:v1:${generation}`)
      : null;
    let envelope: { access?: unknown; refresh?: unknown; generation?: unknown } | null = null;
    try { envelope = raw ? JSON.parse(raw) : null; } catch { envelope = null; }
    return {
      generation,
      envelopeGeneration: envelope?.generation ?? null,
      hasAccess: typeof envelope?.access === "string" && envelope.access.length > 0,
      hasRefresh: typeof envelope?.refresh === "string" && envelope.refresh.length > 0,
      hasLegacyAccess: localStorage.getItem("access") !== null,
      hasLegacyRefresh: localStorage.getItem("refresh") !== null,
    };
  });
  expect(activeSession.generation).toBeTruthy();
  expect(activeSession.envelopeGeneration).toBe(activeSession.generation);
  expect(activeSession.hasAccess).toBe(true);
  expect(activeSession.hasRefresh).toBe(true);
  expect(activeSession.hasLegacyAccess).toBe(false);
  expect(activeSession.hasLegacyRefresh).toBe(false);
  if (previousGeneration) expect(activeSession.generation).not.toBe(previousGeneration);

  if (expected.role === "staff") {
    // LoginPage sets the staff prompt and navigates after /core/me/ resolves.
    // Complete that navigation before opening another document.
    await expect(page).toHaveURL(/\/workspace(?:\/|$)/, { timeout: 45_000 });
    await completeInitialAccountPrompts(page, currentUser, expected);
    const clockInChoice = page.getByRole("dialog", {
      name: "오늘 어떤 방식으로 시작할까요?", exact: true,
    });
    await expect(clockInChoice).toBeVisible();
    await clockInChoice.getByRole("button", { name: /^출근하지 않고 로그인/ }).click();
    await expect(clockInChoice).toBeHidden();
  }

  await gotoAndSettle(page, `${BASE}${landingPath}`, { timeout: 45_000 });
  if (expected.role !== "staff") await completeInitialAccountPrompts(page, currentUser, expected);

  const reloadedMeResponsePromise = page.waitForResponse(
    (response) => matchesApiResponse(response, "GET", "/core/me/") && response.status() === 200,
    { timeout: 30_000 },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const reloadedUser = await readCurrentUserResponse(await reloadedMeResponsePromise);
  expect(reloadedUser.tenantRole).toBe(expected.role);
  expect(reloadedUser.first_login_guide_required).toBe(false);
  await expect(page.getByRole("dialog", { name: "비밀번호 변경 권장" })).toBeHidden();
  await expect(page.getByRole("dialog", { name: "계정 안내" })).toBeHidden();
  if (expected.role === "staff") {
    await expect(page).toHaveURL(`${BASE}${landingPath}`);
    await expect(page.getByRole("dialog", { name: "오늘 어떤 방식으로 시작할까요?", exact: true })).toBeHidden();
  }
  expect(await page.evaluate(() => (
    localStorage.getItem("academy:auth-active-generation:v1")
  ))).toBe(activeSession.generation);
}

async function chooseExamHeaderAction(
  page: Page,
  action: "문항별 점수 입력" | "OMR 검토",
): Promise<void> {
  const trigger = page.getByRole("button", { name: `${EXAM_TITLE} 작업 선택` });
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();
  const menu = page.getByRole("menu", { name: `${EXAM_TITLE} 작업 선택` });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: new RegExp(`^${action}`) }).click();
}

async function downloadOmrPdf(
  request: APIRequestContext,
  token: string,
  examId: number,
): Promise<Buffer> {
  const resp = await request.post(`${API}/api/v1/exams/${examId}/omr/pdf/`, {
    data: {
      exam_title: EXAM_TITLE,
      lecture_name: LECTURE_TITLE,
      session_name: SESSION_TITLE,
      include_written_score_bubbles: false,
    },
    headers: headers(token),
    timeout: 180_000,
  });
  expect(resp.status(), `OMR PDF generation -> ${resp.status()} ${await resp.text().catch(() => "")}`).toBe(200);
  return await resp.body();
}

async function markThirtyQuestionOmrPdf(
  pdfBuffer: Buffer,
  answers: string[],
  identifier: string,
): Promise<Buffer> {
  expect(answers).toHaveLength(30);
  expect(identifier).toMatch(/^\d{8}$/);

  const pdf = await PDFDocument.load(pdfBuffer);
  const page = pdf.getPages()[0];
  const { width, height } = page.getSize();
  const scaleX = width / 297;
  const scaleY = height / 210;
  const black = rgb(0, 0, 0);
  const choiceXs = [
    [88.13, 94.57, 101.0, 107.43, 113.87],
    [134.63, 141.07, 147.5, 153.93, 160.37],
  ];
  const identifierXs = [18.95, 24.75, 30.55, 36.35, 45.65, 51.45, 57.25, 63.05];

  const fillBubble = (xMm: number, yMm: number) => {
    page.drawEllipse({
      x: xMm * scaleX,
      y: height - yMm * scaleY,
      xScale: 1.8 * scaleX,
      yScale: 2.6 * scaleY,
      color: black,
      borderColor: black,
    });
  };

  answers.forEach((answer, index) => {
    const column = Math.floor(index / 15);
    const row = index % 15;
    fillBubble(choiceXs[column][Number(answer) - 1], 20.75 + row * 12.5);
  });
  [...identifier].forEach((digit, index) => {
    fillBubble(identifierXs[index], 109.6 + Number(digit) * 6.4);
  });

  return Buffer.from(await pdf.save());
}

async function waitForOmrAnswers(
  request: APIRequestContext,
  token: string,
  submissionId: number,
  expectedCount: number,
): Promise<any> {
  const deadline = Date.now() + 240_000;
  let latest: { status: number; body: any } | null = null;

  while (Date.now() < deadline) {
    latest = await apiFetch(request, "GET", `/submissions/submissions/${submissionId}/manual-edit/`, token);
    if (
      latest.status === 200 &&
      Array.isArray(latest.body?.answers) &&
      latest.body.answers.length >= expectedCount
    ) {
      return latest.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error(
    `OMR worker did not persist ${expectedCount} answers for submission ${submissionId}. ` +
    `latest=${JSON.stringify(latest?.body ?? null).slice(0, 1200)}`,
  );
}

async function waitForStudentResult(
  request: APIRequestContext,
  studentToken: string,
  examId: number,
): Promise<any> {
  const deadline = Date.now() + 60_000;
  let latest: { status: number; body: any } | null = null;
  while (Date.now() < deadline) {
    latest = await apiFetch(request, "GET", `/student/results/me/exams/${examId}/`, studentToken);
    if (latest.status === 200) return latest.body;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`student result not visible: ${JSON.stringify(latest?.body ?? null)}`);
}

async function verifyChangedAnswerAndMaximum(
  page: Page,
  request: APIRequestContext,
  studentToken: string,
  parentToken: string,
): Promise<void> {
  const setupPath = `/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/exams?assessment=exam%3A${created.examId}`;
  for (const changed of [true, false]) {
    const maximum = changed ? 60 : 50;
    const expected = changed ? EXPECTED_SCORE - 1 : EXPECTED_SCORE;
    await page.setViewportSize({ width: changed ? 1366 : 390, height: 900 });
    await loginBrowserAsRealUser(page, setupPath, { role: "admin", username: ADMIN_USER, password: ADMIN_PASS });
    await page.locator("#assessment-policy > details > summary").click();
    await page.getByRole("spinbutton", { name: "만점", exact: true }).fill(String(maximum));
    const policySaved = page.waitForResponse((response) => matchesApiResponse(response, "PATCH", `/exams/${created.examId}/`));
    await page.getByRole("button", { name: "운영 설정 저장", exact: true }).click();
    expect((await policySaved).status()).toBe(200);
    await page.getByRole("button", { name: "문항·답안 확인", exact: true }).click();
    const answerDialog = page.getByRole("dialog").filter({ has: page.getByRole("tab", { name: "답안 등록", exact: true }) });
    const firstRow = answerDialog.locator(".answer-key-row--choice").first();
    for (const choice of ["1", "2"]) {
      const checkbox = firstRow.getByRole("checkbox", { name: `1번 ${choice}번 선택지`, exact: true });
      const selected = choice === (changed ? "2" : "1");
      if (await checkbox.isChecked() !== selected) {
        await firstRow.locator(".answer-key-omr-label").nth(Number(choice) - 1).click();
      }
      if (selected) await expect(checkbox).toBeChecked();
      else await expect(checkbox).not.toBeChecked();
    }
    if (changed) {
      await firstRow.getByRole("button", { name: "+5", exact: true }).click();
      await firstRow.getByRole("button", { name: "+5", exact: true }).click();
    } else {
      await firstRow.getByRole("button", { name: "점수 초기화", exact: true }).click();
      await firstRow.getByRole("button", { name: "+1", exact: true }).click();
    }
    await expect(firstRow.locator(".answer-key-row__score-val")).toHaveText(`${changed ? 11 : 1}점`);
    const answerSaved = page.waitForResponse((response) => (
      response.request().method() === "PUT" && /\/api\/v1\/exams\/answer-keys\/\d+\/$/.test(new URL(response.url()).pathname)
    ));
    const saveButton = answerDialog.getByRole("button", { name: `저장 (총 ${maximum}점)`, exact: true });
    await saveButton.click();
    expect((await answerSaved).status()).toBe(200);
    await expect(page.getByText("저장되었습니다.", { exact: true })).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await answerDialog.getByRole("button", { name: "취소", exact: true }).click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#assessment-policy > details > summary").click();
    await expect(page.getByRole("spinbutton", { name: "만점", exact: true })).toHaveValue(String(maximum));

    await page.getByRole("button", { name: "전체 재채점", exact: true }).click();
    const recalculated = page.waitForResponse((response) => matchesApiResponse(response, "POST", `/exams/${created.examId}/recalculate/`), { timeout: 90_000 });
    await page.getByRole("alertdialog", { name: "시험 전체 재채점" }).getByRole("button", { name: "재채점 실행", exact: true }).click();
    const response = await recalculated;
    expect(response.status()).toBe(200);
    const result = await response.json() as { graded: number; failed: unknown[] };
    expect(result.graded).toBeGreaterThan(0);
    expect(result.failed).toEqual([]);
    await expect.poll(async () => (await waitForStudentResult(request, studentToken, created.examId!)).total_score,
      { timeout: 30_000 }).toBe(expected);
    const parent = await expectParentApi<{ exams?: any[] }>(request, "/student/grades/", parentToken, created.studentId);
    expect(parent.exams?.find((row) => Number(row.exam_id) === created.examId)?.total_score).toBe(expected);

    await gotoAndSettle(page, `${BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`);
    await chooseExamHeaderAction(page, "문항별 점수 입력");
    const grading = page.getByRole("dialog").filter({ hasText: `${EXAM_TITLE} 혼합 채점` });
    for (const [index, score] of EXPECTED_WRITTEN_SCORES.entries()) {
      await expect(grading.getByRole("spinbutton", { name: `${STUDENT_NAME} ${31 + index}번 10점 만점 점수` })).toHaveValue(String(score));
    }
    await grading.getByRole("button", { name: "닫기", exact: true }).click();
    for (const account of [
      { role: "student" as const, username: STUDENT_USER, password: STUDENT_PASS },
      { role: "parent" as const, username: CONTROLLED_PHONE, password: STUDENT_PASS },
    ]) {
      await loginBrowserAsRealUser(page, "/student/grades", account);
      const card = page.getByRole("link").filter({ hasText: EXAM_TITLE });
      await expect(card).toContainText(`${expected}/${maximum}점`, { timeout: 30_000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(card).toContainText(`${expected}/${maximum}점`, { timeout: 30_000 });
      await test.info().attach(`regraded-${account.role}-${changed ? 1366 : 390}`, {
        body: await page.screenshot({ fullPage: true }), contentType: "image/png",
      });
    }
  }
}

async function verifyStaffSubjectiveRecovery(page: Page, request: APIRequestContext): Promise<void> {
  const username = `qa-omr-assistant-${TS}`;
  const staff = await expectApi<{ id: number }>(request, "POST", "/staffs/", created.adminAccess!, {
    name: `QA OMR 조교 ${TS}`, role: "ASSISTANT", username, password: STUDENT_PASS, is_manager: false,
  }, [201]);
  created.staffId = Number(staff.id);
  const tokens = await loginToken(request, username, STUDENT_PASS);
  created.staffAccess = tokens.access;
  const identity = await expectApi<CurrentUser>(request, "GET", "/core/me/", tokens.access);
  expect(identity.tenantRole).toBe("staff");
  expect(identity.first_login_guide_required).toBe(true);
  const scorePath = `/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`;
  const draftPath = `/results/admin/sessions/${created.sessionId}/score-draft/`;
  const cellSelector = `[data-score-cell="exam:${created.enrollmentId}:${created.examId}:subjective:"]`;
  const expectedSubjective = EXPECTED_WRITTEN_SCORES.reduce((sum, score) => sum + score, 0);

  const editSubjective = async (target: Page) => {
    const options = target.getByRole("button", { name: /표시 옵션/ });
    if (await options.getAttribute("aria-expanded") === "false") await options.click();
    await target.getByRole("button", { name: "수정", exact: true }).click();
    await expect(target.getByRole("button", { name: "저장하고 잠금", exact: true })).toBeVisible();
    const subjective = target.getByRole("group", { name: "시험 점수 입력 방식" })
      .getByRole("button", { name: "주관식", exact: true });
    if (await subjective.getAttribute("aria-pressed") !== "true") {
      await subjective.click();
      await target.getByRole("button", { name: "주관식 입력", exact: true }).click();
    }
  };
  const saveSubjective = async (target: Page, score: number) => {
    await target.locator(cellSelector).getByRole("textbox").fill(String(score));
    const saved = target.waitForResponse((response) => matchesApiResponse(response, "PATCH",
      `/results/admin/exams/${created.examId}/enrollments/${created.enrollmentId}/subjective/`));
    await target.getByRole("button", { name: "저장하고 잠금", exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(target.getByRole("button", { name: "수정", exact: true })).toBeVisible();
  };

  for (const width of [1366, 390]) {
    const contexts = await Promise.all([1, 2].map(() => page.context().browser()!.newContext({
      viewport: { width, height: 900 }, serviceWorkers: "block",
    })));
    const guards: Array<{ assertClean: () => void }> = [];
    try {
      const screens = await Promise.all(contexts.map((context) => context.newPage()));
      for (const screen of screens) {
        guards.push(await installQaStudentParentBoundary(screen, request));
        screen.on("request", (req) => {
          const client = req.headers()["x-score-editor-client"];
          if (client) created.staffScoreEditorClientIds.add(client);
        });
        const [scores] = await Promise.all([
          screen.waitForResponse((response) => matchesApiResponse(response, "GET",
            `/results/admin/sessions/${created.sessionId}/scores/`), { timeout: 45_000 }).then(async (response) => {
              expect(response.status()).toBe(200);
              // Read while this document still owns the response; login also reloads.
              return await response.json() as { meta?: { exams?: Array<{ exam_id: number }> } };
            }),
          loginBrowserAsRealUser(screen, scorePath, { role: "staff", username, password: STUDENT_PASS }),
        ]);
        expect(scores.meta?.exams?.some((exam) => Number(exam.exam_id) === created.examId)).toBe(true);
        await expect(screen.getByRole("button", { name: /표시 옵션/ })).toBeVisible({ timeout: 30_000 });
      }
      const [first, second] = screens;
      await editSubjective(first);
      await saveSubjective(first, expectedSubjective + 1);
      await editSubjective(first);
      await first.locator(cellSelector).getByRole("textbox").click();
      await expect.poll(async () => {
        const state = await apiFetch<{ active_editors: Array<{ active_cell: { sub?: string; enrollmentId: number }; has_pending_changes: boolean }> }>(
          request, "GET", draftPath, tokens.access, undefined, { "X-Score-Editor-Client": `qa-observer-${TS}` });
        expect(state.status).toBe(200);
        return state.body.active_editors.some((editor) => editor.active_cell.sub === "subjective"
          && editor.active_cell.enrollmentId === created.enrollmentId && editor.has_pending_changes === false);
      }, { timeout: 15_000 }).toBe(true);
      // First document stays open: this proves explicit same-account transfer,
      // independently of best-effort document-exit delivery.
      await editSubjective(second);
      const cell = second.locator(cellSelector);
      await expect(cell).toContainText("내 다른 화면에서 입력 중", { timeout: 15_000 });
      await expect(cell.getByRole("textbox")).toHaveCount(0);
      const claimed = second.waitForResponse((response) => matchesApiResponse(response, "PUT", draftPath)
        && response.request().postDataJSON()?.take_over_same_user === true);
      await cell.getByRole("button", { name: "이 화면에서 이어 입력", exact: true }).click();
      expect((await claimed).status()).toBe(200);
      await expect(cell.getByRole("textbox")).toBeFocused();
      await saveSubjective(second, expectedSubjective);
      await second.reload({ waitUntil: "domcontentloaded" });
      const options = second.getByRole("button", { name: /표시 옵션/ });
      if (await options.getAttribute("aria-expanded") === "false") await options.click();
      await second.getByRole("button", { name: "객관식 + 주관식", exact: true }).click();
      await expect(cell).toContainText(String(expectedSubjective));
      const screenshot = await second.screenshot({ fullPage: true });
      await test.info().attach(`staff-subjective-recovered-${width}`, { body: screenshot, contentType: "image/png" });
      expect((await expectApi<CurrentUser>(request, "GET", "/core/me/", tokens.access)).first_login_guide_required).toBe(false);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
      guards.forEach((guard) => guard.assertClean());
    }
  }
}

async function cleanup(request: APIRequestContext): Promise<void> {
  const token = created.adminAccess;
  if (!token) return;
  const failures: string[] = [];

  // Staff leases belong to that actual user, not the administrator cleanup token.
  if (created.staffAccess && created.sessionId) {
    for (const clientId of created.staffScoreEditorClientIds) {
      try {
        const released = await apiFetch(request, "POST", `/results/admin/sessions/${created.sessionId}/score-draft/commit/`,
          created.staffAccess, { release_lease: true }, { "X-Score-Editor-Client": clientId });
        if (![204, 404].includes(released.status)) failures.push(`staff score lease cleanup -> ${released.status}`);
      } catch {
        failures.push("staff score lease cleanup transport failed");
      }
    }
  }

  const remove = async (
    method: string,
    path: string,
    data?: Record<string, unknown>,
    acceptedStatuses: number[] = [200, 202, 204, 404],
    extraHeaders?: Record<string, string>,
  ) => {
    let out: { status: number; body: unknown };
    try {
      out = await apiFetch(request, method, path, token, data, extraHeaders);
    } catch (error) {
      out = {
        status: 0,
        body: { error: error instanceof Error ? error.message : String(error) },
      };
    }
    if (!acceptedStatuses.includes(out.status)) {
      emitOmrCleanupStatus("remove", acceptedStatuses, out.status, safeLectureSessionDeleteBlocker(out.body));
      failures.push(`${method} ${path} -> ${out.status} ${JSON.stringify(out.body)}`);
    }
    return out;
  };

  if (created.staffId) await remove("DELETE", `/staffs/${created.staffId}/`);

  for (const id of created.submissionIds) {
    await remove("DELETE", `/submissions/submissions/${id}/`);
  }
  for (const id of created.sessionEnrollmentIds) {
    await remove("DELETE", `/enrollments/session-enrollments/${id}/`);
  }
  if (created.studentId) {
    await remove("POST", "/students/bulk_delete/", { ids: [created.studentId] }, [200, 204]);
    await remove(
      "POST",
      "/students/bulk_permanent_delete/",
      { ids: [created.studentId] },
      [200],
    );
  }
  if (created.enrollmentId) await remove("DELETE", `/enrollments/${created.enrollmentId}/`);
  let archivedExamHandoff = false;
  if (created.examId && created.sessionId) {
    const examDelete = await remove(
      "DELETE",
      `/exams/${created.examId}/?session_id=${created.sessionId}`,
      undefined,
      [200, 204, 404],
    );
    if (examDelete.status === 200) {
      const action = (examDelete.body as { action?: unknown } | null)?.action;
      if (action !== "archived") {
        emitOmrCleanupStatus("archive-action", [200], examDelete.status, null);
        failures.push(
          `unexpected exam cleanup action -> 200 ${JSON.stringify(examDelete.body)}`,
        );
      } else {
        archivedExamHandoff = true;
      }
    }
  }
  if (created.sessionId) {
    // A leftover score-draft lease (any client id captured above) blocks
    // session/lecture delete with 403 ("score edit drafts" /
    // "sessions with score edit drafts") -- release every one, before the
    // delete attempts below. A stale/foreign client id or an already-
    // released draft both return 204 (score_draft_view.py:441-442), so
    // looping over every captured id is safe. A lock conflict (409) is a
    // real cleanup defect, not swallowed here -- only 204/404 are accepted.
    for (const clientId of created.scoreEditorClientIds) {
      await remove(
        "POST",
        `/results/admin/sessions/${created.sessionId}/score-draft/commit/`,
        { release_lease: true },
        [204, 404],
        { "X-Score-Editor-Client": clientId },
      );
    }
  }
  if (!archivedExamHandoff && created.sessionId) {
    await remove("DELETE", `/lectures/sessions/${created.sessionId}/`);
  }
  if (!archivedExamHandoff && created.lectureId) {
    await remove("DELETE", `/lectures/lectures/${created.lectureId}/`);
  }

  for (const [label, path] of [
    ...(created.staffId ? [[`staff ${created.staffId}`, `/staffs/${created.staffId}/`] as const] : []),
    ...created.submissionIds.map((id) => [`submission ${id}`, `/submissions/submissions/${id}/`] as const),
    ...(!archivedExamHandoff && created.examId
      ? [[`exam ${created.examId}`, `/exams/${created.examId}/`] as const]
      : []),
    ...(created.studentId ? [[`student ${created.studentId}`, `/students/${created.studentId}/`] as const] : []),
    ...(!archivedExamHandoff && created.sessionId
      ? [[`session ${created.sessionId}`, `/lectures/sessions/${created.sessionId}/`] as const]
      : []),
    ...(!archivedExamHandoff && created.lectureId
      ? [[`lecture ${created.lectureId}`, `/lectures/lectures/${created.lectureId}/`] as const]
      : []),
  ]) {
    const verification = await apiFetch(request, "GET", path, token).catch((error) => {
      emitOmrCleanupStatus("verify-absent", [404], 0, null);
      throw error;
    });
    if (verification.status !== 404) {
      emitOmrCleanupStatus("verify-absent", [404], verification.status, null);
      failures.push(`verify ${label} absent -> ${verification.status} ${JSON.stringify(verification.body)}`);
    }
  }

  if (archivedExamHandoff && created.examId) {
    const retained = await apiFetch<{ id?: number; title?: string; is_active?: boolean }>(
      request,
      "GET",
      `/exams/${created.examId}/?include_inactive=true`,
      token,
    ).catch((error) => {
      emitOmrCleanupStatus("verify-archive", [200], 0, null);
      throw error;
    });
    if (
      retained.status !== 200
      || Number(retained.body?.id) !== created.examId
      || retained.body?.title !== EXAM_TITLE
      || retained.body?.is_active !== false
    ) {
      emitOmrCleanupStatus("verify-archive", [200], retained.status, null);
      failures.push(
        `verify archived E2E exam handoff -> ${retained.status} ${JSON.stringify(retained.body)}`,
      );
    } else {
      console.log(
        `OMR cleanup handoff: retained archived exam=${created.examId}, ` +
        `session=${created.sessionId ?? 0}, lecture=${created.lectureId ?? 0}; ` +
        "the fixed SSM Cleanup for the exact Setup tenant and post-cleanup Inspect zero are required.",
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`OMR production fixture cleanup failed:\n${failures.join("\n")}`);
  }
}

test.describe.serial("[E2E] OMR 업로드/검토/재채점 실사용 검증", () => {
  test.describe.configure({ retries: 0 });

  test.afterAll(async ({ request }) => {
    await cleanup(request);
  });

  test("OMR PDF 업로드 후 운영자 리뷰 저장이 성적과 학생 화면에 반영된다", async ({ page, request }) => {
    requireIsolatedScenario();
    // resolvedScoreEditorClientId() is a per-document-load module constant
    // (src/shared/scoring/scoreEditLease.ts), so page.reload() below mints a
    // second one. A score-draft lease opened under either id must be
    // released in cleanup(), or it permanently blocks session/lecture
    // delete (view_dependencies.py's "score edit drafts" guard counts rows,
    // not lease freshness).
    page.on("request", (req) => {
      const clientId = req.headers()["x-score-editor-client"];
      if (clientId) created.scoreEditorClientIds.add(clientId);
    });
    const adminTokens = await loginTokenViaRequest(request, "admin");
    created.adminAccess = adminTokens.access;

    const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", adminTokens.access, {
      title: LECTURE_TITLE,
      name: "E2E검증",
      subject: "수학",
      description: "OMR 업로드/검토/재채점 실사용 canary",
      start_date: TODAY_KST,
      lecture_time: "목 19:00 ~ 21:00",
      color: "#0f766e",
      chip_label: "OM",
      is_active: true,
    });
    created.lectureId = Number(lecture.id);

    const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", adminTokens.access, {
      lecture: created.lectureId,
      title: SESSION_TITLE,
      date: TODAY_KST,
      order: 1,
    });
    created.sessionId = Number(session.id);

    const student = await expectApi<{ id: number }>(request, "POST", "/students/", adminTokens.access, {
      name: STUDENT_NAME,
      parent_phone: CONTROLLED_PHONE,
      ps_number: STUDENT_USER,
      no_phone: true,
      school_type: "HIGH",
      grade: 1,
      initial_password: STUDENT_PASS,
      memo: "E2E OMR canary. 계정 안내 필수 발송 정책과 함께 OMR 업로드/검토 검증용.",
    });
    created.studentId = Number(student.id);

    const enrollments = await expectApi<Array<{ id: number }>>(
      request,
      "POST",
      "/enrollments/bulk_create/",
      adminTokens.access,
      { lecture: created.lectureId, students: [created.studentId] },
    );
    created.enrollmentId = Number(enrollments[0].id);

    const sessionEnrollments = await expectApi<Array<{ id: number }>>(
      request,
      "POST",
      "/enrollments/session-enrollments/bulk_create/",
      adminTokens.access,
      { session: created.sessionId, enrollments: [created.enrollmentId] },
    );
    created.sessionEnrollmentIds = sessionEnrollments.map((row) => Number(row.id));

    const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", adminTokens.access, {
      title: EXAM_TITLE,
      description: "mixed OMR -> pending projection -> manual essay -> final projection canary",
      exam_type: "regular",
      session_id: created.sessionId,
      pass_score: 15,
      max_score: 50,
      grading_mode: "mixed",
      manual_grading_method: "score",
      choice_question_count: 30,
      answer_visibility: "hidden",
      student_results_published: true,
    });
    created.examId = Number(exam.id);

    const questions = await expectApi<Array<{ id: number; number: number }>>(
      request,
      "POST",
      `/exams/${created.examId}/questions/init/`,
      adminTokens.access,
      {
        choice_count: 30,
        choice_score: 1,
        essay_count: 2,
        essay_score: 10,
        question_types: [
          ...Array.from({ length: 30 }, () => "choice"),
          "essay",
          "essay",
        ],
      },
    );
    const questionIdsByNumber = questions
      .sort((a, b) => Number(a.number) - Number(b.number))
      .map((q) => Number(q.id));
    const objectiveQuestionIds = questionIdsByNumber.slice(0, EXPECTED_ANSWERS.length);
    const writtenQuestionIds = questionIdsByNumber.slice(EXPECTED_ANSWERS.length);
    expect(objectiveQuestionIds).toHaveLength(30);
    expect(writtenQuestionIds).toHaveLength(2);

    await expectApi(request, "POST", "/exams/answer-keys/", adminTokens.access, {
      exam: created.examId,
      answers: Object.fromEntries(
        questionIdsByNumber.map((id, idx) => [
          String(id),
          idx < EXPECTED_ANSWERS.length ? EXPECTED_ANSWERS[idx] : "0",
        ]),
      ),
    });

    await expectApi(
      request,
      "PUT",
      `/exams/${created.examId}/enrollments/?session_id=${created.sessionId}`,
      adminTokens.access,
      { enrollment_ids: [created.enrollmentId] },
      [200],
    );

    const pdfBuffer = await downloadOmrPdf(request, adminTokens.access, created.examId);
    const markedPdfBuffer = await markThirtyQuestionOmrPdf(
      pdfBuffer,
      EXPECTED_ANSWERS,
      CONTROLLED_PHONE.slice(-8),
    );

    await loginBrowserAsRealUser(
      page,
      `/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`,
      { role: "admin", username: ADMIN_USER, password: ADMIN_PASS },
    );
    const draftDialog = page.getByRole("dialog", { name: /임시저장된 변경/ });
    if (await draftDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await draftDialog.getByRole("button", { name: "버리기", exact: true }).click();
      await expect(draftDialog).toBeHidden({ timeout: 5_000 });
    }
    await expect(page.getByRole("button", { name: "OMR 스캔 등록" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "OMR 스캔 등록" })).toBeEnabled();
    await page.getByRole("button", { name: "OMR 스캔 등록" }).click();
    const uploadDialog = page.getByRole("dialog").filter({ hasText: "OMR 스캔 등록" });
    await expect(uploadDialog.locator(".admin-omr-upload").getByText("스캔 파일 선택")).toBeVisible({ timeout: 10_000 });

    await uploadDialog.locator(".admin-omr-upload input[type='file']").setInputFiles({
      name: `omr-realuse-${TS}.pdf`,
      mimeType: "application/pdf",
      buffer: markedPdfBuffer,
    });
    await expect(uploadDialog.getByText(`omr-realuse-${TS}.pdf`)).toBeVisible();
    await waitForRenderSettled(page);
    const startUpload = uploadDialog.getByRole("button", { name: "등록 시작", exact: true });
    await expect(startUpload).toBeEnabled();

    const initializeResponsePromise = page.waitForResponse(
      (resp) => resp.request().method() === "POST"
        && new URL(resp.url()).pathname === `/api/v1/submissions/submissions/exams/${created.examId}/omr/batches/`,
      { timeout: 90_000 },
    ).then((response) => {
      expect(response.status(), "OMR batch initialization must succeed before file admission").toBe(201);
      return response;
    });
    const uploadResponsePromise = page.waitForResponse(
      (resp) =>
        resp.request().method() === "POST" &&
        resp.url().includes(`/submissions/submissions/exams/${created.examId}/omr/batch/`),
      { timeout: 90_000 },
    );
    const responses = Promise.all([initializeResponsePromise, uploadResponsePromise]);
    // Attach both response waits before clicking: batch initialization is a real
    // prerequisite, not evidence that the subsequent file upload succeeded.
    const [, [initializeResponse, uploadResponse]] = await Promise.all([
      startUpload.click(),
      responses,
    ]);
    expect(initializeResponse.status()).toBe(201);
    expect(uploadResponse.status()).toBe(201);
    const uploadBody = await uploadResponse.json() as { submission_ids?: number[] };
    created.submissionIds = (uploadBody.submission_ids ?? []).map((id) => Number(id));
    expect(created.submissionIds.length).toBe(1);

    const submissionId = created.submissionIds[0];
    // AdminOmrBatchUploadBox.tsx's post-upload notice (single file, no
    // duplicates/failures): `${created_count}건을 접수했습니다. ...`.
    await expect(page.getByText("1건을 접수했습니다. AI 처리 상태는 작업박스에서 계속 확인할 수 있습니다.")).toBeVisible({ timeout: 20_000 });
    await uploadDialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(uploadDialog).toBeHidden();

    const reviewDetail = await waitForOmrAnswers(
      request,
      adminTokens.access,
      submissionId,
      objectiveQuestionIds.length,
    );
    expect(reviewDetail.answers.map((row: any) => Number(row.question_id)).sort((a: number, b: number) => a - b))
      .toEqual([...objectiveQuestionIds].sort((a, b) => a - b));
    expect(Number(reviewDetail.enrollment_id)).toBe(created.enrollmentId);
    expect(
      [...reviewDetail.answers]
        .sort((a: any, b: any) => Number(a.question_no) - Number(b.question_no))
        .map((row: any) => String(row.answer)),
    ).toEqual(EXPECTED_ANSWERS);

    await gotoAndSettle(
      page,
      `${BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/exams?examId=${created.examId}`,
      { timeout: 45_000 },
    );
    await page.getByRole("tab", { name: "채점·결과" }).click();
    const reviewEntry = page.locator(".omr-entry");
    await expect(reviewEntry.locator(".omr-entry__title")).toContainText("OMR 검토", { timeout: 30_000 });
    await reviewEntry.getByRole("button", { name: /처리하기|OMR 다시 보기/ }).click();
    await expect(page.getByRole("dialog", { name: "OMR 검토" })).toBeVisible({ timeout: 20_000 });
    // OMR recognizes objective bubbles only; both written questions are graded
    // separately below, with pending/final student and parent projections checked.
    await expect(page.locator(".orw-q-row")).toHaveCount(objectiveQuestionIds.length, { timeout: 30_000 });
    const scanImage = page.getByRole("img", { name: "OMR 스캔 원본", exact: true });
    await expect(scanImage).toBeVisible();
    await expect.poll(() => scanImage.evaluate((element: HTMLImageElement) => (
      element.complete && element.naturalWidth > 0 && element.naturalHeight > 0
    )), { timeout: 30_000 }).toBe(true);
    await page.screenshot({ path: `e2e/screenshots/omr-review-realuse-scan-${TS}.png`, fullPage: true });

    const pickButton = page.getByRole("button", { name: "학생 검색·연결" });
    if (await pickButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pickButton.click();
      await page.locator(".spm-search").fill(STUDENT_NAME);
      await expect(page.getByRole("button", { name: new RegExp(STUDENT_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }))
        .toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: new RegExp(STUDENT_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
      await expect(page.locator(".orw-identifier__picked")).toContainText(STUDENT_NAME, { timeout: 10_000 });
      await expect(page.getByRole("dialog", { name: "학생 선택" })).toBeHidden();
    }

    const firstAnswerRow = page.locator(".orw-q-row").first();
    await expect(firstAnswerRow.locator(".orw-q-row__num")).toHaveText("1번");
    const correctedAnswer = firstAnswerRow.getByRole("button", { name: "2", exact: true });
    await expect(correctedAnswer).toBeVisible({ timeout: 30_000 });
    await correctedAnswer.click();
    await expect(page.getByRole("button", { name: "저장 + 재채점" })).toBeEnabled();

    const wrongSaveResponsePromise = page.waitForResponse(
      (resp) =>
        resp.request().method() === "POST" &&
        resp.url().includes(`/submissions/submissions/${submissionId}/manual-edit/`),
      { timeout: 90_000 },
    );
    await page.getByRole("button", { name: "저장 + 재채점" }).click();
    const wrongSaveResponse = await wrongSaveResponsePromise;
    expect(wrongSaveResponse.status()).toBe(200);
    const wrongSaveBody = await wrongSaveResponse.json() as { score?: number; total_score?: number };
    expect(wrongSaveBody.score ?? wrongSaveBody.total_score).toBe(EXPECTED_OBJECTIVE_SCORE - 1);
    await expect(page.getByText(
      `객관식 답안 저장 완료: ${EXPECTED_OBJECTIVE_SCORE - 1}점 · 서술형 채점 대기`,
    ))
      .toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "변경 사항 없음" }))
      .toBeDisabled({ timeout: 20_000 });

    await firstAnswerRow.getByRole("button", { name: "2", exact: true }).click();
    await expect(page.getByRole("button", { name: "저장 + 재채점" })).toBeEnabled();
    const saveResponsePromise = page.waitForResponse(
      (resp) =>
        resp.request().method() === "POST" &&
        resp.url().includes(`/submissions/submissions/${submissionId}/manual-edit/`),
      { timeout: 90_000 },
    );
    await page.getByRole("button", { name: "저장 + 재채점" }).click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBe(200);
    const saveBody = await saveResponse.json() as { graded?: boolean; score?: number; total_score?: number };
    expect(saveBody.graded).toBe(true);
    expect(saveBody.score ?? saveBody.total_score).toBe(EXPECTED_OBJECTIVE_SCORE);

    await expect(page.getByText(
      `객관식 답안 저장 완료: ${EXPECTED_OBJECTIVE_SCORE}점 · 서술형 채점 대기`,
    )).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".orw-list-row__score").filter({ hasText: `${EXPECTED_OBJECTIVE_SCORE}점` }))
      .toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `e2e/screenshots/omr-review-realuse-admin-${TS}.png`, fullPage: true });

    const studentTokens = await loginToken(request, STUDENT_USER, STUDENT_PASS);
    const pendingGrades = await expectApi<{ exams?: any[]; exam_summary?: { scored_count?: number } }>(
      request,
      "GET",
      "/student/grades/",
      studentTokens.access,
    );
    const pendingStudentExam = pendingGrades.exams?.find((row) => Number(row.exam_id) === created.examId);
    expect(pendingStudentExam?.grading_status).toBe("subjective_pending");
    expect(pendingStudentExam?.is_provisional).toBe(true);
    expect(pendingStudentExam?.total_score).toBeNull();
    expect(pendingStudentExam?.rank).toBeNull();
    expect(pendingStudentExam?.wrong_question_numbers).toEqual([]);
    expect(pendingGrades.exam_summary?.scored_count).toBe(0);

    const pendingAnalytics = await expectApi<{ summary?: { scored_exam_count?: number; avg_score_pct?: number | null }; trends?: unknown[] }>(
      request,
      "GET",
      "/student/grades/analytics/",
      studentTokens.access,
    );
    expect(pendingAnalytics.summary?.scored_exam_count).toBe(0);
    expect(pendingAnalytics.summary?.avg_score_pct).toBeNull();
    expect(pendingAnalytics.trends).toEqual([]);

    const parentTokens = await loginToken(request, CONTROLLED_PHONE, STUDENT_PASS);
    const pendingParentGrades = await expectParentApi<{
      exams?: any[];
      exam_summary?: { scored_count?: number };
    }>(request, "/student/grades/", parentTokens.access, created.studentId);
    const pendingParentExam = pendingParentGrades.exams?.find(
      (row) => Number(row.exam_id) === created.examId,
    );
    expect(pendingParentExam?.grading_status).toBe("subjective_pending");
    expect(pendingParentExam?.total_score).toBeNull();
    expect(pendingParentExam?.rank).toBeNull();
    expect(pendingParentGrades.exam_summary?.scored_count).toBe(0);

    const pendingParentAnalytics = await expectParentApi<{
      summary?: { scored_exam_count?: number; avg_score_pct?: number | null };
      trends?: unknown[];
    }>(request, "/student/grades/analytics/", parentTokens.access, created.studentId);
    expect(pendingParentAnalytics.summary?.scored_exam_count).toBe(0);
    expect(pendingParentAnalytics.summary?.avg_score_pct).toBeNull();
    expect(pendingParentAnalytics.trends).toEqual([]);

    const pendingAdminGrades = await expectApi<{ exams?: any[]; exam_summary?: { scored_count?: number } }>(
      request,
      "GET",
      `/results/admin/student-grades/?student_id=${created.studentId}`,
      adminTokens.access,
    );
    const pendingAdminExam = pendingAdminGrades.exams?.find((row) => Number(row.exam_id) === created.examId);
    expect(pendingAdminExam?.grading_status).toBe("subjective_pending");
    expect(pendingAdminExam?.total_score).toBeNull();
    expect(pendingAdminGrades.exam_summary?.scored_count).toBe(0);

    const pendingExamSummary = await expectApi<{ avg_score?: number; pass_count?: number; fail_count?: number }>(
      request,
      "GET",
      `/results/admin/exams/${created.examId}/summary/?lecture_id=${created.lectureId}`,
      adminTokens.access,
    );
    expect(pendingExamSummary.avg_score).toBe(0);
    expect(pendingExamSummary.pass_count).toBe(0);
    expect(pendingExamSummary.fail_count).toBe(0);

    await loginBrowserAsRealUser(
      page,
      "/student/grades",
      { role: "student", username: STUDENT_USER, password: STUDENT_PASS },
    );
    await waitForRenderSettled(page, { timeout: 20_000 });
    const pendingCard = page.getByRole("link").filter({ hasText: EXAM_TITLE });
    await expect(pendingCard).toContainText("채점 진행 중", { timeout: 20_000 });
    await expect(pendingCard).toContainText("서술형 채점 중");
    await expect(pendingCard).not.toContainText(`${EXPECTED_OBJECTIVE_SCORE}/50점`);

    await loginBrowserAsRealUser(
      page,
      "/student/grades",
      { role: "parent", username: CONTROLLED_PHONE, password: STUDENT_PASS },
    );
    await waitForRenderSettled(page, { timeout: 20_000 });
    const pendingParentCard = page.getByRole("link").filter({ hasText: EXAM_TITLE });
    await expect(pendingParentCard).toContainText("채점 진행 중", { timeout: 20_000 });
    await expect(pendingParentCard).toContainText("서술형 채점 중");
    await expect(pendingParentCard).not.toContainText(`${EXPECTED_OBJECTIVE_SCORE}/50점`);

    await loginBrowserAsRealUser(
      page,
      `/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`,
      { role: "admin", username: ADMIN_USER, password: ADMIN_PASS },
    );
    await chooseExamHeaderAction(page, "문항별 점수 입력");
    const gradingDialog = page.getByRole("dialog").filter({
      hasText: `${EXAM_TITLE} 혼합 채점`,
    });
    const firstWrittenCell = gradingDialog.getByRole("spinbutton", {
      name: `${STUDENT_NAME} 31번 10점 만점 점수`,
    });
    const secondWrittenCell = gradingDialog.getByRole("spinbutton", {
      name: `${STUDENT_NAME} 32번 10점 만점 점수`,
    });
    await expect(firstWrittenCell).toHaveValue("", { timeout: 30_000 });
    await expect(secondWrittenCell).toHaveValue("");
    await firstWrittenCell.fill(String(EXPECTED_WRITTEN_SCORES[0]));
    await secondWrittenCell.fill(String(EXPECTED_WRITTEN_SCORES[1]));
    await gradingDialog.getByRole("button", { name: "입력 내용 확인", exact: true }).click();
    await expect(gradingDialog.getByText("1명 · 결시 0명 · 성적 계산 완료", { exact: true }))
      .toBeVisible({ timeout: 30_000 });
    await gradingDialog.getByRole("button", { name: "1명 성적 확정", exact: true }).click();
    await expect(page.getByText("1명의 성적을 확정했습니다.")).toBeVisible({ timeout: 30_000 });

    await gotoAndSettle(page,
      `${BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/exams?assessment=exam%3A${created.examId}`,
      { timeout: 30_000 });
    await page.getByRole("button", { name: "전체 재채점", exact: true }).click();
    const recalculateResponse = page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/api/v1/exams/${created.examId}/recalculate/`,
    { timeout: 90_000 });
    await page.getByRole("alertdialog", { name: "시험 전체 재채점" })
      .getByRole("button", { name: "재채점 실행", exact: true }).click();
    const recalculated = await recalculateResponse;
    expect(recalculated.status()).toBe(200);
    const recalculation = await recalculated.json() as { graded: number; failed: unknown[] };
    expect(recalculation.graded).toBeGreaterThan(0);
    expect(recalculation.failed).toEqual([]);
    await gotoAndSettle(page,
      `${BASE}/workspace/lectures/${created.lectureId}/sessions/${created.sessionId}/scores`,
      { timeout: 30_000 });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await chooseExamHeaderAction(page, "문항별 점수 입력");
    const reloadedGradingDialog = page.getByRole("dialog").filter({
      hasText: `${EXAM_TITLE} 혼합 채점`,
    });
    await expect(reloadedGradingDialog.getByRole("spinbutton", {
      name: `${STUDENT_NAME} 31번 10점 만점 점수`,
    })).toHaveValue(String(EXPECTED_WRITTEN_SCORES[0]), { timeout: 30_000 });
    await expect(reloadedGradingDialog.getByRole("spinbutton", {
      name: `${STUDENT_NAME} 32번 10점 만점 점수`,
    })).toHaveValue(String(EXPECTED_WRITTEN_SCORES[1]));
    expect(await reloadedGradingDialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    )).toBe(true);

    const studentResult = await waitForStudentResult(request, studentTokens.access, created.examId);
    expect(studentResult.total_score).toBe(EXPECTED_SCORE);
    expect(studentResult.analysis.wrong_question_numbers).toEqual([31, 32]);

    const finalParentGrades = await expectParentApi<{ exams?: any[] }>(
      request,
      "/student/grades/",
      parentTokens.access,
      created.studentId,
    );
    const finalParentExam = finalParentGrades.exams?.find(
      (row) => Number(row.exam_id) === created.examId,
    );
    expect(finalParentExam?.grading_status).not.toBe("subjective_pending");
    expect(finalParentExam?.total_score).toBe(EXPECTED_SCORE);
    type FinalAnalytics = {
      summary: { scored_exam_count: number; avg_score_pct: number };
      trends: Array<{ exam_id: number; score_pct: number }>;
    };
    const finalStudentAnalytics = await expectApi<FinalAnalytics>(
      request, "GET", "/student/grades/analytics/", studentTokens.access,
    );
    const finalParentAnalytics = await expectParentApi<FinalAnalytics>(
      request, "/student/grades/analytics/", parentTokens.access, created.studentId,
    );
    for (const analytics of [finalStudentAnalytics, finalParentAnalytics]) {
      expect(analytics.summary.scored_exam_count).toBe(1);
      expect(analytics.summary.avg_score_pct).toBe(EXPECTED_SCORE / 50 * 100);
      expect(analytics.trends.map((row) => ({ exam_id: row.exam_id, score_pct: row.score_pct })))
        .toEqual([{ exam_id: created.examId, score_pct: EXPECTED_SCORE / 50 * 100 }]);
    }

    await loginBrowserAsRealUser(
      page,
      "/student/grades",
      { role: "student", username: STUDENT_USER, password: STUDENT_PASS },
    );
    await waitForRenderSettled(page, { timeout: 20_000 });
    const finalStudentCard = page.getByRole("link").filter({ hasText: EXAM_TITLE });
    await expect(finalStudentCard).toContainText(`${EXPECTED_SCORE}/50점`, { timeout: 20_000 });
    await expect(finalStudentCard).not.toContainText("채점 진행 중");
    await expect(finalStudentCard).not.toContainText("서술형 채점 중");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page.getByRole("link").filter({ hasText: EXAM_TITLE }))
      .toContainText(`${EXPECTED_SCORE}/50점`, { timeout: 20_000 });
    await page.screenshot({ path: `e2e/screenshots/omr-review-realuse-student-${TS}.png`, fullPage: true });

    await loginBrowserAsRealUser(
      page,
      "/student/grades",
      { role: "parent", username: CONTROLLED_PHONE, password: STUDENT_PASS },
    );
    await waitForRenderSettled(page, { timeout: 20_000 });
    const finalParentCard = page.getByRole("link").filter({ hasText: EXAM_TITLE });
    await expect(finalParentCard).toContainText(`${EXPECTED_SCORE}/50점`, { timeout: 20_000 });
    await expect(finalParentCard).not.toContainText("채점 진행 중");
    await expect(finalParentCard).not.toContainText("서술형 채점 중");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForRenderSettled(page, { timeout: 20_000 });
    await expect(page.getByRole("link").filter({ hasText: EXAM_TITLE }))
      .toContainText(`${EXPECTED_SCORE}/50점`, { timeout: 20_000 });
    await page.screenshot({ path: `e2e/screenshots/omr-review-realuse-parent-${TS}.png`, fullPage: true });

    await verifyChangedAnswerAndMaximum(page, request, studentTokens.access, parentTokens.access);
    await verifyStaffSubjectiveRecovery(page, request);
    await expect.poll(async () => (await waitForStudentResult(request, studentTokens.access, created.examId!)).total_score,
      { timeout: 30_000 }).toBe(EXPECTED_SCORE);
    const restoredParentGrades = await expectParentApi<{ exams?: any[] }>(request, "/student/grades/", parentTokens.access, created.studentId);
    expect(restoredParentGrades.exams?.find((row) => Number(row.exam_id) === created.examId)?.total_score).toBe(EXPECTED_SCORE);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link").filter({ hasText: EXAM_TITLE })).toContainText(`${EXPECTED_SCORE}/50점`);
  });
});

import { expect, test, type Page } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

type ScoreRouteOptions = {
  initialScores?: Array<number | null>;
  initialDraft?: unknown[];
};

function createLocalJwt() {
  const encode = (payload: unknown) =>
    Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    exp: now + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

async function openScores(
  page: Page,
  routeOptions: ScoreRouteOptions = {},
): Promise<void> {
  const baseUrl = getBaseUrl("admin");
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl),
    "성적 입력 route-mock 검증은 로컬 dev 서버 전용",
  );
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, createLocalJwt());
  await installScoreRoutes(page, routeOptions);
  await page.goto(`${baseUrl}/workspace/lectures/9001/sessions/9002/scores`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(
    /\/workspace\/lectures\/9001\/sessions\/9002\/scores/,
  );
}

async function ensureScoreEditing(page: Page): Promise<void> {
  const cells = page.locator(".ds-scores-cell-editable");
  if (
    await cells
      .first()
      .isVisible()
      .catch(() => false)
  )
    return;

  const editButton = page.getByRole("button", {
    name: "수정",
    exact: true,
  });
  await expect(editButton).toBeVisible();
  await editButton.click();
  await expect(cells.first()).toBeVisible();
}

const scorePatches: Array<Record<string, unknown>> = [];
const scorePatchHeaders: Array<Record<string, string>> = [];
const draftPuts: Array<Record<string, unknown>> = [];
const draftCommits: Array<Record<string, unknown>> = [];
let currentScores: Array<number | null> = [65, 52];
let currentDraft: unknown[] = [];
let failNextDraftCommit = false;
let failNextLeaseRelease = false;
let failNextDraftPut = false;
let delayNextScorePatchMs = 0;

async function installScoreRoutes(
  page: Page,
  options: ScoreRouteOptions = {},
): Promise<void> {
  scorePatches.length = 0;
  scorePatchHeaders.length = 0;
  draftPuts.length = 0;
  draftCommits.length = 0;
  currentScores = [...(options.initialScores ?? [65, 52])];
  currentDraft = [...(options.initialDraft ?? [])];
  failNextDraftCommit = false;
  failNextLeaseRelease = false;
  failNextDraftPut = false;
  delayNextScorePatchMs = 0;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (
      /\/api\/v1\/results\/admin\/sessions\/\d+\/scores\/$/.test(path) &&
      method === "GET"
    ) {
      await route.fulfill({
        json: {
          meta: {
            session_title: "자동 저장 검증 차시",
            lecture_title: "자동 저장 검증반",
            lecture_id: 9001,
            exams: [
              {
                exam_id: 9101,
                title: "주간 확인",
                pass_score: 60,
                max_score: 100,
                objective_max_score: 100,
                subjective_max_score: 0,
                display_order: 1,
              },
            ],
            homeworks: [],
          },
          rows: currentScores.map((score, index) => ({
            enrollment_id: 9201 + index,
            student_id: 9301 + index,
            student_name: `자동저장학생${index + 1}`,
            lecture_title: "자동 저장 검증반",
            lecture_color: "#2563eb",
            lecture_chip_label: "자",
            exams: [
              {
                exam_id: 9101,
                title: "주간 확인",
                pass_score: 60,
                attempt_count: 1,
                clinic_link_id: null,
                block: {
                  score,
                  max_score: 100,
                  passed: score == null ? null : score >= 60,
                  clinic_required: score == null ? false : score < 60,
                  is_locked: false,
                  objective_score: score,
                  subjective_score: score == null ? null : 0,
                  meta: {},
                },
                attempt_count: score == null ? 0 : 1,
              },
            ],
            homeworks: [],
            clinic_required: score == null ? false : score < 60,
            progress_completed: false,
            updated_at: "2026-07-25T12:00:00+09:00",
          })),
        },
      });
      return;
    }

    if (path.endsWith("/score-draft/commit/") && method === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      draftCommits.push(body);
      if (failNextLeaseRelease && body.release_lease === true) {
        failNextLeaseRelease = false;
        await route.fulfill({
          status: 500,
          json: { detail: "lease release failed once" },
        });
        return;
      }
      if (failNextDraftCommit) {
        failNextDraftCommit = false;
        await route.fulfill({
          status: 500,
          json: { detail: "commit failed once" },
        });
        return;
      }
      currentDraft = [];
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (path.endsWith("/score-draft/")) {
      if (method === "GET") {
        await route.fulfill({ json: { changes: currentDraft } });
        return;
      }
      if (method === "PUT") {
        if (failNextDraftPut) {
          failNextDraftPut = false;
          await route.fulfill({
            status: 500,
            json: { detail: "draft put failed once" },
          });
          return;
        }
        const body = request.postDataJSON() as { changes?: unknown[] };
        draftPuts.push(body as Record<string, unknown>);
        currentDraft = body.changes ?? [];
        await route.fulfill({ json: { changes: currentDraft } });
        return;
      }
    }

    if (
      /\/api\/v1\/results\/admin\/exams\/9101\/enrollments\/92\d+\/score\/$/.test(
        path,
      ) &&
      method === "PATCH"
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      const delayMs = delayNextScorePatchMs;
      delayNextScorePatchMs = 0;
      if (delayMs > 0)
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      scorePatches.push(body);
      scorePatchHeaders.push(request.headers());
      const enrollmentId = Number(path.match(/enrollments\/(\d+)\/score/)?.[1]);
      const rowIndex = enrollmentId - 9201;
      if (
        rowIndex >= 0 &&
        rowIndex < currentScores.length &&
        typeof body.score === "number"
      ) {
        currentScores[rowIndex] = body.score;
      }
      await route.fulfill({
        json: {
          ok: true,
          exam_id: 9101,
          enrollment_id: enrollmentId,
          total_score: currentScores[rowIndex],
          max_score: 100,
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/attendance/") && method === "GET") {
      await route.fulfill({
        json: {
          count: 2,
          results: currentScores.map((_, index) => ({
            id: 9401 + index,
            enrollment_id: 9201 + index,
            status: "PRESENT",
          })),
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/lectures/9001/") && method === "GET") {
      await route.fulfill({
        json: {
          id: 9001,
          title: "자동 저장 검증반",
          color: "#2563eb",
          chip_label: "자",
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/lectures/sessions/9002/") && method === "GET") {
      await route.fulfill({
        json: {
          id: 9002,
          lecture: 9001,
          order: 1,
          title: "자동 저장 검증 차시",
          date: "2026-07-30",
        },
      });
      return;
    }

    if (
      path.endsWith("/api/v1/staffs/currently-working/") &&
      method === "GET"
    ) {
      await route.fulfill({ json: [] });
      return;
    }

    await route.fallback();
  });
}

test.describe("성적 입력 잠금과 Excel 단축키", () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });

  test("입력 이력이 전혀 없으면 바로 수정 상태로 열리고 저장 후 잠금은 유지된다", async ({
    page,
  }, testInfo) => {
    await openScores(page, { initialScores: [null, null] });

    const saveAndLockButton = page.getByRole("button", {
      name: "저장하고 잠금",
      exact: true,
    });
    await expect(saveAndLockButton).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("status")).toContainText(
      "수정 중 · 자동 저장 준비",
    );
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "OMR 스캔 등록" }),
    ).toBeDisabled();
    await page.screenshot({
      path: testInfo.outputPath("score-entry-empty-auto-edit-1366.png"),
      fullPage: true,
    });

    await saveAndLockButton.click();
    await expect(
      page.getByRole("button", { name: "수정", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText("입력 잠금됨");
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
  });

  test("빈 성적표라도 복구 초안이 있으면 자동 수정하지 않는다", async ({
    page,
  }) => {
    await openScores(page, {
      initialScores: [null, null],
      initialDraft: [
        {
          type: "examTotal",
          examId: 9101,
          enrollmentId: 9201,
          score: 88,
          maxScore: 100,
        },
      ],
    });

    await expect(
      page.getByRole("dialog", { name: /임시저장된 변경 1건/ }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: "수정", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
  });

  test("0점은 입력된 데이터로 보고 잠금 상태를 유지한다", async ({ page }) => {
    await openScores(page, { initialScores: [0, null] });

    await expect(
      page.getByRole("button", { name: "수정", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("status")).toContainText("입력 잠금됨");
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
  });

  test("수정 중 자동 저장·단축키를 지원하고 완료하면 다시 잠긴다", async ({
    page,
  }, testInfo) => {
    await openScores(page);

    const editButton = page.getByRole("button", { name: "수정", exact: true });
    await expect(editButton).toBeVisible();
    await expect(page.getByRole("status")).toContainText("입력 잠금됨");
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("score-entry-locked-1366.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(editButton).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("score-entry-locked-1100.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(editButton).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("score-entry-locked-390.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1366, height: 900 });

    await editButton.click();
    await expect(
      page.getByRole("button", { name: "저장하고 잠금", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Ctrl+S 저장 · Ctrl+Z 실행 취소"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "OMR 스캔 등록" }),
    ).toBeDisabled();
    const cells = page.locator(".ds-scores-cell-editable");
    await expect(cells.first()).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("score-entry-editing-1366.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(
      page.getByRole("button", { name: "저장하고 잠금", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("score-entry-editing-1100.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureScoreEditing(page);
    await expect(
      page.getByRole("button", { name: "저장하고 잠금", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("score-entry-editing-390.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await ensureScoreEditing(page);

    await expect(cells.nth(0)).toHaveAttribute("role", "textbox");
    await expect(cells.nth(0)).toHaveAttribute(
      "aria-label",
      /자동저장학생1.*주간 확인/,
    );
    await cells.nth(0).fill("");
    await page
      .getByRole("button", { name: "저장하고 잠금", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "저장하고 잠금", exact: true }),
    ).toBeVisible();
    await expect(cells.nth(0)).toHaveText("65");
    expect(scorePatches).toHaveLength(0);

    failNextDraftCommit = true;
    await cells.nth(0).click();
    await cells.nth(0).press("Control+a");
    await page.keyboard.type("7");
    // eslint-disable-next-line no-restricted-syntax -- 다자리 입력 중간값이 autosave idle(900ms)을 지나도 PATCH되지 않는지 검증.
    await page.waitForTimeout(1_200);
    expect(scorePatches).toHaveLength(0);
    await page.keyboard.type("4");
    await cells.nth(0).press("Enter");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(1);
    expect(scorePatches[0]).toMatchObject({ score: 74, max_score: 100 });
    await expect(page.getByRole("status")).toContainText("자동 저장 실패");
    await page
      .getByRole("button", { name: "저장하고 잠금", exact: true })
      .click();
    await expect(editButton).toBeVisible();
    expect(scorePatches).toHaveLength(1);
    await editButton.click();
    await expect(page.getByRole("status")).toContainText("저장됨");

    await page.keyboard.press("Control+z");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(2);
    expect(scorePatches[1]).toMatchObject({ score: 65, max_score: 100 });
    await expect(cells.nth(0)).toHaveText("65");

    await page.keyboard.press("Control+Shift+z");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(3);
    expect(scorePatches[2]).toMatchObject({ score: 74, max_score: 100 });
    await expect(cells.nth(0)).toHaveText("74");

    await cells.nth(0).fill("77");
    await page.keyboard.press("Control+s");
    await expect.poll(() => scorePatches.length, { timeout: 10_000 }).toBe(4);
    expect(scorePatches[3]).toMatchObject({ score: 77, max_score: 100 });
    expect(draftPuts.length).toBeGreaterThanOrEqual(4);

    await cells.nth(0).click();
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 })
      .toBe(74);
    await page.keyboard.press("Control+z");
    await expect
      .poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 })
      .toBe(65);
    await page.keyboard.press("Control+Shift+z");
    await expect
      .poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 })
      .toBe(74);
    await page.keyboard.press("Control+Shift+z");
    await expect
      .poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 })
      .toBe(77);

    const patchCountBeforeNativeUndo = scorePatches.length;
    const searchInput = page.getByRole("searchbox", { name: "학생 이름 검색" });
    await searchInput.fill("자동");
    await searchInput.press("Control+z");
    await expect
      .poll(() => scorePatches.length)
      .toBe(patchCountBeforeNativeUndo);

    await page
      .getByRole("button", { name: "저장하고 잠금", exact: true })
      .click();
    await expect(editButton).toBeVisible();
    await expect(page.getByRole("status")).toContainText("입력 잠금됨");
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
    await expect(
      page.getByRole("cell", { name: /77\/100/ }).first(),
    ).toBeVisible();

    await editButton.click();
    await cells.nth(0).fill("77.5");
    await page.keyboard.press("Control+s");
    await expect
      .poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 })
      .toBe(77.5);
    await page
      .getByRole("button", { name: "저장하고 잠금", exact: true })
      .click();
    await expect(editButton).toBeVisible();
    await expect(
      page.getByRole("cell", { name: /77\.5\/100/ }).first(),
    ).toBeVisible();

    await editButton.click();
    delayNextScorePatchMs = 1_500;
    await cells.nth(0).fill("79");
    await cells.nth(0).press("Enter");
    await expect(page.getByRole("status")).toContainText("자동 저장 중");
    await cells.nth(1).fill("81");
    await page
      .getByRole("button", { name: "출결", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/attendance/);
    await expect
      .poll(() => scorePatches.at(-2)?.score, { timeout: 10_000 })
      .toBe(79);
    await expect
      .poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 })
      .toBe(81);
    await page
      .getByRole("button", { name: "성적", exact: true })
      .first()
      .click();
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("cell", { name: /79\/100/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: /81\/100/ }).first(),
    ).toBeVisible();

    await editButton.click();
    failNextDraftPut = true;
    await cells.nth(0).fill("83");
    await page
      .getByRole("button", { name: "출결", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/attendance/);
    await page
      .getByRole("button", { name: "성적", exact: true })
      .first()
      .click();
    const recoveryDialog = page.getByRole("dialog", {
      name: /임시저장된 변경 1건/,
    });
    await expect(recoveryDialog).toBeVisible({ timeout: 10_000 });
    await expect(editButton).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "OMR 스캔 등록" }),
    ).toBeDisabled();
    const releasedBeforeRecoveryNavigation = draftCommits.filter(
      (commit) => commit.release_lease === true,
    ).length;
    await page
      .getByRole("button", { name: "출결", exact: true })
      .first()
      .evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page).toHaveURL(/\/attendance/);
    await expect
      .poll(
        () =>
          draftCommits.filter((commit) => commit.release_lease === true).length,
        { timeout: 2_000 },
      )
      .toBe(releasedBeforeRecoveryNavigation);
    await page
      .getByRole("button", { name: "성적", exact: true })
      .first()
      .click();
    await expect(recoveryDialog).toBeVisible({ timeout: 10_000 });
    failNextDraftCommit = true;
    await recoveryDialog.getByRole("button", { name: "버리기" }).click();
    await expect(recoveryDialog).toBeVisible();
    await expect(recoveryDialog.getByRole("alert")).toContainText(
      /실패|failed|500/i,
    );
    await recoveryDialog.getByRole("button", { name: "복원 후 수정" }).click();
    await expect(
      page.getByRole("button", { name: "저장하고 잠금", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => scorePatches.at(-1)?.score, { timeout: 10_000 })
      .toBe(83);
    await page
      .getByRole("button", { name: "저장하고 잠금", exact: true })
      .click();
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".ds-scores-cell-editable")).toHaveCount(0);
    await expect(
      page.getByRole("cell", { name: /83\/100/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: /임시저장된 변경/ }),
    ).toHaveCount(0);

    await editButton.click();
    failNextLeaseRelease = true;
    await page
      .getByRole("button", { name: "저장하고 잠금", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "잠금 다시 시도", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".ds-scores-cell-editable").first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "잠금 다시 시도", exact: true })
      .click();
    await expect(editButton).toBeVisible();
    await expect(page.getByRole("status")).toContainText("입력 잠금됨");

    expect(scorePatchHeaders.length).toBeGreaterThan(0);
    for (const headers of scorePatchHeaders) {
      expect(headers["x-score-editor-client"]).toBeTruthy();
      expect(headers["x-score-session-id"]).toMatch(/^\d+$/);
    }
  });
});

import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { assertNoHorizontalOverflow, expectApi, QA_BASE } from "./qaStudentParentScenario";
import { gotoAndSettle } from "./wait";

type Submission = { homeworkId: number; enrollmentId: number; sessionId: number; title: string; filename: string };
const homeworkPath = (id: number) => `/submissions/submissions/homework/${id}/`;

export async function verifyHomeworkReviewQueue(
  student: Page, staff: Page, request: APIRequestContext, studentToken: string, staffToken: string,
  submissions: [Submission, Submission],
) {
  const [first, second] = submissions;
  await gotoAndSettle(student, `${QA_BASE}/student/submit/assignment?sessionId=${second.sessionId}&homeworkId=${second.homeworkId}`);
  await expect(student.getByText(second.filename, { exact: true })).toBeVisible();
  const [upload] = await Promise.all([
    student.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/v1${homeworkPath(second.homeworkId)}media/`),
    student.getByRole("button", { name: "파일 1개 제출하기", exact: true }).click(),
  ]);
  expect(upload.status()).toBe(201);
  const file = await upload.json();
  const previousViewport = staff.viewportSize()!;
  const restores: Array<() => Promise<unknown>> = [];
  const failures: string[] = [];
  try {
    expect(file).toMatchObject({ original_filename: second.filename, status: "uploaded", id: expect.any(String) });

    await staff.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(staff, `${QA_BASE}/workspace/results/submissions`);
    await staff.getByRole("button", { name: /^알림(?:$| \(일부 로드 실패\)$)/ }).click();
    await staff.getByRole("button", { name: /확인 대기 과제 제출/ }).click();
    const list = staff.getByRole("list", { name: "확인 대기 학생 제출물" });
    const row = (s: Submission) => list.getByRole("listitem").filter({ has: staff.getByText(s.title, { exact: true }) });
    for (const width of [1366, 1100, 390]) {
      await staff.setViewportSize({ width, height: 900 });
      for (const s of submissions) {
        await expect(row(s).getByRole("link")).toHaveAttribute("href", new RegExp(`homework=${s.homeworkId}&.*reviewEnrollment=${s.enrollmentId}(?:&|$)`));
        await expect(row(s).locator("time")).toHaveAttribute("datetime", /^\d{4}-/);
        await expect(row(s).getByRole("checkbox")).toBeEnabled();
      }
      await assertNoHorizontalOverflow(staff);
      await staff.screenshot({ path: test.info().outputPath(`teacher-homework-queue-real-${width}.png`) });
    }
    await staff.setViewportSize({ width: 1366, height: 900 });
    await row(second).getByRole("button", { name: /제출 파일 1개 미리보기/ }).click();
    await expect(row(second).getByText(second.filename, { exact: true })).toBeVisible();
    await row(second).getByRole("button", { name: "미리보기", exact: true }).click();
    const preview = staff.getByRole("dialog").filter({ hasText: second.filename });
    await expect.poll(() => preview.getByRole("img", { name: /과제 제출 미리보기/ })
      .evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await preview.getByRole("button", { name: "닫기", exact: true }).last().click();
    await row(second).getByRole("link").click();
    await expect(staff.getByText(second.filename, { exact: true })).toBeVisible();
    const next = staff.getByRole("link", { name: /^다음 대기 제출/ });
    await expect(next).toHaveAttribute("href", new RegExp(`homework=${first.homeworkId}&.*reviewEnrollment=${first.enrollmentId}(?:&|$)`));
    await next.click();
    await expect(staff.getByText(first.filename, { exact: true })).toBeVisible();
    await staff.getByRole("button", { name: "과제 목록으로 돌아가기", exact: true }).click();
    for (const s of submissions) await row(s).getByRole("checkbox").check();
    await staff.getByRole("button", { name: "선택 2건 통과", exact: true }).click();
    const confirmation = staff.getByRole("alertdialog");
    await expect(confirmation).toContainText("과제 2개");
    const writes = submissions.map(async s => {
      const path = homeworkPath(s.homeworkId) + "acceptance/";
      const saved = await staff.waitForResponse(r => r.request().method() === "PATCH"
        && new URL(r.url()).pathname === `/api/v1${path}`);
      expect(saved.status()).toBe(200);
      const result = await saved.json();
      const body = saved.request().postDataJSON();
      expect(body).toMatchObject({ enrollment_id: s.enrollmentId, accepted: true, expected_media_set_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
      expect(result).toMatchObject({ teacher_accepted: true, teacher_accepted_updated_at: expect.any(String) });
      restores.push(() => expectApi(request, "PATCH", path, staffToken, {
        ...body, accepted: false, expected_updated_at: result.teacher_accepted_updated_at,
      }, [200]));
    });
    const outcomes = await Promise.allSettled([
      confirmation.getByRole("button", { name: "2건 통과 처리" }).click(), ...writes,
    ]);
    for (const outcome of outcomes) if (outcome.status === "rejected") throw outcome.reason;
    await expect(staff.getByText("통과 2건", { exact: true })).toBeVisible();
    await staff.reload({ waitUntil: "domcontentloaded" });
    await expect(list.or(staff.getByText("확인 대기 과제가 없습니다", { exact: true }))).toBeVisible();
    await expect.poll(async () => {
      const grades = await expectApi<{ homeworks: unknown[] }>(request, "GET", "/student/grades/", studentToken);
      return grades.homeworks;
    }, { timeout: 45_000 }).toEqual(expect.arrayContaining(submissions.map(s => expect.objectContaining({
      homework_id: s.homeworkId, teacher_accepted: true, score: null, passed: true,
    }))));
    for (const s of submissions) await expect(row(s)).toHaveCount(0);
  } finally {
    const media = homeworkPath(second.homeworkId) + "media/";
    if (typeof file.id === "string" && file.original_filename === second.filename) {
      restores.push(
        () => expectApi(request, "DELETE", media + encodeURIComponent(file.id) + "/", studentToken, { enrollment_id: second.enrollmentId }, [204]),
        async () => expect(await expectApi(request, "GET", `${media}?enrollment_id=${second.enrollmentId}`, studentToken)).toMatchObject({ files: [] }),
      );
    }
    restores.push(() => staff.setViewportSize(previousViewport));
    for (const restore of restores) {
      try { await restore(); }
      catch (error) { failures.push(String(error)); }
    }
    if (failures.length) {
      const description = failures.join("\n");
      test.info().annotations.push({ type: "cleanup", description });
    }
  }
  if (failures.length) throw new Error(failures.join("\n"));
}

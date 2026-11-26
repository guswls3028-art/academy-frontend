import { readFile } from "node:fs/promises";
import type { APIRequestContext } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { expect, test } from "../fixtures/strictTest";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";
import {
  api, assertNoHorizontalOverflow, assertQaStudentParentRuntime, createQaFamily, expectApi,
  installQaStudentParentBoundary, loginAdmin, QA_API, QA_BASE, QA_TENANT, seedBrowserAuth,
  STUDENT_PARENT_REALUSE_ENABLED,
} from "../helpers/qaStudentParentScenario";

test.setTimeout(720_000);
test.use({ serviceWorkers: "block", trace: "off", video: "off", screenshot: "off" });
test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Runs in the owned isolated development tenant only.");

const range = { from_session_order: 1, to_session_order: 2 };
const scope = { token: "", batchId: 0, uploads: [] as number[] };
type Proposal = { id: number; number: number; problem_image_url: string };
type Review = { status: string; items: Proposal[] };

async function paper(title: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  page.drawText(title, { x: 42, y: 802, size: 15, font });
  for (let n = 1; n <= 5; n++) {
    const y = 752 - 143 * (n - 1);
    page.drawText(`${n}. Calculate the sum of ${n} and one.`, { x: 45, y, size: 12, font });
    page.drawRectangle({ x: 60, y: y - 51, width: 105, height: 26, borderWidth: 1, opacity: 0.12 });
    page.drawText("A. 1      B. 2      C. 3      D. 4      E. 5", { x: 55, y: y - 78, size: 10, font });
  }
  return Buffer.from(await pdf.save());
}

async function approvePaper(request: APIRequestContext, examId: number, title: string, answers: number[]) {
  scope.uploads.push(examId);
  const upload = await request.post(`${QA_API}/api/v1/exams/pdf-extract/`, {
    headers: { Authorization: `Bearer ${scope.token}`, "X-Tenant-Code": QA_TENANT },
    multipart: { exam_id: String(examId), file: { name: "qa-paper.pdf", mimeType: "application/pdf", buffer: await paper(title) } },
  });
  expect(upload.status()).toBe(202);
  const reviewPath = `/exams/${examId}/segmentation-review/`;
  await expect.poll(async () => (await expectApi<Review>(request, "GET", reviewPath, scope.token)).status,
    { timeout: 300_000, intervals: [2000, 5000] }).toBe("review_required");
  const review = await expectApi<Review>(request, "GET", reviewPath, scope.token);
  expect(review.items.map(row => row.number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  expect(review.items.every(row => Boolean(row.problem_image_url))).toBe(true);
  await expectApi(request, "POST", reviewPath + "approve/", scope.token, {
    items: review.items.map(({ id, number }) => ({ id, number, included: true })),
  });
  const questions = await expectApi<Array<{ id: number; number: number }>>(request, "GET", `/exams/${examId}/questions/`, scope.token);
  await expectApi(request, "POST", "/exams/answer-keys/", scope.token, {
    exam: examId, answers: Object.fromEntries(questions.map(q => [q.id, String(answers[q.number - 1])])),
  });
}

test.afterEach(async ({ request }) => {
  // The fixed Setup/Inspect/Cleanup owner removes the entire sealed synthetic tenant, R2 and AI inventory.
  for (const id of scope.uploads) {
    await expect.poll(async () => (await api<Review>(request, "GET", `/exams/${id}/segmentation-review/`, scope.token)).body.status,
      { timeout: 180_000, intervals: [2000, 5000] }).not.toBe("processing");
  }
  if (scope.batchId) {
    await expect.poll(async () => (await api<{ status: string }>(request, "GET",
      `/results/wrong-notes/batches/${scope.batchId}/`, scope.token)).body.status,
    { timeout: 240_000, intervals: [2000, 5000] }).toMatch(/^(DONE|FAILED)$/);
  }
});

test("선생님이 1~2차시 시험·과제에서 번호를 입력해 학생별 PDF ZIP을 내려받는다", async ({ page, request }) => {
  assertQaStudentParentRuntime();
  const boundary = await installQaStudentParentBoundary(page, request);
  const guards = attachStrictBrowserGuards(page);
  const tokens = await loginAdmin(request);
  scope.token = tokens.access;
  const stamp = String(Date.now());
  const family = await createQaFamily(request, scope.token, `wrong-note-${stamp}`, 2, {
    highSchool: `QA 오답노트고등학교 ${stamp}`,
  });
  const lecture = await expectApi<{ id: number }>(request, "POST", "/lectures/lectures/", scope.token, {
    title: `QA 차시 오답노트 ${stamp}`, name: "QA Science", subject: "SCIENCE", start_date: "2026-01-01", is_active: true,
  });
  const sessions: number[] = [];
  for (const order of [1, 2]) {
    const session = await expectApi<{ id: number }>(request, "POST", "/lectures/sessions/", scope.token,
      { lecture: lecture.id, order, regular_order: order, date: `2026-01-0${order}`, title: `${order}차시` });
    sessions.push(session.id);
  }
  const enrolled = await expectApi<Array<{ id: number; student: { id: number } }>>(request, "POST",
    "/enrollments/bulk_create/", scope.token, { lecture: lecture.id, students: family.students.map(s => s.id) });
  const ids = enrolled.map(e => e.id);
  expect(ids).toHaveLength(2);
  for (const session of sessions) {
    await expectApi(request, "POST", "/enrollments/session-enrollments/bulk_create/", scope.token, { session, enrollments: ids });
  }
  const exam = await expectApi<{ id: number }>(request, "POST", "/exams/", scope.token, {
    title: "QA Exam", exam_type: "regular", session_id: sessions[0], grading_mode: "choice", max_score: 100,
  });
  await expectApi(request, "PUT", `/exams/${exam.id}/enrollments/?session_id=${sessions[0]}`, scope.token, { enrollment_ids: ids });
  const hw = await expectApi<{ id: number }>(request, "POST", "/homeworks/", scope.token, {
    session_id: sessions[1], title: "QA Workbook", grading_mode: "SCORE", max_score: 100,
  });
  const book = await expectApi<{ source_exam_id: number }>(request, "POST", `/homeworks/${hw.id}/source-exam/`, scope.token);
  await expectApi(request, "PUT", `/homework/assignments/?homework_id=${hw.id}`, scope.token, { enrollment_ids: ids });
  await approvePaper(request, exam.id, "Synthetic exam", [1, 2, 3, 4, 5]);
  await approvePaper(request, book.source_exam_id, "Synthetic workbook", [5, 4, 3, 2, 1]);

  await seedBrowserAuth(page, tokens);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${QA_BASE}/workspace/lectures/${lecture.id}/sessions/${sessions[0]}/scores`);
  await acknowledgeInitialAccountPromptsIfVisible(page);
  async function open() {
    await page.getByRole("button", { name: "성적 도구", exact: true }).click();
    await page.getByRole("menuitem", { name: /차시별 오답노트/ }).click();
    return page.getByRole("dialog", { name: "차시별 오답노트" });
  }
  let dialog = await open();
  await dialog.getByLabel("끝 차시").selectOption(String(range.to_session_order));
  const [first, second] = family.students;
  await dialog.getByLabel("오답을 입력할 자료").selectOption(`exam:${exam.id}`);
  await dialog.getByLabel(first.name + " 오답 번호").fill("1");
  await dialog.getByLabel(second.name + " 오답 번호").fill("3");
  await dialog.getByLabel("오답을 입력할 자료").selectOption(`homework:${hw.id}`);
  await dialog.getByLabel(first.name + " 오답 번호").fill("2");
  const created = page.waitForResponse(r => r.request().method() === "POST"
    && new URL(r.url()).pathname === "/api/v1/results/wrong-notes/batches/");
  await dialog.getByRole("button", { name: "2명 오답노트 묶음 만들기" }).click();
  const response = await created;
  expect(response.status()).toBe(202);
  scope.batchId = (await response.json()).id;
  expect(scope.batchId).toBeGreaterThan(0);
  await expect(dialog.getByRole("region", { name: "문서 생성 결과" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  dialog = await open();
  await expect(dialog.getByText("오답노트가 준비됐습니다")).toBeVisible({ timeout: 240_000 });
  await assertNoHorizontalOverflow(page);
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "학생별 PDF 묶음 다운로드" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("1-2차시_학생별_오답노트.zip");
  const archive = await JSZip.loadAsync(await readFile((await download.path())!));
  expect(Object.keys(archive.files)).toHaveLength(2);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  for (const student of [first, second]) {
    const enrollment = enrolled.find(e => e.student.id === student.id)!;
    const entry = archive.file(`${student.name}_${enrollment.id}_오답노트.pdf`);
    expect(entry).toBeTruthy();
    const task = getDocument({ data: new Uint8Array(await entry!.async("uint8array")), useSystemFonts: true });
    try {
      const pdf = await task.promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        pages.push(content.items.flatMap(item => "str" in item ? [item.str] : []).join(" "));
      }
      const all = pages.join("\n");
      expect(all).toContain(student.name);
      expect(all).not.toContain(student.id === first.id ? second.name : first.name);
      expect([...all.matchAll(/정답\s+([1-5])(?:\s|$)/g)].map(match => match[1]))
        .toEqual(student.id === first.id ? ["1", "4"] : ["3"]);
    } finally {
      await task.destroy();
    }
  }
  boundary.assertClean();
  guards.assertZeroDefects();
});

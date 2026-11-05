import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "../fixtures/strictTest";
import { gotoAndSettle } from "../helpers/wait";
import type { Survey, SurveyResponse, SurveyResponseInput } from "../../src/shared/api/surveys";
import type { StudentReportedScoreSubmission } from "../../src/shared/api/contracts/storage";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const evidence = Buffer.from("%PDF-1.4\nsurvey evidence\n%%EOF");
const now = "2026-11-05T10:00:00Z";
const reportedScore = { id: 701, student_id: 11, source: "school_exam", academic_year: 2026, semester: 2, exam_round: "second", subject: "수학", score: 93, max_score: 100, status: "pending", label: "2026년 2학기 기말", review_note: "", evidence_file_id: 801 } as StudentReportedScoreSubmission;

async function installApi(page: Page) {
  const token = `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })).toString("base64url")}.sig`;
  await page.addInitScript((access) => {
    localStorage.setItem("access", access); localStorage.setItem("refresh", `${access}-refresh`);
    localStorage.setItem("tenant_code", "hakwonplus"); sessionStorage.setItem("tenantCode", "hakwonplus");
  }, token);
  const state = {
    role: "admin" as "admin" | "student" | "parent", failNextSave: false, studentHeaders: [] as string[], createdKeys: [] as string[],
    response: null as SurveyResponse | null, scoreUploaded: false, uploads: [] as string[],
    survey: { id: 91, title: "보강 시간 조사", description: "가능한 시간을 선택하고 시험 범위를 첨부해 주세요.", kind: "general", status: "draft", questions: [], audience: { mode: "all", student_ids: [] }, score_defaults: {}, allow_attachments: true, opens_at: null, closes_at: null, response_limit: null, version: 1, published_at: null, created_at: now, updated_at: now, target_count: 2, response_count: 0, can_respond: true, answered: false, response_unavailable_reason: "" } as Survey,
  };
  const file = { id: "801", displayName: "시험범위.pdf", name: "시험범위.pdf", r2Key: "tenants/1/student/S0011/801.pdf", sizeBytes: evidence.length, contentType: "application/pdf", description: "설문 첨부", folderId: null, createdAt: now };
  await page.route(`${BASE}/qa-survey-evidence.pdf`, (route) => route.fulfill({ body: evidence, contentType: "application/pdf" }));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (data: unknown, status = 200) => route.fulfill({ json: data, status });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") return json({ tenantCode: "hakwonplus", display_name: "학원플러스", isPlatformAdmin: true, is_active: true, feature_flags: {}, ui_config: {} });
    if (path === "/core/me/") return json({ id: state.role === "admin" ? 12 : 11, username: state.role, name: "설문 검증", is_staff: state.role === "admin", is_superuser: state.role === "admin", tenantRole: state.role, must_change_password: false, linkedStudents: state.role === "parent" ? [{ id: 11, name: "김학생" }] : [] });
    if (path === "/student/me/") return json({ id: 11, name: "김학생", ps_number: "S0011", grade: 2, school_type: "HIGH", high_school: "검증고", isParentReadOnly: state.role === "parent" });
    if (path === "/storage/inventory/upload/") {
      state.uploads.push(request.postData() || "");
      state.scoreUploaded = state.survey.kind === "school_score";
      return json(state.scoreUploaded ? { ...file, scoreSubmissions: [reportedScore] } : file);
    }
    if (path === "/storage/inventory/presign/") return json({ url: `${BASE}/qa-survey-evidence.pdf` });
    if (path === "/storage/inventory/") return json({ files: state.scoreUploaded ? [{ ...file, scoreSubmissions: [reportedScore] }] : [], folders: [] });
    if (path === "/surveys/" && request.method() === "POST") {
      const data = request.postDataJSON(); state.createdKeys.push(data.creation_key);
      Object.assign(state.survey, data); return json(state.survey, 201);
    }
    if (path === "/surveys/91/publish/") { Object.assign(state.survey, { status: "open", published_at: now, version: state.survey.version + 1 }); return json(state.survey); }
    if (path === "/surveys/91/close/") { Object.assign(state.survey, { status: "closed", can_respond: false, response_unavailable_reason: "응답이 마감되었습니다.", version: state.survey.version + 1 }); return json(state.survey); }
    if (path === "/surveys/91/") return json(state.survey);
    if (path === "/surveys/student/91/") return json({ survey: state.survey, response: state.response });
    if (path === "/surveys/student/91/response/") {
      state.studentHeaders.push(request.headers()["x-student-id"] || "");
      if (state.failNextSave) { state.failNextSave = false; return json({ detail: "연결이 잠시 끊겼습니다. 다시 제출해 주세요." }, 503); }
      const data = request.postDataJSON() as SurveyResponseInput;
      state.response = { id: 501, survey_id: 91, survey_title: state.survey.title, kind: state.survey.kind, questions: state.survey.questions, student_id: 11, student_name: "김학생", student_ps: "S0011", answers: data.answers, version: (state.response?.version || 0) + 1, created_at: now, updated_at: now, attachments: data.attachment_ids.length ? [{ id: 801, name: file.name, size_bytes: evidence.length, content_type: file.contentType, r2_key: file.r2Key }] : [], score_submissions: [] };
      state.response.score_submissions = data.score_submission_ids.length ? [reportedScore] : [];
      state.survey.response_count = 1; state.survey.answered = true;
      return json(state.response);
    }
    if (path === "/surveys/91/responses/") {
      const rows = [{ student_id: 11, student_name: "김학생", answered: Boolean(state.response), response: state.response }, { student_id: 12, student_name: "이학생", answered: false, response: null }].filter((row) => url.searchParams.get("response_status") !== "unanswered" || !row.answered);
      return json({ count: rows.length, survey: state.survey, results: rows });
    }
    if (path === "/surveys/91/statistics/") return json({ response_count: 1, target_count: 2, questions: [{ id: "time", label: "가능한 시간", options: [{ label: "토요일", count: 1 }, { label: "일요일", count: 0 }] }] });
    if (path === "/surveys/91/export/") return route.fulfill({ body: "\ufeff학생,응답 상태\r\n김학생,응답 완료\r\n", contentType: "text/csv" });
    if (path === "/surveys/" || path === "/surveys/student/") return json({ count: 1, results: [state.survey] });
    return json({ count: 0, results: [] });
  });
  return state;
}

test.describe("설문 작성·응답·취합", () => {
  test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE), "Local route-mock contract only");
  test.use({ serviceWorkers: "block" });
  test("성적 취합에서 요청한 시험·과목으로 원본을 등록하고 최종 응답을 저장한다", async ({ page }) => {
    const state = await installApi(page);
    state.role = "parent";
    Object.assign(state.survey, { title: "2학기 기말 성적 취합", status: "open", kind: "school_score", published_at: now,
      score_defaults: { source: "school_exam", academic_year: 2026, semester: 2, exam_round: "second", subject: "수학" } });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndSettle(page, `${BASE}/student/surveys/91`);
    await expect(page.getByRole("button", { name: "성적표 새로 등록", exact: true })).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "성적표 새로 등록", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "학기", exact: true })).toHaveValue("2");
    await expect(page.getByTestId("score-exam-round")).toHaveValue("second");
    await page.getByLabel("받은 점수").fill("93");
    await page.locator('input[type="file"]').setInputFiles({ name: "성적표.pdf", mimeType: "application/pdf", buffer: evidence });
    await page.getByRole("button", { name: "성적표 보내기", exact: true }).click();
    await expect(page.getByText(/1과목이 이 설문과 연결됩니다/)).toBeVisible();
    expect(state.response).toBeNull();
    expect(state.uploads[0]).toContain("second");
    expect(state.uploads[0]).toContain("수학");
    await page.getByRole("button", { name: "응답 제출", exact: true }).click();
    await expect(page.getByText("응답을 제출했습니다.", { exact: true })).toBeVisible();
    expect(state.response?.score_submissions.map((score) => score.id)).toEqual([701]);
    expect(state.studentHeaders).toEqual(["11"]);
    await page.reload();
    await expect(page.getByText("선생님 확인 대기", { exact: true })).toBeVisible();
    await expect(page.getByText("수학 93/100점", { exact: true })).toBeVisible();
  });
  for (const width of [1366, 390]) test(`교직원 작성부터 학부모 응답·재조회·ZIP까지 (${width}px)`, async ({ page }, testInfo) => {
    const state = await installApi(page);
    await page.setViewportSize({ width, height: 900 });
    await gotoAndSettle(page, `${BASE}/workspace/students/surveys/new`);
    await expect(page.getByLabel("설문 제목")).toBeVisible({ timeout: 45_000 });
    await page.getByLabel("설문 제목").fill("보강 시간 조사");
    await page.getByLabel("질문 제목").fill("가능한 시간");
    await page.getByLabel("응답 방식").selectOption("single_choice");
    await page.getByRole("textbox", { name: /^선택지/ }).fill("토요일\n일요일");
    await page.getByText("응답 기간·정원·첨부 설정", { exact: true }).click();
    await page.getByLabel("사진·PDF 첨부 받기").check();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`survey-create-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "설문 저장", exact: true }).click();
    await expect(page.getByRole("heading", { name: "배포 전 확인" })).toBeVisible();
    expect(state.createdKeys[0]).toMatch(/^[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "응답 시작", exact: true }).click();
    await expect(page.getByText(/대상 학생의 설문 목록/)).toBeVisible();

    state.role = "parent"; state.failNextSave = true;
    await gotoAndSettle(page, `${BASE}/student/surveys/91`);
    await expect(page.getByLabel("토요일", { exact: true })).toBeVisible({ timeout: 45_000 });
    await page.getByLabel("토요일", { exact: true }).check();
    await page.getByLabel("설문 첨부파일").setInputFiles({ name: "시험범위.pdf", mimeType: "application/pdf", buffer: evidence });
    await expect(page.getByRole("button", { name: "응답 제출", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "응답 제출", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("연결이 잠시 끊겼습니다");
    await expect(page.getByLabel("토요일", { exact: true })).toBeChecked();
    await page.reload();
    await page.getByRole("button", { name: "작성하던 응답 이어쓰기", exact: true }).click();
    await expect(page.getByLabel("토요일", { exact: true })).toBeChecked();
    await page.getByRole("button", { name: "응답 제출", exact: true }).click();
    await expect(page.getByText("응답을 제출했습니다.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("응답을 제출했습니다.", { exact: true })).toBeVisible();
    expect(state.studentHeaders).toEqual(["11", "11"]);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`survey-student-saved-${width}.png`), fullPage: true });

    state.role = "admin";
    await gotoAndSettle(page, `${BASE}/workspace/students/surveys/91`);
    await page.getByRole("button", { name: "미응답", exact: true }).click();
    await expect(page.getByText("이학생", { exact: true })).toBeVisible();
    await expect(page.getByText("김학생", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "전체", exact: true }).click();
    await page.getByText("현재 목록의 첨부 묶음 받기", { exact: true }).click();
    const zipDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "묶음 1 · 1개", exact: true }).click();
    const zipPath = await (await zipDownload).path();
    const zip = await JSZip.loadAsync(await readFile(zipPath!));
    expect(await zip.file("김학생-11/801-시험범위.pdf")?.async("nodebuffer")).toEqual(evidence);
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "응답 내려받기", exact: true }).click();
    expect((await readFile((await (await csvDownload).path())!, "utf8"))).toContain("김학생,응답 완료");
    await page.getByRole("button", { name: "응답 마감", exact: true }).click();
    await expect(page.getByRole("button", { name: "다시 응답 받기", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`survey-results-${width}.png`), fullPage: true });
  });
});

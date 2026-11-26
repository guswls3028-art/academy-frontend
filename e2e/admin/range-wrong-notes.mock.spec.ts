import { expect, test, type Page } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { createLocalJwt, installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { installWorkspaceReadApiStubs } from "../helpers/workspaceReadApiStubs";

const lecture = 7100;
const sessions = [
  { id: 7111, lecture, order: 1, regular_order: 1, session_type: "REGULAR", title: "1차시" },
  { id: 7112, lecture, order: 2, regular_order: null, session_type: "SUPPLEMENT", title: "보강" },
  { id: 7113, lecture, order: 3, regular_order: 2, session_type: "REGULAR", title: "2차시" },
];
const students = [
  { enrollment_id: 21, student_id: 121, name: "가온" },
  { enrollment_id: 22, student_id: 122, name: "나래" },
  { enrollment_id: 23, student_id: 123, name: "다온" },
];
const sources = [
  { type: "exam", id: 51, title: "통합과학 기말고사", session_order: 1, question_numbers: [1, 2, 7, 25], unavailable_numbers: [2], enrollment_ids: [21, 22, 23], ready: true },
  { type: "homework", id: 61, title: "실험 분석 과제", session_order: 2, question_numbers: [3, 4], unavailable_numbers: [], enrollment_ids: [21], ready: true },
];
type Requested = { enrollment_id: number; sources: { type: string; id: number; numbers: number[] }[] };

async function setup(page: Page) {
  const url = getBaseUrl("admin");
  test.skip(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url), "로컬 프론트엔드 전용 경로 모의 시험");
  await installLocalAuthApiStubs(page);
  await installWorkspaceReadApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript(token => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", token);
  }, createLocalJwt());

  const payloads: { lecture_id: number; from_session_order: number; to_session_order: number; students: Requested[] }[] = [];
  const otherWrites: string[] = [];
  let fail = true;
  let retries = 0;
  await page.route("https://example.test/attachments/*", route => {
    const single = route.request().url().endsWith(".pdf");
    const filename = single ? "가온 오답노트.pdf" : "학생별 오답노트.zip";
    return route.fulfill({ contentType: single ? "application/pdf" : "application/zip",
      headers: { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` },
      body: single ? "%PDF-synthetic" : "PK-synthetic" });
  });
  const batch = () => ({
    id: 82, status: fail ? "FAILED" : "DONE",
    students: payloads[payloads.length - 1].students.map((s, index) => ({
      enrollment_id: s.enrollment_id, name: students.find(x => x.enrollment_id === s.enrollment_id)!.name,
      status: fail && !index ? "FAILED" : "DONE", error_message: fail && !index ? "다시 시도해 주세요." : "",
    })),
  });
  await page.route("**/api/v1/**", async route => {
    const req = route.request();
    const { pathname: path, searchParams } = new URL(req.url());
    if (path.endsWith("/wrong-notes/range/")) {
      expect(searchParams.get("lecture_id")).toBe(String(lecture));
      const from = Number(searchParams.get("from_session_order")), to = Number(searchParams.get("to_session_order"));
      return route.fulfill({ json: { lecture_id: lecture, from_session_order: from, to_session_order: to,
        students, sources: sources.filter(s => s.session_order >= from && s.session_order <= to) } });
    }
    if (path.endsWith("/wrong-notes/batches/") && req.method() === "POST") {
      payloads.push(req.postDataJSON());
      return route.fulfill({ json: { ...batch(), status: "PENDING" } });
    }
    if (path.endsWith("/batches/82/retry/") && req.method() === "POST") {
      retries++;
      fail = false;
      return route.fulfill({ json: batch() });
    }
    if (path.endsWith("/batches/82/download/")) {
      const single = batch().students.length === 1;
      return route.fulfill({ json: {
        url: `https://example.test/attachments/student.${single ? "pdf" : "zip"}`,
        filename: single ? "가온 오답노트.pdf" : "학생별 오답노트.zip",
      } });
    }
    if (path.endsWith("/batches/82/")) return route.fulfill({ json: batch() });
    if (!["GET", "OPTIONS"].includes(req.method())) {
      otherWrites.push(path);
      return route.fulfill({ status: 409, json: { detail: "예상하지 않은 변경" } });
    }
    if (path.endsWith("/lectures/sessions/")) return route.fulfill({ json: sessions });
    if (path.endsWith("/lectures/sessions/7111/")) return route.fulfill({ json: sessions[0] });
    if (path.endsWith("/lectures/lectures/7100/")) return route.fulfill({ json: { id: lecture, title: "합성 수업" } });
    if (path.endsWith("/7111/schedules/")) return route.fulfill({ json: { version: "1", schedules: [], roster: [], unassigned_enrollment_ids: [] } });
    if (path.endsWith("/7111/scores/")) return route.fulfill({ json: { meta: { lecture_id: lecture, lecture_title: "합성 수업", session_title: "1차시", exams: [], homeworks: [] }, rows: [] } });
    if (path.endsWith("/7111/score-draft/")) return route.fulfill({ json: { changes: [], active_editors: [], stale: false } });
    if (path.endsWith("/lectures/attendance/") || path.endsWith("/enrollments/session-enrollments/")) return route.fulfill({ json: { count: 0, results: [] } });
    return route.fallback();
  });
  await page.goto(`${url}/workspace/lectures/${lecture}/sessions/7111/scores`);
  return { payloads, otherWrites, retries: () => retries };
}

async function open(page: Page) {
  await page.getByRole("button", { name: "성적 도구", exact: true }).click();
  await page.getByRole("menuitem", { name: /차시별 오답노트/ }).click();
  return page.getByRole("dialog", { name: "차시별 오답노트" });
}

for (const width of [390, 1366]) {
  test(`차시 범위의 학생별 시험·과제 오답 입력과 문서 복구 (${width}px)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const api = await setup(page);
    let dialog = await open(page);
    await expect(dialog.getByLabel("시작 차시").locator("option")).toHaveCount(2);
    await dialog.getByLabel("끝 차시").selectOption("2");
    const material = () => dialog.getByLabel("오답을 입력할 자료");
    await expect(material().locator("option")).toHaveCount(2);
    await dialog.getByLabel("가온 오답 번호").fill("2");
    await expect(dialog.getByText("문제와 정답이 준비된 번호만 입력해 주세요.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "오답노트 만들기", exact: true })).toBeDisabled();
    await dialog.getByLabel("가온 오답 번호").fill("25, 1, 25");
    await dialog.getByLabel("나래 오답 번호").fill("7");
    await material().selectOption("homework:61");
    await expect(dialog.getByLabel("나래 오답 번호")).toHaveCount(0);
    const homeworkNumber = dialog.getByLabel("가온 오답 번호");
    await homeworkNumber.fill("4");
    await homeworkNumber.scrollIntoViewIfNeeded();
    await expect(homeworkNumber).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByText("2명 출력 대상 · 1명 제외")).toBeVisible();
    const createBundle = dialog.getByRole("button", { name: "2명 오답노트 묶음 만들기" });
    await createBundle.scrollIntoViewIfNeeded();
    await expect(createBundle).toBeInViewport({ ratio: 1 });
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await dialog.screenshot({ path: info.outputPath(`range-wrong-notes-${width}.png`) });
    await page.reload();
    dialog = await open(page);
    await expect(dialog.getByLabel("가온 오답 번호")).toHaveValue("25, 1, 25");
    await dialog.getByRole("button", { name: "2명 오답노트 묶음 만들기" }).click();
    await expect(dialog.getByText("완료하지 못한 문서가 있습니다")).toBeVisible();
    await page.reload();
    dialog = await open(page);
    await dialog.getByRole("button", { name: "실패한 문서 다시 만들기" }).click();
    const zip = page.waitForEvent("download");
    const downloadBundle = dialog.getByRole("button", { name: "학생별 PDF 묶음 다운로드" });
    await downloadBundle.scrollIntoViewIfNeeded();
    await expect(downloadBundle).toBeInViewport({ ratio: 1 });
    await downloadBundle.click();
    expect((await zip).suggestedFilename()).toBe("학생별 오답노트.zip");
    const requested = [
      { enrollment_id: 21, sources: [{ type: "exam", id: 51, numbers: [1, 25] }, { type: "homework", id: 61, numbers: [4] }] },
      { enrollment_id: 22, sources: [{ type: "exam", id: 51, numbers: [7] }] },
    ];
    expect(api.payloads).toEqual([{ lecture_id: lecture, from_session_order: 1, to_session_order: 2, students: requested }]);
    expect(api.retries()).toBe(1);
    await dialog.getByRole("button", { name: "입력으로 돌아가기" }).click();
    await dialog.getByRole("button", { name: "가온 개인 PDF 만들기" }).click();
    const pdf = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "개인 PDF 다운로드" }).click();
    expect((await pdf).suggestedFilename()).toBe("가온 오답노트.pdf");
    expect(api.payloads[1].students).toEqual([requested[0]]);
    expect(api.otherWrites).toEqual([]);
  });
}

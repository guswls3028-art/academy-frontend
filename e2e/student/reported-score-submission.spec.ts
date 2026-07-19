import { expect, test, type Page } from "../fixtures/strictTest";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

function isLocalBase(value: string): boolean {
  try {
    return ["127.0.0.1", "localhost"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `e30.${payload}.student`;
}

async function installApi(page: Page): Promise<string[]> {
  const uploads: string[] = [];
  let submitted = false;
  const submission = {
    id: 701,
    student_id: 11,
    source: "school_exam",
    source_group: "school",
    label: "2026년 2학기 2차 지필평가(기말)",
    academic_year: 2026,
    semester: 2,
    exam_round: "second",
    exam_name: null,
    exam_month: null,
    exam_date: "2026-12-10",
    subject: "수학",
    score: 93,
    max_score: 100,
    score_pct: 93,
    standard_score: null,
    percentile: null,
    grade_rank: 2,
    grade_scale: "nine",
    status: "pending",
    review_note: "",
    evidence_file_id: 801,
    evidence_r2_key: "tenant/student/score.jpg",
    created_at: "2026-07-19T14:00:00+09:00",
    reviewed_at: null,
  };
  const secondSubmission = {
    ...submission,
    id: 702,
    subject: "영어",
    score: 89,
    score_pct: 89,
  };
  const inventoryFile = {
    id: "801",
    name: "school-score.jpg",
    displayName: "school-score.jpg",
    description: "성적표 제출 · 학교 내신 · 수학",
    icon: "file-text",
    folderId: null,
    sizeBytes: 4,
    r2Key: "tenant/student/score.jpg",
    contentType: "image/jpeg",
    createdAt: "2026-07-19T14:00:00+09:00",
    scoreSubmission: submission,
    scoreSubmissions: [submission, secondSubmission],
  };

  await page.addInitScript(({ token }) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", "student-refresh");
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  }, { token: fakeJwt() });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") { await route.fulfill({ status: 204 }); return; }
    if (path.endsWith("/core/program/")) {
      await route.fulfill({ json: { tenantCode: "hakwonplus", display_name: "학원플러스", is_active: true, ui_config: {}, feature_flags: {} } });
      return;
    }
    if (path.endsWith("/core/me/")) {
      await route.fulfill({ json: { id: 11, username: "student-11", name: "김학생", is_staff: false, is_superuser: false, tenantRole: "student" } });
      return;
    }
    if (path.endsWith("/student/me/")) {
      await route.fulfill({ json: { id: 11, name: "김학생", ps_number: "S0011", grade: 2, school_type: "HIGH", high_school: "테스트고등학교" } });
      return;
    }
    if (path.endsWith("/storage/inventory/upload/") && request.method() === "POST") {
      uploads.push(request.postData() || "");
      submitted = true;
      await route.fulfill({ json: inventoryFile });
      return;
    }
    if (path.endsWith("/storage/inventory/")) {
      await route.fulfill({ json: { folders: [], files: submitted ? [inventoryFile] : [] } });
      return;
    }
    await route.fulfill({ json: { count: 0, results: [] } });
  });
  return uploads;
}

test.describe("학생 성적표 자발 제출", () => {
  test.skip(!isLocalBase(BASE), "Local route-mock contract spec.");
  test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

  test("학교 내신 정보와 원본을 함께 제출하고 확인 대기 상태를 본다", async ({ page }) => {
    const uploads = await installApi(page);
    await page.goto(`${BASE}/student/submit/score`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("정보 입력→성적표 제출→선생님 확인→통계 반영")).toBeVisible();
    await page.getByLabel("학기").selectOption("2");
    await page.getByTestId("score-exam-round").selectOption("second");
    await page.getByLabel("시험일 선택", { exact: true }).fill("2026-12-10");
    await page.getByLabel("받은 점수").fill("93");
    await expect(page.getByTestId("score-grade-rank")).toBeDisabled();
    await page.getByTestId("score-grade-scale").selectOption("nine");
    await page.getByTestId("score-grade-rank").selectOption("2");
    await page.locator("summary").filter({ hasText: "성적표의 상세 지표 입력" }).click();
    await page.getByLabel("과목 평균 선택", { exact: true }).fill("76.5");
    await page.getByRole("button", { name: /같은 성적표의 과목 추가/ }).click();
    const secondItem = page.getByTestId("score-item").nth(1);
    await secondItem.getByPlaceholder("예: 수학").fill("영어");
    await secondItem.getByLabel("받은 점수").fill("89");
    await page.locator('input[type="file"]').setInputFiles({
      name: "school-score.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("score-card"),
    });
    await page.getByRole("button", { name: "성적표 보내기" }).click();

    await expect(page.getByText("성적표를 보냈습니다.")).toBeVisible();
    await expect(page.getByText("2026년 2학기 2차 지필평가(기말)")).toBeVisible();
    await expect(page.getByText("확인 대기")).toBeVisible();
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toContain('name="score_submission"');
    expect(uploads[0]).toContain('name="score_source"');
    expect(uploads[0]).toContain("school_exam");
    expect(uploads[0]).toContain('name="exam_round"');
    expect(uploads[0]).toContain("second");
    expect(uploads[0]).toContain('name="score"');
    expect(uploads[0]).toContain("93");
    expect(uploads[0]).toContain('name="score_items"');
    expect(uploads[0]).toContain("영어");
    expect(uploads[0]).toContain("76.5");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: "test-results/reported-score-submission/student-success-390.png", fullPage: true });
  });

  test("평가원 모의평가는 공식 6·9월만 선택할 수 있다", async ({ page }) => {
    await installApi(page);
    await page.goto(`${BASE}/student/submit/score`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /전국연합/ }).click();
    await page.getByTestId("score-exam-month").selectOption("3");
    await page.getByRole("button", { name: /평가원 모의/ }).click();
    await expect(page.getByTestId("score-exam-month").locator("option")).toHaveText(["6월", "9월"]);
    await expect(page.getByTestId("score-exam-month")).toHaveValue("6");
  });

  test("수행평가는 성적표 기재 시험명과 시험일을 함께 보낸다", async ({ page }) => {
    const uploads = await installApi(page);
    await page.goto(`${BASE}/student/submit/score`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("score-exam-round").selectOption("performance");
    await page.getByTestId("score-exam-name").fill("수학 주제탐구 수행평가");
    await page.getByLabel("시험일 선택", { exact: true }).fill("2026-05-14");
    await page.getByLabel("받은 점수").fill("18");
    await page.getByLabel("만점").fill("20");
    await page.locator('input[type="file"]').setInputFiles({
      name: "performance-score.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("score-card"),
    });
    await page.getByRole("button", { name: "성적표 보내기" }).click();

    await expect.poll(() => uploads.length).toBe(1);
    expect(uploads[0]).toContain("performance");
    expect(uploads[0]).toContain("수학 주제탐구 수행평가");
  });
});

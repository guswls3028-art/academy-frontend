import { expect, test } from "./fixtures/strictTest";
import { getBaseUrl } from "./helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "./helpers/localAuthApiStubs";

const baseUrl = getBaseUrl("admin");
const isLocal = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl);

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus" })}.sig`;
}

test("AI 시험지 타이핑은 완료 후 명시적으로 다운로드한다", async ({ page }) => {
  test.skip(!isLocal, "합성 원본과 mock worker 결과를 사용하는 로컬 계약 테스트");

  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, localJwt());
  let voiceProfileVersion = 1;
  let reviewSaved = false;
  let reviewedQuestionIndex: number | null = null;
  let explanationRunMode: "done" | "failed" = "done";

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (pathname.endsWith("/staffs/me/") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          is_authenticated: true,
          is_superuser: true,
          is_staff: true,
          is_payroll_manager: true,
          is_owner: true,
        },
      });
      return;
    }
    if (pathname.endsWith("/staffs/currently-working/") && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", json: [] });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/fonts/") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          built_in_fonts: [
            { key: "hamchorom-batang", label: "함초롬바탕", family_name: "함초롬바탕" },
            { key: "hamchorom-dotum", label: "함초롬돋움", family_name: "함초롬돋움" },
            { key: "malgun-gothic", label: "맑은 고딕", family_name: "맑은 고딕" },
          ],
          custom_fonts: [],
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/document-style/") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          preference: {
            title_font: "builtin:hamchorom-dotum",
            body_font: "builtin:hamchorom-batang",
            title_size_pt: 20,
            body_size_pt: 10.5,
            line_spacing_percent: 155,
            question_spacing_pt: 10,
          },
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/document-style/") && request.method() === "PUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: { preference: request.postDataJSON() },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/beta-access/") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          beta_access: {
            label: "Beta",
            free_run_limit: 3,
            completed_runs: 0,
            reserved_runs: 0,
            remaining_runs: 3,
            can_start: true,
            review_required: true,
          },
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/voice-profiles/") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: { profiles: [] },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/voice-profiles/") && request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        json: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "내 해설 문체",
          subject: "수학",
          style_instructions: "핵심부터 설명",
          is_default: true,
          status: "active",
          version: voiceProfileVersion,
          style_sample_count: 0,
          reference_sample_count: 0,
          updated_at: new Date().toISOString(),
        },
      });
      return;
    }
    if (
      pathname.endsWith("/tools/problem-studio/voice-profiles/11111111-1111-4111-8111-111111111111/samples/")
      && request.method() === "POST"
    ) {
      voiceProfileVersion += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        json: {
          created: true,
          sample: {
            id: "22222222-2222-4222-8222-222222222222",
            usage_scope: "style",
            origin: "teacher_authored",
            source_label: "선생님 직접 작성 해설",
            problem_text: "",
            answer: "",
            explanation: "핵심 조건을 먼저 확인합니다.",
            rights_confirmed: true,
            created_at: new Date().toISOString(),
          },
          profile: {
            id: "11111111-1111-4111-8111-111111111111",
            name: "내 해설 문체",
            subject: "수학",
            style_instructions: "핵심부터 설명",
            is_default: true,
            status: "active",
            version: voiceProfileVersion,
            style_sample_count: 1,
            reference_sample_count: 0,
            updated_at: new Date().toISOString(),
          },
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/jobs/") && request.method() === "POST") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        json: {
          job_id: "ps-voice-job",
          status: "PENDING",
          source_files: [{ name: "chemistry.png", kind: "이미지", sizeLabel: "1KB", extractedChars: 120 }],
          warnings: [],
          source_text_chars: 120,
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/jobs/ps-voice-job/") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          job_id: "ps-voice-job",
          status: "DONE",
          error: "",
          result: {
            generation_engine: "ai",
            mode: "same-type",
            mode_label: "유사 유형",
            variant_count: 1,
            questions: [
              {
                prompt: "광합성에 필요한 기체를 고르시오.",
                choices: ["① 산소", "② 이산화탄소"],
                answer: "②",
                explanation: "핵심 조건을 먼저 확인하면 이산화탄소입니다.",
                source_index: 1,
                variant_index: 1,
                source_evidence: [1],
                answer_check: "광합성 반응물 확인",
                confidence: "high",
                review_status: "teacher_review_required",
                voice_profile_version: voiceProfileVersion,
                quality_checks: {
                  has_answer: true,
                  has_explanation: true,
                  has_source_evidence: true,
                  verbatim_similarity_risk: false,
                },
              },
              {
                prompt: "광합성 결과 생성되는 기체를 고르시오.",
                choices: ["① 산소", "② 이산화탄소"],
                answer: "①",
                explanation: "핵심 조건을 먼저 확인하면 산소입니다.",
                source_index: 1,
                variant_index: 2,
                source_evidence: [1],
                answer_check: "광합성 생성물 확인",
                confidence: "high",
                review_status: "teacher_review_required",
                voice_profile_version: voiceProfileVersion,
                quality_checks: {
                  has_answer: true,
                  has_explanation: true,
                  has_source_evidence: true,
                  verbatim_similarity_risk: false,
                },
              },
            ],
            source_files: [{ name: "chemistry.png", kind: "이미지", sizeLabel: "1KB", extractedChars: 120 }],
            warnings: [],
            source_text_chars: 120,
            review_required: true,
            voice_profile: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "내 해설 문체",
              version: voiceProfileVersion,
              style_sample_count: 1,
              reference_sample_count: 0,
            },
          },
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/jobs/ps-voice-job/reviews/") && request.method() === "POST") {
      reviewSaved = true;
      reviewedQuestionIndex = request.postDataJSON().question_index;
      voiceProfileVersion += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        json: {
          review_id: "33333333-3333-4333-8333-333333333333",
          created: true,
          learned: true,
          profile: {
            id: "11111111-1111-4111-8111-111111111111",
            name: "내 해설 문체",
            subject: "수학",
            style_instructions: "핵심부터 설명",
            is_default: true,
            status: "active",
            version: voiceProfileVersion,
            style_sample_count: 2,
            reference_sample_count: 0,
            updated_at: new Date().toISOString(),
          },
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/transfer-jobs/") && request.method() === "POST") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        json: {
          job_id: "ps-e2e-job",
          status: "PENDING",
          source_files: [{ name: "chemistry.png", kind: "이미지", sizeLabel: "1KB", extractedChars: 0 }],
          warnings: [],
          source_text_chars: 0,
          beta_access: {
            label: "Beta",
            free_run_limit: 3,
            completed_runs: 0,
            reserved_runs: 1,
            remaining_runs: 2,
            can_start: true,
            review_required: true,
          },
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/explanation-runs/") && request.method() === "POST") {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        json: {
          run_id: "33333333-3333-4333-8333-333333333333",
          status: "PENDING",
          stage: "extract",
          source_name: "chemistry.pdf",
          progress: {
            percent: 5,
            step_index: 1,
            step_total: 4,
            step_name: "extract",
            step_name_display: "문항과 정답표 분석",
            completed_questions: 0,
            total_questions: 0,
            verified_questions: 0,
            review_required_questions: 0,
          },
          result: null,
          error_message: null,
          can_resume: false,
          beta_access: {
            label: "Beta",
            free_run_limit: 3,
            completed_runs: 0,
            reserved_runs: 1,
            remaining_runs: 2,
            can_start: true,
            review_required: true,
          },
        },
      });
      return;
    }
    if (
      pathname.endsWith("/tools/problem-studio/explanation-runs/33333333-3333-4333-8333-333333333333/resume/")
      && request.method() === "POST"
    ) {
      explanationRunMode = "done";
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        json: {
          run_id: "33333333-3333-4333-8333-333333333333",
          status: "RUNNING",
          stage: "solve",
          source_name: "chemistry.pdf",
          progress: {
            percent: 38,
            step_index: 2,
            step_total: 4,
            step_name: "solve",
            step_name_display: "정답·해설 생성",
            completed_questions: 1,
            total_questions: 2,
            verified_questions: 0,
            review_required_questions: 0,
          },
          result: null,
          error_message: null,
          can_resume: false,
          beta_access: {
            label: "Beta",
            free_run_limit: 3,
            completed_runs: 0,
            reserved_runs: 1,
            remaining_runs: 2,
            can_start: true,
            review_required: true,
          },
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/explanation-runs/33333333-3333-4333-8333-333333333333/")) {
      if (explanationRunMode === "failed") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            run_id: "33333333-3333-4333-8333-333333333333",
            status: "FAILED",
            stage: "solve",
            source_name: "chemistry.pdf",
            progress: {
              percent: 37,
              step_index: 2,
              step_total: 4,
              step_name: "solve",
              step_name_display: "정답·해설 생성",
              completed_questions: 1,
              total_questions: 2,
              verified_questions: 0,
              review_required_questions: 0,
            },
            result: null,
            error_message: "워커 제한 시간으로 중단되었습니다.",
            can_resume: true,
            beta_access: {
              label: "Beta",
              free_run_limit: 3,
              completed_runs: 0,
              reserved_runs: 0,
              remaining_runs: 3,
              can_start: true,
              review_required: true,
            },
          },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          run_id: "33333333-3333-4333-8333-333333333333",
          status: "DONE",
          stage: "done",
          source_name: "chemistry.pdf",
          progress: {
            percent: 100,
            step_index: 4,
            step_total: 4,
            step_name: "done",
            step_name_display: "완료",
            completed_questions: 2,
            total_questions: 2,
            verified_questions: 1,
            review_required_questions: 1,
          },
          result: {
            download_url: "https://download.example/chemistry-solution.pdf",
            filename: "chemistry_정답해설_Beta.pdf",
            size_bytes: 2048,
            source_pages: 1,
            appendix_pages: 1,
            output_pages: 2,
            question_count: 2,
            solution_count: 2,
            review_required: true,
            review_required_count: 1,
            beta: { label: "Beta", free_trial: true, review_required: true },
          },
          error_message: null,
          can_resume: false,
          beta_access: {
            label: "Beta",
            free_run_limit: 3,
            completed_runs: 1,
            reserved_runs: 0,
            remaining_runs: 2,
            can_start: true,
            review_required: true,
          },
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/hangul-companion/") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          download_url: "https://download.example/Academy-Hangul-Companion-Windows-1.1.0.zip",
          filename: "Academy-Hangul-Companion-Windows-1.1.0.zip",
          version: "1.1.0",
          sha256: "a".repeat(64),
          size_bytes: 67644035,
        },
      });
      return;
    }
    if (pathname.endsWith("/tools/problem-studio/transfer-jobs/ps-e2e-job/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          job_id: "ps-e2e-job",
          job_type: "problem_studio_transcription",
          status: "DONE",
          progress: { percent: 100, step_name_display: "완료" },
          result: {
            download_url: "https://download.example/review.zip",
            filename: "화학_검수본.zip",
            size_bytes: 1024,
            document_count: 1,
            warning_count: 0,
            review_file_count: 7,
            structured_item_count: 3,
            ocr_candidate_count: 1,
            quality_level: "needs_attention",
            ai_transcribed_units: 1,
            fallback_ocr_units: 0,
            generated_explanation_count: 2,
            reconstruction_quality: {
              source_page_preserved_count: 1,
            },
            beta: {
              label: "Beta",
              free_trial: true,
              review_required: true,
            },
          },
          error_message: null,
          beta_access: {
            label: "Beta",
            free_run_limit: 3,
            completed_runs: 1,
            reserved_runs: 0,
            remaining_runs: 2,
            can_start: true,
            review_required: true,
          },
        },
      });
      return;
    }
    await route.fallback();
  });
  await page.route("https://download.example/**", async (route) => {
    if (route.request().url().endsWith(".pdf")) {
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="chemistry_solution.pdf"',
        },
        body: Buffer.from("%PDF-1.4\n%%EOF"),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="Academy-Hangul-Companion-Windows-1.1.0.zip"',
      },
      body: Buffer.from("companion-zip"),
    });
  });

  await page.goto(`${baseUrl}/workspace/tools/problem-studio`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "문제집 한 권을, 검수 가능한 정답·해설 PDF로" })).toBeVisible();
  await expect(page.getByText("Beta", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("테넌트 무료 체험 3/3회 남음", { exact: true })).toBeVisible();
  await expect(page.getByText("문항 분석")).toBeVisible();
  await expect(page.getByText(/처음 한 번만 ZIP을 풀고/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "4. 내 문서 스타일" })).toBeVisible();
  await expect(page.getByLabel("자평(%)")).toHaveValue("100");
  await expect(page.getByLabel("자간(%)")).toHaveValue("0");
  await expect(page.getByRole("checkbox", { name: /HWPX 원본의 본문/ })).toBeChecked();
  await page.getByRole("combobox", { name: /^본문 글꼴/ }).selectOption("builtin:malgun-gothic");
  await page.getByRole("button", { name: "내 기본값 저장" }).click();
  const companionDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Windows 연결 프로그램 설치" }).click();
  const downloadedCompanion = await companionDownload;
  expect(downloadedCompanion.suggestedFilename()).toBe("Academy-Hangul-Companion-Windows-1.1.0.zip");

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "chemistry.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  });
  await expect(page.getByText("chemistry.pdf")).toBeVisible();
  await expect(page.getByText(/전 세계 AWS 상용 리전/)).toBeVisible();

  let automaticDownloads = 0;
  page.on("download", () => { automaticDownloads += 1; });
  const explanationButton = page.getByRole("button", { name: "정답·해설 PDF 만들기" });
  await expect(explanationButton).toBeDisabled();
  await page.getByRole("checkbox", { name: /글로벌 AI 처리 안내/ }).check();
  await expect(explanationButton).toBeEnabled();
  await explanationButton.click();
  await expect(page.getByRole("button", { name: "정답·해설 PDF 내려받기" })).toBeVisible();
  await expect(page.getByText("완료 · 2문항 · 검수 표시 1개", { exact: true })).toBeVisible();
  await expect(page.getByText("테넌트 무료 체험 2/3회 남음", { exact: true })).toBeVisible();
  const transferButton = page.getByRole("button", { name: "편집용 문제지 HWPX 만들기" });
  await transferButton.click();
  await expect(page.getByRole("button", { name: "편집용 HWPX ZIP 내려받기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "한글에서 열기", exact: true })).toBeVisible();
  await expect(page.getByText("편집본 준비 완료 · 전사 1쪽 · 원본 보존 1쪽", { exact: true })).toBeVisible();
  expect(automaticDownloads).toBe(0);

  await page.getByText("Beta 재작성", { exact: true }).click();
  await expect(page.getByText("내 해설 문체", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "프로필 만들기" }).click();
  await expect(page.getByLabel("사용할 문체 프로필")).toHaveValue("11111111-1111-4111-8111-111111111111");
  await page.getByRole("textbox", { name: "내가 직접 쓴 해설", exact: true }).fill("핵심 조건을 먼저 확인합니다.");
  await page.getByRole("checkbox", { name: /내가 직접 작성한 해설/ }).check();
  await page.getByRole("button", { name: "문체 샘플 추가" }).click();
  await expect(page.getByLabel("사용할 문체 프로필")).toContainText("문체 1 · 참고 0");
  const generatedDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "후보 만들기" }).click();
  await generatedDownload;
  await expect(page.getByText(/AI 검수 정보 · 신뢰도 높음/)).toHaveCount(2);
  await page.getByRole("button", { name: "문항 삭제" }).first().click();
  await expect(page.getByText(/AI 검수 정보 · 신뢰도 높음/)).toHaveCount(1);
  await page.getByRole("button", { name: "검수 승인 후 문체 학습" }).click();
  await expect(page.getByRole("button", { name: "승인·학습 완료" })).toBeVisible();
  expect(reviewSaved).toBe(true);
  expect(reviewedQuestionIndex).toBe(1);

  explanationRunMode = "failed";
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "중단 지점에서 다시 시작" })).toBeVisible();
  await page.getByRole("button", { name: "중단 지점에서 다시 시작" }).click();
  await expect(page.getByRole("button", { name: "정답·해설 PDF 내려받기" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "문제집 한 권을, 검수 가능한 정답·해설 PDF로" })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "chemistry-mobile.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await page.getByRole("checkbox", { name: /글로벌 AI 처리 안내/ }).check();
  await page.getByRole("button", { name: "편집용 문제지 HWPX 만들기" }).click();
  await expect(page.getByRole("button", { name: "편집용 HWPX ZIP 내려받기" })).toBeVisible();

  await page.route("**/api/v1/tools/problem-studio/beta-access/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        beta_access: {
          label: "Beta",
          free_run_limit: 3,
          completed_runs: 3,
          reserved_runs: 0,
          remaining_runs: 0,
          can_start: false,
          review_required: true,
        },
      },
    });
  });
  await page.evaluate(() => localStorage.removeItem("problem-studio:explanation-run:v1"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText("테넌트 무료 체험 0/3회 남음", { exact: true })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "chemistry-exhausted.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  const aiConsent = page.getByRole("checkbox", { name: /글로벌 AI 처리 안내/ });
  if (!(await aiConsent.isChecked())) await aiConsent.check();
  await expect(page.getByRole("button", { name: "Beta 무료 체험 소진" })).toBeDisabled();
});

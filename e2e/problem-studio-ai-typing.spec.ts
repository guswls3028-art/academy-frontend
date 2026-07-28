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
          },
          error_message: null,
        },
      });
      return;
    }
    await route.fallback();
  });
  await page.route("https://download.example/**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="Academy-Hangul-Companion-Windows-1.1.0.zip"',
      },
      body: Buffer.from("companion-zip"),
    });
  });

  await page.goto(`${baseUrl}/admin/tools/problem-studio`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "사진만 올리면, 한글 검수본까지" })).toBeVisible();
  await expect(page.getByText("원본 업로드")).toBeVisible();
  await expect(page.getByText(/처음 한 번만 ZIP을 풀고/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "4. 내 문서 스타일" })).toBeVisible();
  await page.getByLabel("본문 글꼴").selectOption("builtin:malgun-gothic");
  await page.getByRole("button", { name: "내 기본값 저장" }).click();
  const companionDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Windows 연결 프로그램 설치" }).click();
  const downloadedCompanion = await companionDownload;
  expect(downloadedCompanion.suggestedFilename()).toBe("Academy-Hangul-Companion-Windows-1.1.0.zip");

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "chemistry.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await expect(page.getByText("chemistry.png")).toBeVisible();
  await expect(page.getByText(/전 세계 AWS 상용 리전/)).toBeVisible();

  let automaticDownloads = 0;
  page.on("download", () => { automaticDownloads += 1; });
  const transferButton = page.getByRole("button", { name: "AI 타이핑 시작" });
  await expect(transferButton).toBeDisabled();
  await page.getByRole("checkbox", { name: /글로벌 AI 처리 안내/ }).check();
  await expect(transferButton).toBeEnabled();
  await transferButton.click();
  await expect(page.getByRole("button", { name: "검수본 ZIP 내려받기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "한글에서 열기", exact: true })).toBeVisible();
  await expect(page.getByText("준비 완료 · AI 1쪽 · 검수 후보 1건", { exact: true })).toBeVisible();
  expect(automaticDownloads).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "사진만 올리면, 한글 검수본까지" })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "chemistry-mobile.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await page.getByRole("checkbox", { name: /글로벌 AI 처리 안내/ }).check();
  await page.getByRole("button", { name: "AI 타이핑 시작" }).click();
  await expect(page.getByRole("button", { name: "검수본 ZIP 내려받기" })).toBeVisible();
});

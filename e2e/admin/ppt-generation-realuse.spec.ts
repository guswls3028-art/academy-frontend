/** Isolated development canary: one real PDF job and one real manual crop job. */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import type { Download, Page, Response } from "@playwright/test";
import { expect, test } from "../fixtures/strictTest";
import { getApiBaseUrl, getBaseUrl, loginViaUI } from "../helpers/auth";

const PDF = path.resolve("e2e/fixtures/synthetic-math-low-anchor-7pages.pdf");
const GENERATE_PATH = "/api/v1/tools/ppt/generate/";
const jobIds: string[] = [];

function requireIsolatedDevelopment(): void {
  if (process.env.E2E_RELEASE_API_MODE !== "development" || process.env.E2E_STRICT !== "strict"
    || getBaseUrl("admin") !== "http://localhost:4173"
    || getApiBaseUrl() !== "http://127.0.0.1:18000"
    || !/^qa-ymath-realuse-[a-z0-9-]+$/.test(process.env.E2E_TENANT_CODE?.trim() || "")
    || !process.env.E2E_ADMIN_USER?.trim() || !process.env.E2E_ADMIN_PASS?.trim()) {
    throw new Error("PPT real-use requires the exact isolated development canary and QA admin");
  }
}

function isGenerateResponse(response: Response): boolean {
  return response.request().method() === "POST"
    && new URL(response.url()).pathname === GENERATE_PATH;
}

function waitForSubmission(page: Page): Promise<Response> {
  return page.waitForResponse(isGenerateResponse).then(async (response) => {
    if (response.ok()) {
      const job = await response.json() as { job_id?: string };
      if (job.job_id) jobIds.push(job.job_id);
    }
    return response;
  });
}

async function expectPptx(download: Download, slideCount: number): Promise<void> {
  const savedPath = await download.path();
  expect(savedPath).toBeTruthy();
  const zip = await JSZip.loadAsync(await readFile(savedPath!));
  const presentation = await zip.file("ppt/presentation.xml")?.async("string");
  expect(presentation, "download must contain a valid PPTX presentation").toBeTruthy();
  expect((presentation!.match(/<p:sldId\b/g) || []).length).toBe(slideCount);
  const hashes: string[] = [];
  for (let number = 1; number <= slideCount; number++) {
    const slide = await zip.file(`ppt/slides/slide${number}.xml`)?.async("string");
    expect(slide, `slide ${number} must exist in downloaded PPTX`).toContain("<p:sld");
    expect(slide).toContain("<a:blip");
    const embed = slide!.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
    expect(embed, `slide ${number} must reference an image`).toBeTruthy();
    const relationships = await zip.file(`ppt/slides/_rels/slide${number}.xml.rels`)?.async("string");
    expect(relationships).toBeTruthy();
    const relationship = Array.from(relationships!.matchAll(/<Relationship\b[^>]*>/g), (match) => match[0])
      .find((tag) => tag.includes(`Id="${embed}"`));
    const target = relationship?.match(/Target="([^"]+)"/)?.[1];
    expect(target, `slide ${number} image target must exist`).toBeTruthy();
    const mediaPath = path.posix.normalize(path.posix.join("ppt/slides", target!));
    const image = await zip.file(mediaPath)?.async("nodebuffer");
    expect(image, `slide ${number} image must be packaged`).toBeTruthy();
    hashes.push(createHash("sha256").update(image!).digest("hex"));
  }
  expect(new Set(hashes).size, "each selected PDF page/region must be a distinct slide image").toBe(slideCount);
  const media = Object.keys(zip.files).filter((name) => /^ppt\/media\/[^/]+$/.test(name));
  expect(media.length).toBeGreaterThanOrEqual(slideCount);
}

async function expectDownload(page: Page, click: () => Promise<void>, slideCount: number): Promise<void> {
  const downloadPromise = page.waitForEvent("download", { timeout: 480_000 });
  await click();
  await expectPptx(await downloadPromise, slideCount);
}

test("7쪽 자동 생성 실패 안내에서 직접 자르기·다운로드·새로고침 복구", async ({ page }) => {
  test.setTimeout(900_000);
  requireIsolatedDevelopment();
  await page.setViewportSize({ width: 1366, height: 850 });
  await loginViaUI(page, "admin", { landingPath: "/workspace/tools/ppt" });
  await expect(page.getByRole("button", { name: "PDF", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "PDF", exact: true }).click();

  const upload = page.locator('input[type="file"][accept="application/pdf"]');
  await upload.setInputFiles({ name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF") });
  const badResponse = page.waitForResponse(isGenerateResponse);
  await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
  const rejected = await badResponse;
  expect(rejected.status()).toBe(400);
  const rejectedBody = await rejected.json() as { code?: string; job_id?: string };
  expect(rejectedBody.code).toBe("invalid_pdf");
  expect(rejectedBody.job_id).toBeUndefined();
  await expect(page.getByText("유효한 PDF 파일이 아닙니다.")).toBeVisible();
  await expect(page.getByText("broken.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "PPT 생성 및 다운로드" })).toBeEnabled();

  await page.getByRole("button", { name: "선택한 PDF 제거" }).click();
  await upload.setInputFiles(PDF);
  await expect(page.getByText("synthetic-math-low-anchor-7pages.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "자동 문항 분리" })).toHaveAttribute("aria-pressed", "true");
  const automaticResponse = waitForSubmission(page);
  const automaticDownload = page.waitForEvent("download", { timeout: 480_000 });
  void automaticDownload.catch(() => undefined);
  await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
  const automatic = await automaticResponse;
  const automaticBody = await automatic.json().catch(() => ({})) as { code?: unknown; job_id?: string };
  const safeFailureCodes = new Set(["invalid_type", "pdf_too_large", "invalid_pdf", "invalid_settings", "no_files"]);
  const failureCode = typeof automaticBody.code === "string" && safeFailureCodes.has(automaticBody.code)
    ? automaticBody.code : "unclassified";
  expect(automatic.ok(), `PPT 자동 생성 제출: status=${automatic.status()}, code=${failureCode}`).toBe(true);
  expect(automaticBody.job_id).toBeTruthy();
  await expect(page.getByText(/문항을 정확히 나누기 어려워 모든 쪽을 그대로 넣었습니다/)).toBeVisible({ timeout: 480_000 });
  await expect(page.getByText(/PPT 생성 완료 \(7장/)).toBeVisible();
  await expectPptx(await automaticDownload, 7);

  await page.getByRole("button", { name: "직접 자르기" }).click();
  await expect(page.getByText("1 / 7쪽")).toBeVisible();
  const layer = page.getByTestId("ppt-pdf-selection-layer");
  const box = await layer.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.1, box!.y + box!.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.6);
  await page.mouse.up();
  await expect(page.getByTestId("ppt-crop-region")).toHaveCount(1);
  await page.getByRole("button", { name: "다음 쪽" }).click();
  await expect(page.getByText("2 / 7쪽")).toBeVisible();
  await page.getByRole("button", { name: "현재 쪽 전체 추가" }).click();
  await page.getByRole("button", { name: "2번 슬라이드 앞으로" }).click();
  await expect(page.getByText("1. 2쪽")).toBeVisible();
  await expect(page.getByText("2. 1쪽")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.setViewportSize({ width: 1366, height: 850 });

  const manualResponse = waitForSubmission(page);
  await expectDownload(page, () => page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click(), 2);
  const manual = await manualResponse;
  expect(manual.status()).toBeGreaterThanOrEqual(200);
  expect(manual.status()).toBeLessThan(300);
  const manualBody = manual.request().postDataBuffer()?.toString("latin1") || "";
  expect(Array.from(manualBody.matchAll(/name="images"; filename="([^"]+)"/g), (match) => match[1]))
    .toEqual(["slide-001-page-2.png", "slide-002-page-1.png"]);
  const manualJob = await manual.json() as { job_id?: string };
  expect(manualJob.job_id).toBeTruthy();

  await page.reload({ waitUntil: "domcontentloaded" });
  const recovery = page.getByRole("region", { name: "이전 PPT 작업" });
  await expect(recovery.getByRole("button", { name: "완료된 PPT 다운로드 (7장)" })).toBeVisible();
  await expect(recovery.getByRole("button", { name: "완료된 PPT 다운로드 (2장)" })).toBeVisible();
  await expectDownload(page, () => recovery.getByRole("button", { name: "완료된 PPT 다운로드 (2장)" }).click(), 2);
});

test.afterEach(() => {
  // The release owner uses these exact IDs for AIJob/AIResult, R2 and Redis cleanup.
  console.log(`PPT_REALUSE_CLEANUP ${JSON.stringify({ tenantCode: process.env.E2E_TENANT_CODE, jobIds })}`);
});

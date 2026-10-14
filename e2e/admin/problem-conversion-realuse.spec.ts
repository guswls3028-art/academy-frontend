/** Synthetic source, real AI worker and persisted HWPX in the exact isolated development artifact. */
import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { expect, test } from "../fixtures/strictTest";
import { api, assertNoHorizontalOverflow, assertQaStudentParentRuntime, installQaStudentParentBoundary,
  loginAdmin, seedBrowserAuth, QA_BASE, STUDENT_PARENT_REALUSE_ENABLED } from "../helpers/qaStudentParentScenario";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import { attachStrictBrowserGuards } from "../helpers/strictBrowser";

test.setTimeout(540_000);
test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });
test.skip(!STUDENT_PARENT_REALUSE_ENABLED, "Requires the exact isolated development release boundary.");

test("PDF·이미지 OCR → 실제 AI 수정·그림 제안 → 교사 저장 → HWPX → desktop/390px 재진입", async ({ page, request }) => {
  assertQaStudentParentRuntime();
  const boundary = await installQaStudentParentBoundary(page, request);
  const browser = attachStrictBrowserGuards(page);
  const tokens = await loginAdmin(request);
  await seedBrowserAuth(page, tokens);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const source = pdf.addPage([595, 842]);
  source.drawText("1. Find the sum of 2 and 3.\n(1) 4\n(2) 5", { x: 50, y: 760, font, size: 14, lineHeight: 22 });
  await page.goto(`${QA_BASE}/workspace/tools/problem-studio`, { waitUntil: "domcontentloaded" });
  await acknowledgeInitialAccountPromptsIfVisible(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 600; canvas.height = 600;
    const draw = canvas.getContext("2d")!; draw.fillStyle = "white"; draw.fillRect(0, 0, 600, 600);
    draw.fillStyle = "black"; draw.font = "22px sans-serif";
    draw.fillText("2. Find the product of 3 and 4.", 40, 50);
    draw.fillText("(1) 7", 40, 90); draw.fillText("(2) 12", 40, 125);
    draw.lineWidth = 3; draw.strokeRect(90, 230, 240, 130);
    draw.fillText("A", 115, 280); draw.fillText("B", 280, 280);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("시험지 파일 선택").setInputFiles([
    { name: "qa-conversion.pdf", mimeType: "application/pdf", buffer: Buffer.from(await pdf.save()) },
    { name: "qa-conversion-image.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") },
  ]);
  await page.getByRole("radio", { name: /문제지만/ }).check();
  await page.getByLabel("원본을 외부 AI로 처리하는 데 동의합니다.").check();
  await page.getByRole("button", { name: "변환 시작", exact: true }).click();
  await expect(page.getByRole("button", { name: "원고본", exact: true })).toBeEnabled({ timeout: 180_000 });
  const id = new URL(page.url()).searchParams.get("conversion")!;
  const path = `/tools/problem-studio/conversions/${id}/`;
  const initial = await api<{ document: { questions: Array<{ prompt: string }> } }>(request, "GET", path, tokens.access);
  expect(initial.status).toBe(200);
  expect(initial.body.document.questions).toHaveLength(2);
  await page.getByRole("button", { name: /1번.*Find the sum/ }).click();
  await expect(page.getByRole("img", { name: /원본 1쪽/ })).toBeVisible();
  await page.getByLabel("이렇게 고쳐 주세요").fill("원문 문항과 보기는 유지하고 정답과 짧은 해설을 작성해 주세요.");
  await page.getByRole("button", { name: "AI로 고치기", exact: true }).click();
  await expect(page.getByRole("region", { name: "AI 수정 제안" })).toBeVisible({ timeout: 180_000 });
  const proposed = await api<{ document: { questions: Array<{ prompt: string; proposal?: object }> } }>(request, "GET", path, tokens.access);
  expect(proposed.body.document.questions[0].prompt).toBe(initial.body.document.questions[0].prompt);
  expect(proposed.body.document.questions[0].proposal).toBeTruthy();
  await page.getByRole("button", { name: "제안 적용", exact: true }).click();
  const edited = "Find the sum of 2 and 3. QA teacher revision";
  await page.getByRole("textbox", { name: "문항", exact: true }).fill(edited);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^저장됨$/ })).toBeVisible();
  await page.getByRole("button", { name: "원본 대조 완료 · 그대로 둠", exact: true }).click();
  await page.getByRole("button", { name: "목록으로", exact: true }).click();
  await page.getByRole("button", { name: /^2번/ }).click();
  await page.getByText("그림 범위 직접 입력", { exact: true }).click();
  for (const [label, value] of [["너비", "50"], ["높이", "30"], ["왼쪽", "10"], ["위", "35"]]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^저장됨$/ })).toBeVisible();
  await page.getByRole("button", { name: "그림 다시 그리기", exact: true }).click();
  await expect(page.getByRole("img", { name: "다시 그린 그림 제안", exact: true })).toBeVisible({ timeout: 180_000 });
  await page.getByRole("button", { name: "제안 적용", exact: true }).click();
  await page.getByRole("button", { name: "원본 대조 완료 · 그대로 둠", exact: true }).click();
  await page.getByRole("button", { name: "목록으로", exact: true }).click();
  await page.getByRole("button", { name: "한글 문서 다시작성", exact: true }).click();
  await expect(page.getByRole("button", { name: "원고본", exact: true })).toBeEnabled({ timeout: 90_000 });
  for (const label of ["원고본", "배열본", "평가원 A3", "원본 내려받기"]) {
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const download = await downloaded;
    expect(await download.failure()).toBeNull();
    const archive = await JSZip.loadAsync(await readFile((await download.path())!));
    if (label !== "원본 내려받기") {
      expect(await archive.file("mimetype")!.async("string")).toBe("application/hwp+zip");
      expect(await archive.file("Contents/section0.xml")!.async("string")).toContain("QA teacher revision");
    } else expect(Object.keys(archive.files).some(name => name.endsWith(".pdf"))).toBe(true);
  }
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /1번.*QA teacher revision/ }).click();
    await expect(page.getByRole("textbox", { name: "문항", exact: true })).toHaveValue(edited);
    await assertNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "목록으로", exact: true }).click();
  }
  // The official runner owns exact qa-* tenant destruction, including conversion
  // rows and every object under tenants/<id>/, then verifies cleanup zero.
  boundary.assertClean();
  browser.assertZeroDefects();
});

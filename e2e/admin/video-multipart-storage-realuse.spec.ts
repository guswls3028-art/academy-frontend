import { readFile, open, unlink } from "node:fs/promises";
import { expect, test } from "../fixtures/strictTest";
import { acknowledgeInitialAccountPromptsIfVisible } from "../helpers/firstLoginGuide";
import {
  assertQaStudentParentRuntime,
  expectApi,
  installQaStudentParentBoundary,
  loginAdmin,
  QA_BASE,
  seedBrowserAuth,
} from "../helpers/qaStudentParentScenario";

const sourceSize = 101 * 1024 * 1024;
const videoName = "qa-native-multipart.mp4";
const sessionId = Number(process.env.E2E_VIDEO_MULTIPART_SESSION_ID);
const lectureId = Number(process.env.E2E_VIDEO_MULTIPART_LECTURE_ID);
const optedIn = process.env.E2E_VIDEO_MULTIPART_SESSION_ID !== undefined;
const completionPath = /^\/api\/v1\/media\/videos\/([1-9][0-9]*)\/upload\/multipart\/complete\/$/;

async function makeMultipartFixture(path: string): Promise<void> {
  const syntheticVideo = await readFile(new URL("../fixtures/files/homework-hevc.mp4", import.meta.url));
  const freeBoxSize = sourceSize - syntheticVideo.length;
  const freeBox = Buffer.alloc(8);
  freeBox.writeUInt32BE(freeBoxSize, 0);
  freeBox.write("free", 4, "ascii");
  const file = await open(path, "wx");
  try {
    await file.writeFile(Buffer.concat([syntheticVideo, freeBox]));
    await file.truncate(sourceSize);
  } finally {
    await file.close();
  }
}

test.use({ serviceWorkers: "block", screenshot: "off", trace: "off", video: "off" });
test.setTimeout(360_000);
test.skip(!optedIn, "The fixed isolated QA Setup must opt in to the native multipart storage scenario.");

test("staff uploads an assembled two-part file to the exact isolated video store", async ({ page, request }, testInfo) => {
  assertQaStudentParentRuntime();
  expect(Number.isSafeInteger(sessionId) && sessionId > 0).toBe(true);
  expect(Number.isSafeInteger(lectureId) && lectureId > 0).toBe(true);
  const guard = await installQaStudentParentBoundary(page, request);
  const admin = await loginAdmin(request);
  await seedBrowserAuth(page, admin);
  await page.goto(QA_BASE + "/workspace/lectures/" + lectureId + "/sessions/" + sessionId + "/videos",
    { waitUntil: "domcontentloaded" });
  await acknowledgeInitialAccountPromptsIfVisible(page);
  const addVideo = page.getByRole("button", { name: "영상 추가", exact: true }).first();
  await expect(addVideo).toBeVisible({ timeout: 60_000 });
  await addVideo.click();
  const dialog = page.getByRole("dialog").filter({ hasText: "영상 추가" });
  const fixturePath = testInfo.outputPath(videoName);
  const uploadedParts: number[] = [];

  page.on("response", (response) => {
    if (response.request().method() !== "PUT" || !response.ok()) return;
    const signed = new URL(response.url());
    if (!signed.searchParams.has("uploadId") || !signed.searchParams.has("partNumber")) return;
    if (response.headers().etag) uploadedParts.push(Number(signed.searchParams.get("partNumber")));
  });

  try {
    await makeMultipartFixture(fixturePath);
    await dialog.getByTestId("video-batch-file-input").setInputFiles(fixturePath);
    const [complete] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST"
        && completionPath.test(new URL(response.url()).pathname), { timeout: 220_000 }),
      dialog.getByRole("button", { name: "업로드 (1개)", exact: true }).click(),
    ]);
    const videoId = Number(completionPath.exec(new URL(complete.url()).pathname)?.[1]);
    expect(Number.isSafeInteger(videoId) && videoId > 0).toBe(true);
    await expect.poll(() => [...uploadedParts].sort()).toEqual([1, 2]);
    if (complete.status() === 503) {
      expect((await complete.json()).code).toBe("VIDEO_BATCH_SUBMIT_FAILED");
    } else {
      expect(complete.status()).toBe(200);
      expect(await complete.json()).toMatchObject({ id: videoId, status: "UPLOADED" });
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    const row = await expectApi<{ id: number; status: string }>(request, "GET", "/media/videos/" + videoId + "/", admin.access);
    expect(row).toMatchObject({ id: videoId, status: complete.status() === 503 ? "FAILED" : "UPLOADED" });
    guard.assertClean();
    // The fixed server-side Inspect independently checks the assembled byte size and absence of a submitted Batch job.
    await testInfo.attach("multipart-storage-browser", {
      contentType: "application/json",
      body: JSON.stringify({
        schema: "development-video-multipart-browser/v1",
        uploadedPartCount: uploadedParts.length,
        expectedBytes: sourceSize,
        completionStatus: complete.status(),
        persistedStatus: row.status,
      }),
    });
  } finally {
    await unlink(fixturePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
});

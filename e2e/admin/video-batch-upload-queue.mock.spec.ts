import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
const LECTURE_ID = 9101;
const SESSION_ID = 9102;

function fakeJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type UploadEvidence = {
  initRequests: Array<{ title: string; filename: string }>;
  activeInitRequests: number;
  maxActiveInitRequests: number;
  completedVideoIds: number[];
  multipartPutOrder: number[];
  multipartPutAttempts: number;
  multipartPutAttemptsByPart: Record<number, number>;
  multipartCompleteParts: Array<{ ETag: string; PartNumber: number }>;
  multipartAbortCount: number;
  omitMultipartEtag: boolean;
};

async function installApp(page: Page): Promise<UploadEvidence> {
  const evidence: UploadEvidence = {
    initRequests: [],
    activeInitRequests: 0,
    maxActiveInitRequests: 0,
    completedVideoIds: [],
    multipartPutOrder: [],
    multipartPutAttempts: 0,
    multipartPutAttemptsByPart: {},
    multipartCompleteParts: [],
    multipartAbortCount: 0,
    omitMultipartEtag: false,
  };

  await installTenantOneInitScript(page);
  await page.addInitScript((access) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", `${access}-refresh`);
  }, fakeJwt());

  await page.route("**/e2e-video-upload/**", async (route) => {
    await route.fulfill({ status: 200, body: "ok" });
  });
  await page.route("**/e2e-video-multipart/part/*", async (route) => {
    const partNumber = Number(new URL(route.request().url()).pathname.split("/").pop());
    evidence.multipartPutAttempts += 1;
    evidence.multipartPutAttemptsByPart[partNumber] =
      (evidence.multipartPutAttemptsByPart[partNumber] ?? 0) + 1;
    if (partNumber === 1) await new Promise((resolve) => setTimeout(resolve, 120));
    evidence.multipartPutOrder.push(partNumber);
    await route.fulfill({
      status: 200,
      headers: evidence.omitMultipartEtag
        ? {}
        : { ETag: `"part-${partNumber}"`, "Access-Control-Expose-Headers": "ETag" },
      body: "",
    });
  });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });

    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/core/program/") {
      return json({
        tenantCode: "hakwonplus",
        display_name: "학원플러스",
        feature_flags: {},
        is_active: true,
      });
    }
    if (path === "/core/me/") {
      return json({
        id: 12,
        username: "teacher",
        name: "김선생",
        is_staff: true,
        is_superuser: false,
        tenantRole: "teacher",
        must_change_password: false,
      });
    }
    if (path === "/lectures/lectures/") {
      return json([{
        id: LECTURE_ID,
        tenant: 1,
        title: "고1 수학",
        name: "고1 수학",
        subject: "수학",
        is_active: true,
        is_system: false,
        created_at: "2026-08-24T00:00:00Z",
        updated_at: "2026-08-24T00:00:00Z",
      }]);
    }
    if (path === "/lectures/sessions/") {
      return json([{
        id: SESSION_ID,
        lecture: LECTURE_ID,
        order: 1,
        regular_order: 1,
        session_type: "REGULAR",
        title: "1차시",
        display_label: "1차시",
        date: "2026-08-24",
        created_at: "2026-08-24T00:00:00Z",
        updated_at: "2026-08-24T00:00:00Z",
      }]);
    }
    if (path === "/media/videos/public-session/") return json(null);
    if (path === "/media/videos/" && request.method() === "GET") {
      return json([
        { id: 8101, session_id: SESSION_ID, title: "기존 영상 A", order: 1, status: "READY", source_type: "s3" },
        { id: 8102, session_id: SESSION_ID, title: "기존 영상 B", order: 2, status: "READY", source_type: "s3" },
      ]);
    }
    if (path === "/media/videos/upload/init/" && request.method() === "POST") {
      const body = request.postDataJSON() as { title: string; filename: string };
      evidence.activeInitRequests += 1;
      evidence.maxActiveInitRequests = Math.max(
        evidence.maxActiveInitRequests,
        evidence.activeInitRequests,
      );
      evidence.initRequests.push({ title: body.title, filename: body.filename });
      await new Promise((resolve) => setTimeout(resolve, 40));
      evidence.activeInitRequests -= 1;
      const videoId = 9200 + evidence.initRequests.length;
      return json({
        video: { id: videoId },
        upload_url: `${BASE}/e2e-video-upload/${videoId}`,
        content_type: "video/mp4",
      }, 201);
    }
    const completeMatch = path.match(/^\/media\/videos\/(\d+)\/upload\/complete\/$/);
    if (completeMatch && request.method() === "POST") {
      evidence.completedVideoIds.push(Number(completeMatch[1]));
      return json({ id: Number(completeMatch[1]) });
    }
    if (/^\/media\/videos\/\d+\/upload\/multipart\/init\/$/.test(path)) {
      return json({
        upload_id: "upload-101mb",
        video_id: 9201,
        file_key: "tenant/e2e/101mb.mp4",
      });
    }
    if (/^\/media\/videos\/\d+\/upload\/multipart\/presign\/$/.test(path)) {
      const body = request.postDataJSON() as { part_numbers: number[] };
      return json({
        urls: Object.fromEntries(
          body.part_numbers.map((partNumber) => [
            String(partNumber),
            `${BASE}/e2e-video-multipart/part/${partNumber}`,
          ]),
        ),
      });
    }
    if (/^\/media\/videos\/\d+\/upload\/multipart\/complete\/$/.test(path)) {
      const body = request.postDataJSON() as {
        parts: Array<{ ETag: string; PartNumber: number }>;
      };
      evidence.multipartCompleteParts = body.parts;
      return json({ id: 9201 });
    }
    if (/^\/media\/videos\/\d+\/upload\/multipart\/abort\/$/.test(path)) {
      evidence.multipartAbortCount += 1;
      return json({ detail: "aborted" });
    }
    if (path === "/staffs/currently-working/") return json([]);
    return json([]);
  });

  return evidence;
}

async function dropLargeVideo(dialog: ReturnType<Page["getByRole"]>, name: string): Promise<void> {
  await dialog.getByRole("button", { name: "영상 파일 추가" }).evaluate((dropZone, filename) => {
    const dataTransfer = new DataTransfer();
    const file = new File(["multipart-fixture"], filename, { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 100 * 1024 * 1024 + 1 });
    dataTransfer.items.add(file);
    dropZone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
  }, name);
}

test.use({ serviceWorkers: "block" });
test.skip(!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(BASE), "로컬 route-mock 전용");

test("다건 영상은 선택·드롭·개별 제목·재생 순서를 업로드 전에 확정한다", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const evidence = await installApp(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await gotoAndSettle(page, `${BASE}/workspace/videos/tree`, { timeout: 45_000 });

  await expect(page.getByRole("button", { name: "재생 순서 바꾸기" })).toBeVisible();
  await page.locator('[title="영상 추가"]').click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "영상 추가" })).toBeVisible();
  const fileInput = dialog.getByTestId("video-batch-file-input");
  await expect(fileInput).toHaveAttribute("multiple", "");
  await fileInput.setInputFiles([
    { name: "01 함수의 극한.mp4", mimeType: "video/mp4", buffer: Buffer.from("first") },
    { name: "02 연속성.MOV", mimeType: "video/quicktime", buffer: Buffer.from("second") },
  ]);

  await expect(dialog.getByLabel("1번째 영상 제목")).toHaveValue("01 함수의 극한");
  await expect(dialog.getByLabel("2번째 영상 제목")).toHaveValue("02 연속성");

  await dialog.getByRole("button", { name: "영상 파일 추가" }).evaluate((dropZone) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(["third"], "03 미분 활용.webm", { type: "video/webm" }));
    dropZone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer }));
  });
  await expect(dialog.getByLabel("3번째 영상 제목")).toHaveValue("03 미분 활용");
  await expect(dialog.getByText("3개", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "3번째 영상을 위로 이동" }).click();
  await dialog.getByRole("button", { name: "2번째 영상을 위로 이동" }).click();
  await dialog.getByLabel("1번째 영상 제목").fill("미분 활용 핵심 정리");
  await expect(dialog.getByLabel("2번째 영상 제목")).toHaveValue("01 함수의 극한");
  await expect(dialog.getByLabel("3번째 영상 제목")).toHaveValue("02 연속성");
  const desktopScreenshot = testInfo.outputPath("video-batch-upload-queue-desktop.png");
  await dialog.screenshot({ path: desktopScreenshot });
  await testInfo.attach("video-batch-upload-queue-desktop", {
    path: desktopScreenshot,
    contentType: "image/png",
  });

  await dialog.getByRole("button", { name: "업로드 (3개)" }).click();
  await expect.poll(() => evidence.initRequests).toEqual([
    { title: "미분 활용 핵심 정리", filename: "03 미분 활용.webm" },
    { title: "01 함수의 극한", filename: "01 함수의 극한.mp4" },
    { title: "02 연속성", filename: "02 연속성.MOV" },
  ]);
  expect(evidence.maxActiveInitRequests).toBe(1);
  await expect.poll(() => evidence.completedVideoIds.length).toBe(3);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "재생 순서 바꾸기" })).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(1);
});

test("101MB 초과 영상은 완료 순서와 무관하게 파트를 정렬해 multipart 완료한다", async ({ page }) => {
  test.setTimeout(120_000);
  const evidence = await installApp(page);
  await gotoAndSettle(page, `${BASE}/workspace/videos/tree`, { timeout: 45_000 });
  await page.locator('[title="영상 추가"]').click();
  const dialog = page.getByRole("dialog");
  await dropLargeVideo(dialog, "101mb-multipart.mp4");
  await dialog.getByRole("button", { name: "업로드 (1개)" }).click();

  await expect.poll(() => evidence.multipartPutOrder).toEqual([2, 1]);
  await expect.poll(() => evidence.multipartCompleteParts).toEqual([
    { ETag: '"part-1"', PartNumber: 1 },
    { ETag: '"part-2"', PartNumber: 2 },
  ]);
  expect(evidence.multipartAbortCount).toBe(0);
});

test("multipart 파트에 ETag가 없으면 세 번 재시도한 뒤 exact upload를 abort한다", async ({ page }) => {
  test.setTimeout(120_000);
  const evidence = await installApp(page);
  evidence.omitMultipartEtag = true;
  await gotoAndSettle(page, `${BASE}/workspace/videos/tree`, { timeout: 45_000 });
  await page.locator('[title="영상 추가"]').click();
  const dialog = page.getByRole("dialog");
  await dropLargeVideo(dialog, "101mb-multipart-missing-etag.mp4");
  await dialog.getByRole("button", { name: "업로드 (1개)" }).click();

  await expect.poll(() => evidence.multipartAbortCount, { timeout: 30_000 }).toBe(1);
  expect(evidence.multipartPutAttempts).toBe(8);
  expect(evidence.multipartPutAttemptsByPart).toEqual({ 1: 4, 2: 4 });
  expect(evidence.multipartCompleteParts).toEqual([]);
});

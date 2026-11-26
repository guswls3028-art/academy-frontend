import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import { installTenantOneInitScript } from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";
import { guideRecording } from "../helpers/guideRecording";

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
  initRequests: Array<{ title: string; filename: string; limited: boolean }>;
  activeInitRequests: number;
  maxActiveInitRequests: number;
  completedVideoIds: number[];
  multipartPutOrder: number[];
  multipartPutAttempts: number;
  multipartPutAttemptsByPart: Record<number, number>;
  multipartCompletedVideoIds: number[];
  multipartPresigns: { videoId: number; partNumbers: number[] }[];
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
    multipartCompletedVideoIds: [],
    multipartPresigns: [],
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
      const body = request.postDataJSON() as { title: string; filename: string; review_watch_limit_enabled: boolean };
      evidence.activeInitRequests += 1;
      evidence.maxActiveInitRequests = Math.max(
        evidence.maxActiveInitRequests,
        evidence.activeInitRequests,
      );
      evidence.initRequests.push({ title: body.title, filename: body.filename, limited: body.review_watch_limit_enabled });
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
    const multipartPresign = path.match(/^\/media\/videos\/(\d+)\/upload\/multipart\/presign\/$/);
    if (multipartPresign) {
      const body = request.postDataJSON() as { part_numbers: number[] };
      const videoId = Number(multipartPresign[1]);
      evidence.multipartPresigns.push({ videoId, partNumbers: body.part_numbers });
      return json({
        urls: Object.fromEntries(
          body.part_numbers.map((partNumber) => [
            String(partNumber),
            `${BASE}/e2e-video-multipart/part/${partNumber}?video=${videoId}`,
          ]),
        ),
      });
    }
    const multipartComplete = path.match(/^\/media\/videos\/(\d+)\/upload\/multipart\/complete\/$/);
    if (multipartComplete) {
      const body = request.postDataJSON() as {
        parts: Array<{ ETag: string; PartNumber: number }>;
      };
      const videoId = Number(multipartComplete[1]);
      evidence.multipartCompleteParts = body.parts;
      evidence.multipartCompletedVideoIds.push(videoId);
      return json({ id: videoId });
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

if (process.env.GUIDE_MEDIA_CAPTURE === "1") {
  test("@guide-recording 영상 파일 올리고 순서 정하기", async ({ page }, info) => {
    const recording = await guideRecording(page, info, {
      id: "upload-video", title: "영상 파일 올리고 순서 정하기", topics: ["admin/upload-video"],
    });
    const evidence = await installApp(page);
    const uploadedVideos = () => evidence.initRequests.map((item, index) => ({
        id: 9201 + index, session_id: SESSION_ID, title: item.title, order: index + 2,
        status: evidence.completedVideoIds.includes(9201 + index) ? "READY" : "UPLOADING", source_type: "s3",
      }));
    await page.route(/\/api\/v1\/media\/videos\/(?:\?.*)?$/, (route) => {
      const rows = [
        { id: 8101, session_id: SESSION_ID, title: "지난 수업 복습", order: 1, status: "READY", source_type: "s3" },
        ...uploadedVideos(),
      ];
      const status = new URL(route.request().url()).searchParams.get("status");
      return route.fulfill({ json: status ? rows.filter((item) => item.status === status) : rows });
    });
    await page.route(/\/api\/v1\/media\/videos\/92\d+\/$/, (route) => {
      const id = Number(new URL(route.request().url()).pathname.split("/").at(-2));
      return route.fulfill({ json: uploadedVideos().find((item) => item.id === id) });
    });
    await page.goto(`${BASE}/workspace/videos/tree`);
    const add = page.locator('[title="영상 추가"]').first();
    await recording.screen("강의와 차시를 확인하기", "영상 메뉴에서 올릴 강의와 차시를 확인한 뒤 영상 추가를 누릅니다.", add);
    await add.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("video-batch-file-input").setInputFiles([
      { name: "01 함수 개념.mp4", mimeType: "video/mp4", buffer: Buffer.from("synthetic-guide-file-one") },
      { name: "02 함수 문제풀이.mp4", mimeType: "video/mp4", buffer: Buffer.from("synthetic-guide-file-two") },
    ]);
    await recording.screen("파일을 선택하기", "파일 여러 개를 한 번에 선택할 수 있습니다. 학생에게 표시할 제목을 확인합니다.", dialog);
    await dialog.getByLabel("1번째 영상 제목").fill("함수 개념 정리");
    await dialog.getByRole("button", { name: "2번째 영상을 위로 이동" }).click();
    await recording.screen("제목과 순서를 정하기", "제목은 직접 수정하고 화살표로 순서를 바꿉니다. 아래에서 재생 제한 설정도 확인합니다.", dialog);
    await dialog.getByRole("button", { name: "업로드 (2개)" }).click();
    await expect.poll(() => evidence.completedVideoIds.length).toBe(2);
    await expect(dialog).toBeHidden();
    const uploaded = page.getByText("함수 개념 정리", { exact: true }).first();
    await recording.screen("파일 전송과 처리 확인", "전송 중에도 창을 닫고 작업박스에서 다시 열 수 있습니다. 전송이 끝날 때까지 브라우저 탭은 열어 두세요.", uploaded);
    await page.reload();
    await recording.screen("목록에서 다시 확인하기", "새로고침 후 제목과 순서를 확인합니다. 처리 완료 후 재생과 학생별 접근 권한도 확인해 주세요.", uploaded);
    expect(evidence.initRequests.map((item) => item.title)).toEqual(["02 함수 문제풀이", "함수 개념 정리"]);
    await recording.finish();
  });
}

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
  await expect(dialog.getByLabel("1번째 영상 복습시간 1.4배 제한")).not.toBeChecked();
  await dialog.getByLabel("1번째 영상 복습시간 1.4배 제한").check();

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
    { title: "미분 활용 핵심 정리", filename: "03 미분 활용.webm", limited: false },
    { title: "01 함수의 극한", filename: "01 함수의 극한.mp4", limited: true },
    { title: "02 연속성", filename: "02 연속성.MOV", limited: false },
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

  await expect.poll(() => ({
    abortCount: evidence.multipartAbortCount,
    completeParts: evidence.multipartCompleteParts,
    putAttempts: evidence.multipartPutAttempts,
    putAttemptsByPart: evidence.multipartPutAttemptsByPart,
  }), { timeout: 30_000 }).toEqual({
    abortCount: 1,
    completeParts: [],
    putAttempts: 8,
    putAttemptsByPart: { 1: 4, 2: 4 },
  });
});

test("두 대용량 업로드가 멈추면 해당 파트만 다시 보내고 대기 영상까지 완료한다", async ({ page }) => {
  test.setTimeout(120_000);
  const evidence = await installApp(page);
  const heldVideos = new Set<number>();
  const releaseRequests = Promise.withResolvers<void>();
  const expectedIds = [9201, 9202];
  await page.route(/\/e2e-video-multipart\/part\/1\?video=920[12]$/, async (route) => {
    const videoId = Number(new URL(route.request().url()).searchParams.get("video"));
    if (heldVideos.has(videoId)) {
      await route.fallback();
      return;
    }
    heldVideos.add(videoId);
    await releaseRequests.promise;
    await route.abort().catch(() => {});
  });

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    await gotoAndSettle(page, `${BASE}/workspace/videos/tree`, { timeout: 45_000 });
    await page.locator('[title="영상 추가"]').click();
    const dialog = page.getByRole("dialog");
    await dropLargeVideo(dialog, "first-101mb.mp4");
    await dropLargeVideo(dialog, "second-101mb.mp4");
    await dialog.getByTestId("video-batch-file-input").setInputFiles({
      name: "queued.mp4", mimeType: "video/mp4", buffer: Buffer.from("queued"),
    });
    await dialog.getByRole("button", { name: "업로드 (3개)" }).click();
    await expect.poll(() => [...heldVideos].sort()).toEqual(expectedIds);
    expect(evidence.completedVideoIds).toEqual([]);

    await page.clock.fastForward(60_000);
    expect(evidence.multipartPresigns).toHaveLength(2);
    expect(evidence.completedVideoIds).toEqual([]);

    await page.clock.fastForward(31_000);
    await page.clock.fastForward(4_000);
    await expect.poll(() => evidence.multipartCompletedVideoIds.slice().sort()).toEqual(expectedIds);
    await expect.poll(() => evidence.completedVideoIds).toEqual([9203]);
    expect(evidence.initRequests.map((item) => item.filename)).toEqual([
      "first-101mb.mp4", "second-101mb.mp4", "queued.mp4",
    ]);
    expect(evidence.multipartPresigns.filter(({ partNumbers }) => partNumbers.length === 1)
      .map(({ videoId, partNumbers }) => [videoId, ...partNumbers]).sort()).toEqual([[9201, 1], [9202, 1]]);
    expect(evidence.multipartPutAttemptsByPart).toEqual({ 1: 2, 2: 2 });
    expect(evidence.multipartAbortCount).toBe(0);
    await expect.poll(
      () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(1);
  } finally {
    releaseRequests.resolve();
  }
});

test("작업박스에서 전송 창을 다시 열어 MTS 3개의 전송량과 대기 순서를 확인한다", async ({ page }, testInfo) => {
  const evidence = await installApp(page);
  await gotoAndSettle(page, `${BASE}/workspace/videos/tree`, { timeout: 45_000 });
  await page.locator('[title="영상 추가"]').click({ timeout: 60_000 });
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "영상 파일 추가" }).evaluate(dropZone => {
    const data = new DataTransfer();
    for (const name of ["first.MTS", "second.MTS", "third.MTS"]) {
      const file = new File([new Uint8Array(2 * 1024 * 1024)], name, { type: "" });
      Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });
      data.items.add(file);
    }
    dropZone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: data }));
    const send = XMLHttpRequest.prototype.send;
    const held: Array<() => void> = [];
    XMLHttpRequest.prototype.send = function (body) {
      if (!(body instanceof Blob) || body.size === 0) return send.call(this, body);
      held.push(() => send.call(this, body));
      this.upload.dispatchEvent(new ProgressEvent("progress", { loaded: 1024 * 1024, total: body.size, lengthComputable: true }));
    };
    window.addEventListener("release-test-video-parts", () => {
      XMLHttpRequest.prototype.send = send;
      held.forEach(resume => resume());
    }, { once: true });
  });
  try {
    await dialog.getByRole("button", { name: "업로드 (3개)" }).click();
    const rows = dialog.getByRole("listitem");
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(rows.nth(1)).toContainText("1.0MB / 101.0MB");
      await dialog.getByRole("button", { name: "닫기", exact: true }).click();
      await expect(dialog).toBeHidden();
      if (width === 1366) {
        await page.locator('aside a[href="/workspace/dashboard"]').click();
        await expect(page).toHaveURL(/\/workspace\/dashboard$/);
      }
      const workbox = page.getByRole("button", { name: "작업박스 열기", exact: true });
      if (await workbox.isVisible()) await workbox.click();
      const upload = page.getByRole("button", { name: "영상 추가 · second 업로드 창 열기", exact: true });
      if (width === 1366) await upload.press("Enter");
      else await upload.click();
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(/\/workspace\/dashboard$/);
      for (const index of [0, 1]) {
        await expect(rows.nth(index)).toContainText("1.0MB / 101.0MB");
        await expect(rows.nth(index).getByRole("progressbar")).toBeVisible();
      }
      await expect(rows.nth(2)).toContainText("전송 순서 대기");
      await expect(dialog.getByRole("button", { name: "저장 완료 0/3개" })).toBeDisabled();
      expect(evidence.initRequests).toHaveLength(2);
      expect(evidence.multipartCompletedVideoIds).toHaveLength(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const path = testInfo.outputPath(`mts-upload-progress-${width}.png`);
      await page.screenshot({ path });
      await testInfo.attach(`mts-upload-progress-${width}`, { path, contentType: "image/png" });
    }
  } finally {
    await page.evaluate(() => window.dispatchEvent(new Event("release-test-video-parts")));
  }
  await expect.poll(() => evidence.multipartCompletedVideoIds.length).toBe(3);
  expect(new Set(evidence.multipartCompletedVideoIds).size).toBe(3);
  await expect(dialog).toBeHidden();
});

test("작은 영상 두 건의 저장 응답이 끊겨도 새 URL로 복구하고 대기 파일을 완료한다", async ({ page }) => {
  test.setTimeout(120_000);
  const evidence = await installApp(page);
  const held = new Set<string>();
  const refreshed: string[] = [];
  const release = Promise.withResolvers<void>();
  await page.route(/\/e2e-video-upload\/920[12]$/, async route => {
    held.add(new URL(route.request().url()).pathname);
    await release.promise;
    await route.abort().catch(() => {});
  });
  await page.route(/\/media\/videos\/(920[12])\/upload\/refresh-url\/$/, route => {
    const id = new URL(route.request().url()).pathname.split("/").at(-4)!;
    refreshed.push(id);
    return route.fulfill({ json: { upload_url: `${BASE}/e2e-video-upload/${id}?renewed=1` } });
  });
  try {
    await page.clock.install();
    await gotoAndSettle(page, `${BASE}/workspace/videos/tree`, { timeout: 45_000 });
    await page.locator('[title="영상 추가"]').click();
    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("video-batch-file-input").setInputFiles(
      ["첫째", "둘째", "셋째"].map(name => ({ name: `${name}.mp4`, mimeType: "video/mp4", buffer: Buffer.from(name) })),
    );
    await dialog.getByRole("button", { name: "업로드 (3개)" }).click();
    await expect.poll(() => held.size).toBe(2);
    expect(evidence.initRequests).toHaveLength(2);
    expect(evidence.completedVideoIds).toEqual([]);
    await page.clock.fastForward(91_000);
    await page.clock.fastForward(4_000);
    await expect.poll(() => evidence.completedVideoIds.slice().sort()).toEqual([9201, 9202, 9203]);
    expect(refreshed.sort()).toEqual(["9201", "9202"]);
    expect(evidence.initRequests).toHaveLength(3);
  } finally {
    release.resolve();
  }
});

test("혼합 선택에서 MIME 없는 영상과 제외한 파일을 구분하고 실패한 완료 요청만 재시도한다", async ({ page }) => {
  const evidence = await installApp(page);
  let attempts = 0;
  let puts = 0;
  await page.route("**/e2e-video-upload/**", route => { puts++; return route.fallback(); });
  let releaseCompletion!: () => void;
  const heldCompletion = new Promise<void>(resolve => { releaseCompletion = resolve; });
  await page.route("**/media/videos/9202/upload/complete/", async route => {
    if (++attempts > 1) return route.fallback();
    await heldCompletion;
    return route.fulfill({ status: 429, json: { detail: "잠시 뒤 다시 시도해 주세요." } });
  });
  await gotoAndSettle(page, `${BASE}/workspace/videos/tree`, { timeout: 45_000 });
  await page.locator('[title="영상 추가"]').click({ timeout: 60_000 });
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "영상 파일 추가" }).evaluate(node => {
    const transfer = new DataTransfer();
    for (const [name, type] of [["one.mp4", "video/mp4"], ["two.MOV", ""], ["notes.pdf", "application/pdf"], ["three.mkv", "application/octet-stream"]]) {
      transfer.items.add(new File(["video"], name, { type }));
    }
    node.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
  });
  await expect(dialog.getByRole("alert")).toContainText("notes.pdf");
  await dialog.getByRole("button", { name: "업로드 (3개)" }).click();
  try {
    await expect.poll(() => attempts).toBe(1);
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(dialog).toBeHidden();
  } finally {
    releaseCompletion();
  }
  const workbox = page.locator("button.app-header__workboxBtn");
  if (await workbox.getAttribute("aria-expanded") !== "true") await workbox.click();
  const failedTask = page.locator(".async-status-bar__item").filter({ hasText: "영상 추가 · two" });
  await expect(failedTask).toContainText("실패");
  await failedTask.getByRole("button", { name: /업로드 창 열기/ }).click();
  await expect(dialog.getByText(/two.MOV · 완료 확인 실패/)).toBeVisible();
  await expect(dialog.getByLabel("1번째 영상 제목")).toHaveValue("two");
  await dialog.getByRole("button", { name: "다시 시도 (1개)" }).click();
  await expect(dialog).toBeHidden();
  expect(evidence.initRequests.map(row => row.filename)).toEqual(["one.mp4", "two.MOV", "three.mkv"]);
  expect(evidence.completedVideoIds.slice().sort()).toEqual([9201, 9202, 9203]);
  expect(puts).toBe(3);
  expect(attempts).toBe(2);
});

test("저장 후 인코딩 접수가 거절되면 같은 영상의 인코딩만 다시 시작한다", async ({ page }) => {
  const evidence = await installApp(page);
  let puts = 0;
  let completions = 0;
  let retries = 0;
  await page.route("**/e2e-video-upload/**", route => { puts++; return route.fallback(); });
  await page.route("**/media/videos/9201/upload/complete/", route => {
    completions++;
    return route.fulfill({ status: 503, json: { code: "VIDEO_BATCH_SUBMIT_FAILED", detail: "인코딩 접수 실패" } });
  });
  await page.route("**/media/videos/9201/", route => route.fulfill({ json: { id: 9201, status: "FAILED" } }));
  await page.route("**/media/videos/9201/retry/", route => {
    retries++;
    return route.fulfill({ status: 202, json: { detail: "queued" } });
  });
  await gotoAndSettle(page, `${BASE}/workspace/videos/tree`, { timeout: 45_000 });
  await page.locator('[title="영상 추가"]').click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("video-batch-file-input").setInputFiles({ name: "lesson.mp4", mimeType: "video/mp4", buffer: Buffer.from("lesson") });
  await dialog.getByRole("button", { name: "업로드 (1개)" }).click();
  await expect(dialog.getByText(/lesson.mp4 · 영상 저장 완료 · 인코딩 시작 실패/)).toBeVisible();
  await dialog.getByRole("button", { name: "다시 시도 (1개)" }).click();
  await expect(dialog).toBeHidden();
  expect({ registrations: evidence.initRequests.length, puts, completions, retries }).toEqual({
    registrations: 1, puts: 1, completions: 1, retries: 1,
  });
});

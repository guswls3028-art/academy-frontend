import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures/strictTest";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";
test.use({ serviceWorkers: "block" });

function localJwt(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installSubmissionApi(page: Page, options: {
  breakImageOnReopen?: boolean;
  brokenImage?: boolean;
  externalFile?: "pdf" | "unsupported";
} = {}) {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, localJwt());

  const assignmentBodies: Array<Record<string, unknown>> = [];
  let imageCalls = 0;
  let presignCalls = 0;

  const fileKey = options.externalFile === "pdf"
    ? "tenants/11/submissions/501/answer-sheet.pdf"
    : options.externalFile === "unsupported"
      ? "tenants/11/submissions/501/answer-sheet.hwp"
      : "tenants/11/submissions/501/answer-sheet.png";
  const fileUrl = `${BASE}/api/v1/mock-files/${fileKey.split("/").pop()}`;

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path === "/mock-files/answer-sheet.png" && request.method() === "GET") {
      imageCalls += 1;
      if (options.brokenImage || (options.breakImageOnReopen && imageCalls >= 2)) {
        await route.fulfill({
          status: 404,
          contentType: "text/plain",
          headers: { "cache-control": "no-store" },
          body: "missing",
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        headers: { "cache-control": "no-store" },
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2fKAAAAAASUVORK5CYII=",
          "base64",
        ),
      });
      return;
    }
    if (path === "/mock-files/answer-sheet.hwp" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "mock hwp source" });
      return;
    }
    if (path === "/mock-files/answer-sheet.pdf" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<p>mock pdf source</p>" });
      return;
    }
    if (path === "/submissions/submissions/pending/" && request.method() === "GET") {
      await json(route, [
        {
          id: 501,
          enrollment_id: 0,
          student_name: "",
          target_type: "exam",
          target_id: 77,
          target_title: "중2 과학 진단평가",
          lecture_id: 31,
          lecture_title: "중2 과학 정규반",
          session_id: 44,
          target_resolved: true,
          target_resolved_reason: null,
          source: "scan",
          status: "needs_identification",
          file_key: fileKey,
          file_type: options.externalFile === "pdf"
            ? "application/pdf"
            : options.externalFile === "unsupported"
              ? "application/x-hwp"
              : "image/png",
          file_size: 2 * 1024 * 1024,
          created_at: "2026-08-23T08:30:00+09:00",
        },
      ]);
      return;
    }
    if (path === "/storage/inventory/presign/" && request.method() === "POST") {
      presignCalls += 1;
      expect(request.postDataJSON()).toEqual({
        r2_key: fileKey,
        expires_in: 900,
      });
      await json(route, { url: `${fileUrl}?review=${presignCalls}` });
      return;
    }
    if (path === "/submissions/submissions/exams/77/candidates/" && request.method() === "GET") {
      await json(route, [
        {
          enrollment_id: 901,
          student_name: "김학생",
          student_phone_last4: "1234",
          parent_phone_last4: "5678",
          lecture_title: "중2 과학 정규반",
          already_matched: false,
        },
      ]);
      return;
    }
    if (path === "/submissions/submissions/501/manual-edit/" && request.method() === "POST") {
      assignmentBodies.push(request.postDataJSON() as Record<string, unknown>);
      await json(route, { submission_id: 501, status: "grading" });
      return;
    }
    await route.fallback();
  });

  return {
    assignmentBodies,
    get imageCalls() {
      return imageCalls;
    },
    get presignCalls() {
      return presignCalls;
    },
  };
}

test("제출 파일을 확인한 뒤에만 학생을 지정한다", async ({ page }) => {
  const calls = await installSubmissionApi(page);
  await page.setViewportSize({ width: 1440, height: 960 });
  await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });

  const fileMeta = page.getByTestId("submission-file-meta-501");
  await expect(fileMeta).toContainText("answer-sheet.png");
  await expect(fileMeta).toContainText("PNG · 2.0 MB");
  await expect(page.getByRole("button", { name: "학생 지정", exact: true })).toHaveCount(0);

  const previewButton = page.getByTestId("submission-preview-501");
  await previewButton.click();
  const previewDialog = page.getByRole("dialog", { name: "제출물 확인" });
  await expect(previewDialog).toBeVisible();
  const previewImage = previewDialog.getByAltText("answer-sheet.png 제출물");
  await expect(previewImage).toBeVisible();
  await expect(previewImage).toHaveJSProperty("naturalWidth", 1);
  await expect(previewDialog.getByText("중2 과학 진단평가", { exact: true })).toBeVisible();
  await expect(previewDialog.getByRole("button", { name: "확인하고 학생 지정" })).toBeEnabled();
  expect(calls.presignCalls).toBe(1);
  expect(calls.imageCalls).toBe(1);

  await previewDialog.getByRole("button", { name: "닫기" }).click();
  await expect(previewDialog).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(previewButton).toBeVisible();
  await previewButton.click();
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.getByAltText("answer-sheet.png 제출물")).toHaveJSProperty("complete", true);
  await expect(previewDialog.getByRole("button", { name: "확인하고 학생 지정" })).toBeEnabled();
  const previewBounds = await previewDialog.getByTestId("submission-preview-content").boundingBox();
  expect(previewBounds).not.toBeNull();
  expect(previewBounds!.x).toBeGreaterThanOrEqual(0);
  expect(previewBounds!.x + previewBounds!.width).toBeLessThanOrEqual(390);

  await previewDialog.getByRole("button", { name: "확인하고 학생 지정" }).click();
  const picker = page.getByRole("dialog", { name: "학생 선택" });
  await expect(picker).toBeVisible();
  await picker.getByText("김학생", { exact: true }).click();

  await expect.poll(() => calls.assignmentBodies.length).toBe(1);
  expect(calls.assignmentBodies[0]).toEqual({
    identifier: { enrollment_id: 901 },
    answers: [],
    note: "inbox_quick_identify",
  });
});

test("깨진 제출 이미지는 학생 지정을 끝까지 잠근다", async ({ page }) => {
  const calls = await installSubmissionApi(page, { brokenImage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });

  await page.getByTestId("submission-preview-501").click();
  const previewDialog = page.getByRole("dialog", { name: "제출물 확인" });
  const identifyButton = previewDialog.getByRole("button", { name: "확인하고 학생 지정" });
  await expect(previewDialog.getByRole("alert")).toContainText("제출 이미지를 열 수 없습니다.");
  await expect(identifyButton).toBeDisabled();

  await identifyButton.evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByRole("dialog", { name: "학생 선택" })).toHaveCount(0);
  expect(calls.assignmentBodies).toHaveLength(0);

  await previewDialog.getByRole("button", { name: "이미지 다시 시도" }).click();
  await expect.poll(() => calls.presignCalls).toBe(2);
  await expect(previewDialog.getByRole("alert")).toContainText("학생 지정이 잠겼습니다.");
  await expect(identifyButton).toBeDisabled();
  expect(calls.assignmentBodies).toHaveLength(0);
});

test("같은 제출을 다시 열어도 이전 이미지 확인 상태를 재사용하지 않는다", async ({ page }) => {
  const calls = await installSubmissionApi(page, { breakImageOnReopen: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });

  await page.getByTestId("submission-preview-501").click();
  const previewDialog = page.getByRole("dialog", { name: "제출물 확인" });
  const identifyButton = previewDialog.getByRole("button", { name: "확인하고 학생 지정" });
  await expect(identifyButton).toBeEnabled();
  await previewDialog.getByRole("button", { name: "닫기" }).click();

  await page.getByTestId("submission-preview-501").click();
  await expect(previewDialog.getByRole("alert")).toContainText("제출 이미지를 열 수 없습니다.");
  await expect(identifyButton).toBeDisabled();
  await identifyButton.evaluate((button: HTMLButtonElement) => button.click());
  expect(calls.presignCalls).toBe(2);
  expect(calls.imageCalls).toBe(2);
  expect(calls.assignmentBodies).toHaveLength(0);
});

for (const externalFile of ["pdf", "unsupported"] as const) {
  test(`${externalFile === "pdf" ? "PDF" : "화면 미지원"} 파일은 원본을 열고 명시 확인하기 전까지 지정을 잠근다`, async ({ page }) => {
    const calls = await installSubmissionApi(page, { externalFile });
    await page.setViewportSize({ width: 1440, height: 960 });
    await gotoAndSettle(page, `${BASE}/workspace/results/submissions`, { timeout: 60_000 });

    await page.getByTestId("submission-preview-501").click();
    const previewDialog = page.getByRole("dialog", { name: "제출물 확인" });
    const identifyButton = previewDialog.getByRole("button", { name: "확인하고 학생 지정" });
    const confirmation = previewDialog.getByRole("checkbox");
    await expect(identifyButton).toBeDisabled();
    await expect(confirmation).toBeDisabled();

    const popupPromise = page.waitForEvent("popup");
    await previewDialog.getByRole("link", { name: "새 창에서 원본 열기" }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await popup.close();

    await expect(confirmation).toBeEnabled();
    await confirmation.check();
    await expect(identifyButton).toBeEnabled();

    await previewDialog.getByRole("button", { name: "닫기" }).click();
    await page.getByTestId("submission-preview-501").click();
    await expect(confirmation).toBeDisabled();
    await expect(identifyButton).toBeDisabled();

    const reopenPopupPromise = page.waitForEvent("popup");
    await previewDialog.getByRole("link", { name: "새 창에서 원본 열기" }).click();
    const reopenPopup = await reopenPopupPromise;
    await reopenPopup.waitForLoadState("domcontentloaded");
    await reopenPopup.close();
    await confirmation.check();
    await expect(identifyButton).toBeEnabled();
    await identifyButton.click();
    await expect(page.getByRole("dialog", { name: "학생 선택" })).toBeVisible();
    expect(calls.assignmentBodies).toHaveLength(0);
  });
}

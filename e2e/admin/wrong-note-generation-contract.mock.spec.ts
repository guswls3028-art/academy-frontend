import { expect, test } from "../fixtures/strictTest";
import type { Page, Route } from "@playwright/test";
import { extractApiError } from "../../src/shared/utils/extractApiError";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

const wrongNoteItem = {
  exam_id: 41,
  exam_title: "7월 진단평가",
  question_id: 101,
  question_number: 1,
  session_order: 1,
  session_title: "1주차",
  question_image_url: "",
  has_question_image: false,
  student_answer: "2",
  correct_answer: "3",
  is_correct: false,
  score: 0,
  max_score: 5,
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": BASE,
      "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  });
}

async function mockWrongNoteApi(
  page: Page,
  options: { total: number; createDelayMs?: number },
) {
  await page.route("**/api/v1/results/wrong-notes**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": BASE,
          "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
    }

    const path = new URL(request.url()).pathname;
    if (path.endsWith("/results/wrong-notes") && request.method() === "GET") {
      return json(route, {
        count: options.total,
        next: null,
        previous: null,
        results: [wrongNoteItem],
      });
    }
    if (path.endsWith("/results/wrong-notes/pdf/") && request.method() === "POST") {
      if (options.createDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.createDelayMs));
      }
      return json(route, {
        job_id: 9,
        status: "DONE",
        status_url: `${BASE}/api/v1/results/wrong-notes/pdf/9/`,
      }, 201);
    }
    if (path.endsWith("/results/wrong-notes/pdf/9/") && request.method() === "GET") {
      return json(route, {
        job_id: 9,
        status: "DONE",
        file_path: "tenants/1/results/wrong-notes/9.pdf",
        file_url: "https://download.example/wrong-note.pdf",
        error_message: "",
        created_at: "2026-07-28T00:00:00Z",
        updated_at: "2026-07-28T00:00:01Z",
      });
    }
    return json(route, { detail: `Unhandled ${request.method()} ${path}` }, 404);
  });
}

test.describe("오답노트 생성 계약", () => {
  test("정확히 100문항은 생성할 수 있다", async ({ page }) => {
    await mockWrongNoteApi(page, { total: 100 });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);

    await expect(page.getByTestId("wrong-note-create")).toBeEnabled();
    await expect(page.getByTestId("wrong-note-limit-guidance")).toHaveCount(0);
  });

  test("100문항 초과는 요청 전에 막고 범위 축소를 안내한다", async ({ page }) => {
    await mockWrongNoteApi(page, { total: 101 });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);

    await page.getByRole("button", { name: /강의 누적/ }).click();
    await expect(page.getByTestId("wrong-note-limit-guidance")).toContainText(
      "한 번에 최대 100문항",
    );
    await expect(page.getByTestId("wrong-note-limit-guidance")).toContainText(
      "이번 시험",
    );
    await expect(page.getByTestId("wrong-note-create")).toBeDisabled();
    await page.screenshot({
      path: "test-results/wrong-note-limit-1366.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(page.getByTestId("wrong-note-create")).toBeVisible();
    await page.screenshot({
      path: "test-results/wrong-note-limit-1100.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 375, height: 812 });
    const guidance = page.getByTestId("wrong-note-limit-guidance");
    await expect(guidance).toBeVisible();
    await expect(guidance).toContainText("이번 시험");
    expect(
      await guidance.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        whiteSpace: getComputedStyle(element).whiteSpace,
      })),
    ).toEqual(expect.objectContaining({ whiteSpace: "normal" }));
    expect(await guidance.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
      await guidance.evaluate((element) => element.clientWidth),
    );
    await page.screenshot({
      path: "test-results/wrong-note-limit-375.png",
      fullPage: true,
    });
  });

  test("20초를 넘는 정상 생성 요청을 기다린 뒤 다운로드로 전환한다", async ({ page }) => {
    test.setTimeout(45_000);
    await mockWrongNoteApi(page, { total: 1, createDelayMs: 21_000 });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);

    await page.getByTestId("wrong-note-create").click();
    await expect(page.getByTestId("wrong-note-create")).toContainText("PDF 만드는 중");
    await expect(page.getByTestId("wrong-note-download")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test("전송 오류 포매터는 timeout과 비객체 예외를 안전한 문구로 바꾼다", () => {
  expect(extractApiError({ code: "ECONNABORTED" }, "다시 시도해 주세요.")).toBe(
    "다시 시도해 주세요.",
  );
  expect(extractApiError(null, "안전한 오류")).toBe("안전한 오류");
  expect(extractApiError(undefined, "안전한 오류")).toBe("안전한 오류");
});

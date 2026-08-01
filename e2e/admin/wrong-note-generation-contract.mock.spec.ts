import { expect, test } from "../fixtures/strictTest";
import type { Page, Route } from "@playwright/test";
import { extractApiError } from "../../src/shared/utils/extractApiError";
import { appendSerialTask } from "../../src/app_admin/domains/results/utils/serialSaveQueue";

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
  options: {
    total: number;
    createDelayMs?: number;
    statusResponses?: Array<{ file_url: string; status?: string; error_message?: string }>;
  },
) {
  let createCalls = 0;
  let statusCalls = 0;
  const listRequestUrls: string[] = [];
  const createPayloads: Array<Record<string, unknown>> = [];
  let currentWrongNoteItem = wrongNoteItem;
  await page.route("https://download.example/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: "%PDF-1.4 mock",
    }),
  );
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
      listRequestUrls.push(request.url());
      return json(route, {
        count: options.total,
        next: null,
        prev: null,
        results: [currentWrongNoteItem],
      });
    }
    if (path.endsWith("/results/wrong-notes/pdf/") && request.method() === "POST") {
      createCalls += 1;
      createPayloads.push(request.postDataJSON() as Record<string, unknown>);
      if (options.createDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.createDelayMs));
      }
      return json(route, {
        job_id: 9,
        status: "PENDING",
        status_url: `${BASE}/api/v1/results/wrong-notes/pdf/9/`,
      }, 202);
    }
    if (path.endsWith("/results/wrong-notes/pdf/9/") && request.method() === "GET") {
      const configured =
        options.statusResponses?.[
          Math.min(statusCalls, options.statusResponses.length - 1)
        ];
      statusCalls += 1;
      return json(route, {
        job_id: 9,
        status: configured?.status ?? "DONE",
        file_path: "tenants/1/results/wrong-notes/9.pdf",
        file_url: configured?.file_url ?? "https://download.example/wrong-note.pdf",
        error_message: configured?.error_message ?? "",
        created_at: "2026-07-28T00:00:00Z",
        updated_at: "2026-07-28T00:00:01Z",
      });
    }
    return json(route, { detail: `Unhandled ${request.method()} ${path}` }, 404);
  });
  return {
    get createCalls() {
      return createCalls;
    },
    get statusCalls() {
      return statusCalls;
    },
    get listRequestUrls() {
      return listRequestUrls;
    },
    get createPayloads() {
      return createPayloads;
    },
    setWrongNoteItem(item: typeof wrongNoteItem) {
      currentWrongNoteItem = item;
    },
  };
}

test.describe("오답노트 생성 계약", () => {
  test("정확히 100문항은 생성할 수 있다", async ({ page }) => {
    const calls = await mockWrongNoteApi(page, { total: 100 });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);

    await expect(page.getByTestId("wrong-note-create")).toBeEnabled();
    await expect(page.getByTestId("wrong-note-limit-guidance")).toHaveCount(0);
    await page.getByTestId("wrong-note-create").click();
    await expect(page.getByTestId("wrong-note-download")).toBeVisible();
    const popupPromise = page.waitForEvent("popup");
    const downloadRequestPromise = page.context().waitForEvent("request", {
      predicate: (request) =>
        request.url() === "https://download.example/wrong-note.pdf",
    });
    await page.getByTestId("wrong-note-download").click();
    await popupPromise;
    expect((await downloadRequestPromise).url()).toBe(
      "https://download.example/wrong-note.pdf",
    );
    expect(calls.createCalls).toBe(1);
    expect(calls.statusCalls).toBeGreaterThanOrEqual(1);
  });

  test("100문항 초과는 요청 전에 막고 범위 축소를 안내한다", async ({ page }) => {
    await mockWrongNoteApi(page, { total: 101 });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);

    await page.getByRole("button", { name: /회차 범위/ }).click();
    await expect(page.getByTestId("wrong-note-limit-guidance")).toContainText(
      "한 번에 최대 100문항",
    );
    await expect(page.getByTestId("wrong-note-limit-guidance")).toContainText(
      "시작·종료 회차",
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
    await expect(guidance).toContainText("시작·종료 회차");
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

  test("생성 요청 중에는 범위를 잠그고 202 job을 다운로드로 전환한다", async ({ page }) => {
    await mockWrongNoteApi(page, { total: 1, createDelayMs: 1_000 });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);

    await page.getByTestId("wrong-note-create").click();
    await expect(page.getByTestId("wrong-note-create")).toContainText("PDF 만드는 중");
    await expect(page.getByRole("button", { name: /회차 범위/ })).toBeDisabled();
    await expect(page.getByTestId("wrong-note-download")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("서명 URL 복구는 같은 job 상태만 재조회하고 POST를 반복하지 않는다", async ({
    page,
  }) => {
    const calls = await mockWrongNoteApi(page, {
      total: 1,
      statusResponses: [
        { file_url: "" },
        { file_url: "https://download.example/refreshed-wrong-note.pdf" },
      ],
    });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);

    await page.getByTestId("wrong-note-create").click();
    await expect(page.getByRole("alert")).toContainText("다운로드 주소");
    await page.getByRole("button", { name: "상태 다시 확인" }).click();
    await expect(page.getByTestId("wrong-note-download")).toBeVisible();
    expect(calls.createCalls).toBe(1);
    expect(calls.statusCalls).toBe(2);
  });

  test("화면을 다시 열어도 진행 중 job을 복구하고 POST를 반복하지 않는다", async ({
    page,
  }) => {
    const calls = await mockWrongNoteApi(page, {
      total: 1,
      statusResponses: [
        { status: "PENDING", file_url: "" },
        { status: "DONE", file_url: "https://download.example/recovered.pdf" },
      ],
    });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);

    await page.getByTestId("wrong-note-create").click();
    await expect.poll(() => calls.statusCalls).toBe(1);
    await page.reload();

    await expect(page.getByTestId("wrong-note-download")).toBeVisible();
    expect(calls.createCalls).toBe(1);
    expect(calls.statusCalls).toBe(2);
  });

  test("PDF 입력 데이터가 바뀌면 기존 다운로드를 폐기한다", async ({ page }) => {
    const calls = await mockWrongNoteApi(page, { total: 1 });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);
    await page.getByTestId("wrong-note-create").click();
    await expect(page.getByTestId("wrong-note-download")).toBeVisible();

    calls.setWrongNoteItem({
      ...wrongNoteItem,
      exam_title: "수정된 진단평가",
      has_question_image: true,
      question_image_url: "https://download.example/question.png",
    });
    await page.evaluate(async () => {
      const client = (
        window as typeof window & {
          __wrongNoteQueryClient: {
            invalidateQueries: (options: { queryKey: unknown[] }) => Promise<void>;
          };
        }
      ).__wrongNoteQueryClient;
      await client.invalidateQueries({ queryKey: ["wrong-notes", 7] });
    });

    await expect(page.getByText("수정된 진단평가")).toBeVisible();
    await expect(page.getByTestId("wrong-note-download")).toHaveCount(0);
    await expect(page.getByTestId("wrong-note-create")).toBeEnabled();
  });

  test("시작~종료 회차를 조회와 PDF 생성에 같은 값으로 보낸다", async ({ page }) => {
    const calls = await mockWrongNoteApi(page, { total: 1 });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);

    await page.getByRole("button", { name: /회차 범위/ }).click();
    await page.getByTestId("wrong-note-range-from").fill("2");
    await page.getByTestId("wrong-note-range-to").fill("4");

    await expect.poll(
      () => calls.listRequestUrls[calls.listRequestUrls.length - 1] ?? "",
    ).toContain(
      "from_session_order=2",
    );
    await expect.poll(
      () => calls.listRequestUrls[calls.listRequestUrls.length - 1] ?? "",
    ).toContain(
      "to_session_order=4",
    );
    await expect(page.getByText("2~4회차의 오답과 오답노트 지정 문항을 모읍니다.")).toBeVisible();

    await page.getByTestId("wrong-note-create").click();
    await expect(page.getByTestId("wrong-note-download")).toBeVisible();
    expect(calls.createPayloads).toContainEqual(
      expect.objectContaining({
        enrollment_id: 7,
        from_session_order: 2,
        to_session_order: 4,
      }),
    );
  });

  test("종료 회차가 시작보다 빠르면 생성하지 않는다", async ({ page }) => {
    const calls = await mockWrongNoteApi(page, { total: 1 });
    await page.goto(`${BASE}/e2e-wrong-note-harness.html`);

    await page.getByRole("button", { name: /회차 범위/ }).click();
    await page.getByTestId("wrong-note-range-from").fill("5");
    await page.getByTestId("wrong-note-range-to").fill("3");

    await expect(page.getByRole("alert")).toContainText(
      "종료 회차는 시작 회차보다 빠를 수 없습니다.",
    );
    await expect(page.locator(".wrong-note__group")).toHaveCount(0);
    await expect(
      page.getByText("범위를 바로잡으면 해당 회차의 문항 수를 다시 계산합니다."),
    ).toBeVisible();
    await expect(page.getByTestId("wrong-note-create")).toBeDisabled();
    expect(calls.createCalls).toBe(0);
  });
});

test("점수 저장 queue는 이전 PATCH가 끝난 뒤 다음 값을 보낸다", async () => {
  const order: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  let tail = appendSerialTask(
    Promise.resolve(),
    async () => {
      order.push("first:start");
      await firstGate;
      order.push("first:end");
    },
    () => order.push("first:success"),
    () => order.push("first:error"),
  );
  tail = appendSerialTask(
    tail,
    async () => {
      order.push("second:start");
    },
    () => order.push("second:success"),
    () => order.push("second:error"),
  );

  await Promise.resolve();
  await Promise.resolve();
  expect(order).toEqual(["first:start"]);
  releaseFirst?.();
  await tail;
  expect(order).toEqual([
    "first:start",
    "first:end",
    "first:success",
    "second:start",
    "second:success",
  ]);
});

test("전송 오류 포매터는 알려진 네트워크 오류와 비객체 예외를 안전한 문구로 바꾼다", () => {
  expect(extractApiError({ code: "ECONNABORTED" }, "다시 시도해 주세요.")).toBe(
    "다시 시도해 주세요.",
  );
  for (const code of [
    "ERR_NETWORK",
    "ENOTFOUND",
    "ECONNRESET",
    "ECONNREFUSED",
    "ERR_INTERNET_DISCONNECTED",
  ]) {
    expect(extractApiError({ code, message: "Network Error" }, "안전한 오류")).toBe(
      "안전한 오류",
    );
  }
  expect(extractApiError(null, "안전한 오류")).toBe("안전한 오류");
  expect(extractApiError(undefined, "안전한 오류")).toBe("안전한 오류");
});

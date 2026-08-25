import { expect, test, type Page, type Route } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const SLIDE_NAMES = ["a-slide.png", "b-slide.png", "c-slide.png"] as const;
const PNG_FIXTURE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
  "base64",
);

function createLocalJwt() {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    exp: now + 3600,
    tenant_code: "hakwonplus",
    user_id: 12,
  })}.sig`;
}

type CapturedGenerateRequest = {
  filenames: string[];
  order: number[];
  perSlide: Array<{ invert?: boolean }>;
};

type PptHarness = {
  captured: CapturedGenerateRequest[];
  unexpectedMutations: string[];
  releaseGenerate: () => void;
};

function multipartField(body: string, name: string): string {
  const header = `name="${name}"`;
  const headerIndex = body.indexOf(header);
  if (headerIndex < 0) throw new Error(`multipart field missing: ${name}`);
  const valueStart = body.indexOf("\r\n\r\n", headerIndex);
  if (valueStart < 0) throw new Error(`multipart field malformed: ${name}`);
  const valueEnd = body.indexOf("\r\n--", valueStart + 4);
  if (valueEnd < 0) throw new Error(`multipart field unterminated: ${name}`);
  return body.slice(valueStart + 4, valueEnd);
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", json: body });
}

async function installPptRoutes(page: Page): Promise<PptHarness> {
  const captured: CapturedGenerateRequest[] = [];
  const unexpectedMutations: string[] = [];
  let releasePendingGenerate: (() => void) | undefined;
  const pendingGenerate = new Promise<void>((resolve) => {
    releasePendingGenerate = resolve;
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/v1/, "");
    const method = request.method();

    if (path === "/tools/ppt/generate/" && method === "POST") {
      const body = request.postDataBuffer()?.toString("latin1") ?? "";
      const settings = JSON.parse(multipartField(body, "settings")) as {
        per_slide?: Array<{ invert?: boolean }>;
      };
      captured.push({
        filenames: Array.from(
          body.matchAll(/name="images"; filename="([^"]+)"/g),
          (match) => match[1],
        ),
        order: JSON.parse(multipartField(body, "order")) as number[],
        perSlide: settings.per_slide ?? [],
      });
      await pendingGenerate;
      await json(route, { job_id: "ppt-mobile-ordering-job", status: "PENDING" });
      return;
    }

    if (path === "/jobs/ppt-mobile-ordering-job/progress/" && method === "GET") {
      await json(route, {
        job_id: "ppt-mobile-ordering-job",
        job_type: "ppt_generation",
        status: "DONE",
        result: {
          download_url: "data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,UEs=",
          filename: "mobile-ordering.pptx",
          slide_count: 3,
          size_bytes: 2,
        },
      });
      return;
    }

    if (!["GET", "OPTIONS"].includes(method)) {
      unexpectedMutations.push(`${method} ${path}`);
      await json(route, { detail: "unexpected mutation" }, 500);
      return;
    }
    await route.fallback();
  });

  return {
    captured,
    unexpectedMutations,
    releaseGenerate: () => releasePendingGenerate?.(),
  };
}

async function openPptGenerator(page: Page): Promise<PptHarness> {
  const baseUrl = getBaseUrl("admin");
  test.skip(
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl),
    "PPT 모바일 순서 route-mock은 로컬 dev 서버 전용",
  );
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, createLocalJwt());
  const harness = await installPptRoutes(page);
  await page.goto(`${baseUrl}/workspace/tools/ppt`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await expect(page).toHaveURL(/\/workspace\/tools\/ppt$/);
  return harness;
}

async function uploadSlides(page: Page) {
  await page.locator('input[type="file"][multiple]').setInputFiles(
    SLIDE_NAMES.map((name) => ({ name, mimeType: "image/png", buffer: PNG_FIXTURE })),
  );
  await expect(page.getByText("슬라이드 (3장)", { exact: true })).toBeVisible();
}

async function visibleFilenameOrder(page: Page) {
  return page.getByTestId("ppt-slide-item").evaluateAll((nodes) => (
    nodes.map((node) => node.getAttribute("data-filename"))
  ));
}

async function expectDocumentOverflowZero(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))).toEqual({ body: 0, document: 0 });
}

async function expectCapturedPayload(
  harness: PptHarness,
  expectedFilenames: string[],
  expectedInvert: boolean[],
) {
  await expect.poll(() => harness.captured).toHaveLength(1);
  expect(harness.captured[0]).toEqual({
    filenames: expectedFilenames,
    order: [0, 1, 2],
    perSlide: expectedInvert.map((invert) => expect.objectContaining({ invert })),
  });
}

test.describe("PPT 모바일 슬라이드 직접 정렬", () => {
  test.setTimeout(90_000);
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    serviceWorkers: "block",
  });

  test("390px에서 키보드·터치 정렬과 multipart 순서를 같은 상태로 보낸다", async ({ page }) => {
    const harness = await openPptGenerator(page);
    await uploadSlides(page);

    const sortSelect = page.getByLabel("정렬");
    await expect.poll(() => visibleFilenameOrder(page)).toEqual([
      "a-slide.png", "b-slide.png", "c-slide.png",
    ]);
    await sortSelect.selectOption("nameDesc");
    await expect.poll(() => visibleFilenameOrder(page)).toEqual([
      "c-slide.png", "b-slide.png", "a-slide.png",
    ]);
    await sortSelect.selectOption("nameAsc");
    await expect.poll(() => visibleFilenameOrder(page)).toEqual([
      "a-slide.png", "b-slide.png", "c-slide.png",
    ]);

    const firstPrevious = page.getByRole("button", { name: "a-slide.png 이전 순서로 이동" });
    const firstNext = page.getByRole("button", { name: "a-slide.png 다음 순서로 이동" });
    const lastNext = page.getByRole("button", { name: "c-slide.png 다음 순서로 이동" });
    const bPrevious = page.getByRole("button", { name: "b-slide.png 이전 순서로 이동" });
    const bNext = page.getByRole("button", { name: "b-slide.png 다음 순서로 이동" });

    await expect(firstPrevious).toBeVisible();
    await expect(firstPrevious).toBeDisabled();
    await expect(firstPrevious).toHaveAttribute("title", /첫 번째/);
    await expect(lastNext).toBeDisabled();
    await expect(lastNext).toHaveAttribute("title", /마지막/);

    const compactButtons = page.getByTestId("ppt-slide-order-controls").getByRole("button");
    await expect(compactButtons).toHaveCount(6);
    for (const button of await compactButtons.all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    await sortSelect.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(firstNext).toBeFocused();
    await bPrevious.focus();
    await expect(bPrevious).toBeFocused();
    await bPrevious.press("Enter");
    await expect.poll(() => visibleFilenameOrder(page)).toEqual([
      "b-slide.png", "a-slide.png", "c-slide.png",
    ]);
    await expect(sortSelect).toHaveValue("manual");

    await bNext.press("Space");
    await expect.poll(() => visibleFilenameOrder(page)).toEqual([
      "a-slide.png", "b-slide.png", "c-slide.png",
    ]);
    await bPrevious.tap();
    await expect.poll(() => visibleFilenameOrder(page)).toEqual([
      "b-slide.png", "a-slide.png", "c-slide.png",
    ]);

    await page.getByRole("button", { name: /흑백 반전.*흰 배경/ }).click();
    const firstSlide = page.getByTestId("ppt-slide-item").first();
    await firstSlide.getByTitle("흑백 반전").click();
    const generateButton = page.getByRole("button", { name: "PPT 생성 및 다운로드" });
    await generateButton.click();
    await expectCapturedPayload(
      harness,
      ["b-slide.png", "a-slide.png", "c-slide.png"],
      [true, false, false],
    );
    for (const item of await page.getByTestId("ppt-slide-item").all()) {
      await expect(item).toHaveAttribute("draggable", "false");
    }
    for (const button of await compactButtons.all()) await expect(button).toBeDisabled();
    await expect(bNext).toHaveAttribute("title", /PPT 생성 중/);

    harness.releaseGenerate();
    await expect(generateButton).toBeEnabled();
    expect(harness.unexpectedMutations).toEqual([]);
    await expectDocumentOverflowZero(page);
  });

  test("1366px에서는 compact 제어를 숨기고 기존 drag와 payload를 보존한다", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const harness = await openPptGenerator(page);
    await uploadSlides(page);

    const items = page.getByTestId("ppt-slide-item");
    await expect(items).toHaveCount(3);
    await expect(page.getByTestId("ppt-slide-order-controls").first()).toBeHidden();
    for (const item of await items.all()) await expect(item).toHaveAttribute("draggable", "true");

    await items.first().dragTo(items.last());
    await expect.poll(() => visibleFilenameOrder(page)).toEqual([
      "b-slide.png", "c-slide.png", "a-slide.png",
    ]);
    await expect(page.getByLabel("정렬")).toHaveValue("manual");
    await page.getByRole("button", { name: /흑백 반전.*흰 배경/ }).click();
    await items.last().getByTitle("흑백 반전").click();

    const generateButton = page.getByRole("button", { name: "PPT 생성 및 다운로드" });
    await generateButton.click();
    await expectCapturedPayload(
      harness,
      ["b-slide.png", "c-slide.png", "a-slide.png"],
      [false, false, true],
    );
    harness.releaseGenerate();
    await expect(generateButton).toBeEnabled();

    expect(harness.unexpectedMutations).toEqual([]);
    await expectDocumentOverflowZero(page);
  });
});

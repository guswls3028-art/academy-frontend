import path from "node:path";
import { expect, test, type Page, type Route } from "../fixtures/strictTest";
import { getBaseUrl } from "../helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "../helpers/localAuthApiStubs";

const pdf = path.resolve("e2e/fixtures/test-invert-3p.pdf");

function jwt() {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
}

async function setup(page: Page) {
  const captured: Array<{ names: string[]; mode: string; order: number[]; dimensions: Array<[number, number]> }> = [];
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  await page.addInitScript((token) => {
    localStorage.setItem("access", token);
    localStorage.setItem("refresh", `${token}-refresh`);
  }, jwt());
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/tools/ppt/generate/" && request.method() === "POST") {
      const buffer = request.postDataBuffer() ?? Buffer.alloc(0);
      const body = buffer.toString("latin1");
      const order = body.match(/name="order"\r\n\r\n([^\r]+)/)?.[1] ?? "[]";
      const dimensions: Array<[number, number]> = [];
      const signature = Buffer.from("89504e470d0a1a0a", "hex");
      for (let offset = buffer.indexOf(signature); offset >= 0; offset = buffer.indexOf(signature, offset + signature.length)) {
        dimensions.push([buffer.readUInt32BE(offset + 16), buffer.readUInt32BE(offset + 20)]);
      }
      captured.push({
        names: Array.from(body.matchAll(/name="images"; filename="([^"]+)"/g), (match) => match[1]),
        mode: body.includes('name="pdf"') ? "pdf" : "images",
        order: JSON.parse(order) as number[],
        dimensions,
      });
      await route.fulfill({ json: { job_id: "manual-ppt-job", status: "PENDING" } });
      return;
    }
    if (url.pathname === "/api/v1/jobs/manual-ppt-job/progress/") {
      await route.fulfill({ json: {
        job_id: "manual-ppt-job", job_type: "ppt_generation", status: "DONE",
        result: { download_url: "data:application/octet-stream;base64,UEs=", filename: "manual.pptx", slide_count: 2, size_bytes: 2 },
      } });
      return;
    }
    await route.fallback();
  });
  await page.goto(`${getBaseUrl("admin")}/workspace/tools/ppt`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(pdf);
  await page.getByRole("button", { name: "직접 자르기" }).click();
  await expect(page.getByText("1 / 3쪽")).toBeVisible();
  return captured;
}

for (const width of [1366, 390]) {
  test(`PDF 수동 영역을 순서대로 PPT로 제출한다 (${width}px)`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 850 });
    const captured = await setup(page);
    const layer = page.getByTestId("ppt-pdf-selection-layer");
    const box = await layer.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.1, box!.y + box!.height * 0.1);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.6);
    await page.mouse.up();
    await expect(page.getByTestId("ppt-crop-region")).toHaveCount(1);
    expect(Number(await page.getByTestId("ppt-crop-region").first().getByLabel("너비 (%)").inputValue())).toBeLessThan(100);
    await page.getByRole("button", { name: "다음 쪽" }).click();
    await expect(page.getByText("2 / 3쪽")).toBeVisible();
    await page.getByRole("button", { name: "현재 쪽 전체 추가" }).click();
    await page.getByRole("button", { name: "2번 슬라이드 앞으로" }).click();
    await expect(page.getByText("1. 2쪽")).toBeVisible();
    await page.getByRole("button", { name: "PPT 생성 및 다운로드" }).click();
    await expect.poll(() => captured).toHaveLength(1);
    expect(captured[0]).toEqual(expect.objectContaining({
      names: ["slide-001-page-2.png", "slide-002-page-1.png"],
      mode: "images",
      order: [0, 1],
    }));
    expect(captured[0].dimensions).toHaveLength(2);
    expect(captured[0].dimensions[1][0]).toBeLessThan(captured[0].dimensions[0][0]);
    expect(captured[0].dimensions[1][1]).toBeLessThan(captured[0].dimensions[0][1]);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}

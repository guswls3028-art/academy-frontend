import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { getBaseUrl, loginViaUI } from "./helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "./helpers/localAuthApiStubs";

const TS = Date.now();

function isLocalBaseUrl(url: string) {
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(url);
}

function createLocalJwt() {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: now + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
}

async function openClinicTool(page: Page) {
  const baseUrl = getBaseUrl("admin");
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  if (isLocalBaseUrl(baseUrl)) {
    const token = createLocalJwt();
    await page.addInitScript((jwt) => {
      localStorage.setItem("access", jwt);
      localStorage.setItem("refresh", `${jwt}-refresh`);
      localStorage.setItem("tenant_code", "hakwonplus");
      sessionStorage.setItem("tenantCode", "hakwonplus");
    }, token);
  } else {
    await loginViaUI(page, "admin");
  }
  await page.goto(`${baseUrl}/admin/tools/clinic`, { waitUntil: "load" });
  await expect(page).toHaveURL(/\/admin\/tools\/clinic/);
  await expect(page.locator("#clinic-paste-ta")).toBeVisible();
}

test.describe("클리닉 대상자 생성기 PDF 다운로드", () => {
  test("도구탭과 성적탭은 공통 출력 renderer를 공유한다", async () => {
    const [toolSource, rendererSource] = await Promise.all([
      readFile(path.resolve("src/app_admin/domains/tools/clinic/pages/ClinicPrintoutPage.tsx"), "utf8"),
      readFile(path.resolve("src/app_admin/domains/scores/utils/clinicPdfGenerator.ts"), "utf8"),
    ]);

    expect(rendererSource).toContain("export function buildClinicPrintHtml");
    expect(toolSource).toContain("buildClinicPrintHtml");
    expect(toolSource).not.toContain('<div class="header"');
    expect(toolSource).not.toContain('<div class="columns"');
    expect(toolSource).not.toContain('<div class="schedule-box"');
    expect(toolSource).not.toContain('class="name-row single');
  });

  test("게시용 흑백 인쇄에서 짧은 이름을 크게 보여준다", async ({ page }) => {
    await openClinicTool(page);

    const makeNames = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`);
    const bothNames = makeNames("양민준", 48);
    const examNames = makeNames("김서연", 44);
    const hwNames = makeNames("박도윤", 40);
    const allNames = [...bothNames, ...examNames, ...hwNames];
    await page.locator("#clinic-paste-ta").fill([
      `시험+과제: ${bothNames.join(", ")}`,
      `시험: ${examNames.join(", ")}`,
      `과제: ${hwNames.join(", ")}`,
    ].join("\n"));
    await page.getByRole("button", { name: "생성", exact: true }).click();

    const frame = page.frameLocator("#cprev");
    await expect(frame.locator(".name-text").filter({ hasText: bothNames[0] }).first()).toBeVisible({ timeout: 8000 });
    const visibility = await frame.locator(".page").evaluate((node, expectedNames) => {
      const pageEl = node as HTMLElement;
      const parseRgb = (value: string) => {
        const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      };
      const isGray = (value: string) => {
        const rgb = parseRgb(value);
        return !!rgb && Math.abs(rgb[0] - rgb[1]) <= 2 && Math.abs(rgb[1] - rgb[2]) <= 2;
      };
      const clipped = Array.from(pageEl.querySelectorAll(".name-text"))
        .filter((textNode) => expectedNames.includes((textNode.textContent || "").trim()))
        .filter((textNode) => {
          const el = textNode as HTMLElement;
          const cs = getComputedStyle(el);
          return (
            el.scrollWidth > el.clientWidth + 1 ||
            el.scrollHeight > el.clientHeight + 1 ||
            cs.overflow === "hidden" ||
            cs.textOverflow === "ellipsis" ||
            cs.whiteSpace === "nowrap"
          );
        });
      const firstCell = pageEl.querySelector(".name-cell") as HTMLElement | null;
      const sampleColors = [
        ".section-header.both",
        ".section-header.exam",
        ".section-header.hw",
        ".name-row:nth-child(even)",
        ".checkbox",
      ].flatMap((selector) => {
        const el = pageEl.querySelector(selector) as HTMLElement | null;
        if (!el) return [];
        const cs = getComputedStyle(el);
        return [cs.color, cs.backgroundColor, cs.borderTopColor];
      });
      return {
        pageClass: pageEl.className,
        nameCount: pageEl.querySelectorAll(".name-text").length,
        pairedNameCount: pageEl.querySelectorAll(".name-cell .name-text").length,
        nameCellFontSize: firstCell ? parseFloat(getComputedStyle(firstCell).fontSize) : 0,
        allSampleColorsGray: sampleColors.every(isGray),
        clippedCount: clipped.length,
      };
    }, allNames);

    expect(visibility.pageClass).toContain("page--dense");
    expect(visibility.nameCount).toBe(132);
    expect(visibility.pairedNameCount).toBe(132);
    expect(visibility.nameCellFontSize).toBeGreaterThanOrEqual(14);
    expect(visibility.allSampleColorsGray).toBe(true);
    expect(visibility.clippedCount).toBe(0);
  });

  test("긴 이름을 자르지 않고 실제 PDF를 내려받는다", async ({ page }) => {
    await openClinicTool(page);

    const longNames = Array.from({ length: 18 }, (_, i) =>
      `[E2E-${TS}]김가나다라마바사아자${String(i + 1).padStart(2, "0")}`,
    );
    await page.locator("#clinic-paste-ta").fill(`시험: ${longNames.join(", ")}`);
    await page.getByRole("button", { name: "생성", exact: true }).click();

    const frame = page.frameLocator("#cprev");
    await expect(frame.locator(".name-text").filter({ hasText: longNames[0] }).first()).toBeVisible({ timeout: 8000 });
    await expect(frame.locator(".columns")).toContainText(longNames[0]);
    await expect(frame.locator(".footer-left")).toContainText(`전체 출석 ${longNames.length}명`);
    const pageSize = await frame.locator(".page").evaluate((node) => {
      const rect = (node as HTMLElement).getBoundingClientRect();
      return { width: rect.width, height: rect.height, ratio: rect.width / rect.height };
    });
    expect(pageSize.width).toBeGreaterThan(1100);
    expect(pageSize.height).toBeGreaterThan(1550);
    expect(pageSize.ratio).toBeCloseTo(297 / 420, 2);

    const clipping = await frame.locator(".name-text").evaluateAll((nodes, expectedNames) => {
      return nodes
        .filter((node) => expectedNames.includes((node.textContent || "").trim()))
        .map((node) => {
          const el = node as HTMLElement;
          const cs = getComputedStyle(el);
          return {
            text: el.textContent?.trim() || "",
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
            overflow: cs.overflow,
            textOverflow: cs.textOverflow,
            whiteSpace: cs.whiteSpace,
          };
        })
        .filter((item) =>
          item.scrollWidth > item.clientWidth + 1 ||
          item.scrollHeight > item.clientHeight + 1 ||
          item.overflow === "hidden" ||
          item.textOverflow === "ellipsis" ||
          item.whiteSpace === "nowrap"
        );
    }, longNames);
    expect(clipping).toEqual([]);

    await mkdir("e2e-out", { recursive: true });
    await frame.locator(".page").screenshot({ path: `e2e-out/clinic-pdf-long-names-${TS}.png` });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      page.getByRole("button", { name: "PDF 다운로드" }).click(),
    ]);
    const pdfPath = path.resolve("e2e-out", `clinic-pdf-long-names-${TS}.pdf`);
    await download.saveAs(pdfPath);

    const pdf = await readFile(pdfPath);
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
  });
});

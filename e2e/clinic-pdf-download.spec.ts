import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { getBaseUrl, loginViaUI } from "./helpers/auth";
import { installLocalAuthApiStubs, installTenantOneInitScript } from "./helpers/localAuthApiStubs";

const TS = Date.now();

test.describe("클리닉 대상자 생성기 PDF 다운로드", () => {
  test("긴 이름을 자르지 않고 실제 PDF를 내려받는다", async ({ page }) => {
    await installLocalAuthApiStubs(page);
    await installTenantOneInitScript(page);
    await loginViaUI(page, "admin");
    await page.goto(`${getBaseUrl("admin")}/admin/dashboard`, { waitUntil: "load" });
    await page.getByRole("link", { name: "도구" }).first().click();
    await page.getByRole("button", { name: "클리닉 대상자" }).first().click();
    await expect(page).toHaveURL(/\/admin\/tools\/clinic/);

    const longNames = Array.from({ length: 18 }, (_, i) =>
      `[E2E-${TS}]김가나다라마바사아자${String(i + 1).padStart(2, "0")}`,
    );
    await page.locator("#clinic-paste-ta").fill(`시험: ${longNames.join(", ")}`);
    await page.getByRole("button", { name: "생성", exact: true }).click();

    const frame = page.frameLocator("#cprev");
    await expect(frame.locator(".name-cell").first()).toBeVisible({ timeout: 8000 });
    await expect(frame.locator(".columns")).toContainText(longNames[0]);

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

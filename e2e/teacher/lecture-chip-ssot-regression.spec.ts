import { test, expect } from "../fixtures/strictTest";
import type { Locator, Page } from "@playwright/test";
import { apiCall } from "../helpers/api";
import { getBaseUrl, loginViaUI } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = getBaseUrl("admin");

type LectureBody = {
  id: number;
  title: string;
  chip_label?: string | null;
};

test.describe("강의 딱지 SSOT 회귀", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  test("선생님 모바일 강의 생성은 chip_label을 저장하고 2글자 한글 칩을 깨지지 않게 표시한다", async ({ page }) => {
    await loginViaUI(page, "admin", { landingPath: "/teacher/classes" });

    const tag = `[E2E-${Date.now()}]`;
    const title = `${tag} 딱지 수업`;
    let lectureId: number | null = null;

    try {
      await page.getByRole("button", { name: /강의 추가/ }).click();
      await expect(page.getByText("강의 생성")).toBeVisible({ timeout: 10_000 });

      await page.getByPlaceholder("예: 수학 심화반").fill(title);
      await page.getByPlaceholder("담당 강사명").fill("E2E 강사");
      await page.getByPlaceholder("예: 수학, 영어").fill("수학");
      await page.getByPlaceholder("예: 월수금 18:00~20:00").fill("월 10:00~11:00");
      await page.getByLabel("강의 딱지 2글자").fill("수심");

      const createResponse = page.waitForResponse(
        (res) => res.url().includes("/lectures/lectures/") && res.request().method() === "POST",
        { timeout: 15_000 },
      );
      await page.getByRole("button", { name: "생성" }).click();

      const created = await createResponse;
      expect(created.status()).toBe(201);
      const createdBody = await created.json() as LectureBody;
      lectureId = createdBody.id;
      expect(createdBody.chip_label).toBe("수심");

      await gotoAndSettle(page, `${BASE}/teacher/classes`, { timeout: 20_000 });
      const row = page.getByRole("button", { name: new RegExp(escapeRegex(title)) }).first();
      await expect(row).toBeVisible({ timeout: 15_000 });

      const chip = row.locator("[data-lecture-chip]").first();
      await assertChipStable(chip, "수심");
      await assertVisibleLectureChipContract(page);

      await gotoAndSettle(page, `${BASE}/admin/lectures`, { timeout: 20_000 });
      const adminRow = page.getByRole("button", { name: new RegExp(escapeRegex(title)) }).first();
      await expect(adminRow).toBeVisible({ timeout: 15_000 });
      await assertChipStable(adminRow.locator("[data-lecture-chip]").first(), "수심");
      await assertVisibleLectureChipContract(page);
    } finally {
      if (lectureId) {
        await apiCall(page, "DELETE", `/lectures/lectures/${lectureId}/`);
      }
    }
  });
});

async function assertChipStable(chip: Locator, expectedText: string): Promise<void> {
  await expect(chip).toHaveText(expectedText);

  const metrics = await chip.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      fontSize: window.getComputedStyle(el).fontSize,
    };
  });

  expect(Math.abs(metrics.width - metrics.height), JSON.stringify(metrics)).toBeLessThanOrEqual(1);
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.scrollHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientHeight + 1);
}

async function assertVisibleLectureChipContract(page: Page): Promise<void> {
  const chipMetrics = await page.locator("[data-lecture-chip]:visible").evaluateAll((nodes) =>
    nodes.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        text: el.textContent?.trim() ?? "",
        width: rect.width,
        height: rect.height,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      };
    }),
  );

  expect(chipMetrics.length).toBeGreaterThan(0);
  for (const metrics of chipMetrics) {
    expect(metrics.text, JSON.stringify(metrics)).not.toContain("??");
    expect(Math.abs(metrics.width - metrics.height), JSON.stringify(metrics)).toBeLessThanOrEqual(1);
    expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.scrollHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientHeight + 1);
  }

  const labelTexts = await page.locator("[data-lecture-chip-label]:visible").allTextContents();
  for (const text of labelTexts) {
    expect(text.trim()).not.toContain("??");
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

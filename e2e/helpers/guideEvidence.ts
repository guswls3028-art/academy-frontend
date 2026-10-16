import { expect, type Locator, type TestInfo } from "@playwright/test";

/** Check rendered readability and capture visible guide content inside app scroll containers. */
export async function captureGuideEvidence(
  article: Locator, action: Locator, testInfo: TestInfo, name: string,
) {
  const contrast = await action.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const luminance = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const rgba = context.getImageData(0, 0, 1, 1).data;
      if (rgba[3] !== 255) throw new Error("Guide action must have opaque text and background");
      const channels = Array.from(rgba).slice(0, 3).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const style = getComputedStyle(element);
    const text = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
  });
  expect(contrast, `${name}: guide action text contrast`).toBeGreaterThanOrEqual(4.5);
  await expect(article.locator("ol")).toHaveCSS("list-style-type", "decimal");
  await expect(article.locator("ul").first()).toHaveCSS("list-style-type", "disc");

  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeInViewport();
  // Keep production account headers and fixed navigation outside the evidence.
  await testInfo.attach(`${name}-action`, {
    body: await action.screenshot(),
    contentType: "image/png",
  });

  for (const step of await article.locator("ol > li h4").all()) {
    await step.scrollIntoViewIfNeeded();
    await expect(step).toBeInViewport();
  }
  const completion = article.locator("section").filter({
    hasText: "여기까지 확인하면 완료",
  });
  await completion.scrollIntoViewIfNeeded();
  await expect(completion).toBeInViewport();
  await testInfo.attach(`${name}-completion`, { body: await completion.screenshot(), contentType: "image/png" });

  const recovery = article.locator("details").first();
  if (await recovery.getAttribute("open") === null) await recovery.locator("summary").click();
  await recovery.scrollIntoViewIfNeeded();
  await expect(recovery.locator("p")).toBeInViewport();
  await testInfo.attach(`${name}-recovery`, { body: await recovery.screenshot(), contentType: "image/png" });
}

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Locator, Page, TestInfo } from "@playwright/test";

/** Authoring only: closed-proxy synthetic UI. Never enable against a live API. */
export async function guideRecording(page: Page, info: TestInfo, options: {
  id: string; title: string; topics: string[];
}) {
  if (process.env.GUIDE_MEDIA_CAPTURE !== "1" ||
      !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(process.env.E2E_BASE_URL ?? "")) {
    throw new Error("Guide recordings require the explicit local synthetic capture configuration.");
  }
  const started = Date.now();
  const origin = new URL(process.env.E2E_BASE_URL!).origin;
  // Existing scenario route stubs take precedence; unmatched requests cannot reach a real service.
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
    return route.abort("blockedbyclient");
  });
  const directory = resolve(process.env.GUIDE_MEDIA_OUTPUT ?? "guide-media-output", options.id);
  await mkdir(directory, { recursive: true });
  const screens: { file: string; title: string; description: string; alt: string; at: number }[] = [];
  await page.addInitScript(() => {
    document.addEventListener("pointerdown", (event) => {
      const marker = document.createElement("span");
      Object.assign(marker.style, {
        position: "fixed", left: `${event.clientX - 16}px`, top: `${event.clientY - 16}px`,
        width: "32px", height: "32px", border: "3px solid #f97316", borderRadius: "50%",
        zIndex: "2147483647", pointerEvents: "none", boxShadow: "0 0 0 5px #ffedd580",
      });
      document.documentElement.append(marker);
      setTimeout(() => marker.remove(), 700);
    }, true);
  });
  return {
    async screen(title: string, description: string, target: Locator) {
      await target.waitFor({ state: "visible" });
      await target.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      const bounds = await target.boundingBox();
      if (!bounds) throw new Error(`Missing visible recording target: ${title}`);
      await page.evaluate((box) => {
        document.getElementById("guide-recording-focus")?.remove();
        const marker = document.createElement("div");
        marker.id = "guide-recording-focus";
        Object.assign(marker.style, {
          position: "fixed", left: `${box.x - 3}px`, top: `${box.y - 3}px`,
          width: `${box.width + 6}px`, height: `${box.height + 6}px`, border: "3px solid #2563eb",
          borderRadius: "6px", zIndex: "2147483646", pointerEvents: "none", boxSizing: "border-box",
        });
        document.documentElement.append(marker);
      }, bounds);
      const file = `${String(screens.length + 1).padStart(2, "0")}.jpg`;
      screens.push({ file, title, description, alt: `${options.title}: ${title}. ${description}`, at: (Date.now() - started) / 1000 });
      await page.screenshot({ path: resolve(directory, file), type: "jpeg", quality: 88, animations: "disabled" });
      // eslint-disable-next-line no-restricted-syntax -- Intentional readable dwell in an authored tutorial, not a test synchronization delay.
      await page.waitForTimeout(2400);
      await page.evaluate(() => document.getElementById("guide-recording-focus")?.remove());
    },
    async finish() {
      if (screens.length < 2) throw new Error("A tutorial must show an action and its result.");
      const video = await page.video()?.path();
      if (!video) throw new Error("Guide capture must record a video.");
      await writeFile(resolve(directory, "recording.json"), JSON.stringify({
        ...options, sourceRevision: process.env.GITHUB_SHA ?? "local", test: info.title,
        viewport: page.viewportSize(), synthetic: true, video, screens, finishedAt: (Date.now() - started) / 1000,
      }, null, 2));
    },
  };
}

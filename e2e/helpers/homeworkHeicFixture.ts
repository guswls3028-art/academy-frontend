import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

// Synthetic 640x360 RGB image encoded with libheif; no user media or metadata.
export const homeworkHeic = readFileSync(new URL("../fixtures/files/homework.heic", import.meta.url));

// Apply the production decoder boundaries after the app shell has mounted.
// This isolates HEIC's dynamic import/worker from Vite's entry feature probes.
export async function applyHomeworkPreviewCsp(page: Page) {
  await page.evaluate(() => {
    const meta = document.createElement("meta");
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = "script-src 'self' https://js.tosspayments.com https://www.youtube.com; worker-src 'self' blob:; connect-src 'self' https: wss:";
    document.head.append(meta);
  });
}

export async function installHomeworkHeicPreview(page: Page) {
  const url = "https://homework-preview.example.invalid/phone.heic";
  const headers: Record<string, string>[] = [];
  let broken = false;
  await page.route(url, async (route) => {
    headers.push(route.request().headers());
    await route.fulfill({ body: broken ? Buffer.from("invalid HEIC") : homeworkHeic, contentType: "image/heic", headers: { "Access-Control-Allow-Origin": "*" } });
  });
  return { url, headers, setBroken: (value: boolean) => { broken = value; } };
}

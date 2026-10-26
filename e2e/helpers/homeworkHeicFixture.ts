import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

// Synthetic 640x360 RGB image encoded with libheif; no user media or metadata.
export const homeworkHeic = readFileSync(new URL("../fixtures/files/homework.heic", import.meta.url));
export const homeworkHeicDataUrl = `data:image/heic;base64,${homeworkHeic.toString("base64")}`;

export async function installHomeworkHeicPreview(page: Page) {
  const url = "https://homework-preview.example.invalid/phone.heic";
  const headers: Record<string, string>[] = [];
  await page.route(url, async (route) => {
    headers.push(route.request().headers());
    await route.fulfill({ body: homeworkHeic, contentType: "image/heic", headers: { "Access-Control-Allow-Origin": "*" } });
  });
  return { url, headers };
}

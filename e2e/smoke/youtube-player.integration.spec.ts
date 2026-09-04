import { test, expect } from "../fixtures/strictTest";
import {
  assertYoutubeReadyPlayPause, installStudentYoutubeScenario, openStudentYoutubeScenario,
} from "../helpers/studentYoutubeScenario";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

test.use({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });

test("실제 YouTube SDK ready 후 사용자 재생·시간 증가·일시정지를 확인한다", async ({ page }, testInfo) => {
  const apiRequests = await installStudentYoutubeScenario(page);
  const vendorResponses: Array<{ url: string; status: number }> = [];
  const browserErrors: Array<{ text: string; url: string; line: number }> = [];
  page.on("response", (response) => {
    if (/youtube\.com\/(?:iframe_api|s\/player\/|embed\/)/.test(response.url())) {
      vendorResponses.push({ url: response.url().split("?")[0], status: response.status() });
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push({
      text: message.text(), url: message.location().url, line: message.location().lineNumber + 1,
    });
  });
  try {
    await openStudentYoutubeScenario(page, BASE);
    const playback = await assertYoutubeReadyPlayPause(page);
    expect(vendorResponses.some(({ url, status }) => url.endsWith("/iframe_api") && status === 200)).toBe(true);
    expect(vendorResponses.some(({ url, status }) => url.includes("/embed/") && status === 200)).toBe(true);
    await testInfo.attach("real-youtube-playback", { body: JSON.stringify(playback), contentType: "application/json" });
  } finally {
    await testInfo.attach("real-youtube-boundary", {
      body: JSON.stringify({ vendorResponses, browserErrors, syntheticApiRequests: apiRequests }, null, 2),
      contentType: "application/json",
    });
  }
});

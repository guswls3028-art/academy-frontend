import type { Page } from "@playwright/test";
import { getBaseUrl } from "./auth";

const LOCAL_BASE_URL_RE = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/;

export async function installLocalFeesFeatureFlagOverride(page: Page): Promise<boolean> {
  if (!LOCAL_BASE_URL_RE.test(getBaseUrl("admin"))) return false;

  await page.route("**/api/v1/core/program/", async (route) => {
    const response = await route.fetch();
    const headers = response.headers();
    const contentType = headers["content-type"] ?? "";
    if (!response.ok() || !contentType.includes("application/json")) {
      await route.fulfill({ response });
      return;
    }

    const data = await response.json() as {
      feature_flags?: Record<string, unknown>;
    } & Record<string, unknown>;

    await route.fulfill({
      status: response.status(),
      headers: {
        ...headers,
        "cache-control": "no-store",
        "content-type": "application/json",
      },
      json: {
        ...data,
        feature_flags: {
          ...(data.feature_flags ?? {}),
          fee_management: true,
        },
      },
    });
  });

  return true;
}

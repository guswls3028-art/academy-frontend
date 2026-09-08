import type { BrowserContext } from "@playwright/test";

export type SyntheticVideoPosterState = {
  responseChain: Promise<void>;
  allowedMasterUrls: Set<string>;
  allowedPosterUrls: Set<string>;
  posterLoads: number;
};

const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function isExactSignedPosterUrl(
  rawUrl: string,
  state: SyntheticVideoPosterState,
  videoId: number,
): boolean {
  try {
    const target = new URL(rawUrl);
    const expectedPath = new RegExp(`^/tenants/[1-9][0-9]*/video/hls/${videoId}/thumbnail\\.jpg$`);
    const keys = [...target.searchParams.keys()].sort();
    const expiresAt = Number(target.searchParams.get("exp"));
    const version = Number(target.searchParams.get("v"));
    return target.protocol === "https:"
      && !target.username && !target.password && !target.hash
      && expectedPath.test(target.pathname)
      && keys.join(",") === "exp,kid,sig,v"
      && /^[A-Za-z0-9._-]{1,32}$/.test(target.searchParams.get("kid") || "")
      && /^[A-Za-z0-9_-]{43}$/.test(target.searchParams.get("sig") || "")
      && Number.isInteger(expiresAt) && expiresAt - Math.floor(Date.now() / 1_000) > 690
      && Number.isInteger(version) && version > 0
      && [...state.allowedMasterUrls].some((master) => new URL(master).origin === target.origin);
  } catch {
    return false;
  }
}

export async function installSyntheticVideoPosterBridge(
  context: BrowserContext,
  state: SyntheticVideoPosterState,
  videoId: number,
): Promise<void> {
  await context.route(`**/tenants/*/video/hls/${videoId}/thumbnail.jpg*`, async (route) => {
    const request = route.request();
    await state.responseChain;
    if (request.method() !== "GET"
      || !state.allowedPosterUrls.has(request.url())
      || !isExactSignedPosterUrl(request.url(), state, videoId)) {
      await route.fallback();
      return;
    }
    state.posterLoads += 1;
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "cache-control": "no-store" },
      body: TRANSPARENT_PNG,
    });
  });
}

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
  tenantId: number,
  videoId: number,
): boolean {
  try {
    const target = new URL(rawUrl);
    const keys = [...target.searchParams.keys()].sort();
    const now = Math.floor(Date.now() / 1_000);
    const rawExpiry = target.searchParams.get("exp") || "";
    const rawVersion = target.searchParams.get("v") || "";
    const expiresAt = Number(rawExpiry);
    const version = Number(rawVersion);
    return target.protocol === "https:"
      && !target.username && !target.password && !target.hash
      && target.pathname === `/tenants/${tenantId}/video/hls/${videoId}/thumbnail.jpg`
      && keys.join(",") === "exp,kid,sig,v"
      && /^[A-Za-z0-9._-]{1,32}$/.test(target.searchParams.get("kid") || "")
      && /^[A-Za-z0-9_-]{43}$/.test(target.searchParams.get("sig") || "")
      && /^[1-9][0-9]*$/.test(rawExpiry) && Number.isSafeInteger(expiresAt)
      && expiresAt - now > 690 && expiresAt - now <= 21_600
      && /^[1-9][0-9]*$/.test(rawVersion) && Number.isSafeInteger(version)
      && version >= now - 1_800 && version <= now + 60
      && [...state.allowedMasterUrls].some((master) => new URL(master).origin === target.origin);
  } catch {
    return false;
  }
}

export async function installSyntheticVideoPosterBridge(
  context: BrowserContext,
  state: SyntheticVideoPosterState,
  tenantId: number,
  videoId: number,
): Promise<void> {
  await context.route(`**/tenants/${tenantId}/video/hls/${videoId}/thumbnail.jpg*`, async (route) => {
    const request = route.request();
    await state.responseChain;
    if (request.method() !== "GET"
      || !state.allowedPosterUrls.has(request.url())
      || !isExactSignedPosterUrl(request.url(), state, tenantId, videoId)) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "cache-control": "no-store" },
      body: TRANSPARENT_PNG,
    });
    state.posterLoads += 1;
  });
}

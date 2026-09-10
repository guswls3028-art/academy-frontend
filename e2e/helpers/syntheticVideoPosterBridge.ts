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
const MAX_SIGNED_POSTER_TTL_SECONDS = 6 * 60 * 60;
const MAX_CROSS_HOST_CLOCK_SKEW_SECONDS = 60;

function isExactSignedPosterShape(
  rawUrl: string,
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
      && expiresAt - now > 690
      && expiresAt - now <= MAX_SIGNED_POSTER_TTL_SECONDS + MAX_CROSS_HOST_CLOCK_SKEW_SECONDS
      // `v` is the source-object content version, not a URL issuance time. It
      // can legitimately predate this QA run; freshness is enforced by `exp`.
      && /^[1-9][0-9]*$/.test(rawVersion) && Number.isSafeInteger(version);
  } catch {
    return false;
  }
}

async function waitForExactResponseDerivedPoster(
  rawUrl: string,
  state: SyntheticVideoPosterState,
  tenantId: number,
  videoId: number,
): Promise<boolean> {
  if (!isExactSignedPosterShape(rawUrl, tenantId, videoId)) return false;
  const target = new URL(rawUrl);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    // Playwright may expose the dependent image request just before the
    // response callback appends its URL. Re-read the current chain each time.
    await state.responseChain;
    if (state.allowedPosterUrls.has(rawUrl)
      && [...state.allowedMasterUrls].some((master) => new URL(master).origin === target.origin)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

export async function installSyntheticVideoPosterBridge(
  context: BrowserContext,
  state: SyntheticVideoPosterState,
  tenantId: number,
  videoId: number,
): Promise<void> {
  await context.route(`**/tenants/${tenantId}/video/hls/${videoId}/thumbnail.jpg*`, async (route) => {
    const request = route.request();
    if (request.method() !== "GET"
      || !await waitForExactResponseDerivedPoster(request.url(), state, tenantId, videoId)) {
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

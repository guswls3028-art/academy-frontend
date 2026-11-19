const promoUrl = "https://hakwonplus.com/promo";
const images = new Set([
  promoUrl + "/admin-attendance-realuse-20260828.png",
  promoUrl + "/student-operations-realuse-20260828.png",
]);

export function observePromoImages(page, target) {
  if (target !== promoUrl) return { recordFailure() {}, verify() {} };
  const aborted = new Map();
  const successful = new Set();
  const finished = new Set();
  const isImage = request => request.method() === "GET" && request.resourceType() === "image"
    && images.has(request.url());
  const httpErrors = [];
  page.on("response", response => {
    const request = response.request();
    if (!isImage(request)) return;
    if (response.status() === 200) successful.add(request);
    if (response.status() >= 400 && response.status() < 500) {
      httpErrors.push({ type: "http", url: request.url(), status: response.status() });
    }
  });
  page.on("requestfinished", request => {
    if (isImage(request)) finished.add(request);
  });
  return {
    recordFailure(request, issue) {
      if (isImage(request) && issue.failure === "net::ERR_ABORTED") {
        aborted.set(issue, new Set([...finished, request]));
      }
    },
    async verify(finalUrl, issues) {
      issues.push(...httpErrors);
      if (finalUrl !== promoUrl) return;
      for (const url of images) {
        const loaded = [...finished].filter(request => request.url() === url && successful.has(request));
        const decoded = loaded.length > 0 && await page.evaluate(async src => {
          const image = [...document.images].find(img => img.currentSrc === src);
          if (!image) return false;
          try {
            await image.decode();
            return image.isConnected && image.currentSrc === src && image.complete
              && image.naturalWidth > 0 && image.naturalHeight > 0;
          } catch { return false; }
        }, url).catch(() => false);
        if (!decoded) {
          issues.push({ type: "image-not-loaded", url });
          continue;
        }
        for (const [issue, previous] of aborted) {
          if (issue.url === url && loaded.some(request => !previous.has(request))) {
            const index = issues.indexOf(issue);
            if (index >= 0) issues.splice(index, 1);
          }
        }
      }
    },
  };
}

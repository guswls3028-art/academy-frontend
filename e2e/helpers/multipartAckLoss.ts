import type { Page } from "@playwright/test";

type AckLossWindow = Window & { restoreMultipartAckLoss?: () => number };

/** Apply a one-shot browser-only ACK loss after the guarded native PUT succeeds. */
export async function installMultipartAckLoss(page: Page, sessionId: number): Promise<() => Promise<number>> {
  await page.evaluate((session) => {
    const scope = window as AckLossWindow;
    const NativeXHR = XMLHttpRequest;
    let suppressed = 0;
    const scopedPart = (url: URL) =>
      url.protocol === "https:"
      && url.pathname.startsWith("/academy-development-artifacts/tenants/")
      && url.pathname.includes(`/video/raw/${session}/`)
      && url.searchParams.get("partNumber") === "1"
      && url.searchParams.has("uploadId");
    class AckLossXHR extends NativeXHR {
      constructor() {
        super();
        let expectedUrl: string | null = null;
        this.open = new Proxy(this.open, {
          apply(target, xhr: XMLHttpRequest, args) {
            const url = args[0] === "PUT" && URL.canParse(String(args[1]), location.href)
              ? new URL(String(args[1]), location.href) : null;
            expectedUrl = url && scopedPart(url) ? url.href : null;
            return Reflect.apply(target, xhr, args);
          },
        });
        // Register before the uploader installs its ordinary load handler.
        this.addEventListener("load", (event) => {
          if (suppressed || !event.isTrusted || !expectedUrl || this.responseURL !== expectedUrl
            || this.status < 200 || this.status >= 300 || !this.getResponseHeader("etag")) return;
          suppressed++;
          event.stopImmediatePropagation();
          this.dispatchEvent(new ProgressEvent("error"));
        });
      }
    }
    window.XMLHttpRequest = AckLossXHR;
    scope.restoreMultipartAckLoss = () => {
      if (window.XMLHttpRequest === AckLossXHR) window.XMLHttpRequest = NativeXHR;
      delete scope.restoreMultipartAckLoss;
      return suppressed;
    };
  }, sessionId);
  return () => page.evaluate(() => (window as AckLossWindow).restoreMultipartAckLoss?.() ?? 0);
}

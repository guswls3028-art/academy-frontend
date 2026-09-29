// Loaded before any application module, only by the production legacy loader.
// These implement browser APIs; plugin-legacy supplies ECMAScript polyfills.
import "whatwg-fetch";
import "abortcontroller-polyfill/dist/polyfill-patch-fetch";
import "intersection-observer";
import "fast-text-encoding";
import ResizeObserverPolyfill from "resize-observer-polyfill";

if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = ResizeObserverPolyfill;
}

// SystemJS entry/lazy chunks load their own compiled styles. Remove the modern
// entry's stylesheet so unsupported declarations cannot override those rules.
// Keep this bootstrap independent of DOM collection/URL polyfills.
const stylesheets = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
for (let index = 0; index < stylesheets.length; index += 1) {
  const link = stylesheets[index];
  const href = link.getAttribute("href") || "";
  if (/^\/assets\/[^?#]+\.css(?:[?#]|$)/.test(href)) {
    link.parentNode?.removeChild(link);
  }
}

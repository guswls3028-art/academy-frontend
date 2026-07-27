import { useEffect } from "react";

const MANIFEST_HREF = "/dev-manifest.json";
const ICON_HREF = "/tenants/hakwonplus/apple-touch-icon.png?v=20260727";
const MANAGED = "data-dev-pwa";
const PREVIOUS = "data-dev-pwa-previous";
const CREATED = "data-dev-pwa-created";

export function useDevPwa() {
  useEffect(() => {
    const elements = [
      upsertLink("manifest", MANIFEST_HREF),
      upsertLink("apple-touch-icon", ICON_HREF),
      upsertMeta("theme-color", "#0f172a"),
      upsertMeta("apple-mobile-web-app-capable", "yes"),
      upsertMeta("apple-mobile-web-app-status-bar-style", "default"),
      upsertMeta("apple-mobile-web-app-title", "학원플러스 콘솔"),
    ];

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }

    return () => elements.forEach(restore);
  }, []);
}

function upsertLink(rel: string, href: string): HTMLElement {
  let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    link.setAttribute(CREATED, "true");
    document.head.appendChild(link);
  } else {
    link.setAttribute(PREVIOUS, link.getAttribute("href") || "");
  }
  link.href = href;
  link.setAttribute(MANAGED, "true");
  return link;
}

function upsertMeta(name: string, content: string): HTMLElement {
  let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    meta.setAttribute(CREATED, "true");
    document.head.appendChild(meta);
  } else {
    meta.setAttribute(PREVIOUS, meta.getAttribute("content") || "");
  }
  meta.content = content;
  meta.setAttribute(MANAGED, "true");
  return meta;
}

function restore(element: HTMLElement) {
  if (element.getAttribute(CREATED) === "true") {
    element.remove();
    return;
  }
  const previous = element.getAttribute(PREVIOUS) || "";
  if (element instanceof HTMLLinkElement) {
    if (previous) element.setAttribute("href", previous);
    else element.removeAttribute("href");
  } else if (element instanceof HTMLMetaElement) {
    element.content = previous;
  }
  element.removeAttribute(MANAGED);
  element.removeAttribute(PREVIOUS);
  element.removeAttribute(CREATED);
}

import { useEffect } from "react";

import {
  getTenantPwaBrand,
  resolveTenantPwaBrand,
} from "@/shared/pwa/tenantPwaMeta";

const MANIFEST_HREF = "/student-manifest.json";
const MANAGED = "data-student-pwa";
const CREATED = "data-student-pwa-created";
const PREVIOUS = "data-student-pwa-previous";

export function useStudentPwa() {
  useEffect(() => {
    const brand = getTenantPwaBrand();
    const manifest = upsertLink("manifest", MANIFEST_HREF);
    const appleIcon = upsertLink("apple-touch-icon", brand.iconHref);
    const capable = upsertMeta("apple-mobile-web-app-capable", "yes");
    const statusBar = upsertMeta("apple-mobile-web-app-status-bar-style", "default");
    const title = upsertMeta("apple-mobile-web-app-title", `${brand.title} 학생`);
    let active = true;
    void resolveTenantPwaBrand().then((resolved) => {
      if (!active) return;
      (appleIcon as HTMLLinkElement).href = resolved.iconHref;
      (title as HTMLMetaElement).content = `${resolved.title} 학생`;
    });

    return () => {
      active = false;
      [manifest, appleIcon, capable, statusBar, title].forEach(restoreManagedElement);
    };
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

function restoreManagedElement(element: HTMLElement) {
  if (element.getAttribute(CREATED) === "true") {
    element.remove();
    return;
  }
  const previous = element.getAttribute(PREVIOUS);
  if (element instanceof HTMLLinkElement) {
    if (previous) element.href = previous;
    else element.removeAttribute("href");
  } else if (element instanceof HTMLMetaElement) {
    element.content = previous || "";
  }
  element.removeAttribute(MANAGED);
  element.removeAttribute(CREATED);
  element.removeAttribute(PREVIOUS);
}

import { getTenantDefByHostname } from "@/shared/tenant/tenants";

export interface TenantPwaBrand {
  title: string;
  iconHref: string;
}

const TENANT_APP_ICON_BY_HOST: Record<string, string> = {
  "tchul.com": "/tenants/tchul/apple-touch-icon.png",
  "www.tchul.com": "/tenants/tchul/apple-touch-icon.png",
  "ymath.co.kr": "/tenants/ymath/apple-touch-icon.png",
  "www.ymath.co.kr": "/tenants/ymath/apple-touch-icon.png",
  "limglish.kr": "/tenants/limglish/apple-touch-icon.png",
  "www.limglish.kr": "/tenants/limglish/apple-touch-icon.png",
  "hakwonplus.com": "/tenants/hakwonplus/apple-touch-icon.png?v=20260727",
  "www.hakwonplus.com": "/tenants/hakwonplus/apple-touch-icon.png?v=20260727",
  "sswe.co.kr": "/tenants/sswe/apple-touch-icon.png",
  "www.sswe.co.kr": "/tenants/sswe/apple-touch-icon.png",
  "dnbacademy.co.kr": "/tenants/dnb/apple-touch-icon.png",
  "www.dnbacademy.co.kr": "/tenants/dnb/apple-touch-icon.png",
};

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || "").trim();

export function getTenantPwaBrand(
  hostname = window.location.hostname,
): TenantPwaBrand {
  const normalizedHost = hostname.toLowerCase();
  const tenant = getTenantDefByHostname(normalizedHost);
  return {
    title:
      tenant?.branding.windowTitle
      || tenant?.branding.loginTitle
      || tenant?.name
      || normalizedHost.split(".")[0]
      || "학원",
    iconHref:
      TENANT_APP_ICON_BY_HOST[normalizedHost]
      || tenant?.branding.headerLogoUrl
      || tenant?.branding.faviconUrl
      || tenant?.branding.logoUrl
      || "/teacher-icons/icon-192.svg",
  };
}

export async function resolveTenantPwaBrand(
  hostname = window.location.hostname,
): Promise<TenantPwaBrand> {
  const fallback = getTenantPwaBrand(hostname);
  if (TENANT_APP_ICON_BY_HOST[hostname.toLowerCase()]) return fallback;

  try {
    const response = await fetch(
      `${API_BASE}/api/v1/core/og-meta/?hostname=${encodeURIComponent(hostname)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) return fallback;
    const data = await response.json() as {
      title?: string;
      apple_touch_icon?: string;
      pwa_icon_192?: string;
      favicon?: string;
    };
    return {
      title: data.title?.trim() || fallback.title,
      iconHref:
        data.apple_touch_icon
        || data.pwa_icon_192
        || data.favicon
        || fallback.iconHref,
    };
  } catch {
    return fallback;
  }
}

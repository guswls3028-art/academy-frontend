export const PRIMARY_APP_ORIGIN = "https://hakwonplus.com";
export const PUBLIC_UPDATES_URL = `${PRIMARY_APP_ORIGIN}/promo/updates`;
export const DEV_CONSOLE_ORIGIN = "https://dev.hakwonplus.com";
export const DEV_CONSOLE_HOSTNAME = "dev.hakwonplus.com";

const PRIMARY_APP_HOSTNAMES = new Set(["hakwonplus.com", "www.hakwonplus.com"]);

function currentHostname(): string {
  return typeof window === "undefined" ? "" : window.location.hostname;
}

export function isDeveloperConsoleHost(hostname = currentHostname()): boolean {
  return hostname.trim().toLowerCase() === DEV_CONSOLE_HOSTNAME;
}

export function isPrimaryAppHost(hostname = currentHostname()): boolean {
  return PRIMARY_APP_HOSTNAMES.has(hostname.trim().toLowerCase());
}

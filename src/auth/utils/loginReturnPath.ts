export function getSafeInternalNextPath(rawPath: string | null, origin: string): string | null {
  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) return null;
  try {
    const target = new URL(rawPath, origin);
    if (target.origin !== origin) return null;
    if (target.pathname === "/login" || target.pathname.startsWith("/login/")) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

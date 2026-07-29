export const WORKSPACE_PATHS = {
  full: "/workspace",
  mobile: "/workspace/mobile",
  legacyFull: "/admin",
  legacyMobile: "/teacher",
} as const;

const LEGACY_WORKSPACE_PATHS = [
  [WORKSPACE_PATHS.legacyFull, WORKSPACE_PATHS.full],
  [WORKSPACE_PATHS.legacyMobile, WORKSPACE_PATHS.mobile],
] as const;

export function canonicalizeWorkspacePath(pathname: string): string | null {
  for (const [legacyBase, canonicalBase] of LEGACY_WORKSPACE_PATHS) {
    if (pathname === legacyBase) return canonicalBase;
    if (pathname.startsWith(`${legacyBase}/`)) {
      return `${canonicalBase}${pathname.slice(legacyBase.length)}`;
    }
  }
  return null;
}

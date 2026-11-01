import type { TenantRole } from "@/auth/context/AuthContext";
import { DEV_CONSOLE_ORIGIN } from "@/shared/constants/origins";
import { WORKSPACE_PATHS } from "./workspaceRoutes";

type RootDestinationInput = {
  tenantCode: string;
  role: TenantRole | null;
  isAuthenticated: boolean;
  isMobile?: boolean;
  isStandalone?: boolean;
  prefersFullWorkspace?: boolean;
};

const WORKSPACE_ROLES: TenantRole[] = ["owner", "admin", "teacher", "staff"];

type DeveloperConsoleDestinationInput = {
  isPrimaryApp: boolean;
  pathname: string;
  search?: string;
  hash?: string;
};

export function resolveDeveloperConsoleDestination({
  isPrimaryApp,
  pathname,
  search = "",
  hash = "",
}: DeveloperConsoleDestinationInput): string | null {
  if (!isPrimaryApp || (pathname !== "/dev" && !pathname.startsWith("/dev/"))) {
    return null;
  }

  return `${DEV_CONSOLE_ORIGIN}${pathname}${search}${hash}`;
}

export function resolveRootDestination({
  tenantCode,
  role,
  isAuthenticated,
}: RootDestinationInput): string {
  if (!isAuthenticated) {
    if (tenantCode === "hakwonplus" || tenantCode === "9999") return "/promo";
    if (tenantCode === "godmin") return "/landing";
    return "/login";
  }

  if (role && WORKSPACE_ROLES.includes(role)) {
    return WORKSPACE_PATHS.full;
  }

  if (role === "student" || role === "parent") {
    return "/student";
  }

  return "/login";
}

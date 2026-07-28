import type { TenantRole } from "@/auth/context/AuthContext";
import { DEV_CONSOLE_ORIGIN } from "@/shared/constants/origins";

type RootDestinationInput = {
  tenantCode: string;
  role: TenantRole | null;
  isAuthenticated: boolean;
  isMobile?: boolean;
  isStandalone?: boolean;
  prefersAdmin?: boolean;
};

const ADMIN_ROLES: TenantRole[] = ["owner", "admin", "teacher", "staff"];

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
  isMobile = false,
  isStandalone = false,
  prefersAdmin = false,
}: RootDestinationInput): string {
  if (!isAuthenticated) {
    return tenantCode === "hakwonplus" || tenantCode === "9999"
      ? "/promo"
      : "/login";
  }

  if (role && ADMIN_ROLES.includes(role)) {
    return isMobile && !isStandalone && !prefersAdmin ? "/teacher" : "/admin";
  }

  if (role === "student" || role === "parent") {
    return "/student";
  }

  return "/login";
}

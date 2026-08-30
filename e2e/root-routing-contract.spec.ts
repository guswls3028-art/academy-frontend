import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "./fixtures/strictTest";
import {
  resolveDeveloperConsoleDestination,
  resolveRootDestination,
} from "../src/core/router/rootDestination";
import {
  canonicalizeWorkspacePath,
  WORKSPACE_PATHS,
} from "../src/core/router/workspaceRoutes";

test("RootRedirect delegates automatic navigation without a developer-console bypass", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/core/router/AppRouter.tsx"),
    "utf8",
  );
  const rootRedirectStart = source.indexOf("function RootRedirect()");
  const appRouterStart = source.indexOf("export default function AppRouter()");
  const rootRedirectSource = source.slice(rootRedirectStart, appRouterStart);

  expect(rootRedirectStart).toBeGreaterThanOrEqual(0);
  expect(appRouterStart).toBeGreaterThan(rootRedirectStart);
  expect(rootRedirectSource).not.toContain("/dev");
  expect(rootRedirectSource).not.toContain("DEV_CONSOLE");
  expect(rootRedirectSource.match(/navigate\(/g)).toHaveLength(2);
  expect(rootRedirectSource.match(/resolveRootDestination\(/g)).toHaveLength(2);
});

test("primary app root keeps every automatic destination out of the developer console", () => {
  const destinations = [
    resolveRootDestination({
      tenantCode: "hakwonplus",
      role: null,
      isAuthenticated: false,
    }),
    resolveRootDestination({
      tenantCode: "tchul",
      role: null,
      isAuthenticated: false,
    }),
    resolveRootDestination({
      tenantCode: "godmin",
      role: null,
      isAuthenticated: false,
    }),
    ...(["owner", "admin", "teacher", "staff"] as const).map((role) =>
      resolveRootDestination({
        tenantCode: "hakwonplus",
        role,
        isAuthenticated: true,
      })),
    resolveRootDestination({
      tenantCode: "hakwonplus",
      role: "student",
      isAuthenticated: true,
    }),
    resolveRootDestination({
      tenantCode: "hakwonplus",
      role: "parent",
      isAuthenticated: true,
    }),
  ];

  expect(destinations).toEqual([
    "/promo",
    "/login",
    "/landing",
    "/workspace",
    "/workspace",
    "/workspace",
    "/workspace",
    "/student",
    "/student",
  ]);
  expect(destinations.every((destination) => !destination.startsWith("/dev"))).toBe(true);
});

test("mobile workspace routing preserves standalone and explicit full-workspace preferences", () => {
  const destination = (isStandalone: boolean, prefersFullWorkspace: boolean) =>
    resolveRootDestination({
      tenantCode: "hakwonplus",
      role: "owner",
      isAuthenticated: true,
      isMobile: true,
      isStandalone,
      prefersFullWorkspace,
    });

  expect(destination(false, false)).toBe("/workspace/mobile");
  expect(destination(true, false)).toBe("/workspace");
  expect(destination(false, true)).toBe("/workspace");
});

test("legacy workspace URLs canonicalize without losing their subpaths", () => {
  expect(canonicalizeWorkspacePath("/admin")).toBe(WORKSPACE_PATHS.full);
  expect(canonicalizeWorkspacePath("/admin/results/submissions")).toBe(
    "/workspace/results/submissions",
  );
  expect(canonicalizeWorkspacePath("/teacher")).toBe(WORKSPACE_PATHS.mobile);
  expect(canonicalizeWorkspacePath("/teacher/classes/12")).toBe(
    "/workspace/mobile/classes/12",
  );
  expect(canonicalizeWorkspacePath("/administrator")).toBeNull();
});

test("only explicit developer paths cross from the primary app to the developer origin", () => {
  const destination = (pathname: string, search = "", hash = "") =>
    resolveDeveloperConsoleDestination({
      isPrimaryApp: true,
      pathname,
      search,
      hash,
    });

  expect(destination("/dev")).toBe("https://dev.hakwonplus.com/dev");
  expect(destination("/dev/inbox", "?from=legacy", "#latest")).toBe(
    "https://dev.hakwonplus.com/dev/inbox?from=legacy#latest",
  );
  expect(destination("/")).toBeNull();
  expect(destination("/developer")).toBeNull();
  expect(resolveDeveloperConsoleDestination({
    isPrimaryApp: false,
    pathname: "/dev/inbox",
  })).toBeNull();
});

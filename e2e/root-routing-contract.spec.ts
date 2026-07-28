import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "./fixtures/strictTest";
import {
  resolveDeveloperConsoleDestination,
  resolveRootDestination,
} from "../src/core/router/rootDestination";

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
    "/admin",
    "/admin",
    "/admin",
    "/admin",
    "/student",
    "/student",
  ]);
  expect(destinations.every((destination) => !destination.startsWith("/dev"))).toBe(true);
});

test("mobile admin-role routing preserves standalone and explicit admin preferences", () => {
  const destination = (isStandalone: boolean, prefersAdmin: boolean) =>
    resolveRootDestination({
      tenantCode: "hakwonplus",
      role: "owner",
      isAuthenticated: true,
      isMobile: true,
      isStandalone,
      prefersAdmin,
    });

  expect(destination(false, false)).toBe("/teacher");
  expect(destination(true, false)).toBe("/admin");
  expect(destination(false, true)).toBe("/admin");
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

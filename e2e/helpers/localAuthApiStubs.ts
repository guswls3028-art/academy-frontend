import type { Page } from "@playwright/test";
import { getBaseUrl } from "./auth";

function createLocalJwt() {
  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp: now + 3600, tenant_code: "hakwonplus", user_id: 12 })}.sig`;
}

export async function installLocalAuthApiStubs(page: Page) {
  const baseUrl = getBaseUrl("admin");
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/.test(baseUrl)) return;

  const corsHeaders = {
    "access-control-allow-origin": baseUrl,
    "access-control-allow-headers": "authorization,content-type,x-client,x-client-version,x-tenant-code",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  };

  await page.route("**/api/v1/token/refresh/", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: "application/json",
      json: { access: createLocalJwt(), refresh: `${createLocalJwt()}-refresh` },
    });
  });

  await page.route("**/api/v1/core/program/", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: "application/json",
      json: {
        tenantCode: "hakwonplus",
        isPlatformAdmin: true,
        display_name: "학원플러스",
        ui_config: {
          login_title: "학원플러스",
          login_subtitle: "학원 관리 시스템",
        },
        feature_flags: {},
        is_active: true,
      },
    });
  });

  await page.route("**/api/v1/core/me/", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: "application/json",
      json: {
        id: 12,
        username: "t1_admin97",
        name: "관리자",
        phone: null,
        is_staff: true,
        is_superuser: true,
        tenantRole: "admin",
        linkedStudentId: null,
        linkedStudentName: null,
        linkedStudents: null,
        must_change_password: false,
      },
    });
  });

  await page.route("**/api/v1/results/admin/clinic-targets/", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: "application/json",
      json: [],
    });
  });
}

export async function installTenantOneInitScript(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("tenant_code", "hakwonplus");
    sessionStorage.setItem("tenantCode", "hakwonplus");
  });
}

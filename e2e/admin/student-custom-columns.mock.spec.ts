import { expect, test } from "../fixtures/strictTest";
import type { Page, Route } from "@playwright/test";
import {
  installLocalAuthApiStubs,
  installTenantOneInitScript,
} from "../helpers/localAuthApiStubs";

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5174";

function localJwt(): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3600,
    tenant_code: "hakwonplus",
  })}.sig`;
}

async function seedAuth(page: Page) {
  await installLocalAuthApiStubs(page);
  await installTenantOneInitScript(page);
  const token = localJwt();
  await page.addInitScript((jwt) => {
    localStorage.setItem("access", jwt);
    localStorage.setItem("refresh", `${jwt}-refresh`);
    // 구버전 저장값에도 서버에서 새로 생긴 맞춤 컬럼이 자동 노출되어야 한다.
    localStorage.setItem(
      "academy-table-prefs-students-home",
      JSON.stringify({
        visible: ["name", "parentPhone", "studentPhone", "school", "registeredAt"],
        widths: {},
      }),
    );
  }, token);
}

test("맞춤 컬럼을 추가·숨김·복원해도 학생 값과 개인 컬럼 설정이 유지된다", async ({ page }) => {
  await seedAuth(page);

  const definitions = [
    {
      id: 1,
      key: "cf_mbti",
      label: "MBTI",
      field_type: "select",
      aliases: [],
      options: ["INTJ", "ENFP"],
      position: 0,
      is_active: true,
      created_at: "2026-07-29T00:00:00Z",
      updated_at: "2026-07-29T00:00:00Z",
    },
  ];
  let nextId = 2;
  const definitionRequests: Array<Record<string, unknown>> = [];

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (path === "/students/" && request.method() === "GET") {
      return json({
        count: 1,
        page_size: 50,
        results: [
          {
            id: 77,
            name: "맞춤학생",
            ps_number: "CUSTOM77",
            omr_code: "12345678",
            phone: "01012345678",
            parent_phone: "01087654321",
            school_type: "HIGH",
            high_school: "검증고",
            high_school_class: "2",
            grade: 2,
            gender: "F",
            custom_fields: {
              cf_mbti: "INTJ",
              cf_hobby: "수영",
            },
            is_managed: true,
            created_at: "2026-07-29T00:00:00Z",
            tags: [],
            enrollments: [],
          },
        ],
      });
    }

    if (path === "/students/custom-fields/" && request.method() === "GET") {
      const active = url.searchParams.get("active");
      return json(
        active === "true"
          ? definitions.filter((definition) => definition.is_active)
          : definitions,
      );
    }

    if (path === "/students/custom-fields/" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      definitionRequests.push(body);
      const created = {
        id: nextId++,
        key: "cf_hobby",
        label: body.label,
        field_type: body.field_type,
        aliases: body.aliases ?? [],
        options: body.options ?? [],
        position: body.position ?? definitions.length,
        is_active: true,
        created_at: "2026-07-29T00:00:00Z",
        updated_at: "2026-07-29T00:00:00Z",
      };
      definitions.push(created as typeof definitions[number]);
      return json(created, 201);
    }

    const definitionMatch = path.match(/^\/students\/custom-fields\/(\d+)\/$/);
    if (definitionMatch && request.method() === "DELETE") {
      const definition = definitions.find((item) => item.id === Number(definitionMatch[1]));
      if (definition) definition.is_active = false;
      return route.fulfill({ status: 204 });
    }
    if (definitionMatch && request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const definition = definitions.find((item) => item.id === Number(definitionMatch[1]));
      if (!definition) return json({ detail: "not found" }, 404);
      if (typeof body.label === "string") definition.label = body.label;
      if (typeof body.is_active === "boolean") definition.is_active = body.is_active;
      return json(definition);
    }

    return route.fallback();
  });

  await page.goto(`${BASE}/admin/students/home`, { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("columnheader", { name: "MBTI" })).toBeVisible();
  await expect(page.getByText("INTJ", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "맞춤 컬럼 관리" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("표시명 (예: MBTI)").fill("취미");
  await dialog.getByRole("button", { name: "컬럼 추가" }).click();

  await expect(dialog.getByText("취미", { exact: true })).toBeVisible();
  expect(definitionRequests).toContainEqual(expect.objectContaining({
    label: "취미",
    field_type: "text",
  }));
  await dialog.getByRole("button", { name: "닫기" }).click();

  await expect(page.getByRole("columnheader", { name: "취미" })).toBeVisible();
  await expect(page.getByText("수영", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "맞춤 컬럼 관리" }).click();
  const hobbyRow = dialog.locator("div").filter({ hasText: /^취미텍스트/ }).first();
  await hobbyRow.getByRole("button", { name: "숨기기" }).click();
  await expect(hobbyRow.getByText("숨김", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("columnheader", { name: "취미" })).toHaveCount(0);

  await page.getByRole("button", { name: "맞춤 컬럼 관리" }).click();
  await hobbyRow.getByRole("button", { name: "다시 사용" }).click();
  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("columnheader", { name: "취미" })).toBeVisible();
  await expect(page.getByText("수영", { exact: true })).toBeVisible();
});

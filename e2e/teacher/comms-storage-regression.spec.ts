import { test, expect } from "../fixtures/strictTest";
import type { Page } from "@playwright/test";
import { apiCall } from "../helpers/api";
import { getApiBaseUrl, getBaseUrl } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/wait";

const BASE = process.env.E2E_LOCAL_BASE_URL || getBaseUrl("admin");
const API_BASE = getApiBaseUrl();
const TENANT_CODE = process.env.E2E_TENANT_CODE || "hakwonplus";
const ADMIN_USER = process.env.E2E_ADMIN_USER || "admin97";
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || "__MISSING_E2E_ADMIN_PASS__";

type PostBody = {
  id: number;
  title: string;
  attachments?: Array<{ id: number; original_name: string }>;
};

type AuthState = {
  access: string;
  tenantCode: string;
};

test.describe("선생님 소통 자료실 회귀", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
    await page.evaluate(() => {
      localStorage.removeItem("teacher:preferAdmin");
    });
  });

  test("자료 첨부파일을 상세에서 확인하고 다운로드 URL을 요청할 수 있다", async ({ page }) => {
    await page.addInitScript(() => {
      window.open = (url?: string | URL | undefined) => {
        (window as typeof window & { __lastOpenedDownloadUrl?: string }).__lastOpenedDownloadUrl = String(url ?? "");
        return null;
      };
    });

    const tag = `[E2E-${Date.now()}]`;
    const title = `${tag} 선생님 자료 첨부 회귀`;
    const fileName = `${tag}-teacher-material.txt`;
    let postId: number | null = null;

    try {
      const create = await apiCall<PostBody>(page, "POST", "/community/posts/", {
        post_type: "materials",
        title,
        content: "선생님 모바일 자료실 첨부파일 표시 회귀 테스트",
        node_ids: [],
        status: "published",
      });
      expect(create.status).toBe(201);
      postId = create.body.id;

      const auth = await page.evaluate(
        (): AuthState => ({
          access: localStorage.getItem("access") || "",
          tenantCode: sessionStorage.getItem("tenantCode") || "hakwonplus",
        }),
      );

      const upload = await page.request.post(`${API_BASE}/api/v1/community/posts/${postId}/attachments/`, {
        headers: {
          Authorization: `Bearer ${auth.access}`,
          "X-Tenant-Code": auth.tenantCode,
        },
        multipart: {
          files: {
            name: fileName,
            mimeType: "text/plain",
            buffer: Buffer.from("teacher material regression attachment"),
          },
        },
      });
      expect(upload.status()).toBe(201);

      await gotoAndSettle(page, `${BASE}/teacher/comms`, { timeout: 20_000 });
      await page.getByRole("button", { name: /자료/ }).first().click();
      await page.getByRole("button", { name: "검색 열기" }).click();
      await page.getByPlaceholder("제목, 내용, 작성자 검색").fill(title);

      await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
      await page.getByText(title).first().click();

      await expect(page.getByText("첨부파일 1개")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(fileName)).toBeVisible();
      await expect(page.getByText("자료 게시글은 댓글을 사용하지 않습니다")).toBeVisible();
      await expect(page.getByRole("button", { name: "댓글 작성" })).toHaveCount(0);

      const downloadResponse = page.waitForResponse(
        (res) => res.url().includes(`/community/posts/${postId}/attachments/`) && res.url().includes("/download/"),
        { timeout: 10_000 },
      );
      await page.getByRole("button", { name: `${fileName} 다운로드` }).click();
      expect((await downloadResponse).status()).toBe(200);

      await expect
        .poll(() => page.evaluate(() => (window as typeof window & { __lastOpenedDownloadUrl?: string }).__lastOpenedDownloadUrl || ""))
        .toContain("http");
    } finally {
      if (postId) {
        await apiCall(page, "DELETE", `/community/posts/${postId}/`);
      }
    }
  });

  test("작성 중 닫기는 입력 유실 전 확인을 요구한다", async ({ page }) => {
    await gotoAndSettle(page, `${BASE}/teacher/comms`, { timeout: 20_000 });
    await page.getByRole("button", { name: "공지사항 작성" }).click();
    await expect(page.getByText("공지사항 작성").first()).toBeVisible({ timeout: 10_000 });

    const titleInput = page.getByPlaceholder("공지사항 제목");
    await titleInput.fill(`[E2E-${Date.now()}] 작성 보호`);
    await page.getByRole("button", { name: "닫기" }).click();

    await expect(page.getByText("작성 취소")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "계속 작성" }).click();
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue(/작성 보호/);

    await page.getByRole("button", { name: "닫기" }).click();
    await page.getByRole("button", { name: "닫기" }).last().click();
    await expect(page.getByText("공지사항 작성").first()).not.toBeVisible({ timeout: 10_000 });
  });
});

async function loginAdmin(page: Page): Promise<void> {
  const resp = await page.request.post(`${API_BASE}/api/v1/token/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS, tenant_code: TENANT_CODE },
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Code": TENANT_CODE,
    },
    timeout: 60_000,
  });
  expect(resp.status()).toBe(200);
  const tokens = await resp.json() as { access: string; refresh: string };

  await page.goto(`${BASE}/login`, { waitUntil: "commit" });
  await page.evaluate(({ access, refresh, code }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    sessionStorage.setItem("tenantCode", code);
  }, { access: tokens.access, refresh: tokens.refresh, code: TENANT_CODE });
  await page.goto(`${BASE}/admin`, { waitUntil: "load", timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

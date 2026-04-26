/**
 * E2E: storage-as-canonical 통합 — 저장소 ↔ 매치업 승격
 *
 * 시나리오:
 *   1. 매치업 페이지 직접 업로드 → 저장소에서 같은 파일이 📚 매치업 뱃지로 노출
 *   2. 저장소 업로드 모달의 "매치업 자료로도 등록" 토글 ON → 한 번에 매치업 row 등장
 *   3. 저장소 row 클릭 → "매치업으로 등록" 액션 → 매치업 페이지로 이동
 *   4. 이미 승격된 파일 row 클릭 → "매치업 보기" 액션 (409 회피)
 *   5. 매치업 페이지에서 "저장소에서 보기" 링크 → 저장소 탭으로 이동
 *   6. inventory_file_id 응답에 포함됨 (네트워크 검증)
 *
 * Tenant 1 (hakwonplus), [E2E-{timestamp}] 태그, cleanup 필수.
 */
import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

const BASE = process.env.E2E_BASE_URL || "https://hakwonplus.com";

test.describe("storage-as-canonical 통합", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, "admin");
  });

  test("매치업 list 응답에 inventory_file_id 포함 (M-3 NOT NULL 검증)", async ({ page }) => {
    let docs: Array<{ id: number; inventory_file_id: number | null }> = [];
    page.on("response", async (resp) => {
      if (resp.url().endsWith("/matchup/documents/") && resp.request().method() === "GET") {
        try {
          docs = await resp.json();
        } catch {
          // ignore
        }
      }
    });
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) {
      expect(d.inventory_file_id, `doc ${d.id} should have inventory_file_id`).not.toBeNull();
    }
  });

  test("저장소 list 응답에 매치업 정보 포함", async ({ page }) => {
    let body: { files: Array<{ id: string; matchup?: { documentId: number; status: string; problemCount: number } }> } | null = null;
    page.on("response", async (resp) => {
      if (resp.url().includes("/storage/inventory/?scope=admin") && resp.request().method() === "GET") {
        try {
          body = await resp.json();
        } catch {
          // ignore
        }
      }
    });
    await page.goto(`${BASE}/admin/storage/files`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    expect(body, "inventory list response should arrive").not.toBeNull();
    const promoted = body!.files.filter((f) => f.matchup);
    expect(promoted.length, "at least one promoted file expected after backfill").toBeGreaterThan(0);
    const m = promoted[0].matchup!;
    expect(m).toHaveProperty("documentId");
    expect(m).toHaveProperty("status");
    expect(m).toHaveProperty("problemCount");
  });

  test("매치업 페이지에서 '저장소에서 보기' 버튼 노출 + 클릭 시 저장소 탭 이동", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/matchup`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const firstDoc = page.locator("[data-testid='matchup-doc-row']").first();
    if (await firstDoc.count() === 0) {
      test.skip(true, "no matchup docs in this tenant");
      return;
    }
    await firstDoc.click();
    await page.waitForTimeout(800);

    const storageLink = page.locator("[data-testid='matchup-doc-storage-link']");
    await expect(storageLink, "storage 링크 버튼 노출 (inventory_file_id 있을 때만)").toBeVisible({ timeout: 5000 });

    await storageLink.click();
    await expect(page).toHaveURL(/\/admin\/storage\/files/, { timeout: 8000 });
  });

  test("저장소에서 매치업 승격된 파일 row 클릭 → '매치업 보기' 액션 (📚 뱃지 노출 동시 검증)", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/files`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const promotedRow = page.locator("[data-testid='storage-file-row-promoted']").first();
    if (await promotedRow.count() === 0) {
      test.skip(true, "no promoted files in root folder");
      return;
    }

    // 뱃지 노출 검증 (자식)
    await expect(promotedRow.locator("[data-testid^='storage-file-matchup-badge-']")).toBeVisible();

    await promotedRow.click();
    await page.waitForTimeout(500);

    // "매치업 보기" 액션 노출, "매치업으로 등록"은 아님
    await expect(page.locator("[data-testid='storage-file-action-matchup-open']")).toBeVisible({ timeout: 3000 });
    await expect(page.locator("[data-testid='storage-file-action-matchup-promote']")).toHaveCount(0);
  });

  test("매치업 자동등록 폴더 진입 시 안내 banner 노출 + 매치업 페이지 이동 CTA", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/files`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // 좌측 트리에서 매치업-자동등록 폴더 클릭
    const matchupFolder = page.locator("text=매치업-자동등록").first();
    if (await matchupFolder.count() === 0) {
      test.skip(true, "no 매치업-자동등록 folder yet");
      return;
    }
    await matchupFolder.click();
    await page.waitForTimeout(800);

    const banner = page.locator("[data-testid='storage-matchup-folder-banner']");
    await expect(banner).toBeVisible({ timeout: 3000 });
    await expect(banner).toContainText("매치업");
  });

  test("저장소 업로드 모달 — 파일 선택 전엔 매치업 토글 hidden, PDF 선택 후 enabled로 노출", async ({ page }) => {
    await page.goto(`${BASE}/admin/storage/files`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const addBtn = page.getByRole("button", { name: "추가" }).first();
    await addBtn.click();
    await page.waitForTimeout(300);
    await page.getByText("파일 업로드").click();
    await page.waitForTimeout(500);

    const promoteToggle = page.locator("[data-testid='upload-modal-promote-matchup']");
    // 파일 선택 전: 토글이 노출되지 않아야 함 (disabled 회색 토글이 "잠긴 듯" 보이는 UX 회피)
    await expect(promoteToggle).toHaveCount(0);

    // PDF 파일 선택 후 토글 노출 + enabled
    const fileInput = page.locator("input[type='file']");
    await fileInput.setInputFiles({
      name: "smoke.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });
    await page.waitForTimeout(300);
    await expect(promoteToggle).toBeVisible({ timeout: 3000 });
    await expect(promoteToggle).toBeEnabled();
  });
});


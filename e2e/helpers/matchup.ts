import { expect, type Locator, type Page } from "@playwright/test";
import { apiCall } from "./api";
import { waitForRenderSettled } from "./wait";

export type MatchupE2EDocument = {
  id: number;
  title?: string;
  status?: string;
  problem_count?: number;
  source_type?: string | null;
  intent?: string | null;
  meta?: {
    source_type?: string | null;
    upload_intent?: string | null;
    document_role?: string | null;
  } | null;
};

export function readApiResults<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  return Array.isArray(results) ? results as T[] : [];
}

function sourceTypeOf(doc: MatchupE2EDocument): string {
  return String(
    doc.source_type ||
    doc.meta?.source_type ||
    doc.meta?.upload_intent ||
    doc.meta?.document_role ||
    doc.intent ||
    "",
  ).trim().toLowerCase();
}

export function isExamLikeMatchupDocument(doc: MatchupE2EDocument): boolean {
  const sourceType = sourceTypeOf(doc);
  return sourceType === "school_exam_pdf" ||
    sourceType === "student_exam_photo" ||
    sourceType === "test" ||
    sourceType === "exam_sheet";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function openMatchupUploadModal(
  page: Page,
  intent: "reference" | "test" = "test",
): Promise<Locator> {
  const preferred = intent === "reference"
    ? page.locator('[data-testid="matchup-reference-upload-button"]').first()
    : page.locator('[data-testid="matchup-upload-button"]').first();
  const fallback = page.getByRole("button", { name: intent === "reference" ? /^자료$/ : /^시험지$/ }).first();

  const trigger = await preferred.isVisible({ timeout: 15_000 }).catch(() => false)
    ? preferred
    : fallback;
  await expect(trigger, `매치업 ${intent === "test" ? "시험지" : "자료"} 업로드 버튼`).toBeVisible({ timeout: 15_000 });
  await trigger.click();

  const modal = page.locator('[data-testid="matchup-upload-modal"]').first();
  await expect(modal).toBeVisible({ timeout: 15_000 });
  return modal;
}

export async function fetchMatchupDocuments(page: Page): Promise<MatchupE2EDocument[]> {
  const res = await apiCall<unknown>(page, "GET", "/matchup/documents/?page_size=500");
  expect(res.status, "matchup documents API").toBeGreaterThanOrEqual(200);
  expect(res.status, "matchup documents API").toBeLessThan(300);
  return readApiResults<MatchupE2EDocument>(res.body);
}

export async function selectStableDoneMatchupDocument(page: Page): Promise<MatchupE2EDocument> {
  const docs = await fetchMatchupDocuments(page);
  const doneWithProblems = docs.filter((doc) => doc.status === "done" && (doc.problem_count ?? 0) > 0);
  const selected = doneWithProblems.find(isExamLikeMatchupDocument) ?? doneWithProblems[0];
  expect(selected, "직접 자르기 검증용 done 문서").toBeTruthy();

  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/admin/storage/matchup?docId=${selected!.id}`, { waitUntil: "load", timeout: 30_000 });
  await waitForRenderSettled(page, { timeout: 20_000 });

  const row = page.locator(`[data-testid="matchup-doc-row"][data-doc-id="${selected!.id}"]`).first();
  if (await row.count() > 0) {
    await row.click().catch(() => {});
  }
  await expect(page.locator('[data-testid="matchup-doc-manual-crop-btn"]')).toBeVisible({ timeout: 20_000 });
  return selected!;
}

export async function waitForMatchupDocumentByTitle(
  page: Page,
  title: string,
  maxMs = 360_000,
): Promise<MatchupE2EDocument> {
  const deadline = Date.now() + maxMs;
  let last: MatchupE2EDocument | undefined;
  while (Date.now() < deadline) {
    const docs = await fetchMatchupDocuments(page);
    last = docs.find((doc) => doc.title === title);
    if (last?.status === "done" || last?.status === "failed") return last;
    await sleep(5_000);
  }
  return last ?? { id: 0, title, status: "timeout", problem_count: 0 };
}

export async function pickUnusedCropProblemNumber(
  page: Page,
  preferred = 989,
): Promise<number> {
  const texts = await page.locator('[data-testid="matchup-crop-problem-row"]').allTextContents();
  const used = new Set<number>();
  for (const text of texts) {
    const match = text.match(/(\d+)번/);
    if (match) used.add(Number(match[1]));
  }
  if (!used.has(preferred)) return preferred;
  for (let n = 999; n >= 900; n -= 1) {
    if (!used.has(n)) return n;
  }
  throw new Error("수동 자르기 테스트에 사용할 빈 900번대 문항 번호가 없습니다.");
}

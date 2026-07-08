import { test, expect } from "../fixtures/strictTest";
import type { Locator, Page } from "@playwright/test";
import { apiCall } from "../helpers/api";
import { loginViaUI } from "../helpers/auth";
import { waitForRenderSettled } from "../helpers/wait";

const VISIBLE_DIALOG = "[role='dialog']:visible, .admin-modal-overlay:visible";

type ListEnvelope<T> = T[] | { results?: T[]; items?: T[] };

type LectureApiRow = {
  id?: unknown;
  title?: unknown;
  is_active?: unknown;
};

type SessionApiRow = {
  id?: unknown;
};

type TargetLecture = {
  id: number;
  title: string;
};

function rows<T>(value: ListEnvelope<T> | unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value != null && typeof value === "object") {
    const record = value as { results?: unknown; items?: unknown };
    if (Array.isArray(record.results)) return record.results as T[];
    if (Array.isArray(record.items)) return record.items as T[];
  }
  return [];
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLecture(row: LectureApiRow): TargetLecture | null {
  const id = numberOrNull(row.id);
  if (id == null || row.is_active === false) return null;
  const title = typeof row.title === "string" && row.title.trim()
    ? row.title.trim()
    : `Lecture ${id}`;
  return { id, title };
}

async function findActiveLectureWithSession(page: Page): Promise<TargetLecture | null> {
  const lecturesRes = await apiCall<ListEnvelope<LectureApiRow>>(page, "GET", "/lectures/lectures/");
  expect(lecturesRes.status, "read active lecture candidates").toBe(200);

  const lectures = rows<LectureApiRow>(lecturesRes.body)
    .map(normalizeLecture)
    .filter((lecture): lecture is TargetLecture => lecture != null);

  for (const lecture of lectures) {
    const sessionsRes = await apiCall<ListEnvelope<SessionApiRow>>(
      page,
      "GET",
      `/lectures/sessions/?lecture=${lecture.id}`,
    );
    expect(sessionsRes.status, `read sessions for lecture ${lecture.id}`).toBe(200);

    const sessions = rows<SessionApiRow>(sessionsRes.body)
      .filter((session) => numberOrNull(session.id) != null);
    if (sessions.length > 0) return lecture;
  }

  return null;
}

function sessionTab(page: Page, label: "성적" | "시험" | "과제"): Locator {
  return page.getByRole("button", { name: label, exact: true }).first();
}

async function openLectureFromList(page: Page, lecture: TargetLecture): Promise<void> {
  const lecturesLink = page.locator('nav a[href="/admin/lectures"], aside a[href="/admin/lectures"], [class*=sidebar] a[href="/admin/lectures"]')
    .filter({ hasText: "강의" })
    .first();
  await expect(lecturesLink, "sidebar lectures link").toBeVisible({ timeout: 10_000 });
  await lecturesLink.click();
  await waitForRenderSettled(page, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/admin\/lectures(?:\/)?$/);
  await expect(page.getByText("Not Found", { exact: true })).toHaveCount(0);

  const table = page.locator('[data-guide="lectures-table"]');
  await expect(table, "admin lecture table").toBeVisible({ timeout: 15_000 });

  const lectureRow = table.locator('tbody tr[role="button"]').filter({ hasText: lecture.title }).first();
  await expect(lectureRow, `lecture row "${lecture.title}"`).toBeVisible({ timeout: 10_000 });
  await lectureRow.click();

  await expect(page).toHaveURL(new RegExp(`/admin/lectures/${lecture.id}(?:[/?#]|$)`), { timeout: 10_000 });
  await waitForRenderSettled(page, { timeout: 15_000 });
  await expect(page.getByText("Not Found", { exact: true })).toHaveCount(0);
}

async function openFirstSessionFromLecture(page: Page): Promise<void> {
  const sessionBlock = page.locator("button.session-block:not(.session-block--add)").first();
  await expect(sessionBlock, "lecture detail should expose at least one session block").toBeVisible({ timeout: 15_000 });
  await sessionBlock.click();

  await expect(page).toHaveURL(/\/admin\/lectures\/\d+\/sessions\/\d+\/attendance(?:[/?#]|$)/, {
    timeout: 10_000,
  });
  await waitForRenderSettled(page, { timeout: 15_000 });
  await expect(page.getByText("Not Found", { exact: true })).toHaveCount(0);
}

async function assertCoreSessionTabs(page: Page): Promise<void> {
  for (const label of ["성적", "시험", "과제"] as const) {
    await expect(sessionTab(page, label), `${label} tab should be visible`).toBeVisible({ timeout: 10_000 });
  }
}

async function clickSessionTab(page: Page, label: "성적" | "시험" | "과제", path: string): Promise<void> {
  const tab = sessionTab(page, label);
  await expect(tab, `${label} tab should be clickable`).toBeVisible({ timeout: 10_000 });
  await tab.click();

  await expect(page).toHaveURL(new RegExp(`/admin/lectures/\\d+/sessions/\\d+/${path}(?:\\?.*)?$`), {
    timeout: 10_000,
  });
  await waitForRenderSettled(page, { timeout: 15_000 });
  await expect(sessionTab(page, label), `${label} tab active state`).toHaveClass(/is-active/);
  await expect(page.getByText("Not Found", { exact: true })).toHaveCount(0);
}

async function visibleDialog(page: Page): Promise<Locator> {
  const dialog = page.locator(VISIBLE_DIALOG).first();
  await expect(dialog, "assessment dialog").toBeVisible({ timeout: 10_000 });
  return dialog;
}

async function closeDialog(page: Page): Promise<void> {
  const dialog = page.locator(VISIBLE_DIALOG).first();
  const cancel = dialog.getByRole("button", { name: /^취소$/ }).first();
  if (await cancel.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await cancel.click();
  } else {
    const close = dialog.getByRole("button", { name: /닫기|Close/ }).first();
    if (await close.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await close.click();
    } else {
      await page.keyboard.press("Escape");
    }
  }
  await expect(page.locator(VISIBLE_DIALOG).first()).toBeHidden({ timeout: 5_000 });
}

async function openCreateAssessmentModal(page: Page, trigger: Locator, kind: "시험" | "과제"): Promise<void> {
  await expect(trigger, `${kind} create trigger`).toBeVisible({ timeout: 10_000 });
  await trigger.click();

  const dialog = await visibleDialog(page);
  await expect(dialog).toContainText(kind);
  await expect(dialog).toContainText("어떻게 만들까요?");

  const fromScratch = dialog.locator("button.session-block").filter({ hasText: "처음부터 만들기" }).first();
  await expect(fromScratch, `${kind} from-scratch option`).toBeVisible({ timeout: 5_000 });
  await fromScratch.click();

  await expect(dialog).toContainText(kind === "시험" ? "커트라인" : "공통 커트라인");
  await expect(dialog.getByRole("button", { name: new RegExp(`${kind} 만들기`) })).toBeDisabled();

  await closeDialog(page);
}

async function exerciseScoresMoreMenu(page: Page): Promise<void> {
  const moreButton = page.getByRole("button", { name: "추가 기능" }).first();
  await expect(moreButton, "scores more menu button").toBeVisible({ timeout: 10_000 });
  await moreButton.click();

  const menu = page.locator(".scores-more-menu").first();
  await expect(menu).toBeVisible({ timeout: 5_000 });
  await expect(menu.getByRole("button", { name: /성적표 출력/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /클리닉 대상 보기/ })).toBeVisible();
  await expect(menu.getByRole("button", { name: /수강생 일괄배정/ })).toBeVisible();

  await moreButton.click();
  await expect(menu).toBeHidden({ timeout: 5_000 });
}

async function exerciseOmrIfAvailable(page: Page): Promise<"opened" | "not-rendered"> {
  const omrButton = page.getByRole("button", { name: /OMR 스캔 등록/ }).first();
  if (!(await omrButton.isVisible({ timeout: 1_500 }).catch(() => false))) {
    return "not-rendered";
  }

  await omrButton.click();

  const picker = page.locator(".scores-omr-picker").first();
  if (await picker.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await expect(picker).toContainText("시험 선택");
    const firstExam = picker.locator("button").first();
    await expect(firstExam, "OMR exam picker option").toBeVisible({ timeout: 5_000 });
    await firstExam.click();
  }

  const dialog = await visibleDialog(page);
  await expect(dialog).toContainText("OMR 스캔 등록");
  await closeDialog(page);
  return "opened";
}

function assessmentSection(page: Page, label: "시험" | "과제"): Locator {
  return assessmentRemote(page).locator("section").filter({ hasText: label }).first();
}

function assessmentRemote(page: Page): Locator {
  return page.locator('[data-testid="session-assessment-remote"]').first();
}

test.describe("admin real-use session assessment flow", () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 1440, height: 900 } });

  test("clicks from lectures to a session and verifies assessment tabs/buttons read-only", async ({ page }) => {
    await loginViaUI(page, "admin");

    const targetLecture = await findActiveLectureWithSession(page);
    if (targetLecture == null) {
      test.skip(true, "setup: no active lecture with an existing session is available under /admin/lectures");
      return;
    }

    await openLectureFromList(page, targetLecture);
    await openFirstSessionFromLecture(page);
    await assertCoreSessionTabs(page);

    await clickSessionTab(page, "성적", "scores");
    const addExamFromScores = page.getByRole("button", { name: /^\+\s*시험$/ }).first();
    const addHomeworkFromScores = page.getByRole("button", { name: /^\+\s*과제$/ }).first();
    await expect(addExamFromScores, "scores tab +시험 button").toBeVisible({ timeout: 10_000 });
    await expect(addHomeworkFromScores, "scores tab +과제 button").toBeVisible({ timeout: 10_000 });
    await expect(assessmentRemote(page), "성적 탭은 시험/과제 리모컨을 렌더하지 않는다").toHaveCount(0);
    await exerciseScoresMoreMenu(page);
    await exerciseOmrIfAvailable(page);
    await openCreateAssessmentModal(page, addExamFromScores, "시험");
    await openCreateAssessmentModal(page, addHomeworkFromScores, "과제");

    await clickSessionTab(page, "시험", "exams");
    await expect(assessmentRemote(page), "시험 탭은 시험/과제 리모컨을 유지한다").toBeVisible({ timeout: 10_000 });
    const examSection = assessmentSection(page, "시험");
    await expect(examSection, "시험 side panel section").toBeVisible({ timeout: 10_000 });
    await expect(examSection.getByText("시험", { exact: true }).first()).toBeVisible();
    await openCreateAssessmentModal(page, examSection.getByRole("button", { name: /^시험 추가$/ }).first(), "시험");

    await clickSessionTab(page, "과제", "assignments");
    await expect(assessmentRemote(page), "과제 탭은 시험/과제 리모컨을 유지한다").toBeVisible({ timeout: 10_000 });
    const homeworkSection = assessmentSection(page, "과제");
    await expect(homeworkSection, "과제 side panel section").toBeVisible({ timeout: 10_000 });
    await expect(homeworkSection.getByText("과제", { exact: true }).first()).toBeVisible();
    await openCreateAssessmentModal(page, homeworkSection.getByRole("button", { name: /^과제 추가$/ }).first(), "과제");
  });
});

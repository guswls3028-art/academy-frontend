import { writeFile } from "node:fs/promises";
import type { Page, TestInfo } from "@playwright/test";

export async function writeWrongNoteEntryObservation(
  page: Page,
  testInfo: TestInfo,
  phase: "desktop-entry" | "mobile-reopen",
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const snapshot = page.getByRole("button", { name: "성적 도구", exact: true }).evaluateAll(buttons => {
      const visible = (element: Element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility === "visible";
      };
      const anyVisible = (selector: string) => Array.from(document.querySelectorAll(selector)).some(visible);
      const shown = buttons.filter(visible);
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open]')).filter(visible);
      const account = '[aria-labelledby~="first-login-guide-title"]';
      const password = '[aria-labelledby~="force-password-change-title"]';
      const path = location.pathname;
      const disclosure = document.querySelector<HTMLDetailsElement>("details.scores-management");
      const route = /^\/workspace\/lectures\/\d+\/sessions\/\d+\/scores\/?$/.test(path) ? "scores"
        : /^\/login(?:\/|$)/.test(path) ? "login"
        : /^\/workspace\/mobile(?:\/|$)/.test(path) ? "teacher" : "other";
      return {
        viewport: { width: innerWidth, height: innerHeight }, route,
        buttonCount: buttons.length, buttonVisible: shown.length > 0,
        buttonEnabled: buttons.some(button => !button.matches(":disabled") && !button.closest('[aria-disabled="true"]')),
        buttonCenterCovered: shown.length === 1 ? (() => {
          const button = shown[0];
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return hit ? !button.contains(hit) : null;
        })() : null,
        scoreEntryVisible: anyVisible(".scores-entry-page"),
        disclosureOpen: disclosure?.open ?? null,
        scoreInputVisible: anyVisible("[data-score-cell]"),
        loadingVisible: anyVisible('.ds-empty[data-tone="loading"], [role="progressbar"]'),
        errorVisible: anyVisible('.ds-empty[data-error="true"], .scores-grading-entry-error'),
        accountDialog: dialogs.some(dialog => dialog.matches(account)),
        passwordDialog: dialogs.some(dialog => dialog.matches(password)),
        otherDialog: dialogs.some(dialog => !dialog.matches(account) && !dialog.matches(password)),
      };
    });
    const observation = await Promise.race([
      snapshot,
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 800); }),
    ]);
    await writeFile(testInfo.outputPath("wrong-note-entry-observation.json"), JSON.stringify({
      schema: "wrong-note-entry/v1", phase, observation,
    }));
  } catch {
    // A closed browser or unavailable output directory must preserve the original entry failure.
  } finally {
    clearTimeout(timer);
  }
}

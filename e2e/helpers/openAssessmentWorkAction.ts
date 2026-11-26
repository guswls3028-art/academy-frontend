import type { Page } from "@playwright/test";

export async function openAssessmentWorkAction(
  page: Page,
  step: "audience" | "materials" | "policy" | "submissions" | "results",
  action: string,
) {
  const heading = page.getByTestId(`assessment-step-${step}`);
  if (await heading.getAttribute("aria-expanded") !== "true") await heading.click();
  const button = page.getByTestId(`assessment-action-${action}`);
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
}

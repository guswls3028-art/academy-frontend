import { expect, type Page } from "@playwright/test";

export async function acknowledgeFirstLoginGuideIfVisible(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "계정 안내" });
  const visible = await dialog
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return;

  await dialog.getByRole("button", { name: "확인", exact: true }).click();
  await expect(dialog).toBeHidden();
}

export async function acknowledgeInitialAccountPromptsIfVisible(page: Page): Promise<void> {
  const passwordDialog = page.getByRole("dialog", { name: "비밀번호 변경 권장" });
  const passwordDialogVisible = await passwordDialog
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (passwordDialogVisible) {
    await expect(passwordDialog).toContainText(
      "나중에 변경해도 계속 이용할 수 있습니다",
    );
    await passwordDialog
      .getByRole("button", { name: "위험을 이해했고 나중에", exact: true })
      .click();
    await expect(passwordDialog).toBeHidden();
  }

  await acknowledgeFirstLoginGuideIfVisible(page);
}

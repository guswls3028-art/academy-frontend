import ExcelJS from "exceljs";

import { test, expect } from "../fixtures/strictTest";
import { loginViaUI } from "../helpers/auth";

async function studentWorkbookWithoutPersonalPhone(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("학생목록");
  worksheet.addRow(["이름", "학부모전화번호", "학생전화번호"]);
  worksheet.addRow(["[E2E-비밀번호옵션] 번호없는학생", "01070001111", ""]);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

test("학생 엑셀 등록에서 초기 비밀번호 방식을 선택하고 번호 누락을 차단한다", async ({ page }) => {
  await loginViaUI(page, "admin");

  const studentMenu = page.getByText("학생", { exact: true }).first();
  await expect(studentMenu).toBeVisible();
  await studentMenu.click();
  await expect(page).toHaveURL(/\/admin\/students/);

  await page.getByRole("button", { name: "학생 추가" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByText("엑셀 업로드", { exact: true }).click();

  await dialog.locator('input[type="file"]').setInputFiles({
    name: "student-password-options.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await studentWorkbookWithoutPersonalPhone(),
  });

  const phoneMode = dialog.getByRole("radio", { name: "학생 휴대폰 번호 뒤 4자리" });
  await expect(phoneMode).toBeChecked();
  await expect(dialog.getByRole("alert")).toContainText("학생 전화번호가 없거나 올바르지 않은 학생이 1명");

  const registerButton = dialog.getByRole("button", { name: "등록", exact: true });
  await expect(registerButton).toBeDisabled();

  await dialog.getByRole("radio", { name: "공통 비밀번호 직접 입력" }).check();
  const fixedPassword = dialog.getByLabel("공통 초기 비밀번호");
  await expect(fixedPassword).toBeVisible();
  await fixedPassword.fill("12");
  await expect(registerButton).toBeDisabled();
  await fixedPassword.fill("1234");
  await expect(registerButton).toBeEnabled();

  await dialog.getByRole("radio", { name: "학생별 랜덤 비밀번호" }).check();
  await expect(dialog.getByText("등록 완료 후 학생별 비밀번호 목록이 자동으로 내려받아집니다.")).toBeVisible();
  await expect(registerButton).toBeEnabled();
});

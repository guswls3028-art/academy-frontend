import ExcelJS from "exceljs";
import type { Page, TestInfo } from "@playwright/test";
import { expect } from "../fixtures/strictTest";

export const inspectionFeedback = "중간 풀이가 자세해졌어요. 남은 예제를 확인해 주세요.";

export async function verifyHomeworkInspectionEntry(
  page: Page, title: string, student: string, enrollment: number, width: number, info: TestInfo,
) {
  await page.getByRole("button", { name: `${title} 과제 검사`, exact: true }).click();
  const panel = page.getByRole("dialog", { name: "과제 검사", exact: true });
  if (width === 1366) {
    await panel.getByLabel("학생 선택").selectOption(String(enrollment));
    await panel.getByLabel("풀어 온 문제 수", { exact: true }).fill("0");
    await panel.getByLabel("총 문제 수", { exact: true }).fill("15");
    await panel.getByLabel("학생·학부모용 코멘트").fill(inspectionFeedback);
    await panel.getByRole("button", { name: /^저장(하고 다음 학생)?$/ }).click();
    await expect(panel.getByRole("status").filter({ hasText: `${student} 학생의 검사 결과를 저장했습니다.` })).toBeVisible();
  } else {
    await panel.getByRole("button", { name: "엑셀 일괄 입력", exact: true }).click();
    await panel.getByLabel("공통 총 문제 수").fill("15");
    const downloaded = page.waitForEvent("download");
    await panel.getByRole("button", { name: "명단 양식 다운로드" }).click();
    const path = info.outputPath("inspection-template.xlsx");
    await (await downloaded).saveAs(path);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path);
    const sheet = workbook.getWorksheet("과제 검사")!;
    let count = 0;
    sheet.eachRow(row => {
      if (row.getCell(6).value === enrollment) {
        expect(row.getCell(2).value).toBe(student);
        expect(row.getCell(4).value).toBe(15);
        row.getCell(3).value = 12;
        count++;
      }
    });
    expect(count).toBe(1);
    await panel.getByLabel("작성한 엑셀 파일").setInputFiles({
      name: "과제검사.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    });
    await expect(panel.getByText("미리보기 1명 · 반영 대상 1명")).toBeVisible();
    await expect(panel.getByText(inspectionFeedback, { exact: false }).first()).toBeVisible();
    await panel.getByRole("button", { name: "1명 반영하기" }).click();
    await expect(panel.getByText("1명의 과제 검사 결과를 저장했습니다.")).toBeVisible();
  }
  await page.reload();
  await page.getByRole("button", { name: `${title} 과제 검사`, exact: true }).click();
  await panel.getByLabel("학생 선택").selectOption(String(enrollment));
  await expect(panel.getByLabel("풀어 온 문제 수", { exact: true })).toHaveValue(width === 1366 ? "0" : "12");
  await expect(panel.getByLabel("학생·학부모용 코멘트")).toHaveValue(inspectionFeedback);
  await page.reload();
}

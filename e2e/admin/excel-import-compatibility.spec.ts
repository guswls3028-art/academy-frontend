import ExcelJS from "exceljs";
import JSZip from "jszip";

import { expect, test } from "../fixtures/strictTest";
import { loadImportWorkbook } from "../../src/shared/utils/excelImport";

const WORKBOOK_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";

async function createNonstandardWorkbook(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("학생목록");
  worksheet.addRows([
    ["이름", "학부모전화번호"],
    ["호환 점검 학생", "01012345678"],
  ]);
  const source = await workbook.xlsx.writeBuffer();
  const archive = await JSZip.loadAsync(source);
  const entry = archive.file("[Content_Types].xml");
  if (!entry) throw new Error("테스트 XLSX에 [Content_Types].xml이 없습니다.");

  const contentTypes = await entry.async("string");
  const withoutWorkbookOverride = contentTypes.replace(
    /<Override\b[^>]*PartName=["']\/xl\/workbook\.xml["'][^>]*\/>/i,
    "",
  );
  const nonstandard = withoutWorkbookOverride.replace(
    /<Default\b([^>]*\bExtension=["']xml["'][^>]*)\bContentType=["'][^"']+["']([^>]*)\/>/i,
    `<Default$1 ContentType="${WORKBOOK_CONTENT_TYPE}"$2/>`,
  );
  archive.file("[Content_Types].xml", nonstandard);

  for (const [entryName, entry] of Object.entries(archive.files)) {
    if (entry.dir || !/^xl\/(?:workbook|styles|sharedStrings|worksheets\/[^/]+)\.xml$/i.test(entryName)) {
      continue;
    }
    const xml = await entry.async("string");
    if (!/xmlns=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/i.test(xml)) {
      continue;
    }
    archive.file(
      entryName,
      xml
        .replace(
          /xmlns=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/i,
          'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
        )
        .replace(/<([/]?)([A-Za-z][\w.-]*)(?=[\s>/])/g, "<$1x:$2"),
    );
  }
  return archive.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

test("비표준 통합 문서 Content-Type으로 재저장된 XLSX를 호환 처리한다", async () => {
  const malformed = await createNonstandardWorkbook();
  const rawWorkbook = new ExcelJS.Workbook();
  await expect(rawWorkbook.xlsx.load(malformed)).rejects.toThrow();

  const repaired = await loadImportWorkbook(malformed);

  expect(repaired.worksheets[0]?.getCell("A2").value).toBe("호환 점검 학생");
  expect(repaired.worksheets[0]?.getCell("B2").value).toBe("01012345678");
});

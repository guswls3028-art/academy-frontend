import ExcelJS from "exceljs";
import JSZip from "jszip";
import { File as NodeFile } from "node:buffer";

import { expect, test } from "../fixtures/strictTest";
import { loadImportWorkbook } from "../../src/shared/utils/excelImport";
import { readFirstWorksheetRows } from "../../src/shared/utils/excelWorkbook";

const WORKBOOK_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const HANCOM_XLSX_MIME = "application/haansoftxlsx";

async function createStandardWorkbook(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("학생목록");
  worksheet.addRows([
    ["이름", "학부모전화번호"],
    ["합성학생", "01012345678"],
  ]);
  return workbook.xlsx.writeBuffer();
}

async function createNonstandardWorkbook(): Promise<ArrayBuffer> {
  const source = await createStandardWorkbook();
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

async function createHanCellShapedWorkbook(options: {
  xxe?: boolean;
  oversized?: boolean;
} = {}): Promise<ArrayBuffer> {
  const archive = await JSZip.loadAsync(await createStandardWorkbook());
  const entry = archive.file("docProps/app.xml");
  if (!entry) throw new Error("테스트 XLSX에 docProps/app.xml이 없습니다.");
  const appXml = await entry.async("string");
  const prefixed = appXml
    .replace(
      /<Properties\b([^>]*)xmlns=["']http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/extended-properties["']([^>]*)>/i,
      '<ep:Properties$1xmlns:ep="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"$2>',
    )
    .replace(/<\/Properties>/i, "</ep:Properties>")
    .replace(/<([/]?)(Application|AppVersion|Company)(?=[\s>])/g, "<$1ep:$2");
  const withPayload = options.oversized
    ? prefixed.replace("</ep:Properties>", `${"x".repeat(2 * 1024 * 1024 + 1)}</ep:Properties>`)
    : prefixed;
  archive.file(
    "docProps/app.xml",
    options.xxe
      ? withPayload.replace(
          /<\?xml[^>]*>/i,
          '$&<!DOCTYPE ep:Properties [<!ENTITY probe SYSTEM "file:///synthetic-secret">]>',
        )
      : withPayload,
  );
  return archive.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

test("비표준 통합 문서 Content-Type으로 재저장된 XLSX를 호환 처리한다", async () => {
  const malformed = await createNonstandardWorkbook();
  const rawWorkbook = new ExcelJS.Workbook();
  await expect(rawWorkbook.xlsx.load(malformed)).rejects.toThrow();

  const repaired = await loadImportWorkbook(malformed);

  expect(repaired.worksheets[0]?.getCell("A2").value).toBe("합성학생");
  expect(repaired.worksheets[0]?.getCell("B2").value).toBe("01012345678");
});

test("표준 OOXML XLSX는 변경 없이 읽는다", async () => {
  const workbook = await loadImportWorkbook(await createStandardWorkbook());
  expect(workbook.worksheets[0]?.getCell("A2").value).toBe("합성학생");
});

test("한셀식 확장 속성 접두사와 Hancom MIME으로 저장된 XLSX를 읽는다", async () => {
  const source = await createHanCellShapedWorkbook();
  const rawWorkbook = new ExcelJS.Workbook();
  await expect(rawWorkbook.xlsx.load(source)).rejects.toThrow();
  const file = new NodeFile(
    [Buffer.from(source)],
    "synthetic-hancell.xlsx",
    { type: HANCOM_XLSX_MIME },
  ) as unknown as File;

  const rows = await readFirstWorksheetRows(file);

  expect(rows[1]).toEqual(["합성학생", "01012345678"]);
});

test("손상 파일과 XLSX 위장 ZIP은 거부한다", async () => {
  await expect(loadImportWorkbook(new Uint8Array([1, 2, 3, 4]).buffer)).rejects.toThrow(
    "엑셀 파일의 내부 구조를 읽을 수 없습니다",
  );
  const masquerade = new JSZip();
  masquerade.file("readme.txt", "not-a-workbook");
  await expect(loadImportWorkbook(await masquerade.generateAsync({ type: "arraybuffer" }))).rejects.toThrow(
    "엑셀 파일의 내부 구조를 읽을 수 없습니다",
  );
});

test("XXE 선언과 과대 XML이 있는 한셀식 XLSX는 복구하지 않는다", async () => {
  await expect(loadImportWorkbook(await createHanCellShapedWorkbook({ xxe: true }))).rejects.toThrow(
    "엑셀 파일의 내부 구조를 읽을 수 없습니다",
  );
  await expect(loadImportWorkbook(await createHanCellShapedWorkbook({ oversized: true }))).rejects.toThrow(
    "엑셀 파일의 내부 구조를 읽을 수 없습니다",
  );
});

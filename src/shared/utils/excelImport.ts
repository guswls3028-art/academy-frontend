import ExcelJS from "exceljs";
import JSZip from "jszip";

const XLSX_WORKBOOK_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export async function loadImportWorkbook(source: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(source);
    return workbook;
  } catch {
    const repairedSource = await repairNonstandardWorkbookContentType(source);
    if (!repairedSource) {
      throw new Error("엑셀 파일의 내부 구조를 읽을 수 없습니다. 올바른 .xlsx 파일인지 확인해 주세요.");
    }
    const repairedWorkbook = new ExcelJS.Workbook();
    try {
      await repairedWorkbook.xlsx.load(repairedSource);
      return repairedWorkbook;
    } catch {
      throw new Error("엑셀 파일의 내부 구조를 읽을 수 없습니다. 올바른 .xlsx 파일인지 확인해 주세요.");
    }
  }
}

async function repairNonstandardWorkbookContentType(source: ArrayBuffer): Promise<ArrayBuffer | null> {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(source);
  } catch {
    return null;
  }

  const contentTypesEntry = archive.file("[Content_Types].xml");
  if (!contentTypesEntry || !archive.file("xl/workbook.xml")) return null;

  const contentTypes = await contentTypesEntry.async("string");
  let repairedArchive = false;
  let repairedDefault = false;
  const hasWorkbookOverride =
    /<Override\b[^>]*PartName=["']\/xl\/workbook\.xml["'][^>]*>/i.test(contentTypes);
  if (!hasWorkbookOverride) {
    const repairedContentTypes = contentTypes.replace(
      /<Default\b[^>]*\/>/gi,
      (tag) => {
        const isXmlDefault = /\bExtension=["']xml["']/i.test(tag);
        const ownsWorkbookType = new RegExp(
          `\\bContentType=["']${XLSX_WORKBOOK_CONTENT_TYPE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
          "i",
        ).test(tag);
        if (!isXmlDefault || !ownsWorkbookType) return tag;
        repairedDefault = true;
        return tag.replace(
          /\bContentType=["'][^"']+["']/i,
          'ContentType="application/xml"',
        );
      },
    );
    if (repairedDefault && /<\/Types>/i.test(repairedContentTypes)) {
      archive.file(
        "[Content_Types].xml",
        repairedContentTypes.replace(
          /<\/Types>/i,
          `<Override PartName="/xl/workbook.xml" ContentType="${XLSX_WORKBOOK_CONTENT_TYPE}"/></Types>`,
        ),
      );
      repairedArchive = true;
    }
  }

  const spreadsheetNamespace =
    /xmlns:x=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/i;
  for (const [entryName, entry] of Object.entries(archive.files)) {
    if (entry.dir || !/^xl\/.*\.xml$/i.test(entryName)) continue;
    const xml = await entry.async("string");
    if (!spreadsheetNamespace.test(xml)) continue;
    archive.file(
      entryName,
      xml
        .replace(spreadsheetNamespace, 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
        .replace(/<x:/g, "<")
        .replace(/<\/x:/g, "</"),
    );
    repairedArchive = true;
  }

  if (!repairedArchive) return null;
  return archive.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

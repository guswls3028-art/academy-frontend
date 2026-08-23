import ExcelJS from "exceljs";
import JSZip from "jszip";

const XLSX_WORKBOOK_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const MAX_ARCHIVE_ENTRIES = 512;
const MAX_STRUCTURAL_XML_CHARS = 2 * 1024 * 1024;
const MAX_APP_XML_CHARS = 512 * 1024;
const UNSAFE_XML_DECLARATION = /<!DOCTYPE\b|<!ENTITY\b/i;

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export async function loadImportWorkbook(source: ArrayBuffer): Promise<ExcelJS.Workbook> {
  let archive: JSZip;
  try {
    archive = await loadValidatedWorkbookArchive(source);
  } catch {
    throw new Error("엑셀 파일의 내부 구조를 읽을 수 없습니다. 올바른 .xlsx 파일인지 확인해 주세요.");
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(source);
    return workbook;
  } catch {
    const repairedSource = await repairNonstandardWorkbookContentType(archive);
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

async function readStructuralXml(
  entry: JSZip.JSZipObject,
  maxChars = MAX_STRUCTURAL_XML_CHARS,
): Promise<string> {
  const xml = await entry.async("string");
  if (xml.length > maxChars || UNSAFE_XML_DECLARATION.test(xml)) {
    throw new Error("unsafe workbook XML");
  }
  return xml;
}

async function loadValidatedWorkbookArchive(source: ArrayBuffer): Promise<JSZip> {
  const archive = await JSZip.loadAsync(source);
  if (Object.keys(archive.files).length > MAX_ARCHIVE_ENTRIES) {
    throw new Error("too many workbook entries");
  }
  const contentTypesEntry = archive.file("[Content_Types].xml");
  const workbookEntry = archive.file("xl/workbook.xml");
  if (!contentTypesEntry || !workbookEntry) {
    throw new Error("missing workbook entries");
  }
  await readStructuralXml(contentTypesEntry);
  await readStructuralXml(workbookEntry);
  const appEntry = archive.file("docProps/app.xml");
  if (appEntry) await readStructuralXml(appEntry, MAX_APP_XML_CHARS);
  return archive;
}

async function repairNonstandardWorkbookContentType(archive: JSZip): Promise<ArrayBuffer | null> {
  const contentTypesEntry = archive.file("[Content_Types].xml");
  if (!contentTypesEntry || !archive.file("xl/workbook.xml")) return null;

  const contentTypes = await readStructuralXml(contentTypesEntry);
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
    const xml = await readStructuralXml(entry, 16 * 1024 * 1024);
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

  const appEntry = archive.file("docProps/app.xml");
  if (appEntry) {
    const appXml = await readStructuralXml(appEntry, MAX_APP_XML_CHARS);
    const prefixedProperties = appXml.match(
      /<([A-Za-z_][\w.-]*):Properties\b[^>]*\bxmlns:\1=["']http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/extended-properties["'][^>]*>/i,
    );
    if (prefixedProperties) {
      const prefix = prefixedProperties[1];
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      archive.file(
        "docProps/app.xml",
        appXml
          .replace(
            new RegExp(`xmlns:${escapedPrefix}=["']http://schemas\\.openxmlformats\\.org/officeDocument/2006/extended-properties["']`, "i"),
            'xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"',
          )
          .replace(new RegExp(`<${escapedPrefix}:`, "g"), "<")
          .replace(new RegExp(`</${escapedPrefix}:`, "g"), "</"),
      );
      repairedArchive = true;
    }
  }

  if (!repairedArchive) return null;
  return archive.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

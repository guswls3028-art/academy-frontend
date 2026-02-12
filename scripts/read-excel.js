import XLSX from "xlsx";
const path = process.argv[2] || "C:/Users/heon7/OneDrive/문서/카카오톡 받은 파일/신민 토10 0131.xlsx";

try {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log("=== Sheet:", wb.SheetNames[0], "===");
  console.log("Total rows:", rows.length);
  console.log("");
  console.log("=== First 15 rows ===");
  rows.slice(0, 15).forEach((r, i) => console.log((i + 1) + ":", JSON.stringify(r)));
} catch (e) {
  console.error("Error:", e.message);
}

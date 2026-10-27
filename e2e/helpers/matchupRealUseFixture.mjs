import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";

// Small, deterministic, synthetic inputs: no copied exams or student data.
export async function matchupRealUseFixtures() {
  const files = [];
  for (const kind of ["reference", "test"]) {
    const pdf = await PDFDocument.create();
    pdf.setCreationDate(new Date("2026-01-01T00:00:00Z"));
    pdf.setModificationDate(new Date("2026-01-01T00:00:00Z"));
    pdf.setTitle(`Synthetic Matchup ${kind}`);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([612, 792]);
    page.drawText(kind === "reference" ? "QA Reference Exercises" : "QA School Examination", {
      x: 48, y: 735, size: 18, font,
    });
    const questions = [
      ["1. Solve the equation 3x + 7 = 22.", "(1) 3   (2) 4   (3) 5   (4) 6   (5) 7"],
      ["2. Find the area of a rectangle with", "width 4 cm and length 9 cm.", "(1) 13   (2) 18   (3) 26   (4) 36   (5) 45"],
    ];
    questions.forEach((lines, index) => lines.forEach((line, row) => {
      page.drawText(line, { x: 48, y: 635 - index * 280 - row * 32, size: 19, font });
    }));
    files.push({ kind, name: `qa-matchup-${kind}.pdf`, buffer: Buffer.from(await pdf.save()) });
  }
  const fixturesSha256 = createHash("sha256");
  for (const file of files) fixturesSha256.update(file.name).update(file.buffer);
  return { files, fixturesSha256: fixturesSha256.digest("hex") };
}

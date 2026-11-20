// 명예의 전당 게시용 A4 출력물 — 교실 앞·뒤 부착용
import { formatRankingScore, type PeriodRankingEntry } from "./periodRanking";

export type HallOfFameDocument = {
  lectureTitle: string;
  periodLabel: string;
  scopeLabel: string;
  topN: number;
  showScores: boolean;
  entries: PeriodRankingEntry[];
  printedAt: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function medalClass(rank: number): string {
  if (rank === 1) return "medal medal--gold";
  if (rank === 2) return "medal medal--silver";
  if (rank === 3) return "medal medal--bronze";
  return "medal";
}

function density(count: number): "hero" | "list" | "dense" {
  if (count <= 3) return "hero";
  if (count <= 6) return "list";
  return "dense";
}

export function buildHallOfFameHtml(doc: HallOfFameDocument): string {
  const mode = density(doc.entries.length);
  const rows = doc.entries.map((entry) => `
    <li class="entry entry--rank-${Math.min(entry.rank ?? 99, 4)}">
      <span class="${medalClass(entry.rank ?? 0)}">${entry.rank ?? ""}<small>등</small></span>
      <span class="name">${escapeHtml(entry.studentName)}</span>
      ${doc.showScores
        ? `<span class="score">${escapeHtml(formatRankingScore(entry.score))}<small>/${escapeHtml(formatRankingScore(entry.maxScore))}점</small></span>`
        : ""}
    </li>`).join("");
  const empty = doc.entries.length === 0
    ? `<p class="empty">확정된 점수가 있는 학생이 없습니다.</p>`
    : "";
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>명예의 전당</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #1f2937;
    font-family: "Pretendard", "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 182mm; min-height: 269mm; margin: 0 auto; padding: 10mm 6mm 8mm;
    border: 2.5mm solid #c8a24a; border-radius: 4mm; display: flex; flex-direction: column; }
  header { text-align: center; margin-bottom: ${mode === "dense" ? "6mm" : "10mm"}; }
  .eyebrow { font-size: 13pt; letter-spacing: 0.4em; color: #8a6d1f; font-weight: 700; }
  h1 { margin: 2mm 0 3mm; font-size: ${mode === "hero" ? "44pt" : "38pt"}; letter-spacing: 0.12em; color: #111827; }
  .subtitle { font-size: 14pt; color: #374151; font-weight: 600; }
  .subtitle span + span::before { content: "·"; margin: 0 2.5mm; color: #9ca3af; }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column;
    gap: ${mode === "hero" ? "7mm" : mode === "list" ? "4.5mm" : "2.6mm"}; flex: 1; }
  .entry { display: flex; align-items: center; gap: 6mm; border-radius: 3mm;
    padding: ${mode === "hero" ? "7mm 8mm" : mode === "list" ? "4.5mm 7mm" : "2.6mm 6mm"};
    background: #f9fafb; border: 0.4mm solid #e5e7eb; break-inside: avoid; }
  .entry--rank-1 { background: #fff8e1; border-color: #e7c35a; }
  .entry--rank-2 { background: #f3f4f6; border-color: #c7ccd4; }
  .entry--rank-3 { background: #fbefe6; border-color: #dfae86; }
  .medal { flex: none; display: inline-flex; align-items: baseline; justify-content: center;
    width: ${mode === "hero" ? "24mm" : mode === "list" ? "18mm" : "14mm"};
    height: ${mode === "hero" ? "24mm" : mode === "list" ? "18mm" : "14mm"};
    line-height: ${mode === "hero" ? "24mm" : mode === "list" ? "18mm" : "14mm"};
    border-radius: 50%; background: #e5e7eb; color: #374151; font-weight: 800;
    font-size: ${mode === "hero" ? "26pt" : mode === "list" ? "19pt" : "14pt"}; }
  .medal small { font-size: 45%; margin-left: 0.5mm; }
  .medal--gold { background: #e2b33b; color: #fff; }
  .medal--silver { background: #9aa3ae; color: #fff; }
  .medal--bronze { background: #c07a46; color: #fff; }
  .name { flex: 1; min-width: 0; font-weight: 800; color: #111827; word-break: keep-all; overflow-wrap: anywhere;
    font-size: ${mode === "hero" ? "34pt" : mode === "list" ? "26pt" : "19pt"}; }
  .score { flex: none; font-weight: 700; color: #374151;
    font-size: ${mode === "hero" ? "22pt" : mode === "list" ? "17pt" : "13pt"}; }
  .score small { font-size: 60%; color: #6b7280; margin-left: 1mm; font-weight: 600; }
  .empty { text-align: center; font-size: 16pt; color: #6b7280; margin-top: 30mm; }
  footer { margin-top: 6mm; text-align: right; font-size: 10pt; color: #9ca3af; }
</style>
</head>
<body>
  <main class="page">
    <header>
      <div class="eyebrow">TOP ${doc.topN}</div>
      <h1>명예의 전당</h1>
      <div class="subtitle"><span>${escapeHtml(doc.lectureTitle)}</span><span>${escapeHtml(doc.periodLabel)}</span><span>${escapeHtml(doc.scopeLabel)}</span></div>
    </header>
    <ol>${rows}</ol>
    ${empty}
    <footer>${escapeHtml(doc.printedAt)} 기준</footer>
  </main>
</body>
</html>`;
}

export type ExamRow = {
  id: number; student_id: number; name: string; school: string; grade: number | null;
  score: number | null; maximum: number | null; status: string;
};

export type ExamQuestionMarks = {number:number; topic:string; graded_ids:number[]; correct_ids:number[]};

export function questionRates(questions: ExamQuestionMarks[], rows: ExamRow[]) {
  const selected = new Set(rows.map(row => row.id));
  return questions.map(question => {
    const graded = question.graded_ids.filter(id => selected.has(id)).length;
    const correct = question.correct_ids.filter(id => selected.has(id)).length;
    return {number:question.number, topic:question.topic, graded, rate:graded ? correct / graded * 100 : null};
  });
}

export const examFilters = ["examSchool", "examGrade", "examState", "examBand"] as const;
export type ExamFilter = typeof examFilters[number];
export const examBandLabel = (index: number) => index === 4 ? "80–100%" : `${index * 20}–${(index + 1) * 20}% 미만`;
export const examSchool = (row: ExamRow) => row.school ? "school:" + row.school : "missing";
export const examGrade = (row: ExamRow) => row.grade == null ? "missing" : String(row.grade);
const rate = (row: ExamRow) => row.score != null && row.maximum != null && row.maximum > 0
  ? Math.max(0, Math.min(100, row.score / row.maximum * 100)) : null;
const band = (value: number) => Math.max(0, Math.min(4, Math.floor(value / 20)));

export function examCohort(roster: ExamRow[], filters: URLSearchParams, percent?: number | null) {
  const school = filters.get("examSchool"), grade = filters.get("examGrade"), status = filters.get("examState");
  const range = filters.get("examBand");
  const base = roster.filter(row => (!school || examSchool(row) === school) && (!grade || examGrade(row) === grade)
    && (!status || row.status === status));
  const ranked = range !== "top" ? [] : base.flatMap(row => {
    const value = rate(row);
    return value === null ? [] : [{id:row.id, value}];
  }).sort((a,b) => b.value - a.value || a.id - b.id);
  const topCount = percent && percent >= 1 && percent <= 100 ? Math.ceil(ranked.length * percent / 100) : 0;
  const top = new Set(ranked.slice(0,topCount).map(row => row.id));
  const rows = base.filter(row => {
    if (!range) return true;
    if (range === "top") return top.has(row.id);
    const value = rate(row);
    return value != null && String(band(value)) === range;
  });
  const distribution = [0,0,0,0,0];
  let sum = 0, count = 0, highest: number | null = null, lowest: number | null = null;
  for (const row of rows) {
    if (row.score == null) continue;
    count++;
    sum += row.score;
    highest = highest == null ? row.score : Math.max(highest, row.score);
    lowest = lowest == null ? row.score : Math.min(lowest, row.score);
    const value = rate(row);
    if (value != null) distribution[band(value)]++;
  }
  return {rows, distribution, count, average: count ? sum/count : null, highest, lowest};
}

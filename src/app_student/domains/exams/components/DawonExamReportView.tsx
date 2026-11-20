import type { ReactNode } from "react";
import type { DawonExamReport } from "../api/results";
import styles from "./DawonExamReportView.module.css";

const number = new Intl.NumberFormat("ko-KR", {maximumFractionDigits: 2});
const value = (n: number | null, unit = "") => n === null ? "미집계" : number.format(n) + unit;
const score = (n: number | null, maximum: number | null) =>
  n === null ? "미집계" : value(n) + (maximum == null ? "점" : " / " + value(maximum, "점"));

function ReportTable({label, columns, rows}: {label: string; columns: string[]; rows: ReactNode[][]}) {
  return <div className={styles.tableWrap} role="region" aria-label={label} tabIndex={0}>
    <table aria-label={label}>
      <thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i}>
        <th scope="row">{row[0]}</th>{row.slice(1).map((cell, j) => <td key={j}>{cell}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

const trendSeries = [
  {key: "score", label: "내 점수", dash: undefined},
  {key: "average", label: "평균", dash: "5 3"},
  {key: "highest", label: "최고점", dash: "1 3"},
] as const;

function TrendChart({rows}: {rows: DawonExamReport["trend"]}) {
  if (!rows.some(row => row.maximum != null && row.maximum > 0 && trendSeries.some(({key}) => row[key] != null))) return null;
  const x = (i: number) => rows.length === 1 ? 165 : 31 + i * 267 / (rows.length - 1);
  const point = (row: typeof rows[number], key: typeof trendSeries[number]["key"]) =>
    row.maximum != null && row.maximum > 0 && row[key] != null
      ? 108 - Math.min(1, Math.max(0, row[key] / row.maximum)) * 95 : null;
  return <figure className={styles.chart}>
    <figcaption>회차별 점수 · 만점 대비 비율</figcaption>
    <svg viewBox="0 0 310 132" role="img" aria-label="회차별 내 점수·평균·최고점 추이. 수치는 아래 표에서 확인할 수 있습니다.">
      {[0, 50, 100].map(n => <g key={n}>
        <line x1={30} x2={299} y1={108 - .95 * n} y2={108 - .95 * n} className={styles.gridLine} />
        <text x={25} y={111 - .95 * n} textAnchor="end">{n}%</text>
      </g>)}
      {trendSeries.map(({key, dash}) => {
        let nextStartsLine = true;
        const points = rows.map((row, i) => {
          const y = point(row, key);
          if (y === null) { nextStartsLine = true; return null; }
          const command = nextStartsLine ? "M" : "L";
          nextStartsLine = false;
          return {x: x(i), y, command};
        });
        return <g key={key} className={styles[key]}>
          <path d={points.map(p => p ? p.command + p.x + " " + p.y : "").join(" ")}
            fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray={dash} />
          {points.map((p, i) => p && <circle key={i} cx={p.x} cy={p.y} r={2.4} fill="currentColor" />)}
        </g>;
      })}
      <text x={31} y={126}>첫 회차</text><text x={299} y={126} textAnchor="end">최근 회차</text>
    </svg>
    <div className={styles.legend}>{trendSeries.map(series =>
      <span key={series.key} className={styles[series.key]}>{series.label}</span>)}</div>
  </figure>;
}

export default function DawonExamReportView({report}: {report: DawonExamReport}) {
  const questionNumbers = (items: number[]) => items.length ? items.map(n => n + "번").join(", ") : "없음";
  const hasPercentile = report.kind === "school_mock" || report.trend.some(row => row.percentile !== null);
  return <article className={styles.report} aria-label={report.title}>
    <header>
      <p>{[report.course_title, report.lesson_title, report.date].filter(Boolean).join(" · ")}</p>
      <h2>{report.title}</h2>
      {report.scope && <p>시험 범위 · {report.scope}</p>}
    </header>
    {report.sections.map(section => <section key={section.exam_id}>
      <h3>{section.title}</h3>
      {section.scope && section.scope !== report.scope && <p>{section.scope}</p>}
      <dl className={styles.scores}>
        <div><dt>내 점수</dt><dd>{score(section.score, section.maximum)}</dd></div>
        <div><dt>평균</dt><dd>{value(section.average, "점")}</dd></div>
        <div><dt>최고점</dt><dd>{value(section.highest, "점")}</dd></div>
        {report.kind === "school_mock" || section.percentile != null
          ? <div><dt>백분위</dt><dd>{value(section.percentile)}</dd></div> : null}
      </dl>
      {section.questions.length > 0 && <ReportTable label={section.title + " 문항별 분석"}
        columns={["문항", "출제 주제", "내 결과", "정답률"]}
        rows={section.questions.map(q => [q.number + "번", q.topic || "미등록",
          q.correct === null ? "미채점" : q.correct ? "정답 (O)" : "오답 (X)", value(q.correct_rate, "%")])} />}
    </section>)}
    {report.trend.length > 0 && <section>
      <h3>회차별 성적 추이</h3>
      <TrendChart rows={report.trend} />
      <ReportTable label="회차별 성적 추이" columns={["회차", "내 점수", "평균", "최고점", ...(hasPercentile ? ["백분위"] : [])]}
        rows={report.trend.map(row => [row.label, score(row.score, row.maximum), value(row.average, "점"),
          value(row.highest, "점"), ...(hasPercentile ? [value(row.percentile)] : [])])} />
    </section>}
    {report.homework.length > 0 && <section>
      <h3>과제 이력</h3>
      <ReportTable label="과제 이력" columns={["과제", "완료율", "오답", "미완료"]}
        rows={report.homework.map(row => [row.title, value(row.completion, "%"), row.completion === null && !row.wrong.length ? "미집계" : questionNumbers(row.wrong),
          row.completion === null && !row.unfinished.length ? "미집계" : questionNumbers(row.unfinished)])} />
    </section>}
    {report.next_homework && <section><h3>다음 과제</h3><p>{report.next_homework}</p></section>}
    {report.clinic && <section><h3>클리닉 안내</h3><p>{report.clinic}</p></section>}
  </article>;
}

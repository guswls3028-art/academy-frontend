import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
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

const schoolSeries = [
  {key: "score", label: "내 원점수", dash: undefined},
  {key: "average", label: "응시생 평균", dash: "5 3"},
  {key: "percentile", label: "내 백분위", dash: "2 3"},
] as const;

function TrendChart({rows, school}: {rows: DawonExamReport["trend"]; school: boolean}) {
  const series = school ? schoolSeries : trendSeries;
  const rounds = school ? rows.filter(row => row.score != null).slice(-8) : rows;
  if (!rounds.some(row => series.some(({key}) => row[key] != null))) return null;
  const scoreCeiling = school ? Math.max(1, ...rounds.map(row => Math.max(row.maximum ?? 0, row.score ?? 0, row.average ?? 0))) : 100;
  const end = school ? 282 : 299;
  const x = (i: number) => rounds.length === 1 ? (31 + end) / 2 : 31 + i * (end - 31) / (rounds.length - 1);
  const caption = school ? "최근 응시 회차 성적 추이 (최대 8회)" : "회차별 점수 · 만점 대비 비율";
  return <figure className={styles.chart}>
    <figcaption>{caption}</figcaption>
    <svg viewBox="0 0 316 132" role="img" aria-label={school
      ? "왼쪽은 원점수와 평균(점), 오른쪽은 학생 백분위(%)입니다. 회차별 값은 아래 표에서 확인할 수 있습니다."
      : "회차별 내 점수·평균·최고점 추이. 수치는 아래 표에서 확인할 수 있습니다."}>
      {[0, 50, 100].map(n => <g key={n}>
        <line x1={30} x2={end} y1={108 - .95 * n} y2={108 - .95 * n} className={styles.gridLine} />
        <text x={25} y={111 - .95 * n} textAnchor="end">{school ? value(scoreCeiling * n / 100, "점") : n + "%"}</text>
        {school && <text x={end + 5} y={111 - .95 * n}>{n}%</text>}
      </g>)}
      {series.map(({key, dash, label}) => {
        let nextStartsLine = true;
        const points = rounds.map((row, i) => {
          const raw = row[key];
          const scale = school ? (key === "percentile" ? 100 : scoreCeiling) : row.maximum;
          if (raw == null || !scale) { nextStartsLine = true; return null; }
          const y = 108 - Math.min(1, Math.max(0, raw / scale)) * 95;
          const command = nextStartsLine ? "M" : "L";
          nextStartsLine = false;
          return {x: x(i), y, command, raw};
        });
        return <g key={key} className={styles[key]} data-series={key}>
          <path d={points.map(p => p ? p.command + p.x + " " + p.y : "").join(" ")}
            fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray={dash} />
          {points.map((p, i) => p && <circle key={i} cx={p.x} cy={p.y} r={2.4} fill="currentColor">
            <title>{rounds[i].label + " · " + label + " " + value(p.raw, key === "percentile" ? "%" : "점")}</title>
          </circle>)}
        </g>;
      })}
      {school ? rounds.map((row, i) => <text key={i} x={x(i)} y={126} textAnchor="middle">
        {row.sequence != null ? row.sequence + "회" : row.label.match(/\d+회$/)?.[0] ?? row.label}
      </text>) : <><text x={31} y={126}>첫 회차</text><text x={299} y={126} textAnchor="end">최근 회차</text></>}
    </svg>
    <div className={styles.legend}>{series.map(series =>
      <span key={series.key} className={styles[series.key]}>{series.label}</span>)}</div>
  </figure>;
}

function QuestionAnalysis({section}: {section: DawonExamReport["sections"][number]}) {
  const [wrongOnly,setWrongOnly] = useState(false);
  const questions = section.questions;
  const wrong = questions.filter(q => q.correct === false);
  const correct = questions.filter(q => q.correct === true).length;
  const pending = questions.length - correct - wrong.length;
  const visible = wrongOnly ? wrong : questions;
  if (!questions.length) return null;
  return <div className={styles.questions}>
    <div className={styles.questionHead}><h4>문항별 분석</h4>
      <label><input type="checkbox" checked={wrongOnly} onChange={event=>setWrongOnly(event.target.checked)}/> 오답만 보기</label></div>
    <p role="status">전체 {questions.length}문항 · 정답 {correct} · 오답 {wrong.length}{pending > 0 && ` · 미채점 ${pending}`}</p>
    {visible.length ? <ReportTable label={section.title + " 문항별 분석"}
      columns={["문항", "출제 주제", "내 결과", "정답률"]}
      rows={visible.map(q => [q.number + "번", q.topic || "미등록",
        q.correct === null ? "미채점" : q.correct ? "정답 (O)" : "오답 (X)", value(q.correct_rate, "%")])}/>
      : <p>채점된 문항에서 오답이 없습니다.</p>}
  </div>;
}

export default function DawonExamReportView({report}: {report: DawonExamReport}) {
  const location = useLocation();
  const questionNumbers = (items: number[]) => items.length ? items.map(n => n + "번").join(", ") : "없음";
  const hasPercentile = report.kind === "school_mock" || report.trend.some(row => row.percentile !== null);
  const attempts = report.trend.filter(row => row.score !== null);
  const totalsByMaximum = new Map<number | null,{sum:number; count:number}>();
  for (const row of attempts) {
    const total = totalsByMaximum.get(row.maximum) ?? {sum:0,count:0};
    total.sum += row.score ?? 0;
    total.count++;
    totalsByMaximum.set(row.maximum,total);
  }
  return <article className={styles.report} aria-label={report.title}>
    <header>
      <p>{[report.course_title, report.lesson_title, report.date].filter(Boolean).join(" · ")}</p>
      <h2>{report.title}</h2>
      {report.scope && <p>시험 범위 · {report.scope}</p>}
      {report.characteristics && <p>테스트 특성 · {report.characteristics}</p>}
    </header>
    {report.sections.map(section => <section key={section.exam_id}>
      <h3>{section.title}</h3>
      {section.scope && section.scope !== report.scope && <p>{section.scope}</p>}
      <dl className={styles.scores}>
        <div><dt>내 점수</dt><dd>{score(section.score, section.maximum)}</dd></div>
        <div><dt>응시생 평균</dt><dd>{value(section.average, "점")}</dd></div>
        <div><dt>응시생 최고점</dt><dd>{value(section.highest, "점")}</dd></div>
        {report.kind === "school_mock" || section.percentile != null
          ? <div><dt>백분위</dt><dd>{value(section.percentile,"%")}</dd></div> : null}
      </dl>
      {section.percentile != null && <p className={styles.scoreNote}>백분위는 이 강의의 채점 완료 학생 중 내 점수 이하인 학생의 비율입니다.</p>}
      <QuestionAnalysis section={section}/>
    </section>)}
    {report.trend.length > 0 && <section>
      <h3>회차별 성적 추이</h3>
      <dl className={styles.scores} aria-label="누적 성적 요약">
        <div><dt>응시 횟수</dt><dd>{attempts.length}회</dd></div>
        {[...totalsByMaximum].map(([maximum,total]) => <div key={maximum ?? "unknown"}>
          <dt>{maximum != null ? number.format(maximum)+"점 만점 원점수 평균" : "원점수 평균"}</dt>
          <dd>{value(total.sum / total.count,"점")}</dd>
        </div>)}
      </dl>
      <TrendChart rows={report.trend} school={report.kind === "school_mock"} />
      <ReportTable label="회차별 성적 추이" columns={["회차", "내 점수", "평균", "최고점", ...(hasPercentile ? ["백분위"] : [])]}
        rows={report.trend.map(row => [row.exam_id && location.pathname !== `/student/exams/${row.exam_id}/result`
          ? <Link to={`/student/exams/${row.exam_id}/result${location.search}`} aria-label={row.label+" 성적표 보기"}>{row.label}</Link>
          : row.label, row.attempt_status === "absent" ? "미응시" : row.attempt_status === "pending" ? "채점 대기" : score(row.score, row.maximum), value(row.average, "점"),
          value(row.highest, "점"), ...(hasPercentile ? [value(row.percentile,"%")] : [])])} />
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

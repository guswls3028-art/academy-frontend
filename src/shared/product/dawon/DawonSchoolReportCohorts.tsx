import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router";
import { resolveTenantCodeString } from "@/shared/tenant";
import api from "@/shared/api/axios";
import { fetchSchoolReport, schoolReportKeys, type SchoolReportPeriod } from "@/shared/api/contracts/schoolReports";
import SchoolReportPeriodPicker from "@/shared/product/schoolReports/SchoolReportPeriodPicker";
import SchoolReportScoreList from "@/shared/product/schoolReports/SchoolReportScoreList";
import { currentSchoolReportPeriod } from "@/shared/product/schoolReports/period";
import { Button } from "@/shared/ui/ds";
import styles from "./DawonSchoolReportCohorts.module.css";

type Scope = { school: string; grade: number | null };
type Cohort = Scope & { student_count: number; subjects: { subject: string; count: number; average: number }[] };
type Student = { id: number; name: string };
type Report = { cohorts: Cohort[]; students: Student[] };

function StudentScores({ id, period }: { id: number; period: SchoolReportPeriod }) {
  const detail = useQuery({
    queryKey: schoolReportKeys.detail(id, period),
    queryFn: ({ signal }) => fetchSchoolReport(id, period, signal),
  });
  if (detail.isPending) return <p role="status">학생 성적표를 불러오는 중입니다.</p>;
  if (detail.isError) return <p role="alert">학생 성적표를 불러오지 못했습니다. <Button onClick={() => void detail.refetch()}>다시 시도</Button></p>;
  return <section aria-label={detail.data.student_name + " 성적표"}><h4>{detail.data.student_name} 성적표</h4>
    <SchoolReportScoreList scores={detail.data.scores} /></section>;
}

export function Cohorts({ period, classGroup }: { period: SchoolReportPeriod; classGroup?: number }) {
  const [scope, setScope] = useState<Scope | null>(null);
  const [student, setStudent] = useState<number | null>(null);
  const report = useQuery({
    queryKey: schoolReportKeys.dawonCohorts(period, scope, classGroup),
    queryFn: async ({ signal }) => (await api.get<Report>("/results/school-reports/", { signal, params: {
      ...period, class_group: classGroup, view: "cohorts", ...(scope ? { cohort_school: scope.school, cohort_grade: scope.grade ?? "" } : {}),
    } })).data,
  });
  function changeScope(value: Scope | null) {
    setStudent(null);
    setScope(value);
  }
  if (report.isPending) return <p role="status">학교별 집계를 불러오는 중입니다.</p>;
  if (report.isError) return <p role="alert">학교별 집계를 불러오지 못했습니다. <Button onClick={() => void report.refetch()}>다시 시도</Button></p>;
  const cohorts = report.data.cohorts;
  if (!cohorts.length) return <p>이 회차에 제출된 학교 성적표가 없습니다.</p>;
  const names = [...new Set(cohorts.map((row) => row.school))];
  const rows = scope ? cohorts.filter((row) => row.school === scope.school && row.grade === scope.grade) : cohorts;
  return <>
    <div className={styles.filters}>
      <label>학교 <select value={scope ? names.indexOf(scope.school) : -1} onChange={(event) => {
        const name = names[Number(event.target.value)];
        changeScope(name === undefined ? null : cohorts.find((row) => row.school === name) ?? null);
      }}>
        <option value={-1}>전체 학교</option>
        {names.map((name, index) => <option key={name} value={index}>{name || "학교·학년 미확인"}</option>)}
      </select></label>
      {scope?.school && <label>학년 <select value={scope.grade ?? ""} onChange={(event) =>
        changeScope({ school: scope.school, grade: Number(event.target.value) })}>
        {cohorts.filter((row) => row.school === scope.school).map((row) => <option key={row.grade} value={row.grade ?? ""}>{row.grade}학년</option>)}
      </select></label>}
    </div>
    {rows.map((row) => <article className={styles.cohort} key={JSON.stringify([row.school, row.grade])}>
      <h3>{row.school ? row.school + " " + row.grade + "학년" : "학교·학년 미확인"}</h3>
      <ul>{row.subjects.map((item) => <li key={item.subject}>{item.subject} 평균 {Number(item.average).toFixed(1)}점 <small>({item.count}명)</small></li>)}</ul>
      {!scope && <Button intent="secondary" onClick={() => changeScope(row)}>제출 학생 {row.student_count}명 보기</Button>}
    </article>)}
    {scope && <>
      <Button intent="secondary" onClick={() => changeScope(null)}>전체 학교 보기</Button>
      <label>학생 성적표 <select value={student ?? ""} onChange={(event) => setStudent(Number(event.target.value) || null)}>
        <option value="">학생 선택</option>
        {report.data.students.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>
      {student && <StudentScores id={student} period={period} />}
    </>}
  </>;
}

export default function DawonSchoolReportCohorts() {
  const [period, setPeriod] = useState<SchoolReportPeriod>(currentSchoolReportPeriod);
  if (resolveTenantCodeString() !== "dawon") return <Navigate to="/workspace/students/surveys" replace />;
  return <section className={styles.page}>
    <Link to="/workspace/students/surveys">설문·성적 취합으로 돌아가기</Link>
    <h2>학교별 제출 성적</h2>
    <p>학생이 제출한 과목별 점수를 100점으로 환산한 평균입니다.</p>
    <SchoolReportPeriodPicker period={period} onChange={setPeriod} />
    <Cohorts key={JSON.stringify(period)} period={period} />
  </section>;
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router";
import api from "@/shared/api/axios";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import { Button } from "@/shared/ui/ds";
import styles from "./DawonOperations.module.css";

type Position = "INSTRUCTOR" | "ASSISTANT";
type Exam = {id: number; title: string; graded: number; average: number | null};
type Lesson = {id: number; order: number; title: string; date: string | null};
type Course = {
  id: number; title: string; is_active: boolean; students: number; lessons: number;
  instructor: string; sessions: Lesson[]; exams: Exam[];
  homework: {id: number; title: string; session_id: number; status: "DRAFT" | "OPEN" | "CLOSED"; progress: {assigned: number; submitted: number; missing: number; graded: number; deferred: number}}[];
};
type Operations = {
  groups: {id: number | null; name: string; members: number | null; courses: Course[]}[];
  employee: {name: string; position: Position} | null;
  exams: Exam[];
};
const tabs = [
  {key: "dashboard", label: "반 운영 현황", path: "/workspace/dashboard"},
  {key: "staff", label: "직원 관리", path: "/workspace/staff"},
  {key: "results", label: "시험 결과", path: "/workspace/results"},
];
const endpoint = "/students/demo-operations/";
const queryKey = ["dawon", "admin", "operations"] as const;

function CourseDetails({course}: {course: Course}) {
  const sections = ["수업 차시", "시험 결과", "과제 현황"] as const;
  const [section, setSection] = useState<typeof sections[number]>("수업 차시");
  const lessonNames = new Map(course.sessions.map(lesson => [lesson.id, lesson.title || `${lesson.order}차시`]));
  return <details name="dawon-active-course" className={styles.course}>
    <summary><strong>{course.title}</strong><span>{course.instructor ? `담당 ${course.instructor}` : "담당 미지정"} · {course.is_active ? "운영 중" : "종료"} · 수강생 {course.students}명 · 차시 {course.lessons}개</span></summary>
    <div className={styles.detailBody}>
      <div role="group" aria-label="강의 상세 항목" className={styles.sectionPicker}>
        {sections.map(label => <button type="button" key={label} aria-pressed={section === label} onClick={() => setSection(label)}>{label}</button>)}
      </div>
      {section === "수업 차시" && <>
      {course.sessions.length ? <ul>{course.sessions.map(lesson => <li key={lesson.id}>
        <strong>{lessonNames.get(lesson.id)}</strong><span>{lesson.date || "일정 미정"}</span>
      </li>)}</ul> : <p>등록된 차시가 없습니다.</p>}
      </>}
      {section === "시험 결과" && <>
      {course.exams.length ? <ul>{course.exams.map(exam => <li key={exam.id}>
        <strong>{exam.title}</strong><span>{exam.average === null ? "채점 대기" : `채점 ${exam.graded}건 · 평균 ${Number(exam.average.toFixed(1))}점`}</span>
      </li>)}</ul> : <p>연결된 시험이 없습니다.</p>}
      </>}
      {section === "과제 현황" && <>
      {course.homework.length ? <ul>{course.homework.map(item => <li key={item.id}>
        <strong>{item.title}</strong><span>{lessonNames.get(item.session_id)} · {{DRAFT: "초안", OPEN: "진행 중", CLOSED: "마감"}[item.status]}</span>
        <small className={styles.progress}>{item.progress.assigned ? `대상 ${item.progress.assigned}명 · 제출 ${item.progress.submitted}명 · 미제출 ${item.progress.missing}명 · 채점 ${item.progress.graded}명${item.progress.deferred ? ` · 검사 보류 ${item.progress.deferred}명` : ""}` : "배정된 수강생이 없습니다."}</small>
      </li>)}</ul> : <p>등록된 과제가 없습니다.</p>}
      </>}
    </div>
  </details>;
}

export default function DawonOperations() {
  const location = useLocation();
  const tab = tabs.find(item => item.path === location.pathname) ?? tabs[0];
  const client = useQueryClient();
  const [position, setPosition] = useState<Position | null>(null);
  const query = useQuery({queryKey, queryFn: async () => (await api.get<Operations>(endpoint)).data});
  const mutation = useMutation({
    mutationFn: (value: Position) => api.patch(endpoint, {position: value}),
    onSuccess: async () => {
      await client.invalidateQueries({queryKey});
      setPosition(null);
    },
  });
  const [groupKey, setGroupKey] = useState("");
  const data = query.data;
  const groups = data?.groups ?? [];
  const group = groups.find(item => String(item.id) === groupKey) ?? groups[0];
  return <DomainLayout title="관리자앱" tabs={tabs} breadcrumbs={[]}>
    {query.isPending ? <p role="status">운영 현황을 불러오는 중입니다.</p> :
      query.isError || !data ? <p role="alert">운영 현황을 불러오지 못했습니다. <Button onClick={() => void query.refetch()}>다시 시도</Button></p> :
      <section className={styles.section} aria-label={tab.label}>
        {tab.key === "dashboard" && <>
          <h2>반 운영 현황</h2>
          {group && <><label className={styles.groupPicker}>반 선택
            <select aria-label="반 선택" value={String(group.id)} onChange={e => setGroupKey(e.target.value)}>
              {groups.map(item => <option key={String(item.id)} value={String(item.id)}>{item.name}</option>)}
            </select>
          </label><article className={styles.group} key={group.id ?? "ungrouped"}>
            <h3>{group.name}</h3>
            <p>{group.members !== null && `반 학생 ${group.members}명 · `}강의 {group.courses.length}개</p>
            {group.courses.map(course => <CourseDetails key={course.id} course={course} />)}
            {!group.courses.length && <p>연결된 강의가 없습니다.</p>}
          </article></>}
          {!data.groups.length && <p>등록된 반이 없습니다.</p>}
        </>}
        {tab.key === "staff" && <>
          <h2>직원 관리</h2>
          {data.employee ? <form onSubmit={e => {e.preventDefault(); if (position) mutation.mutate(position);}}>
            <strong>{data.employee.name}</strong>
            <label>직위 <select value={position ?? data.employee.position} onChange={e => {setPosition(e.target.value as Position); mutation.reset();}}>
              <option value="INSTRUCTOR">강사</option><option value="ASSISTANT">조교</option>
            </select></label>
            <Button type="submit" disabled={!position || position === data.employee.position || mutation.isPending}>저장</Button>
            {mutation.isSuccess && <span role="status">직위를 저장했습니다.</span>}
            {mutation.isError && <span role="alert">직위를 저장하지 못했습니다. 다시 시도해 주세요.</span>}
          </form> : <p>등록된 체험 직원이 없습니다.</p>}
        </>}
        {tab.key === "results" && <>
          <h2>시험별 채점 현황</h2>
          <ul>{data.exams.map(row => <li key={row.id}><strong>{row.title}</strong>
            <span>{row.average == null ? "채점 대기" : `채점 ${row.graded}건 · 평균 ${Number(row.average.toFixed(1))}점`}</span></li>)}</ul>
          {!data.exams.length && <p>등록된 시험 결과가 없습니다.</p>}
        </>}
      </section>}
  </DomainLayout>;
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router";
import api from "@/shared/api/axios";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import { Button } from "@/shared/ui/ds";
import styles from "./DawonOperations.module.css";

type Position = "INSTRUCTOR" | "ASSISTANT";
type Operations = {
  groups: {id: number | null; name: string; members: number | null; courses: {id: number; title: string; is_active: boolean; students: number; lessons: number}[]}[];
  employee: {name: string; position: Position} | null;
  exams: {id: number; title: string; graded: number; average: number | null}[];
};
const tabs = [
  {key: "dashboard", label: "반 운영 현황", path: "/workspace/dashboard"},
  {key: "staff", label: "직원 관리", path: "/workspace/staff"},
  {key: "results", label: "시험 결과", path: "/workspace/results"},
];
const endpoint = "/students/demo-operations/";
const queryKey = ["dawon", "admin", "operations"] as const;

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
  const data = query.data;
  return <DomainLayout title="관리자앱" tabs={tabs} breadcrumbs={[]}>
    {query.isPending ? <p role="status">운영 현황을 불러오는 중입니다.</p> :
      query.isError || !data ? <p role="alert">운영 현황을 불러오지 못했습니다. <Button onClick={() => void query.refetch()}>다시 시도</Button></p> :
      <section className={styles.section} aria-label={tab.label}>
        {tab.key === "dashboard" && <>
          <h2>반 운영 현황</h2>
          {data.groups.map(group => <article className={styles.group} key={group.id ?? "ungrouped"}>
            <h3>{group.name}</h3>
            <p>{group.members !== null && `반 학생 ${group.members}명 · `}강의 {group.courses.length}개</p>
            <ul>{group.courses.map(row => <li key={row.id}><strong>{row.title}</strong>
              <span>{row.is_active ? "운영 중" : "종료"} · 수강생 {row.students}명 · 차시 {row.lessons}개</span></li>)}</ul>
          </article>)}
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

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import DomainTable from "@/shared/ui/domain/DomainTable";
import DomainListToolbar from "@/shared/ui/domain/DomainListToolbar";
import { Button } from "@/shared/ui/ds";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import styles from "./DawonStaff.module.css";

const endpoint = "/students/demo-staff/";
const directoryKey = ["dawon", "admin", "staff-directory"] as const;
const monthKey = (id: number, month: string) => [...directoryKey, id, month] as const;
const labels = {DIRECTOR: "분원장", INSTRUCTOR: "강사", ASSISTANT: "조교", STAFF: "직원"};
type Position = keyof typeof labels;
type Staff = {id: number; name: string; position: Position; classes: string[]};
type Month = {
  open_count: number;
  records: {id: number; date: string; start_time: string; end_date: string | null; end_time: string | null; work_hours: number | null; amount: number | null}[];
  payroll: {state: "confirmed" | "estimate" | "missing"; hours: number | null; work: number | null; expenses: number | null; total: number | null};
};
const won = (amount: number | null) => amount == null ? "미확정" : Number(amount).toLocaleString("ko-KR") + "원";
const currentMonth = () => new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit"}).format(new Date());
function retryButton(retry: () => void) { return <Button onClick={retry}>다시 시도</Button>; }

function MonthDetail({staff, month, onMonth}: {staff: Staff; month: string; onMonth: (value: string) => void}) {
  const client = useQueryClient();
  const [position, setPosition] = useState<Position>(staff.position);
  const query = useQuery({queryKey: monthKey(staff.id, month), queryFn: async ({signal}) =>
    (await api.get<Month>(endpoint, {params: {staff: staff.id, month}, signal})).data});
  const mutation = useMutation({mutationFn: () => api.patch(endpoint, {staff: staff.id, position}),
    onSuccess: () => client.invalidateQueries({queryKey: directoryKey, exact: true})});
  const data = query.data;
  return <>
    <h2>{staff.name}</h2>
    {["INSTRUCTOR","ASSISTANT"].includes(staff.position) ? <form onSubmit={e => {e.preventDefault();mutation.mutate();}}>
      <label>직위 <select value={position} onChange={e => {setPosition(e.target.value as Position);mutation.reset();}}>
        <option value="INSTRUCTOR">강사</option><option value="ASSISTANT">조교</option></select></label>
      <Button type="submit" disabled={position === staff.position || mutation.isPending}>저장</Button>
      {mutation.isSuccess && <span role="status">직위를 저장했습니다.</span>}
      {mutation.isError && <span role="alert">{getApiErrorMessage(mutation.error,"직위를 저장하지 못했습니다.")}</span>}
    </form> : <p>{labels[staff.position]}</p>}
    <label className={styles.fields}>조회할 월 <input type="month" value={month} onChange={e => {if (e.target.value) onMonth(e.target.value);}} /></label>
    {query.isPending ? <p role="status">근태·급여를 불러오는 중입니다.</p> : query.isError || !data ?
      <p role="alert">근태·급여를 불러오지 못했습니다. {retryButton(() => void query.refetch())}</p> : <>
      <section aria-label="월 급여"><h3>월 급여</h3>
        <strong>{data.payroll.state === "confirmed" ? "마감 확정" : data.payroll.state === "estimate" ? "예상 지급액" : "급여 내역 확인 필요"} · {won(data.payroll.total)}</strong>
        {data.payroll.state !== "missing" && <p>근무 {data.payroll.hours}시간 · 근무 수당 {won(data.payroll.work)} · 승인 경비 {won(data.payroll.expenses)}</p>}
        {data.open_count > 0 && <p>퇴근 전 근무 {data.open_count}건은 예상 금액에 포함되지 않습니다.</p>}
      </section>
      <section aria-label="월 근태 기록"><h3>월 근태 기록</h3>
        {data.records.length ? <ul>{data.records.map(row => <li key={row.id}><strong>{row.date}</strong>
          <span>{row.start_time.slice(0,5)} – {row.end_time ? ((row.end_date && row.end_date !== row.date ? row.end_date + " " : "") + row.end_time.slice(0,5)) : "근무 중"}</span>
          <span>{row.work_hours == null ? "근무시간 미확정" : row.work_hours + "시간"} · {won(row.amount)}</span></li>)}</ul> :
          <p>이달 등록된 근무 기록이 없습니다.</p>}
      </section></>}
  </>;
}

export default function DawonStaffDirectory() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const query = useQuery({queryKey: directoryKey, queryFn: async ({signal}) => (await api.get<{staff: Staff[]}>(endpoint,{signal})).data.staff});
  const selected = params.get("employee");
  const monthValue = params.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[012])$/.test(monthValue) ? monthValue : currentMonth();
  function navigate(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key); else next.set(key,value);
    setParams(next, {replace: key === "month", preventScrollReset: true});
  }
  if (query.isPending) return <p role="status">직원 목록을 불러오는 중입니다.</p>;
  if (query.isError) return <p role="alert">직원 목록을 불러오지 못했습니다. {retryButton(() => void query.refetch())}</p>;
  const staff = query.data ?? [];
  if (selected) {
    const person = staff.find(row => String(row.id) === selected);
    return <div className={styles.staff}><Button onClick={() => navigate("employee",null)}>직원 목록</Button>
      {person ? <MonthDetail key={person.id} staff={person} month={month} onMonth={v => navigate("month",v)} /> :
        <p>조회할 수 없는 직원입니다.</p>}</div>;
  }
  const filtered = staff.filter(row => row.name.includes(search.trim()) || labels[row.position].includes(search.trim()));
  return <div className={styles.staff}>
    <DomainListToolbar totalLabel={`직원 ${filtered.length}명`} primaryAction={null}
      searchSlot={<input type="search" className="ds-input" aria-label="직원 찾기" placeholder="이름 또는 직위" value={search} onChange={e => setSearch(e.target.value)} />} />
    {filtered.length > 0 && <DomainTable scrollLabel="직원 명단"><thead><tr><th scope="col">이름</th><th scope="col">담당 반</th></tr></thead>
      {(["DIRECTOR","INSTRUCTOR","ASSISTANT","STAFF"] as const).map(position => {
        const members = filtered.filter(row => row.position === position);
        return members.length > 0 && <tbody key={position} aria-label={labels[position]}>
          <tr><th colSpan={2} scope="rowgroup">{labels[position]} · {members.length}명</th></tr>
          {members.map(row => <tr key={row.id}>
            <th scope="row"><Button onClick={() => navigate("employee",String(row.id))}>{row.name}</Button></th>
            <td>{row.classes.join(", ") || "담당 반 없음"}</td>
          </tr>)}
        </tbody>;
      })}</DomainTable>}
    {!filtered.length && <p>{staff.length ? "검색 결과가 없습니다." : "등록된 체험 직원이 없습니다."}</p>}
  </div>;
}

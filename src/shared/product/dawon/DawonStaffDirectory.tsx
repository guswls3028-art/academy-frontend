import DawonSearchInput from "./DawonSearchInput";
import { StaffRoleAvatar, type StaffRoleType } from "@/shared/ui/avatars";
import { useEffect, useRef, useState } from "react";
import { AdminModal, ModalBody, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import DomainTable from "@/shared/ui/domain/DomainTable";
import DawonDirectoryTable from "./DawonDirectoryTable";
import { Button } from "@/shared/ui/ds";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import styles from "./DawonStaff.module.css";

import DawonPayroll from "./DawonPayroll";

const endpoint = "/students/demo-staff/";
const directoryKey = ["dawon", "admin", "staff-directory"] as const;
const monthKey = (id: number, month: string) => [...directoryKey, id, month] as const;
const labels = {DIRECTOR: "분원장", INSTRUCTOR: "강사", ASSISTANT: "조교", STAFF: "직원"};
type Position = keyof typeof labels;
const avatarRoles: Record<Position, StaffRoleType> = {DIRECTOR:"owner",INSTRUCTOR:"TEACHER",ASSISTANT:"ASSISTANT",STAFF:"ASSISTANT"};
type Staff = {id: number; name: string; position: Position; classes: string[]};
type Month = {
  open_count: number;
  records: {id: number; date: string; start_time: string; end_date: string | null; end_time: string | null; work_hours: number | null; amount: number | null}[];
  payroll: {state: "confirmed" | "estimate" | "missing"; hours: number | null; work: number | null; expenses: number | null; total: number | null};
};
const won = (amount: number | null) => amount == null ? "미확정" : Number(amount).toLocaleString("ko-KR") + "원";
const currentMonth = () => new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit"}).format(new Date());
function retryButton(retry: () => void) { return <Button onClick={retry}>다시 시도</Button>; }

function MonthDetail({staff, month, onMonth}: {staff: Staff; month: string; onMonth?: (value: string) => void}) {
  const client = useQueryClient();
  const [position, setPosition] = useState<Position>(staff.position);
  const query = useQuery({queryKey: monthKey(staff.id, month), queryFn: async ({signal}) =>
    (await api.get<Month>(endpoint, {params: {staff: staff.id, month}, signal})).data});
  const mutation = useMutation({mutationFn: () => api.patch(endpoint, {staff: staff.id, position}),
    onSuccess: () => client.invalidateQueries({queryKey: directoryKey, exact: true})});
  const data = query.data;
  return <>
    {!onMonth && <h2 className={styles.employeeHeading}><StaffRoleAvatar role={avatarRoles[staff.position]} aria-label={labels[staff.position]} size={24}/>{staff.name}</h2>}
    {onMonth && ["INSTRUCTOR","ASSISTANT"].includes(staff.position) ? <form onSubmit={e => {e.preventDefault();mutation.mutate();}}>
      <label>직위 <select value={position} onChange={e => {setPosition(e.target.value as Position);mutation.reset();}}>
        <option value="INSTRUCTOR">강사</option><option value="ASSISTANT">조교</option></select></label>
      <Button type="submit" disabled={position === staff.position || mutation.isPending}>저장</Button>
      {mutation.isSuccess && <span role="status">직위를 저장했습니다.</span>}
      {mutation.isError && <span role="alert">{getApiErrorMessage(mutation.error,"직위를 저장하지 못했습니다.")}</span>}
    </form> : <p>{labels[staff.position]}</p>}
    {onMonth && <label className={styles.fields}>조회할 월 <input type="month" value={month} onChange={e => {if (e.target.value) onMonth(e.target.value);}} /></label>}
    {query.isPending ? <p role="status">근태·급여를 불러오는 중입니다.</p> : query.isError || !data ?
      <p role="alert">근태·급여를 불러오지 못했습니다. {retryButton(() => void query.refetch())}</p> : <>
      <section aria-label="월 급여"><h3>월 급여</h3>
        <strong>{data.payroll.state === "confirmed" ? "마감 확정" : data.payroll.state === "estimate" ? "예상 지급액" : "급여 내역 확인 필요"} · {won(data.payroll.total)}</strong>
        {data.payroll.state !== "missing" && <p>근무 {data.payroll.hours}시간 · 근무 수당 {won(data.payroll.work)} · 승인 경비 {won(data.payroll.expenses)}</p>}
        {data.open_count > 0 && <p>퇴근 전 근무 {data.open_count}건은 예상 금액에 포함되지 않습니다.</p>}
      </section>
      <section aria-label="월 근태 기록"><h3>월 근태 기록</h3>
        {data.records.length ? <DomainTable scrollLabel="월 근태 내역" tableClassName="ds-table--flat">
          <thead><tr><th>일자</th><th>출퇴근</th><th>근무 시간</th><th>금액</th></tr></thead>
          <tbody>{data.records.map(row => <tr key={row.id}><td>{row.date}</td>
            <td>{row.start_time.slice(0,5)} – {row.end_time ? ((row.end_date && row.end_date !== row.date ? row.end_date + " " : "") + row.end_time.slice(0,5)) : "근무 중"}</td>
            <td>{row.work_hours == null ? "미확정" : row.work_hours + "시간"}</td><td>{won(row.amount)}</td></tr>)}</tbody>
        </DomainTable> : <p>이달 등록된 근무 기록이 없습니다.</p>}
      </section></>}
  </>;
}

export default function DawonStaffDirectory() {
  const [params] = useSearchParams();
  const payroll=params.get("tab")==="payroll";
  const monthValue=params.get("month") || "";
  const month=/^\d{4}-(0[1-9]|1[012])$/.test(monthValue) ? monthValue : currentMonth();
  const tabUrl=(showPayroll:boolean)=>{
    const next=new URLSearchParams(params);
    if(showPayroll) next.set("tab","payroll"); else next.delete("tab");
    next.delete("employee");
    return {search:next.toString()};
  };
  return <><nav className={styles.staffTabs} aria-label="직원 관리 업무">
    <Link to={tabUrl(false)} aria-current={!payroll ? "page" : undefined}>직원 명단</Link>
    <Link to={tabUrl(true)} aria-current={payroll ? "page" : undefined}>월 정산</Link>
  </nav>{payroll ? <DawonPayroll key={month} month={month} labels={labels}
    detail={row=><MonthDetail staff={{id:row.id,name:row.name,position:row.position,classes:[]}} month={month}/>} /> : <StaffMaster/>}</>;
}

function StaffMaster() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const position = params.get("position") ?? "";
  const query = useQuery({queryKey: directoryKey, queryFn: async ({signal}) => (await api.get<{staff: Staff[]}>(endpoint,{signal})).data.staff});
  const selected = params.get("employee");
  const location = useLocation();
  const move = useNavigate();
  const directory = useRef<HTMLElement>(null);
  const priorSelection = useRef<string | null>(null);
  useEffect(() => {
    const prior = priorSelection.current;
    priorSelection.current = selected;
    if (!prior || selected) return;
    const row = directory.current?.querySelector<HTMLAnchorElement>(`[data-employee-id="${CSS.escape(prior)}"]`);
    (row ?? directory.current?.querySelector<HTMLInputElement>("input"))?.focus({preventScroll:true});
  }, [selected]);
  const monthValue = params.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[012])$/.test(monthValue) ? monthValue : currentMonth();
  function navigate(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key); else next.set(key,value);
    if (key === "q" || key === "position") next.delete("employee");
    setParams(next, {replace: true, preventScrollReset: true, state: location.state});
  }
  if (query.isPending) return <p role="status">직원 목록을 불러오는 중입니다.</p>;
  if (query.isError) return <p role="alert">직원 목록을 불러오지 못했습니다. {retryButton(() => void query.refetch())}</p>;
  const staff = query.data ?? [];
  const term = search.replace(/\s+/g, "").toLocaleLowerCase();
  const filtered = staff.filter(row => (!position || row.position === position) &&
    [row.name, labels[row.position], ...row.classes].some(text => text.replace(/\s+/g, "").toLocaleLowerCase().includes(term)));
  const person = staff.find(row => String(row.id) === selected);
  const employeeUrl = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("employee"); else next.set("employee", String(id));
    return {search: next.toString()};
  };

  function closeEmployee() {
    if (location.state?.dawonStaffList && window.history.state?.idx > 0) {
      void move(-1);
    } else {
      setParams(employeeUrl(null).search, {replace:true, preventScrollReset:true});
    }
  }
  return <div className={styles.staffDesk}>
    <section ref={directory} className={styles.directory} aria-label="직원 검색 및 목록">
      <div className={styles.directoryTools}>
        <label className="sr-only" htmlFor="dawon-employee-search">직원 찾기</label>
        <DawonSearchInput id="dawon-employee-search" className="ds-input" placeholder="이름 · 직위 · 담당 반 검색"
          value={search} onSearch={text=> navigate("q", text || null)} />
        <select className="ds-select" aria-label="직위 필터" value={position} onChange={e=>navigate("position",e.target.value || null)}>
          <option value="">전체 직위</option>
          {Object.entries(labels).map(([code,label]) => <option key={code} value={code}>{label}</option>)}
        </select>
        <strong aria-live="polite">직원 {filtered.length}명</strong>
      </div>
      <DawonDirectoryTable id="dawon-employees" label="직원 명단" rows={filtered}
        empty={staff.length ? "검색 조건에 맞는 직원이 없습니다." : "등록된 직원이 없습니다."}
        columns={[
          {key:"name",label:"이름",defaultWidth:125,minWidth:90,value:row=>row.name,
            render:row=><Link aria-label={row.name} className={styles.employeeLink} to={employeeUrl(row.id)} preventScrollReset
              state={{dawonStaffList:true}} data-employee-id={row.id} aria-haspopup="dialog"
              aria-current={String(row.id) === selected ? "true" : undefined}><StaffRoleAvatar role={avatarRoles[row.position]} aria-label={labels[row.position]} size={17}/>{row.name}</Link>},
          {key:"position",label:"직위",defaultWidth:78,minWidth:58,value:row=>labels[row.position]},
          {key:"classes",label:"담당 반",defaultWidth:205,minWidth:114,value:row=>row.classes.join(", "),
            render:row=>row.classes.join(", ") || <span className={styles.muted}>담당 반 없음</span>},
        ]}/>
    </section>
    {selected && <AdminModal open type="inspect" width={MODAL_WIDTH.lg} noMinimize trapFocus onClose={closeEmployee}>
      <ModalHeader type="inspect" title={person?.name ?? "직원 상세"} description={person ? labels[person.position] : undefined}/>
      <ModalBody><div className={styles.employeeModalBody}>
        {person && <p>담당 반 · {person.classes.join(", ") || "없음"}</p>}
        {person ? <MonthDetail key={person.id} staff={person} month={month} onMonth={v=>navigate("month",v)} /> :
          <p role="status">조회할 수 없는 직원입니다.</p>}
      </div></ModalBody>
    </AdminModal>}
  </div>;
}

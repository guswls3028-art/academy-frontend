import DawonSearchInput from "./DawonSearchInput";
import { Fragment, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import { DomainListToolbar } from "@/shared/ui/domain";
import DomainTable from "@/shared/ui/domain/DomainTable";
import { Badge, Button } from "@/shared/ui/ds";
import { dawonQueryKeys } from "./queryKeys";
import styles from "./DawonStaff.module.css";

type Row = {id:number; name:string; position:"DIRECTOR"|"INSTRUCTOR"|"ASSISTANT"|"STAFF"; minutes:number|null; work_amount:number|null; expense_amount:number|null;
  total_amount:number|null; state:"confirmed"|"estimate"|"missing"; open_count:number; can_close:boolean};
const states={confirmed:"확정",estimate:"예상",missing:"미확정"};
const byName=new Intl.Collator("ko",{numeric:true});
const positionOrder={DIRECTOR:0,INSTRUCTOR:1,ASSISTANT:2,STAFF:3};
const money=(value:number|null)=>value==null ? "—" : value.toLocaleString("ko-KR")+"원";
const duration=(value:number|null)=>value==null ? "—" : Math.floor(value/60)+"시간 "+value%60+"분";
const normalize=(v:string)=>v.replace(/\s+/g,"").toLocaleLowerCase();

export default function DawonPayroll({month,labels,detail}:{month:string; labels:Record<string,string>; detail:(row:Row)=>ReactNode}) {
  const client = useQueryClient();
  const [closing, setClosing] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const closeMonth = useMutation({
    mutationFn: async (row: Row) => {
      const [year, number] = month.split("-").map(Number);
      await api.post("/students/demo-staff/month-close/", {staff: row.id, year, month: number});
    },
    onSuccess: async (_, row) => {
      setClosing(null);
      setNotice(row.name + " 직원의 " + month + " 급여를 마감했습니다.");
      await Promise.all([dawonQueryKeys.monthlyPayroll(month), ["dawon", "admin", "staff-directory"]].map(queryKey =>
        client.invalidateQueries({queryKey})));
    },
  });
  const [expanded,setExpanded]=useState<number|null>(null);
  const [params,setParams]=useSearchParams();
  const [chosen,setChosen]=useState<Set<number>>(()=>new Set());
  const search=params.get("paySearch") || "";
  const state=params.get("payState") || "";
  const payroll=useQuery({queryKey:dawonQueryKeys.monthlyPayroll(month),queryFn:async({signal})=>{
    const {data}=await api.get<{month:string;rows:Row[]}>("/students/demo-staff/",{params:{view:"payroll",month},signal});
    return {...data,rows:[...data.rows].sort((a,b)=>positionOrder[a.position]-positionOrder[b.position] || byName.compare(a.name,b.name))};
  }});
  const all=payroll.data?.rows ?? [];
  const filtered=all.filter(r=>(!state || r.state===state) && normalize(r.name+" "+(labels[r.position] ?? r.position)).includes(normalize(search)));
  const selected=all.filter(r=>chosen.has(r.id));
  const target=chosen.size ? selected : filtered;
  const allChecked=filtered.length>0 && filtered.every(r=>chosen.has(r.id));
  const excel=useMutation({mutationFn:async()=>{
    const {downloadArrayWorksheet}=await import("@/shared/utils/excelWorkbook");
    await downloadArrayWorksheet({filename:"다원_직원_월정산_"+month+".xlsx",sheetName:"월 정산",rows:[
      ["조회 월","직원","직위","정산 상태","근무 시간(분)","근무 수당(원)","승인 경비(원)","지급액(원)","퇴근 전 근무(건)"],
      ...target.map(r=>[month,r.name,labels[r.position] ?? r.position,states[r.state],r.minutes,r.work_amount,r.expense_amount,r.total_amount,r.open_count])
    ]});
  }});
  function change(key:string,value:string) {
    const next=new URLSearchParams(params);
    if(value) next.set(key,value); else next.delete(key);
    setParams(next,{replace:key==="paySearch",preventScrollReset:true});
  }
  function choose(rows:Row[], remove:boolean) {
    setChosen(ids=>{
      const next=new Set(ids);
      for(const row of rows) { if(remove) next.delete(row.id); else next.add(row.id); }
      return next;
    });
  }
  return <section aria-label="직원 월 정산" className={styles.payroll}>
    <DomainListToolbar totalLabel={payroll.isSuccess ? `직원 ${filtered.length}명` : null}
      searchSlot={<DawonSearchInput className="ds-input" aria-label="직원 검색" value={search} placeholder="이름 · 직위" onSearch={text=>change("paySearch",text)}/>}
      filterSlot={<><label>조회 월 <input type="month" className="ds-input" value={month} onChange={e=>{if(e.target.value) change("month",e.target.value);}}/></label>
        <label>정산 상태 <select className="ds-select" value={state} onChange={e=>change("payState",e.target.value)}>
          <option value="">전체</option>{Object.entries(states).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label></>} primaryAction={null}/>
    {notice && <p role="status">{notice}</p>}
    {closing && <AdminModal open noMinimize trapFocus width={440} closeDisabled={closeMonth.isPending} onClose={() => setClosing(null)}>
      <ModalHeader title="월 급여 마감"/>
      <ModalBody><p>{closing.name} · {month} · 지급액 {money(closing.total_amount)}</p><p>이 달의 근무 수당과 승인 경비를 확정합니다.</p>
        {closeMonth.isError && <p role="alert">{getApiErrorMessage(closeMonth.error, "마감할 수 없습니다. 근태와 정산 상태를 확인하세요.")}</p>}</ModalBody>
      <ModalFooter right={<><Button disabled={closeMonth.isPending} onClick={() => setClosing(null)}>취소</Button>
        <Button intent="primary" loading={closeMonth.isPending} onClick={() => closeMonth.mutate(closing)}>마감 확정</Button></>}/>
    </AdminModal>}
    {payroll.isPending ? <p role="status">월 정산 내역을 조회하고 있습니다.</p> : payroll.isError ?
      <p role="alert">월 정산 내역을 불러오지 못했습니다. <Button onClick={()=>void payroll.refetch()}>다시 시도</Button></p> : <>
      <div className={styles.directoryTools}>
        {chosen.size>0 && <><span role="status">선택 {selected.length}명 · {selected.map(r=>r.name).join(", ")}</span>
          <Button size="sm" onClick={()=>setChosen(new Set())}>선택 해제</Button></>}
        <Button size="sm" intent="secondary" disabled={!target.length || payroll.isFetching} loading={excel.isPending} onClick={()=>excel.mutate()}>
          {chosen.size ? "선택 직원" : "조회 결과"} 엑셀</Button>
      </div>
      {excel.isError && <p role="alert">내보내기에 실패했습니다. 엑셀 버튼을 다시 눌러 주세요.</p>}
      <DomainTable scrollLabel="월별 직원 정산 표" tableClassName={styles.payrollTable}><thead><tr>
        <th><input type="checkbox" aria-label="조회 직원 전체 선택" disabled={!filtered.length} checked={allChecked} onChange={()=>choose(filtered,allChecked)}/></th>
        <th>직원</th><th>직위</th><th>상태</th><th>근무 시간</th><th>근무 수당</th><th>승인 경비</th><th>지급액</th>
      </tr></thead><tbody>{filtered.map(r=><Fragment key={r.id}><tr><td><input type="checkbox" aria-label={r.name+" 선택"} checked={chosen.has(r.id)} onChange={()=>choose([r],chosen.has(r.id))}/></td>
        <th scope="row"><button type="button" className={styles.employeeLink} aria-expanded={expanded===r.id} onClick={()=>setExpanded(expanded===r.id ? null : r.id)}>{r.name}</button></th><td>{labels[r.position] ?? r.position}</td>
        <td><Badge tone={r.state === "confirmed" ? "success" : r.state === "estimate" ? "info" : "neutral"}>{states[r.state]}</Badge>{r.open_count>0 && <small>퇴근 전 {r.open_count}건</small>}</td><td>{duration(r.minutes)}</td>
        <td>{money(r.work_amount)}</td><td>{money(r.expense_amount)}</td><td>{money(r.total_amount)} {r.can_close && <Button size="sm" onClick={() => { closeMonth.reset(); setClosing(r); }}>월 마감</Button>}</td></tr>
        {expanded===r.id && <tr><td colSpan={8}><section className={styles.staffDetail} aria-label={r.name+" 월 근태 상세"}>{detail(r)}</section></td></tr>}</Fragment>)}
        {!filtered.length && <tr><td colSpan={8}>조건에 맞는 직원이 없습니다.</td></tr>}</tbody></DomainTable>
    </>}
  </section>;
}

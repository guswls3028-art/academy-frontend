import styles from "./DawonOperations.module.css";
import { dawonQueryKeys } from "./queryKeys";
import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { Button } from "@/shared/ui/ds";
import DomainTable from "@/shared/ui/domain/DomainTable";

import { AdminModal, ModalBody, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";

const endpoint = "/students/demo-operations/";
const panelKey = dawonQueryKeys.adminLearning;
type Group = {id:number|null;name:string;courses:{id:number;title:string;exams:{id:number;title:string;average:number|null;graded:number}[]}[]};
type Alert = {group_name:string;group_id:number;student_id:number;student_name:string;lecture_id:number;lecture_title:string;rule:string;detail:string};
type HistoryRow = {title:string;date:string|null;score:number|null;maximum:number|null;state:string;completion?:number|null;wrong?:number[];unfinished?:number[]};
type History = {student:string;course:string;exams:HistoryRow[];homework:HistoryRow[];counsel:string[];
  clinic:{session__date:string;session__title:string;status:string}[];can_follow:boolean;today:string;slots:{id:number;title:string;date:string;start_time:string}[]};
type Analysis = {title:string;graded:number;assigned:number;average:number|null;highest:number|null;lowest:number|null;distribution:number[];reviewed:boolean;
  roster:{id:number;student_id:number;name:string;score:number|null;maximum:number|null;status:string}[]};
const pct = (v:number|null) => v == null ? "미집계" : Number(v.toFixed(1)) + "점";
function address(path:string, entries:Record<string,string|number|null|undefined>) {
  const q = new URLSearchParams();
  for (const [key,value] of Object.entries(entries)) if (value != null && value !== "") q.set(key,String(value));
  return path + "?" + q;
}
function listContext(params:URLSearchParams) {
  return {scope:params.get("scope"),status:params.get("status"),origin:params.get("origin")};
}
function usePanel<T>(params:Record<string,string>) {
  return useQuery({queryKey:panelKey(params), queryFn:async ({signal}) => (await api.get<T>(endpoint,{params,signal})).data});
}
function Failed({retry}: {retry:()=>void}) {return <p role="alert">기록을 불러오지 못했습니다. <Button onClick={retry}>다시 시도</Button></p>;}
const stateLabels:Record<string,string>={needs_submission:"제출 필요",awaiting_review:"확인 중",reviewed:"확인 완료",booked:"예약 확정",pending:"승인 대기",attended:"참석",no_show:"미참석",cancelled:"취소",rejected:"거절"};

export function AdminAlerts({groups}: {groups:Group[]}) {
  const [params,setParams] = useSearchParams();
  const group = params.get("group") || "";
  const query = usePanel<{count:number;alerts:Alert[]}>(group ? {alerts:"1",group} : {alerts:"1"});
  return <section aria-label="학습 경보"><Link to={address("/workspace/dashboard",{group})}>반 운영 현황으로</Link>
    <h2>학습 경보</h2><label>반 범위 <select value={group} onChange={e => {
      const q = new URLSearchParams({panel:"alerts"}); if(e.target.value) q.set("group",e.target.value); setParams(q);}}>
      <option value="">전체 반</option>{groups.filter(g=>g.id!=null).map(g=><option key={g.id} value={String(g.id)}>{g.name}</option>)}</select></label>
    {query.isPending ? <p role="status">학습 경보를 확인하는 중입니다.</p> : query.isError ? <Failed retry={()=>void query.refetch()}/> :
      !query.data.alerts.length ? <p>현재 담당 강사의 기준에 해당하는 경보가 없습니다.</p> :
      <DomainTable scrollLabel="학습 경보 목록"><thead><tr><th>학생</th><th>반·강의</th><th>경보 근거</th></tr></thead><tbody>
        {query.data.alerts.map(row=><tr key={[row.student_id,row.lecture_id,row.rule].join("-")}><th scope="row">
          <Link to={address("/workspace/dashboard",{panel:"student",group,course:row.lecture_id,student:row.student_id})}>{row.student_name}</Link></th>
          <td>{row.group_name} · {row.lecture_title}</td><td>{row.detail}</td></tr>)}</tbody></DomainTable>}
  </section>;
}

function Trend({rows}: {rows:HistoryRow[]}) {
  if (!rows.some(row => row.score != null && row.maximum)) return null;
  const points = rows.map((row, i) => row.score != null && row.maximum && row.maximum > 0
    ? {x: 8 + i * 304 / Math.max(1,rows.length - 1), y: 88 - 80*Math.max(0,Math.min(1,row.score/row.maximum))} : null);
  return <svg viewBox="0 0 320 96" className={styles.scoreTrend} role="img" aria-label="시간순 시험 득점률 추이. 회차별 점수는 아래 표에 표시됩니다.">
    {points.map((p,i) => {const previous=points[i-1]; return p && <g key={i}>
      {previous && <line x1={previous.x} y1={previous.y} x2={p.x} y2={p.y} stroke="currentColor" strokeWidth="2"/>}
      <circle cx={p.x} cy={p.y} r="3" fill="currentColor"><title>{rows[i].title} {rows[i].score} / {rows[i].maximum}</title></circle></g>;})}</svg>;
}

function HistoryTable({title, rows}: {title:string;rows:HistoryRow[]}) {
  return <section><h3>{title}</h3>{!rows.length ? <p>등록된 기록이 없습니다.</p> : <DomainTable scrollLabel={title}>
    <thead><tr><th>일자</th><th>항목</th><th>결과</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{r.date || "일정 미정"}</td>
      <th scope="row">{r.title}</th><td>{r.completion !== undefined ? (r.completion == null ? "예정" : r.completion + "% 완료") : r.score == null ? stateLabels[r.state] || "미채점" : pct(r.score) + (r.maximum == null ? "" : " / "+pct(r.maximum))}{!!r.wrong?.length && <div>오답 {r.wrong.join(", ")}</div>}{!!r.unfinished?.length && <div>미완료 {r.unfinished.join(", ")}</div>}</td></tr>)}</tbody>
    </DomainTable>}</section>;
}

export function AdminStudentReview() {
  const location=useLocation();
  const [params] = useSearchParams();
  const course = params.get("course") || "", student=params.get("student") || "", group=params.get("group");
  const fromRoster=params.get("origin")==="roster" && group && /^[1-9]\d*$/.test(group);
  const exam=params.get("exam"); const args={course,student};
  const q=usePanel<History>(args); const client=useQueryClient();
  const [day,setDay]=useState(""); const [slot,setSlot]=useState("");
  const [kind,setKind]=useState<"counsel"|"clinic"|null>(null);
  const saved=useMutation({mutationFn:(action:"clinic"|"counsel")=>api.patch(endpoint,{...args,followup:action,
    ...(action==="counsel"? {day:day||q.data?.today}:{session:Number(slot)})}),
    onSuccess:async()=>{await client.invalidateQueries({queryKey:panelKey(args)});setKind(null);}});
  const data=q.data;
  return <section><Link state={fromRoster ? location.state : undefined} to={fromRoster ? address("/workspace/students/class-groups",{class:group}) : exam ? address("/workspace/results",{exam,course,group,...listContext(params)}):address("/workspace/dashboard",{panel:"alerts",group})}>{fromRoster ? "반 명단으로" : exam ? "시험 결과로" : "학습 경보로"}</Link>
    {q.isPending?<p role="status">학생 기록을 확인하는 중입니다.</p>:q.isError||!data?<Failed retry={()=>void q.refetch()}/>:<>
      <h2>{data.student} · 학생 학습 기록</h2><p>{data.course}</p>
      <Trend rows={data.exams}/><HistoryTable title="시험 성적 추이" rows={data.exams}/><HistoryTable title="과제 이력" rows={data.homework}/>
      <h3>상담·클리닉 일정</h3>
      {!data.counsel.length && !data.clinic.length && <p>등록된 일정이 없습니다.</p>}
      {data.counsel.map(d=><p key={d}>{d} · 상담 예정</p>)}
      {data.clinic.map((c,i)=><p key={i}>{c.session__date} · {c.session__title} · {stateLabels[c.status] || c.status}</p>)}
      {data.can_follow && <><Button onClick={()=>{saved.reset();setKind("counsel");}}>상담 일정 등록</Button> <Button onClick={()=>{saved.reset();setKind("clinic");}}>클리닉 예약</Button></>}
      {kind && <AdminModal open onClose={()=>setKind(null)} width={MODAL_WIDTH.sm} noMinimize trapFocus closeDisabled={saved.isPending}><ModalHeader title={kind==="counsel"?"상담 일정 등록":"클리닉 예약"}/><ModalBody><form onSubmit={e=>{e.preventDefault();saved.mutate(kind);}}>
        {kind==="counsel"?<label>상담 날짜 <input type="date" min={data.today} required value={day||data.today} onChange={e=>setDay(e.target.value)}/></label>:
          <label>클리닉 일정 <select value={slot} onChange={e=>setSlot(e.target.value)} required><option value="">일정 선택</option>
            {data.slots.map(s=><option key={s.id} value={s.id}>{s.date} {s.start_time.slice(0,5)} · {s.title}</option>)}</select></label>}
        {kind==="clinic"&&!data.slots.length&&<p>예약 가능한 체험 일정이 없습니다.</p>}
        <Button type="submit" disabled={saved.isPending || (kind==="clinic"&&!slot)}>등록하기</Button>
        <Button type="button" disabled={saved.isPending} onClick={()=>setKind(null)}>취소</Button>
      </form></ModalBody></AdminModal>}
      {saved.isError&&<p role="alert">{getApiErrorMessage(saved.error,"일정을 저장하지 못했습니다.")}</p>}
      {saved.isSuccess&&<p role="status">일정을 저장했습니다.</p>}
    </>}
  </section>;
}

export function AdminExamReview({course,exam,group}:{course:string;exam:string;group:string|null}){
  const [params]=useSearchParams();
  const args={course,exam};const q=usePanel<Analysis>(args);const client=useQueryClient();
  const saved=useMutation({mutationFn:(reviewed:boolean)=>api.patch(endpoint,{course:Number(course),exam:Number(exam),reviewed}),
    onSuccess:()=>client.invalidateQueries({queryKey:panelKey(args)})});
  const data=q.data;
  return <section><Link to={params.get("origin")==="dashboard"
    ? address("/workspace/dashboard",{group,course,section:"exams"})
    : address("/workspace/results",listContext(params))}>{params.get("origin")==="dashboard" ? "반 시험 결과로" : "시험 목록"}</Link>
    {q.isPending?<p role="status">시험 결과를 확인하는 중입니다.</p>:q.isError||!data?<Failed retry={()=>void q.refetch()}/>:<>
      <h2>{data.title}</h2><p>응시 대상 {data.assigned}명 · 채점 완료 {data.graded}명</p>
      <p>평균 {pct(data.average)} · 최고 {pct(data.highest)} · 최저 {pct(data.lowest)}</p>
      <Button disabled={saved.isPending} onClick={()=>saved.mutate(!data.reviewed)}>{data.reviewed?"검토 완료 취소":"검토 완료"}</Button>
      {saved.isError&&<p role="alert">검토 상태를 저장하지 못했습니다.</p>}
      <h3>점수 분포</h3><ul aria-label="득점률 구간별 학생 수">{data.distribution.map((n,i)=>{
        const label=i*20+"–"+(i===4?"100%":((i+1)*20)+"% 미만");
        return <li key={i}>{label} <meter aria-label={label} min={0} max={Math.max(1,...data.distribution)} value={n}/> {n}명</li>;
      })}</ul>
      <DomainTable scrollLabel="학생별 시험 결과"><thead><tr><th>학생</th><th>점수</th><th>상태</th></tr></thead><tbody>
        {data.roster.map(row=><tr key={row.id}><th scope="row"><Link to={address("/workspace/results",{panel:"student",group,course,student:row.student_id,exam,...listContext(params)})}>{row.name}</Link></th>
          <td>{row.score==null?"미채점":pct(row.score)+(row.maximum!=null?" / "+pct(row.maximum):"")}</td><td>{row.status}</td></tr>)}
      </tbody></DomainTable></>}
  </section>;
}

export function ExamLinks({course,exam,group,title}:{course:number;exam:number;group:number|null;title:string}) {
  const location=useLocation();
  const [params]=useSearchParams();
  return <Link to={address("/workspace/results",{course,exam,group,...listContext(params),origin:location.pathname==="/workspace/dashboard"?"dashboard":undefined})}>{title}</Link>;
}

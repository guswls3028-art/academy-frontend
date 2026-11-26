import { examCohort, examFilters, examSchool, examGrade, examBandLabel, questionRates, type ExamQuestionMarks, type ExamFilter, type ExamRow } from "./adminExamCohort";
import DawonAlertQueue from "./DawonAlertQueue";
import styles from "./DawonOperations.module.css";
import desk from "./DawonAdminRecords.module.css";
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
type Group = {id:number|null;name:string};
type HistoryRow = {title:string;date:string|null;score:number|null;maximum:number|null;state:string;completion?:number|null;wrong?:number[];unfinished?:number[]};
type History = {student:string;course:string;exams:HistoryRow[];homework:HistoryRow[];counsel:string[];
  clinic:{session__date:string;session__title:string;status:string}[];can_follow:boolean;today:string;slots:{id:number;title:string;date:string;start_time:string}[]};
type Analysis = {top_reference_percent:number|null;title:string;graded:number;assigned:number;average:number|null;highest:number|null;lowest:number|null;distribution:number[];reviewed:boolean;
  questions:ExamQuestionMarks[]; roster:ExamRow[]};
const pct = (v:number|null) => v == null ? "미집계" : Number(v.toFixed(1)) + "점";
function address(path:string, entries:Record<string,string|number|null|undefined>) {
  const q = new URLSearchParams();
  for (const [key,value] of Object.entries(entries)) if (value != null && value !== "") q.set(key,String(value));
  return path + "?" + q;
}
function examContext(params:URLSearchParams) {
  return Object.fromEntries(examFilters.map(key => [key, params.get(key)]));
}
function listContext(params:URLSearchParams) {
  return {q:params.get("q"),scope:params.get("scope"),classType:params.get("classType"),status:params.get("status"),origin:params.get("origin")};
}
function usePanel<T>(params:Record<string,string>) {
  return useQuery({queryKey:panelKey(params), queryFn:async ({signal}) => (await api.get<T>(endpoint,{params,signal})).data});
}
function Failed({retry}: {retry:()=>void}) {return <p role="alert">기록을 불러오지 못했습니다. <Button onClick={retry}>다시 시도</Button></p>;}
const stateLabels:Record<string,string>={absent:"미응시",needs_submission:"제출 필요",awaiting_review:"확인 중",reviewed:"확인 완료",booked:"예약 확정",pending:"승인 대기",attended:"참석",no_show:"미참석",cancelled:"취소",rejected:"거절"};

export function AdminAlerts({groups}: {groups:Group[]}) {
  return <DawonAlertQueue role="admin" groups={groups}/>;
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
      <th scope="row">{r.title}</th><td>{r.completion !== undefined ? (r.completion == null ? "예정" : r.completion + "% 완료") : r.score == null ? (r.state === "pending" ? "채점 대기" : stateLabels[r.state] || "미채점") : pct(r.score) + (r.maximum == null ? "" : " / "+pct(r.maximum))}{!!r.wrong?.length && <div>오답 {r.wrong.join(", ")}</div>}{!!r.unfinished?.length && <div>미완료 {r.unfinished.join(", ")}</div>}</td></tr>)}</tbody>
    </DomainTable>}</section>;
}

export function DirectoryPerformance({student, course, role}: {student:number; course:number; role:"teacher"|"admin"}) {
  const query = useQuery({
    queryKey: dawonQueryKeys.directoryScores(role,student,course),
    queryFn: async ({signal}) => (await api.get<{exams:HistoryRow[];delta_percent:number|null;previous_title:string|null}>("/students/class-groups/", {
      params: {view:"student_scores", student, course}, signal,
    })).data,
  });
  if (query.isPending) return <p role="status">시험 성적을 불러오는 중…</p>;
  if (query.isError) return <Failed retry={()=>void query.refetch()}/>;
  const rows = query.data.exams;
  const graded = rows.filter(row => row.score != null && row.maximum != null && row.maximum > 0);
  const latest = graded[graded.length - 1];
  const change = query.data.delta_percent == null ? null : Math.round(query.data.delta_percent * 10) / 10;
  if (!rows.length) return <p>이 강의에 배정된 시험이 없습니다.</p>;
  return <section aria-label="성적 추이">
    {latest && <p><strong>최근 채점 · {latest.title}</strong> · {latest.score} / {latest.maximum}점
      {change !== null && <span> · {query.data.previous_title} 대비 {change > 0 ? "+" : ""}{change}%p</span>}</p>}
    {graded.length >= 2 && <Trend rows={rows}/>}
    <HistoryTable title="회차별 시험 결과" rows={rows}/>
  </section>;
}

export function AdminStudentReview() {
  const location=useLocation();
  const [params] = useSearchParams();
  const course = params.get("course") || "", student=params.get("student") || "", group=params.get("group");
  const fromDirectory=params.get("origin")==="directory";
  const fromLearners=params.get("origin")==="learners";
  const fromRoster=params.get("origin")==="roster" && group && /^[1-9]\d*$/.test(group);
  const exam=params.get("exam"); const args={course,student};
  const q=usePanel<History>(args); const client=useQueryClient();
  const [day,setDay]=useState(""); const [slot,setSlot]=useState("");
  const [kind,setKind]=useState<"counsel"|"clinic"|null>(null);
  const saved=useMutation({mutationFn:(action:"clinic"|"counsel")=>api.patch(endpoint,{...args,followup:action,
    ...(action==="counsel"? {day:day||q.data?.today}:{session:Number(slot)})}),
    onSuccess:async()=>{await client.invalidateQueries({queryKey:dawonQueryKeys.adminLearningRoot});setKind(null);}});
  const data=q.data;
  return <section className={desk.desk}><Link className={desk.back} state={fromDirectory || fromRoster || fromLearners ? location.state : undefined} to={fromDirectory ? {pathname:"/workspace/students/home",search:location.state?.directorySearch || new URLSearchParams({student}).toString()} : fromLearners ? {pathname:"/workspace/results/students",search:location.state?.resultReturn ?? new URLSearchParams({group:params.get("scope") || "",page:params.get("page") || "1"}).toString()} : fromRoster ? address("/workspace/students/class-groups",{class:group}) : exam ? address("/workspace/results",{exam,course,group,...listContext(params),...examContext(params)}):(location.state?.alertReturn || address("/workspace/dashboard",{panel:"alerts",group}))}>{fromDirectory ? "학생 명단으로" : fromLearners ? "학생별 목록으로" : fromRoster ? "반 명단으로" : exam ? "시험 결과로" : "학습 경보로"}</Link>
    {q.isPending?<p role="status">학생 기록을 확인하는 중입니다.</p>:q.isError||!data?<Failed retry={()=>void q.refetch()}/>:<>
      <header className={desk.heading}><h2>{data.student} · 학생 학습 기록</h2><p>{data.course}</p></header>
      <div className={desk.histories}><div><Trend rows={data.exams}/><HistoryTable title="시험 성적 추이" rows={data.exams}/></div><HistoryTable title="과제 이력" rows={data.homework}/></div>
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
  const [params,setParams]=useSearchParams();
  const args={course,exam};const q=usePanel<Analysis>(args);const client=useQueryClient();
  const saved=useMutation({mutationFn:(reviewed:boolean)=>api.patch(endpoint,{course:Number(course),exam:Number(exam),reviewed}),
    onSuccess:()=>client.invalidateQueries({queryKey:panelKey(args)})});
  const data=q.data;
  const percent = data?.top_reference_percent;
  const roster = data?.roster ?? [];
  const cohort = examCohort(roster,params,percent);
  const filtered = examFilters.some(key => params.has(key));
  function apply(key?: ExamFilter, value?: string) {
    const next = new URLSearchParams(params);
    if (!key) examFilters.forEach(filter => next.delete(filter));
    else if (value) next.set(key,value);
    else next.delete(key);
    setParams(next,{replace:true,preventScrollReset:true});
  }
  function control(key: ExamFilter, label:string, options: [string,string][]) {
    const current = params.get(key) || "";
    return <label>{label}<select value={current} onChange={event => apply(key,event.target.value)}>
      <option value="">전체</option>{current && !options.some(([value]) => value===current) &&
        <option value={current}>현재 조건에 해당하는 항목 없음</option>}
      {options.map(([value,text]) => <option key={value} value={value}>{text}</option>)}
    </select></label>;
  }
  return <section className={desk.desk}><Link className={desk.back} to={params.get("origin")==="dashboard"
    ? address("/workspace/dashboard",{group,course,section:"exams"})
    : address("/workspace/results",listContext(params))}>{params.get("origin")==="dashboard" ? "반 시험 결과로" : "시험 목록"}</Link>
    {q.isPending?<p role="status">시험 결과를 확인하는 중입니다.</p>:q.isError||!data?<Failed retry={()=>void q.refetch()}/>:<>
      <header className={desk.heading}><div><h2>{data.title}</h2><p>전체 응시 대상 {data.assigned}명</p></div>
        <Button disabled={saved.isPending} onClick={()=>saved.mutate(!data.reviewed)}>{data.reviewed?"검토 완료 취소":"검토 완료"}</Button></header>
      <div className={desk.examFilters} role="group" aria-label="시험 통계 조건">
        {control("examSchool","학교",[...new Map(roster.map(row=>[examSchool(row),row.school || "학교 미입력"] as const))].sort((a,b)=>a[1].localeCompare(b[1],"ko")))}
        {control("examGrade","학년",[...new Map(roster.map(row=>[examGrade(row),row.grade == null ? "학년 미입력" : row.grade+"학년"] as const))].sort((a,b)=>a[0].localeCompare(b[0])))}
        {control("examState","응시·채점 상태",[...new Set(roster.map(row=>row.status))].map(status=>[status,status]))}
        {control("examBand","득점률",[
          ...(data.distribution).flatMap((n,i):[string,string][]=>n ? [[String(i),examBandLabel(i)]] : []),
          ...(percent && data.distribution.some(Boolean) ? [["top",`상위 ${percent}%`] as [string,string]] : [])
        ])}
        <Button disabled={!filtered} onClick={()=>apply()}>조건 초기화</Button>
      </div>
      <dl className={desk.examSummary} aria-label="시험 성적 요약" aria-live="polite">
        <div><dt>조건 대상</dt><dd>{cohort.rows.length}명</dd></div>
        <div><dt>채점 완료</dt><dd>{cohort.count}명</dd></div>
        <div><dt>미응시</dt><dd>{cohort.rows.filter(row=>row.status==="미응시").length}명</dd></div>
        <div><dt>채점 대기</dt><dd>{cohort.rows.filter(row=>row.status==="채점 대기").length}명</dd></div>
        <div><dt>평균</dt><dd>{pct(cohort.average)}</dd></div>
        <div><dt>최고</dt><dd>{pct(cohort.highest)}</dd></div>
        <div><dt>최저</dt><dd>{pct(cohort.lowest)}</dd></div>
      </dl>
      {saved.isError && <p role="alert">검토 상태를 저장하지 못했습니다. 다시 시도해 주세요.</p>}
      <nav className={desk.sectionLinks} aria-label="성적 상세 바로가기">
        <a href="#dawon-exam-students">학생별 결과</a><a href="#dawon-exam-questions">문항 분석</a>
      </nav>
      <div className={desk.examBody}><section><h3 id="dawon-exam-students" tabIndex={-1}>학생별 결과</h3>
      {!cohort.rows.length ? <p>{filtered ? "조건에 맞는 학생이 없습니다. 조건을 변경하거나 초기화해 주세요." : "응시 대상 학생이 없습니다."}</p> : <DomainTable scrollLabel="학생별 시험 결과"><thead><tr><th>학생</th><th>점수</th><th>상태</th></tr></thead><tbody>
        {cohort.rows.map(row=><tr key={row.id}><th scope="row"><Link to={address("/workspace/results",{panel:"student",group,course,student:row.student_id,exam,...listContext(params),...examContext(params)})}>{row.name}</Link><small className={desk.secondary}>{row.school || "학교 미입력"} · {row.grade == null ? "학년 미입력" : row.grade+"학년"}</small></th>
          <td>{row.score==null?"미채점":Number(row.score.toFixed(1))+(row.maximum!=null?" / "+Number(row.maximum.toFixed(1)):"")+"점"}</td><td>{row.status}</td></tr>)}
      </tbody></DomainTable>}
      </section>
      <section className={desk.distribution}><h3>점수 분포</h3><ul aria-label="득점률 구간별 학생 수">{cohort.distribution.map((n,i)=>{
        const label=examBandLabel(i);
        return <li key={i}><span>{label}</span><meter aria-label={label} min={0} max={Math.max(1,...cohort.distribution)} value={n}/><strong>{n}명</strong></li>;
      })}</ul></section>
      </div>
      <section className={desk.questionAnalysis}><h3 id="dawon-exam-questions" tabIndex={-1}>문항 분석</h3>
        {data.questions.length ? <DomainTable scrollLabel="문항별 채점 인원과 정답률"><thead><tr><th>문항</th><th>주제</th><th>채점 인원</th><th>정답률</th></tr></thead><tbody>
          {questionRates(data.questions,cohort.rows).map(row=><tr key={row.number}><th scope="row">{row.number}번</th><td>{row.topic || "미등록"}</td>
            <td>{row.graded}명</td><td>{row.rate==null?"미집계":Number(row.rate.toFixed(1))+"%"}</td></tr>)}
        </tbody></DomainTable> : <p>문항별 채점 자료가 없습니다.</p>}
      </section></>}
  </section>;
}

export function ExamLinks({course,exam,group,title}:{course:number;exam:number;group:number|null;title:string}) {
  const location=useLocation();
  const [params]=useSearchParams();
  return <Link to={address("/workspace/results",{course,exam,group,...listContext(params),origin:location.pathname.startsWith("/workspace/lectures/") || location.pathname==="/workspace/dashboard" ? "dashboard" : undefined})}>{title}</Link>;
}

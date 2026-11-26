import { DawonClassBadge, DawonClassSelect, DawonClassTypeSelect, matchesDawonClassType, readDawonClassType, type DawonClassOption } from "./DawonClassFilters";
import DawonSearchInput from "./DawonSearchInput";
import { Fragment } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import DomainTable from "@/shared/ui/domain/DomainTable";
import { Button } from "@/shared/ui/ds";
import { dawonQueryKeys } from "./queryKeys";
import { resultTabs } from "./staffMenu";
import desk from "./DawonAdminRecords.module.css";

const endpoint = "/students/demo-operations/";
const statusLabels = {graded:"채점 완료", absent:"미응시", pending:"채점 대기", no_exam:"시험 없음"};
type Status = keyof typeof statusLabels;
type Result = {exam_id:number; title:string; date:string|null; lecture_id:number; status:Status; score:number|null; max_score:number|null; percent:number|null};
type Course = {lecture_id:number; course:string; group_id:number|null; group:string};
type Row = {student_id:number; name:string; courses:Course[]; latest:Result|null; previous:Result|null; delta_percent:number|null};
type Page = {rows:Row[]; count:number};
const sortLabels:Record<string,string>={recent:"최근 시험순",lowest:"낮은 득점률순",decline:"하락폭 큰 순",improvement:"상승폭 큰 순",name:"이름순"};
const number = new Intl.NumberFormat("ko-KR", {maximumFractionDigits:1});
function score(r: Result|null) {
  return r?.score == null ? "—" : number.format(r.score) + (r.max_score == null ? "점" : " / "+number.format(r.max_score)+"점");
}
function delta(n:number|null) {
  return n == null ? "비교 전" : (n>0 ? "+" : "")+number.format(n)+"%p";
}
export default function DawonStudentResults() {
  const location=useLocation();
  const [params,setParams]=useSearchParams();
  const search:string=location.state?.resultSearch ?? "";
  const query=useDebouncedValue(search.trim());
  const group=params.get("group") || "";
  const status=params.get("status") || "";
  const trend=params.get("trend") || "";
  const order=params.get("sort") || "recent";
  const page=Math.max(1,Number(params.get("page")) || 1);
  const selected=params.get("profile");
  const classType=readDawonClassType(params.get("classType"));
  const groups=useQuery({queryKey:dawonQueryKeys.adminGroups,queryFn:async ({signal})=>
    (await api.get<DawonClassOption[]>("/students/class-groups/",{signal})).data});
  const matchingGroups=(groups.data ?? []).filter((item)=>matchesDawonClassType(item,classType));
  const selectedGroup=matchingGroups.find((item)=>String(item.id)===group);
  const filters={view:"student_results",class_type:classType,group,status,trend,sort:order,q:query};
  const results=useQuery({queryKey:dawonQueryKeys.adminLearning({...filters,page:String(page)}),
    queryFn:async ({signal})=>(await api.get<Page>(endpoint,{params:{...filters,page},signal})).data});
  const excel=useMutation({mutationFn:async()=>{
    const {data}=await api.get<Page>(endpoint,{params:{...filters,export:1}});
    if(data.rows.length!==data.count) throw new Error("목록이 바뀌었습니다. 다시 조회해 주세요.");
    const {downloadArrayWorksheet}=await import("@/shared/utils/excelWorkbook");
    await downloadArrayWorksheet({filename:"다원_학생별_성적.xlsx",sheetName:"학생별 성적",rows:[
      ["검색어",query,"반",groups.data?.find(g=>String(g.id)===group)?.name ?? (group || "전체 반")],
      ["응시 상태",statusLabels[status as Status] ?? "전체","성적 변화",trend==="decline"?"직전보다 하락":trend==="improvement"?"직전보다 상승":"전체","정렬",sortLabels[order]],
      ["학생","반","최근 시험","시험일","응시 상태","원점수","만점","득점률(%)","직전 비교 시험","직전 득점률(%)","변화(%p)"],
      ...data.rows.map(r=>[r.name,[...new Set(r.courses.map(c=>c.group).filter(Boolean))].join(", "),r.latest?.title,r.latest?.date,
        statusLabels[r.latest?.status ?? "no_exam"],r.latest?.score,r.latest?.max_score,r.latest?.percent,r.previous?.title,r.previous?.percent,r.delta_percent])
    ]});
  }});
  function update(key:string,value:string) {
    const next=new URLSearchParams(params);
    if(key!=="page" && key!=="profile") next.delete("page");
    if(key!=="profile") next.delete("profile");
    if(key==="classType" && value && group && !matchesDawonClassType(selectedGroup,value)) next.delete("group");
    if(key!=="q" && value) next.set(key,value); else next.delete(key);
    setParams(next,{state:{resultSearch:key==="q" ? value : search},replace:key==="q",preventScrollReset:true});
  }
  const rows=results.data?.rows ?? [];
  const person=rows.find(row=>String(row.student_id)===selected);
  const pages=Math.ceil((results.data?.count ?? 0)/25);
  return <DomainLayout title="시험 결과·통계" breadcrumbs={[]} tabs={resultTabs}><div className={desk.desk}>
    <div className={desk.resultTools} role="group" aria-label="학생별 성적 조건">
      <label>학생 이름<DawonSearchInput className="ds-input" value={search} maxLength={100} onSearch={text=>update("q",text)}/></label>
      <DawonClassTypeSelect value={classType} onChange={value=>update("classType",value)}/>
      <DawonClassSelect groups={matchingGroups} value={group} onChange={value=>update("group",value)}/>
      {selectedGroup && <DawonClassBadge group={selectedGroup}/>}
      <label>최근 응시 상태<select value={status} onChange={e=>update("status",e.target.value)}><option value="">전체</option>
        {Object.entries(statusLabels).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label>
      <label>성적 변화<select value={trend} onChange={e=>update("trend",e.target.value)}><option value="">전체</option><option value="decline">직전보다 하락</option><option value="improvement">직전보다 상승</option></select></label>
      <label>정렬<select value={order} onChange={e=>update("sort",e.target.value)}>{Object.entries(sortLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      {(search || group || classType || status || trend || order!=="recent") && <Button onClick={()=>setParams({}, {state:{resultSearch:""}})}>조건 초기화</Button>}
    </div>
    {groups.isError && <p role="alert">반 목록을 불러오지 못했습니다. <Button onClick={()=>void groups.refetch()}>다시 시도</Button></p>}
    <>
    <div className={desk.controls}><strong role="status">{results.data ? "학생 "+results.data.count+"명" : "학생별 성적"}</strong>
      <Button disabled={!results.data?.count || results.isFetching || query!==search.trim()} loading={excel.isPending} onClick={()=>excel.mutate()}>조회 결과 엑셀</Button></div>
    {excel.isError && <p role="alert">엑셀을 내려받지 못했습니다. 조회 결과 엑셀을 다시 눌러 주세요.</p>}
    {results.isError ? <p role="alert">학생별 성적을 불러오지 못했습니다. <Button onClick={()=>void results.refetch()}>다시 시도</Button></p> : results.isPending ? <p role="status">성적 조회 중…</p> :
      <DomainTable scrollLabel="학생별 성적 목록" tableClassName={desk.performance}><thead><tr><th>학생</th><th>최근 시험</th><th>응시 상태</th><th>점수</th><th>득점률</th><th>직전 대비</th></tr></thead>
        <tbody>{rows.map(row=><Fragment key={row.student_id}><tr aria-selected={String(row.student_id)===selected}><th scope="row"><button className={desk.personButton} type="button" aria-expanded={String(row.student_id)===selected} onClick={()=>update("profile",String(row.student_id)===selected ? "" : String(row.student_id))}>{row.name}</button></th>
          <td>{row.latest?.title || "시험 없음"}{row.latest?.date && <small className={desk.secondary}>{row.latest.date}</small>}</td>
          <td>{statusLabels[row.latest?.status ?? "no_exam"]}</td><td>{score(row.latest)}</td><td>{row.latest?.percent==null ? "—" : number.format(row.latest.percent)+"%"}</td>
        <td>{delta(row.delta_percent)}</td></tr>
    {person?.student_id===row.student_id && <tr><td colSpan={6}><section className={desk.studentInspection} aria-label="선택 학생 성적 상세">
      <h2>{person.name}</h2><p>최근 시험 {person.latest?.title || "없음"} · {score(person.latest)}</p>
      <p>{person.previous ? "직전 비교 시험 "+person.previous.title+" · "+(person.previous.percent==null ? "득점률 미집계" : number.format(person.previous.percent)+"%") : "같은 기준으로 비교할 직전 성적이 없습니다."}</p>
      <h3>강의별 학습 기록</h3><ul>{person.courses.map(c=><li key={c.lecture_id}><Link
        state={{resultSearch:search,resultReturn:params.toString()}}
        to={"/workspace/results?"+new URLSearchParams({panel:"student",origin:"learners",course:String(c.lecture_id),student:String(person.student_id),...(c.group_id!=null?{group:String(c.group_id)}:{})})}>{c.course}</Link> {c.group}</li>)}</ul>
      <Button onClick={()=>update("profile","")}>상세 닫기</Button></section></td></tr>}</Fragment>)}
          {!rows.length && <tr><td colSpan={6}>조건에 맞는 학생이 없습니다.</td></tr>}</tbody></DomainTable>}

    {(pages>1 || page>1) && <nav className={desk.paging} aria-label="학생별 성적 페이지"><Button disabled={page<=1} onClick={()=>update("page",String(page-1))}>이전</Button><span>{page} / {Math.max(1,pages)}</span><Button disabled={page>=pages} onClick={()=>update("page",String(page+1))}>다음</Button></nav>}
    </>
  </div></DomainLayout>;
}

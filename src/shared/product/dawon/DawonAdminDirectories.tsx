import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import DomainListToolbar from "@/shared/ui/domain/DomainListToolbar";
import DomainTable from "@/shared/ui/domain/DomainTable";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { dawonQueryKeys } from "./queryKeys";
import styles from "./DawonOperations.module.css";

import { resultTabs } from "./staffMenu";

export function AdminGroupSelect({value, onChange}: {value:string;onChange:(id:string)=>void}) {
  const groups = useQuery({queryKey:dawonQueryKeys.adminGroups, queryFn:async ({signal}) =>
    (await api.get<{id:number;name:string}[]>("/students/class-groups/",{signal})).data});
  return <label className={styles.field}>반 범위
    <select value={value} onChange={e=>onChange(e.target.value)} disabled={groups.isPending}>
      <option value="">전체 반</option>
      {groups.data?.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}
    </select>
    {groups.isError && <Button onClick={()=>void groups.refetch()}>반 목록 다시 불러오기</Button>}
  </label>;
}

type CareRow = {id:number;student_id:number;name:string;groups:string[];day:string|null;title:string;status:string;course_id:number|null;body?:string;replies?:string[]};
type Learner = {student_id:number;lecture_id:number;name:string;course:string;group:string;group_id:number};
const states:Record<string,string> = {pending:"승인 대기",booked:"예약 확정",attended:"참석",no_show:"미참석",cancelled:"취소",rejected:"거절"};
function useDirectory<T>(filters:Record<string,string>) {
  return useQuery({queryKey:dawonQueryKeys.adminLearning(filters), queryFn:async ({signal})=>
    (await api.get<{count:number;rows:T[]}>("/students/demo-operations/",{params:filters,signal})).data});
}

function CareDetail({filters,close}:{filters:Record<string,string>;close:()=>void}) {
  const query=useDirectory<CareRow>(filters);
  const row=query.data?.rows[0];
  return <AdminModal open onClose={close} trapFocus noMinimize width={MODAL_WIDTH.md}>
    <ModalHeader title={filters.kind==="clinic"?"클리닉 기록":"상담 기록"}/>
    <ModalBody>{query.isPending?<p role="status">기록을 불러오는 중입니다.</p>:query.isError||!row?
      <p role="alert">기록을 불러오지 못했습니다. <Button onClick={()=>void query.refetch()}>다시 시도</Button></p>:
      <div className={styles.record}><h3>{row.title}</h3><dl>
        <dt>학생</dt><dd>{row.name}</dd><dt>소속 반</dt><dd>{row.groups.join(", ") || "미편성"}</dd>
        <dt>일자</dt><dd>{row.day || "미정"}</dd><dt>상태</dt><dd>{states[row.status] ?? row.status}</dd></dl>
        {row.body && <p>{row.body}</p>}{row.replies?.map((reply,index)=><blockquote key={index}>{reply}</blockquote>)}
      </div>}</ModalBody>
  </AdminModal>;
}

export default function DawonAdminDirectories() {
  const {pathname,state}=useLocation();
  const [params,setParams]=useSearchParams();
  const learners=pathname==="/workspace/results/students";
  const clinic=pathname==="/workspace/clinic/operations";
  const kind=clinic?"clinic":params.get("kind")==="appointments"?"appointments":"requests";
  const group=params.get("group") || "";
  const search=typeof state?.directorySearch==="string" ? state.directorySearch : "";
  const q=useDebouncedValue(search.trim());
  const page=Math.max(1,Number(params.get("page")) || 1);
  const filters:Record<string,string>={view:learners?"learners":"care",group,q,page:String(page)};
  if (!learners) filters.kind=kind;
  const query=useDirectory<Learner|CareRow>(filters);
  function update(key:string,value:string) {
    const next=new URLSearchParams(params);
    if (key!=="record") next.delete("record");
    if (key!=="page" && key!=="record") next.delete("page");
    if (key!=="q" && value) next.set(key,value); else next.delete(key);
    setParams(next,{replace:key==="q",preventScrollReset:true,state:{directorySearch:key==="q"?value:search}});
  }
  const count=query.data?.count ?? 0;
  const title=learners?"시험 결과·통계":clinic?"클리닉":"상담";
  return <DomainLayout title={title} breadcrumbs={[]} tabs={learners?resultTabs:undefined}>
    <div className={styles.section}>
      {!clinic && !learners && <div className={styles.sectionPicker} role="group" aria-label="상담 구분">
        <Button aria-pressed={kind==="requests"} onClick={()=>update("kind","")}>학부모 상담 신청</Button>
        <Button aria-pressed={kind==="appointments"} onClick={()=>update("kind","appointments")}>등록한 상담 일정</Button>
      </div>}
      <DomainListToolbar totalLabel={query.data ? (learners?"수강 기록 ":"기록 ")+count+"건" : "조회 중"}
        searchSlot={<input className="ds-input" type="search" aria-label="학생 이름 검색" placeholder="학생 이름 검색" maxLength={100} value={search} onChange={e=>update("q",e.target.value)}/>}
        filterSlot={<AdminGroupSelect value={group} onChange={id=>update("group",id)}/>} primaryAction={null}/>
      {query.isPending?<p role="status">목록을 불러오는 중입니다.</p>:query.isError?
        <p role="alert">목록을 불러오지 못했습니다. <Button onClick={()=>void query.refetch()}>다시 시도</Button></p>:
        !count?<p className={styles.empty}>조건에 맞는 기록이 없습니다.</p>:
        <DomainTable scrollLabel={learners?"학생별 수강 기록":title+" 목록"}><thead><tr><th>학생</th><th>반</th>
          {learners ? <th>강의</th> : <><th>{clinic?"클리닉":"상담"}</th><th>일자</th><th>상태</th></>}</tr></thead>
          <tbody>{query.data.rows.map(row=>{
            if ("lecture_id" in row) {
              const target=new URLSearchParams({panel:"student",origin:"learners",group:String(row.group_id),course:String(row.lecture_id),
                student:String(row.student_id),scope:group,page:String(page)});
              return <tr key={row.lecture_id+"-"+row.student_id}><th scope="row"><Link state={{directorySearch:search}} to={"/workspace/results?"+target}>{row.name}</Link></th><td>{row.group}</td><td>{row.course}</td></tr>;
            }
            return <tr key={row.id}><th scope="row">{row.name}</th><td>{row.groups.join(", ") || "미편성"}</td>
              <td><button type="button" className={styles.textAction} onClick={()=>update("record",String(row.id))}>{row.title}</button></td>
              <td>{row.day || "미정"}</td><td>{states[row.status] ?? row.status}</td></tr>;
          })}</tbody></DomainTable>}
      {(count>25 || page>1) && <nav className={styles.pagination} aria-label="목록 페이지">
        <Button disabled={page<=1} onClick={()=>update("page",String(page-1))}>이전</Button><span>{page} / {Math.max(1,Math.ceil(count/25))}</span>
        <Button disabled={page*25>=count} onClick={()=>update("page",String(page+1))}>다음</Button></nav>}
      {!learners && params.get("record") && <CareDetail filters={{...filters,page:"1",record:params.get("record")!}} close={()=>update("record","")}/>}
    </div></DomainLayout>;
}

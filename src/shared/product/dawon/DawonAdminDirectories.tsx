import PostThreadView from "@/app_admin/domains/community/components/PostThreadView";
import { demoAnswers } from "@/app_admin/domains/community/components/dawonCounselAnswers";
import { useEffect } from "react";
import { clinicQueryKeys } from "@/app_admin/domains/clinic/queryKeys";
import { patchClinicParticipantStatus } from "@/app_admin/domains/clinic/api/clinicParticipants.api";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import DawonSearchInput from "./DawonSearchInput";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import DomainListToolbar from "@/shared/ui/domain/DomainListToolbar";
import DomainTable from "@/shared/ui/domain/DomainTable";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { dawonQueryKeys } from "./queryKeys";
import styles from "./DawonOperations.module.css";

import desk from "./DawonAdminRecords.module.css";
import DawonStudentResults from "./DawonStudentResults";

export function AdminGroupSelect({value, onChange, teacher=false}: {value:string;onChange:(id:string)=>void;teacher?:boolean}) {
  const groups = useQuery({queryKey:teacher ? [...dawonQueryKeys.adminGroups,"teacher"] : dawonQueryKeys.adminGroups, queryFn:async ({signal}) =>
    (await api.get<{id:number;name:string}[]>("/students/class-groups/",{signal})).data});
  return <label className={styles.field}>반 범위
    <select value={value} onChange={e=>onChange(e.target.value)} disabled={groups.isPending}>
      <option value="">{teacher ? "전체 담당 반" : "전체 반"}</option>
      {groups.data?.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}
    </select>
    {groups.isError && <Button onClick={()=>void groups.refetch()}>반 목록 다시 불러오기</Button>}
  </label>;
}

type CareRow = {id:number;student_id:number;name:string;groups:string[];day:string|null;title:string;status:string;course_id:number|null;can_review?:boolean;can_attend?:boolean;can_undo_arrival?:boolean;can_undo_absence?:boolean;checked_in_at?:string|null;can_reply?:boolean;body?:string;replies?:string[]};
const states:Record<string,string> = {pending:"승인 대기",booked:"예약 확정",attended:"참석",no_show:"미참석",cancelled:"취소",rejected:"거절"};
function useDirectory<T>(filters:Record<string,string>) {
  return useQuery({queryKey:dawonQueryKeys.adminLearning(filters), refetchInterval:filters.kind==="clinic" && !filters.record ? 15000 : false, queryFn:async ({signal})=>
    (await api.get<{count:number;rows:T[]}>("/students/demo-operations/",{params:filters,signal})).data});
}

export function CareDetail({filters,close}:{filters:Record<string,string>;close:()=>void}) {
  const query=useDirectory<CareRow>(filters);
  const row=query.data?.rows[0];
  const client=useQueryClient();
  const review=useMutation({
    mutationFn:(status:"booked"|"rejected"|"attended"|"no_show"|"undo")=>{
      const id=Number(filters.record);
      if(status!=="undo") return patchClinicParticipantStatus(id,{status});
      if(row?.can_undo_arrival && row.checked_in_at) return patchClinicParticipantStatus(id,{status:"booked",expected_checked_in_at:row.checked_in_at});
      if(row?.can_undo_absence) return patchClinicParticipantStatus(id,{status:"booked",expected_status:"no_show"});
      throw new Error("출결 상태가 바뀌었습니다. 다시 확인해 주세요.");
    },
    onSettled:()=>Promise.all([
      client.invalidateQueries({queryKey:dawonQueryKeys.adminLearningRoot}),
      client.invalidateQueries({queryKey:clinicQueryKeys.participants}),
    ]),
  });
  return <AdminModal open onClose={close} closeDisabled={review.isPending} trapFocus noMinimize width={MODAL_WIDTH.md}>
    <ModalHeader title={filters.kind==="clinic"?"클리닉 기록":"상담 기록"}/>
    <ModalBody>{query.isPending?<p role="status">기록을 불러오는 중입니다.</p>:query.isError||!row?
      <p role="alert">기록을 불러오지 못했습니다. <Button onClick={()=>void query.refetch()}>다시 시도</Button></p>:
      <div className={styles.record+" "+desk.record}><h3>{row.title}</h3><dl>
        <dt>학생</dt><dd>{row.name}</dd><dt>소속 반</dt><dd>{row.groups.join(", ") || "미편성"}</dd>
        <dt>일자</dt><dd>{row.day || "미정"}</dd><dt>상태</dt><dd>{states[row.status] ?? row.status}</dd></dl>
        {row.body && <p>{row.body}</p>}{!row.can_reply && row.replies?.map((reply,index)=><blockquote key={index}>{reply}</blockquote>)}
        {row.can_reply && <PostThreadView postId={row.id} mode="answer" allowReply answerChoices={demoAnswers}
          invalidateKeys={[dawonQueryKeys.adminLearningRoot]} />}
        {row.can_attend && <div role="group" aria-label="클리닉 출석 기록">
          <Button intent="primary" disabled={review.isPending} onClick={()=>review.mutate("attended")}>출석 기록</Button>
          <Button disabled={review.isPending} onClick={()=>review.mutate("no_show")}>결석 기록</Button>
        </div>}
        {((row.can_undo_arrival && row.checked_in_at) || row.can_undo_absence) &&
          <Button disabled={review.isPending} onClick={()=>review.mutate("undo")}>출결 취소</Button>}
        {row.can_review && <div role="group" aria-label="클리닉 신청 처리">
          <Button intent="primary" disabled={review.isPending} onClick={()=>review.mutate("booked")}>예약 승인</Button>
          <Button disabled={review.isPending} onClick={()=>review.mutate("rejected")}>신청 반려</Button>
        </div>}
        {review.isSuccess && <p role="status">{review.variables && {booked:"예약을 승인했습니다.", rejected:"신청을 반려했습니다.", attended:"출석을 기록했습니다.", no_show:"결석을 기록했습니다.", undo:"출결을 취소하고 예약 확정으로 되돌렸습니다."}[review.variables]}</p>}
        {review.isError && <p role="alert">{getApiErrorMessage(review.error,"처리하지 못했습니다. 현재 상태를 다시 확인해 주세요.")}</p>}
      </div>}</ModalBody>
  </AdminModal>;
}

export default function DawonAdminDirectories() {
  const {pathname}=useLocation();
  return pathname==="/workspace/results/students" ? <DawonStudentResults/> : <CareDirectory/>;
}

export function CareDirectory({teacher=false,embedded=false}:{teacher?:boolean;embedded?:boolean}) {
  const {pathname,state}=useLocation();
  const [params,setParams]=useSearchParams();
  const clinic=pathname==="/workspace/clinic/operations";
  const kind=clinic?"clinic":params.get("kind")==="appointments"?"appointments":"requests";
  const group=params.get("group") || "";
  const search=typeof state?.directorySearch==="string" ? state.directorySearch : "";
  const q=useDebouncedValue(search.trim());
  const page=Math.max(1,Number(params.get("page")) || 1);
  const filters:Record<string,string>={view:"care",kind,group,q,page:String(page)};
  if ((clinic || kind==="requests") && params.get("status")) filters.status=params.get("status")!;
  if (!clinic) for (const key of ["from","to"]) {
    const value=params.get(key);
    if (value) filters[key]=value;
  }
  if (teacher) filters.scope="assigned";
  const query=useDirectory<CareRow>(filters);
  function update(key:string,value:string) {
    const next=new URLSearchParams(params);
    if (key==="kind") next.delete("status");
    if (key==="from" && value && next.get("to") && value>next.get("to")!) next.set("to",value);
    if (key==="to" && value && next.get("from") && value<next.get("from")!) next.set("from",value);
    if (key!=="record") next.delete("record");
    if (key!=="page" && key!=="record") next.delete("page");
    if (key!=="q" && value) next.set(key,value); else next.delete(key);
    setParams(next,{replace:key==="q",preventScrollReset:true,state:{directorySearch:key==="q"?value:search}});
  }
  const count=query.data?.count ?? 0;
  const lastPage=Math.max(1,Math.ceil(count/25));
  useEffect(()=>{
    if (!query.isSuccess || page<=lastPage) return;
    const next=new URLSearchParams(params);
    next.set("page",String(lastPage));
    setParams(next,{replace:true,preventScrollReset:true,state});
  },[lastPage,page,params,query.isSuccess,setParams,state]);
  const title=clinic?"클리닉":"상담";
  const content=<div className={desk.desk}>
      {!clinic && <div className={desk.switcher} role="group" aria-label="상담 구분">
        <Button aria-pressed={kind==="requests"} onClick={()=>update("kind","")}>학부모 상담 신청</Button>
        <Button aria-pressed={kind==="appointments"} onClick={()=>update("kind","appointments")}>등록한 상담 일정</Button>
      </div>}
      <DomainListToolbar totalLabel={query.data ? "기록 "+count+"건" : "조회 중"}
        searchSlot={<DawonSearchInput className="ds-input" aria-label="학생 이름 검색" placeholder="학생 이름 검색" maxLength={100} value={search} onSearch={text=>update("q",text)}/>}
        filterSlot={<>
          <AdminGroupSelect value={group} teacher={teacher} onChange={id=>update("group",id)}/>
          {kind==="requests" && <label className={styles.field}>답변 상태
            <select value={params.get("status") || ""} onChange={e=>update("status",e.target.value)}>
              <option value="">전체</option><option value="waiting">답변 대기</option><option value="answered">답변 완료</option>
            </select></label>}
          {!clinic && <><label className={styles.field}>시작일<input className="ds-input" type="date"
            value={params.get("from") || ""} onChange={e=>update("from",e.target.value)}/></label>
            <label className={styles.field}>종료일<input className="ds-input" type="date"
            value={params.get("to") || ""} onChange={e=>update("to",e.target.value)}/></label></>}
          {clinic && <label className={styles.field}>처리 상태
            <select value={params.get("status") || ""} onChange={e=>update("status",e.target.value)}>
              <option value="">전체 상태</option>
              {Object.entries(states).map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
        </>} primaryAction={null}/>
      {query.isPending?<p role="status">목록을 불러오는 중입니다.</p>:query.isError?
        <p role="alert">목록을 불러오지 못했습니다. <Button onClick={()=>void query.refetch()}>다시 시도</Button></p>:
        !count?<p className={styles.empty}>조건에 맞는 기록이 없습니다.</p>:
        <DomainTable tableClassName={desk.directory} scrollLabel={title+" 목록"}><thead><tr><th>학생</th><th>반</th>
          <th>{clinic?"클리닉":"상담"}</th><th>일자</th><th>상태</th></tr></thead>
          <tbody>{query.data.rows.map(row=>{
            return <tr key={row.id}><th scope="row">{row.name}<small className={desk.mobileMeta}>{row.groups.join(", ") || "미편성"}</small></th><td>{row.groups.join(", ") || "미편성"}</td>
              <td><button type="button" className={styles.textAction} onClick={()=>update("record",String(row.id))}>{row.title}</button><small className={desk.mobileMeta}>{row.day || "미정"}</small></td>
              <td className={desk.date}>{row.day || "미정"}</td><td><span className={desk.status} data-state={row.status}>{states[row.status] ?? row.status}</span></td></tr>;
          })}</tbody></DomainTable>}
      {(count>25 || page>1) && <nav className={styles.pagination} aria-label="목록 페이지">
        <Button disabled={page<=1} onClick={()=>update("page",String(page-1))}>이전</Button><span>{page} / {Math.max(1,Math.ceil(count/25))}</span>
        <Button disabled={page*25>=count} onClick={()=>update("page",String(page+1))}>다음</Button></nav>}
      {params.get("record") && <CareDetail key={params.get("record")} filters={{...filters,status:"",page:"1",record:params.get("record")!}} close={()=>update("record","")}/>}
    </div>;
  return embedded || teacher ? content : <DomainLayout title={title} breadcrumbs={[]}>{content}</DomainLayout>;
}

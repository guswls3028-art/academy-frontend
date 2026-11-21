import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import DomainTable from "@/shared/ui/domain/DomainTable";
import { Button } from "@/shared/ui/ds";
import { alertEndpoint, alertRules, queueKey } from "./alertQueue";
import { dawonQueryKeys } from "./queryKeys";
import DawonSearchInput from "./DawonSearchInput";
import desk from "./DawonAdminRecords.module.css";
import styles from "./DawonAlertQueue.module.css";
import { dawonUnionTracks, type DawonClassKind } from "./classTypes";
import type { StaffRoom } from "./staffMenu";

type Status = "pending" | "completed";
type Option = {id:number|null; name:string;kind?:DawonClassKind;track?:string};
type Alert = {key:string;student_id:number;student_name:string;group_id:number;group_name:string;lecture_id:number;
  lecture_title:string;rule:keyof typeof alertRules;detail:string;completed_at:string|null;completed_by:string};
type Page = {counts:Record<Status,number>;count:number;alerts:Alert[]};

export default function DawonAlertQueue({role, groups, lectures}: {role:StaffRoom;groups?:Option[];lectures?:{id:number;title:string}[]}) {
  const [params,setParams] = useSearchParams();
  const location = useLocation();
  const status:Status = params.get("status") === "completed" ? "completed" : "pending";
  const group = params.get("group") ?? "", lecture = params.get("lecture_id") ?? "", rule = params.get("rule") ?? "";
  const selectedGroup = groups?.find(g=>String(g.id) === group);
  const kind = params.get("kind") || selectedGroup?.kind || "";
  const track = kind === "union" ? params.get("track") || "" : "";
  const choices = groups?.filter(g=>g.id!=null && (!kind || g.kind===kind) && (!track || g.track===track));
  const search = params.get("q") ?? "";
  const q = useDebouncedValue(search.trim());
  const page = Math.max(1, Number(params.get("page")) || 1);
  const client = useQueryClient();
  const filters = {queue:"list",status,group,kind,track,lecture_id:lecture,rule,q,page};
  const feed = useQuery({queryKey:dawonQueryKeys.alertPage(role,filters),queryFn:async ({signal})=>
    (await api.get<Page>(alertEndpoint,{params:filters,signal})).data});
  const change = useMutation({mutationFn:async (key:string) => api.patch(alertEndpoint, {key,status:status === "completed" ? "pending" : "completed"}),
    onSuccess:async () => {
      await client.invalidateQueries({queryKey:queueKey});
      await client.invalidateQueries({queryKey:dawonQueryKeys.alerts});
      if (page > 1 && feed.data?.alerts.length === 1) filter("page",String(page-1));
    }});
  function filter(key:string,value:string) {
    const next = new URLSearchParams(params);
    if(key !== "page") next.delete("page");
    if(key === "kind") next.delete("track");
    if(key === "kind" || key === "track") next.delete("group");
    if(value) next.set(key,value); else next.delete(key);
    setParams(next,{replace:key==="q",preventScrollReset:true});
    change.reset();
  }
  function reset() {
    setParams(role === "admin" ? {panel:"alerts",status} : {status},{preventScrollReset:true});
    change.reset();
  }
  return <section className={styles.queue} aria-label="학습 경보 처리">
    <div className={styles.switcher} role="group" aria-label="처리 상태">
      {(["pending","completed"] as const).map(item=><button type="button" key={item} aria-pressed={status===item}
        onClick={()=>filter("status",item)}>{item==="pending" ? "미처리" : "처리 완료"}{feed.data && <b>{feed.data.counts[item]}</b>}</button>)}
    </div>
    <div className={styles.filters} role="group" aria-label="경보 조회 조건">
      <DawonSearchInput aria-label="학습 경보 검색" className="ds-input" placeholder="학생 · 반 · 강의 검색" value={search} onSearch={v=>filter("q",v)}/>
      {groups && <select aria-label="반 유형" className="ds-select" value={kind} onChange={e=>filter("kind",e.target.value)}>
        <option value="">전체 반 유형</option><option value="union">연합반</option><option value="school">내신반</option></select>}
      {groups && kind==="union" && <select aria-label="연합반 과정" className="ds-select" value={track} onChange={e=>filter("track",e.target.value)}>
        <option value="">전체 과정</option>{dawonUnionTracks.map(t=><option key={t}>{t}</option>)}</select>}
      {choices && <select aria-label="반 범위" className="ds-select" value={group} onChange={e=>filter("group",e.target.value)}>
        <option value="">전체 반</option>{choices.map(g=><option key={g.id} value={String(g.id)}>{g.name}</option>)}</select>}
      {lectures && <select aria-label="담당 강의" className="ds-select" value={lecture} onChange={e=>filter("lecture_id",e.target.value)}>
        <option value="">모든 담당 강의</option>{lectures.map(l=><option key={l.id} value={l.id}>{l.title}</option>)}</select>}
      <select aria-label="경보 사유" className="ds-select" value={rule} onChange={e=>filter("rule",e.target.value)}>
        <option value="">전체 사유</option>{Object.entries(alertRules).map(([key,r])=><option key={key} value={key}>{r.label}</option>)}</select>
      {(search||kind||group||lecture||rule) && <Button size="sm" intent="ghost" onClick={reset}>조건 초기화</Button>}
    </div>
    {feed.isError ? <p role="alert">학습 경보를 불러오지 못했습니다. <Button onClick={()=>void feed.refetch()}>다시 시도</Button></p> :
      feed.isPending ? <p role="status">경보를 조회하고 있습니다.</p> : !feed.data.alerts.length ?
      <p>{kind||group||lecture||rule||search ? "조건에 맞는 경보가 없습니다." : status==="pending" ? "처리할 학습 경보가 없습니다." : "처리 완료한 경보가 없습니다."}</p> :
      <DomainTable scrollLabel="학습 경보 목록" tableClassName="ds-table--flat"><thead><tr><th>학생</th><th>반 · 강의</th><th>경보 사유</th>
        {status==="completed" && <th>처리 기록</th>}<th>처리</th></tr></thead><tbody>
        {feed.data.alerts.map(row=><tr key={row.key}><th scope="row"><Link state={{alertReturn:location.pathname+location.search}}
          to={role==="admin" ? "/workspace/dashboard?"+new URLSearchParams({panel:"student",course:String(row.lecture_id),student:String(row.student_id),group:String(row.group_id)}) :
          "/workspace/students/home?student="+row.student_id}>{row.student_name}</Link></th>
          <td>{row.group_name}<small className={desk.secondary}>{row.lecture_title}</small></td>
          <td>{alertRules[row.rule]?.label}<small className={desk.secondary}>{row.detail}</small></td>
          {status==="completed" && <td>{row.completed_at && new Date(row.completed_at).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}
            <small className={desk.secondary}>{row.completed_by || "담당자"}</small></td>}
          <td><Button size="sm" disabled={change.isPending} onClick={()=>change.mutate(row.key)}>{status==="pending" ? "처리 완료" : "미처리로"}</Button></td></tr>)}
      </tbody></DomainTable>}
    {change.isError && <p role="alert">{getApiErrorMessage(change.error,"처리 상태를 저장하지 못했습니다. 다시 시도해 주세요.")}</p>}
    {(page>1 || (feed.data?.count ?? 0)>25) && <nav aria-label="경보 페이지" className={styles.paging}>
      <Button size="sm" disabled={page<=1} onClick={()=>filter("page",String(page-1))}>이전</Button>
      <span>{page} / {Math.max(1, Math.ceil((feed.data?.count ?? 0)/25))}</span>
      <Button size="sm" disabled={page*25 >= (feed.data?.count ?? 0)} onClick={()=>filter("page",String(page+1))}>다음</Button></nav>}
  </section>;
}

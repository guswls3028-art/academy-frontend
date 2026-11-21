import LectureChipLabel from "@/shared/ui/chips/LectureChipLabel";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { Link, useLocation, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";
import { DomainLayout, DomainTable } from "@/shared/ui/domain";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { dawonQueryKeys } from "./queryKeys";
import styles from "./DawonAdminDesk.module.css";

type Student = {id:number; name:string; school:string; grade:number|null; phone:string; parent_phone:string;
  groups:{id:number;name:string}[]; courses?:{id:number;title:string;group:number;color:string;chip_label:string}[]};
type Page = {count:number;results:Student[]};
const root = "/workspace/students/home";
const endpoint = "/students/class-groups/";
const pageSize = 25;

export default function DawonAdminStudents() {
  const [params,setParams] = useSearchParams();
  const {state} = useLocation();
  const search = typeof state?.directoryTerm === "string" ? state.directoryTerm : "";
  const term = useDebouncedValue(search.trim());
  const grade = params.get("grade") || "", group = params.get("group") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const selected = params.get("student");
  const filters = {view:"students", search:term, grade, group, offset:(page-1)*pageSize, limit:pageSize};
  const groups = useQuery({queryKey:dawonQueryKeys.adminGroups,queryFn:async({signal})=>
    (await api.get<{id:number;name:string}[]>(endpoint,{signal})).data});
  const people = useQuery({queryKey:dawonQueryKeys.studentPage(filters),queryFn:async({signal})=>
    (await api.get<Page>(endpoint,{params:filters,signal})).data});
  const person = useQuery({queryKey:dawonQueryKeys.studentDetail(selected),enabled:!!selected,queryFn:async({signal})=>
    (await api.get<Page>(endpoint,{params:{view:"students",id:selected},signal})).data.results[0] ?? null});
  const update = (key:string,value:string) => {
    const next = new URLSearchParams(params);
    next.delete("student");
    if(key!=="page") next.delete("page");
    if(key!=="q" && value) next.set(key,value); else next.delete(key);
    setParams(next,{replace:key==="q",preventScrollReset:true,state:{directoryTerm:key==="q"?value:search}});
  };
  const detailUrl = (id?:number) => {
    const next = new URLSearchParams(params);
    if(id) next.set("student",String(id)); else next.delete("student");
    return {pathname:root,search:next.toString()};
  };
  const row = person.data;
  const pages = Math.max(1,Math.ceil((people.data?.count ?? 0)/pageSize));
  return <DomainLayout title="학생 명단" breadcrumbs={[]} density="compact">
    <div className={styles.tools} role="group" aria-label="학생 조회 조건">
      <input type="search" className="ds-input" aria-label="학생 검색" placeholder="이름 · 학교 · 전화번호 검색" value={search} onChange={e=>update("q",e.target.value)}/>
      <select className="ds-select" aria-label="학년" value={grade} onChange={e=>update("grade",e.target.value)}>
        <option value="">전체 학년</option>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}학년</option>)}</select>
      <select className="ds-select" aria-label="소속 반" value={group} onChange={e=>update("group",e.target.value)}>
        <option value="">전체 반</option>{groups.data?.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>
      {(search || grade || group) && <Button size="sm" intent="ghost" onClick={()=>setParams({}, {state:{directoryTerm:""}})}>조건 초기화</Button>}
      <span role="status">{people.isFetching || search.trim()!==term ? "조회 중…" : people.isError ? "조회 실패" : "학생 "+people.data?.count+"명"}</span>
    </div>
    {groups.isError && <p role="alert">반 목록을 불러오지 못했습니다. <Button onClick={()=>void groups.refetch()}>반 목록 다시 시도</Button></p>}
    <div className={styles.split} data-open={selected ? "true" : undefined}>
      <section className={styles.list} aria-label="학생 조회 결과">
        {people.isError ? <p role="alert">학생 명단을 불러오지 못했습니다. <Button onClick={()=>void people.refetch()}>다시 시도</Button></p> :
          people.data && <><DomainTable scrollLabel="학생 명단" tableClassName="ds-table--flat">
            <thead><tr><th>학생 이름</th><th>학교</th><th>학년</th><th>소속 반</th></tr></thead><tbody>
              {people.data.results.map(s=><tr key={s.id}><th scope="row"><Link aria-label={s.name} to={detailUrl(s.id)} state={{directoryTerm:search}} preventScrollReset
                aria-current={String(s.id)===selected ? "true" : undefined}><StudentNameWithLectureChip name={s.name} avatarSize={22} density="compact"/></Link></th><td>{s.school || "미입력"}</td>
                <td>{s.grade ? s.grade+"학년" : "미입력"}</td><td>{s.groups.map(g=>g.name).join(", ") || "미편성"}</td></tr>)}
              {!people.data.count && <tr><td colSpan={4}>조건에 맞는 학생이 없습니다.</td></tr>}
            </tbody></DomainTable>
            {(pages>1 || page>1) && <nav aria-label="학생 목록 페이지" className={styles.paging}><Button size="sm" disabled={page<=1} onClick={()=>update("page",String(page-1))}>이전</Button>
              <span>{page} / {pages}</span><Button size="sm" disabled={page>=pages} onClick={()=>update("page",String(page+1))}>다음</Button></nav>}</>}
      </section>
      {selected && <section className={styles.inspector} aria-label="학생 상세">
        {state?.courseReturn ? <Link to={state.courseReturn}>강의 수강 명단으로</Link> :
          <Link to={detailUrl()} state={{directoryTerm:search}} preventScrollReset>학생 목록</Link>}
        {person.isPending ? <p role="status">학생 상세 조회 중…</p> : person.isError ? <p role="alert">상세 조회에 실패했습니다. <Button onClick={()=>void person.refetch()}>다시 시도</Button></p> :
          row ? <><h2>{row.name}</h2><dl className={styles.fields}>
            <dt>학교 · 학년</dt><dd>{row.school || "학교 미입력"} · {row.grade ? row.grade+"학년" : "학년 미입력"}</dd>
            <dt>학생 연락처</dt><dd>{row.phone || "미입력"}</dd><dt>학부모 연락처</dt><dd>{row.parent_phone || "미입력"}</dd>
            <dt>소속 반</dt><dd>{row.groups.length ? row.groups.map(g=><Link key={g.id} to={"/workspace/students/class-groups?class="+g.id}>{g.name}</Link>) : "미편성"}</dd></dl>
            <h3>수강 중인 강의</h3>{row.courses?.length ? <DomainTable scrollLabel="학생 수강 강의" tableClassName="ds-table--flat"><thead><tr><th>강의</th><th>학습 기록</th></tr></thead>
              <tbody>{row.courses.map(c=><tr key={c.id}><td><Link to={"/workspace/lectures/"+c.id+"?group="+c.group} aria-label={c.title}><LectureChipLabel lectureName={c.title} color={c.color} chipLabel={c.chip_label}/></Link></td><td><Link state={{directorySearch:params.toString(),directoryTerm:search}}
                to={"/workspace/results?"+new URLSearchParams({panel:"student",origin:"directory",course:String(c.id),group:String(c.group),student:String(row.id)})}>기록 보기</Link></td></tr>)}</tbody>
            </DomainTable> : <p>반에 연결된 수강 강의가 없습니다.</p>}</> : <p>조회할 수 없는 학생입니다.</p>}
      </section>}
    </div>
  </DomainLayout>;
}

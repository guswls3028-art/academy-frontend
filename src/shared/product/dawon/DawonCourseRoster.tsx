import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { DomainTable } from "@/shared/ui/domain";
import { Button } from "@/shared/ui/ds";
import { DawonLectureEnrollment } from "./DawonLectureEnrollment";
import { dawonQueryKeys } from "./queryKeys";
import styles from "./DawonAdminDesk.module.css";

type Member = {id:number; name:string; school:string; grade:number|null};
const limit = 25;

export default function DawonCourseRoster({course, title, groupId, groupName}: {
  course:number; title:string; groupId:number|null; groupName:string;
}) {
  const client = useQueryClient();
  const location = useLocation();
  const [input,setInput] = useState("");
  const [offset,setOffset] = useState(0);
  const [adding,setAdding] = useState(false);
  const search = useDebouncedValue(input.trim());
  const key = dawonQueryKeys.courseRoster(course);
  const roster = useQuery({queryKey:dawonQueryKeys.courseRosterPage(course,search,offset),queryFn:async ({signal}) =>
    (await api.get<{count:number;results:Member[]}>("/students/class-groups/",{
      params:{view:"students", lecture:course,search,offset,limit},signal
    })).data});
  function saved() {
    void client.invalidateQueries({queryKey:key});
    void client.invalidateQueries({queryKey:dawonQueryKeys.adminOperations});
    void client.invalidateQueries({queryKey:dawonQueryKeys.adminStudentRoot});
    void client.invalidateQueries({queryKey:dawonQueryKeys.groups});
  }
  return <section aria-label="강의 수강 명단">
    <div className={styles.tools}><input className="ds-input" type="search" aria-label="수강생 검색" placeholder="이름 · 학교 · 전화번호 검색" value={input}
      onChange={e=>{setInput(e.target.value);setOffset(0);}}/>
      <span role="status">{roster.isPending || search!==input.trim() ? "수강생 조회 중" : roster.data ? `수강생 ${roster.data.count}명` : "조회 실패"}</span>
      {groupId!==null && <Button onClick={()=>setAdding(true)} intent="primary">수강생 등록</Button>}
    </div>
    {roster.isError ? <p role="alert">수강 명단을 불러오지 못했습니다. <Button onClick={()=>void roster.refetch()}>다시 시도</Button></p> :
    roster.data && <DomainTable scrollLabel="등록된 수강생"><thead><tr><th>학생</th><th>학교</th><th>학년</th></tr></thead><tbody>
      {roster.data.results.map(s=><tr key={s.id}><th scope="row"><Link aria-label={s.name} state={{courseReturn:location.pathname+location.search}} to={"/workspace/students/home?student="+s.id}><StudentNameWithLectureChip name={s.name} avatarSize={22} density="compact"/></Link></th>
        <td>{s.school || "미입력"}</td><td>{s.grade ? s.grade+"학년" : "미입력"}</td></tr>)}
      {!roster.data.count && <tr><td colSpan={3}>{search ? "검색 결과가 없습니다." : "등록된 수강생이 없습니다."}</td></tr>}
    </tbody></DomainTable>}
    {roster.data && roster.data.count>limit && <nav className={styles.paging} aria-label="수강 명단 페이지">
      <Button disabled={offset===0} onClick={()=>setOffset(offset-limit)}>이전</Button>
      <span>{offset/limit+1} / {Math.ceil(roster.data.count/limit)}</span>
      <Button disabled={offset+limit>=roster.data.count} onClick={()=>setOffset(offset+limit)}>다음</Button>
    </nav>}
    {adding && groupId!==null && <DawonLectureEnrollment lectureId={course} lectureTitle={title} group={{group_id:groupId,name:groupName,school:""}} onClose={()=>setAdding(false)} onSaved={saved}/>}
  </section>;
}

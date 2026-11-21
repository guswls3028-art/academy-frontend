import LectureChipLabel from "@/shared/ui/chips/LectureChipLabel";
import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { DomainLayout } from "@/shared/ui/domain";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import ClassGroupsPage from "./ClassGroupsPage";
import DawonDirectoryTable from "./DawonDirectoryTable";
import { DawonLectureEnrollment } from "./DawonLectureEnrollment";
import { dawonQueryKeys } from "./queryKeys";
import styles from "./DawonAdminDesk.module.css";

type Course = {color:string;chip_label:string;id:number;title:string;instructor:string;students:number;lessons:number;is_active:boolean};
type Group = {id:number|null;name:string;courses:Course[]};
type Row = Course & {group: Pick<Group,"id"|"name">};
type Class = {id:number;name:string;student_count:number;instructor_name:string};

function LectureRegister() {
  const client=useQueryClient();
  const navigate=useNavigate();
  const location=useLocation();
  const [params,setParams]=useSearchParams();
  const search = params.get("q") || "", status = params.get("status") || "", group = params.get("scope") || "";
  const [adding,setAdding]=useState<Row|null>(null);
  const [creating,setCreating]=useState(false);
  const [classId,setClassId]=useState("");
  const classes=useQuery({queryKey:dawonQueryKeys.adminGroups,queryFn:async ({signal})=>
    (await api.get<Class[]>("/students/class-groups/",{signal})).data});
  const catalog=useQuery({queryKey:dawonQueryKeys.operationsOverview(),queryFn:async({signal})=>
    (await api.get<{groups:Group[]}>("/students/demo-operations/",{signal})).data});
  function change(key:string,value:string) {
    const next=new URLSearchParams(params);
    if(value)next.set(key,value);else next.delete(key);
    setParams(next,{replace:key==="q",preventScrollReset:true});
  }
  const term=search.replace(/\s+/g,"").toLocaleLowerCase();
  const rows: Row[]=(catalog.data?.groups || []).filter(g=>!group || (g.id===null?"none":String(g.id))===group)
    .flatMap(g=>g.courses.map(course=>({...course,group:{id:g.id,name:g.name}})))
    .filter(c=>(!status || c.is_active===(status==="active")) && [c.title,c.group.name,c.instructor].some(t=>t?.replace(/\s+/g,"").toLocaleLowerCase().includes(term)));
  const eligible=classes.data?.filter(c=>c.student_count>0 && c.instructor_name) ?? [];
  return <DomainLayout title="강의 관리" density="compact" breadcrumbs={[]}>
    <div className={styles.tools} role="group" aria-label="강의 조회 조건">
      <input className="ds-input" type="search" aria-label="강의 검색" placeholder="강의명 · 반 · 담당 강사 검색" value={search} onChange={e=>change("q",e.target.value)}/>
      <select className="ds-select" aria-label="반 필터" value={group} onChange={e=>change("scope",e.target.value)}><option value="">전체 반</option>
        {catalog.data?.groups.map(g=><option key={g.id??"none"} value={g.id??"none"}>{g.name}</option>)}</select>
      <select className="ds-select" aria-label="운영 상태" value={status} onChange={e=>change("status",e.target.value)}><option value="">전체 상태</option><option value="active">운영 중</option><option value="closed">종료</option></select>
      <span role="status">{catalog.isPending ? "강의 조회 중…" : catalog.isError ? "조회 실패" : "강의 "+rows.length+"개"}</span>
      <Button intent="primary" onClick={()=>{setClassId(eligible.some(c=>String(c.id)===group)?group:"");setCreating(true);}}>수업 개설</Button>
    </div>
    {catalog.isError ? <p role="alert">강의 목록을 불러오지 못했습니다. <Button onClick={()=>void catalog.refetch()}>다시 시도</Button></p> :
      catalog.data && <DawonDirectoryTable id="dawon-admin-course-catalog" label="강의 목록" rows={rows} empty="조건에 맞는 강의가 없습니다." columns={[
        {key:"title",label:"강의명",defaultWidth:270,value:r=>r.title,render:r=><Link aria-label={r.title} state={{lectureSearch:location.search}} to={"/workspace/lectures/"+r.id+(r.group.id ? "?group="+r.group.id : "")}><LectureChipLabel lectureName={r.title} color={r.color} chipLabel={r.chip_label}/></Link>},
        {key:"group",label:"소속 반",defaultWidth:140,value:r=>r.group.name,render:r=>r.group.id ? <Link to={"/workspace/lectures?class="+r.group.id}>{r.group.name}</Link> : r.group.name},
        {key:"teacher",label:"담당 강사",defaultWidth:100,value:r=>r.instructor || "미지정"},
        {key:"members",label:"수강생",defaultWidth:75,value:r=>r.students,render:r=>r.students+"명"},
        {key:"lessons",label:"차시",defaultWidth:70,value:r=>r.lessons,render:r=>r.lessons+"회"},
        {key:"state",label:"상태",defaultWidth:90,value:r=>r.is_active?"운영 중":"종료"},
        {key:"enroll",label:"수강 등록",defaultWidth:110,value:r=>r.group.id===null?"미편성":"수강생 등록",render:r=>r.group.id===null?"미편성":
          <button className={styles.rowAction} onClick={()=>setAdding(r)} aria-label={r.title+" 수강생 등록"}>수강생 등록</button>},
      ]}/>}
    {adding && <DawonLectureEnrollment lectureId={adding.id} lectureTitle={adding.title} group={{group_id:adding.group.id,name:adding.group.name,school:""}} onClose={()=>setAdding(null)}
      onSaved={()=>{void client.invalidateQueries({queryKey:dawonQueryKeys.adminOperations});void client.invalidateQueries({queryKey:dawonQueryKeys.groups});void client.invalidateQueries({queryKey:dawonQueryKeys.courseRoster(adding.id)});void client.invalidateQueries({queryKey:dawonQueryKeys.adminStudentRoot});}}/>}
    {creating && <AdminModal open onClose={()=>setCreating(false)} noMinimize trapFocus width={460}><ModalHeader title="수업을 개설할 반 선택"/>
      <ModalBody>{classes.isPending ? <p role="status">반 조회 중…</p> : classes.isError ? <p role="alert">반을 불러오지 못했습니다. <Button onClick={()=>void classes.refetch()}>다시 시도</Button></p> :
        eligible.length ? <label>개설 반 <select className="ds-select" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">반 선택</option>{eligible.map(c=><option key={c.id} value={c.id}>{c.name} · {c.instructor_name}</option>)}</select></label> :
          <p>담당 강사와 학생이 있는 반에서 수업을 개설할 수 있습니다. <Link to="/workspace/students/class-groups">반 편성</Link></p>}</ModalBody>
      <ModalFooter right={<><Button onClick={()=>setCreating(false)}>취소</Button><Button intent="primary" disabled={!classId} onClick={()=>navigate("/workspace/lectures?class="+classId+"&create=lecture")}>수업 개설로</Button></>}/></AdminModal>}
  </DomainLayout>;
}

export default function DawonAdminLectures() {
  const [params]=useSearchParams();
  return params.get("class") || params.get("view")==="list" ? <ClassGroupsPage lectureEntry/> : <LectureRegister/>;
}

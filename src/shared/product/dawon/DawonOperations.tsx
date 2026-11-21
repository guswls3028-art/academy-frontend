import LectureChipLabel from "@/shared/ui/chips/LectureChipLabel";
import DomainListToolbar from "@/shared/ui/domain/DomainListToolbar";
import DawonDirectoryTable from "./DawonDirectoryTable";
import { resultTabs } from "./staffMenu";
import { dawonQueryKeys } from "./queryKeys";
import {AdminAlerts, AdminExamReview, AdminStudentReview, ExamLinks} from "./DawonAdminLearning";
import recordsDesk from "./DawonAdminRecords.module.css";
import DomainTable from "@/shared/ui/domain/DomainTable";
import DawonCourseRoster from "./DawonCourseRoster";
import DawonDailyAttendance from "./DawonDailyAttendance";
import {todayInSeoul, useDawonDailyAttendance} from "./useDawonDailyAttendance";
import DawonStaffDirectory from "./DawonStaffDirectory";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router";
import api from "@/shared/api/axios";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import { Button } from "@/shared/ui/ds";
import styles from "./DawonOperations.module.css";

type Exam = {id: number; title: string; date:string|null; graded: number; average: number | null};
type Lesson = {id: number; order: number; title: string; date: string | null};
type Course = {
  color:string; chip_label:string;
  id: number; title: string; is_active: boolean; students: number; lessons: number;
  instructor: string; sessions: Lesson[]; exams: Exam[];
  homework: {id: number; title: string; session_id: number; status: "DRAFT" | "OPEN" | "CLOSED"; progress: {assigned: number; submitted: number; missing: number; graded: number; deferred: number}}[];
};
type Operations = {
  groups: {id: number | null; name: string; members: number | null; courses: Course[]}[];
  exams: Exam[];
};
const endpoint = "/students/demo-operations/";


const sections = [
  { key: "lessons", label: "수업 차시" },
  { key: "roster", label: "수강 명단" },
  { key: "exams", label: "시험 결과" },
  { key: "homework", label: "과제 현황" },
] as const;

function CourseDetails({course, groupId, groupName, section, onSection}: {
  course: Course; groupId: number | null; groupName:string; section: string; onSection: (key: string) => void;
}) {
  const lessonNames = new Map(course.sessions.map(lesson => [lesson.id, lesson.title || `${lesson.order}차시`]));
  return <div className={styles.detailBody}>
      <div role="group" aria-label="강의 상세 항목" className={styles.sectionPicker}>
        {sections.map(item => <button type="button" key={item.key} aria-pressed={section === item.key} onClick={() => onSection(item.key)}>{item.label}</button>)}
      </div>
      {section === "roster" && <DawonCourseRoster key={course.id} course={course.id} title={course.title} groupName={groupName} groupId={groupId}/>}
      {section === "lessons" && <>
      {course.sessions.length ? <ul>{course.sessions.map(lesson => <li key={lesson.id}>
        <strong>{lessonNames.get(lesson.id)}</strong><span>{lesson.date || "일정 미정"}</span>
      </li>)}</ul> : <p>등록된 차시가 없습니다.</p>}
      </>}
      {section === "exams" && <>
      {course.exams.length ? <ul>{course.exams.map(exam => <li key={exam.id}>
        <strong><ExamLinks course={course.id} exam={exam.id} group={groupId} title={exam.title}/></strong><span>{exam.average === null ? "채점 대기" : `채점 ${exam.graded}건 · 평균 ${Number(exam.average.toFixed(1))}점`}</span>
      </li>)}</ul> : <p>연결된 시험이 없습니다.</p>}
      </>}
      {section === "homework" && <>
      {course.homework.length ? <ul>{course.homework.map(item => <li key={item.id}>
        <strong>{item.title}</strong><span>{lessonNames.get(item.session_id)} · {{DRAFT: "초안", OPEN: "진행 중", CLOSED: "마감"}[item.status]}</span>
        <small className={styles.progress}>{item.progress.assigned ? `대상 ${item.progress.assigned}명 · 제출 ${item.progress.submitted}명 · 미제출 ${item.progress.missing}명 · 채점 ${item.progress.graded}명${item.progress.deferred ? ` · 검사 보류 ${item.progress.deferred}명` : ""}` : "배정된 수강생이 없습니다."}</small>
      </li>)}</ul> : <p>등록된 과제가 없습니다.</p>}
      </>}
    </div>;
}

type GroupSummary = {id:number;name:string;kind:"union"|"school";track:string;school:string;instructor_name:string;student_count:number;lecture_count:number};

function Dashboard() {
  const compact=useIsMobile();
  const [params,setParams]=useSearchParams();
  const day=params.get("date") ?? todayInSeoul();
  const search=params.get("q") ?? "";
  const attention=params.get("attention") || "";
  const daily=useDawonDailyAttendance(day,null);
  const dailyGroups=new Map(daily.data?.groups.map(row=>[row.id,row]));
  function updateFilter(key:string,value:string) {
    const next=new URLSearchParams(params);
    if (value) next.set(key,value); else next.delete(key);
    setParams(next,{replace:key==="q",preventScrollReset:true});
  }
  const attendanceUrl=(group?:number)=>{
    const next=new URLSearchParams({panel:"attendance",date:day});
    if(search) next.set("q",search);
    if(attention) next.set("attention",attention);
    if(group!==undefined) next.set("group",String(group));
    return "/workspace/dashboard?"+next;
  };
  const groups=useQuery({queryKey:dawonQueryKeys.adminGroups,queryFn:async({signal})=>
    (await api.get<GroupSummary[]>("/students/class-groups/",{signal})).data});
  const alerts=useQuery({queryKey:dawonQueryKeys.adminLearning({alerts:"1"}),queryFn:async({signal})=>
    (await api.get<{alerts:{group_id:number}[]}>(endpoint,{params:{alerts:"1"},signal})).data});
  const counts=new Map<number,number>();
  for (const item of alerts.data?.alerts ?? []) counts.set(item.group_id,(counts.get(item.group_id)??0)+1);
  const matching=(groups.data ?? []).filter(row=>[row.name,row.instructor_name,row.school,row.track].some(value=>value?.toLowerCase().includes(search.trim().toLowerCase())));
  const rows = matching.filter(row => {
    if (attention === "alerts") return (counts.get(row.id) ?? 0) > 0;
    const entry = dailyGroups.get(row.id);
    return attention !== "attendance" || Boolean(entry && entry.unset + entry.missing > 0);
  });
  const pendingFilter = (attention === "alerts" && !alerts.data) || (attention === "attendance" && !daily.data);
  const outstanding = (id: number) => {
    const row = dailyGroups.get(id);
    return row ? row.unset + row.missing : 0;
  };
  const byPriority = (left: GroupSummary, right: GroupSummary) =>
    outstanding(right.id) - outstanding(left.id) ||
    (counts.get(right.id) ?? 0) - (counts.get(left.id) ?? 0) ||
    left.name.localeCompare(right.name, "ko", {numeric:true});
  const waiting = matching.filter(row => outstanding(row.id) > 0).length;
  const order = params.get("order") || "";
  function sortBy(key: string, ascending = true) {
    const next = new URLSearchParams(params);
    if (key) { next.set("order", key); next.set("direction", ascending ? "asc" : "desc"); }
    else { next.delete("order"); next.delete("direction"); }
    setParams(next,{replace:true,preventScrollReset:true});
  }
  return <DomainLayout title="반 운영 현황" density="compact" breadcrumbs={[]}>
    <div className={styles.section}>
      <DomainListToolbar totalLabel={groups.isError ? "조회 실패" : groups.isPending || pendingFilter ? "반 조회 중" : "반 "+rows.length+"개"} searchSlot={<input className="ds-input" type="search" aria-label="반 또는 담당 강사 검색" placeholder="반 이름 · 담당 강사 · 학교 검색" value={search} onChange={e=>updateFilter("q",e.target.value)}/>}
        filterSlot={<div className={styles.filterRow}><label className={styles.field}>조회 대상<select value={attention} onChange={event=>updateFilter("attention",event.target.value)}><option value="">전체 반</option><option value="attendance">출결 미입력 반</option><option value="alerts">학습 경보 있는 반</option></select></label><label className={styles.field}>수업 날짜<input className="ds-input" type="date" value={day} onChange={e=>{if(e.target.value)updateFilter("date",e.target.value);}}/></label><Link to={attendanceUrl()}>전체 차시 출결</Link></div>}
        primaryAction={<div className={styles.filterRow}>
          {daily.data && groups.data && <Button size="sm" intent={attention==="attendance" ? "primary" : "secondary"} aria-pressed={attention==="attendance"}
            onClick={()=>updateFilter("attention",attention==="attendance"?"":"attendance")}>출결 미입력 {waiting}개 반</Button>}
          <Link className={styles.actionLink} to="/workspace/dashboard?panel=alerts">전체 반 학습 경보{alerts.data ? " "+alerts.data.alerts.length+"건" : ""}</Link>
          {order && <Button size="sm" onClick={()=>sortBy("")}>업무 우선순으로</Button>}
        </div>}/>
      {alerts.isError && <p role="alert">학습 경보를 확인하지 못했습니다. <Button onClick={()=>void alerts.refetch()}>다시 시도</Button></p>}
      {daily.isError && <p role="alert">선택한 날짜의 출결을 불러오지 못했습니다. <Button onClick={()=>void daily.refetch()}>출결 다시 시도</Button></p>}
      {groups.isPending ? <p role="status">반 운영 현황을 불러오는 중입니다.</p> : groups.isError ?
        <p role="alert">반 목록을 불러오지 못했습니다. <Button onClick={()=>void groups.refetch()}>다시 시도</Button></p> :
        pendingFilter ? <p role="status">{(attention === "alerts" ? alerts.isError : daily.isError) ? "조회 조건의 데이터를 확인해 주세요." : "조회 중입니다."}</p> : !rows.length ? <p className={styles.empty}>{attention==="attendance" ? "조회 범위에 출결 미입력 반이 없습니다." : "조건에 맞는 반이 없습니다."} {attention && <Button onClick={()=>updateFilter("attention","")}>전체 반 보기</Button>}</p> :
        <DawonDirectoryTable id={compact?"dawon-admin-overview-mobile":"dawon-admin-overview"} label="반별 운영 현황" rows={rows}
          defaultCompare={byPriority} sort={{key:order,ascending:params.get("direction")!=="desc"}} onSort={value=>sortBy(value.key,value.ascending)}
          empty="표시할 반이 없습니다." columns={[
          {key:"name",label:compact?"반 · 담당 강사":"반 이름",defaultWidth:compact?155:200,value:r=>r.name,render:r=><>
            <Link to={"/workspace/lectures?class="+r.id}>{r.name}</Link>{compact && <small className={styles.teacherName}>{r.instructor_name || "담당 미지정"}</small>}</>},
          {key:"unmarked",label:"미입력 출결",defaultWidth:compact?91:110,value:r=>{const d=dailyGroups.get(r.id);return d?d.unset+d.missing:-1;},render:r=>{
            if(!daily.data)return daily.isPending?"조회 중":"조회 실패";
            const d=dailyGroups.get(r.id);
            return d?<Link data-attention={d.unset+d.missing>0} aria-label={r.name+" 미입력 출결 상세"} to={attendanceUrl(r.id)}>{d.unset+d.missing}건</Link>:"수업 없음";
          }},
          {key:"alerts",label:"학습 경보",defaultWidth:compact?85:95,value:r=>counts.get(r.id)??0,render:r=>alerts.data?
            <Link data-attention={(counts.get(r.id)??0)>0} aria-label={r.name+" 학습 경보"} to={"/workspace/dashboard?panel=alerts&group="+r.id}>{counts.get(r.id)??0}건</Link>:"—"},
          {key:"instructor",label:"담당 강사",defaultWidth:120,value:r=>r.instructor_name || "미지정"},
          {key:"kind",label:"반 구분",defaultWidth:150,value:r=>r.kind==="union"?"연합반 · "+r.track:"내신반 · "+r.school},
          {key:"students",label:"학생",defaultWidth:75,value:r=>r.student_count,render:r=>r.student_count+"명"},
          {key:"lectures",label:"강의",defaultWidth:75,value:r=>r.lecture_count,render:r=>r.lecture_count+"개"},
        ]}/>}
    </div></DomainLayout>;
}

export default function DawonOperations() {
  const {pathname}=useLocation();
  const [params]=useSearchParams();
  const panel=params.get("panel");
  if (pathname==="/workspace/staff") return <DomainLayout title="직원 관리" breadcrumbs={[]}><div className={styles.section}><DawonStaffDirectory/></div></DomainLayout>;
  if (panel==="student") return <DomainLayout title="학생 학습 기록" density="compact" breadcrumbs={[]}><div className={styles.section}><AdminStudentReview key={params.toString()}/></div></DomainLayout>;
  if (pathname==="/workspace/dashboard" && panel==="alerts") return <AlertDirectory/>;
  if (pathname==="/workspace/dashboard" && panel==="attendance") return <DawonDailyAttendance/>;
  if (pathname==="/workspace/dashboard") {
    const id=params.get("course"), group=params.get("group");
    if (id) return <Navigate replace to={"/workspace/lectures/"+id+"?"+params}/>;
    if (group && group!=="null") return <Navigate replace to={"/workspace/lectures?class="+group}/>;
    return <Dashboard/>;
  }
  return <TeachingRecords/>;
}

function AlertDirectory() {
  const groups=useQuery({queryKey:dawonQueryKeys.adminGroups,queryFn:async({signal})=>
    (await api.get<GroupSummary[]>("/students/class-groups/",{signal})).data});
  return <DomainLayout title="학습 경보" breadcrumbs={[{label:"운영 대시보드",to:"/workspace/dashboard"}]} density="compact">
    <div className={styles.section}>{groups.isError ? <p role="alert">반 목록을 불러오지 못했습니다. <Button onClick={()=>void groups.refetch()}>다시 시도</Button></p> :
      <AdminAlerts groups={groups.data??[]}/>}</div></DomainLayout>;
}

function TeachingRecords() {
  const location=useLocation();
  const {lectureId}=useParams();
  const [params,setParams]=useSearchParams();
  const query=useQuery({queryKey:dawonQueryKeys.operationsOverview(lectureId),queryFn:async({signal})=>(await api.get<Operations>(endpoint,{signal,params:lectureId?{course_overview:lectureId}:undefined})).data});
  const section=sections.find(item=>item.key===params.get("section"))?.key ?? "lessons";
  const groupKey=params.get("group");
  const examFilter = params.get("status") || "all";
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key,value); else next.delete(key);
    setParams(next, {replace:true,preventScrollReset:true});
  }
  const data = query.data;
  const groups = data?.groups ?? [];
  const examGroup = params.get("scope") || "";
  const term = (params.get("q") || "").trim().toLocaleLowerCase();
  const rows = groups.filter(g=>!examGroup||String(g.id)===examGroup).flatMap(g=>g.courses.flatMap(course=>
    course.exams.map(exam=>({group:g,course,exam})))).filter(({exam,group,course})=>[exam.title,group.name,course.title].some(value=>value.toLocaleLowerCase().includes(term))).filter(({exam})=>examFilter === "all" ||
    (examFilter === "pending" ? exam.average === null : exam.average !== null));
  const selectedExam=params.get("exam"), selectedCourse=params.get("course");
  const owner=lectureId ? groups.find(g=>g.courses.some(c=>String(c.id)===lectureId)) : undefined;
  const course=owner?.courses.find(c=>String(c.id)===lectureId);
  const title=lectureId ? course?.title || "강의 상세" : "시험 결과·통계";
  const breadcrumbs=lectureId ? [{label:"강의 관리",to:"/workspace/lectures"+(location.state?.lectureSearch || "")},
    ...(owner?.id ? [{label:owner.name,to:"/workspace/lectures?class="+owner.id}] : [])] : [];
  return <DomainLayout title={title} density={lectureId?"compact":undefined} breadcrumbs={breadcrumbs} tabs={!lectureId && !selectedExam ? resultTabs : undefined}
    description={course ? (course.instructor || "담당 미지정")+" · "+(course.is_active?"운영 중":"종료")+" · 수강생 "+course.students+"명" : undefined}>
    {query.isPending ? <p role="status">운영 현황을 불러오는 중입니다.</p> : query.isError || !data ?
      <p role="alert">운영 현황을 불러오지 못했습니다. <Button onClick={()=>void query.refetch()}>다시 시도</Button></p> :
      <section className={lectureId ? styles.section : recordsDesk.desk} aria-label={title}>
        {lectureId ? course && owner ? <CourseDetails course={course} groupId={owner.id} groupName={owner.name} section={section} onSection={key=>setFilter("section",key)}/> :
          <p role="alert">해당 강의를 찾을 수 없습니다. <Link to="/workspace/lectures">강의 목록으로</Link></p> :
        selectedExam && selectedCourse ?
          <AdminExamReview key={selectedCourse+"-"+selectedExam} course={selectedCourse} exam={selectedExam} group={groupKey}/> : <>
          <div className={recordsDesk.controls}><input type="search" className="ds-input" aria-label="시험 검색" placeholder="시험명 · 반 · 강의 검색" value={params.get("q") || ""} onChange={e=>setFilter("q",e.target.value)}/><strong>시험 {rows.length}개</strong>
          <label className={styles.resultPicker}>반 범위 <select value={examGroup} onChange={e=>setFilter("scope",e.target.value)}>
            <option value="">전체 반</option>{groups.map(g=><option key={String(g.id)} value={String(g.id)}>{g.name}</option>)}</select></label>
          <label className={styles.resultPicker}>채점 상태 <select value={examFilter} onChange={e=>setFilter("status",e.target.value)}>
            <option value="all">전체 시험</option><option value="pending">채점 대기</option><option value="graded">결과 있음</option>
          </select></label>
          </div>
          {rows.length ? <DomainTable scrollLabel="반별 시험 목록"><thead><tr><th>시험명</th><th>시행일</th><th>반·강의</th><th>채점 인원</th><th>평균</th></tr></thead><tbody>
            {rows.map(({group:g,course,exam})=><tr key={course.id+"-"+exam.id}><th scope="row"><ExamLinks group={g.id} course={course.id} exam={exam.id} title={exam.title}/></th>
              <td>{exam.date || "단일 일자 없음"}</td><td><strong>{g.name}</strong><small className={recordsDesk.secondary}><LectureChipLabel lectureName={course.title} color={course.color} chipLabel={course.chip_label}/></small></td><td>{exam.graded}명</td><td>{exam.average == null ? "미집계" : Number(exam.average.toFixed(1))+"점"}</td></tr>)}
          </tbody></DomainTable>:<p>조건에 맞는 시험이 없습니다.</p>}
        </>}
      </section>}
  </DomainLayout>;
}

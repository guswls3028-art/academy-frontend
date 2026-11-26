import DawonDayDesk from "./DawonDayDesk";
import { DawonClassBadge, DawonClassSelect, DawonClassTypeSelect } from "./DawonClassFilters";
import { matchesDawonClassType, readDawonClassType, type DawonClassOption } from "./classTypes";
import DawonSearchInput from "./DawonSearchInput";
import LectureChipLabel from "@/shared/ui/chips/LectureChipLabel";
import { resultTabs } from "./staffMenu";
import { dawonQueryKeys } from "./queryKeys";
import {AdminAlerts, AdminExamReview, AdminStudentReview, ExamLinks} from "./DawonAdminLearning";
import recordsDesk from "./DawonAdminRecords.module.css";
import DomainTable from "@/shared/ui/domain/DomainTable";
import { buildAssessmentSearch } from "@/shared/lib/assessmentQueryParams";
import LectureSessionsPage from "@admin/domains/lectures/pages/sessions/LectureSessionsPage";
import DawonCourseRoster from "./DawonCourseRoster";
import DawonDailyAttendance from "./DawonDailyAttendance";
import DawonStaffDirectory from "./DawonStaffDirectory";
import { useQuery } from "@tanstack/react-query";
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
      {section === "lessons" && <LectureSessionsPage autoAssignRegular={groupId !== null}/>}
      {section === "exams" && <>
      {course.exams.length ? <ul>{course.exams.map(exam => <li key={exam.id}>
        <strong><ExamLinks course={course.id} exam={exam.id} group={groupId} title={exam.title}/></strong><span>{exam.average === null ? "채점 대기" : `채점 ${exam.graded}건 · 평균 ${Number(exam.average.toFixed(1))}점`}</span>
      </li>)}</ul> : <p>연결된 시험이 없습니다.</p>}
      </>}
      {section === "homework" && <>
      {course.homework.length ? <ul>{course.homework.map(item => <li key={item.id}>
        <strong><Link to={`/workspace/lectures/${course.id}/sessions/${item.session_id}/assignments${buildAssessmentSearch("homework",item.id)}`}>{item.title}</Link></strong><span>{lessonNames.get(item.session_id)} · {{DRAFT: "초안", OPEN: "진행 중", CLOSED: "마감"}[item.status]}</span>
        <small className={styles.progress}>{item.progress.assigned ? `대상 ${item.progress.assigned}명 · 제출 ${item.progress.submitted}명 · 미제출 ${item.progress.missing}명 · 채점 ${item.progress.graded}명${item.progress.deferred ? ` · 검사 보류 ${item.progress.deferred}명` : ""}` : "배정된 수강생이 없습니다."}</small>
      </li>)}</ul> : <p>등록된 과제가 없습니다.</p>}
      </>}
    </div>;
}

type GroupSummary = {id:number;name:string;kind:"union"|"school";track:string;school:string;instructor_name:string;student_count:number;lecture_count:number};

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
    return <DawonDayDesk/>;
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
    if(key==="scope") for(const item of ["statsCourse","statsSession","statsExam","statsStudent"]) next.delete(item);
    if (value && value !== "all") next.set(key,value); else next.delete(key);
    setParams(next, {replace:true,preventScrollReset:true});
  }
  const data = query.data;
  const groups = data?.groups ?? [];
  const examGroup = params.get("scope") || "";
  const classType = readDawonClassType(params.get("classType"));
  const classes = useQuery({queryKey:dawonQueryKeys.adminGroups, enabled: !lectureId, queryFn:async({signal}) =>
    (await api.get<DawonClassOption[]>("/students/class-groups/",{signal})).data});
  const byClass = new Map(classes.data?.map(group => [group.id, group]));
  const matchingClasses = (classes.data ?? []).filter(group => matchesDawonClassType(group,classType));
  function changeClassType(value: string) {
    const next = new URLSearchParams(params);
    for(const key of ["statsCourse","statsSession","statsExam","statsStudent"]) next.delete(key);
    if (value) next.set("classType", value); else next.delete("classType");
    if (value && examGroup && !matchesDawonClassType(byClass.get(Number(examGroup)),value)) next.delete("scope");
    setParams(next,{replace:true,preventScrollReset:true});
  }
  const term = (params.get("q") || "").trim().toLocaleLowerCase();
  const rows = groups.filter(g=>(!examGroup||String(g.id)===examGroup) && matchesDawonClassType(g.id === null ? undefined : byClass.get(g.id), classType)).flatMap(g=>g.courses.flatMap(course=>
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
          <div className={recordsDesk.controls}><DawonSearchInput className="ds-input" aria-label="시험 검색" placeholder="시험명 · 반 · 강의 검색" value={params.get("q") || ""} onSearch={text=>setFilter("q",text)}/><strong>시험 {rows.length}개</strong>
          <DawonClassTypeSelect value={classType} onChange={changeClassType}/>
          <DawonClassSelect groups={matchingClasses} value={examGroup} onChange={value=>setFilter("scope",value)}
            unassigned={!classType && groups.some((item)=>item.id === null)}/>
          {classes.isError && <Button size="sm" onClick={()=>void classes.refetch()}>반 목록 다시 불러오기</Button>}
          <label className={styles.resultPicker}>채점 상태 <select value={examFilter} onChange={e=>setFilter("status",e.target.value)}>
            <option value="all">전체 시험</option><option value="pending">채점 대기</option><option value="graded">결과 있음</option>
          </select></label>
          </div>
          {classType && classes.isPending ? <p role="status">반 목록을 불러오는 중입니다.</p> : classType && classes.isError ? <p role="alert">반 목록을 불러오지 못했습니다.</p> : rows.length ? <DomainTable scrollLabel="반별 시험 목록"><thead><tr><th>시험명</th><th>시행일</th><th>반·강의</th><th>채점 인원</th><th>평균</th></tr></thead><tbody>
            {rows.map(({group:g,course,exam})=>{ const classGroup = g.id === null ? undefined : byClass.get(g.id); return <tr key={course.id+"-"+exam.id}><th scope="row"><ExamLinks group={g.id} course={course.id} exam={exam.id} title={exam.title}/></th>
              <td>{exam.date || "단일 일자 없음"}</td><td><strong>{g.name}</strong> {classGroup && <DawonClassBadge group={classGroup}/>}<small className={recordsDesk.secondary}><LectureChipLabel lectureName={course.title} color={course.color} chipLabel={course.chip_label}/></small></td><td>{exam.graded}명</td><td>{exam.average == null ? "미집계" : Number(exam.average.toFixed(1))+"점"}</td></tr>;})}
          </tbody></DomainTable>:<p>조건에 맞는 시험이 없습니다.</p>}
        </>}
      </section>}
  </DomainLayout>;
}

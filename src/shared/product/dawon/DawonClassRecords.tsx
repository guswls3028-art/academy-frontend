import { lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { fetchAssessmentExams } from "@/shared/api/contracts/assessments";
import { Button } from "@/shared/ui/ds";
import { DomainTable } from "@/shared/ui/domain";
import type { TodaySession } from "@teacher/domains/today/api";
import styles from "./ClassGroupsPage.module.css";
import { dawonQueryKeys } from "./queryKeys";

const ExamResults = lazy(() => import("@admin/domains/exams/panels/ExamResultsViewerPanel"));
type Course = {id: number; title: string; cycle_status: "past" | "current" | "upcoming"};
type Props = {groupId: number; courses: Course[]; tab: "attendance" | "exams"; lectureRoot: string};

export default function DawonClassRecords({groupId,courses,tab,lectureRoot}: Props) {
  const [params,setParams] = useSearchParams();
  const requested = params.get("course");
  const course = requested ? courses.find(item=>String(item.id)===requested) : courses.find(item=>item.cycle_status==="current") ?? courses[0];
  const sessions = useQuery({
    queryKey:dawonQueryKeys.courseSessions(groupId,course?.id),
    enabled:tab==="attendance" && !!course,
    queryFn:async ({signal})=>{
      const {data} = await api.get<TodaySession[]>("/lectures/sessions/",{signal,params:{lecture:course!.id,class_group:groupId}});
      if (!Array.isArray(data) || data.some(row=>row.lecture!==course!.id)) throw new Error("차시 목록을 확인하지 못했습니다.");
      return data;
    },
  });
  const exams = useQuery({queryKey:dawonQueryKeys.courseExams(groupId,course?.id),enabled:tab==="exams" && !!course,
    queryFn:()=>fetchAssessmentExams({lecture_id:course!.id,exam_type:"regular"})});
  const requestedExam = params.get("exam");
  const exam = requestedExam ? exams.data?.find(item=>String(item.id)===requestedExam) : exams.data?.[0];
  function choose(key: "course" | "exam",value: string) {
    const next=new URLSearchParams(params);
    if(key==="course") next.delete("exam");
    next.set(key,value);
    setParams(next,{preventScrollReset:true});
  }
  if (!courses.length) return <p>이 반에 개설된 강의가 없습니다.</p>;
  const days = (sessions.data ?? []).flatMap(session=>{
    const route=lectureRoot+"/"+course?.id+"/sessions/"+session.id+"/attendance";
    const title=session.title || session.order+"차시";
    return session.schedule_dates?.length ? session.schedule_dates.map(day=>({
      date:day.date, time:day.start_time?.slice(0,5) || "", title:title+" · "+day.label, route:route+"?schedule="+day.id,
    })) : [{date:session.date || "",time:"",title,route}];
  }).sort((a,b)=>b.date.localeCompare(a.date)||a.time.localeCompare(b.time));
  return <section aria-label={tab==="attendance"?"반별 차시 출결":"반별 시험 결과"}>
    <div className={styles.recordFilters}><label>강의 <select aria-label="조회할 강의" value={course?.id ?? ""} onChange={e=>choose("course",e.target.value)}>
      {!course && <option value="">강의 선택</option>}{courses.map(item=><option key={item.id} value={item.id}>{item.title}{item.cycle_status==="past"?" · 지난 강의":""}</option>)}
    </select></label>{tab==="exams" && !!exams.data?.length && <label>시험 <select value={exam?.id ?? ""} onChange={e=>choose("exam",e.target.value)}>
      {!exam && <option value="">시험 선택</option>}{exams.data.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}</div>
    {!course ? <p role="alert">이 반에서 조회할 강의를 선택해 주세요.</p> : tab==="attendance" ?
      sessions.isPending ? <p role="status">수업일을 불러오는 중입니다.</p> : sessions.isError ? <p role="alert">수업일을 불러오지 못했습니다. <Button onClick={()=>void sessions.refetch()}>다시 시도</Button></p> :
        days.length ? <DomainTable scrollLabel="수업일별 출결" tableClassName="ds-table--flat"><thead><tr><th>수업일</th><th>차시 · 출결</th></tr></thead>
          <tbody>{days.map(day=><tr key={day.route}><td>{day.date || "날짜 미정"} {day.time}</td><td><Link className={styles.rowLink} to={day.route}>{day.title}</Link></td></tr>)}</tbody></DomainTable> : <p>등록된 차시가 없습니다.</p>
      : exams.isPending ? <p role="status">시험을 불러오는 중입니다.</p> : exams.isError ? <p role="alert">시험을 불러오지 못했습니다. <Button onClick={()=>void exams.refetch()}>다시 시도</Button></p> :
        exam ? <Suspense fallback={<p role="status">시험 결과를 여는 중입니다.</p>}><ExamResults key={course.id+":"+exam.id} examId={exam.id} fixedLectureId={course.id}/></Suspense>
          : <p>{exams.data?.length ? "조회할 시험을 선택해 주세요." : "이 강의에 등록된 시험이 없습니다."}</p>}
  </section>;
}

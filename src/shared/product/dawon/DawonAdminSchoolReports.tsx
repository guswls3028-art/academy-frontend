import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSchoolReportRoster, schoolReportKeys, type SchoolReportStatus } from "@/shared/api/contracts/schoolReports";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { currentSchoolReportPeriod } from "@/shared/product/schoolReports/period";
import SchoolReportPeriodPicker from "@/shared/product/schoolReports/SchoolReportPeriodPicker";
import SchoolReportStudentPanel from "@teacher/domains/results/components/SchoolReportStudentPanel";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import DomainListToolbar from "@/shared/ui/domain/DomainListToolbar";
import DomainTable from "@/shared/ui/domain/DomainTable";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import { AdminGroupSelect } from "./DawonAdminDirectories";
import { Cohorts } from "./DawonSchoolReportCohorts";
import styles from "./DawonOperations.module.css";

import desk from "./DawonAdminRecords.module.css";

export default function DawonAdminSchoolReports() {
  const [period,setPeriod]=useState(currentSchoolReportPeriod);
  const [group,setGroup]=useState("");
  const [stats,setStats]=useState(false);
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState<SchoolReportStatus>();
  const [page,setPage]=useState(1);
  const [student,setStudent]=useState<{id:number;name:string}|null>(null);
  const filters={class_group:Number(group)||undefined,search:useDebouncedValue(search.trim()),page,status};
  const roster=useQuery({queryKey:schoolReportKeys.roster(period,filters),enabled:!stats,
    queryFn:({signal})=>fetchSchoolReportRoster(period,filters,signal)});
  const data=roster.data;
  return <DomainLayout title="학교 성적 취합" breadcrumbs={[]}>
    <div className={desk.desk}>
      <div className={desk.filters}>
        <SchoolReportPeriodPicker period={period} onChange={value=>{setPeriod(value);setPage(1);}}/>
        <AdminGroupSelect value={group} onChange={value=>{setGroup(value);setPage(1);}}/>
      </div>
      <div role="group" aria-label="성적 취합 보기" className={desk.switcher}>
        <Button aria-pressed={!stats} onClick={()=>setStats(false)}>제출 현황</Button>
        <Button aria-pressed={stats} onClick={()=>setStats(true)}>학교별 통계</Button>
      </div>
      {stats ? <div className={desk.schools}><Cohorts ledger key={JSON.stringify([period,group])} period={period} classGroup={Number(group)||undefined}/></div> : <>
        {data && <dl className={desk.metrics} aria-label="성적 제출 요약">
          <div><dt>대상 학생</dt><dd>{data.total_count}<small>명</small></dd></div>
          <div><dt>제출 완료</dt><dd>{data.submitted_count}<small>명</small></dd></div>
          <div><dt>미제출</dt><dd>{data.missing_count}<small>명</small></dd></div>
        </dl>}
        <DomainListToolbar totalLabel="학생별 제출 내역"
          searchSlot={<input className="ds-input" type="search" aria-label="학생 또는 학교 검색" placeholder="학생 또는 학교 검색" maxLength={100} value={search}
            onChange={e=>{setSearch(e.target.value);setPage(1);}}/>}
          filterSlot={<label className={styles.field}>제출 상태 <select value={status??""} onChange={e=>{setStatus(e.target.value==="submitted"?"submitted":e.target.value==="missing"?"missing":undefined);setPage(1);}}>
            <option value="">전체</option><option value="submitted">제출 완료</option><option value="missing">미제출</option></select></label>} primaryAction={null}/>
        {roster.isPending?<p role="status">제출 현황을 불러오는 중입니다.</p>:roster.isError||!data?
          <p role="alert">제출 현황을 불러오지 못했습니다. <Button onClick={()=>void roster.refetch()}>다시 시도</Button></p>:
          !data.results.length?<p className={styles.empty}>조건에 맞는 학생이 없습니다.</p>:<>
            <DomainTable tableClassName={desk.submissions} scrollLabel="학교 성적 제출 현황"><thead><tr><th>학생</th><th>학교</th><th>학년</th><th>제출 상태</th><th>제출일</th></tr></thead>
              <tbody>{data.results.map(row=><tr key={row.student_id}><th scope="row"><button type="button" className={styles.textAction} onClick={()=>setStudent({id:row.student_id,name:row.name})}>{row.name}</button><small className={desk.mobileMeta}>{row.school || "학교 미등록"} · {row.grade?row.grade+"학년":"학년 미등록"}</small></th>
                <td>{row.school || "미등록"}</td><td>{row.grade?row.grade+"학년":"미등록"}</td><td><span className={desk.status} data-state={row.status}>{row.status==="submitted"?"제출 완료 · "+row.score_count+"과목":row.requested_at?"제출 요청함":"미제출"}</span></td>
                <td>{row.submitted_at?.slice(0,10) || "—"}</td></tr>)}</tbody></DomainTable>
            {(data.next || data.previous) && <nav aria-label="제출 현황 페이지" className={styles.pagination}>
              <Button disabled={!data.previous} onClick={()=>setPage(page-1)}>이전</Button>{page}페이지<Button disabled={!data.next} onClick={()=>setPage(page+1)}>다음</Button></nav>}
          </>}
      </>}
      {student && <AdminModal open onClose={()=>setStudent(null)} noMinimize trapFocus width={MODAL_WIDTH.md}><ModalHeader title={student.name}/><ModalBody>
        <SchoolReportStudentPanel studentId={student.id} period={period}/></ModalBody></AdminModal>}
    </div></DomainLayout>;
}

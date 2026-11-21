import { useSearchParams } from "react-router";
import type { ClinicParticipant } from "@/app_admin/domains/clinic/api/clinicParticipants.api";
import { Button } from "@/shared/ui/ds";
import DomainTable from "@/shared/ui/domain/DomainTable";
import { CareDetail } from "./DawonAdminDirectories";
import { dawonStaffPreviewRole } from "./staffPreview";

const labels: Record<string,string> = {pending:"승인 대기",booked:"예약 확정",attended:"출석",no_show:"결석",cancelled:"취소",rejected:"반려"};
type Props = { rows: ClinicParticipant[]; loading:boolean; failed:boolean; retry:()=>void };

export default function DawonClinicAttendance({rows,loading,failed,retry}:Props) {
  const [params,setParams]=useSearchParams();
  const record=params.get("record");
  function select(id:string|null){
    const next=new URLSearchParams(params);
    next.set("panel","day");
    if(id)next.set("record",id);else next.delete("record");
    setParams(next,{preventScrollReset:true,replace:!id});
  }
  const filters:Record<string,string>={view:"care",kind:"clinic",record:record || "",page:"1"};
  if(dawonStaffPreviewRole()==="teacher")filters.scope="assigned";
  return <section aria-label="클리닉 출석 명단">
    <h3>클리닉 출석 명단</h3>
    {loading ? <p role="status">예약을 불러오는 중입니다.</p> : failed ? <p role="alert">예약을 불러오지 못했습니다. <Button onClick={retry}>다시 시도</Button></p> :
      !rows.length ? <p>선택한 일정에 예약한 학생이 없습니다.</p> :
      <DomainTable scrollLabel="클리닉 출석 명단"><thead><tr><th>학생</th><th>예약 시간</th><th>상태</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.id}><th scope="row"><Button onClick={()=>select(String(row.id))}>{row.student_name}</Button></th>
          <td>{(row.booking_start_time||row.preferred_start_time||row.session_start_time||"").slice(0,5) || "시간 미정"}</td>
          <td>{labels[row.status] ?? row.status}</td></tr>)}</tbody></DomainTable>}
    {record && <CareDetail key={record} filters={filters} close={()=>select(null)} />}
  </section>;
}

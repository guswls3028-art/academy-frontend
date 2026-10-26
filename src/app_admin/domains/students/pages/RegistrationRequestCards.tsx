import { Checkbox } from "antd";
import { Button } from "@/shared/ui/ds";
import type { ClientRegistrationRequest } from "../api/students.api";

type Props = {
  requests: ClientRegistrationRequest[];
  selectedIds: Set<number>;
  busy: boolean;
  approvingId?: number;
  rejectingId?: number;
  onSelect: (id: number, checked: boolean) => void;
  onDetail: (request: ClientRegistrationRequest) => void;
  onApprove: (request: ClientRegistrationRequest) => void;
  onReject: (request: ClientRegistrationRequest) => void;
};

export default function RegistrationRequestCards(props: Props) {
  return <div className="students-requests__request-list" aria-label="승인 대기 신청">
    {props.requests.map((request) => <article key={request.id}
      aria-label={`${request.name} 가입 신청`}
      className={`students-requests__card ${props.selectedIds.has(request.id) ? "students-requests__card--selected" : ""}`}>
      <Checkbox aria-label={`${request.name} 선택`} checked={props.selectedIds.has(request.id)} disabled={props.busy}
        onChange={(event) => props.onSelect(request.id, event.target.checked)} />
      <button type="button" className="students-requests__detail-button" onClick={() => props.onDetail(request)} disabled={props.busy}
        aria-label={`${request.name} 신청 상세`}>
        <span className="students-requests__card-name-row">
          <strong className="students-requests__card-name">{request.name}</strong>
          <span className="students-requests__card-school">{request.highSchool || request.middleSchool || request.elementarySchool || "학교 미입력"}{request.grade != null ? ` ${request.grade}학년` : ""}</span>
        </span>
        <span className="students-requests__card-meta">학부모 {request.parentPhone || "미입력"}<br />학생 {request.phone || "미입력"}</span>
        <span className="students-requests__card-meta">{request.createdAt ? new Date(request.createdAt).toLocaleDateString("ko-KR") : "날짜 미확인"} 신청 · 상세 보기</span>
      </button>
      <div className="students-requests__card-actions">
        <Button intent="secondary" size="sm" disabled={props.busy} onClick={() => props.onReject(request)}>
          {props.rejectingId === request.id ? "거절 중…" : "거절"}
        </Button>
        <Button intent="primary" size="sm" disabled={props.busy} onClick={() => props.onApprove(request)}>
          {props.approvingId === request.id ? "승인 중…" : "승인"}
        </Button>
      </div>
    </article>)}
  </div>;
}

import type { ClinicTarget } from "../../api/clinicTargets";
import { hhmmText } from "@/shared/ui/time/timeFormat";
import "./RemediationContextPanel.css";

const PARTICIPANT_STATUS_LABEL: Record<string, string> = {
  pending: "승인 대기",
  booked: "예약 확정",
  attended: "출석",
  no_show: "결석",
  cancelled: "취소",
  rejected: "거절",
};

const RESOLUTION_ACTION_LABEL: Record<string, string> = {
  resolve: "해결",
  unresolve: "해결 취소",
  carry_over: "다음 차수 이월",
};

function calendarDateText(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${Number(match[1])}. ${Number(match[2])}. ${Number(match[3])}.`;
}

function historyTimeText(value: string | null | undefined): string {
  if (!value) return "시각 미상";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function evidenceText(evidence: Record<string, unknown> | null | undefined): string {
  if (!evidence) return "";
  const parts: string[] = [];
  if (typeof evidence.score === "number") parts.push(`점수 ${evidence.score}`);
  if (typeof evidence.pass_score === "number") parts.push(`통과 기준 ${evidence.pass_score}`);
  if (typeof evidence.attempt_id === "number") parts.push(`시도 #${evidence.attempt_id}`);
  if (typeof evidence.memo === "string" && evidence.memo.trim()) parts.push(`사유 ${evidence.memo.trim()}`);
  return parts.join(" · ") || "근거 기록 있음";
}

export default function RemediationContextPanel({ item }: { item: ClinicTarget }) {
  return (
    <>
      <div className="clinic-hub__linked-context" role="group" aria-label="연결된 예약·운영 정보">
        <div className="clinic-hub__context-heading">
          <strong>예약·운영 연결</strong>
          <span>정확한 참가 항목 연결</span>
        </div>
        {item.linked_bookings?.length ? (
          <div className="clinic-hub__booking-list">
            {item.linked_bookings.map((booking) => (
              <article className="clinic-hub__booking-card" key={booking.plan_item_id}>
                <div className="clinic-hub__booking-primary">
                  <strong>
                    {calendarDateText(booking.session_date)} {hhmmText(booking.session_start_time, "-")}–{hhmmText(booking.session_end_time, "-")}
                  </strong>
                  <span className={`clinic-hub__booking-status clinic-hub__booking-status--${booking.participant_status}`}>
                    {PARTICIPANT_STATUS_LABEL[booking.participant_status] ?? booking.participant_status}
                  </span>
                </div>
                <span className="clinic-hub__booking-location">{booking.location || "장소 미정"}</span>
                {(booking.preferred_start_time || booking.preferred_end_time) && (
                  <span className="clinic-hub__booking-note">
                    희망 시간 {hhmmText(booking.preferred_start_time, "-")}–{hhmmText(booking.preferred_end_time, "-")}
                  </span>
                )}
                {booking.student_request_memo && (
                  <span className="clinic-hub__booking-note"><b>학생 요청</b> {booking.student_request_memo}</span>
                )}
                {booking.staff_memo && (
                  <span className="clinic-hub__booking-note clinic-hub__booking-note--staff"><b>교직원 메모</b> {booking.staff_memo}</span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="clinic-hub__context-empty">아직 이 항목에 직접 연결된 예약이 없습니다.</p>
        )}
      </div>

      {(item.resolution_history?.length || item.resolution_evidence) && (
        <div className="clinic-hub__resolution-context" role="group" aria-label="처리 근거와 이력">
          <div className="clinic-hub__context-heading">
            <strong>처리 이력 {item.resolution_history?.length ?? 0}건</strong>
            {item.resolution_evidence && <span>현재 근거 · {evidenceText(item.resolution_evidence)}</span>}
          </div>
          {!!item.resolution_history?.length && (
            <ol>
              {item.resolution_history.map((entry, index) => (
                <li key={`${entry.at ?? "history"}-${index}`}>
                  <span>{RESOLUTION_ACTION_LABEL[entry.action ?? ""] ?? entry.action ?? "상태 변경"}</span>
                  <time dateTime={entry.at ?? undefined}>{historyTimeText(entry.at)}</time>
                  {entry.evidence && <small>{evidenceText(entry.evidence)}</small>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </>
  );
}

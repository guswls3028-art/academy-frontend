/* eslint-disable no-restricted-syntax */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { ClinicActualTimePicker } from "@/shared/ui/clinic/ClinicActualTimePicker";
import { extractApiError } from "@/shared/utils/extractApiError";
import { changeParticipantBooking, fetchClinicAvailability, type TeacherClinicParticipant, type TeacherClinicRecipient, type TeacherClinicSession } from "../api";
import { teacherClinicQueryKeys } from "../queryKeys";

type Props = {
  participant: TeacherClinicParticipant;
  sendTo: TeacherClinicRecipient;
  sessionId: number;
  sessionDate: string;
  availableSessions: TeacherClinicSession[];
  onClose: () => void;
  onCreateSession: () => void;
};

export default function RescheduleParticipantSheet({
  participant, sendTo, sessionId, sessionDate, availableSessions, onClose, onCreateSession,
}: Props) {
  const qc = useQueryClient();
  const [replacementSessionId, setReplacementSessionId] = useState("");
  const [replacementPreferredStart, setReplacementPreferredStart] = useState(participant.preferred_start_time?.slice(0, 5) ?? "");
  const [replacementPreferredEnd, setReplacementPreferredEnd] = useState(participant.preferred_end_time?.slice(0, 5) ?? "");
  const [replacementBookingStart, setReplacementBookingStart] = useState("");
  const [replacementBookingEnd, setReplacementBookingEnd] = useState("");
  const replacementSession = availableSessions.find(
    (session) => session.id === Number(replacementSessionId),
  );
  const replacementNeedsTime = replacementSession?.booking_mode === "time_range";
  const replacementAvailabilityQ = useQuery({
    queryKey: teacherClinicQueryKeys.availability(Number(replacementSessionId)),
    queryFn: () => fetchClinicAvailability(Number(replacementSessionId)),
    enabled: replacementNeedsTime,
    retry: 0,
  });
  const replacementTimeIncomplete = replacementNeedsTime && (
    !replacementBookingStart || !replacementBookingEnd || replacementAvailabilityQ.isFetching || replacementAvailabilityQ.isError
  );

  const changeBookingMut = useMutation({
    mutationFn: async () => {
      if (!replacementSessionId || replacementTimeIncomplete) return null;
      return changeParticipantBooking(participant.id, {
        new_session_id: Number(replacementSessionId),
        memo: "결석 후 보충 일정 이동",
        send_to: sendTo,
        ...(replacementNeedsTime ? {
          booking_start_time: replacementBookingStart,
          booking_end_time: replacementBookingEnd,
        } : {}),
        ...(!replacementNeedsTime && replacementSession?.allow_time_preference && replacementPreferredStart && replacementPreferredEnd
          ? {
              preferred_start_time: replacementPreferredStart,
              preferred_end_time: replacementPreferredEnd,
            }
          : {}),
      });
    },
    onSuccess: () => {
      onClose();
      qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.sessions });
      qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.participantsAll });
      teacherToast.success("보충 일정으로 이동했습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "보충 일정을 옮기지 못했습니다.")),
  });

  return (
      <BottomSheet
        open
        onClose={() => !changeBookingMut.isPending && onClose()}
        title="보충 일정 정하기"
      >
        <div className="flex flex-col gap-3" style={{ padding: "var(--tc-space-3) 0" }}>
          <p className="text-sm" style={{ color: "var(--tc-text-muted)" }}>
            결석 기록은 유지됩니다. 기존 클리닉으로 옮기거나 새 일정을 만드세요.
          </p>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--tc-text)" }}>
            이동할 일정
            <select
              value={replacementSessionId}
              onChange={(event) => {
                setReplacementSessionId(event.target.value);
                setReplacementBookingStart("");
                setReplacementBookingEnd("");
                changeBookingMut.reset();
              }}
              disabled={changeBookingMut.isPending}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--tc-border)",
                borderRadius: "var(--tc-radius-sm)",
                background: "var(--tc-surface)",
                color: "var(--tc-text)",
              }}
            >
              <option value="">일정을 선택하세요</option>
              {availableSessions
                .filter((session) => session.id !== sessionId)
                .map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.date ?? sessionDate} {session.start_time?.slice(0, 5) ?? "시간 미정"} · {session.title || "클리닉"}
                  </option>
                ))}
            </select>
          </label>
          {replacementNeedsTime && (
            <fieldset disabled={changeBookingMut.isPending} className="m-0 min-w-0 border-0 p-0">
              <ClinicActualTimePicker
                availability={replacementAvailabilityQ.data}
                loading={replacementAvailabilityQ.isFetching}
                error={replacementAvailabilityQ.isError}
                bookingStart={replacementBookingStart}
                bookingEnd={replacementBookingEnd}
                onBookingStartChange={setReplacementBookingStart}
                onBookingEndChange={setReplacementBookingEnd}
                onRetry={() => void replacementAvailabilityQ.refetch()}
                tone="teacher"
              />
            </fieldset>
          )}
          {!replacementNeedsTime && replacementSession?.allow_time_preference && (
            <div className="grid grid-cols-2 gap-2" aria-label="학생 희망 시간">
              <Fld label="희망 시작" value={replacementPreferredStart} onChange={setReplacementPreferredStart} type="time" />
              <Fld label="희망 종료" value={replacementPreferredEnd} onChange={setReplacementPreferredEnd} type="time" />
            </div>
          )}
          {changeBookingMut.isError && (
            <p role="alert" className="text-sm" style={{ color: "var(--tc-danger)" }}>
              {extractApiError(changeBookingMut.error, "보충 일정을 옮기지 못했습니다.")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="text-sm font-bold cursor-pointer"
              style={{ padding: "10px", border: "1px solid var(--tc-border)", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-surface)", color: "var(--tc-primary)" }}
              onClick={() => {
                onClose();
                onCreateSession();
              }}
              disabled={changeBookingMut.isPending}
            >
              새 클리닉 만들기
            </button>
            <button
              type="button"
              className="text-sm font-bold cursor-pointer disabled:cursor-not-allowed"
              style={{ padding: "10px", border: "none", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-primary)", color: "#fff", opacity: !replacementSessionId || replacementTimeIncomplete || changeBookingMut.isPending ? 0.5 : 1 }}
              disabled={!replacementSessionId || replacementTimeIncomplete || changeBookingMut.isPending}
              onClick={() => changeBookingMut.mutate()}
            >
              {changeBookingMut.isPending ? "변경 중…" : "일정 이동"}
            </button>
          </div>
        </div>
      </BottomSheet>
  );
}

function Fld({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex-1">
      <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>{label}</label>
      <input type={type} aria-label={label.replace(/\s*\*$/, "")} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm"
        style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
    </div>
  );
}

/* eslint-disable no-restricted-syntax */
// PATH: src/app_teacher/domains/clinic/pages/ClinicPage.tsx
// 클리닉 — 오늘의 세션 + 참가자 관리
// R-11: 기존 인라인 style baseline. 이 파일 UI 토큰 마이그레이션은 별도 백로그.
//
// sectionMode 가드 제거(2026-05-02): PC 어드민 ClinicHomePage는 sectionMode 무관하게
// 동작하는데 모바일만 sectionMode=true 학원으로 가렸음. 림글리쉬(sectionMode=false)
// 처럼 클리닉 운영 중인 학원에서 모바일 페이지가 EmptyState로 가려져 신고 발생.
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState , ICON } from "@/shared/ui/ds";
import { Plus, ChevronLeft, ChevronRight } from "@teacher/shared/ui/Icons";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import {
  fetchClinicSessions,
  fetchClinicParticipants,
  patchParticipantStatus,
  checkoutParticipant,
  changeParticipantBooking,
  completeParticipant,
  remindParticipant,
  createClinicSession,
  fetchClinicSettings,
  deleteClinicSession,
  type TeacherClinicSession,
} from "../api";
import AddParticipantSheet from "../components/AddParticipantSheet";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useSectionMode } from "@/shared/hooks/useSectionMode";
import { fetchAllSections, type Section } from "@/shared/api/contracts/lectureSections";
import { useConfirm } from "@/shared/ui/confirm";
import { todayLocalISO as todayISO, addDaysLocal as addDays } from "@/shared/utils/localDate";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { teacherClinicQueryKeys } from "../queryKeys";
import ClinicParticipantActionDialog, {
  type ClinicParticipantAction,
  type ClinicParticipantActionPayload,
} from "@admin/domains/clinic/components/ClinicParticipantActionDialog";
import type { TeacherClinicParticipant } from "../api";

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function toHHmmss(s: string): string {
  const parts = s.trim().split(":");
  const h = (parts[0] ?? "00").padStart(2, "0");
  const m = (parts[1] ?? "00").padStart(2, "0");
  return `${h}:${m}:00`;
}

export default function ClinicPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: sessions, isLoading } = useQuery({
    queryKey: teacherClinicQueryKeys.sessionsRange(dateFrom, dateTo),
    queryFn: () => fetchClinicSessions({ date_from: dateFrom, date_to: dateTo }),
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: deleteClinicSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.sessions });
      teacherToast.success("클리닉이 삭제되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "클리닉을 삭제하지 못했습니다.")),
  });

  const isToday = dateFrom === todayISO() && dateTo === todayISO();

  return (
    <div className="flex flex-col gap-3">
      {/* Header with date nav + create */}
      <div className="flex justify-between items-center py-1">
        <h2 className="text-[17px] font-bold" style={{ color: "var(--tc-text)" }}>클리닉</h2>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={ICON.xs} /> 클리닉 만들기
        </button>
      </div>

      {/* Date range selector */}
      <div className="flex items-center gap-2 justify-center">
        <button onClick={() => { setDateFrom(addDays(dateFrom, -1)); setDateTo(addDays(dateTo, -1)); }}
          className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
          <ChevronLeft size={ICON.md} />
        </button>
        <div className="flex gap-1.5 items-center">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm" style={{ border: "1px solid var(--tc-border)", borderRadius: "var(--tc-radius-sm)", padding: "4px 8px", background: "var(--tc-surface)", color: "var(--tc-text)" }} />
          <span className="text-xs" style={{ color: "var(--tc-text-muted)" }}>~</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="text-sm" style={{ border: "1px solid var(--tc-border)", borderRadius: "var(--tc-radius-sm)", padding: "4px 8px", background: "var(--tc-surface)", color: "var(--tc-text)" }} />
        </div>
        <button onClick={() => { setDateFrom(addDays(dateFrom, 1)); setDateTo(addDays(dateTo, 1)); }}
          className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
          <ChevronRight size={ICON.md} />
        </button>
        {!isToday && (
          <button onClick={() => { setDateFrom(todayISO()); setDateTo(todayISO()); }}
            className="text-[11px] font-semibold cursor-pointer"
            style={{ padding: "4px 8px", borderRadius: "var(--tc-radius-sm)", border: "none", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
            오늘
          </button>
        )}
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : sessions && sessions.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              expanded={selectedSession === s.id}
              onToggle={() => setSelectedSession(selectedSession === s.id ? null : s.id)}
              onDelete={async () => {
                const ok = await confirm({ title: "클리닉 삭제", message: "이 클리닉을 삭제하시겠습니까?", confirmText: "삭제", danger: true });
                if (ok) deleteMut.mutate(s.id);
              }}
              availableSessions={sessions}
              onCreateSession={() => setCreateOpen(true)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          scope="panel"
          tone="empty"
          title={isToday ? "오늘 예정된 클리닉이 없습니다" : "해당 기간에 클리닉이 없습니다"}
          description="클리닉 일정을 만들면 학생 예약과 출석 관리, 리포트 확인으로 이어집니다."
          actions={
            <EmptyActionButton onClick={() => setCreateOpen(true)}>
              클리닉 추가
            </EmptyActionButton>
          }
        />
      )}

      {/* Create session sheet */}
      <ClinicSessionFormSheet open={createOpen} onClose={() => setCreateOpen(false)} defaultDate={dateFrom} />
    </div>
  );
}

function SessionCard({
  session,
  expanded,
  onToggle,
  onDelete,
  availableSessions,
  onCreateSession,
}: {
  session: TeacherClinicSession;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  availableSessions: TeacherClinicSession[];
  onCreateSession: () => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
    >
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full text-left cursor-pointer"
        style={{
          padding: "var(--tc-space-4)",
          background: "none",
          border: "none",
        }}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--tc-info-bg)" }}
        >
          <ClinicIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="ds-text-name font-semibold truncate" style={{ color: "var(--tc-text)" }}>
            {session.title || "클리닉"}
          </div>
          <div className="flex gap-2 text-xs mt-0.5" style={{ color: "var(--tc-text-muted)" }}>
            {session.start_time && <span>{session.start_time.slice(0, 5)}</span>}
            {session.location && <span>{session.location}</span>}
            {session.participant_count != null && (
              <span>참가 {session.participant_count}명</span>
            )}
          </div>
        </div>
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--tc-text-muted)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform var(--tc-motion-fast)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <>
          <ParticipantList
            sessionId={session.id}
            sessionDate={session.date ?? todayISO()}
            availableSessions={availableSessions}
            onCreateSession={onCreateSession}
          />
          <div style={{ padding: "0 var(--tc-space-4) var(--tc-space-3)", textAlign: "right" }}>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-[11px] font-semibold cursor-pointer"
              style={{ padding: "4px 10px", borderRadius: "var(--tc-radius-sm)", border: "none", background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}>
              클리닉 삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ParticipantList({
  sessionId,
  sessionDate,
  availableSessions,
  onCreateSession,
}: {
  sessionId: number;
  sessionDate: string;
  availableSessions: TeacherClinicSession[];
  onCreateSession: () => void;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    participant: TeacherClinicParticipant;
    action: ClinicParticipantAction;
  } | null>(null);
  const [reschedule, setReschedule] = useState<{
    participant: TeacherClinicParticipant;
    sendTo: ClinicParticipantActionPayload["send_to"];
  } | null>(null);
  const [replacementSessionId, setReplacementSessionId] = useState("");

  const { data: participants, isLoading } = useQuery({
    queryKey: teacherClinicQueryKeys.participants(sessionId),
    queryFn: () => fetchClinicParticipants(sessionId),
  });

  const alreadyStudentIds = (participants ?? [])
    .map((p) => p.student)
    .filter((id): id is number => typeof id === "number");

  const actionMut = useMutation({
    mutationFn: async ({
      participant,
      action,
      payload,
    }: {
      participant: TeacherClinicParticipant;
      action: ClinicParticipantAction;
      payload: ClinicParticipantActionPayload;
    }) => {
      if (action === "arrive" || action === "late" || action === "absent") {
        return patchParticipantStatus(participant.id, {
          status: action === "absent" ? "no_show" : "attended",
          is_late: action === "late",
          send_to: payload.send_to,
        });
      }
      if (action === "checkout") {
        return checkoutParticipant(participant.id, { send_to: payload.send_to });
      }
      await remindParticipant(participant.id, {
        mode: payload.mode ?? "once",
        send_to: payload.send_to,
        interval_minutes: payload.interval_minutes,
        repeat_until: payload.repeat_until,
      });
      return participant;
    },
    onSuccess: (_data, variables) => {
      setActionDialog(null);
      qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.participants(sessionId) });
      qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.sessions });
      const label = variables.action === "arrive" ? "등원" : variables.action === "late" ? "지각 등원" : variables.action === "checkout" ? "하원" : variables.action === "remind" ? "재촉" : "결석";
      teacherToast.success(`${label} 처리가 완료되었습니다.`);
      if (variables.action === "absent") {
        setReplacementSessionId("");
        setReschedule({ participant: variables.participant, sendTo: variables.payload.send_to });
      }
    },
    onError: (e) => teacherToast.error(extractApiError(e, "클리닉 처리를 완료하지 못했습니다.")),
  });

  const changeBookingMut = useMutation({
    mutationFn: async () => {
      if (!reschedule || !replacementSessionId) return null;
      return changeParticipantBooking(reschedule.participant.id, {
        new_session_id: Number(replacementSessionId),
        memo: "결석 후 보충 일정 이동",
        send_to: reschedule.sendTo,
      });
    },
    onSuccess: () => {
      setReschedule(null);
      setReplacementSessionId("");
      qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.sessions });
      qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.participants(sessionId) });
      teacherToast.success("보충 일정으로 이동했습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "보충 일정을 옮기지 못했습니다.")),
  });

  const completeMut = useMutation({
    mutationFn: (participantId: number) => completeParticipant(participantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.participants(sessionId) });
      teacherToast.success("완료 처리되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "완료 처리에 실패했습니다.")),
  });

  if (isLoading) return <div className="px-4 pb-4 text-sm" style={{ color: "var(--tc-text-muted)" }}>불러오는 중…</div>;

  const empty = !participants?.length;

  return (
    <div className="px-4 pb-4">
      <div style={{ height: 1, background: "var(--tc-border)", marginBottom: 12 }} />
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] font-semibold" style={{ color: "var(--tc-text-muted)" }}>
          참가자 {participants?.length ?? 0}명
        </span>
        <button onClick={(e) => { e.stopPropagation(); setAddOpen(true); }}
          className="text-[11px] font-semibold cursor-pointer flex items-center gap-1"
          style={{ padding: "4px 10px", borderRadius: "var(--tc-radius-sm)", border: "none", background: "var(--tc-primary-bg)", color: "var(--tc-primary)" }}>
          <Plus size={12} /> 학생 추가
        </button>
      </div>
      {empty ? (
        <div className="text-sm py-2" style={{ color: "var(--tc-text-muted)" }}>참가자가 없습니다</div>
      ) : (
      <div className="flex flex-col gap-1">
        {participants.map((p) => {
          const name = p.student_name ?? p.enrollment_name ?? "이름 없음";
          const st = p.status ?? "booked";
          return (
            <div
              key={p.id}
              className="flex flex-col gap-2 py-2 border-b last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: "var(--tc-border)" }}
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <StudentNameWithLectureChip
                  name={name}
                  profilePhotoUrl={p.profile_photo_url}
                  avatarSize={24}
                  chipSize={16}
                  density="compact"
                  lectures={p.lecture_title ? [{
                    lectureName: p.lecture_title,
                    color: p.lecture_color,
                    chipLabel: p.lecture_chip_label,
                  }] : undefined}
                  className="text-sm"
                />
                <StatusBadge status={st} isLate={!!p.is_late} checkedOut={!!p.checked_out_at} />
                <span className="text-[10px] font-semibold" style={{ color: "var(--tc-text-muted)" }}>
                  미등원 → {p.is_late ? "지각 등원" : "등원"} → 하원
                </span>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {st === "booked" && (
                  <>
                    <SmallBtn label="등원" color="var(--tc-success)" onClick={() => setActionDialog({ participant: p, action: "arrive" })} />
                    <SmallBtn label="재촉" color="var(--tc-warning)" onClick={() => setActionDialog({ participant: p, action: "remind" })} />
                    <SmallBtn label="결석" color="var(--tc-danger)" onClick={() => setActionDialog({ participant: p, action: "absent" })} />
                    <SmallBtn label="하원" color="var(--tc-primary)" onClick={() => undefined} disabled />
                  </>
                )}
                {st === "no_show" && (
                  <SmallBtn label="지각 등원" color="var(--tc-warning)" onClick={() => setActionDialog({ participant: p, action: "late" })} />
                )}
                {st === "attended" && (
                  <SmallBtn label={p.checked_out_at ? "하원 완료" : "하원"} color="var(--tc-primary)" onClick={() => setActionDialog({ participant: p, action: "checkout" })} disabled={!!p.checked_out_at} />
                )}
                {st === "attended" && !p.completed_at && (
                  <SmallBtn
                    label="자율학습 완료"
                    color="var(--tc-primary)"
                    onClick={() => completeMut.mutate(p.id)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
      <AddParticipantSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        sessionId={sessionId}
        availableSessions={availableSessions}
        alreadyParticipantStudentIds={alreadyStudentIds}
      />
      {actionDialog && (
        <ClinicParticipantActionDialog
          action={actionDialog.action}
          participantName={actionDialog.participant.student_name ?? actionDialog.participant.enrollment_name ?? "학생"}
          selectedDate={sessionDate}
          busy={actionMut.isPending}
          onClose={() => setActionDialog(null)}
          onConfirm={(payload) => actionMut.mutate({ ...actionDialog, payload })}
        />
      )}
      <BottomSheet
        open={!!reschedule}
        onClose={() => !changeBookingMut.isPending && setReschedule(null)}
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
              onChange={(event) => setReplacementSessionId(event.target.value)}
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="text-sm font-bold cursor-pointer"
              style={{ padding: "10px", border: "1px solid var(--tc-border)", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-surface)", color: "var(--tc-primary)" }}
              onClick={() => {
                setReschedule(null);
                onCreateSession();
              }}
            >
              새 클리닉 만들기
            </button>
            <button
              type="button"
              className="text-sm font-bold cursor-pointer disabled:cursor-not-allowed"
              style={{ padding: "10px", border: "none", borderRadius: "var(--tc-radius-sm)", background: "var(--tc-primary)", color: "#fff", opacity: !replacementSessionId || changeBookingMut.isPending ? 0.5 : 1 }}
              disabled={!replacementSessionId || changeBookingMut.isPending}
              onClick={() => changeBookingMut.mutate()}
            >
              일정 이동
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function SmallBtn({ label, color, onClick, disabled = false }: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-[11px] font-semibold px-2 py-1 rounded cursor-pointer"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: "none",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  booked: { label: "미등원", color: "var(--tc-info)" },
  attended: { label: "등원", color: "var(--tc-success)" },
  no_show: { label: "결석", color: "var(--tc-danger)" },
  cancelled: { label: "취소", color: "var(--tc-text-muted)" },
  rejected: { label: "거절", color: "var(--tc-text-muted)" },
};

function StatusBadge({ status, isLate, checkedOut }: { status: string; isLate: boolean; checkedOut: boolean }) {
  const base = STATUS_LABELS[status] ?? { label: status, color: "var(--tc-text-muted)" };
  const st = checkedOut
    ? { label: "하원 완료", color: "var(--tc-primary)" }
    : isLate && status === "attended"
    ? { label: "지각 등원", color: "var(--tc-warning)" }
    : base;
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 12%, transparent)` }}
    >
      {st.label}
    </span>
  );
}

function ClinicIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--tc-info)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

/* ─── Clinic Session Create Sheet ─── */
function ClinicSessionFormSheet({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: string }) {
  const qc = useQueryClient();
  const { sectionMode, clinicMode } = useSectionMode();
  const showSectionPicker = sectionMode && clinicMode === "regular";

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [allowMultiSlotBooking, setAllowMultiSlotBooking] = useState(false);

  const settingsQ = useQuery({
    queryKey: teacherClinicQueryKeys.settings,
    queryFn: fetchClinicSettings,
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open || !settingsQ.data) return;
    setAllowMultiSlotBooking(settingsQ.data.multi_slot_booking_default === true);
  }, [open, settingsQ.data]);

  // 정규형 클리닉일 때만 CLINIC type section 목록 조회
  const sectionsQ = useQuery<Section[]>({
    queryKey: teacherClinicQueryKeys.sectionsRegular,
    queryFn: () => fetchAllSections({ section_type: "CLINIC" }),
    enabled: open && showSectionPicker,
    staleTime: 60_000,
  });
  const activeSections = (sectionsQ.data ?? []).filter((s) => s.is_active);

  const capacityNum = Number(capacity);
  const duration = startTime && endTime ? durationMinutes(startTime, endTime) : 60;
  const canSubmit =
    !!date &&
    !!startTime &&
    !!location.trim() &&
    capacityNum > 0 &&
    (!endTime || duration > 0);

  const mutation = useMutation({
    mutationFn: () => createClinicSession({
      title: title.trim() || undefined,
      date,
      start_time: toHHmmss(startTime),
      duration_minutes: duration,
      location: location.trim(),
      max_participants: capacityNum,
      allow_multi_slot_booking: allowMultiSlotBooking,
      ...(showSectionPicker ? { section: sectionId } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherClinicQueryKeys.sessions });
      teacherToast.success("클리닉이 만들어졌습니다.");
      setTitle(""); setStartTime(""); setEndTime(""); setLocation(""); setCapacity("10"); setSectionId(null);
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "클리닉을 만들지 못했습니다.")),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title="클리닉 만들기">
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Fld label="클리닉 이름 (선택)" value={title} onChange={setTitle} placeholder="예: 오후 클리닉" />
        {showSectionPicker && (
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--tc-text-muted)" }}>반 (선택)</label>
            <select
              value={sectionId ?? ""}
              onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : null)}
              className="w-full text-sm"
              style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }}>
              <option value="">반 선택 없음 (전체)</option>
              {activeSections.map((s) => (
                <option key={s.id} value={s.id}>
                  클리닉 {s.label}반 ({s.day_of_week_display} {s.start_time?.slice(0, 5) ?? ""})
                </option>
              ))}
            </select>
            {activeSections.length === 0 && !sectionsQ.isLoading && (
              <div className="text-[11px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
                클리닉반이 없습니다. PC에서 강의 상세 → 반 편성으로 먼저 생성하세요.
              </div>
            )}
          </div>
        )}
        <Fld label="날짜 *" value={date} onChange={setDate} type="date" />
        <div className="flex gap-2">
          <Fld label="시작 *" value={startTime} onChange={setStartTime} type="time" />
          <Fld label="종료" value={endTime} onChange={setEndTime} type="time" />
        </div>
        {endTime && duration <= 0 && (
          <div className="text-[11px]" style={{ color: "var(--tc-danger)" }}>
            종료 시간은 시작 시간 이후여야 합니다.
          </div>
        )}
        <div className="flex gap-2">
          <Fld label="장소 *" value={location} onChange={setLocation} placeholder="예: 3층 자습실" />
          <div style={{ width: 80 }}><Fld label="정원 *" value={capacity} onChange={setCapacity} type="number" placeholder="명" /></div>
        </div>
        <label
          className="flex items-start gap-2 cursor-pointer"
          style={{
            padding: "10px",
            border: "1px solid var(--tc-border)",
            borderRadius: "var(--tc-radius-sm)",
            background: "var(--tc-surface-soft)",
          }}
        >
          <input
            type="checkbox"
            checked={allowMultiSlotBooking}
            onChange={(event) => setAllowMultiSlotBooking(event.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span className="flex flex-col gap-0.5">
            <strong className="text-xs" style={{ color: "var(--tc-text)" }}>
              같은 날 여러 시간대 예약
            </strong>
            <small className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
              켜면 이 옵션이 켜진 클리닉끼리 한 학생을 여러 시간대에 예약할 수 있습니다.
            </small>
          </span>
        </label>
        <button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: canSubmit ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: canSubmit ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending ? "생성 중..." : "생성"}
        </button>
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
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm"
        style={{ padding: "8px 10px", borderRadius: "var(--tc-radius-sm)", border: "1px solid var(--tc-border-strong)", background: "var(--tc-surface-soft)", color: "var(--tc-text)", outline: "none" }} />
    </div>
  );
}

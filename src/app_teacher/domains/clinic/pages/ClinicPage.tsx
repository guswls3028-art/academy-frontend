// PATH: src/app_teacher/domains/clinic/pages/ClinicPage.tsx
// 클리닉 — 오늘의 세션 + 참가자 관리 (section_mode 전용)
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { useSectionMode } from "@/shared/hooks/useSectionMode";
import { Plus, ChevronLeft, ChevronRight } from "@teacher/shared/ui/Icons";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import {
  fetchClinicSessions,
  fetchClinicParticipants,
  patchParticipantStatus,
  completeParticipant,
  createClinicSession,
  deleteClinicSession,
} from "../api";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";

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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function ClinicPage() {
  const { sectionMode } = useSectionMode();
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["teacher-clinic-sessions", dateFrom, dateTo],
    queryFn: () => fetchClinicSessions({ date_from: dateFrom, date_to: dateTo }),
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: deleteClinicSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-clinic-sessions"] });
      teacherToast.success("세션이 삭제되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "세션을 삭제하지 못했습니다.")),
  });

  const isToday = dateFrom === todayISO() && dateTo === todayISO();

  if (!sectionMode) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold py-1" style={{ color: "var(--tc-text)" }}>클리닉</h2>
        <EmptyState scope="panel" tone="empty" title="이 학원에서는 클리닉 기능을 사용하지 않습니다" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header with date nav + create */}
      <div className="flex justify-between items-center py-1">
        <h2 className="text-base font-bold" style={{ color: "var(--tc-text)" }}>클리닉</h2>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={14} /> 세션 생성
        </button>
      </div>

      {/* Date range selector */}
      <div className="flex items-center gap-2 justify-center">
        <button onClick={() => { setDateFrom(addDays(dateFrom, -1)); setDateTo(addDays(dateTo, -1)); }}
          className="flex p-1 cursor-pointer" style={{ background: "none", border: "none", color: "var(--tc-text-muted)" }}>
          <ChevronLeft size={18} />
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
          <ChevronRight size={18} />
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
          {sessions.map((s: any) => (
            <SessionCard
              key={s.id}
              session={s}
              expanded={selectedSession === s.id}
              onToggle={() => setSelectedSession(selectedSession === s.id ? null : s.id)}
              onDelete={() => { if (confirm("이 세션을 삭제하시겠습니까?")) deleteMut.mutate(s.id); }}
            />
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title={isToday ? "오늘 예정된 클리닉 세션이 없습니다" : "해당 기간에 클리닉 세션이 없습니다"} />
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
}: {
  session: any;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
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
          <div className="text-[15px] font-semibold truncate" style={{ color: "var(--tc-text)" }}>
            {session.title || "클리닉 세션"}
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
          <ParticipantList sessionId={session.id} />
          <div style={{ padding: "0 var(--tc-space-4) var(--tc-space-3)", textAlign: "right" }}>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-[11px] font-semibold cursor-pointer"
              style={{ padding: "4px 10px", borderRadius: "var(--tc-radius-sm)", border: "none", background: "var(--tc-danger-bg)", color: "var(--tc-danger)" }}>
              세션 삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ParticipantList({ sessionId }: { sessionId: number }) {
  const qc = useQueryClient();

  const { data: participants, isLoading } = useQuery({
    queryKey: ["teacher-clinic-participants", sessionId],
    queryFn: () => fetchClinicParticipants(sessionId),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      patchParticipantStatus(id, { status }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["teacher-clinic-participants", sessionId] });
      qc.invalidateQueries({ queryKey: ["teacher-clinic-sessions"] });
      if (variables.status === "attended" && participants) {
        const attendedCount =
          participants.filter((p: any) => p.status === "attended").length +
          (variables.status === "attended" ? 1 : 0);
        teacherToast.success(`출석 처리 완료 (현재 참석자 ${attendedCount}명)`);
      }
    },
    onError: (e) => teacherToast.error(extractApiError(e, "상태를 변경하지 못했습니다.")),
  });

  const completeMut = useMutation({
    mutationFn: completeParticipant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-clinic-participants", sessionId] });
      teacherToast.success("완료 처리되었습니다.");
    },
    onError: (e) => teacherToast.error(extractApiError(e, "완료 처리에 실패했습니다.")),
  });

  if (isLoading) return <div className="px-4 pb-4 text-sm" style={{ color: "var(--tc-text-muted)" }}>불러오는 중…</div>;
  if (!participants?.length)
    return <div className="px-4 pb-4 text-sm" style={{ color: "var(--tc-text-muted)" }}>참가자가 없습니다</div>;

  return (
    <div className="px-4 pb-4">
      <div style={{ height: 1, background: "var(--tc-border)", marginBottom: 12 }} />
      <div className="flex flex-col gap-1">
        {participants.map((p: any) => {
          const name = p.student_name ?? p.enrollment_name ?? "이름 없음";
          const st = p.status ?? "booked";
          return (
            <div
              key={p.id}
              className="flex justify-between items-center py-2 border-b last:border-b-0"
              style={{ borderColor: "var(--tc-border)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--tc-text)" }}>{name}</span>
                <StatusBadge status={st} />
              </div>
              <div className="flex gap-1">
                {st === "booked" && (
                  <SmallBtn
                    label="출석"
                    color="var(--tc-success)"
                    onClick={() => statusMut.mutate({ id: p.id, status: "attended" })}
                  />
                )}
                {st === "attended" && !p.is_completed && (
                  <SmallBtn
                    label="완료"
                    color="var(--tc-primary)"
                    onClick={() => completeMut.mutate(p.id)}
                  />
                )}
                {st !== "no_show" && st !== "attended" && st !== "cancelled" && (
                  <SmallBtn
                    label="결석"
                    color="var(--tc-danger)"
                    onClick={() => statusMut.mutate({ id: p.id, status: "no_show" })}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SmallBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] font-semibold px-2 py-1 rounded cursor-pointer"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: "none",
      }}
    >
      {label}
    </button>
  );
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  booked: { label: "예약", color: "var(--tc-info)" },
  attended: { label: "출석", color: "var(--tc-success)" },
  no_show: { label: "결석", color: "var(--tc-danger)" },
  cancelled: { label: "취소", color: "var(--tc-text-muted)" },
  rejected: { label: "거절", color: "var(--tc-text-muted)" },
};

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_LABELS[status] ?? { label: status, color: "var(--tc-text-muted)" };
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
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("10");

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
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-clinic-sessions"] });
      teacherToast.success("클리닉 세션이 생성되었습니다.");
      setTitle(""); setStartTime(""); setEndTime(""); setLocation(""); setCapacity("10");
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "클리닉 세션을 생성하지 못했습니다.")),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title="클리닉 세션 생성">
      <div className="flex flex-col gap-2.5" style={{ padding: "var(--tc-space-3) 0" }}>
        <Fld label="세션명 (선택)" value={title} onChange={setTitle} placeholder="예: 오후 클리닉" />
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

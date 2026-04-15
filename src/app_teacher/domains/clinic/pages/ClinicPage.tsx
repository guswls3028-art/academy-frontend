// PATH: src/app_teacher/domains/clinic/pages/ClinicPage.tsx
// 클리닉 — 오늘의 세션 + 참가자 관리 (section_mode 전용)
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import { useSectionMode } from "@/shared/hooks/useSectionMode";
import {
  fetchClinicSessions,
  fetchClinicParticipants,
  patchParticipantStatus,
  completeParticipant,
} from "../api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ClinicPage() {
  const { sectionMode } = useSectionMode();
  const today = todayISO();
  const [selectedSession, setSelectedSession] = useState<number | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["teacher-clinic-sessions", today],
    queryFn: () => fetchClinicSessions({ date_from: today, date_to: today }),
    staleTime: 30_000,
  });

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
      <div className="flex justify-between items-baseline py-1">
        <h2 className="text-base font-bold" style={{ color: "var(--tc-text)" }}>오늘 클리닉</h2>
        <span className="text-xs" style={{ color: "var(--tc-text-muted)" }}>{today}</span>
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
            />
          ))}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title="오늘 예정된 클리닉 세션이 없습니다" />
      )}
    </div>
  );
}

function SessionCard({
  session,
  expanded,
  onToggle,
}: {
  session: any;
  expanded: boolean;
  onToggle: () => void;
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

      {expanded && <ParticipantList sessionId={session.id} />}
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-clinic-participants", sessionId] });
    },
  });

  const completeMut = useMutation({
    mutationFn: completeParticipant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-clinic-participants", sessionId] });
    },
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

/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicConsoleWorkspace.tsx
 * 선택한 클리닉 수업의 대상자 관리 — 사유별(시험/과제/기타) 카드 + 재시험·과제점수 갱신 연결
 */

import { useNavigate } from "react-router-dom";
import { FileQuestion, BookOpen, User, ExternalLink, Edit3 } from "lucide-react";
import type { ClinicSessionTreeNode } from "../../api/clinicSessions.api";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import { Button } from "@/shared/ui/ds";

const REASON_LABEL: Record<string, string> = {
  exam: "시험 불합",
  homework: "과제 불합",
  both: "시험·과제 불합",
};

function formatTime(s: string | undefined) {
  if (!s) return "—";
  return s.slice(0, 5) || "—";
}

type Props = {
  selectedDate: string;
  session: ClinicSessionTreeNode | null;
  participants: ClinicParticipant[];
  isLoading: boolean;
};

export default function ClinicConsoleWorkspace({
  selectedDate,
  session,
  participants,
  isLoading,
}: Props) {
  const navigate = useNavigate();

  if (!session) return null;

  const timeLabel = formatTime(session.start_time);
  const sessionLabel = `${timeLabel} ${session.location || ""}`.trim();

  return (
    <>
      <p className={undefined} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "var(--space-4)" }}>
        {selectedDate} · {sessionLabel} — 예약 {participants.length}명
      </p>

      {isLoading ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>대상자 목록 불러오는 중…</p>
      ) : participants.length === 0 ? (
        <div
          style={{
            padding: "var(--space-8)",
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: 13,
            border: "1px dashed var(--color-border-divider)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-bg-surface-soft)",
          }}
        >
          이 클리닉에 예약된 대상자가 없습니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {participants.map((p) => {
            const reason = p.clinic_reason ?? "both";
            const reasonLabel = REASON_LABEL[reason] ?? "클리닉 대상";
            const isExam = reason === "exam" || reason === "both";
            const isHomework = reason === "homework" || reason === "both";

            return (
              <div
                key={p.id}
                style={{
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--color-border-divider)",
                  background: "var(--color-bg-surface)",
                  padding: "var(--space-5)",
                  transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "var(--space-4)",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "var(--radius-md)",
                        background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--color-primary)",
                        flexShrink: 0,
                      }}
                    >
                      <User size={20} aria-hidden />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
                        {p.student_name}
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--color-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {reason === "exam" && <FileQuestion size={12} aria-hidden />}
                        {reason === "homework" && <BookOpen size={12} aria-hidden />}
                        {reason === "both" && (
                          <>
                            <FileQuestion size={12} aria-hidden />
                            <BookOpen size={12} aria-hidden />
                          </>
                        )}
                        {reasonLabel}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
                    {isExam && (
                      <Button
                        size="sm"
                        intent="primary"
                        onClick={() => navigate("/admin/exams")}
                        title="시험 탐색에서 해당 학생의 재시험(2차·3차)을 관리합니다."
                      >
                        재시험 연결
                        <ExternalLink size={14} style={{ marginLeft: 4 }} aria-hidden />
                      </Button>
                    )}
                    {isHomework && (
                      <Button
                        size="sm"
                        intent="secondary"
                        onClick={() => navigate("/admin/results")}
                        title="성적 탐색에서 해당 차시 과제 점수를 갱신합니다."
                      >
                        과제 점수 갱신
                        <Edit3 size={14} style={{ marginLeft: 4 }} aria-hidden />
                      </Button>
                    )}
                    {!p.clinic_reason && (
                      <Button
                        size="sm"
                        intent="ghost"
                        onClick={() => navigate("/admin/students")}
                        title="학생 목록에서 확인"
                      >
                        학생 보기
                        <ExternalLink size={14} style={{ marginLeft: 4 }} aria-hidden />
                      </Button>
                    )}
                  </div>
                </div>
                {p.memo && (
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      paddingTop: "var(--space-3)",
                      borderTop: "1px solid var(--color-border-divider)",
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    메모: {p.memo}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

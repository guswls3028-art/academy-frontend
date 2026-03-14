/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicConsoleWorkspace.tsx
 * 선택한 클리닉 수업의 대상자 관리 — 진행 요약 바 + 출석/불참 토글 + 사유별(시험/과제/기타) 카드 + 재시험·과제점수 갱신 연결
 */

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { FileQuestion, BookOpen, User, ExternalLink, Edit3, CheckCircle, XCircle } from "lucide-react";
import type { ClinicSessionTreeNode } from "../../api/clinicSessions.api";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import { patchClinicParticipantStatus } from "../../api/clinicParticipants.api";
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
  const qc = useQueryClient();
  const navigate = useNavigate();

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "attended" | "no_show" }) =>
      patchClinicParticipantStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
  });

  const bulkAttendMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(
        ids.map((id) => patchClinicParticipantStatus(id, { status: "attended" }))
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
  });

  if (!session) return null;

  const timeLabel = formatTime(session.start_time);
  const sessionLabel = `${timeLabel} ${session.location || ""}`.trim();

  // Phase 6: 진행 요약 계산
  const progress = useMemo(() => {
    const attended = participants.filter((p) => p.status === "attended").length;
    const noShow = participants.filter((p) => p.status === "no_show").length;
    const pending = participants.filter(
      (p) => p.status !== "attended" && p.status !== "no_show" && p.status !== "cancelled" && p.status !== "rejected"
    ).length;
    const total = attended + noShow + pending;
    return { attended, noShow, pending, total };
  }, [participants]);

  // 전체 출석 대상: 아직 attended/no_show/cancelled/rejected 가 아닌 참가자
  const pendingIds = useMemo(
    () =>
      participants
        .filter((p) => p.status !== "attended" && p.status !== "no_show" && p.status !== "cancelled" && p.status !== "rejected")
        .map((p) => p.id),
    [participants]
  );

  function handleToggleStatus(p: ClinicParticipant, target: "attended" | "no_show") {
    if (statusMutation.isPending) return;
    // 이미 같은 상태면 booked로 되돌림 (토글 해제)
    if (p.status === target) {
      // 되돌림은 booked 로
      patchClinicParticipantStatus(p.id, { status: "booked" }).then(() => {
        qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      });
      return;
    }
    statusMutation.mutate({ id: p.id, status: target });
  }

  return (
    <>
      <p
        style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}
      >
        {selectedDate} · {sessionLabel} — 예약 {participants.length}명
      </p>

      {/* Phase 6: 진행 요약 바 */}
      {!isLoading && participants.length > 0 && (
        <div className="clinic-console__progress">
          <div className="clinic-console__progress-labels">
            <span className="clinic-console__progress-label clinic-console__progress-label--attended">
              출석 {progress.attended}명
            </span>
            <span className="clinic-console__progress-label clinic-console__progress-label--noshow">
              불참 {progress.noShow}명
            </span>
            <span className="clinic-console__progress-label clinic-console__progress-label--pending">
              미확인 {progress.pending}명
            </span>
          </div>
          {progress.total > 0 && (
            <div className="clinic-console__progress-bar">
              {progress.attended > 0 && (
                <div
                  className="clinic-console__progress-segment clinic-console__progress-segment--attended"
                  style={{ width: `${(progress.attended / progress.total) * 100}%` }}
                />
              )}
              {progress.noShow > 0 && (
                <div
                  className="clinic-console__progress-segment clinic-console__progress-segment--noshow"
                  style={{ width: `${(progress.noShow / progress.total) * 100}%` }}
                />
              )}
              {progress.pending > 0 && (
                <div
                  className="clinic-console__progress-segment clinic-console__progress-segment--pending"
                  style={{ width: `${(progress.pending / progress.total) * 100}%` }}
                />
              )}
            </div>
          )}
          {/* All-done state */}
          {progress.total > 0 && progress.pending === 0 && (
            <p className="clinic-console__progress-done">모든 학생 확인 완료 ✓</p>
          )}
        </div>
      )}

      {/* 전체 출석 버튼 */}
      {!isLoading && pendingIds.length > 0 && (
        <button
          type="button"
          className="clinic-console__bulk-attend"
          disabled={bulkAttendMutation.isPending}
          onClick={() => bulkAttendMutation.mutate(pendingIds)}
        >
          <CheckCircle size={14} aria-hidden />
          {bulkAttendMutation.isPending
            ? `처리 중… (${pendingIds.length}명)`
            : `전체 출석 (${pendingIds.length}명)`}
        </button>
      )}

      {isLoading ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>불러오는 중…</p>
      ) : participants.length === 0 ? (
        <div className="clinic-console__empty-session">
          <p className="clinic-console__empty-session-text">아직 예약된 학생이 없습니다.</p>
          <button
            type="button"
            className="clinic-console__empty-cta"
            onClick={() => navigate("/admin/clinic/bookings")}
          >
            예약 탭에서 추가 →
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {participants.map((p) => {
            const reason = p.clinic_reason ?? "both";
            const reasonLabel = REASON_LABEL[reason] ?? "클리닉 대상";
            const isExam = reason === "exam" || reason === "both";
            const isHomework = reason === "homework" || reason === "both";
            const isAttended = p.status === "attended";
            const isNoShow = p.status === "no_show";

            return (
              <div
                key={p.id}
                className={`clinic-console__card ${isAttended ? "clinic-console__card--attended" : ""} ${isNoShow ? "clinic-console__card--no-show" : ""}`}
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
                  {/* 좌측: 이름 + 사유 */}
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
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        {p.student_name}
                        {isAttended && <span className="clinic-console__status-label clinic-console__status-label--attended">✓ 출석</span>}
                        {isNoShow && <span className="clinic-console__status-label clinic-console__status-label--no-show">✗ 불참</span>}
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

                  {/* 우측: 출석 토글 + 액션 링크 */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
                    {/* 출석/불참 토글 버튼 그룹 */}
                    <div className="clinic-console__attendance-group">
                      <button
                        type="button"
                        className={`clinic-console__attendance-btn clinic-console__attendance-btn--attended ${isAttended ? "clinic-console__attendance-btn--active" : ""}`}
                        onClick={() => handleToggleStatus(p, "attended")}
                        disabled={statusMutation.isPending}
                      >
                        <CheckCircle size={14} aria-hidden />
                        출석
                      </button>
                      <button
                        type="button"
                        className={`clinic-console__attendance-btn clinic-console__attendance-btn--no-show ${isNoShow ? "clinic-console__attendance-btn--active" : ""}`}
                        onClick={() => handleToggleStatus(p, "no_show")}
                        disabled={statusMutation.isPending}
                      >
                        <XCircle size={14} aria-hidden />
                        불참
                      </button>
                    </div>

                    {/* 기존 액션 링크 */}
                    {isExam && (
                      <Button
                        size="sm"
                        intent="primary"
                        onClick={() => window.open("/admin/exams", "_blank")}
                        title="재시험 관리하러 가기"
                      >
                        재시험 관리 ↗
                        <ExternalLink size={14} style={{ marginLeft: 4 }} aria-hidden />
                      </Button>
                    )}
                    {isHomework && (
                      <Button
                        size="sm"
                        intent="secondary"
                        onClick={() => window.open("/admin/results", "_blank")}
                        title="과제 점수 확인하러 가기"
                      >
                        과제 점수 ↗
                        <Edit3 size={14} style={{ marginLeft: 4 }} aria-hidden />
                      </Button>
                    )}
                    {!p.clinic_reason && (
                      <Button
                        size="sm"
                        intent="ghost"
                        onClick={() => window.open("/admin/students", "_blank")}
                        title="학생 목록에서 확인"
                      >
                        학생 정보 ↗
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

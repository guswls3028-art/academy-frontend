/**
 * PATH: src/features/clinic/pages/OperationsConsolePage/ClinicConsoleWorkspace.tsx
 * 선택한 클리닉 수업의 대상자 관리 — 진행 요약 바 + 출석/불참 토글 + 미통과 항목 인라인 표시 + 상세 드로어
 */

import { lazy, Suspense, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { FileQuestion, BookOpen, User, CheckCircle, XCircle, X, UserPlus } from "lucide-react";
import type { ClinicSessionTreeNode } from "../../api/clinicSessions.api";
import type { ClinicParticipant } from "../../api/clinicParticipants.api";
import { patchClinicParticipantStatus, createClinicParticipant } from "../../api/clinicParticipants.api";
import type { ClinicTarget } from "../../api/clinicTargets";
import { useClinicTargets } from "../../hooks/useClinicTargets";
import { feedback } from "@/shared/ui/feedback/feedback";
import ClinicTargetSelectModal from "../../components/ClinicTargetSelectModal";
import type { ClinicTargetSelectResult } from "../../components/ClinicTargetSelectModal";

const StudentsDetailOverlay = lazy(() => import("@/features/students/overlays/StudentsDetailOverlay"));

function formatTime(s: string | undefined) {
  if (!s) return "—";
  return s.slice(0, 5) || "—";
}

function formatReasonLabel(reason: string | undefined): string {
  if (reason === "exam") return "시험 미통과";
  if (reason === "homework") return "과제 미통과";
  if (reason === "both") return "시험·과제 미통과";
  return "클리닉 대상";
}

function formatScoreDetail(target: ClinicTarget): string {
  const parts: string[] = [];

  if (target.clinic_reason === "exam" || target.clinic_reason === "both" || target.reason === "score") {
    if (target.exam_score != null && target.cutline_score != null) {
      parts.push(`시험 미통과 (${target.exam_score}/${target.cutline_score}점)`);
    } else {
      parts.push("시험 미통과");
    }
  }

  if (target.clinic_reason === "homework" || target.clinic_reason === "both") {
    if (target.homework_score != null && target.homework_cutline != null) {
      parts.push(`과제 미통과 (${target.homework_score}/${target.homework_cutline}점)`);
    } else {
      parts.push("과제 미통과");
    }
  }

  // Fallback if neither matched but we have a target
  if (parts.length === 0) {
    parts.push(formatReasonLabel(target.clinic_reason));
  }

  return parts.join(" · ");
}

type DrawerState = {
  participant: ClinicParticipant;
  target: ClinicTarget;
} | null;

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
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [studentOverlayId, setStudentOverlayId] = useState<number | null>(null);
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);

  const { data: clinicTargets } = useClinicTargets();

  // Build enrollment_id → ClinicTarget[] map for O(1) lookup
  const targetsByEnrollment = useMemo(() => {
    const map = new Map<number, ClinicTarget[]>();
    if (!clinicTargets) return map;
    for (const t of clinicTargets) {
      const existing = map.get(t.enrollment_id);
      if (existing) {
        existing.push(t);
      } else {
        map.set(t.enrollment_id, [t]);
      }
    }
    return map;
  }, [clinicTargets]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "attended" | "no_show" | "booked" }) =>
      patchClinicParticipantStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      feedback.error("처리에 실패했습니다. 다시 시도해 주세요.");
    },
  });

  const bulkAttendMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => patchClinicParticipantStatus(id, { status: "attended" }))
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error(`${ids.length - failed.length}명 처리 완료, ${failed.length}명 실패`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
    onError: (err: Error) => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      feedback.error(err.message || "일부 학생의 출석 처리에 실패했습니다.");
    },
  });

  if (!session) return null;

  const timeLabel = formatTime(session.start_time);
  const sessionLabel = `${timeLabel} ${session.location || ""}`.trim();

  const progress = useMemo(() => {
    const attended = participants.filter((p) => p.status === "attended").length;
    const noShow = participants.filter((p) => p.status === "no_show").length;
    const pending = participants.filter(
      (p) => p.status !== "attended" && p.status !== "no_show" && p.status !== "cancelled" && p.status !== "rejected"
    ).length;
    const total = attended + noShow + pending;
    return { attended, noShow, pending, total };
  }, [participants]);

  const pendingIds = useMemo(
    () =>
      participants
        .filter((p) => p.status !== "attended" && p.status !== "no_show" && p.status !== "cancelled" && p.status !== "rejected")
        .map((p) => p.id),
    [participants]
  );

  function handleToggleStatus(p: ClinicParticipant, target: "attended" | "no_show") {
    if (statusMutation.isPending) return;
    if (p.status === target) {
      statusMutation.mutate({ id: p.id, status: "booked" });
      return;
    }
    statusMutation.mutate({ id: p.id, status: target });
  }

  function handleMarkAttendedFromDrawer() {
    if (!drawer) return;
    const p = drawer.participant;
    if (p.status === "attended") {
      feedback.info("이미 출석 처리되었습니다.");
      return;
    }
    statusMutation.mutate(
      { id: p.id, status: "attended" },
      { onSuccess: () => setDrawer(null) }
    );
  }

  return (
    <>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}
      >
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", margin: 0 }}>
          {selectedDate} · {sessionLabel} — 예약 {participants.length}명
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            type="button"
            onClick={() => setAddStudentModalOpen(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 10px", fontSize: 12, fontWeight: 600,
              border: "1px dashed var(--color-brand-primary)", borderRadius: "var(--radius-sm)",
              background: "transparent", color: "var(--color-brand-primary)",
              cursor: "pointer", transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <UserPlus size={14} aria-hidden />
            학생 추가
          </button>
          {!isLoading && pendingIds.length > 0 && (
            <button
              type="button"
              className="clinic-console__bulk-attend"
              disabled={bulkAttendMutation.isPending}
              onClick={() => bulkAttendMutation.mutate(pendingIds)}
              style={{ margin: 0 }}
            >
              <CheckCircle size={14} aria-hidden />
              {bulkAttendMutation.isPending
                ? `처리 중… (${pendingIds.length}명)`
                : `전체 출석 (${pendingIds.length}명)`}
            </button>
          )}
        </div>
      </div>

      {/* 진행 요약 바 */}
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
          {progress.total > 0 && progress.pending === 0 && (
            <p className="clinic-console__progress-done">모든 학생 확인 완료</p>
          )}
        </div>
      )}

      {isLoading ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>불러오는 중…</p>
      ) : participants.length === 0 ? (
        <div className="clinic-console__empty-session">
          <p className="clinic-console__empty-session-text">아직 예약된 학생이 없습니다.</p>
          <button
            type="button"
            className="clinic-console__empty-cta"
            onClick={() => setAddStudentModalOpen(true)}
          >
            <UserPlus size={14} aria-hidden style={{ marginRight: 4 }} />
            학생 추가하기
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {participants.map((p) => {
            let targets = p.enrollment_id ? targetsByEnrollment.get(p.enrollment_id) ?? [] : [];
            // Fallback: 수동 등록 학생은 ClinicTarget이 없으므로 participant의 clinic_reason으로 표시
            if (targets.length === 0 && p.clinic_reason) {
              targets = [{
                enrollment_id: p.enrollment_id ?? 0,
                student_name: p.student_name,
                session_title: "",
                clinic_reason: p.clinic_reason,
                created_at: "",
              }];
            }
            const isAttended = p.status === "attended";
            const isNoShow = p.status === "no_show";

            return (
              <div
                key={p.id}
                className={`clinic-console__card ${isAttended ? "clinic-console__card--attended" : ""} ${isNoShow ? "clinic-console__card--no-show" : ""}`}
              >
                {/* Header: name + attendance */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-4)",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Left: avatar + name */}
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
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (p.student) {
                            setStudentOverlayId(p.student);
                          }
                        }}
                        style={{
                          background: "none", border: "none", padding: 0, cursor: "pointer",
                          fontSize: "inherit", fontWeight: "inherit", color: "var(--color-brand-primary)",
                          textDecoration: "underline", textDecorationColor: "transparent",
                          transition: "text-decoration-color 0.15s",
                        }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecorationColor = "var(--color-brand-primary)"; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecorationColor = "transparent"; }}
                        title="학생 정보 보기"
                      >
                        {p.student_name}
                      </button>
                      {isAttended && <span className="clinic-console__status-label clinic-console__status-label--attended">출석</span>}
                      {isNoShow && <span className="clinic-console__status-label clinic-console__status-label--no-show">불참</span>}
                    </div>
                  </div>

                  {/* Right: attendance toggle */}
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
                </div>

                {/* Failed items list */}
                {targets.length > 0 ? (
                  <ul className="clinic-console__deficit-list">
                    {targets.map((t, idx) => (
                      <li key={`${t.enrollment_id}-${t.session_title}-${idx}`}>
                        <button
                          type="button"
                          className="clinic-console__deficit-item"
                          onClick={() => setDrawer({ participant: p, target: t })}
                        >
                          <span className={`clinic-console__deficit-badge ${
                            t.clinic_reason === "homework"
                              ? "clinic-console__deficit-badge--homework"
                              : "clinic-console__deficit-badge--exam"
                          }`}>
                            {t.clinic_reason === "homework" ? (
                              <BookOpen size={12} aria-hidden />
                            ) : (
                              <FileQuestion size={12} aria-hidden />
                            )}
                          </span>
                          <span className="clinic-console__deficit-text">
                            {t.session_title} · {formatScoreDetail(t)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="clinic-console__self-study">자율 학습 참여</div>
                )}

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

      {/* Detail Drawer */}
      {drawer && (
        <>
          <div
            className="clinic-console__drawer-backdrop"
            onClick={() => setDrawer(null)}
            aria-hidden
          />
          <div
            className="clinic-console__drawer"
            role="dialog"
            aria-modal="true"
            aria-label="클리닉 상세"
          >
            <div className="clinic-console__drawer-header">
              <h2 className="clinic-console__drawer-title">클리닉 상세</h2>
              <button
                type="button"
                className="clinic-console__drawer-close"
                onClick={() => setDrawer(null)}
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="clinic-console__drawer-body">
              <div className="clinic-console__drawer-field">
                <span className="clinic-console__drawer-label">학생</span>
                <span className="clinic-console__drawer-value">{drawer.participant.student_name}</span>
              </div>

              <div className="clinic-console__drawer-field">
                <span className="clinic-console__drawer-label">수업</span>
                <span className="clinic-console__drawer-value">{drawer.target.session_title}</span>
              </div>

              <div className="clinic-console__drawer-field">
                <span className="clinic-console__drawer-label">사유</span>
                <span className="clinic-console__drawer-value">{formatReasonLabel(drawer.target.clinic_reason)}</span>
              </div>

              {/* Exam score detail */}
              {(drawer.target.clinic_reason === "exam" || drawer.target.clinic_reason === "both" || drawer.target.reason === "score") &&
                drawer.target.exam_score != null && drawer.target.cutline_score != null && (
                <div className="clinic-console__drawer-score-block">
                  <div className="clinic-console__drawer-score-row">
                    <span>시험 점수</span>
                    <span className="clinic-console__drawer-score-value clinic-console__drawer-score-value--fail">
                      {drawer.target.exam_score}점
                    </span>
                  </div>
                  <div className="clinic-console__drawer-score-row">
                    <span>통과 기준</span>
                    <span className="clinic-console__drawer-score-value">
                      {drawer.target.cutline_score}점
                    </span>
                  </div>
                  <div className="clinic-console__drawer-score-bar">
                    <div
                      className="clinic-console__drawer-score-fill clinic-console__drawer-score-fill--fail"
                      style={{
                        width: `${Math.min(100, (drawer.target.exam_score / drawer.target.cutline_score) * 100)}%`,
                      }}
                    />
                    <div
                      className="clinic-console__drawer-score-cutline"
                      style={{ left: "100%" }}
                      aria-label={`통과 기준: ${drawer.target.cutline_score}점`}
                    />
                  </div>
                </div>
              )}

              {/* Homework score detail */}
              {(drawer.target.clinic_reason === "homework" || drawer.target.clinic_reason === "both") &&
                drawer.target.homework_score != null && drawer.target.homework_cutline != null && (
                <div className="clinic-console__drawer-score-block">
                  <div className="clinic-console__drawer-score-row">
                    <span>과제 점수</span>
                    <span className="clinic-console__drawer-score-value clinic-console__drawer-score-value--fail">
                      {drawer.target.homework_score}점
                    </span>
                  </div>
                  <div className="clinic-console__drawer-score-row">
                    <span>통과 기준</span>
                    <span className="clinic-console__drawer-score-value">
                      {drawer.target.homework_cutline}점
                    </span>
                  </div>
                  <div className="clinic-console__drawer-score-bar">
                    <div
                      className="clinic-console__drawer-score-fill clinic-console__drawer-score-fill--fail"
                      style={{
                        width: `${Math.min(100, (drawer.target.homework_score / drawer.target.homework_cutline) * 100)}%`,
                      }}
                    />
                    <div
                      className="clinic-console__drawer-score-cutline"
                      style={{ left: "100%" }}
                    />
                  </div>
                </div>
              )}

              {/* Attend status */}
              <div className="clinic-console__drawer-field" style={{ marginTop: "var(--space-4)" }}>
                <span className="clinic-console__drawer-label">출석 상태</span>
                <span className="clinic-console__drawer-value">
                  {drawer.participant.status === "attended"
                    ? "출석 완료"
                    : drawer.participant.status === "no_show"
                    ? "불참"
                    : "미확인"}
                </span>
              </div>
            </div>

            <div className="clinic-console__drawer-footer">
              {drawer.participant.status !== "attended" ? (
                <button
                  type="button"
                  className="clinic-console__drawer-action"
                  onClick={handleMarkAttendedFromDrawer}
                  disabled={statusMutation.isPending}
                >
                  <CheckCircle size={16} aria-hidden />
                  {statusMutation.isPending ? "처리 중…" : "출석 처리"}
                </button>
              ) : (
                <span className="clinic-console__drawer-done">출석 처리 완료</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Student detail overlay — portal to body for proper z-index layering */}
      {studentOverlayId != null &&
        createPortal(
          <Suspense fallback={null}>
            <StudentsDetailOverlay
              studentId={studentOverlayId}
              onClose={() => setStudentOverlayId(null)}
            />
          </Suspense>,
          document.body,
        )}

      {/* 학생 추가 모달 — 대상자 또는 전체 학생 선택 */}
      <ClinicTargetSelectModal
        open={addStudentModalOpen}
        onClose={() => setAddStudentModalOpen(false)}
        initialMode="targets"
        onConfirm={async (result: ClinicTargetSelectResult) => {
          setAddStudentModalOpen(false);
          if (!session || result.ids.length === 0) return;
          const results = await Promise.allSettled(
            result.ids.map((enrollmentId) =>
              createClinicParticipant({ session: session.id, enrollment_id: enrollmentId, status: "booked" })
            )
          );
          const failed = results.filter((r) => r.status === "rejected").length;
          qc.invalidateQueries({ queryKey: ["clinic-participants"] });
          qc.invalidateQueries({ queryKey: ["clinic-sessions-tree"] });
          if (failed > 0) {
            feedback.warning(`${result.ids.length - failed}명 추가, ${failed}명 실패`);
          } else {
            feedback.success(`${result.ids.length}명이 추가되었습니다.`);
          }
        }}
      />
    </>
  );
}

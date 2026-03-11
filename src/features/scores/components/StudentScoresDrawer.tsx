/**
 * 성적 탭 — 학생 상세 드로어 (우측 슬라이드)
 * 읽기 모드에서 학생 이름 클릭 시 열림
 * - 학생 프로필 (아바타, 이름, 강의)
 * - 세션 내 모든 시험 결과 요약 (점수, 합불, 제출시각)
 * - 시험별 재응시(retry) 이력
 */

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import type { SessionScoreRow, SessionScoreExamEntry, SessionScoreMeta } from "../api/sessionScores";
import { fetchAdminExamResultDetail } from "@/features/results/api/adminExamResultDetail";
import CloseButton from "@/shared/ui/ds/CloseButton";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import "./StudentScoresDrawer.css";

type Props = {
  row: SessionScoreRow;
  meta: SessionScoreMeta | null;
  onClose: () => void;
  /** 답안 상세 드로어 열기 — 기존 StudentResultDrawer 연계 */
  onOpenAnswerDetail?: (examId: number, enrollmentId: number, examTitle: string) => void;
};

export default function StudentScoresDrawer({ row, meta, onClose, onOpenAnswerDetail }: Props) {
  const [expandedExamId, setExpandedExamId] = useState<number | null>(null);

  const toggleExpand = useCallback((examId: number) => {
    setExpandedExamId((prev) => (prev === examId ? null : examId));
  }, []);

  return (
    <>
      <div className="ds-overlay-backdrop" onClick={onClose} aria-hidden />
      <div className="ds-overlay-wrap ds-overlay-wrap--drawer-right">
        <div
          className="ds-overlay-panel student-scores-drawer"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-scores-drawer-title"
        >
          <CloseButton className="ds-overlay-panel__close" onClick={onClose} />

          {/* Header */}
          <header className="ds-overlay-header" style={{ paddingRight: 48 }}>
            <div className="ds-overlay-header__inner">
              <div className="ds-overlay-header__left">
                {/* Avatar */}
                <div className="ds-overlay-header__avatar-wrap">
                  <div className="ds-overlay-header__avatar" style={{ width: 56, height: 56, fontSize: "1.5rem" }}>
                    {(row as any).profile_photo_url ? (
                      <img src={(row as any).profile_photo_url} alt="" />
                    ) : (
                      (row.student_name ?? "?").charAt(0)
                    )}
                  </div>
                </div>
                <div className="ds-overlay-header__title-block">
                  <h1 id="student-scores-drawer-title" className="ds-overlay-header__title" style={{ fontSize: 18 }}>
                    <StudentNameWithLectureChip
                      name={row.student_name ?? ""}
                      lectures={
                        (row as any).lecture_title
                          ? [{ lectureName: (row as any).lecture_title, color: (row as any).lecture_color }]
                          : undefined
                      }
                      chipSize={14}
                    />
                  </h1>
                  <div className="ds-overlay-header__pills">
                    <span className="ds-badge ds-overlay-header__badge-id">
                      ID {row.enrollment_id}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Body */}
          <div className="ds-overlay-body" style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
            {/* Exam results */}
            {row.exams && row.exams.length > 0 ? (
              <section className="student-scores-drawer__section">
                <h3 className="student-scores-drawer__section-title">시험 결과</h3>
                <ul className="student-scores-drawer__exam-list">
                  {row.exams.map((exam) => (
                    <ExamResultCard
                      key={exam.exam_id}
                      exam={exam}
                      enrollmentId={row.enrollment_id}
                      expanded={expandedExamId === exam.exam_id}
                      onToggle={() => toggleExpand(exam.exam_id)}
                      onOpenDetail={
                        onOpenAnswerDetail
                          ? () => onOpenAnswerDetail(exam.exam_id, row.enrollment_id, exam.title)
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            ) : (
              <div className="student-scores-drawer__empty">
                배정된 시험이 없습니다.
              </div>
            )}

            {/* Homework results */}
            {row.homeworks && row.homeworks.length > 0 && (
              <section className="student-scores-drawer__section">
                <h3 className="student-scores-drawer__section-title">과제 결과</h3>
                <ul className="student-scores-drawer__hw-list">
                  {row.homeworks.map((hw) => (
                    <li key={hw.homework_id} className="student-scores-drawer__hw-card">
                      <div className="student-scores-drawer__hw-header">
                        <span className="student-scores-drawer__hw-title">{hw.title}</span>
                        <PassBadge passed={hw.block.passed} />
                      </div>
                      <div className="student-scores-drawer__hw-score">
                        {hw.block.score != null ? (
                          <span>
                            {hw.block.score}
                            {hw.block.max_score != null && <span className="student-scores-drawer__max-score"> / {hw.block.max_score}</span>}
                          </span>
                        ) : (
                          <span className="student-scores-drawer__no-score">미제출</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Exam Result Card with retry history ── */

function ExamResultCard({
  exam,
  enrollmentId,
  expanded,
  onToggle,
  onOpenDetail,
}: {
  exam: SessionScoreExamEntry;
  enrollmentId: number;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail?: () => void;
}) {
  return (
    <li className="student-scores-drawer__exam-card">
      <div className="student-scores-drawer__exam-header" onClick={onToggle} role="button" tabIndex={0}>
        <div className="student-scores-drawer__exam-title-row">
          <span className="student-scores-drawer__exam-title">{exam.title}</span>
          <PassBadge passed={exam.block.passed} />
        </div>
        <div className="student-scores-drawer__exam-score-row">
          {exam.block.score != null ? (
            <span className="student-scores-drawer__exam-score">
              {exam.block.score}
              {exam.block.max_score != null && (
                <span className="student-scores-drawer__max-score"> / {exam.block.max_score}</span>
              )}
            </span>
          ) : (
            <span className="student-scores-drawer__no-score">미응시</span>
          )}
          {exam.block.objective_score != null && exam.block.subjective_score != null && (
            <span className="student-scores-drawer__exam-breakdown">
              (객 {exam.block.objective_score} + 주 {exam.block.subjective_score})
            </span>
          )}
          <span className={`student-scores-drawer__expand-icon ${expanded ? "is-expanded" : ""}`} aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </div>

      {expanded && (
        <ExamRetryHistory
          examId={exam.exam_id}
          enrollmentId={enrollmentId}
          onOpenDetail={onOpenDetail}
        />
      )}
    </li>
  );
}

/* ── Retry History (fetched on expand) ── */

function ExamRetryHistory({
  examId,
  enrollmentId,
  onOpenDetail,
}: {
  examId: number;
  enrollmentId: number;
  onOpenDetail?: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-exam-detail", examId, enrollmentId],
    queryFn: () => fetchAdminExamResultDetail(examId, enrollmentId),
    enabled: Number.isFinite(examId) && Number.isFinite(enrollmentId),
  });

  return (
    <div className="student-scores-drawer__retry-section">
      {isLoading && (
        <div className="student-scores-drawer__retry-loading">불러오는 중...</div>
      )}
      {error && (
        <div className="student-scores-drawer__retry-error">상세 조회 실패</div>
      )}
      {data && !error && (
        <div className="student-scores-drawer__retry-content">
          <div className="student-scores-drawer__retry-row">
            <span className="student-scores-drawer__retry-label">제출 시각</span>
            <span className="student-scores-drawer__retry-value">
              {data.submitted_at ? formatDateTime(data.submitted_at) : "—"}
            </span>
          </div>
          <div className="student-scores-drawer__retry-row">
            <span className="student-scores-drawer__retry-label">응시 회차</span>
            <span className="student-scores-drawer__retry-value">
              {data.attempt_id != null ? `${data.attempt_id}회차` : "—"}
            </span>
          </div>
          <div className="student-scores-drawer__retry-row">
            <span className="student-scores-drawer__retry-label">총점</span>
            <span className="student-scores-drawer__retry-value">
              {data.total_score} / {data.max_score}
            </span>
          </div>
          <div className="student-scores-drawer__retry-row">
            <span className="student-scores-drawer__retry-label">문항 수</span>
            <span className="student-scores-drawer__retry-value">
              {data.items?.length ?? 0}문항
            </span>
          </div>

          {onOpenDetail && (
            <button
              type="button"
              className="student-scores-drawer__detail-btn"
              onClick={onOpenDetail}
            >
              답안 상세 보기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Shared sub-components ── */

function PassBadge({ passed }: { passed: boolean | null | undefined }) {
  if (passed == null) return null;
  return (
    <span
      className="ds-scores-pass-fail-badge"
      data-tone={passed ? "success" : "danger"}
    >
      {passed ? "합격" : "불합"}
    </span>
  );
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}`;
  } catch {
    return iso;
  }
}

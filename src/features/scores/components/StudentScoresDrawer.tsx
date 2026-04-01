/**
 * 성적 탭 — 학생 상세 드로어 (우측 사이드 패널, non-blocking)
 * - 학생 프로필 (아바타, 이름, 강의)
 * - 세션 내 모든 시험/과제 결과 요약 (점수, 퍼센트, 합불)
 * - 미달 항목 요약
 * - 시험별 재응시(retry) 이력
 * - 성적 발송 (메시지 모달 연계)
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { SessionScoreRow, SessionScoreExamEntry, SessionScoreHomeworkEntry, SessionScoreMeta } from "../api/sessionScores";
import { fetchAdminExamResultDetail } from "@/features/results/api/adminExamResultDetail";
import { fetchAttemptHistory, type AttemptHistoryResponse } from "../api/attemptHistory";
import { submitClinicRetake, updateClinicRetake } from "@/features/clinic/api/clinicLinks.api";
import { patchExamTotalScoreQuick } from "../api/patchExamTotalQuick";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import { generateScoreReport, buildScoreDetail, substituteScoreVars } from "../utils/generateScoreReport";
import { fetchMessageTemplates } from "@/features/messages/api/messages.api";
import { useSendMessageModal } from "@/features/messages/context/SendMessageModalContext";
import { feedback } from "@/shared/ui/feedback/feedback";
import CloseButton from "@/shared/ui/ds/CloseButton";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import "./StudentScoresDrawer.css";

type Props = {
  row: SessionScoreRow;
  meta: SessionScoreMeta | null;
  sessionId?: number;
  onClose: () => void;
  /** 답안 상세 드로어 열기 — 기존 StudentResultDrawer 연계 */
  onOpenAnswerDetail?: (examId: number, enrollmentId: number, examTitle: string) => void;
};

function pctNum(score: number | null | undefined, max: number | null | undefined): number | null {
  if (score == null || max == null || max === 0) return null;
  return Math.round((score / max) * 100);
}

export default function StudentScoresDrawer({ row, meta, sessionId, onClose, onOpenAnswerDetail }: Props) {
  const [expandedExamId, setExpandedExamId] = useState<number | null>(null);
  const [expandedHwId, setExpandedHwId] = useState<number | null>(null);
  const { openSendMessageModal } = useSendMessageModal();

  const toggleExpand = useCallback((examId: number) => {
    setExpandedExamId((prev) => (prev === examId ? null : examId));
  }, []);

  // Compute failed items summary
  const failedItems = useMemo(() => {
    const items: string[] = [];
    for (const exam of row.exams ?? []) {
      if (exam.block.passed === false || exam.block.score == null) items.push(exam.title);
    }
    for (const hw of row.homeworks ?? []) {
      if (hw.block.passed === false || hw.block.score == null) items.push(hw.title);
    }
    return items;
  }, [row]);

  // Overall stats + completion rates
  const stats = useMemo(() => {
    let totalScore = 0;
    let totalMax = 0;
    let count = 0;
    let examTotal = 0;
    let examPassed = 0;
    let hwTotal = 0;
    let hwPassed = 0;
    for (const exam of row.exams ?? []) {
      examTotal++;
      if (exam.block.score != null) {
        totalScore += exam.block.score;
        const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
        const max = exam.block.max_score ?? metaExam?.max_score ?? 0;
        totalMax += max;
        count++;
      }
      if (exam.block.passed === true) examPassed++;
    }
    for (const hw of row.homeworks ?? []) {
      hwTotal++;
      if (hw.block.score != null) {
        totalScore += hw.block.score;
        totalMax += hw.block.max_score ?? 0;
        count++;
      }
      if (hw.block.passed === true) hwPassed++;
    }
    const examPassRate = examTotal > 0 ? Math.round((examPassed / examTotal) * 100) : null;
    const hwPassRate = hwTotal > 0 ? Math.round((hwPassed / hwTotal) * 100) : null;
    return {
      totalScore, totalMax, count,
      pct: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
      examTotal, examPassed, examPassRate,
      hwTotal, hwPassed, hwPassRate,
    };
  }, [row, meta]);

  const handleSendScoreReport = useCallback(async () => {
    const lectureName = (row as any).lecture_title ?? "";
    const sessionTitle = (row as any).session_title ?? "";
    const reportOptions = { lectureName, sessionTitle };

    // 성적 카테고리 템플릿이 있으면 템플릿 기반 치환
    let body: string;
    try {
      const templates = await fetchMessageTemplates("grades");
      const customTpl = templates.find((t) => !t.name.startsWith("[학원플러스]"));
      body = customTpl
        ? substituteScoreVars(customTpl.body, row, meta, reportOptions)
        : generateScoreReport(row, meta, reportOptions);
    } catch {
      body = generateScoreReport(row, meta, reportOptions);
    }

    const scoreDetail = buildScoreDetail(row, meta);
    openSendMessageModal({
      studentIds: row.student_id != null ? [row.student_id] : [],
      recipientLabel: `${row.student_name} 성적 발송`,
      blockCategory: "grades",
      initialBody: body,
      alimtalkExtraVars: {
        강의명: lectureName,
        차시명: sessionTitle,
        시험성적: scoreDetail,
      },
    });
  }, [row, meta, openSendMessageModal]);

  return (
    <div className="student-scores-drawer-side-panel">
      <div
        className="student-scores-drawer"
        role="complementary"
        aria-labelledby="student-scores-drawer-title"
      >
        <CloseButton className="student-scores-drawer__close" onClick={onClose} />

        {/* Header */}
        <header className="student-scores-drawer__header">
          <div className="student-scores-drawer__avatar" style={{ width: 40, height: 40, fontSize: "1.1rem" }}>
            {(row as any).profile_photo_url ? (
              <img src={(row as any).profile_photo_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              (row.student_name ?? "?").charAt(0)
            )}
          </div>
          <div className="student-scores-drawer__header-info">
            <h2 id="student-scores-drawer-title" className="student-scores-drawer__header-name">
              <StudentNameWithLectureChip
                name={row.student_name ?? ""}
                lectures={
                  (row as any).lecture_title
                    ? [{ lectureName: (row as any).lecture_title, color: (row as any).lecture_color, chipLabel: (row as any).lecture_chip_label }]
                    : undefined
                }
                chipSize={12}
                clinicHighlight={row.name_highlight_clinic_target === true}
              />
            </h2>
            <span className="student-scores-drawer__header-id">ID {row.enrollment_id}</span>
          </div>
        </header>

        {/* Body */}
        <div className="student-scores-drawer__body">
          {/* ── Final verdict banner ── */}
          <VerdictBanner clinicRequired={!!row.clinic_required} failedCount={failedItems.length} />

          {/* ── Overall summary ── */}
          {stats.count > 0 && (
            <section className="student-scores-drawer__section">
              <h3 className="student-scores-drawer__section-title">종합</h3>
              <div className="student-scores-drawer__summary">
                {stats.examPassRate != null && (
                  <div className="student-scores-drawer__summary-row">
                    <span className="student-scores-drawer__summary-label">시험 합격률</span>
                    <span className="student-scores-drawer__summary-value">
                      <span style={{ color: stats.examPassRate === 100 ? "var(--color-success)" : stats.examPassRate < 50 ? "var(--color-error)" : "var(--color-text-primary)" }}>
                        {stats.examPassRate}%
                      </span>
                      <span className="student-scores-drawer__max-score"> ({stats.examPassed}/{stats.examTotal})</span>
                    </span>
                  </div>
                )}
                {stats.hwPassRate != null && (
                  <div className="student-scores-drawer__summary-row">
                    <span className="student-scores-drawer__summary-label">과제 합격률</span>
                    <span className="student-scores-drawer__summary-value">
                      <span style={{ color: stats.hwPassRate === 100 ? "var(--color-success)" : stats.hwPassRate < 50 ? "var(--color-error)" : "var(--color-text-primary)" }}>
                        {stats.hwPassRate}%
                      </span>
                      <span className="student-scores-drawer__max-score"> ({stats.hwPassed}/{stats.hwTotal})</span>
                    </span>
                  </div>
                )}
                {failedItems.length > 0 && (
                  <div className="student-scores-drawer__summary-row">
                    <span className="student-scores-drawer__summary-label">미달 항목</span>
                    <span className="student-scores-drawer__summary-value" style={{ color: "var(--color-error)" }}>
                      {failedItems.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Exam results ── */}
          {row.exams && row.exams.length > 0 ? (
            <section className="student-scores-drawer__section">
              <h3 className="student-scores-drawer__section-title">
                시험 결과
                <span className="student-scores-drawer__section-count">{row.exams.length}건</span>
              </h3>
              <ul className="student-scores-drawer__exam-list">
                {row.exams.map((exam) => (
                  <ExamResultCard
                    key={exam.exam_id}
                    exam={exam}
                    meta={meta}
                    enrollmentId={row.enrollment_id}
                    sessionId={sessionId}
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

          {/* ── Homework results (expandable with retake) ── */}
          {row.homeworks && row.homeworks.length > 0 && (
            <section className="student-scores-drawer__section">
              <h3 className="student-scores-drawer__section-title">
                과제 결과
                <span className="student-scores-drawer__section-count">{row.homeworks.length}건</span>
              </h3>
              <ul className="student-scores-drawer__hw-list">
                {row.homeworks.map((hw) => (
                  <HomeworkResultCard
                    key={hw.homework_id}
                    hw={hw}
                    meta={meta}
                    enrollmentId={row.enrollment_id}
                    sessionId={sessionId}
                    expanded={expandedHwId === hw.homework_id}
                    onToggle={() => setExpandedHwId((prev) => (prev === hw.homework_id ? null : hw.homework_id))}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* ── Send score report button ── */}
          <div className="student-scores-drawer__actions">
            <button
              type="button"
              className="student-scores-drawer__send-btn"
              onClick={handleSendScoreReport}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
              성적 발송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Exam Result Card with retry history ── */

function ExamResultCard({
  exam,
  meta,
  enrollmentId,
  sessionId,
  expanded,
  onToggle,
  onOpenDetail,
}: {
  exam: SessionScoreExamEntry;
  meta: SessionScoreMeta | null;
  enrollmentId: number;
  sessionId?: number;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail?: () => void;
}) {
  const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
  const maxScore = exam.block.max_score ?? metaExam?.max_score ?? null;
  const percent = pctNum(exam.block.score, maxScore);

  return (
    <li className="student-scores-drawer__exam-card" data-passed={exam.block.passed === true ? "true" : exam.block.passed === false ? "false" : undefined}>
      <div className="student-scores-drawer__exam-header" onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }} role="button" tabIndex={0}>
        <div className="student-scores-drawer__exam-title-row">
          <span className="student-scores-drawer__exam-title">{exam.title}</span>
          <PassBadge passed={exam.block.passed} />
        </div>
        <div className="student-scores-drawer__exam-score-row">
          {exam.block.score != null ? (
            <span className="student-scores-drawer__exam-score" data-tone={exam.block.passed === true ? "success" : exam.block.passed === false ? "danger" : undefined}>
              {exam.block.score}
              {maxScore != null && (
                <span className="student-scores-drawer__max-score"> / {maxScore}</span>
              )}
              {percent != null && <PercentBadge value={percent} passed={exam.block.passed} />}
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
        <AttemptTimeline
          enrollmentId={enrollmentId}
          sourceType="exam"
          sourceId={exam.exam_id}
          sessionId={sessionId}
          onOpenDetail={onOpenDetail}
        />
      )}
    </li>
  );
}

/* ── Homework Result Card (expandable with retake) ── */

function HomeworkResultCard({
  hw,
  meta,
  enrollmentId,
  sessionId,
  expanded,
  onToggle,
}: {
  hw: SessionScoreHomeworkEntry;
  meta: SessionScoreMeta | null;
  enrollmentId: number;
  sessionId?: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
  const hwMaxScore = hw.block.max_score ?? metaHw?.max_score ?? null;
  const percent = pctNum(hw.block.score, hwMaxScore);

  return (
    <li className="student-scores-drawer__hw-card" data-passed={hw.block.passed === true ? "true" : hw.block.passed === false ? "false" : undefined}>
      <div className="student-scores-drawer__hw-header" onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }} role="button" tabIndex={0}>
        <div className="student-scores-drawer__hw-title-row">
          <span className="student-scores-drawer__hw-title">{hw.title}</span>
          <PassBadge passed={hw.block.passed} />
        </div>
        <div className="student-scores-drawer__hw-score-row">
          {hw.block.score != null ? (
            <span className="student-scores-drawer__hw-score-val" data-tone={hw.block.passed === true ? "success" : hw.block.passed === false ? "danger" : undefined}>
              {hw.block.score}
              {hwMaxScore != null && <span className="student-scores-drawer__max-score"> / {hwMaxScore}</span>}
              {percent != null && <PercentBadge value={percent} passed={hw.block.passed} />}
            </span>
          ) : (
            <span className="student-scores-drawer__no-score">미제출</span>
          )}
          <span className={`student-scores-drawer__expand-icon ${expanded ? "is-expanded" : ""}`} aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </div>

      {expanded && (
        <AttemptTimeline
          enrollmentId={enrollmentId}
          sourceType="homework"
          sourceId={hw.homework_id}
          sessionId={sessionId}
        />
      )}
    </li>
  );
}

/* ── Attempt Timeline (shared for exam & homework) ── */

function AttemptTimeline({
  enrollmentId,
  sourceType,
  sourceId,
  sessionId,
  onOpenDetail,
}: {
  enrollmentId: number;
  sourceType: "exam" | "homework";
  sourceId: number;
  sessionId?: number;
  onOpenDetail?: () => void;
}) {
  const qc = useQueryClient();
  const [showNewAttempt, setShowNewAttempt] = useState(false);
  const [retakeScore, setRetakeScore] = useState("");
  const [editingAttempt, setEditingAttempt] = useState<number | null>(null);
  const [editScore, setEditScore] = useState("");

  const isExam = sourceType === "exam";
  const retakeLabel = isExam ? "재시험" : "재시도";
  const sourceLabel = isExam ? "시험" : "과제";

  const queryParams = sourceType === "exam"
    ? { enrollment_id: enrollmentId, exam_id: sourceId }
    : { enrollment_id: enrollmentId, homework_id: sourceId };

  const { data, isLoading, error } = useQuery({
    queryKey: ["attempt-history", sourceType, sourceId, enrollmentId],
    queryFn: () => fetchAttemptHistory(queryParams),
    enabled: Number.isFinite(sourceId) && Number.isFinite(enrollmentId),
  });

  const retakeMutation = useMutation({
    mutationFn: (params: { clinicLinkId: number; score: number; maxScore?: number }) =>
      submitClinicRetake(params.clinicLinkId, {
        score: params.score,
        max_score: params.maxScore,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["attempt-history", sourceType, sourceId, enrollmentId] });
      qc.invalidateQueries({ queryKey: ["clinic-targets"] });
      qc.invalidateQueries({ queryKey: ["session-scores"] });
      setRetakeScore("");
      setShowNewAttempt(false);
      if (result.passed) {
        feedback.success(`${result.attempt_index}차 합격! (${result.score}점) — 자동 통과`);
      } else {
        feedback.warning(`${result.attempt_index}차 미통과 (${result.score}점)`);
      }
    },
    onError: () => feedback.error("점수 저장에 실패했습니다."),
  });

  // 2차+ 수정 mutation (update-retake API)
  const updateMutation = useMutation({
    mutationFn: (params: { clinicLinkId: number; attemptIndex: number; score: number; maxScore?: number }) =>
      updateClinicRetake(params.clinicLinkId, {
        attempt_index: params.attemptIndex,
        score: params.score,
        max_score: params.maxScore,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["attempt-history", sourceType, sourceId, enrollmentId] });
      qc.invalidateQueries({ queryKey: ["clinic-targets"] });
      qc.invalidateQueries({ queryKey: ["session-scores"] });
      setEditingAttempt(null);
      setEditScore("");
      if (result.passed) {
        feedback.success(`${result.attempt_index}차 수정 → 합격! (${result.score}점)`);
      } else {
        feedback.info(`${result.attempt_index}차 점수가 ${result.score}점으로 수정되었습니다.`);
      }
    },
    onError: () => feedback.error("점수 수정에 실패했습니다."),
  });

  // 1차 수정 mutation (기존 성적 PATCH API — progress pipeline 트리거)
  const editFirstMutation = useMutation({
    mutationFn: async (params: { score: number; maxScore?: number }) => {
      if (isExam) {
        return patchExamTotalScoreQuick({
          examId: sourceId,
          enrollmentId,
          score: params.score,
          maxScore: params.maxScore,
        });
      } else {
        if (!sessionId) throw new Error("sessionId가 필요합니다.");
        return patchHomeworkQuick({
          sessionId,
          enrollmentId,
          homeworkId: sourceId,
          score: params.score,
          maxScore: params.maxScore,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attempt-history", sourceType, sourceId, enrollmentId] });
      qc.invalidateQueries({ queryKey: ["clinic-targets"] });
      qc.invalidateQueries({ queryKey: ["session-scores"] });
      setEditingAttempt(null);
      setEditScore("");
      feedback.success("1차 점수가 수정되었습니다.");
    },
    onError: () => feedback.error("점수 수정에 실패했습니다."),
  });

  function handleEditSubmit(attemptIndex: number) {
    const val = parseFloat(editScore);
    if (isNaN(val) || val < 0) {
      feedback.error("올바른 점수를 입력해주세요.");
      return;
    }
    if (val > (data?.max_score ?? 100)) {
      feedback.error(`최대 점수(${data?.max_score})를 초과할 수 없습니다.`);
      return;
    }

    if (attemptIndex === 1) {
      // 1차: 기존 성적 PATCH API (Result + ExamAttempt 동기화 + progress pipeline)
      editFirstMutation.mutate({
        score: val,
        maxScore: data?.max_score ?? undefined,
      });
    } else {
      // 2차+: update-retake API
      if (!data?.clinic_link_id) return;
      updateMutation.mutate({
        clinicLinkId: data.clinic_link_id,
        attemptIndex: attemptIndex,
        score: val,
        maxScore: sourceType === "homework" ? data?.max_score : undefined,
      });
    }
  }

  function handleRetakeSubmit() {
    if (!data?.clinic_link_id) return;
    const val = parseFloat(retakeScore);
    if (isNaN(val) || val < 0) {
      feedback.error("올바른 점수를 입력해주세요.");
      return;
    }
    if (val > (data.max_score ?? 100)) {
      feedback.error(`최대 점수(${data.max_score})를 초과할 수 없습니다.`);
      return;
    }
    retakeMutation.mutate({
      clinicLinkId: data.clinic_link_id,
      score: val,
      maxScore: sourceType === "homework" ? data.max_score : undefined,
    });
  }

  const nextAttemptIndex = (data?.attempts.length ?? 0) + 1;
  const canAddRetake = data?.clinic_link_id && !data?.resolved;

  return (
    <div className="student-scores-drawer__retry-section">
      {isLoading && (
        <div className="student-scores-drawer__retry-loading">불러오는 중...</div>
      )}
      {error && (
        <div className="student-scores-drawer__retry-error">이력 조회 실패</div>
      )}
      {data && !error && (
        <div className="ssd-attempts">
          {/* ── 차수별 카드 블록 ── */}
          {data.attempts.map((a) => {
            const isEditing = editingAttempt === a.attempt_index;
            const canEdit = a.attempt_index === 1 || (a.attempt_index >= 2 && data.clinic_link_id != null);
            const isMutating = editFirstMutation.isPending || updateMutation.isPending || retakeMutation.isPending;

            return (
              <div
                key={a.attempt_index}
                className={`ssd-attempt-card ${a.passed === null ? "" : a.passed ? "ssd-attempt-card--passed" : "ssd-attempt-card--failed"}`}
              >
                <div className="ssd-attempt-card__header">
                  <span className="ssd-attempt-card__label">
                    {a.attempt_index === 1
                      ? `1차 ${sourceLabel}`
                      : `${a.attempt_index}차 ${retakeLabel}`}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {canEdit && !isEditing && (
                      <button
                        type="button"
                        className="ssd-attempt-card__edit-btn"
                        onClick={() => { setEditingAttempt(a.attempt_index); setEditScore(a.score != null ? String(a.score) : ""); }}
                        title="점수 수정"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                    )}
                    <span className={`ssd-attempt-card__badge ${a.passed === null ? "" : a.passed ? "ssd-attempt-card__badge--pass" : "ssd-attempt-card__badge--fail"}`}>
                      {a.passed === null ? "-" : a.passed ? "합격" : "불합격"}
                    </span>
                  </span>
                </div>

                {isEditing ? (
                  <div className="ssd-attempt-card__input-row">
                    <input
                      type="number"
                      className="ssd-attempt-card__input"
                      value={editScore}
                      onChange={(e) => setEditScore(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEditSubmit(a.attempt_index); } if (e.key === "Escape") { setEditingAttempt(null); setEditScore(""); } }}
                      placeholder="점수"
                      min={0}
                      max={data.max_score ?? undefined}
                      step="any"
                      disabled={isMutating}
                      autoFocus
                    />
                    <span className="ssd-attempt-card__max">/ {data.max_score}</span>
                    <button
                      type="button"
                      className="ssd-attempt-card__save"
                      onClick={() => handleEditSubmit(a.attempt_index)}
                      disabled={isMutating || !editScore.trim()}
                    >
                      {isMutating ? "저장 중..." : "저장"}
                    </button>
                    <button
                      type="button"
                      className="ssd-attempt-card__cancel"
                      onClick={() => { setEditingAttempt(null); setEditScore(""); }}
                      disabled={isMutating}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="ssd-attempt-card__score-row">
                    <span className="ssd-attempt-card__score">
                      {a.score != null ? a.score : "—"}
                    </span>
                    <span className="ssd-attempt-card__max">/ {data.max_score}</span>
                    {a.score != null && data.max_score > 0 && (
                      <span className={`ssd-attempt-card__pct ${a.passed ? "ssd-attempt-card__pct--pass" : "ssd-attempt-card__pct--fail"}`}>
                        {Math.round((a.score / data.max_score) * 100)}%
                      </span>
                    )}
                  </div>
                )}

                {data.pass_score != null && !isEditing && (
                  <div className="ssd-attempt-card__cutline">
                    합격 기준: {data.pass_score}점
                  </div>
                )}
              </div>
            );
          })}

          {/* ── + 재시험/재시도 추가하기 ── */}
          {canAddRetake && !showNewAttempt && (
            <button
              type="button"
              className="ssd-add-attempt-btn"
              onClick={() => setShowNewAttempt(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {nextAttemptIndex}차 {retakeLabel} 추가하기
            </button>
          )}

          {/* ── 새 시도 입력 카드 (동일 디자인) ── */}
          {canAddRetake && showNewAttempt && (
            <div className="ssd-attempt-card ssd-attempt-card--new">
              <div className="ssd-attempt-card__header">
                <span className="ssd-attempt-card__label">
                  {nextAttemptIndex}차 {retakeLabel}
                </span>
                <span className="ssd-attempt-card__badge ssd-attempt-card__badge--new">
                  점수 입력
                </span>
              </div>
              <div className="ssd-attempt-card__input-row">
                <input
                  type="number"
                  className="ssd-attempt-card__input"
                  value={retakeScore}
                  onChange={(e) => setRetakeScore(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRetakeSubmit(); } }}
                  placeholder="점수"
                  min={0}
                  max={data.max_score ?? undefined}
                  step="any"
                  disabled={retakeMutation.isPending}
                  autoFocus
                />
                <span className="ssd-attempt-card__max">/ {data.max_score}</span>
                <button
                  type="button"
                  className="ssd-attempt-card__save"
                  onClick={handleRetakeSubmit}
                  disabled={retakeMutation.isPending || !retakeScore.trim()}
                >
                  {retakeMutation.isPending ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  className="ssd-attempt-card__cancel"
                  onClick={() => { setShowNewAttempt(false); setRetakeScore(""); }}
                  disabled={retakeMutation.isPending}
                >
                  취소
                </button>
              </div>
              {data.pass_score != null && (
                <div className="ssd-attempt-card__cutline">
                  합격 기준: {data.pass_score}점
                </div>
              )}
            </div>
          )}

          {/* 통과 완료 표시 */}
          {data.clinic_link_id && data.resolved && (
            <div className="ssd-resolved-banner">
              클리닉 통과 완료
            </div>
          )}

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
  if (passed == null) {
    return (
      <span className="student-scores-drawer__pass-badge" data-tone="muted">
        미정
      </span>
    );
  }
  return (
    <span
      className="student-scores-drawer__pass-badge"
      data-tone={passed ? "success" : "danger"}
    >
      {passed ? "합격" : "불합격"}
    </span>
  );
}

function VerdictBanner({ clinicRequired, failedCount }: { clinicRequired: boolean; failedCount: number }) {
  const passed = !clinicRequired && failedCount === 0;
  const tone = passed ? "success" : "danger";
  return (
    <div className="student-scores-drawer__verdict" data-tone={tone}>
      <span className="student-scores-drawer__verdict-icon" aria-hidden>
        {passed ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </span>
      <span className="student-scores-drawer__verdict-text">
        <span className="student-scores-drawer__verdict-label">최종 판정</span>
        <span className="student-scores-drawer__verdict-value">
          {clinicRequired ? "클리닉 대상" : failedCount > 0 ? `미달 ${failedCount}건` : "전체 합격"}
        </span>
      </span>
    </div>
  );
}

function PercentBadge({ value, passed }: { value: number; passed?: boolean | null }) {
  const tone = passed === true ? "success" : passed === false ? "danger" : undefined;
  return (
    <span
      className="student-scores-drawer__score-percent"
      data-tone={tone}
    >
      {value}%
    </span>
  );
}


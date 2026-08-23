/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * 성적 탭 — 학생 상세 드로어 (우측 사이드 패널, non-blocking)
 * - 학생 프로필 (아바타, 이름, 강의)
 * - 세션 내 모든 시험/과제 결과 요약 (점수, 퍼센트, 합불)
 * - 미달 항목 요약
 * - 시험별 재응시(retry) 이력
 * - 성적 발송 (메시지 모달 연계)
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";

import {
  fetchSessionScores,
  patchAssessmentCorrection,
  type ScoreBlock,
  type SessionScoreRow,
  type SessionScoreExamEntry,
  type SessionScoreHomeworkEntry,
  type SessionScoreMeta,
  type SessionScoresResponse,
} from "../api/sessionScores";
import { deriveAchievement, deriveFinalPass, achievementLabel, achievementTone } from "@/shared/scoring/achievement";
import { fetchAdminExamResultDetail } from "@admin/domains/results/api/adminExamResultDetail";
import { fetchAttemptHistory, type AttemptHistoryResponse } from "../api/attemptHistory";
import { submitClinicRetake, updateClinicRetake } from "@admin/domains/clinic/api/clinicLinks.api";
import { patchExamTotalScoreQuick } from "../api/patchExamTotalQuick";
import { patchHomeworkQuick } from "../api/patchHomeworkQuick";
import { buildGenericScoreTemplate, buildScoreVars, buildScoreDetail, substituteScoreVars } from "@/shared/scoring/scoreReport";
import {
  getSessionRowAttentionCountLabel,
  getSessionRowAttentionSummary,
  getSessionScoresTableVerdict,
  isSessionRowProgressCompleted,
  type SessionRowAttentionSummary,
  type SessionScoresTableVerdictKind,
} from "../utils/sessionScoreRowVerdict";
import { fetchMessageTemplates } from "@admin/domains/messages/api/messages.api";
import { useSendMessageModal } from "@admin/domains/messages/context/SendMessageModalContext";
import { DEFAULT_GRADES_PRESET_ID } from "@/shared/messaging/gradeTemplatePreset";
import { feedback } from "@/shared/ui/feedback/feedback";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { scoresQueryKeys } from "../api/queryKeys";
import CloseButton from "@/shared/ui/ds/CloseButton";
import { Badge, Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import StudentDetailLink from "@admin/domains/students/public/StudentDetailLink";
import { useTenantLabels } from "@/shared/hooks/useTenantLabels";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  ExternalLink,
  HeartPulse,
  Image as ScanImageIcon,
  PencilLine,
  Send,
} from "lucide-react";
import "./StudentScoresDrawer.css";

type Props = {
  row: SessionScoreRow;
  meta: SessionScoreMeta | null;
  sessionId?: number;
  isEditMode?: boolean;
  hasUnsavedChanges?: boolean;
  onClose: () => void;
  /** 답안 상세 드로어 열기 — 기존 StudentResultDrawer 연계 */
  onOpenAnswerDetail?: (examId: number, enrollmentId: number, examTitle: string) => void;
};

const OMR_REVIEW_REASON_LABELS: Record<string, string> = {
  answer_blank_or_multi: "빈칸·중복마킹",
  answer_low_confidence: "낮은 인식 신뢰도",
  answer_status_not_ok: "인식 불완전",
  identifier_no_match: "학생 매칭 실패",
  identifier_no_enrollment_match: "학생 매칭 실패",
  identifier_missing: "식별번호 미인식",
  identifier_invalid: "식별번호 형식 확인",
  alignment_failed: "스캔 정렬 실패",
  ANSWER_STATUS_NOT_OK: "인식 불완전",
  NO_MATCH: "학생 매칭 실패",
};

function omrReviewReasonLabel(reason: string): string {
  const key = String(reason || "").trim();
  if (!key) return "";
  return OMR_REVIEW_REASON_LABELS[key] ?? OMR_REVIEW_REASON_LABELS[key.toLowerCase()] ?? key;
}

function pctNum(score: number | null | undefined, max: number | null | undefined): number | null {
  if (score == null || max == null || max === 0) return null;
  return Math.round((score / max) * 100);
}

export default function StudentScoresDrawer({ row, meta, sessionId, isEditMode = false, hasUnsavedChanges = false, onClose, onOpenAnswerDetail }: Props) {
  const [expandedExamId, setExpandedExamId] = useState<number | null>(null);
  const [expandedHwId, setExpandedHwId] = useState<number | null>(null);
  const { openSendMessageModal } = useSendMessageModal();
  const labels = useTenantLabels();
  const qc = useQueryClient();
  // SSOT: 일괄 발송 path(SessionScoresEntryPage)와 동일하게 React Query cache에서 lecture/session 메타 조회.
  // row.lecture_title/session_title는 backend serializer가 안 보내는 케이스가 있어 단독 fallback 불충분.
  const { lectureId: lectureIdParam } = useParams<{ lectureId: string; sessionId: string }>();
  const numericLectureId = Number(lectureIdParam);

  const toggleExpand = useCallback((examId: number) => {
    setExpandedExamId((prev) => (prev === examId ? null : examId));
  }, []);

  const attentionSummary = useMemo(
    () => getSessionRowAttentionSummary(row),
    [row],
  );
  const clinicRequired = !isSessionRowProgressCompleted(row) && !!row.clinic_required;
  const verdict = getSessionScoresTableVerdict(row);
  const attentionCount = attentionSummary.missingTitles.length
    + attentionSummary.reviewTitles.length
    + attentionSummary.failedTitles.length;
  const scoreSendDisabled = hasUnsavedChanges || row.student_id == null;
  const scoreSendTitle = hasUnsavedChanges
    ? "점수를 저장하고 잠근 뒤 알림톡을 발송할 수 있습니다."
    : row.student_id == null
      ? "학생 정보가 없어 발송할 수 없습니다."
      : "이 학생에게만 알림톡을 발송합니다.";

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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
      const examFinalPass = deriveFinalPass({
        achievement: exam.block.achievement ?? null,
        is_pass: exam.block.passed ?? null,
        final_pass: exam.block.final_pass ?? null,
        remediated: exam.block.remediated ?? null,
        meta_status: exam.block.meta?.status ?? null,
      });
      if (examFinalPass === true) examPassed++;
    }
    for (const hw of row.homeworks ?? []) {
      hwTotal++;
      if (hw.block.score != null) {
        totalScore += hw.block.score;
        totalMax += hw.block.max_score ?? 0;
        count++;
      }
      const homeworkComplete = hw.block.correction_status === "COMPLETED"
        || hw.block.correction_status === "NOT_REQUIRED"
        || (hw.block.correction_status == null && hw.block.passed === true);
      if (homeworkComplete) hwPassed++;
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
    if (hasUnsavedChanges) {
      feedback.info("점수를 저장하고 잠근 뒤 알림톡을 발송해 주세요.");
      return;
    }
    if (row.student_id == null) {
      feedback.warning("학생 정보가 없어 알림톡을 발송할 수 없습니다.");
      return;
    }
    let currentRow = row;
    let currentMeta = meta;
    if (sessionId != null && Number.isFinite(sessionId)) {
      try {
        const freshScores = await qc.fetchQuery({
          queryKey: scoresQueryKeys.sessionScores(sessionId),
          queryFn: () => fetchSessionScores(sessionId),
          staleTime: 0,
        });
        currentRow = freshScores.rows.find((candidate) => candidate.enrollment_id === row.enrollment_id) ?? row;
        currentMeta = freshScores.meta ?? meta;
      } catch {
        feedback.error("최신 성적을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
    }
    // SSOT (2026-05-13): 1순위 backend 응답 meta — session_scores_view.py가 응답 meta에 항상 채움 (lecture_title/session_title).
    // 2/3순위는 캐시·row fallback (호환). 진짜 진리는 meta.* — 어디서 발송하든 일관됨.
    const lecture = qc.getQueryData<{ title?: string; name?: string }>(["lecture", numericLectureId]);
    const session = sessionId ? qc.getQueryData<{ title?: string }>(["session-detail", sessionId]) : null;
    const lectureName = currentMeta?.lecture_title ?? lecture?.title ?? lecture?.name ?? (currentRow as any).lecture_title ?? "";
    const sessionTitle = currentMeta?.session_title ?? session?.title ?? (currentRow as any).session_title ?? "";
    // Phase #5 (2026-05-12) — 학원장 커스텀 합/불 라벨 메시지 본문에 반영.
    const reportOptions = { lectureName, sessionTitle, passLabel: labels.pass, failLabel: labels.fail };

    // 성적 양식 우선순위:
    // ① 사용자 기본(is_user_default) → ② 성적변수 포함 사용자 양식 → ③ 기본 제공 편지지 프리셋
    let body: string;
    let initialTemplateId: number | null = null;
    let initialLetterPresetId: string | null = null;
    try {
      const templates = await fetchMessageTemplates("grades");
      const hasScoreVars = (b: string) => /#{(시험\d|과제\d|시험성적|시험이력|시험목록|시험총점|학생이름)}/.test(b);
      const userDefault = templates.find((t) => t.is_user_default && !t.is_system);
      const userWithScoreVars = templates.find((t) => !t.is_system && hasScoreVars(t.body));
      const chosenTpl = userDefault ?? userWithScoreVars;
      body = chosenTpl
        ? chosenTpl.body
        : buildGenericScoreTemplate(reportOptions);
      initialTemplateId = chosenTpl?.id ?? null;
      initialLetterPresetId = chosenTpl ? null : DEFAULT_GRADES_PRESET_ID;
    } catch {
      body = buildGenericScoreTemplate(reportOptions);
      initialLetterPresetId = DEFAULT_GRADES_PRESET_ID;
    }

    const scoreDetail = buildScoreDetail(currentRow, currentMeta, { passLabel: labels.pass, failLabel: labels.fail });
    // SSOT (2026-05-14): 단건 path 도 학원장이 textarea 본문에 #{학생이름}/#{시험성적} 다시 쓰면
    // raw 변수 잔존 가능. substituteScoreVars 가 학생이름2/학생이름3/시험성적 까지 처리하니 callback 통과.
    const sid = currentRow.student_id;
    const scoreVars = buildScoreVars(currentRow, currentMeta, reportOptions);
    const recomputePerStudentVars = sid != null
      ? (currentBody: string) => ({
          [sid]: {
            ...scoreVars,
            _body_subst: substituteScoreVars(currentBody, currentRow, currentMeta, reportOptions),
          },
        })
      : undefined;
    openSendMessageModal({
      studentIds: sid != null ? [sid] : [],
      recipientLabel: `${currentRow.student_name} 성적 발송`,
      blockCategory: "grades",
      initialBody: body,
      initialTemplateId,
      initialLetterPresetId,
      alimtalkExtraVars: {
        강의명: lectureName,
        차시명: sessionTitle,
        시험성적: scoreDetail,
        ...scoreVars,
      },
      recomputePerStudentVars,
    });
  }, [hasUnsavedChanges, row, meta, openSendMessageModal, labels.pass, labels.fail, qc, numericLectureId, sessionId]);

  return (
    <div className="student-scores-drawer-side-panel">
      <div
        className="student-scores-drawer"
        role="complementary"
        aria-labelledby="student-scores-drawer-title"
      >
        <CloseButton
          className="student-scores-drawer__close"
          aria-label="학생 성적 상세 닫기 (Esc)"
          onClick={onClose}
        />

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
              <StudentDetailLink
                studentId={row.student_id}
                studentName={row.student_name ?? ""}
                className="student-scores-drawer__student-link"
              >
                <StudentNameWithLectureChip
                  name={row.student_name ?? ""}
                  lectures={
                    (row as any).lecture_title
                      ? [{ lectureName: (row as any).lecture_title, color: (row as any).lecture_color, chipLabel: (row as any).lecture_chip_label }]
                      : undefined
                  }
                  chipSize={20}
                  clinicHighlight={
                    row.name_highlight_followup_required
                    ?? row.name_highlight_clinic_target
                    ?? false
                  }
                  examNotSubmittedCount={row.exam_not_submitted_count}
                />
              </StudentDetailLink>
            </h2>
            <span className="student-scores-drawer__header-meta">
              이름을 누르면 학생 정보 <span aria-hidden>·</span> <kbd>Esc</kbd> 닫기
            </span>
          </div>
          {/* 학원장 임근혁 요청 — 성적 발송 버튼 드로어 상단(헤더)에 prominent.
           * 학생 한 명 빠른 발송 진입점. 이전엔 하단 작은 링크 버튼이라 발견성 낮음. */}
          <Button
            onClick={handleSendScoreReport}
            disabled={scoreSendDisabled}
            intent="primary"
            size="sm"
            className="student-scores-drawer__header-action"
            leftIcon={<Send size={ICON_FOR_BUTTON.sm} />}
            title={scoreSendTitle}
          >
            알림톡
          </Button>
        </header>

        {/* Body */}
        <div className="student-scores-drawer__body">
          {/* ── Final verdict banner ── */}
          <VerdictBanner
            kind={verdict}
            clinicRequired={clinicRequired}
            summary={attentionSummary}
          />

          {/* ── Overall summary ── */}
          {(stats.count > 0 || attentionCount > 0) && (
            <section className="student-scores-drawer__section">
              <h3 className="student-scores-drawer__section-title">종합</h3>
              <div className="student-scores-drawer__summary">
                {/* 2026-05-13 학원장 호소 fix: "0% 합격률" 의미 불명확.
                    → "{N/M 이수}" 분수 첫째 + 백분율 둘째. Achievement SSOT 와 동일 단어 "이수". */}
                {stats.examPassRate != null && (
                  <div className="student-scores-drawer__summary-row">
                    <span className="student-scores-drawer__summary-label">시험</span>
                    <span className="student-scores-drawer__summary-value">
                      <span style={{ color: stats.examPassRate === 100 ? "var(--color-success)" : stats.examPassRate < 50 ? "var(--color-error)" : "var(--color-text-primary)" }}>
                        {stats.examPassed}/{stats.examTotal} 이수
                      </span>
                      <span className="student-scores-drawer__max-score"> ({stats.examPassRate}%)</span>
                    </span>
                  </div>
                )}
                {stats.hwPassRate != null && (
                  <div className="student-scores-drawer__summary-row">
                    <span className="student-scores-drawer__summary-label">과제 확인</span>
                    <span className="student-scores-drawer__summary-value">
                      <span style={{ color: stats.hwPassRate === 100 ? "var(--color-success)" : stats.hwPassRate < 50 ? "var(--color-error)" : "var(--color-text-primary)" }}>
                        {stats.hwPassed}/{stats.hwTotal} 완료
                      </span>
                      <span className="student-scores-drawer__max-score"> ({stats.hwPassRate}%)</span>
                    </span>
                  </div>
                )}
                {attentionSummary.reviewTitles.length > 0 && (
                  <div className="student-scores-drawer__summary-row" data-tone="review">
                    <span className="student-scores-drawer__summary-label">검수 대기</span>
                    <span className="student-scores-drawer__summary-value">
                      {attentionSummary.reviewTitles.join(", ")}
                    </span>
                  </div>
                )}
                {attentionSummary.missingTitles.length > 0 && (
                  <div className="student-scores-drawer__summary-row" data-tone="missing">
                    <span className="student-scores-drawer__summary-label">미입력</span>
                    <span className="student-scores-drawer__summary-value">
                      {attentionSummary.missingTitles.join(", ")}
                    </span>
                  </div>
                )}
                {attentionSummary.failedTitles.length > 0 && (
                  <div className="student-scores-drawer__summary-row" data-tone="failed">
                    <span className="student-scores-drawer__summary-label">미달 항목</span>
                    <span className="student-scores-drawer__summary-value">
                      {attentionSummary.failedTitles.join(", ")}
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
                    isEditMode={isEditMode}
                    hasUnsavedChanges={hasUnsavedChanges}
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
                    isEditMode={isEditMode}
                    hasUnsavedChanges={hasUnsavedChanges}
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
              disabled={scoreSendDisabled}
              title={scoreSendTitle}
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
  isEditMode,
  hasUnsavedChanges,
  expanded,
  onToggle,
  onOpenDetail,
}: {
  exam: SessionScoreExamEntry;
  meta: SessionScoreMeta | null;
  enrollmentId: number;
  sessionId?: number;
  isEditMode: boolean;
  hasUnsavedChanges: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail?: () => void;
}) {
  const metaExam = meta?.exams?.find((e) => e.exam_id === exam.exam_id);
  const maxScore = exam.block.max_score ?? metaExam?.max_score ?? null;
  const percent = pctNum(exam.block.score, maxScore);

  return (
    <li className="student-scores-drawer__exam-card" data-passed={exam.block.teacher_resolved === true || exam.block.final_pass === true || exam.block.passed === true ? "true" : exam.block.passed === false ? "false" : undefined}>
      <div className="student-scores-drawer__exam-header" onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }} role="button" tabIndex={0}>
        <div className="student-scores-drawer__exam-title-row">
          <span className="student-scores-drawer__exam-title">{exam.title}</span>
          <span className="student-scores-drawer__status-badges">
            <CorrectionStatusBadge block={exam.block} sourceType="exam" />
            <PassBadge block={exam.block} />
          </span>
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
        <>
          <CorrectionStatusControl
            block={exam.block}
            enrollmentId={enrollmentId}
            sourceType="exam"
            sourceId={exam.exam_id}
            sessionId={sessionId}
            disabled={hasUnsavedChanges}
          />
          <ExamScanPreview
            exam={exam}
            enrollmentId={enrollmentId}
            expanded={expanded}
            isEditMode={isEditMode}
            onOpenDetail={onOpenDetail}
          />
          <AttemptTimeline
            enrollmentId={enrollmentId}
            sourceType="exam"
            sourceId={exam.exam_id}
            sessionId={sessionId}
            isEditMode={isEditMode}
            onOpenDetail={onOpenDetail}
          />
        </>
      )}
    </li>
  );
}

function ExamScanPreview({
  exam,
  enrollmentId,
  expanded,
  isEditMode,
  onOpenDetail,
}: {
  exam: SessionScoreExamEntry;
  enrollmentId: number;
  expanded: boolean;
  isEditMode: boolean;
  onOpenDetail?: () => void;
}) {
  const existingSubmissionId = exam.block.meta?.submission_id ?? null;
  const needsReview = exam.block.meta?.manual_review_required === true;
  const reviewReasons = exam.block.meta?.manual_review_reasons ?? [];

  const { data, isLoading, isError } = useQuery({
    queryKey: scoresQueryKeys.adminExamDetail(exam.exam_id, enrollmentId),
    queryFn: () => fetchAdminExamResultDetail(exam.exam_id, enrollmentId),
    enabled: expanded && Number.isFinite(exam.exam_id) && Number.isFinite(enrollmentId),
    staleTime: 30_000,
  });

  const scanUrl = data?.scan_image_url || "";
  const originalScanUrl = data?.original_scan_image_url || "";
  const detailSubmissionId = data?.submission_id ?? null;
  const hasSubmission = existingSubmissionId != null || detailSubmissionId != null;
  const detailNeedsReview = data?.manual_review?.required === true || needsReview;
  const isAlignedScan = data?.scan_image_is_aligned === true;
  const hasAnswers = (data?.items?.length ?? 0) > 0;
  const detailReviewReasons = data?.manual_review?.reasons ?? [];
  const reviewReasonText = [...reviewReasons, ...detailReviewReasons]
    .map(omrReviewReasonLabel)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  const statusLabel = detailNeedsReview
    ? "검토 필요"
    : hasSubmission
      ? "스캔 확인 가능"
      : hasAnswers
        ? "답안 입력 가능"
        : "스캔 없음";

  return (
    <div className="ssd-scan-preview" data-review={detailNeedsReview ? "true" : undefined}>
      <div className="ssd-scan-preview__media">
        {isLoading ? (
          <div className="ssd-scan-preview__thumb ssd-scan-preview__thumb--loading" />
        ) : scanUrl ? (
          <img
            src={scanUrl}
            alt={`${exam.title} OMR 스캔`}
            className="ssd-scan-preview__thumb"
          />
        ) : (
          <div className="ssd-scan-preview__thumb ssd-scan-preview__thumb--empty">
            <ScanImageIcon size={ICON.md} aria-hidden />
          </div>
        )}
      </div>
      <div className="ssd-scan-preview__body">
        <div className="ssd-scan-preview__topline">
          <span className="ssd-scan-preview__label">OMR 답안</span>
          <span className="ssd-scan-preview__status" data-tone={detailNeedsReview ? "warning" : hasSubmission ? "success" : "neutral"}>
            {detailNeedsReview ? (
              <AlertTriangle size={ICON.xs} aria-hidden />
            ) : hasSubmission ? (
              <CheckCircle2 size={ICON.xs} aria-hidden />
            ) : (
              <ScanImageIcon size={ICON.xs} aria-hidden />
            )}
            {statusLabel}
          </span>
        </div>
        <div className="ssd-scan-preview__desc">
          {isError
            ? "답안 정보를 불러오지 못했습니다."
            : detailNeedsReview && reviewReasonText
              ? reviewReasonText
              : scanUrl
                ? isAlignedScan
                  ? "자동 보정된 스캔을 보면서 답안·점수를 확인할 수 있습니다."
                  : "스캔을 보면서 답안·점수를 확인할 수 있습니다."
                : "스캔이 없어도 문항별 답안과 점수를 직접 입력할 수 있습니다."}
        </div>
        <div className="ssd-scan-preview__actions">
          <Button
            size="sm"
            intent={detailNeedsReview ? "primary" : "secondary"}
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail?.();
            }}
            disabled={!onOpenDetail}
            leftIcon={<PencilLine size={ICON_FOR_BUTTON.sm} />}
          >
            {isEditMode ? "답안 보정" : "답안 확인"}
          </Button>
          {scanUrl && (
            <a
              href={scanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ssd-scan-preview__open"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={ICON.xs} aria-hidden />
              스캔
            </a>
          )}
          {originalScanUrl && (
            <a
              href={originalScanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ssd-scan-preview__open"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={ICON.xs} aria-hidden />
              원본
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Homework Result Card (expandable with retake) ── */

function HomeworkResultCard({
  hw,
  meta,
  enrollmentId,
  sessionId,
  isEditMode,
  hasUnsavedChanges,
  expanded,
  onToggle,
}: {
  hw: SessionScoreHomeworkEntry;
  meta: SessionScoreMeta | null;
  enrollmentId: number;
  sessionId?: number;
  isEditMode: boolean;
  hasUnsavedChanges: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const metaHw = meta?.homeworks?.find((h) => h.homework_id === hw.homework_id);
  const hwMaxScore = hw.block.max_score ?? metaHw?.max_score ?? null;
  const percent = pctNum(hw.block.score, hwMaxScore);

  return (
    <li className="student-scores-drawer__hw-card" data-passed={(hw.block.teacher_resolved ?? hw.block.passed) === true ? "true" : hw.block.passed === false ? "false" : undefined}>
      <div className="student-scores-drawer__hw-header" onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }} role="button" tabIndex={0}>
        <div className="student-scores-drawer__hw-title-row">
          <span className="student-scores-drawer__hw-title">{hw.title}</span>
          <span className="student-scores-drawer__status-badges">
            <CorrectionStatusBadge block={hw.block} sourceType="homework" />
            {hw.block.score != null && <PassBadge block={hw.block} />}
          </span>
        </div>
        <div className="student-scores-drawer__hw-score-row">
          {hw.block.score != null ? (
            <span className="student-scores-drawer__hw-score-val" data-tone={hw.block.passed === true ? "success" : hw.block.passed === false ? "danger" : undefined}>
              {hw.block.score}
              {hwMaxScore != null && <span className="student-scores-drawer__max-score"> / {hwMaxScore}</span>}
              {percent != null && <PercentBadge value={percent} passed={hw.block.passed} />}
            </span>
          ) : (
            <span className="student-scores-drawer__no-score">
              {hw.block.meta?.status === "NOT_SUBMITTED" ? "미제출" : "점수 미입력"}
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
        <>
          <CorrectionStatusControl
            block={hw.block}
            enrollmentId={enrollmentId}
            sourceType="homework"
            sourceId={hw.homework_id}
            sessionId={sessionId}
            disabled={hasUnsavedChanges}
          />
          <AttemptTimeline
            enrollmentId={enrollmentId}
            sourceType="homework"
            sourceId={hw.homework_id}
            sessionId={sessionId}
            isEditMode={isEditMode}
          />
        </>
      )}
    </li>
  );
}

/* ── Attempt Timeline (shared for exam & homework) ── */

function parseOptionalPositiveNumber(value: string): number | null | false {
  if (!value.trim()) return null;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return false;
  return parsed;
}

function AttemptTimeline({
  enrollmentId,
  sourceType,
  sourceId,
  sessionId,
  isEditMode,
  onOpenDetail,
}: {
  enrollmentId: number;
  sourceType: "exam" | "homework";
  sourceId: number;
  sessionId?: number;
  isEditMode: boolean;
  onOpenDetail?: () => void;
}) {
  const qc = useQueryClient();
  const labels = useTenantLabels();
  const [showNewAttempt, setShowNewAttempt] = useState(false);
  const [retakeScore, setRetakeScore] = useState("");
  const [retakePassScore, setRetakePassScore] = useState("");
  const [editingAttempt, setEditingAttempt] = useState<number | null>(null);
  const [editScore, setEditScore] = useState("");
  const [editPassScore, setEditPassScore] = useState("");

  const isExam = sourceType === "exam";
  const retakeLabel = isExam ? "재시험" : "재시도";
  const sourceLabel = isExam ? "시험" : "과제";

  const queryParams = sourceType === "exam"
    ? { enrollment_id: enrollmentId, exam_id: sourceId }
    : { enrollment_id: enrollmentId, homework_id: sourceId };

  const { data, isLoading, error } = useQuery({
    queryKey: scoresQueryKeys.attemptHistory(sourceType, sourceId, enrollmentId),
    queryFn: () => fetchAttemptHistory(queryParams),
    enabled: Number.isFinite(sourceId) && Number.isFinite(enrollmentId),
  });

  const retakeMutation = useMutation({
    mutationFn: (params: { clinicLinkId: number; score: number; maxScore?: number; passScore?: number }) =>
      submitClinicRetake(params.clinicLinkId, {
        score: params.score,
        max_score: params.maxScore,
        pass_score: params.passScore,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: scoresQueryKeys.attemptHistory(sourceType, sourceId, enrollmentId) });
      qc.invalidateQueries({ queryKey: scoresQueryKeys.clinicTargets });
      qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScoresRoot });
      setRetakeScore("");
      setRetakePassScore("");
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
    mutationFn: (params: { clinicLinkId: number; attemptIndex: number; score: number; maxScore?: number; passScore?: number }) =>
      updateClinicRetake(params.clinicLinkId, {
        attempt_index: params.attemptIndex,
        score: params.score,
        max_score: params.maxScore,
        pass_score: params.passScore,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: scoresQueryKeys.attemptHistory(sourceType, sourceId, enrollmentId) });
      qc.invalidateQueries({ queryKey: scoresQueryKeys.clinicTargets });
      qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScoresRoot });
      setEditingAttempt(null);
      setEditScore("");
      setEditPassScore("");
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
        if (!sessionId) throw new Error("sessionId가 필요합니다.");
        return patchExamTotalScoreQuick({
          sessionId,
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
      qc.invalidateQueries({ queryKey: scoresQueryKeys.attemptHistory(sourceType, sourceId, enrollmentId) });
      qc.invalidateQueries({ queryKey: scoresQueryKeys.clinicTargets });
      qc.invalidateQueries({ queryKey: scoresQueryKeys.sessionScoresRoot });
      setEditingAttempt(null);
      setEditScore("");
      setEditPassScore("");
      feedback.success("1차 점수가 수정되었습니다.");
    },
    onError: () => feedback.error("점수 수정에 실패했습니다."),
  });

  function handleEditSubmit(attemptIndex: number) {
    if (!isEditMode) {
      feedback.info("수정을 누른 뒤 점수를 변경해 주세요.");
      return;
    }
    const val = parseFloat(editScore);
    if (isNaN(val) || val < 0) {
      feedback.error("올바른 점수를 입력해주세요.");
      return;
    }
    const attempt = data?.attempts?.find((a) => a.attempt_index === attemptIndex);
    const attemptMax = attempt?.max_score ?? data?.max_score ?? 100;
    const passVal = isExam ? parseOptionalPositiveNumber(editPassScore) : null;
    if (passVal === false) {
      feedback.error("합격 기준을 올바르게 입력해주세요.");
      return;
    }
    if (val > attemptMax) {
      feedback.error(`최대 점수(${attemptMax})를 초과할 수 없습니다.`);
      return;
    }
    if (isExam && typeof passVal === "number" && passVal > attemptMax) {
      feedback.error(`합격 기준(${passVal})이 만점(${attemptMax})을 초과할 수 없습니다.`);
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
        maxScore: attemptMax,
        passScore: isExam && typeof passVal === "number" ? passVal : undefined,
      });
    }
  }

  function handleRetakeSubmit() {
    if (!isEditMode) {
      feedback.info("수정을 누른 뒤 재시험 점수를 추가해 주세요.");
      return;
    }
    if (!data?.clinic_link_id) return;
    const val = parseFloat(retakeScore);
    const maxScore = data.max_score ?? 100;
    const passVal = isExam ? parseOptionalPositiveNumber(retakePassScore) : null;
    if (isNaN(val) || val < 0) {
      feedback.error("올바른 점수를 입력해주세요.");
      return;
    }
    if (passVal === false) {
      feedback.error("합격 기준을 올바르게 입력해주세요.");
      return;
    }
    if (val > maxScore) {
      feedback.error(`최대 점수(${maxScore})를 초과할 수 없습니다.`);
      return;
    }
    if (isExam && typeof passVal === "number" && passVal > maxScore) {
      feedback.error(`합격 기준(${passVal})이 만점(${maxScore})을 초과할 수 없습니다.`);
      return;
    }
    retakeMutation.mutate({
      clinicLinkId: data.clinic_link_id,
      score: val,
      maxScore,
      passScore: isExam && typeof passVal === "number" ? passVal : undefined,
    });
  }

  const nextAttemptIndex = (data?.attempts?.length ?? 0) + 1;
  const canAddRetake = isEditMode && data?.clinic_link_id && !data?.resolved;
  const newAttemptPassScoreLabel = isExam
    ? (retakePassScore.trim() || (data?.pass_score != null ? String(data.pass_score) : ""))
    : (data?.pass_score != null ? String(data.pass_score) : "");

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
          {(data.attempts ?? []).map((a) => {
            const isEditing = editingAttempt === a.attempt_index;
            const canEdit = isEditMode && (a.attempt_index === 1 || (a.attempt_index >= 2 && data.clinic_link_id != null));
            const isMutating = editFirstMutation.isPending || updateMutation.isPending || retakeMutation.isPending;
            const attemptMax = a.max_score ?? data.max_score;
            const attemptPassScore = a.pass_score ?? data.pass_score;

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
                        onClick={() => {
                          setEditingAttempt(a.attempt_index);
                          setEditScore(a.score != null ? String(a.score) : "");
                          setEditPassScore(a.attempt_index >= 2 && attemptPassScore != null ? String(attemptPassScore) : "");
                        }}
                        title="점수 수정"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                    )}
                    <span className={`ssd-attempt-card__badge ${a.passed === null ? "" : a.passed ? "ssd-attempt-card__badge--pass" : "ssd-attempt-card__badge--fail"}`}>
                      {a.passed === null ? "-" : a.passed ? labels.pass : labels.fail}
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
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleEditSubmit(a.attempt_index);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingAttempt(null);
                          setEditScore("");
                          setEditPassScore("");
                        }
                      }}
                      placeholder="점수"
                      min={0}
                      max={attemptMax ?? undefined}
                      step="any"
                      disabled={isMutating}
                      autoFocus
                    />
                    <span className="ssd-attempt-card__max">/ {attemptMax}</span>
                    {isExam && a.attempt_index >= 2 && (
                      <label className="ssd-attempt-card__field">
                        <span>컷</span>
                        <input
                          type="number"
                          className="ssd-attempt-card__input ssd-attempt-card__input--cutline"
                          value={editPassScore}
                          onChange={(e) => setEditPassScore(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEditSubmit(a.attempt_index); } }}
                          placeholder="기준"
                          min={0}
                          max={attemptMax ?? undefined}
                          step="any"
                          disabled={isMutating}
                        />
                      </label>
                    )}
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
                      onClick={() => { setEditingAttempt(null); setEditScore(""); setEditPassScore(""); }}
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
                    <span className="ssd-attempt-card__max">/ {attemptMax}</span>
                    {a.score != null && attemptMax != null && attemptMax > 0 && (
                      <span className={`ssd-attempt-card__pct ${a.passed ? "ssd-attempt-card__pct--pass" : "ssd-attempt-card__pct--fail"}`}>
                        {Math.round((a.score / attemptMax) * 100)}%
                      </span>
                    )}
                  </div>
                )}

                {attemptPassScore != null && !isEditing && (
                  <div className="ssd-attempt-card__cutline">
                    합격 기준: {attemptPassScore}점
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
              onClick={() => {
                setShowNewAttempt(true);
                setRetakePassScore(data.pass_score != null ? String(data.pass_score) : "");
              }}
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
                {isExam && (
                  <label className="ssd-attempt-card__field">
                    <span>컷</span>
                    <input
                      type="number"
                      className="ssd-attempt-card__input ssd-attempt-card__input--cutline"
                      value={retakePassScore}
                      onChange={(e) => setRetakePassScore(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRetakeSubmit(); } }}
                      placeholder="기준"
                      min={0}
                      max={data.max_score ?? undefined}
                      step="any"
                      disabled={retakeMutation.isPending}
                    />
                  </label>
                )}
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
                  onClick={() => { setShowNewAttempt(false); setRetakeScore(""); setRetakePassScore(""); }}
                  disabled={retakeMutation.isPending}
                >
                  취소
                </button>
              </div>
              {newAttemptPassScoreLabel && (
                <div className="ssd-attempt-card__cutline">
                  합격 기준: {newAttemptPassScoreLabel}점
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

function CorrectionStatusBadge({
  block,
  sourceType,
}: {
  block: ScoreBlock;
  sourceType: "exam" | "homework";
}) {
  if (block.correction_status === "PENDING") {
    return (
      <Badge tone="warning" size="xs">
        {sourceType === "homework" ? "교사 미완료" : "보완 필요"}
      </Badge>
    );
  }
  if (block.correction_status === "COMPLETED") {
    return (
      <Badge tone="success" size="xs">
        {sourceType === "homework" ? "교사 완료" : "교사 통과"}
      </Badge>
    );
  }
  if (block.correction_status === "NOT_REQUIRED") {
    return (
      <Badge tone="muted" size="xs">
        {sourceType === "homework" ? "자동 완료" : "오답 없음"}
      </Badge>
    );
  }
  return null;
}

function CorrectionStatusControl({
  block,
  enrollmentId,
  sourceType,
  sourceId,
  sessionId,
  disabled,
}: {
  block: ScoreBlock;
  enrollmentId: number;
  sourceType: "exam" | "homework";
  sourceId: number;
  sessionId?: number;
  disabled: boolean;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState(block.correction_note ?? "");
  const [completionReasonRequested, setCompletionReasonRequested] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const persistedNote = block.correction_note ?? "";
  const status = block.correction_status ?? null;
  const isHomework = sourceType === "homework";
  const title = isHomework ? "교사 완료 판정" : "교사 최종 판정";
  const noteId = `assessment-note-${sourceType}-${sourceId}`;
  const noteHintId = `${noteId}-hint`;

  useEffect(() => {
    setNote(persistedNote);
    setCompletionReasonRequested(false);
  }, [persistedNote, sourceId, sourceType]);

  const mutation = useMutation({
    mutationFn: ({
      completed,
      nextNote,
    }: {
      completed: boolean;
      nextNote: string;
      action: "status" | "note";
    }) => {
      if (sessionId == null) {
        throw new Error("session_id_required");
      }
      return patchAssessmentCorrection(sessionId, {
        enrollment_id: enrollmentId,
        source_type: sourceType,
        source_id: sourceId,
        completed,
        note: nextNote,
        expected_updated_at: block.correction_updated_at ?? null,
      });
    },
    onSuccess: (data, variables) => {
      setNote(data.correction_note ?? variables.nextNote);
      setCompletionReasonRequested(false);
      if (sessionId != null) {
        const queryKey = scoresQueryKeys.sessionScores(sessionId);
        qc.setQueryData<SessionScoresResponse>(queryKey, (current) => {
          if (!current) return current;
          return {
            ...current,
            rows: current.rows.map((row) => {
              if (row.enrollment_id !== enrollmentId) return row;
              if (sourceType === "exam") {
                return {
                  ...row,
                  exams: row.exams.map((entry) => (
                    entry.exam_id === sourceId
                      ? { ...entry, block: { ...entry.block, ...data } }
                      : entry
                  )),
                };
              }
              return {
                ...row,
                homeworks: row.homeworks.map((entry) => (
                  entry.homework_id === sourceId
                    ? { ...entry, block: { ...entry.block, ...data } }
                    : entry
                )),
              };
            }),
          };
        });
        void qc.invalidateQueries({
          queryKey,
        });
      }
      feedback.success(variables.action === "note"
        ? "비고를 저장했습니다."
        : variables.completed
          ? `${title}을 확정했습니다. 원점수는 그대로 유지됩니다.`
          : `${title}을 해제해 Clinic 대상을 다시 계산합니다.`);
    },
    onError: (error) => {
      feedback.error(getApiErrorMessage(
        error,
        `${title} 상태를 저장하지 못했습니다. 다시 시도해 주세요.`,
      ));
    },
  });

  const unavailable = !isHomework && (status == null || status === "NOT_REQUIRED");
  const hasManualStatus = status === "PENDING" || status === "COMPLETED";
  const noteDirty = note !== persistedNote;
  const completionReasonReady = note.trim().length >= 2;
  const commonDisabled = disabled || sessionId == null || mutation.isPending;
  const disabledReason = disabled
    ? "저장하지 않은 점수가 있습니다. 점수를 먼저 저장해 주세요."
    : sessionId == null
      ? "차시 정보를 확인할 수 없습니다."
      : !isHomework && status == null
        ? "점수가 입력된 뒤 오답 확인 상태를 설정할 수 있습니다."
        : !isHomework && status === "NOT_REQUIRED"
          ? "만점 결과는 오답 확인이 필요하지 않습니다."
          : undefined;
  const description = isHomework
    ? status === "COMPLETED"
      ? "교사가 협의 후 완료로 확정했습니다. 원점수와 제출 기록은 그대로 유지됩니다."
      : status === "PENDING"
        ? "남은 범위를 비고에 적어 두면 다음 검사 때 바로 이어볼 수 있습니다."
        : status === "NOT_REQUIRED"
          ? "점수상 완료된 과제도 교사 판정과 사유를 별도로 남길 수 있습니다."
          : "사이트 제출 여부와 무관하게 교사 완료 판정을 기록할 수 있습니다."
    : status === "COMPLETED"
      ? "현장에서 오답 해결을 확인해 원점수 변경 없이 최종 통과 처리했습니다."
      : status === "PENDING"
        ? "통과 전까지 재시험·Clinic 보완 대상으로 유지됩니다."
        : status === "NOT_REQUIRED"
          ? "만점이라 확인할 오답이 없습니다."
          : "점수를 입력한 뒤 사유와 함께 교사 통과 여부를 기록할 수 있습니다.";

  return (
    <div
      className="ssd-correction-control"
      data-source-type={sourceType}
      data-status={status?.toLowerCase() ?? "unset"}
    >
      <div className="ssd-correction-control__copy">
        <div className="ssd-correction-control__title-row">
          <strong>{title}</strong>
          <CorrectionStatusBadge block={block} sourceType={sourceType} />
        </div>
        <span>{description}</span>
      </div>
      <div
        className="ssd-correction-control__actions"
        role="group"
        aria-label={`${title} 상태`}
        title={disabledReason}
      >
        <Button
          size="sm"
          intent="secondary"
          aria-pressed={status === "PENDING"}
          data-correction-state="pending"
          onClick={() => mutation.mutate({
            completed: false,
            nextNote: note,
            action: "status",
          })}
          disabled={commonDisabled || unavailable}
          loading={
            mutation.isPending
            && mutation.variables?.action === "status"
            && mutation.variables.completed === false
          }
        >
          {isHomework ? "미완료" : "보완 필요"}
        </Button>
        <Button
          size="sm"
          intent="secondary"
          aria-pressed={status === "COMPLETED"}
          data-correction-state="completed"
          title={!commonDisabled && !unavailable && !completionReasonReady
            ? "눌러서 판정 사유를 입력해 주세요."
            : disabledReason}
          onClick={() => {
            if (!completionReasonReady) {
              setCompletionReasonRequested(true);
              noteRef.current?.focus();
              return;
            }
            mutation.mutate({
              completed: true,
              nextNote: note,
              action: "status",
            });
          }}
          disabled={commonDisabled || unavailable}
          loading={
            mutation.isPending
            && mutation.variables?.action === "status"
            && mutation.variables.completed === true
          }
        >
          {isHomework ? "완료 확정" : "통과 확정"}
        </Button>
      </div>
      <div className="ssd-correction-control__note">
        <label htmlFor={noteId}>
          판정 사유 <span>통과·완료 시 필수 · 500자 이내</span>
        </label>
        {completionReasonRequested && !completionReasonReady && (
          <span
            id={noteHintId}
            className="ssd-correction-control__note-hint"
            role="alert"
          >
            {isHomework ? "완료 확정" : "통과 확정"} 사유를 2자 이상 입력해 주세요.
          </span>
        )}
        <textarea
          ref={noteRef}
          id={noteId}
          aria-label={`${title} 비고`}
          aria-describedby={!completionReasonReady ? noteHintId : undefined}
          aria-invalid={completionReasonRequested && !completionReasonReady}
          value={note}
          rows={2}
          maxLength={500}
          placeholder={isHomework ? "협의·검사 완료 근거를 적어주세요." : "현장에서 해결한 오답과 확인 근거를 적어주세요."}
          onChange={(event) => {
            const nextNote = event.target.value;
            setNote(nextNote);
            if (nextNote.trim().length >= 2) {
              setCompletionReasonRequested(false);
            }
          }}
          disabled={commonDisabled || unavailable}
        />
        <div className="ssd-correction-control__note-footer">
          <span aria-live="polite">
            {note.length}/500
          </span>
          <Button
            size="sm"
            intent="secondary"
            onClick={() => {
              if (status === "PENDING" || status === "COMPLETED") {
                mutation.mutate({
                  completed: status === "COMPLETED",
                  nextNote: note,
                  action: "note",
                });
              }
            }}
            disabled={commonDisabled || unavailable || !hasManualStatus || !noteDirty}
            loading={mutation.isPending && mutation.variables?.action === "note"}
          >
            비고 저장
          </Button>
        </div>
        {isHomework && !hasManualStatus && (
          <span className="ssd-correction-control__note-hint">
            완료 또는 미완료를 선택하면 비고도 함께 저장됩니다.
          </span>
        )}
        {!completionReasonRequested && !completionReasonReady && (
          <span id={noteHintId} className="ssd-correction-control__note-hint" role="status">
            통과 또는 완료 확정 전 판정 사유를 2자 이상 입력해 주세요.
          </span>
        )}
      </div>
    </div>
  );
}

function PassBadge({ block }: { block: ScoreBlock }) {
  const labels = useTenantLabels();
  // 정책: 뱃지는 "성취"(1차+보강합격 인정) 기준. 백엔드가 achievement를 내려주면
  // REMEDIATED를 구분해서 "보강 합격"으로 표시. 없으면 passed로 폴백.
  const achievement = deriveAchievement({
    achievement: block.achievement ?? null,
    is_pass: block.passed ?? null,
    remediated: block.teacher_resolved === true ? true : block.remediated ?? null,
    final_pass: block.teacher_resolved === true ? true : block.final_pass ?? null,
  });

  if (!achievement) {
    if (block.passed == null) {
      return (
        <span className="student-scores-drawer__pass-badge" data-tone="muted">
          미정
        </span>
      );
    }
    return (
      <span
        className="student-scores-drawer__pass-badge"
        data-tone={block.passed ? "success" : "danger"}
      >
        {block.passed ? labels.pass : labels.fail}
      </span>
    );
  }

  return (
    <span
      className="student-scores-drawer__pass-badge"
      data-tone={achievementTone(achievement)}
      title={
        achievement === "REMEDIATED"
          ? "1차 불합격 후 클리닉 재시험/수동 해소로 통과"
          : undefined
      }
    >
      {achievementLabel(achievement, { pass: labels.pass, fail: labels.fail })}
    </span>
  );
}

function VerdictBanner({
  kind,
  clinicRequired,
  summary,
}: {
  kind: SessionScoresTableVerdictKind;
  clinicRequired: boolean;
  summary: SessionRowAttentionSummary;
}) {
  const tone = kind === "pass"
    ? "success"
    : kind === "fail"
      ? "danger"
      : kind === "clinic_target" || kind === "review"
        ? "warning"
        : "muted";
  const value = kind === "clinic_target"
    ? "클리닉 대상"
    : kind === "review"
      ? "검수 대기"
      : kind === "incomplete"
        ? "점수 미입력"
        : kind === "fail"
          ? "기준 미달"
          : kind === "pass"
            ? "확인 완료"
            : "평가 없음";
  const detail = clinicRequired
    ? "후속 클리닉 조치가 등록되어 있습니다."
    : getSessionRowAttentionCountLabel(summary)
      || (kind === "pass" ? "입력과 검수가 모두 완료되었습니다." : "등록된 시험·과제가 없습니다.");
  const Icon = kind === "pass"
    ? CheckCircle2
    : kind === "fail"
      ? AlertTriangle
      : kind === "clinic_target"
        ? HeartPulse
        : kind === "review"
          ? ClipboardCheck
          : CircleDashed;

  return (
    <div className="student-scores-drawer__verdict" data-tone={tone}>
      <span className="student-scores-drawer__verdict-icon" aria-hidden>
        <Icon size={ICON.md} strokeWidth={2.35} />
      </span>
      <span className="student-scores-drawer__verdict-text">
        <span className="student-scores-drawer__verdict-label">현재 상태</span>
        <span className="student-scores-drawer__verdict-value">{value}</span>
        <span className="student-scores-drawer__verdict-detail">{detail}</span>
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

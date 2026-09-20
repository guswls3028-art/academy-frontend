import { useState, type KeyboardEvent } from "react";
import { ArrowRight, BookOpen, CheckCircle2, FileQuestion, MoreHorizontal, ShieldCheck } from "lucide-react";

import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import type { ClinicTarget } from "../../api/clinicTargets";
import {
  canCompleteManualHomework,
  canWaiveMissingExam,
  requiresManualHomeworkCompletion,
} from "../../api/completeManualHomework";
import RemediationContextPanel from "./RemediationContextPanel";
import {
  formatNextAttempt,
  formatReasonLabel,
  formatScoreDisplay,
  indicatorStyle,
  reasonColorStyle,
  resolutionLabel,
} from "./remediationFormatters";

/* 학생 중심 뷰의 항목 행 (인라인 점수 입력 포함) */
export default function RemediationItemRow({
  item,
  onRetake,
  onResolve,
  onUnresolve,
  onWaive,
  onCarryOver,
  disabled,
}: {
  item: ClinicTarget;
  onRetake: (score: number, maxScore?: number) => void;
  onResolve: () => void;
  onUnresolve?: () => void;
  onWaive: () => void;
  onCarryOver: () => void;
  disabled: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [scoreInput, setScoreInput] = useState("");

  const isResolved = !!item.resolved_at;
  const isMissing = item.reason === "missing";
  const maxScore = item.max_score ?? 100;
  const actionContext = item.source_title || item.session_title || "클리닉 항목";

  function handleSubmit() {
    const val = parseFloat(scoreInput);
    if (isNaN(val) || val < 0) {
      feedback.error("올바른 점수를 입력해주세요.");
      return;
    }
    if (val > maxScore) {
      feedback.error(`최대 점수(${maxScore})를 초과할 수 없습니다.`);
      return;
    }
    onRetake(val, item.source_type === "homework" ? maxScore : undefined);
    setScoreInput("");
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className={`clinic-hub__item-row ${isResolved ? "clinic-hub__item-row--resolved" : ""}`}>
      {/* Left: status indicator */}
      <div
        className="clinic-hub__item-indicator"
        style={indicatorStyle(item.reason, isResolved)}
      />

      {/* Center: item info */}
      <div className="clinic-hub__item-info">
        <div className="clinic-hub__item-top">
          {/* Source title (exam/homework name) */}
          <span className="clinic-hub__item-source-title">
            {item.source_type === "homework" ? (
              <BookOpen size={12} />
            ) : (
              <FileQuestion size={12} />
            )}
            {item.source_title || item.session_title || "알 수 없는 항목"}
          </span>

          {/* Session breadcrumb — lecture is already encoded in the student chip */}
          <span className="clinic-hub__item-breadcrumb">
            {item.session_title || ""}
          </span>

          {/* Reason badge */}
          <span
            className="clinic-hub__item-reason"
            style={reasonColorStyle(item.reason)}
          >
            {formatReasonLabel(item)}
          </span>

          {isResolved && (
            <span className="clinic-hub__item-resolved">
              <CheckCircle2 size={12} />
              통과
            </span>
          )}
        </div>

        {/* Score detail + inline input */}
        <div className="clinic-hub__item-bottom">
          {/* Original score */}
          {isMissing ? (
            <span className="clinic-hub__item-score clinic-hub__item-score--missing">
              {item.source_type === "homework"
                ? "미제출 · 재제출 점수 입력 또는 교사 완료"
                : "미응시 · 응시 기록 입력 또는 결석 사유 면제"}
            </span>
          ) : item.exam_score != null || item.homework_score != null ? (
            <span className="clinic-hub__item-score">
              1차: {formatScoreDisplay(item)}
            </span>
          ) : null}

          {/* Attempt history */}
          {item.attempt_history && item.attempt_history.length > 1 && (
            <span className="clinic-hub__item-attempts">
              {item.attempt_history.slice(1).map((a) => (
                <span
                  key={a.attempt_index}
                  className={`clinic-hub__attempt-chip ${a.passed ? "clinic-hub__attempt-chip--passed" : ""}`}
                >
                  {a.attempt_index}차: {a.score ?? "-"}점
                  {a.passed ? " 합격" : ""}
                </span>
              ))}
            </span>
          )}

          {/* Inline score input */}
          {!isResolved && item.clinic_link_id && !(isMissing && item.source_type === "exam") && (
            <div className="clinic-hub__item-retake">
              <span className="clinic-hub__retake-label">
                {formatNextAttempt(item.latest_attempt_index)} 점수:
              </span>
              <div className="clinic-hub__score-input-group">
                <input
                  type="number"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="점수"
                  className="clinic-hub__score-input"
                  min={0}
                  max={maxScore}
                  step="any"
                  disabled={disabled}
                  aria-label={`${actionContext} ${formatNextAttempt(item.latest_attempt_index)} 점수`}
                />
                <button
                  type="button"
                  className="clinic-hub__score-submit"
                  onClick={handleSubmit}
                  disabled={disabled || !scoreInput.trim()}
                  title="저장"
                  aria-label={`${actionContext} 재시험 점수 저장`}
                >
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        <RemediationContextPanel item={item} />
      </div>

      {/* Right: actions */}
      <div className="clinic-hub__item-actions">
        {canWaiveMissingExam(item) ? (
          <button
            type="button"
            className="clinic-hub__action-btn clinic-hub__action-btn--waive"
            onClick={onWaive}
            disabled={disabled}
            title="결석 등 사유를 기록하고 클리닉 면제"
          >
            <ShieldCheck size={14} />
            면제
          </button>
        ) : !isResolved && item.clinic_link_id &&
          (!requiresManualHomeworkCompletion(item) || canCompleteManualHomework(item)) && (
          <>
            <button
              type="button"
              className="clinic-hub__action-btn clinic-hub__action-btn--resolve"
              onClick={onResolve}
              disabled={disabled}
              title={requiresManualHomeworkCompletion(item) ? "사이트 밖 제출 확인 후 과제 완료" : "수동 통과"}
            >
              <CheckCircle2 size={14} />
              {requiresManualHomeworkCompletion(item) ? "제출 확인·완료" : "통과"}
            </button>

            <div className="clinic-hub__action-more-wrap">
              <button
                type="button"
                className="clinic-hub__action-more"
                onClick={() => setShowActions(!showActions)}
                title="더보기"
                aria-label={`${actionContext} 추가 처리`}
                aria-expanded={showActions}
              >
                <MoreHorizontal size={14} />
              </button>
              {showActions && (
                <div className="clinic-hub__action-dropdown">
                  <button type="button" onClick={() => { onWaive(); setShowActions(false); }} disabled={disabled}>
                    면제
                  </button>
                  <button type="button" onClick={() => { onCarryOver(); setShowActions(false); }} disabled={disabled}>
                    다음 차수 이월
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        {onUnresolve && <Button intent="secondary" size="sm" disabled={disabled} onClick={onUnresolve}>수동 통과 취소</Button>}
        {isResolved && (
          <span className="clinic-hub__resolved-label">
            {resolutionLabel(item)}
          </span>
        )}
      </div>
    </div>
  );
}

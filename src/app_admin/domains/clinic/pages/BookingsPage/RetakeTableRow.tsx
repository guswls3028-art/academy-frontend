import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, CheckCircle2, MoreHorizontal, ShieldCheck } from "lucide-react";

import type { ClinicTarget } from "../../api/clinicTargets";
import StudentDetailLink from "@admin/domains/students/public/StudentDetailLink";
import StudentNameWithLectureChip from "@/shared/ui/chips/StudentNameWithLectureChip";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  formatNextAttempt,
  getCutlineLabel,
  getScoreValueLabel,
} from "./remediationFormatters";

type Props = {
  item: ClinicTarget;
  onRetake: (score: number, maxScore?: number) => void;
  onResolve: () => void;
  onWaive: () => void;
  onCarryOver: () => void;
  disabled: boolean;
};

export default function RetakeTableRow({
  item,
  onRetake,
  onResolve,
  onWaive,
  onCarryOver,
  disabled,
}: Props) {
  const [scoreInput, setScoreInput] = useState("");
  const [showMore, setShowMore] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isResolved = !!item.resolved_at;
  const isMissing = item.reason === "missing";
  const typeLabel = item.source_type === "homework" ? "과제" : "시험";
  const maxScore = item.max_score ?? 100;

  function handleSubmit() {
    const value = Number.parseFloat(scoreInput);
    if (Number.isNaN(value) || value < 0) {
      feedback.error("올바른 점수를 입력해주세요.");
      return;
    }
    if (value > maxScore) {
      feedback.error(`최대 점수(${maxScore})를 초과할 수 없습니다.`);
      return;
    }
    onRetake(value, item.source_type === "homework" ? maxScore : undefined);
    setScoreInput("");
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <tr className={isResolved ? "clinic-hub__row--resolved" : ""}>
      <td className="clinic-hub__cell-name">
        <StudentDetailLink studentId={item.student_id} studentName={item.student_name}>
          <StudentNameWithLectureChip
            name={item.student_name}
            lectures={item.lecture_title ? [{ lectureName: item.lecture_title, color: item.lecture_color, chipLabel: item.lecture_chip_label }] : undefined}
            clinicHighlight={item.name_highlight_clinic_target}
            profilePhotoUrl={item.profile_photo_url}
            avatarSize={20}
          />
        </StudentDetailLink>
      </td>
      <td className="clinic-hub__cell-session">{item.session_title || "-"}</td>
      <td className="clinic-hub__cell-source">
        <span title={item.source_title || "-"}>{item.source_title || "-"}</span>
      </td>
      <td>
        <span className="clinic-hub__type-badge" data-type={item.source_type}>{typeLabel}</span>
      </td>
      <td className="clinic-hub__cell-score">{getScoreValueLabel(item)}</td>
      <td className="clinic-hub__cell-score">{getCutlineLabel(item)}</td>
      <td className="clinic-hub__cell-cycle">
        {isMissing ? "판정 대기" : formatNextAttempt(item.latest_attempt_index)}
      </td>
      <td className="clinic-hub__cell-input">
        {!isResolved && isMissing && item.source_type === "exam" ? (
          <span className="clinic-hub__missing-guidance">응시 기록 또는 면제로 처리</span>
        ) : !isResolved && item.clinic_link_id ? (
          <div className="clinic-hub__score-input-group">
            <input
              ref={inputRef}
              type="number"
              value={scoreInput}
              onChange={(event) => setScoreInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="점수"
              className="clinic-hub__score-input"
              min={0}
              max={maxScore}
              step="any"
              disabled={disabled}
            />
            <button
              type="button"
              className="clinic-hub__score-submit"
              onClick={handleSubmit}
              disabled={disabled || !scoreInput.trim()}
              title="저장"
            >
              <ArrowRight size={13} />
            </button>
          </div>
        ) : isResolved ? (
          <span className="clinic-hub__resolved-inline">
            {item.resolution_type === "EXAM_PASS"
              ? "시험 통과"
              : item.resolution_type === "HOMEWORK_PASS"
                ? "과제 통과"
                : item.resolution_type === "MANUAL_OVERRIDE"
                  ? "수동 통과"
                  : item.resolution_type === "WAIVED"
                    ? "면제"
                    : "통과 완료"}
          </span>
        ) : (
          <span className="clinic-hub__cell-muted">-</span>
        )}
      </td>
      <td className="clinic-hub__cell-actions">
        {!isResolved && isMissing && item.source_type === "exam" ? (
          <button
            type="button"
            className="clinic-hub__action-btn clinic-hub__action-btn--waive"
            onClick={onWaive}
            disabled={disabled}
            title="결석 등 사유를 기록하고 클리닉 면제"
          >
            <ShieldCheck size={13} />
            면제
          </button>
        ) : !isResolved && item.clinic_link_id ? (
          <div className="clinic-hub__inline-actions">
            <button
              type="button"
              className={isMissing && item.source_type === "homework"
                ? "clinic-hub__action-btn clinic-hub__action-btn--resolve"
                : "clinic-hub__action-sm clinic-hub__action-sm--resolve"}
              onClick={onResolve}
              disabled={disabled}
              title={isMissing && item.source_type === "homework" ? "사이트 밖 제출 확인 후 과제 완료" : "수동 통과"}
            >
              <CheckCircle2 size={13} />
              {isMissing && item.source_type === "homework" ? "제출 확인·완료" : null}
            </button>
            <div className="clinic-hub__action-more-wrap">
              <button
                type="button"
                className="clinic-hub__action-more"
                onClick={() => setShowMore(!showMore)}
                title="더보기"
              >
                <MoreHorizontal size={13} />
              </button>
              {showMore && (
                <div className="clinic-hub__action-dropdown">
                  <button type="button" onClick={() => { onWaive(); setShowMore(false); }} disabled={disabled}>면제</button>
                  <button type="button" onClick={() => { onCarryOver(); setShowMore(false); }} disabled={disabled}>다음 차수 이월</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <span className="clinic-hub__cell-muted">-</span>
        )}
      </td>
    </tr>
  );
}

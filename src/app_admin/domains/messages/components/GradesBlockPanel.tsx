// PATH: src/app_admin/domains/messages/components/GradesBlockPanel.tsx
// 성적(grades) 카테고리 전용 변수 삽입 패널
// 목록형 변수 + 동적 시험/과제 추가 + 요약 변수

import { useState, useCallback } from "react";
import { SCORE_TEMPLATE_SLOT_LIMIT } from "@admin/domains/scores/constants/scoreTemplateSlots";
import { type TemplateBlock } from "../constants/templateBlocks";

// ── 동적 삽입 헬퍼 ──

/** 본문에서 이미 사용된 시험/과제 번호 중 최대값을 찾는다 */
function findMaxUsedNumber(body: string, prefix: "시험" | "과제"): number {
  const re = new RegExp(`#\\{${prefix}(\\d+)`, "g");
  let max = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max;
}

function getBlockTone(blockId: string): string {
  if (blockId.startsWith("exam_") || blockId === "exam_list" || blockId === "exam_total" || blockId === "exam_total_max" || blockId === "exam_score") {
    return "grades-exam";
  }
  if (blockId.startsWith("hw_") || blockId === "hw_list" || blockId === "hw_completion" || blockId === "assignment_score") {
    return "grades-homework";
  }
  if (blockId === "full_summary" || blockId === "clinic_result") return "grades-summary";
  if (blockId.includes("student")) return "grades-student";
  if (blockId.includes("lecture") || blockId.includes("session")) return "grades-lecture";
  if (blockId === "site_link") return "grades-site";
  return "grades-default";
}

// ── Component ──

export default function GradesBlockPanel({
  blocks,
  onInsert,
  disabled,
  currentBody,
}: {
  blocks: TemplateBlock[];
  onInsert: (text: string) => void;
  disabled?: boolean;
  /** 현재 본문 — 동적 번호 계산에 사용 */
  currentBody?: string;
}) {
  const [showIndividual, setShowIndividual] = useState(false);

  // 블록 분류
  const commonBlocks = blocks.filter((b) =>
    !b.id.startsWith("exam_") && !b.id.startsWith("hw_") && b.id !== "full_summary" &&
    !["exam_score", "assignment_score", "clinic_result", "exam_total", "exam_total_max", "hw_completion"].includes(b.id)
  );
  const listBlocks = blocks.filter((b) => ["exam_list", "hw_list", "full_summary"].includes(b.id));
  const summaryBlocks = blocks.filter((b) => ["exam_total", "exam_total_max", "hw_completion"].includes(b.id));
  const etcBlocks = blocks.filter((b) => ["exam_score", "assignment_score", "clinic_result"].includes(b.id));
  const bodyForSlots = currentBody ?? "";
  const examMaxNumber = findMaxUsedNumber(bodyForSlots, "시험");
  const homeworkMaxNumber = findMaxUsedNumber(bodyForSlots, "과제");
  const canAddExam = examMaxNumber < SCORE_TEMPLATE_SLOT_LIMIT;
  const canAddHomework = homeworkMaxNumber < SCORE_TEMPLATE_SLOT_LIMIT;

  const renderTag = useCallback((block: TemplateBlock, index: number) => {
    const tone = getBlockTone(block.id);
    const toneIndex = index % 3;
    return (
      <button key={block.id} type="button" onMouseDown={(e) => e.preventDefault()}
        onClick={() => onInsert(block.insertText)} disabled={disabled}
        className={`template-editor__block-tag template-editor__block-tag--compact template-editor__block-tag--${tone} template-editor__block-tag--n${toneIndex}`}>
        {block.label}
      </button>
    );
  }, [onInsert, disabled]);

  // 동적 시험/과제 추가
  const handleAddExam = useCallback(() => {
    const body = currentBody ?? "";
    const max = findMaxUsedNumber(body, "시험");
    if (max >= SCORE_TEMPLATE_SLOT_LIMIT) return;
    const next = max + 1;
    onInsert(`#{시험${next}명}: #{시험${next}}/#{시험${next}만점}`);
  }, [currentBody, onInsert]);

  const handleAddHomework = useCallback(() => {
    const body = currentBody ?? "";
    const max = findMaxUsedNumber(body, "과제");
    if (max >= SCORE_TEMPLATE_SLOT_LIMIT) return;
    const next = max + 1;
    onInsert(`#{과제${next}명}: #{과제${next}}/#{과제${next}만점}`);
  }, [currentBody, onInsert]);

  return (
    <div className="grades-block-panel">
      {/* 공통 */}
      <div className="grades-block-panel__tag-row">{commonBlocks.map(renderTag)}</div>

      {/* 목록형 (추천) */}
      <div className="grades-block-panel__group-label">자동 목록 — 시험/과제 개수에 맞게 자동 생성됩니다</div>
      <div className="grades-block-panel__tag-row">{listBlocks.map(renderTag)}</div>

      {/* 시험/과제 동적 추가 */}
      <div className="grades-block-panel__group-label">개별 추가</div>
      <div className="grades-block-panel__add-row">
        <button
          type="button"
          onClick={handleAddExam}
          disabled={disabled || !canAddExam}
          title={canAddExam ? "다음 시험 변수 추가" : `시험은 최대 ${SCORE_TEMPLATE_SLOT_LIMIT}개까지 추가할 수 있습니다`}
          className="grades-block-panel__add-btn"
        >
          + 시험 추가
        </button>
        <button
          type="button"
          onClick={handleAddHomework}
          disabled={disabled || !canAddHomework}
          title={canAddHomework ? "다음 과제 변수 추가" : `과제는 최대 ${SCORE_TEMPLATE_SLOT_LIMIT}개까지 추가할 수 있습니다`}
          className="grades-block-panel__add-btn"
        >
          + 과제 추가
        </button>
      </div>
      <div className="grades-block-panel__hint">
        클릭하면 다음 번호의 시험/과제 변수가 본문에 추가됩니다. 최대 {SCORE_TEMPLATE_SLOT_LIMIT}개까지 지원하며 미사용 번호는 발송 시 자동 제거.
      </div>

      {/* 요약 */}
      <div className="grades-block-panel__group-label">요약</div>
      <div className="grades-block-panel__tag-row">
        {summaryBlocks.map(renderTag)}
        {etcBlocks.map(renderTag)}
      </div>

      {/* 개별 변수 (접이식 — 고급) */}
      <button
        type="button"
        onClick={() => setShowIndividual(!showIndividual)}
        className="grades-block-panel__toggle"
      >
        {showIndividual ? "▾" : "▸"} 개별 변수 전체 보기
      </button>
      {showIndividual && (
        <div className="grades-block-panel__individual">
          <div className="grades-block-panel__group-label grades-block-panel__group-label--flush">시험 (번호별)</div>
          <div className="grades-block-panel__tag-row grades-block-panel__tag-row--tight">
            {blocks.filter((b) => /^exam_\d/.test(b.id)).map(renderTag)}
          </div>
          <div className="grades-block-panel__group-label">과제 (번호별)</div>
          <div className="grades-block-panel__tag-row grades-block-panel__tag-row--tight">
            {blocks.filter((b) => /^hw_\d/.test(b.id)).map(renderTag)}
          </div>
        </div>
      )}
    </div>
  );
}

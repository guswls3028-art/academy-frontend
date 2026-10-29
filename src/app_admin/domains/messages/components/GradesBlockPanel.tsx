// PATH: src/app_admin/domains/messages/components/GradesBlockPanel.tsx
// 성적(grades) 카테고리 전용 변수 삽입 패널
// 목록형 변수 + 동적 시험/과제 추가 + 요약 변수

import { useState, useCallback } from "react";
import { SCORE_TEMPLATE_SLOT_LIMIT } from "@/shared/scoring/scoreTemplateSlots";
import { scoreMessageItems } from "@/shared/messaging/scoreMessageEditor";
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
  values,
}: {
  blocks: TemplateBlock[];
  onInsert: (text: string) => void;
  disabled?: boolean;
  /** 현재 본문 — 동적 번호 계산에 사용 */
  currentBody?: string;
  values?: Record<string, string>;
}) {
  const items = scoreMessageItems(values);
  const [showIndividual, setShowIndividual] = useState(false);
  const [futureOffset, setFutureOffset] = useState(2);

  // 블록 분류
  const commonBlocks = blocks.filter((b) =>
    !b.id.startsWith("exam_") && !b.id.startsWith("hw_") && b.id !== "full_summary" &&
    !["exam_score", "assignment_score", "clinic_result", "exam_total", "exam_total_max", "hw_completion"].includes(b.id)
  );
  const listBlocks = blocks.filter((b) => ["exam_list", "exam_history", "hw_list", "full_summary"].includes(b.id));
  const summaryBlocks = blocks.filter((b) => ["exam_total", "exam_total_max", "hw_total", "hw_total_max", "hw_completion"].includes(b.id));
  const etcBlocks = blocks.filter((b) => ["assignment_score", "clinic_result"].includes(b.id));
  const bodyForSlots = currentBody ?? "";
  const examMaxNumber = findMaxUsedNumber(bodyForSlots, "시험");
  const homeworkMaxNumber = findMaxUsedNumber(bodyForSlots, "과제");
  const canAddExam = examMaxNumber < SCORE_TEMPLATE_SLOT_LIMIT;
  const canAddHomework = homeworkMaxNumber < SCORE_TEMPLATE_SLOT_LIMIT;

  const renderTag = useCallback((block: TemplateBlock, index: number) => {
    const tone = getBlockTone(block.id);
    const toneIndex = index % 3;
    return (
      <button title={block.description} key={block.id} type="button" onMouseDown={(e) => e.preventDefault()}
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
      {items.length > 0 && <>
        <div className="grades-block-panel__group-label">이번 수업 결과 · 본문에 넣을 항목 선택</div>
        <button type="button" className="grades-block-panel__add-btn" disabled={disabled}
          onMouseDown={event => event.preventDefault()}
          onClick={() => onInsert(items.map(item => item.text).join("\n"))}>시험·과제 결과 넣기</button>
        <div className="grades-block-panel__tag-row">{items.map(item => (
          <button type="button" key={`${item.kind}${item.number}`} disabled={disabled}
            className="grades-block-panel__add-btn" onMouseDown={event => event.preventDefault()}
            onClick={() => onInsert(item.text)}>{item.name} 넣기</button>
        ))}</div>
      </>}
      {/* 공통 */}
      <div className="grades-block-panel__tag-row">{commonBlocks.map(renderTag)}</div>

      <div className="grades-block-panel__group-label">지정 차시 뒤 수업 · 같은 강의·반의 실제 수업 순서</div>
      <div className="grades-block-panel__add-row">
        <label>몇 차시 뒤 <input aria-label="몇 차시 뒤" type="number" min={1} max={99} value={futureOffset} disabled={disabled}
          onChange={e => setFutureOffset(Math.max(1, Math.min(99, Number(e.target.value) || 1)))} className="w-16 border rounded p-1" /></label>
        <button type="button" disabled={disabled} className="grades-block-panel__add-btn" onClick={() => onInsert(`#{${futureOffset}차시후명}`)}>수업 이름 넣기</button>
        <button type="button" disabled={disabled} className="grades-block-panel__add-btn" onClick={() => onInsert(`#{${futureOffset}차시후날짜}`)}>수업 날짜 넣기</button>
      </div>
      <div className="grades-block-panel__hint">수업 날짜는 차시에 등록된 날짜입니다. 발송 날짜와 다르며, 비어 있으면 발송 전에 안내합니다.</div>
      {/* 목록형 (추천) */}
      <div className="grades-block-panel__group-label">자동 목록 — 시험/과제 개수에 맞게 자동 생성됩니다</div>
      <div className="grades-block-panel__tag-row">{listBlocks.map(renderTag)}</div>

      {!values && <>
      {/* 시험/과제 동적 추가 */}
      <div className="grades-block-panel__group-label">개별 추가</div>
      <div className="grades-block-panel__add-row">
        <button
          type="button"
          onClick={handleAddExam}
          disabled={disabled || !canAddExam}
          title={canAddExam ? "다음 시험 정보 추가" : `시험은 최대 ${SCORE_TEMPLATE_SLOT_LIMIT}개까지 추가할 수 있습니다`}
          className="grades-block-panel__add-btn"
        >
          + 시험 추가
        </button>
        <button
          type="button"
          onClick={handleAddHomework}
          disabled={disabled || !canAddHomework}
          title={canAddHomework ? "다음 과제 정보 추가" : `과제는 최대 ${SCORE_TEMPLATE_SLOT_LIMIT}개까지 추가할 수 있습니다`}
          className="grades-block-panel__add-btn"
        >
          + 과제 추가
        </button>
      </div>
      <div className="grades-block-panel__hint">
        시험·과제 정보를 필요한 만큼 본문에 넣을 수 있습니다.
      </div>

      </>}
      {/* 요약 */}
      <div className="grades-block-panel__group-label">요약</div>
      <div className="grades-block-panel__tag-row">
        {summaryBlocks.map(renderTag)}
        {etcBlocks.map(renderTag)}
      </div>

      {/* 개별 정보 (접이식 — 고급) */}
      <button
        type="button"
        onClick={() => setShowIndividual(!showIndividual)}
        className="grades-block-panel__toggle"
      >
        {showIndividual ? "▾" : "▸"} 개별 정보 전체 보기
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

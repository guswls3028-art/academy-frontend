// PATH: src/features/messages/components/GradesBlockPanel.tsx
// 성적(grades) 카테고리 전용 변수 삽입 패널
// 목록형 변수 + 동적 시험/과제 추가 + 요약 변수

import { useState, useCallback } from "react";
import { getBlockColor, type TemplateBlock } from "../constants/templateBlocks";

// ── 인라인 스타일 ──

const GROUP_LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)",
  marginTop: 8, marginBottom: 4, letterSpacing: "0.3px",
};

const TAG_ROW: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 4,
};

const ADD_BTN: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "6px 14px", fontSize: 12, fontWeight: 700,
  borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
  border: "1.5px solid color-mix(in srgb, var(--color-primary) 30%, var(--color-border-divider))",
  background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))",
  color: "var(--color-primary)",
};

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

  const renderTag = useCallback((block: TemplateBlock) => {
    const bc = getBlockColor(block.id);
    return (
      <button key={block.id} type="button" onMouseDown={(e) => e.preventDefault()}
        onClick={() => onInsert(block.insertText)} disabled={disabled}
        className="template-editor__block-tag"
        style={{ background: bc.bg, color: bc.color, borderColor: bc.border, padding: "4px 10px", fontSize: 11 }}>
        {block.label}
      </button>
    );
  }, [onInsert, disabled]);

  // 동적 시험/과제 추가
  const handleAddExam = useCallback(() => {
    const body = currentBody ?? "";
    const next = findMaxUsedNumber(body, "시험") + 1;
    onInsert(`\n#{시험${next}명}: #{시험${next}}/#{시험${next}만점}`);
  }, [currentBody, onInsert]);

  const handleAddHomework = useCallback(() => {
    const body = currentBody ?? "";
    const next = findMaxUsedNumber(body, "과제") + 1;
    onInsert(`\n#{과제${next}명}: #{과제${next}}/#{과제${next}만점}`);
  }, [currentBody, onInsert]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* 공통 */}
      <div style={TAG_ROW}>{commonBlocks.map(renderTag)}</div>

      {/* 목록형 (추천) */}
      <div style={GROUP_LABEL}>📋 자동 생성 (시험/과제 개수에 맞게)</div>
      <div style={TAG_ROW}>{listBlocks.map(renderTag)}</div>

      {/* 시험/과제 동적 추가 */}
      <div style={GROUP_LABEL}>시험 / 과제 개별 추가</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleAddExam}
          disabled={disabled}
          style={ADD_BTN}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-surface))"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "color-mix(in srgb, var(--color-primary) 30%, var(--color-border-divider))"; e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))"; }}
        >
          + 시험 추가
        </button>
        <button
          type="button"
          onClick={handleAddHomework}
          disabled={disabled}
          style={ADD_BTN}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-surface))"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "color-mix(in srgb, var(--color-primary) 30%, var(--color-border-divider))"; e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg-surface))"; }}
        >
          + 과제 추가
        </button>
      </div>
      <div style={{ fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
        클릭하면 다음 번호의 시험/과제 변수가 본문에 추가됩니다. 미사용 번호는 발송 시 자동 제거.
      </div>

      {/* 요약 */}
      <div style={GROUP_LABEL}>요약</div>
      <div style={TAG_ROW}>
        {summaryBlocks.map(renderTag)}
        {etcBlocks.map(renderTag)}
      </div>

      {/* 개별 변수 (접이식 — 고급) */}
      <button
        type="button"
        onClick={() => setShowIndividual(!showIndividual)}
        style={{
          fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)",
          background: "transparent", border: "none", cursor: "pointer",
          textAlign: "left" as const, padding: "6px 0 2px",
        }}
      >
        {showIndividual ? "▾" : "▸"} 개별 변수 전체 보기
      </button>
      {showIndividual && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 4 }}>
          <div style={{ ...GROUP_LABEL, marginTop: 0 }}>시험 (번호별)</div>
          <div style={{ ...TAG_ROW, gap: 3 }}>
            {blocks.filter((b) => /^exam_\d/.test(b.id)).map(renderTag)}
          </div>
          <div style={GROUP_LABEL}>과제 (번호별)</div>
          <div style={{ ...TAG_ROW, gap: 3 }}>
            {blocks.filter((b) => /^hw_\d/.test(b.id)).map(renderTag)}
          </div>
        </div>
      )}
    </div>
  );
}

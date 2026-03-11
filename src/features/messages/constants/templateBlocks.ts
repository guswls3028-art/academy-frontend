// PATH: src/features/messages/constants/templateBlocks.ts
// 카테고리별 삽입 블록 — 실제 services.py 런타임 치환 변수와 1:1 매칭

import React from "react";

/** 현재 테넌트 사이트 URL (미리보기용) */
function getTenantSiteUrl(): string {
  try {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "https://example.com";
    return `https://${host}`;
  } catch {
    return "https://example.com";
  }
}

export interface TemplateBlock {
  id: string;
  label: string;
  insertText: string;
  previewValue: string;
}

// ─── 블록 정의 ───

const B = {
  // 공통
  student_name_2:    { id: "student_name_2",    label: "이름 2글자",       insertText: "#{학생이름2}",         previewValue: "길동" },
  student_name_3:    { id: "student_name_3",    label: "이름 3글자",       insertText: "#{학생이름3}",         previewValue: "홍길동" },
  site_link:         { id: "site_link",         label: "사이트 링크",      insertText: "#{사이트링크}",        previewValue: getTenantSiteUrl() },
  date:              { id: "date",              label: "날짜",             insertText: "#{날짜}",              previewValue: "2026-03-11" },
  time:              { id: "time",              label: "시간",             insertText: "#{시간}",              previewValue: "14:00" },
  // 가입/등록
  student_name:      { id: "student_name",      label: "이름 (전체)",      insertText: "#{학생이름}",          previewValue: "홍길동" },
  student_id:        { id: "student_id",        label: "학생 아이디",      insertText: "#{학생아이디}",        previewValue: "S20250001" },
  student_password:  { id: "student_password",  label: "학생 비밀번호",    insertText: "#{학생비밀번호}",      previewValue: "****" },
  parent_id:         { id: "parent_id",         label: "학부모 아이디",    insertText: "#{학부모아이디}",      previewValue: "010****1234" },
  parent_password:   { id: "parent_password",   label: "학부모 비밀번호",  insertText: "#{학부모비밀번호}",    previewValue: "****" },
  pw_notice:         { id: "pw_notice",         label: "비밀번호 변경 안내", insertText: "#{비밀번호안내}",    previewValue: "보안을 위해 비밀번호를 변경해 주세요." },
  // 강의/출결
  lecture_name:      { id: "lecture_name",      label: "강의명",           insertText: "#{강의명}",            previewValue: "수학 심화반" },
  session_name:      { id: "session_name",      label: "차시명",           insertText: "#{차시명}",            previewValue: "3회차" },
  // 시험
  exam_name:         { id: "exam_name",         label: "시험명",           insertText: "#{시험명}",            previewValue: "3월 모의고사" },
  score:             { id: "score",             label: "성적",             insertText: "#{성적}",              previewValue: "85점" },
  // 과제
  assignment_name:   { id: "assignment_name",   label: "과제명",           insertText: "#{과제명}",            previewValue: "단원 복습 과제" },
  // 성적
  exam_score:        { id: "exam_score",        label: "시험 성적",        insertText: "#{시험성적}",          previewValue: "85점" },
  assignment_score:  { id: "assignment_score",  label: "과제 성적",        insertText: "#{과제성적}",          previewValue: "90점" },
  // 클리닉
  clinic_name:       { id: "clinic_name",       label: "클리닉명",         insertText: "#{클리닉명}",          previewValue: "수학 보충 클리닉" },
  clinic_place:      { id: "clinic_place",      label: "클리닉 장소",      insertText: "#{장소}",              previewValue: "3층 세미나실" },
} satisfies Record<string, TemplateBlock>;

// ─── 카테고리별 블록 조합 ───

const COMMON: TemplateBlock[] = [B.student_name_2, B.student_name_3, B.site_link, B.date, B.time];

const CATEGORY_BLOCKS: Record<string, TemplateBlock[]> = {
  signup:     [...COMMON, B.student_name, B.student_id, B.student_password, B.parent_id, B.parent_password, B.pw_notice],
  attendance: [...COMMON, B.lecture_name, B.session_name],
  lecture:    [...COMMON, B.lecture_name, B.session_name],
  exam:       [...COMMON, B.lecture_name, B.session_name, B.exam_name, B.score],
  assignment: [...COMMON, B.lecture_name, B.session_name, B.assignment_name, B.score],
  grades:     [...COMMON, B.lecture_name, B.session_name, B.exam_name, B.assignment_name, B.exam_score, B.assignment_score],
  clinic:     [...COMMON, B.clinic_name, B.clinic_place],
  payment:    [...COMMON],
  notice:     [...COMMON],
};

// ─── 카테고리 타입 ───

export type TemplateCategory =
  | "default"
  | "signup"
  | "attendance"
  | "lecture"
  | "exam"
  | "assignment"
  | "grades"
  | "clinic"
  | "payment"
  | "notice";

export function getBlocksForCategory(category: TemplateCategory): TemplateBlock[] {
  return CATEGORY_BLOCKS[category] ?? [...COMMON];
}

// ─── 미리보기 치환 ───

const ALL_BLOCKS = Object.values(B);
export function renderPreviewText(text: string): string {
  const map: Record<string, string> = Object.fromEntries(
    ALL_BLOCKS.map((b) => [b.insertText, b.previewValue]),
  );
  return text.replace(/#\{[^}]*\}/g, (match) => map[match] ?? match);
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  default: "사용자",
  signup: "가입/등록",
  attendance: "출결",
  lecture: "강의",
  exam: "시험",
  assignment: "과제",
  grades: "성적",
  clinic: "클리닉/상담",
  payment: "결제",
  notice: "운영공지",
};

// ─── 블록별 고유 색상 ───

const BLOCK_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  // 공통 — 보라/인디고 계열
  student_name_2:   { bg: "color-mix(in srgb, #6366f1 12%, transparent)", color: "#4f46e5", border: "color-mix(in srgb, #6366f1 30%, transparent)" },
  student_name_3:   { bg: "color-mix(in srgb, #8b5cf6 12%, transparent)", color: "#7c3aed", border: "color-mix(in srgb, #8b5cf6 30%, transparent)" },
  site_link:        { bg: "color-mix(in srgb, #14b8a6 12%, transparent)", color: "#0d9488", border: "color-mix(in srgb, #14b8a6 30%, transparent)" },
  date:             { bg: "color-mix(in srgb, #ec4899 12%, transparent)", color: "#db2777", border: "color-mix(in srgb, #ec4899 30%, transparent)" },
  time:             { bg: "color-mix(in srgb, #f43f5e 12%, transparent)", color: "#e11d48", border: "color-mix(in srgb, #f43f5e 30%, transparent)" },
  // 가입/등록 — 블루/옐로 계열
  student_name:     { bg: "color-mix(in srgb, #3b82f6 12%, transparent)", color: "#2563eb", border: "color-mix(in srgb, #3b82f6 30%, transparent)" },
  student_id:       { bg: "color-mix(in srgb, #0ea5e9 12%, transparent)", color: "#0284c7", border: "color-mix(in srgb, #0ea5e9 30%, transparent)" },
  student_password: { bg: "color-mix(in srgb, #06b6d4 12%, transparent)", color: "#0891b2", border: "color-mix(in srgb, #06b6d4 30%, transparent)" },
  parent_id:        { bg: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#d97706", border: "color-mix(in srgb, #f59e0b 30%, transparent)" },
  parent_password:  { bg: "color-mix(in srgb, #f97316 12%, transparent)", color: "#ea580c", border: "color-mix(in srgb, #f97316 30%, transparent)" },
  pw_notice:        { bg: "color-mix(in srgb, #22c55e 12%, transparent)", color: "#16a34a", border: "color-mix(in srgb, #22c55e 30%, transparent)" },
  // 강의/출결 — 그린/시안 계열
  lecture_name:     { bg: "color-mix(in srgb, #10b981 12%, transparent)", color: "#059669", border: "color-mix(in srgb, #10b981 30%, transparent)" },
  session_name:     { bg: "color-mix(in srgb, #2dd4bf 12%, transparent)", color: "#0d9488", border: "color-mix(in srgb, #2dd4bf 30%, transparent)" },
  // 시험 — 레드/오렌지 계열
  exam_name:        { bg: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#dc2626", border: "color-mix(in srgb, #ef4444 30%, transparent)" },
  score:            { bg: "color-mix(in srgb, #a855f7 12%, transparent)", color: "#9333ea", border: "color-mix(in srgb, #a855f7 30%, transparent)" },
  // 과제
  assignment_name:  { bg: "color-mix(in srgb, #f97316 12%, transparent)", color: "#ea580c", border: "color-mix(in srgb, #f97316 30%, transparent)" },
  // 성적
  exam_score:       { bg: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#dc2626", border: "color-mix(in srgb, #ef4444 30%, transparent)" },
  assignment_score: { bg: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#d97706", border: "color-mix(in srgb, #f59e0b 30%, transparent)" },
  // 클리닉 — 핑크/퍼플 계열
  clinic_name:      { bg: "color-mix(in srgb, #d946ef 12%, transparent)", color: "#c026d3", border: "color-mix(in srgb, #d946ef 30%, transparent)" },
  clinic_place:     { bg: "color-mix(in srgb, #a78bfa 12%, transparent)", color: "#7c3aed", border: "color-mix(in srgb, #a78bfa 30%, transparent)" },
};

const FALLBACK_COLOR = { bg: "color-mix(in srgb, var(--color-primary) 10%, transparent)", color: "var(--color-primary)", border: "color-mix(in srgb, var(--color-primary) 25%, transparent)" };

/** 블록 ID로 고유 색상 반환 */
export function getBlockColor(blockId: string): { bg: string; color: string; border: string } {
  return BLOCK_COLORS[blockId] ?? FALLBACK_COLOR;
}

// ─── 본문 미리보기용 컬러 배지 렌더링 ───

const INSERT_TEXT_TO_BLOCK: Record<string, TemplateBlock> = Object.fromEntries(
  ALL_BLOCKS.map((b) => [b.insertText, b]),
);

/**
 * #{variable} 코드를 컬러 배지(React 노드)로 렌더링.
 * 카드 미리보기·모달 미리보기 등에서 raw 코드 대신 사용.
 */
export function renderPreviewBadges(text: string): React.ReactNode[] {
  const parts = text.split(/(#\{[^}]*\})/g);
  return parts.map((part, i) => {
    const block = INSERT_TEXT_TO_BLOCK[part];
    if (block) {
      const bc = BLOCK_COLORS[block.id] ?? FALLBACK_COLOR;
      return React.createElement(
        "span",
        {
          key: i,
          style: {
            display: "inline-flex",
            alignItems: "center",
            padding: "1px 6px",
            borderRadius: 4,
            fontSize: "0.85em",
            fontWeight: 600,
            lineHeight: 1.4,
            background: bc.bg,
            color: bc.color,
            border: `1px solid ${bc.border}`,
            whiteSpace: "nowrap" as const,
            verticalAlign: "middle",
          },
        },
        block.label,
      );
    }
    // plain text — preserve newlines
    if (!part) return null;
    return React.createElement("span", { key: i }, part);
  });
}

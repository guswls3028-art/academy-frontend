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
  clinic_result:     { id: "clinic_result",     label: "클리닉 합불",      insertText: "#{클리닉합불}",        previewValue: "합격" },
  // 커뮤니티
  post_title:        { id: "post_title",        label: "게시글 제목",      insertText: "#{게시글제목}",        previewValue: "수학 문제 질문" },
  answer_summary:    { id: "answer_summary",    label: "답변 요약",        insertText: "#{답변요약}",          previewValue: "풀이 방법을 안내드립니다." },
  counsel_type:      { id: "counsel_type",      label: "상담 유형",        insertText: "#{상담유형}",          previewValue: "학습 상담" },
  // 자유 입력 (알림톡 자유양식 템플릿용)
  free_content:      { id: "free_content",      label: "자유 내용",        insertText: "#{내용}",              previewValue: "(직접 입력한 내용이 여기에 표시됩니다)" },
  // 직원
  staff_name:        { id: "staff_name",        label: "직원명",           insertText: "#{직원명}",            previewValue: "김영희" },
  department:        { id: "department",         label: "부서",             insertText: "#{부서}",              previewValue: "수학과" },
  position:          { id: "position",           label: "직급",             insertText: "#{직급}",              previewValue: "강사" },
  pay_period:        { id: "pay_period",         label: "급여 기간",        insertText: "#{급여기간}",          previewValue: "2026년 3월" },
  pay_amount:        { id: "pay_amount",         label: "급여 금액",        insertText: "#{급여금액}",          previewValue: "3,200,000원" },
  expense_amount:    { id: "expense_amount",     label: "경비 금액",        insertText: "#{경비금액}",          previewValue: "150,000원" },
  work_hours:        { id: "work_hours",         label: "근무 시간",        insertText: "#{근무시간}",          previewValue: "160시간" },
  work_days:         { id: "work_days",          label: "근무 일수",        insertText: "#{근무일수}",          previewValue: "22일" },
} satisfies Record<string, TemplateBlock>;

// ─── 카테고리별 블록 조합 ───

const COMMON: TemplateBlock[] = [B.student_name_2, B.student_name_3, B.free_content, B.site_link, B.date, B.time];

const CATEGORY_BLOCKS: Record<string, TemplateBlock[]> = {
  student:    [...COMMON, B.student_name, B.student_id],
  signup:     [...COMMON, B.student_name, B.student_id, B.student_password, B.parent_id, B.parent_password, B.pw_notice],
  attendance: [...COMMON, B.lecture_name, B.session_name],
  lecture:    [...COMMON, B.lecture_name, B.session_name],
  exam:       [...COMMON, B.lecture_name, B.session_name, B.exam_name, B.score],
  assignment: [...COMMON, B.lecture_name, B.session_name, B.assignment_name, B.score],
  grades:     [
    // ── 공통 ──
    ...COMMON, B.student_name, B.lecture_name, B.session_name,
    // ── 목록형 변수 (시험/과제 개수에 맞게 자동 렌더링 — 간단 양식에 추천) ──
    { id: "exam_list",    label: "📋 시험 목록",  insertText: "#{시험목록}",  previewValue: "- 단원평가: 92/100 (92%) 합격\n- 쪽지시험: 45/50 (90%) 합격" },
    { id: "hw_list",      label: "📋 과제 목록",  insertText: "#{과제목록}",  previewValue: "- 복습과제: 90/100 (90%)" },
    { id: "full_summary", label: "📋 전체 요약",  insertText: "#{전체요약}",  previewValue: "시험: 2/2 합격 (평균 91점)\n과제: 1/1 완료\n최종: 합격" },
    // ── 요약 수치 ──
    { id: "exam_total",     label: "시험 총점",     insertText: "#{시험총점}",   previewValue: "285" },
    { id: "exam_total_max", label: "시험 총만점",   insertText: "#{시험총만점}", previewValue: "350" },
    { id: "hw_completion",  label: "숙제 완성도",   insertText: "#{숙제완성도}", previewValue: "3/3 완료" },
    // ── 시험 개별 (번호별: 이름·점수·만점) ──
    // 시험 개수는 차시마다 다름. 양식에 필요한 만큼 삽입. 미사용 번호는 발송 시 자동 제거.
    ...[1,2,3,4,5].flatMap((n) => [
      { id: `exam_${n}_name`, label: `시험 ${n} 이름`,  insertText: `#{시험${n}명}`,   previewValue: n === 1 ? "단원평가" : n === 2 ? "쪽지시험" : `시험${n}` },
      { id: `exam_${n}`,      label: `시험 ${n} 점수`,  insertText: `#{시험${n}}`,     previewValue: `${80+n*3}` },
      { id: `exam_${n}_max`,  label: `시험 ${n} 만점`,  insertText: `#{시험${n}만점}`, previewValue: "100" },
    ]),
    // ── 과제 개별 (번호별) ──
    ...[1,2,3].flatMap((n) => [
      { id: `hw_${n}_name`, label: `과제 ${n} 이름`,  insertText: `#{과제${n}명}`,   previewValue: n === 1 ? "복습과제" : `과제${n}` },
      { id: `hw_${n}`,      label: `과제 ${n} 점수`,  insertText: `#{과제${n}}`,     previewValue: `${85+n*2}` },
      { id: `hw_${n}_max`,  label: `과제 ${n} 만점`,  insertText: `#{과제${n}만점}`, previewValue: "100" },
    ]),
    // ── 기타 ──
    B.exam_score, B.assignment_score, B.clinic_result,
  ],
  clinic:     [...COMMON, B.clinic_name, B.clinic_place, B.clinic_result],
  payment:    [...COMMON],
  notice:     [...COMMON],
  community:  [...COMMON, B.post_title, B.answer_summary, B.counsel_type],
  staff:      [B.staff_name, B.department, B.position, B.site_link, B.date, B.time, B.pay_period, B.pay_amount, B.expense_amount, B.work_hours, B.work_days],
};

// ─── 카테고리 타입 ───

export type TemplateCategory =
  | "default"
  | "student"
  | "signup"
  | "attendance"
  | "lecture"
  | "exam"
  | "assignment"
  | "grades"
  | "clinic"
  | "payment"
  | "notice"
  | "community"
  | "staff";

/** "default" (사용자) 카테고리는 어디서든 쓸 수 있는 공통 블록만 제공 */
export function getBlocksForCategory(category: TemplateCategory): TemplateBlock[] {
  if (category === "default") return [...COMMON];
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
  student: "학생",
  signup: "가입/등록",
  attendance: "출결",
  lecture: "강의",
  exam: "시험",
  assignment: "과제",
  grades: "성적",
  clinic: "클리닉/상담",
  payment: "결제",
  notice: "운영공지",
  community: "커뮤니티",
  staff: "직원",
};

// ─── 블록별 고유 색상 ───

const BLOCK_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  // 공통 — 보라/인디고 계열
  student_name_2:   { bg: "color-mix(in srgb, #6366f1 16%, transparent)", color: "#4f46e5", border: "color-mix(in srgb, #6366f1 40%, transparent)" },
  student_name_3:   { bg: "color-mix(in srgb, #8b5cf6 16%, transparent)", color: "#7c3aed", border: "color-mix(in srgb, #8b5cf6 40%, transparent)" },
  site_link:        { bg: "color-mix(in srgb, #14b8a6 16%, transparent)", color: "#0d9488", border: "color-mix(in srgb, #14b8a6 40%, transparent)" },
  date:             { bg: "color-mix(in srgb, #ec4899 16%, transparent)", color: "#db2777", border: "color-mix(in srgb, #ec4899 40%, transparent)" },
  time:             { bg: "color-mix(in srgb, #f43f5e 16%, transparent)", color: "#e11d48", border: "color-mix(in srgb, #f43f5e 40%, transparent)" },
  // 가입/등록 — 블루/옐로 계열
  student_name:     { bg: "color-mix(in srgb, #3b82f6 16%, transparent)", color: "#2563eb", border: "color-mix(in srgb, #3b82f6 40%, transparent)" },
  student_id:       { bg: "color-mix(in srgb, #0ea5e9 16%, transparent)", color: "#0284c7", border: "color-mix(in srgb, #0ea5e9 40%, transparent)" },
  student_password: { bg: "color-mix(in srgb, #06b6d4 16%, transparent)", color: "#0891b2", border: "color-mix(in srgb, #06b6d4 40%, transparent)" },
  parent_id:        { bg: "color-mix(in srgb, #f59e0b 16%, transparent)", color: "#d97706", border: "color-mix(in srgb, #f59e0b 40%, transparent)" },
  parent_password:  { bg: "color-mix(in srgb, #f97316 16%, transparent)", color: "#ea580c", border: "color-mix(in srgb, #f97316 40%, transparent)" },
  pw_notice:        { bg: "color-mix(in srgb, #22c55e 16%, transparent)", color: "#16a34a", border: "color-mix(in srgb, #22c55e 40%, transparent)" },
  // 강의/출결 — 그린/시안 계열
  lecture_name:     { bg: "color-mix(in srgb, #10b981 16%, transparent)", color: "#059669", border: "color-mix(in srgb, #10b981 40%, transparent)" },
  session_name:     { bg: "color-mix(in srgb, #2dd4bf 16%, transparent)", color: "#0d9488", border: "color-mix(in srgb, #2dd4bf 40%, transparent)" },
  // 시험 — 레드/오렌지 계열
  exam_name:        { bg: "color-mix(in srgb, #ef4444 16%, transparent)", color: "#dc2626", border: "color-mix(in srgb, #ef4444 40%, transparent)" },
  score:            { bg: "color-mix(in srgb, #a855f7 16%, transparent)", color: "#9333ea", border: "color-mix(in srgb, #a855f7 40%, transparent)" },
  // 과제
  assignment_name:  { bg: "color-mix(in srgb, #f97316 16%, transparent)", color: "#ea580c", border: "color-mix(in srgb, #f97316 40%, transparent)" },
  // 성적
  exam_score:       { bg: "color-mix(in srgb, #ef4444 16%, transparent)", color: "#dc2626", border: "color-mix(in srgb, #ef4444 40%, transparent)" },
  assignment_score: { bg: "color-mix(in srgb, #f59e0b 16%, transparent)", color: "#d97706", border: "color-mix(in srgb, #f59e0b 40%, transparent)" },
  // 클리닉 — 핑크/퍼플 계열
  clinic_name:      { bg: "color-mix(in srgb, #d946ef 16%, transparent)", color: "#c026d3", border: "color-mix(in srgb, #d946ef 40%, transparent)" },
  clinic_place:     { bg: "color-mix(in srgb, #a78bfa 16%, transparent)", color: "#7c3aed", border: "color-mix(in srgb, #a78bfa 40%, transparent)" },
  clinic_result:    { bg: "color-mix(in srgb, #22c55e 16%, transparent)", color: "#16a34a", border: "color-mix(in srgb, #22c55e 40%, transparent)" },
  // 커뮤니티 — 인디고/블루 계열
  post_title:       { bg: "color-mix(in srgb, #818cf8 16%, transparent)", color: "#6366f1", border: "color-mix(in srgb, #818cf8 40%, transparent)" },
  answer_summary:   { bg: "color-mix(in srgb, #38bdf8 16%, transparent)", color: "#0284c7", border: "color-mix(in srgb, #38bdf8 40%, transparent)" },
  counsel_type:     { bg: "color-mix(in srgb, #c084fc 16%, transparent)", color: "#9333ea", border: "color-mix(in srgb, #c084fc 40%, transparent)" },
  // 자유 입력 — 그린/에메랄드
  free_content:     { bg: "color-mix(in srgb, #059669 14%, transparent)", color: "#047857", border: "color-mix(in srgb, #059669 35%, transparent)" },
  // 직원 — 앰버/브라운 계열
  staff_name:       { bg: "color-mix(in srgb, #fb923c 16%, transparent)", color: "#ea580c", border: "color-mix(in srgb, #fb923c 40%, transparent)" },
  department:       { bg: "color-mix(in srgb, #fbbf24 16%, transparent)", color: "#d97706", border: "color-mix(in srgb, #fbbf24 40%, transparent)" },
  position:         { bg: "color-mix(in srgb, #a3e635 16%, transparent)", color: "#65a30d", border: "color-mix(in srgb, #a3e635 40%, transparent)" },
  pay_period:       { bg: "color-mix(in srgb, #34d399 16%, transparent)", color: "#059669", border: "color-mix(in srgb, #34d399 40%, transparent)" },
  pay_amount:       { bg: "color-mix(in srgb, #f472b6 16%, transparent)", color: "#db2777", border: "color-mix(in srgb, #f472b6 40%, transparent)" },
  expense_amount:   { bg: "color-mix(in srgb, #fb7185 16%, transparent)", color: "#e11d48", border: "color-mix(in srgb, #fb7185 40%, transparent)" },
  work_hours:       { bg: "color-mix(in srgb, #22d3ee 16%, transparent)", color: "#0891b2", border: "color-mix(in srgb, #22d3ee 40%, transparent)" },
  work_days:        { bg: "color-mix(in srgb, #a78bfa 16%, transparent)", color: "#7c3aed", border: "color-mix(in srgb, #a78bfa 40%, transparent)" },
};

const FALLBACK_COLOR = { bg: "color-mix(in srgb, var(--color-primary) 14%, transparent)", color: "var(--color-primary)", border: "color-mix(in srgb, var(--color-primary) 35%, transparent)" };

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
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: bc.border,
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

// ─── 백엔드 자동 치환 변수 (항상 제공) ───

export const ALWAYS_AVAILABLE_VARS = new Set([
  "학생이름", "학생이름2", "학생이름3", "사이트링크", "날짜", "시간",
  "학생아이디", "학부모아이디", "학생비밀번호", "학부모비밀번호", "비밀번호안내",
  "직원명", "부서", "직급",
]);

/**
 * 알림톡 미리보기용 — 실제 데이터 치환.
 * extraVars에 값이 있으면 실제 값으로, 없으면 미리보기 값/경고 표시.
 */
export function renderPreviewWithActualData(
  body: string,
  extraVars?: Record<string, string>,
  freeContent?: string,
): React.ReactNode[] {
  const parts = body.split(/(#\{[^}]*\})/g);
  return parts.map((part, i) => {
    const match = part.match(/^#\{(.+)\}$/);
    if (!match) {
      if (!part) return null;
      return React.createElement("span", { key: i }, part);
    }
    const varName = match[1];

    // #{내용} — 자유 입력
    if (varName === "내용") {
      const val = freeContent?.trim();
      if (val) return React.createElement("span", { key: i, style: { fontWeight: 600 } }, val);
      return React.createElement("span", { key: i, style: { color: "#999", fontStyle: "italic" } }, "(직접 입력 내용)");
    }

    // extraVars에서 실제 값 제공
    if (extraVars && varName in extraVars && extraVars[varName]) {
      return React.createElement("span", { key: i, style: { fontWeight: 700, color: "#059669" } }, extraVars[varName]);
    }

    // 자동 치환 변수 — 미리보기 값 사용
    const block = INSERT_TEXT_TO_BLOCK[part];
    if (block && ALWAYS_AVAILABLE_VARS.has(varName)) {
      const bc = BLOCK_COLORS[block.id] ?? FALLBACK_COLOR;
      return React.createElement("span", {
        key: i,
        style: {
          display: "inline-flex", alignItems: "center", padding: "1px 6px",
          borderRadius: 4, fontSize: "0.85em", fontWeight: 600, lineHeight: 1.4,
          background: bc.bg, color: bc.color, borderWidth: 1, borderStyle: "solid",
          borderColor: bc.border, whiteSpace: "nowrap" as const, verticalAlign: "middle",
        },
      }, block.previewValue);
    }

    // 미제공 변수 — 경고 스타일
    return React.createElement("span", {
      key: i,
      style: {
        display: "inline-flex", alignItems: "center", padding: "1px 6px",
        borderRadius: 4, fontSize: "0.85em", fontWeight: 600,
        background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d",
        whiteSpace: "nowrap" as const, verticalAlign: "middle",
      },
    }, `${varName}?`);
  });
}

// PATH: src/features/messages/constants/templateBlocks.ts
// 카테고리별 삽입 블록 — 기본(공통) | 강의 | 클리닉
//
// 템플릿 구분:
// - 일반 템플릿: 양식 저장. 메시지 발송 모달에서 "템플릿 불러오기"로 사용.
// - 자동발송 템플릿: 자동발송 탭에서 트리거별로 연결. 가입 완료, 클리닉 알림 등.

export interface TemplateBlock {
  id: string;
  label: string;
  insertText: string;
  previewValue: string;
}

/** 기본: 이름 2/3글자, 사이트링크. 다른 템플릿에도 공통 포함 */
export const DEFAULT_BLOCKS: TemplateBlock[] = [
  { id: "student_name_2", label: "이름 2글자", insertText: "#{student_name_2}", previewValue: "홍길" },
  { id: "student_name_3", label: "이름 3글자", insertText: "#{student_name_3}", previewValue: "홍길동" },
  { id: "site_link", label: "사이트 링크", insertText: "#{site_link}", previewValue: "https://example.com" },
];

/** 가입 완료(자동발송) 전용 */
export const SIGNUP_BLOCKS: TemplateBlock[] = [
  ...DEFAULT_BLOCKS,
  { id: "student_id", label: "학생 ID", insertText: "#{student_id}", previewValue: "S001" },
  { id: "student_password", label: "학생 비밀번호", insertText: "#{student_password}", previewValue: "****" },
  { id: "parent_id", label: "학부모 ID(전화)", insertText: "#{parent_id}", previewValue: "010****1234" },
  { id: "parent_password", label: "학부모 비밀번호", insertText: "#{parent_password}", previewValue: "****" },
];

/** 강의 전용: 강의·차시(세션) 내 학생 선택 발송 시 사용. 기본 + 아래 */
const LECTURE_EXTRA_BLOCKS: TemplateBlock[] = [
  { id: "lecture_name", label: "강의명", insertText: "#{lecture_name}", previewValue: "중등 수학" },
  { id: "attendance_status", label: "출결", insertText: "#{attendance_status}", previewValue: "출석" },
  { id: "exam_name", label: "시험 이름", insertText: "#{exam_name}", previewValue: "1차 모의고사" },
  { id: "exam_score", label: "시험 성적", insertText: "#{exam_score}", previewValue: "85점" },
  { id: "assignment_name", label: "과제 이름", insertText: "#{assignment_name}", previewValue: "챕터 3 문제" },
  { id: "assignment_score", label: "과제 성적", insertText: "#{assignment_score}", previewValue: "90점" },
  { id: "clinic_required", label: "클리닉 합불(필수대상자 여부)", insertText: "#{clinic_required}", previewValue: "필수대상자" },
  { id: "video_name", label: "영상 이름", insertText: "#{video_name}", previewValue: "1강 식의 계산" },
];

/** 클리닉 전용: 클리닉 내 학생 선택 발송 시 사용. 기본 + 아래 */
const CLINIC_EXTRA_BLOCKS: TemplateBlock[] = [
  { id: "clinic_required", label: "클리닉 합불(필수대상자 여부)", insertText: "#{clinic_required}", previewValue: "필수대상자" },
  { id: "clinic_date", label: "클리닉 날짜", insertText: "#{clinic_date}", previewValue: "12/25(목) 14:00" },
];

export type TemplateCategory = "default" | "lecture" | "clinic";

export const LECTURE_BLOCKS: TemplateBlock[] = [...DEFAULT_BLOCKS, ...LECTURE_EXTRA_BLOCKS];
export const CLINIC_BLOCKS: TemplateBlock[] = [...DEFAULT_BLOCKS, ...CLINIC_EXTRA_BLOCKS];

const PREVIEW_MAP: Record<string, string> = Object.fromEntries(
  [
    ...DEFAULT_BLOCKS,
    ...LECTURE_EXTRA_BLOCKS,
    ...CLINIC_EXTRA_BLOCKS,
  ].map((b) => [b.insertText, b.previewValue])
);

export function getBlocksForCategory(category: TemplateCategory): TemplateBlock[] {
  switch (category) {
    case "lecture":
      return LECTURE_BLOCKS;
    case "clinic":
      return CLINIC_BLOCKS;
    default:
      return DEFAULT_BLOCKS;
  }
}

export function renderPreviewText(text: string): string {
  return text.replace(/#\{[^}]*\}/g, (match) => PREVIEW_MAP[match] ?? match);
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  default: "기본",
  lecture: "강의",
  clinic: "클리닉",
};

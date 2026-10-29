import type { MessageTemplateCategory } from "../api/messages.api";
import type { TemplateCategory } from "./templateBlocks";

export type ProvidedTemplatePreset = {
  id: string;
  category: TemplateCategory;
  name: string;
  description: string;
  body: string;
  tags?: string[];
  recommended?: boolean;
};

const PRESETS: ProvidedTemplatePreset[] = [
  {
    id: "attendance.basic",
    category: "attendance",
    name: "출석 안내 기본형",
    description: "수업명과 차시를 포함한 기본 출석 안내입니다.",
    recommended: true,
    tags: ["출석"],
    body: [
      "안녕하세요 #{학생이름}님.",
      "#{강의명} · #{차시명} 출석 안내드립니다.",
      "",
      "수업 관련 문의는 학원으로 연락해 주세요.",
    ].join("\n"),
  },
  {
    id: "exam.schedule-basic",
    category: "exam",
    name: "시험 안내 기본형",
    description: "출석 안내 알림톡에 시험명과 수업 정보를 함께 담습니다.",
    recommended: true,
    tags: ["시험", "일정"],
    body: [
      "안녕하세요 #{학생이름}님.",
      "#{강의명} · #{차시명} 시험 안내드립니다.",
      "",
      "시험명: #{시험명}",
      "",
      "응시 일정과 준비사항을 확인해 주세요.",
    ].join("\n"),
  },
  {
    id: "assignment.due-basic",
    category: "assignment",
    name: "과제 안내 기본형",
    description: "출석 안내 알림톡에 과제명과 제출 안내를 담습니다.",
    recommended: true,
    tags: ["과제", "마감"],
    body: [
      "안녕하세요 #{학생이름}님.",
      "#{강의명} · #{차시명} 과제 안내드립니다.",
      "",
      "과제명: #{과제명}",
      "",
      "제출 기한을 확인하고 완료해 주세요.",
    ].join("\n"),
  },
  {
    id: "clinic.basic",
    category: "clinic",
    name: "클리닉 안내 기본형",
    description: "클리닉 장소와 일정을 간단히 안내합니다.",
    recommended: true,
    tags: ["클리닉"],
    body: [
      "안녕하세요 #{학생이름}님.",
      "클리닉 안내드립니다.",
      "",
      "장소: #{장소}",
      "일시: #{클리닉날짜} #{클리닉시간}",
      "",
      "참석이 어려운 경우 학원으로 연락 부탁드립니다.",
    ].join("\n"),
  },
  {
    id: "default.notice",
    category: "default",
    name: "일반 안내 기본형",
    description: "학생/학부모에게 공통으로 쓰기 좋은 짧은 안내입니다.",
    recommended: true,
    tags: ["일반"],
    body: [
      "안녕하세요 #{학생이름}님.",
      "학원에서 안내드립니다.",
      "",
      "확인 후 궁금한 점은 학원으로 문의해 주세요.",
    ].join("\n"),
  },
];

const CATEGORY_FALLBACKS: Record<TemplateCategory, TemplateCategory[]> = {
  default: ["default"],
  student: ["default"],
  signup: ["default"],
  attendance: ["attendance", "default"],
  lecture: ["attendance", "default"],
  exam: ["exam", "attendance", "default"],
  assignment: ["assignment", "attendance", "default"],
  grades: [],
  clinic: ["clinic", "default"],
  payment: ["default"],
  notice: ["default"],
  community: ["default"],
  staff: ["default"],
};

export function getTemplatePresetsForCategory(category: TemplateCategory): ProvidedTemplatePreset[] {
  const categories = CATEGORY_FALLBACKS[category] ?? [category, "default"];
  return PRESETS.filter((preset) => categories.includes(preset.category));
}

export function toPersistedTemplateCategory(category: TemplateCategory): MessageTemplateCategory {
  if (category === "student") return "default";
  if (category === "default") return "default";
  return category as MessageTemplateCategory;
}

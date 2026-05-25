import type { MessageTemplateCategory } from "../api/messages.api";
import type { TemplateCategory } from "./templateBlocks";
import { DEFAULT_GRADES_PRESET_BODY, DEFAULT_GRADES_PRESET_ID } from "@/shared/messaging/gradeTemplatePreset";

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
    id: DEFAULT_GRADES_PRESET_ID,
    category: "grades",
    name: "수업 결과 기본형",
    description: "1차 시험과 재시험 이력을 자연스럽게 모두 안내합니다.",
    recommended: true,
    tags: ["추천", "재시험 이력"],
    body: DEFAULT_GRADES_PRESET_BODY,
  },
  {
    id: "grades.retake-focused",
    category: "grades",
    name: "재시험 이력 강조형",
    description: "커트라인, 1차 결과, 재시험 결과를 분리해서 보여줍니다.",
    tags: ["재시험", "이력"],
    body: [
      "안녕하세요.",
      "#{학생이름}님 성적 이력 안내드립니다.",
      "#{강의명} · #{차시명}",
      "",
      "[시험 이력]",
      "#{시험이력}",
      "",
      "[정리]",
      "#{전체요약}",
      "",
      "재시험이 있는 경우 1차 결과와 재시험 결과를 함께 확인해 주세요.",
    ].join("\n"),
  },
  {
    id: "grades.parent-friendly",
    category: "grades",
    name: "보호자 안내형",
    description: "성적과 보강 여부를 차분한 문장으로 안내합니다.",
    tags: ["학부모", "상세"],
    body: [
      "안녕하세요.",
      "#{학생이름}님 #{강의명} · #{차시명} 수업 결과입니다.",
      "",
      "#{시험성적}",
      "",
      "학생별 보강 및 재시험 이력을 반영한 안내입니다.",
      "가정에서도 확인 부탁드립니다.",
    ].join("\n"),
  },
  {
    id: "grades.compact",
    category: "grades",
    name: "짧은 안내형",
    description: "필수 성적 정보만 짧게 전달합니다.",
    tags: ["짧게"],
    body: [
      "#{학생이름}님 #{강의명} · #{차시명} 성적 안내입니다.",
      "",
      "#{시험성적}",
    ].join("\n"),
  },
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
  exam: ["grades", "default"],
  assignment: ["grades", "default"],
  grades: ["grades", "default"],
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

export function getDefaultTemplatePreset(category: TemplateCategory): ProvidedTemplatePreset | null {
  const presets = getTemplatePresetsForCategory(category);
  return presets.find((preset) => preset.recommended && preset.category === category)
    ?? presets.find((preset) => preset.category === category)
    ?? presets.find((preset) => preset.recommended)
    ?? presets[0]
    ?? null;
}

export function getDefaultTemplatePresetBody(category: TemplateCategory): string {
  return getDefaultTemplatePreset(category)?.body ?? "";
}

export function toPersistedTemplateCategory(category: TemplateCategory): MessageTemplateCategory {
  if (category === "student") return "default";
  if (category === "default") return "default";
  return category as MessageTemplateCategory;
}

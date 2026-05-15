import type { MessageTemplateCategory } from "../api/messages.api";
import type { TemplateCategory } from "../constants/templateBlocks";

export type TemplateQualitySeverity = "blocker" | "warning";

export type TemplateQualityIssue = {
  id: string;
  severity: TemplateQualitySeverity;
  title: string;
  detail: string;
};

type LintInput = {
  body: string;
  renderedBody?: string;
  blockCategory: TemplateCategory;
  templateCategory?: MessageTemplateCategory;
  templateName?: string;
  extraVars?: Record<string, string>;
};

const SUPPORTED_FIXED_VARS = new Set([
  "학생이름",
  "학생이름2",
  "학생이름3",
  "학원명",
  "학원이름",
  "사이트링크",
  "날짜",
  "시간",
  "강의명",
  "차시명",
  "강의날짜",
  "강의시간",
  "시험명",
  "성적",
  "과제명",
  "시험성적",
  "과제성적",
  "시험목록",
  "과제목록",
  "전체요약",
  "시험총점",
  "시험총만점",
  "숙제완성도",
  "클리닉명",
  "장소",
  "클리닉날짜",
  "클리닉시간",
  "클리닉합불",
  "도착시간",
  "클리닉기존일정",
  "클리닉변동사항",
  "클리닉수정자",
  "게시글제목",
  "답변요약",
  "상담유형",
  "내용",
  "선생님메모",
  "직원명",
  "부서",
  "직급",
  "급여기간",
  "급여금액",
  "경비금액",
  "근무시간",
  "근무일수",
]);

const TEMPLATE_CATEGORY_FALLBACKS: Record<TemplateCategory, MessageTemplateCategory[]> = {
  default: ["default"],
  student: ["default"],
  signup: ["signup", "default"],
  attendance: ["attendance", "lecture", "default"],
  lecture: ["lecture", "attendance", "default"],
  exam: ["exam", "grades", "default"],
  assignment: ["assignment", "grades", "default"],
  grades: ["grades", "exam", "assignment", "default"],
  clinic: ["clinic", "default"],
  payment: ["payment", "default"],
  notice: ["notice", "default"],
  community: ["community", "default"],
  staff: ["staff", "default"],
};

function extractVars(text: string): string[] {
  const matches = text.match(/#\{([^}]+)\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -1).trim()).filter(Boolean))];
}

function isSupportedVar(name: string, extraVars?: Record<string, string>): boolean {
  if (SUPPORTED_FIXED_VARS.has(name)) return true;
  if (extraVars && Object.prototype.hasOwnProperty.call(extraVars, name)) return true;
  if (/^(시험|과제)\d+(명|만점)?$/.test(name)) return true;
  return false;
}

function findDuplicateLabelLine(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const normalized = line
      .replace(/^[\s*\-•·]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    const m = normalized.match(/^([^:\n]{1,16}):\s*\1\s*:/);
    if (m) return line.trim();
  }
  return null;
}

function hasHardcodedDate(text: string): boolean {
  return /(?:20\d{2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2})|(?:\d{1,2}\s*월\s*\d{1,2}\s*일)|(?:\d{1,2}\s*[./]\s*\d{1,2}\s*\([^)]+\))/.test(text);
}

function hasHardcodedScore(text: string): boolean {
  return /(?:^|[^\w#])\d{1,3}\s*\/\s*\d{1,3}(?:\s*점)?(?:$|[^\w}])/.test(text);
}

function hasFillPlaceholder(text: string): boolean {
  return /\(여기에\s*[^)]*입력하세요\)|\[여기에\s*[^\]]*입력\]|TODO|TBD/i.test(text);
}

export function lintAlimtalkTemplateQuality(input: LintInput): TemplateQualityIssue[] {
  const body = input.body || "";
  const renderedBody = input.renderedBody || body;
  const issues: TemplateQualityIssue[] = [];
  const push = (issue: TemplateQualityIssue) => {
    if (!issues.some((x) => x.id === issue.id)) issues.push(issue);
  };

  const unknownVars = extractVars(body).filter((name) => !isSupportedVar(name, input.extraVars));
  if (unknownVars.length > 0) {
    push({
      id: "unknown-vars",
      severity: "blocker",
      title: "지원하지 않는 변수가 있습니다",
      detail: unknownVars.map((v) => `#{${v}}`).join(", "),
    });
  }

  if (hasFillPlaceholder(body) || hasFillPlaceholder(renderedBody)) {
    push({
      id: "fill-placeholder",
      severity: "blocker",
      title: "입력 안내 문구가 남아 있습니다",
      detail: "(여기에 ... 입력하세요) 같은 문구를 실제 안내로 바꾼 뒤 발송하세요.",
    });
  }

  const duplicateLine = findDuplicateLabelLine(renderedBody);
  if (duplicateLine) {
    push({
      id: "duplicate-label",
      severity: "warning",
      title: "라벨이 중복된 줄이 보입니다",
      detail: duplicateLine,
    });
  }

  if (input.blockCategory === "grades" && hasHardcodedScore(body)) {
    push({
      id: "hardcoded-score",
      severity: "warning",
      title: "점수가 정적으로 입력된 것 같습니다",
      detail: "성적 발송은 #{시험목록}, #{시험성적}, #{시험1}/#{시험1만점} 같은 변수를 쓰는 편이 안전합니다.",
    });
  }

  if (["grades", "attendance", "lecture", "exam", "assignment", "clinic"].includes(input.blockCategory) && hasHardcodedDate(body)) {
    push({
      id: "hardcoded-date",
      severity: "warning",
      title: "날짜가 정적으로 입력된 것 같습니다",
      detail: "차시가 바뀌어도 남을 수 있으니 #{날짜}, #{강의날짜}, #{클리닉날짜} 변수 사용을 확인하세요.",
    });
  }

  const lectureName = (input.extraVars?.["강의명"] || input.extraVars?.["강의"] || "").trim();
  if (
    lectureName
    && ["grades", "attendance", "lecture", "exam", "assignment"].includes(input.blockCategory)
    && /(?:강의|수업|공지|반|중|고)/.test(body)
    && !body.includes("#{강의명}")
    && !body.includes(lectureName)
  ) {
    push({
      id: "lecture-name-mismatch",
      severity: "warning",
      title: "강의명이 정적으로 적혀 있을 수 있습니다",
      detail: `현재 강의명 "${lectureName}" 이 본문에 없고 #{강의명} 변수도 없습니다.`,
    });
  }

  if (input.templateCategory && input.templateCategory !== input.blockCategory) {
    const allowed = TEMPLATE_CATEGORY_FALLBACKS[input.blockCategory] ?? [input.blockCategory];
    if (!allowed.includes(input.templateCategory)) {
      push({
        id: "category-mismatch",
        severity: "warning",
        title: "진입 도메인과 양식 카테고리가 다릅니다",
        detail: `${input.blockCategory} 화면에서 ${input.templateCategory} 양식을 사용 중입니다${input.templateName ? `: ${input.templateName}` : ""}.`,
      });
    }
  }

  return issues;
}

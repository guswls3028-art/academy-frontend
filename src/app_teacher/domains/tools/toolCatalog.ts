export type TeacherToolCategory = "수업 준비" | "수업 진행";
export type TeacherToolStatus = "beta" | "stable";
export type TeacherToolIcon = "solver" | "timer";

export type TeacherToolDefinition = {
  id: string;
  title: string;
  description: string;
  path: string;
  category: TeacherToolCategory;
  status: TeacherToolStatus;
  icon: TeacherToolIcon;
  keywords: string[];
};

export const TEACHER_TOOL_CATEGORIES: TeacherToolCategory[] = [
  "수업 준비",
  "수업 진행",
];

export const TEACHER_TOOLS: TeacherToolDefinition[] = [
  {
    id: "problem-solver",
    title: "AI 풀이·해설",
    description: "문제 사진을 올리면 정답 근거와 단계별 해설 초안을 만듭니다.",
    path: "/teacher/tools/problem-solver",
    category: "수업 준비",
    status: "beta",
    icon: "solver",
    keywords: ["문제", "사진", "풀이", "해설", "정답", "AI"],
  },
  {
    id: "stopwatch",
    title: "타이머",
    description: "수업 시간을 재고 랩을 기록하거나 PC용 타이머를 받습니다.",
    path: "/teacher/tools/stopwatch",
    category: "수업 진행",
    status: "stable",
    icon: "timer",
    keywords: ["시간", "스톱워치", "랩", "수업", "PC"],
  },
];

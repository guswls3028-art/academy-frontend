/** Shared locations for workspace section entry and parent navigation. */
export const WORKSPACE_SECTIONS = [
  {
    id: "learning", title: "학습·운영", to: "/workspace/learning",
    description: "시험과 성적, 수업 영상과 안내를 관리합니다. 필요한 업무를 선택하세요.",
    iconPath: "M4 4h16v16H4zM4 10h16M10 10v10",
    destinations: {
      "/workspace/exams": "시험을 준비하고 문항과 응시 현황을 확인합니다.",
      "/workspace/results": "제출된 답안을 채점하고 학생별 결과를 확인합니다.",
      "/workspace/videos": "수업 영상을 올리고 시청 진도를 확인합니다.",
      "/workspace/message": "학생별 안내를 미리 확인한 뒤 보내고 발송 결과를 확인합니다.",
      "/workspace/storage": "수업 자료를 보관하고 필요한 파일을 찾습니다.",
    } as Record<string, string>,
  },
  {
    id: "management", title: "관리", to: "/workspace/management",
    description: "수납, 학원 소통, 직원과 설정을 관리합니다. 필요한 업무를 선택하세요.",
    iconPath: "M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3",
    destinations: {
      "/workspace/fees": "청구 내역과 납부 상태를 확인합니다.",
      "/workspace/community": "공지와 게시글을 관리하고 질문·상담에 답변합니다.",
      "/workspace/tools": "수업 준비와 문서 작업에 필요한 도구를 선택합니다.",
      "/workspace/staff": "직원 정보와 근무·급여 기록을 관리합니다.",
      "/workspace/settings": "내 계정, 학원 정보와 홈페이지를 설정합니다.",
    } as Record<string, string>,
  },
] as const;

export function workspaceSectionForPath(pathname: string) {
  return WORKSPACE_SECTIONS.find(section => section.to === pathname
    || Object.keys(section.destinations).some(path => pathname === path || pathname.startsWith(path + "/")));
}

export const TEACHER_MENU_GROUP_IDS: Record<string, string> = {
  "오늘 업무": "today", "수업 운영": "classes", "자료·메시지": "resources",
  "관리자 전용": "account", "내 계정": "account", "지원": "help",
};

export type GuideBookScope = "admin" | "teacher" | "student";

export type GuideBookItem = {
  title: string;
  description: string;
  path?: string;
  actionLabel?: string;
};

export type GuideBookSection = {
  title: string;
  items: GuideBookItem[];
};

export type GuideBookPreset = {
  title: string;
  subtitle: string;
  fullGuidePath: string;
  fullGuideLabel: string;
  sections: GuideBookSection[];
};

const GUIDE_BOOK_PRESETS: Record<GuideBookScope, GuideBookPreset> = {
  admin: {
    title: "관리자 가이드북",
    subtitle: "처음엔 기본 세팅과 오늘 운영 흐름만 확인하세요.",
    fullGuidePath: "/admin/guide",
    fullGuideLabel: "관리자 전체 가이드",
    sections: [
      {
        title: "처음 세팅",
        items: [
          {
            title: "학생 1명으로 먼저 테스트",
            description: "학생 등록, 강의 배정, 학생 로그인까지 한 번만 먼저 확인합니다.",
            path: "/admin/students",
            actionLabel: "학생 관리",
          },
          {
            title: "강의와 차시를 기준으로 운영",
            description: "출결, 시험, 영상, 성적은 강의와 차시가 연결점입니다.",
            path: "/admin/lectures",
            actionLabel: "강의 관리",
          },
        ],
      },
      {
        title: "자주 쓰는 업무",
        items: [
          {
            title: "성적과 출력물 확인",
            description: "성적표, 클리닉 대상자, 테넌트별 출력물을 성적탭에서 처리합니다.",
            path: "/admin/results",
            actionLabel: "성적",
          },
          {
            title: "알림톡 결과 확인",
            description: "발송 후 성공, 실패, 대기 상태는 발송 내역에서 다시 봅니다.",
            path: "/admin/message/log",
            actionLabel: "발송 내역",
          },
        ],
      },
    ],
  },
  teacher: {
    title: "선생님 가이드북",
    subtitle: "수업 현장에서는 오늘 수업, 학생, 알림만 빠르게 봅니다.",
    fullGuidePath: "/teacher/guide",
    fullGuideLabel: "선생님 전체 가이드",
    sections: [
      {
        title: "오늘 수업",
        items: [
          {
            title: "대시보드에서 시작",
            description: "오늘 차시, 처리할 일, 알림 상태를 먼저 확인합니다.",
            path: "/teacher",
            actionLabel: "대시보드",
          },
          {
            title: "강의에서 출결과 성적 입력",
            description: "차시를 열고 출결, 제출 확인, 성적 입력으로 이어갑니다.",
            path: "/teacher/classes",
            actionLabel: "강의",
          },
        ],
      },
      {
        title: "학생 응대",
        items: [
          {
            title: "학생 검색 후 바로 처리",
            description: "학생을 찾아 상담 메모, 학부모 알림, 제출 현황을 확인합니다.",
            path: "/teacher/students",
            actionLabel: "학생",
          },
          {
            title: "발송 결과는 따로 확인",
            description: "보낸 알림톡은 발송 내역에서 성공/실패까지 확인합니다.",
            path: "/teacher/message-log",
            actionLabel: "발송 내역",
          },
        ],
      },
    ],
  },
  student: {
    title: "학생 가이드북",
    subtitle: "처음 로그인했다면 홈에서 오늘 할 일만 먼저 보면 됩니다.",
    fullGuidePath: "/student/guide",
    fullGuideLabel: "학생 전체 가이드",
    sections: [
      {
        title: "처음 확인",
        items: [
          {
            title: "홈에서 오늘 할 일 보기",
            description: "수업, 공지, 과제, 시험이 있으면 홈에 먼저 모입니다.",
            path: "/student/dashboard",
            actionLabel: "홈",
          },
          {
            title: "목록이 비어 있으면",
            description: "아직 선생님이 강의나 과제를 배정하지 않은 상태일 수 있습니다.",
          },
        ],
      },
      {
        title: "학습 흐름",
        items: [
          {
            title: "영상, 시험, 과제 제출",
            description: "하단 메뉴에서 필요한 기능만 하나씩 열어 확인합니다.",
            path: "/student/video",
            actionLabel: "영상",
          },
          {
            title: "성적과 클리닉 확인",
            description: "채점 후 점수, 오답, 보충 항목을 확인합니다.",
            path: "/student/grades",
            actionLabel: "성적",
          },
        ],
      },
    ],
  },
};

export function getGuideBookPreset(scope: GuideBookScope) {
  return GUIDE_BOOK_PRESETS[scope];
}

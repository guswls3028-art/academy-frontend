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
  "admin": {
    "title": "관리자 가이드북",
    "subtitle": "학생 등록부터 수업·평가·운영 마감까지 순서대로 확인하세요.",
    "fullGuidePath": "/workspace/guide",
    "fullGuideLabel": "관리자 전체 가이드",
    "sections": [
      {
        "title": "운영 시작",
        "items": [
          {
            "title": "학생 등록과 계정 안내",
            "description": "명부 등록·첫 수강 확정·계정 안내를 구분해 따라갑니다.",
            "path": "/workspace/guide?topic=register-student",
            "actionLabel": "등록 안내"
          },
          {
            "title": "강의·차시·수강생",
            "description": "수업 날짜와 학생 배정을 준비한 뒤 출결로 이어갑니다.",
            "path": "/workspace/guide?topic=create-lecture",
            "actionLabel": "수업 준비"
          }
        ]
      },
      {
        "title": "수업 이후",
        "items": [
          {
            "title": "시험·과제·성적",
            "description": "답안과 제출물을 확인하고 저장된 결과까지 검토합니다.",
            "path": "/workspace/guide?topic=create-exam",
            "actionLabel": "평가 안내"
          },
          {
            "title": "알림톡 발송과 결과",
            "description": "승인 문구·수신 대상·최종 성공과 실패를 확인합니다.",
            "path": "/workspace/guide?topic=send-message",
            "actionLabel": "발송 안내"
          }
        ]
      }
    ]
  },
  "teacher": {
    "title": "선생님 가이드북",
    "subtitle": "오늘 수업·학생·평가·소통을 한 흐름으로 확인하세요.",
    "fullGuidePath": "/workspace/mobile/guide",
    "fullGuideLabel": "선생님 전체 가이드",
    "sections": [
      {
        "title": "현장 업무",
        "items": [
          {
            "title": "오늘 수업과 학생",
            "description": "오늘 차시를 찾고 학생 상세와 메모를 확인합니다.",
            "path": "/workspace/mobile/guide?topic=today",
            "actionLabel": "오늘 업무"
          },
          {
            "title": "출결과 성적",
            "description": "차시에서 입력한 상태와 저장 결과를 확인합니다.",
            "path": "/workspace/mobile/guide?topic=attendance",
            "actionLabel": "출결 안내"
          }
        ]
      },
      {
        "title": "후속 확인",
        "items": [
          {
            "title": "알림톡 결과",
            "description": "대기·성공·실패를 확인하고 필요한 대상만 후속 처리합니다.",
            "path": "/workspace/mobile/guide?topic=messages",
            "actionLabel": "발송 안내"
          },
          {
            "title": "기능 찾기와 PC 업무",
            "description": "자료 제작·대량 입력·관리 기능으로 이어갑니다.",
            "path": "/workspace/mobile/guide?topic=full-workspace",
            "actionLabel": "전체 업무"
          }
        ]
      }
    ]
  },
  "student": {
    "title": "학생·학부모 가이드북",
    "subtitle": "학습·제출·예약부터 결과 확인까지 따라가세요.",
    "fullGuidePath": "/student/guide",
    "fullGuideLabel": "학생·학부모 전체 가이드",
    "sections": [
      {
        "title": "처음 이용",
        "items": [
          {
            "title": "로그인과 자녀 선택",
            "description": "본인 또는 선택한 자녀의 수업과 할 일을 확인합니다.",
            "path": "/student/guide?topic=daily-routine",
            "actionLabel": "시작 안내"
          },
          {
            "title": "영상과 수업",
            "description": "강의·차시에서 영상을 찾고 시청 상태를 확인합니다.",
            "path": "/student/guide?topic=watch-video",
            "actionLabel": "영상 안내"
          }
        ]
      },
      {
        "title": "제출과 결과",
        "items": [
          {
            "title": "과제 사진·동영상 제출",
            "description": "파일별 성공·실패와 다시 열린 제출 목록을 확인합니다.",
            "path": "/student/guide?topic=submit-assignment",
            "actionLabel": "제출 안내"
          },
          {
            "title": "클리닉 예약과 보충",
            "description": "신청·예약 확정·학습 통과를 구분해 확인합니다.",
            "path": "/student/guide?topic=check-clinic",
            "actionLabel": "예약 안내"
          }
        ]
      }
    ]
  }
};

export function getGuideBookPreset(scope: GuideBookScope) {
  return GUIDE_BOOK_PRESETS[scope];
}

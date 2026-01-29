// src/features/videos/audit/utils/eventLabels.ts

// 관리자 audit 전용 이벤트 라벨 매핑
// ⚠️ backend enum 변경 금지 (v1 exact match)

export const PLAYBACK_EVENT_LABELS: Record<string, string> = {
  VISIBILITY_HIDDEN: "탭 이탈",
  VISIBILITY_VISIBLE: "탭 복귀",

  FOCUS_LOST: "포커스 잃음",
  FOCUS_GAINED: "포커스 획득",

  SEEK_ATTEMPT: "구간 이동 시도",
  SPEED_CHANGE_ATTEMPT: "배속 변경 시도",

  FULLSCREEN_ENTER: "전체화면 진입",
  FULLSCREEN_EXIT: "전체화면 종료",

  PLAYER_ERROR: "재생 오류",
};

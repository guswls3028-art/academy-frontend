/**
 * E2E 공통 셀렉터 — 안정적인 선택자 우선
 */

// 사이드바 메뉴
export const sidebar = {
  community: 'a[href*="/community"], nav >> text=커뮤니티',
  lectures: 'a[href*="/lectures"], nav >> text=강의',
  clinic: 'a[href*="/clinic"], nav >> text=클리닉',
  videos: 'a[href*="/videos"], nav >> text=영상',
  students: 'a[href*="/students"], nav >> text=학생',
};

// 학생앱 탭바
export const studentTabbar = {
  home: '.stu-tabbar >> text=홈',
  video: '.stu-tabbar >> text=영상',
  schedule: '.stu-tabbar >> text=일정',
  notifications: '.stu-tabbar >> text=알림',
  more: '.stu-tabbar >> text=더보기',
};

// 토스트 메시지
export const toast = {
  success: '.Toastify__toast--success, [class*="toast"][class*="success"]',
  error: '.Toastify__toast--error, [class*="toast"][class*="error"]',
  any: '.Toastify__toast, [class*="toast"]',
};

// useConfirm 모달
export const confirmModal = {
  overlay: '[class*="confirmOverlay"], [class*="confirm-overlay"], [role="dialog"]',
  confirmBtn: '[class*="confirmBtn"], [class*="confirm-btn"], button >> text=확인',
  cancelBtn: '[class*="cancelBtn"], [class*="cancel-btn"], button >> text=취소',
  dangerBtn: 'button >> text=삭제',
};

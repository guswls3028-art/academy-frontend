/**
 * Hakwonplus 테스트 테넌트 (Tenant 1) 고정 테스트 데이터 SSOT
 *
 * 운영 데이터의 ID가 변경되면 이 파일만 수정하면 모든 테스트에 반영된다.
 * 새 테스트를 작성할 때는 가능한 한 helpers/data.ts의 동적 조회를 사용하되,
 * 실발송·특정 수강생 의존 테스트는 이 파일의 상수를 사용한다.
 */

/** 강의 113 / 차시 153 — 수강생 E2E메시지3139 포함, 메시징 실발송 테스트용 */
export const FIXTURES = {
  lectureId: 113,
  sessionId: 153,
} as const;

/** 강의 96 / 차시 158 — 성적 검증용 (verify-scores-fixes 등) */
export const FIXTURES_ALT = {
  lectureId: 96,
  sessionId: 158,
} as const;

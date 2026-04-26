/**
 * Hakwonplus 테스트 테넌트 (Tenant 1) 고정 테스트 데이터 SSOT
 *
 * 운영 데이터의 ID/번호가 변경되면:
 *   1) 이 파일의 default 값을 수정하거나,
 *   2) .env.e2e 에서 E2E_* 변수로 override.
 *
 * 새 테스트를 작성할 때는 가능한 한 helpers/data.ts 의 동적 조회를 사용하되,
 * 실발송·특정 수강생 의존 테스트는 이 파일의 상수를 사용한다.
 */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function strEnv(name: string, fallback: string): string {
  return (process.env[name] || "").trim() || fallback;
}

/** 강의 113 / 차시 153 — 수강생 E2E메시지3139 포함, 메시징 실발송 테스트용 */
export const FIXTURES = {
  lectureId: intEnv("E2E_LECTURE_ID", 113),
  sessionId: intEnv("E2E_SESSION_ID", 153),
} as const;

/** 강의 96 / 차시 158 — 성적 검증용 (verify-scores-fixes 등) */
export const FIXTURES_ALT = {
  lectureId: intEnv("E2E_LECTURE_ID_ALT", 96),
  sessionId: intEnv("E2E_SESSION_ID_ALT", 158),
} as const;

/**
 * 실발송 알림톡/SMS 수신자 SSOT
 *
 * - studentPhone: 학생 본인 (로그인 username 으로도 사용)
 * - parentPhone : 학부모 (알림톡 수신자, 트리거 발송 검증의 핵심 대상)
 * - studentName : 학생/수강생 이름 (UI 검색에 사용)
 * - studentPassword: 학생 로그인 비밀번호
 *
 * 변경 시: 운영 테스트 학생 정보 + 이 파일 default + 12번/04~09번/flows/* 의존 spec 모두 영향.
 * 가능하면 prod 데이터 변경 없이 .env.e2e override 로 대응.
 */
export const TEST_RECIPIENT = {
  studentName: strEnv("E2E_TEST_STUDENT_NAME", "0317테스트학생"),
  studentPhone: strEnv("E2E_TEST_STUDENT_PHONE", "01034137466"),
  parentPhone: strEnv("E2E_TEST_PARENT_PHONE", "01031217466"),
  studentPassword: strEnv("E2E_TEST_STUDENT_PASS", "0000"),
} as const;

/**
 * 테이블 컬럼 너비 단일진실 (SSOT)
 * @see docs/DESIGN_SSOT.md
 *
 * - 컬럼 너비는 이 파일만 정의. 다른 곳에 중복 정의 금지.
 * - 학생·출결 계열: STUDENTS_TABLE_COL. 그 외: TABLE_COL에서 키 선택.
 * - tableLayout: "fixed" + <colgroup> 권장.
 */
export const TABLE_COL = {
  /** 체크박스 전용 (학생 테이블 기준) */
  checkbox: 28,
  /** 이름·주요 식별 컬럼 (딱지+이름 등) — 학생 테이블 기준 */
  name: 140,
  /** 출결/강의 목록 등 이름만 짧게 (레거시·모달용, 신규는 name 사용) */
  nameCompact: 116,
  /** 모달 내 이름 열 — nameCompact보다 아주 조금 넓게 */
  nameCompactModal: 124,
  /** 전화번호 (학부모/학생 동일 — 학생 테이블 기준) */
  phone: 130,
  /** 모달 내 전화 열 — phone보다 좁게, 전화번호 잘리지 않도록 */
  phoneCompact: 108,
  /** 반, 2글자 뱃지 등 */
  short: 65,
  /** 모달 내 학년 열 — short보다 약간 넓게 (학년 컬럼 가시성) */
  shortModal: 72,
  /** 날짜, 학교, 시급 등 */
  medium: 110,
  /** 모달 내 학교 이름 열 — medium보다 좁게 (학년 열 가시성) */
  mediumModal: 88,
  /** 전화·날짜 약간 넓게 */
  mediumAlt: 120,
  /** 태그 칸 */
  tag: 100,
  /** 상태(활성/비활성 등) */
  status: 92,
  /** 출결 2글자 뱃지 등 */
  statusBadge: 68,
  /** 차시 한 칸 (1차시, 2차시…) */
  sessionCol: 34,
  /** 메모·비고 */
  memo: 280,
  /** 과제·입력 영역 등 */
  wide: 360,
  /** 출결 변경 10뱃지 등 넓은 영역 */
  extraWide: 460,
  /** 관리(수정/삭제) 버튼 */
  actions: 72,
  /** 강의명·제목 등 */
  title: 192,
  /** 과목·항목 등 */
  subject: 140,
  /** 강의 시간·근무시간 등 */
  timeRange: 160,
  /** 기간 (시작일~종료일) */
  dateRange: 200,
} as const;

/** 학생 테이블 기준 SSOT — 체크박스·이름·학부모전화·학생전화 동일 크기/양식. 출결/강의출결/세션출결 등에서 사용 */
export const STUDENTS_TABLE_COL = {
  checkbox: TABLE_COL.checkbox,
  name: TABLE_COL.name,
  parentPhone: TABLE_COL.phone,
  studentPhone: TABLE_COL.phone,
  sessionCol: TABLE_COL.sessionCol,
  statusBadge: TABLE_COL.statusBadge,
  attendanceChange: TABLE_COL.extraWide,
  memo: TABLE_COL.memo,
} as const;

export type TableColKey = keyof typeof TABLE_COL;

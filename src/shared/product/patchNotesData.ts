// PATH: src/shared/product/patchNotesData.ts
// 최근 운영 릴리스 요약.
// Truth source: backend/docs/releases/README.md + 각 봉인 릴리스 문서.
// 이 화면에는 production-deployed / GO로 확인된 릴리스만 싣는다.

export type NoteCategory = "new" | "fix" | "improve" | "security";

export interface PatchEntry {
  text: string;
  category: NoteCategory;
}

export interface PatchNote {
  version: string;
  codename: string;
  date: string;
  summary: string;
  entries: PatchEntry[];
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: "v1.8.1",
    codename: "알림톡 운영 체계 단순화",
    date: "2026.07.14",
    summary: "알림톡 발송 화면과 승인 양식, 권한, 학원별 비용 귀속을 하나의 운영 기준으로 정리했습니다.",
    entries: [
      { category: "improve", text: "메시지 화면을 저장 문구, 자동발송 설정, 발송 이력, 운영 상태 중심으로 단순화했습니다." },
      { category: "improve", text: "발송 수단을 알림톡으로 명확히 고정하고, 카카오 승인 공용 양식과 편집 가능한 문구를 구분해 표시합니다." },
      { category: "fix", text: "자동발송 스위치 되돌림, 준비 상태와 오류 안내, 예약 한도 표시, 모바일 화면 밀도를 정비했습니다." },
      { category: "fix", text: "새 배포 직후 화면 파일이 일시적으로 어긋나는 경우 제한된 횟수 안에서 자동 복구하도록 보강했습니다." },
      { category: "security", text: "수동 발송과 진단 권한, 수신자와 미리보기 범위를 제한하고 민감한 진단 정보는 가려서 보여줍니다." },
      { category: "security", text: "발송 요청의 학원 정보를 서명으로 검증하고 비용, 잔액, 환불을 실제 요청 학원에 귀속하도록 강화했습니다." },
    ],
  },
  {
    version: "v1.8.0",
    codename: "서비스 전반 안정성 강화",
    date: "2026.07.14",
    summary: "로그인부터 결제, 메시지, 영상, 클리닉까지 핵심 업무의 권한과 상태 변경 규칙을 전면 점검했습니다.",
    entries: [
      { category: "improve", text: "로그인 장애 복구, 모바일 직원 관리, 시험 묶음 관리, 영상 정렬과 재생, 메시지 피드백을 개선했습니다." },
      { category: "improve", text: "결제, 근태, 메시지, 영상 순서처럼 동시에 수정될 수 있는 업무를 안전하게 처리하도록 보강했습니다." },
      { category: "fix", text: "구독 결제의 처리 중 상태, 부분 환불, 예약 해지 복원과 기간 계산의 불일치를 바로잡았습니다." },
      { category: "security", text: "학생 영상과 클리닉은 같은 학원 소속과 유효한 수강 관계가 확인되지 않으면 접근할 수 없도록 강화했습니다." },
      { category: "security", text: "로그인 과다 시도 방어, 결제 키 암호화, 테넌트 교차 접근 회귀 검사를 추가했습니다." },
    ],
  },
  {
    version: "v1.7.0",
    codename: "운영 인프라와 비용 정리",
    date: "2026.07.10",
    summary: "실제 서비스 경로에서 사용하지 않던 자원을 제거하고 운영 상태 판단 기준을 현재 구조에 맞췄습니다.",
    entries: [
      { category: "improve", text: "API와 작업 서버가 직접 데이터베이스에 연결하는 현재 구조에 맞춰 사용하지 않던 RDS Proxy를 제거했습니다." },
      { category: "improve", text: "별도 운영 서버의 인스턴스 크기를 실제 사용량에 맞게 조정하면서 고정 IP와 저장 공간은 유지했습니다." },
      { category: "fix", text: "직접 데이터베이스 연결을 정상 상태로 판정하도록 운영 점검과 재해 복구 안내를 갱신했습니다." },
    ],
  },
  {
    version: "v1.6.8",
    codename: "계정 안내 알림톡 일관성 강화",
    date: "2026.07.09",
    summary: "학생과 학부모의 계정 생성·변경 안내가 누락되지 않도록 발송과 저장을 하나의 처리로 묶었습니다.",
    entries: [
      { category: "improve", text: "학생 생성, 일괄 등록, 비밀번호·아이디·연락처 변경에서 필요한 계정 안내를 자동 발송합니다." },
      { category: "fix", text: "필수 계정 안내가 발송되지 않으면 계정 변경도 함께 되돌려 안내와 실제 계정 상태가 어긋나지 않게 했습니다." },
      { category: "fix", text: "학생 연락처가 비어 있는 경우 학생과 학부모 계정을 분리 생성하고, 연락처 등록 시 학생에게 안내합니다." },
      { category: "security", text: "운영 검증용 실제 알림톡은 승인된 통제 번호로만 발송되도록 안전장치를 적용했습니다." },
    ],
  },
  {
    version: "v1.6.6",
    codename: "성적 추이 분석과 Ymath 운영 모드",
    date: "2026.07.09",
    summary: "학원별 성적 추이 화면을 추가하고 Ymath의 익명 성적 게시 운영 방식을 반영했습니다.",
    entries: [
      { category: "new", text: "선생님 화면에 운영 분석, 학생 화면에 추이 분석 패널을 추가했습니다." },
      { category: "new", text: "Ymath에 익명 성적 게시, 정규 클리닉, 섹션 운영 모드를 적용했습니다." },
      { category: "improve", text: "관리자 트리 도구와 펼치기·접기 동작을 통일했습니다." },
      { category: "fix", text: "모바일 설정 화면에서 긴 한국어 운영 모드 이름이 잘리거나 글자 단위로 깨지는 문제를 수정했습니다." },
      { category: "security", text: "성적 분석 결과는 요청한 학원의 데이터만 조회하도록 학원 범위 검증을 적용했습니다." },
    ],
  },
  {
    version: "v1.6.5",
    codename: "YouTube 링크 영상 지원",
    date: "2026.07.08",
    summary: "파일 업로드 영상과 YouTube 링크 영상을 같은 강의 목록에서 등록하고 시청할 수 있습니다.",
    entries: [
      { category: "new", text: "선생님이 영상 업로드 창에서 YouTube 링크를 등록하고 미리보기를 확인할 수 있습니다." },
      { category: "new", text: "학생은 기존 영상 학습 화면과 재생목록 안에서 YouTube 영상을 이어서 시청할 수 있습니다." },
      { category: "improve", text: "업로드 영상과 YouTube 영상을 출처 배지로 구분하고, YouTube 재생은 제공자 기본 조작 버튼을 사용합니다." },
      { category: "fix", text: "같은 제목 뒤에 번호가 붙은 영상이 인코딩 완료 순서와 무관하게 번호 순으로 정렬되도록 수정했습니다." },
      { category: "security", text: "YouTube 주소에서 검증된 영상 ID만 추출해 재생 주소를 만들고, 학원 범위 밖 강의에는 등록할 수 없도록 했습니다." },
    ],
  },
];

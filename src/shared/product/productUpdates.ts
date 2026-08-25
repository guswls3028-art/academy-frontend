export type ProductUpdateKind = "new" | "improve" | "fix";

export type ProductUpdate = {
  id: string;
  date: string;
  title: string;
  summary: string;
  audience: string[];
  availability: string;
  highlights: Array<{ kind: ProductUpdateKind; text: string }>;
};

export const PRODUCT_UPDATE_CADENCE = {
  dayLabel: "매주 화요일",
  timeLabel: "오전 9시",
  note: "운영에 실제 반영된 사용자 체감 변경만 정리합니다.",
} as const;

export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "2026-08-25-weekly-operations",
    date: "2026-08-25",
    title: "수업부터 지원·정산까지 이어지는 운영 업데이트",
    summary:
      "채점 후 판단, 클리닉 진행, 제출물 확인, 영상·과제 운영, 계정 지원과 직원 정산처럼 현장에서 이어지는 업무를 더 빠르고 안전하게 처리할 수 있도록 정리했습니다.",
    audience: ["원장·관리자", "선생님·조교", "학생·학부모"],
    availability: "전체 제공 · 기능별 권한 및 Beta 표시",
    highlights: [
      { kind: "new", text: "현장 학생과 여러 시간대·강의의 미완료 항목을 한곳에서 처리하는 클리닉 출석·진행 콘솔" },
      { kind: "new", text: "학생 한 명 또는 여러 명의 누적 성적을 요약·상세 PDF로 만드는 개인 성적표" },
      { kind: "new", text: "미식별 제출물의 이미지 미리보기·원본 확인과 검증된 결과 내보내기" },
      { kind: "new", text: "사진을 바탕으로 학생 연결·수강·온라인 출석·알림톡 작업을 확인 후 반영하는 선생님 업무 도우미 Beta" },
      { kind: "new", text: "직원별 근무시간·급여·마감 상태와 확인 필요 인원을 비교하는 월 전체 급여판" },
      { kind: "improve", text: "사진·동영상을 함께 여러 개 제출하고 파일별 진행·부분 실패·재시도를 확인하는 과제 제출" },
      { kind: "improve", text: "여러 영상을 한 번에 올릴 때 제목과 학생 재생 순서를 업로드 전에 정하고 처리 후에도 그대로 유지" },
      { kind: "improve", text: "학생이 보는 화면을 교직원이 안전하게 확인하고 학생 활동과 지원 활동을 구분해 보는 지원 기록" },
      { kind: "improve", text: "알림톡 발송 내역을 카카오형 미리보기와 처리 시각·상태·공급자 증거로 나눠 확인" },
      { kind: "improve", text: "한셀 포함 학생 Excel의 정상 행은 계속 처리하고 신규·복원·제외·확인 필요 결과를 행별로 안내" },
      { kind: "fix", text: "아이폰 Safari를 포함한 로그인·토큰 갱신과 초기 비밀번호 안내가 다른 계정·지원 세션과 섞이던 문제 수정" },
      { kind: "fix", text: "OMR 답안지 미리보기 잘림, 영상 일괄 업로드 순서 변경, 클리닉 대상 중복·잘못된 완료 처리를 보정" },
    ],
  },
  {
    id: "2026-08-22-alimtalk-operations",
    date: "2026-08-22",
    title: "알림톡 공지와 자동발송 운영 안정화",
    summary:
      "학원 전체 알림톡 상태를 직접 확인하고 제어하며, 저장해 둔 문구로 결과 없이 운영 공지를 보내는 흐름을 더 빠르고 분명하게 정리했습니다.",
    audience: ["원장", "관리자", "선생님", "조교"],
    availability: "전체 제공",
    highlights: [
      { kind: "new", text: "대표·관리자가 직접 켜고 끄는 알림톡 전체 사용 상태" },
      { kind: "new", text: "홈페이지 주소·영상·일정·출결을 결과 없이 보내는 수업·운영 공지" },
      { kind: "improve", text: "어느 화면에서 저장했든 내 알림톡 문구를 다른 공지 유형에서도 다시 사용" },
      { kind: "fix", text: "임시 비밀번호 변경창과 조교 출근창이 겹쳐 입력이 뒤 화면으로 가던 문제 수정" },
      { kind: "fix", text: "학생 명부의 반 정렬과 공급자 한도·잔액 거절 상태 처리 안정화" },
    ],
  },
  {
    id: "2026-08-22-classroom-operations",
    date: "2026-08-22",
    title: "수업 운영이 한눈에 보이는 결과 화면",
    summary:
      "수업 중 성적이 나온 뒤 방향·보충·재시험 기준을 더 빠르게 판단하고, 학생 확인과 출결·클리닉 동선을 안정적으로 이어갈 수 있습니다.",
    audience: ["원장", "선생님", "학생"],
    availability: "전체 제공",
    highlights: [
      { kind: "new", text: "수업 방향·컷 검토·보충 우선 문항을 먼저 보여주는 시험 결과 60초 브리핑" },
      { kind: "new", text: "분포·문항 우선순위·학생별 등수·답안을 한 파일로 정리한 수업 분석 Excel" },
      { kind: "new", text: "관리자가 3색을 지정하고 학생이 수업 종료 시 바로 보여줄 수 있는 클리닉 패스카드" },
      { kind: "improve", text: "성적 화면의 학생 이름에서 학생 정보로 바로 이어지는 연결과 출결 명단 순서 고정" },
      { kind: "improve", text: "출석은 선택한 상태만 강조하고 부재·퇴원처럼 주의가 필요한 상태는 더 분명하게 표시" },
    ],
  },
  {
    id: "2026-08-21-tenant-onboarding",
    date: "2026-08-21",
    title: "새 학원 등록 절차 안정화",
    summary:
      "도메인과 이용기간을 먼저 확인한 뒤 대표 계정을 등록하도록 순서를 정리해, 준비가 덜 된 계정이나 일부 정보만 남는 상황을 막았습니다.",
    audience: ["플랫폼 운영자"],
    availability: "운영 도구",
    highlights: [
      { kind: "improve", text: "도메인·브랜딩·이용기간 확인 후 대표 계정을 등록하는 단계별 안내" },
      { kind: "fix", text: "학원 정보만 생성되고 대표 계정 등록이 실패해 일부 상태가 남던 흐름 제거" },
      { kind: "fix", text: "대표 계정 임시 비밀번호 길이와 생성 결과를 저장 전에 다시 확인" },
    ],
  },
  {
    id: "2026-07-30",
    date: "2026-07-30",
    title: "처음 시작하는 계정 안내",
    summary:
      "새로 만든 계정이 로그인 직후 자신의 역할과 다음 이동 경로를 확인하고, 필요한 설정으로 바로 갈 수 있습니다.",
    audience: ["전체 사용자"],
    availability: "전체 제공",
    highlights: [
      { kind: "new", text: "원장·관리자·선생님·직원·학생·학부모 역할별 첫 화면 안내" },
      { kind: "new", text: "내 역할에 맞는 설정과 업무 화면으로 바로 이동하는 버튼" },
      { kind: "improve", text: "안내 저장에 실패하면 완료 처리하지 않고 다시 시도할 수 있는 안전한 오류 상태" },
    ],
  },
  {
    id: "2026-07-29-teacher-tools",
    date: "2026-07-29",
    title: "선생님 도구함 Beta",
    summary:
      "수업 준비 중 막히는 문제를 입력하면 풀이와 설명 초안을 받아보고, 기존 도구와 함께 한곳에서 찾을 수 있습니다.",
    audience: ["원장", "선생님"],
    availability: "Beta",
    highlights: [
      { kind: "new", text: "선생님 업무 화면의 도구함과 문제 풀이·해설 Beta" },
      { kind: "improve", text: "입력 중 상태, 결과 없음, 재시도와 오류 안내를 같은 흐름으로 정리" },
      { kind: "fix", text: "테넌트와 권한 경계를 벗어난 요청은 결과를 만들지 않도록 차단" },
    ],
  },
  {
    id: "2026-07-29-grading",
    date: "2026-07-29",
    title: "시험 생성과 혼합 채점",
    summary:
      "선택형과 답변형이 섞인 시험을 만들고, OMR 결과를 보존하면서 필요한 문항만 직접 채점할 수 있습니다.",
    audience: ["원장", "선생님"],
    availability: "전체 제공",
    highlights: [
      { kind: "new", text: "선택형·답변형·혼합형 시험 생성과 문항별 직접 채점" },
      { kind: "new", text: "정오 입력, 부분점수, 결시와 오답노트 지정까지 한 표에서 확인" },
      { kind: "improve", text: "미리보기 후 전체 확정하며 다른 화면의 수정과 충돌하면 저장하지 않음" },
    ],
  },
  {
    id: "2026-07-29-score-operations",
    date: "2026-07-29",
    title: "성적 확인과 보정 기록",
    summary:
      "성적 입력 이후의 변경 이유와 추이를 더 분명하게 확인하고, 학생별 결과를 안정적으로 이어서 관리합니다.",
    audience: ["원장", "선생님"],
    availability: "전체 제공",
    highlights: [
      { kind: "new", text: "학생별 보정 메모와 점수 변화 추이 확인" },
      { kind: "improve", text: "성적 보고서와 화면의 합격·미달 판단 기준 통일" },
      { kind: "fix", text: "문항 표시 번호와 실제 저장 번호가 어긋나는 사례 수정" },
    ],
  },
  {
    id: "2026-07-27",
    date: "2026-07-27",
    title: "운영 문의함",
    summary:
      "버그 제보와 개선 의견을 비공개로 보내고, 답변과 처리 상태를 한곳에서 다시 확인할 수 있습니다.",
    audience: ["원장", "선생님"],
    availability: "전체 제공",
    highlights: [
      { kind: "new", text: "보낸 문의와 학원플러스 답변을 한 흐름에서 확인" },
      { kind: "new", text: "버그 제보·개선 의견에 이미지와 파일 첨부" },
      { kind: "improve", text: "문의별 처리 상태와 답변 대기 여부를 더 분명하게 표시" },
    ],
  },
];

export const LATEST_PRODUCT_UPDATE = PRODUCT_UPDATES[0];

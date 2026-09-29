/**
 * 선생앱(관리자) 가이드 — 업무 흐름 중심 워크플로우 데이터
 * 각 워크플로우: 단계별 텍스트 설명 + 인터랙티브 투어 스텝
 */
import { NavIcon } from "@admin/layout/adminNavConfig";
import type { GuideWorkflow } from "@/shared/ui/guide/types";

export const ADMIN_WORKFLOWS: GuideWorkflow[] = [
  {
    id: "register-student",
    icon: <NavIcon d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 8l3 3 6-6M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />,
    title: "학생 등록하기",
    summary:
      "학생 계정을 준비하고 학부모 로그인 기준까지 확인하는 첫 단계입니다.",
    steps: [
      { title: "학생 관리로 이동", description: "사이드바에서 '학생'을 클릭합니다. 처음에는 테스트 학생 1명으로 흐름을 확인하세요." },
      { title: "직접 등록 또는 가입 신청 승인", description: "학생을 선생님이 직접 추가할 수 있고, 학생 회원가입 신청이 들어온 경우에는 승인 후 사용할 수 있습니다." },
      { title: "엑셀 일괄등록은 소량으로 먼저 확인", description: "양식을 내려받아 1~2명만 넣어 업로드해 보세요. 업로드 후에는 우상단 작업박스에서 완료 상태를 확인합니다." },
      { title: "아이디와 초기 비밀번호 준비", description: "학생에게 전달할 로그인 아이디와 초기 비밀번호를 저장합니다. 학부모는 등록된 휴대폰 번호 기준으로 로그인합니다." },
      { title: "강의 배정", description: "학생 상세에서 수강할 강의를 연결합니다. 강의가 있어야 출결, 시험, 영상, 성적 흐름이 이어집니다." },
      { title: "로그인 확인", description: "학생 계정으로 한 번 로그인해 홈 화면이 열리는지 확인한 뒤 전체 학생을 등록하면 안전합니다." },
    ],
    tourPath: "/workspace/students",
    tourSteps: [
      {
        selector: '[data-guide="students-add-btn"]',
        title: "학생 추가 버튼",
        description: "이 버튼을 눌러 새 학생을 등록하세요. 이름, 아이디, 비밀번호를 입력하면 됩니다.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="students-search"]',
        title: "학생 검색",
        description: "이름, 아이디, 전화번호, 학교로 학생을 빠르게 찾을 수 있어요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="students-table"]',
        title: "학생 목록",
        description: "등록된 학생이 여기에 표시됩니다. 클릭하면 상세 정보와 수강 강의를 관리할 수 있어요.",
        placement: "top",
      },
    ],
  },
  {
    id: "create-lecture",
    icon: <NavIcon d="M4 4h16v12H4zM8 20h8M12 16v4" />,
    title: "강의 개설하기",
    summary:
      "학생에게 배정할 강의를 먼저 만듭니다. 차시와 수강생은 저장 후 연결합니다.",
    steps: [
      { title: "강의 관리로 이동", description: "사이드바에서 '강의'를 클릭합니다." },
      { title: "강의 추가", description: "'강의 추가' 버튼으로 반 이름, 과목, 담당 선생님, 수업 요일을 정합니다." },
      { title: "저장 결과 확인", description: "강의 목록에서 새 강의를 검색해 이름·강사·과목·시간을 확인합니다. 목록에 없다면 저장 오류를 확인하고 다시 시도합니다." },
    ],
    tourPath: "/workspace/lectures",
    tourSteps: [
      {
        selector: '[data-guide="lectures-add-btn"]',
        title: "강의 추가 버튼",
        description: "새 강의를 만들려면 이 버튼을 누르세요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="lectures-search"]',
        title: "강의 검색",
        description: "강의명, 과목, 강사, 기간으로 강의를 검색할 수 있어요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="lectures-table"]',
        title: "강의 목록",
        description: "개설된 강의가 여기에 표시됩니다. 클릭하면 차시 관리와 수강생 배정을 할 수 있어요.",
        placement: "top",
      },
    ],
  },
  {
    id: "create-session",
    icon: <NavIcon d="M3 4h18v17H3zM7 2v4M17 2v4M3 9h18M8 13h3M8 17h3" />,
    title: "차시 생성하기",
    summary: "실제 수업 날짜를 강의에 연결해야 출결과 평가를 운영할 수 있습니다.",
    steps: [
      { title: "강의 선택", description: "강의 목록에서 방금 만든 강의를 열고 '차시'로 이동합니다." },
      { title: "차시 추가", description: "차시 바의 '+'에서 회차, 수업 날짜·시간을 확인합니다. 보강이나 직보는 보강 차시로 구분합니다." },
      { title: "최종 확인 후 저장", description: "확인 화면에서 강의·차시 유형·날짜·시간을 검토한 뒤 저장합니다. 수강생과 출결 상태는 자동 등록되지 않습니다." },
      { title: "차시 목록 확인", description: "저장한 날짜와 회차가 차시 목록에 보이는지 확인합니다. 실패하면 입력한 값을 유지한 채 오류를 확인합니다." },
    ],
    tourPath: "/workspace/lectures",
  },
  {
    id: "enroll-students",
    icon: <NavIcon d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8M18 8v6M15 11h6" />,
    title: "수강생 등록하기",
    summary: "학생 명부의 학생을 강의에 연결한 뒤 수업할 차시에도 별도로 등록합니다.",
    steps: [
      { title: "강의의 수강생 열기", description: "강의 목록 → 강의 선택 → '수강생'에서 등록을 시작합니다." },
      { title: "명부의 학생 선택", description: "이미 등록된 학생을 검색해 선택합니다. 명부에 없다면 학생 관리에서 먼저 등록합니다." },
      { title: "차시 수강생 등록", description: "강의 등록만으로 차시에 자동 배정되지 않습니다. 수업할 차시의 '출결 → 수강생 등록'에서 강의 수강생을 선택하고 최종 확인 후 저장합니다." },
      { title: "등록 결과 확인", description: "강의 명부와 차시 출결 대상 양쪽에서 학생을 확인합니다. 첫 수강 확정으로 발송된 계정 안내는 발송 내역에서 결과를 확인합니다." },
    ],
    tourPath: "/workspace/lectures",
  },
  {
    id: "create-exam",
    icon: <NavIcon d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6M9 12l2 2 4-4" />,
    title: "시험 만들기부터 개인 성적표까지",
    summary:
      "성적 탭에서 시험을 만들고 답안·OMR 답안지를 준비한 뒤 학생별 성적표를 출력합니다.",
    steps: [
      { title: "강의에서 차시의 성적 열기", description: "왼쪽 '강의' → 강의 선택 → 차시 선택 → '성적' 탭으로 이동합니다. 강의와 차시가 없으면 먼저 만듭니다." },
      { title: "시험 추가", description: "'시험 추가'를 눌러 '시험 설정해서 만들기'를 선택하고 시험명·만점·채점 방식을 정합니다. 수강생은 자동으로 연결됩니다." },
      { title: "답안 등록", description: "이어서 열린 팝업에서 전체 문항 수를 정하고 '유형 저장'을 누릅니다. 정답 버블과 배점을 입력한 뒤 '답안 저장하고 다음'을 누릅니다." },
      { title: "OMR 답안지 받기", description: "다음 팝업에서 'OMR PDF 다운로드'를 누릅니다. OMR 스캔 업로드는 시험을 치른 뒤 성적 탭에서 진행합니다." },
      { title: "시험 설정 확인·변경", description: "'시험' 탭에서 해당 시험을 선택합니다. 운영 화면의 '시험 운영 설정 → 설정 변경'에서 만점·합격점·공개 여부를 바꾸고 저장합니다." },
      { title: "시험·과제 입력 실수 되돌리기", description: "성적표에서 '수정'을 누른 뒤 잘못 입력한 값은 '실행 취소'로 되돌리고 '다시 실행'으로 복원합니다. 이미 자동 저장된 변경도 되돌아갑니다. 새로고침 전 이 화면의 편집에 적용되며, 끝나면 '저장하고 잠금'을 누릅니다." },
      { title: "개인 성적표 출력", description: "점수가 반영되면 차시의 '성적' 탭에서 '개인 성적표'를 누릅니다. 학생과 분량을 고른 뒤 PDF를 다운로드합니다." },
    ],
    tourPath: "/workspace/lectures",
    tourSteps: [
      {
        selector: '[data-guide="lectures-table"]',
        title: "수업할 강의 선택",
        description: "강의를 열고 차시의 '성적' 탭으로 이동하세요. 여기서 '시험 추가'를 누르면 답안 등록과 OMR 답안지까지 이어집니다.",
        placement: "top",
      },
    ],
  },
  {
    id: "create-homework",
    icon: <NavIcon d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5" />,
    title: "과제 등록과 배정하기",
    summary: "차시에 과제를 만든 뒤 대상 수강생과 제출 상태를 확인합니다.",
    steps: [
      { title: "강의와 차시 열기", description: "강의 목록 → 강의 선택 → 차시 선택 → '성적' 탭으로 이동합니다." },
      { title: "과제 추가", description: "'성적 도구 → 과제 추가'에서 과제 내용과 제출 조건을 저장합니다. 필요하면 같은 차시의 '과제' 탭에서 상세를 확인합니다." },
      { title: "배정 확인", description: "수강생과 제출 대상이 맞는지 확인합니다. 대상에 없는 학생을 임의로 미제출로 처리하지 않습니다." },
      { title: "학생 화면과 제출 확인", description: "해당 학생에게 과제가 보이는지, 제출 후 교사 화면의 제출 현황에 반영되는지 확인합니다." },
    ],
    tourPath: "/workspace/lectures",
  },
  {
    id: "run-clinic",
    icon: <NavIcon d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM9 12h6M12 9v6" />,
    title: "클리닉 배정과 운영하기",
    summary: "대상 학생을 확인하고 날짜·세션에 배정한 뒤 당일 상태를 기록합니다.",
    steps: [
      { title: "대상 확인", description: "클리닉 화면에서 학습·성적 근거와 대상자를 확인합니다. 점수 미입력을 불합격으로 추정하지 않습니다." },
      { title: "일정과 세션", description: "운영할 날짜의 클리닉 세션을 만들거나 기존 세션을 선택합니다." },
      { title: "학생 배정", description: "참가자를 추가하고 학생·날짜·시간을 확인합니다. 중복이나 시간 충돌이 표시되면 임의로 진행하지 말고 대상 일정을 다시 선택합니다." },
      { title: "당일 결과", description: "출석·진행·완료를 실제 상태에 맞춰 기록한 뒤 참가자 목록과 학생 상세 이력에서 확인합니다." },
    ],
    tourPath: "/workspace/clinic",
  },
  {
    id: "upload-video",
    icon: <NavIcon d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />,
    title: "강의 영상 올리기",
    summary:
      "수업 영상이 학생에게 보이기까지 필요한 강의·차시 연결 흐름입니다.",
    steps: [
      { title: "영상으로 이동", description: "사이드바에서 '영상'을 클릭합니다." },
      { title: "폴더 선택", description: "왼쪽 폴더 트리에서 영상을 배정할 강의와 차시를 선택합니다. 영상은 선택한 위치에 맞춰 학생에게 노출됩니다." },
      { title: "영상 추가", description: "'영상 추가' 버튼 또는 '+추가' 카드를 클릭합니다." },
      { title: "파일 업로드", description: "영상 파일을 선택하면 업로드가 시작됩니다. 업로드 후 인코딩이 끝나야 학생이 안정적으로 볼 수 있습니다." },
      { title: "학생 시청 확인", description: "완료되면 해당 차시에 배정된 학생 계정으로 영상 목록에 보이는지 확인합니다." },
    ],
    tourPath: "/workspace/videos",
    tourSteps: [
      {
        selector: '[data-guide="videos-tree"]',
        title: "폴더 트리",
        description: "영상을 배정할 강의와 차시를 여기서 선택하세요.",
        placement: "right",
      },
      {
        selector: '[data-guide="videos-add"]',
        title: "영상 추가",
        description: "이 카드를 눌러 영상 파일을 업로드할 수 있어요.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "send-message",
    icon: <NavIcon d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
    title: "알림톡 보내기",
    summary:
      "수신 대상, 보낼 문구, 발송 결과를 확인하는 안전한 발송 흐름입니다.",
    steps: [
      { title: "알림톡 상태 확인", description: "메시지 설정에서 공용 채널의 발송 준비 상태를 확인합니다. 확인 필요가 보이면 연동 테스트 결과를 운영 담당자에게 전달해 주세요." },
      { title: "업무 화면 선택", description: "성적 입력, 출결, 클리닉, 학생 관리 등 알림톡을 보낼 업무 화면으로 이동합니다." },
      { title: "내 문구 만들기·수정", description: "메시지의 문구 편집 또는 선생님 앱의 '알림톡 문구 관리'에서 저장 문구를 편집합니다. 변수 블록과 실행 취소를 사용할 수 있고, 제공 문구는 복제해서 수정합니다. 삭제한 제공 문구는 자동으로 다시 생기지 않으며 문구 관리에서 원하는 항목만 선택해 복원할 수 있습니다." },
      { title: "수신 대상 확인", description: "학생 또는 학부모 번호가 올바른지 확인합니다. 처음에는 소수 대상으로 발송해 보는 편이 안전합니다." },
      { title: "발송 결과 확인", description: "발송 후 '발송 내역'에서 성공, 실패, 대기 상태를 확인합니다." },
    ],
    tourPath: "/workspace/message/log",
    tourSteps: [
      {
        selector: '[data-guide="messages-filter"]',
        title: "발송 내역 필터",
        description: "전체/성공/실패별로 발송 내역을 필터링할 수 있어요.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "check-results",
    icon: <NavIcon d="M4 18h16M6 14V9M10 14V5M14 14V7M18 14v-4" />,
    title: "성적 확인하기",
    summary:
      "학생별 누적 성적과 시험 제출 결과를 함께 확인하는 방법입니다.",
    steps: [
      { title: "성적으로 이동", description: "사이드바에서 '성적'을 클릭합니다." },
      { title: "학생 좁히기", description: "기간, 강의, 학년, 득점 구간, 점수 변화 조건으로 학생을 좁혀 봅니다." },
      { title: "회차별 추이 확인", description: "학생을 선택하면 1회차부터 누적된 점수 그래프와 최근 시험 기록을 확인할 수 있습니다." },
      { title: "후속 조치", description: "반복 오답이나 미제출 학생은 클리닉, 알림톡, 상담 메모로 이어서 관리합니다." },
    ],
    tourPath: "/workspace/results",
    tourSteps: [
      {
        selector: '[data-guide="results-filter"]',
        title: "성적 필터",
        description: "기간과 강의, 학년, 득점 구간, 상승·하락 조건을 조합할 수 있어요.",
        placement: "bottom",
      },
    ],
  },
];

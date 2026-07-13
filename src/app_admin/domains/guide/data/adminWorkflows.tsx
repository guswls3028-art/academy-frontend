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
    tourPath: "/admin/students",
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
    title: "강의 만들고 수업 관리하기",
    summary:
      "강의, 차시, 수강생을 연결해 수업 운영의 기준점을 만드는 흐름입니다.",
    steps: [
      { title: "강의 관리로 이동", description: "사이드바에서 '강의'를 클릭합니다." },
      { title: "강의 추가", description: "'강의 추가' 버튼으로 반 이름, 과목, 담당 선생님, 수업 요일을 정합니다." },
      { title: "차시 추가", description: "강의 상세에서 실제 수업 날짜와 내용을 차시로 만듭니다. 출결과 시험은 차시를 기준으로 연결됩니다." },
      { title: "수강생 배정", description: "강의 또는 차시에 학생을 배정합니다. 학생이 배정되어야 학생앱에 수업과 자료가 보입니다." },
      { title: "오늘 수업 확인", description: "대시보드 또는 선생 모바일 화면에서 오늘 수업으로 보이는지 확인합니다." },
    ],
    tourPath: "/admin/lectures",
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
    id: "create-exam",
    icon: <NavIcon d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6M9 12l2 2 4-4" />,
    title: "시험 출제하고 채점하기",
    summary:
      "강의·차시에 시험을 연결하고 학생 제출 후 성적까지 확인하는 흐름입니다.",
    steps: [
      { title: "시험으로 이동", description: "사이드바에서 '시험'을 클릭합니다." },
      { title: "강의·차시 선택", description: "왼쪽 패널에서 시험을 배정할 강의와 차시를 선택합니다. 강의가 없으면 먼저 강의를 만들어야 합니다." },
      { title: "시험 추가", description: "'+추가' 카드를 눌러 제목, 과목, 총점, 마감일을 입력합니다." },
      { title: "답안 기준 등록", description: "자동 채점을 쓰려면 정답과 배점을 정확히 등록합니다. 첫 시험은 소수 학생으로 제출 흐름을 확인하세요." },
      { title: "성적 확인", description: "학생이 제출하면 성적 메뉴에서 결과와 오답을 확인하고, 필요한 경우 클리닉으로 이어갑니다." },
    ],
    tourPath: "/admin/exams",
    tourSteps: [
      {
        selector: '[data-guide="exams-tree"]',
        title: "강의·차시 선택",
        description: "먼저 여기서 시험을 배정할 강의와 차시를 선택하세요.",
        placement: "right",
      },
      {
        selector: '[data-guide="exams-add"]',
        title: "시험 추가",
        description: "이 카드를 눌러 새 시험을 만들 수 있어요.",
        placement: "bottom",
      },
    ],
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
    tourPath: "/admin/videos",
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
      { title: "메시지 설정 확인", description: "대표 계정에서 발신 상태와 발송 설정을 확인합니다. 설정이 비어 있으면 먼저 채워 주세요." },
      { title: "업무 화면 선택", description: "성적 입력, 출결, 클리닉, 학생 관리 등 알림톡을 보낼 업무 화면으로 이동합니다." },
      { title: "수신 대상 확인", description: "학생 또는 학부모 번호가 올바른지 확인합니다. 처음에는 소수 대상으로 발송해 보는 편이 안전합니다." },
      { title: "발송 결과 확인", description: "발송 후 '발송 내역'에서 성공, 실패, 대기 상태를 확인합니다." },
    ],
    tourPath: "/admin/message/log",
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
      "시험 제출 결과를 강의, 시험, 학생 기준으로 확인하는 방법입니다.",
    steps: [
      { title: "성적으로 이동", description: "사이드바에서 '성적'을 클릭합니다." },
      { title: "필터링", description: "강의, 차시, 시험 기준으로 원하는 결과를 좁혀 봅니다." },
      { title: "학생별 상세 확인", description: "개별 학생을 클릭하면 점수, 제출 답안, 오답 흐름을 확인할 수 있습니다." },
      { title: "후속 조치", description: "반복 오답이나 미제출 학생은 클리닉, 알림톡, 상담 메모로 이어서 관리합니다." },
    ],
    tourPath: "/admin/results",
    tourSteps: [
      {
        selector: '[data-guide="results-filter"]',
        title: "성적 필터",
        description: "강의와 시험을 선택해서 원하는 성적만 볼 수 있어요.",
        placement: "bottom",
      },
    ],
  },
];

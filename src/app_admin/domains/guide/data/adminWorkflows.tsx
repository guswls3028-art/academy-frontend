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
      "새로운 학생을 추가하고 강의에 배정하는 방법을 알아보세요.",
    steps: [
      { title: "학생 관리로 이동", description: "사이드바에서 '학생 관리'를 클릭합니다." },
      { title: "학생 추가", description: "오른쪽 위 '학생 추가' 버튼을 클릭합니다." },
      { title: "정보 입력", description: "이름, 로그인 아이디, 비밀번호를 입력하고 저장합니다." },
      { title: "강의 배정", description: "학생 상세 페이지에서 수강할 강의를 배정할 수 있습니다." },
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
      "강의를 개설하고, 차시(수업 일정)를 추가하고, 수강생을 배정하는 흐름입니다.",
    steps: [
      { title: "강의 관리로 이동", description: "사이드바에서 '강의 관리'를 클릭합니다." },
      { title: "강의 추가", description: "'강의 추가' 버튼으로 새 강의를 만듭니다." },
      { title: "기본 정보 설정", description: "강의명, 과목, 강사, 수업 요일/시간을 입력합니다." },
      { title: "차시 추가", description: "강의 상세에서 차시(수업 일정)를 추가합니다. 각 차시에 날짜와 수업 내용을 설정하세요." },
      { title: "수강생 배정", description: "강의 또는 차시에 수강할 학생을 배정합니다." },
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
      "시험을 만들고 답안지를 등록하면, 학생 제출 시 자동 채점됩니다.",
    steps: [
      { title: "시험으로 이동", description: "사이드바에서 '시험'을 클릭합니다." },
      { title: "강의·차시 선택", description: "왼쪽 패널에서 시험을 배정할 강의와 차시를 선택합니다." },
      { title: "시험 추가", description: "'+추가' 카드를 눌러 새 시험을 만듭니다." },
      { title: "시험 정보 입력", description: "시험 제목, 과목, 총점 등을 입력하고 답안지를 등록합니다." },
      { title: "자동 채점 확인", description: "학생이 답안을 제출하면 자동 채점되어 '성적' 메뉴에서 결과를 확인할 수 있습니다." },
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
      "영상을 업로드하면 자동 인코딩 후 학생이 시청할 수 있습니다.",
    steps: [
      { title: "영상으로 이동", description: "사이드바에서 '영상'을 클릭합니다." },
      { title: "폴더 선택", description: "왼쪽 폴더 트리에서 영상을 배정할 강의와 차시를 선택합니다." },
      { title: "영상 추가", description: "'영상 추가' 버튼 또는 '+추가' 카드를 클릭합니다." },
      { title: "파일 업로드", description: "영상 파일을 선택하면 업로드가 시작됩니다. 인코딩까지 자동 처리돼요." },
      { title: "학생 시청", description: "완료되면 해당 차시에 배정된 학생이 영상을 볼 수 있습니다." },
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
    title: "메시지 보내기",
    summary:
      "학생이나 학부모에게 SMS·알림톡 메시지를 발송하는 방법입니다.",
    steps: [
      { title: "메시지로 이동", description: "사이드바에서 '메시지'를 클릭합니다." },
      { title: "새 메시지", description: "상단의 '새 메시지' 버튼을 클릭합니다. 또는 학생 목록에서 선택 후 '메시지 발송' 을 눌러도 됩니다." },
      { title: "발송 방식 선택", description: "SMS 또는 알림톡 중 원하는 방식을 선택합니다." },
      { title: "수신자·내용 작성", description: "수신자를 선택하고 메시지 내용을 작성합니다." },
      { title: "발송", description: "'발송' 버튼을 눌러 전송합니다. 발송 결과는 '발송 내역'에서 확인할 수 있어요." },
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
      "학생들의 시험 성적을 강의별·시험별로 확인하는 방법입니다.",
    steps: [
      { title: "성적으로 이동", description: "사이드바에서 '성적'을 클릭합니다." },
      { title: "필터링", description: "강의별, 시험별로 필터를 사용해 원하는 성적을 확인합니다." },
      { title: "상세 확인", description: "개별 학생을 클릭하면 상세 점수와 답안을 볼 수 있습니다." },
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

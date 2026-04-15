/**
 * 학생앱 가이드 — 업무 흐름 중심 워크플로우 데이터
 */
import {
  IconHome,
  IconExam,
  IconGrade,
  IconPlay,
  IconClipboard,
  IconClinic,
} from "@student/shared/ui/icons/Icons";
import type { GuideWorkflow } from "@/shared/ui/guide/types";

export const STUDENT_WORKFLOWS: GuideWorkflow[] = [
  {
    id: "take-exam",
    icon: <IconExam style={{ width: 24, height: 24 }} />,
    title: "시험 보기",
    summary: "등록된 시험에 응시하고 결과를 확인하는 방법이에요.",
    steps: [
      { title: "시험 탭으로 이동", description: "하단 메뉴에서 '시험' 탭을 누릅니다." },
      { title: "시험 선택", description: "응시할 시험을 목록에서 선택합니다. 마감일을 확인하세요." },
      { title: "시험 응시", description: "'시험 보기' 버튼을 눌러 시작합니다. 답안을 입력하세요." },
      { title: "제출", description: "모든 답안을 입력한 후 '제출' 버튼을 누릅니다." },
      { title: "결과 확인", description: "제출하면 바로 채점 결과를 확인할 수 있어요." },
    ],
    tourPath: "/student/exams",
    tourSteps: [
      {
        selector: '[data-guide="exam-list"]',
        title: "시험 목록",
        description: "응시할 수 있는 시험이 여기에 표시돼요. 마감일이 가까운 시험은 위에 나타나요.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "check-grades",
    icon: <IconGrade style={{ width: 24, height: 24 }} />,
    title: "성적 확인하기",
    summary: "시험 점수와 과제 결과, 성적 추이를 확인하는 방법이에요.",
    steps: [
      { title: "성적 페이지 이동", description: "홈 화면 하단의 '성적' 아이콘을 누릅니다." },
      { title: "요약 확인", description: "상단에서 평균 점수, 합격률, 평균 등수를 한눈에 봅니다." },
      { title: "추이 그래프", description: "그래프로 성적 변화를 볼 수 있어요. 과목별 필터도 가능합니다." },
      { title: "상세 결과", description: "각 시험을 눌러 상세 점수와 정답/오답을 확인합니다." },
    ],
    tourPath: "/student/grades",
    tourSteps: [
      {
        selector: '[data-guide="grades-stats"]',
        title: "성적 요약",
        description: "평균 점수, 합격률 등 핵심 지표를 한눈에 볼 수 있어요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="grades-chart"]',
        title: "성적 추이",
        description: "과목별 성적 변화를 그래프로 확인할 수 있어요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="grades-list"]',
        title: "시험 목록",
        description: "각 시험을 눌러 상세 결과를 확인하세요.",
        placement: "top",
      },
    ],
  },
  {
    id: "watch-video",
    icon: <IconPlay style={{ width: 24, height: 24 }} />,
    title: "영상 시청하기",
    summary: "강의 영상을 찾아서 시청하는 방법이에요. 이어보기도 돼요.",
    steps: [
      { title: "영상 탭으로 이동", description: "하단 메뉴에서 '영상' 탭을 누릅니다." },
      { title: "강좌 선택", description: "수강 중인 강좌 목록에서 원하는 강좌를 선택합니다." },
      { title: "영상 선택", description: "차시별 영상 목록에서 보고 싶은 영상을 누릅니다." },
      { title: "시청", description: "영상이 재생됩니다. 이전에 보던 위치부터 이어보기가 자동으로 돼요." },
    ],
    tourPath: "/student/video",
    tourSteps: [
      {
        selector: '[data-guide="video-courses"]',
        title: "수강 강좌",
        description: "수강 중인 강좌가 여기에 표시돼요. 원하는 강좌를 선택해서 영상을 시청하세요.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "submit-assignment",
    icon: <IconClipboard style={{ width: 24, height: 24 }} />,
    title: "과제 제출하기",
    summary: "과제나 시험 답안을 사진·파일로 제출하는 방법이에요.",
    steps: [
      { title: "과제 제출로 이동", description: "홈 화면 '할 일'에서 과제를 누르거나, 하단 아이콘 메뉴에서 '과제 제출'을 누릅니다." },
      { title: "제출 대상 선택", description: "제출할 과제 또는 시험을 목록에서 선택합니다." },
      { title: "파일 첨부", description: "'파일 선택' 버튼으로 사진을 찍거나 파일을 첨부합니다." },
      { title: "제출", description: "'제출하기' 버튼을 눌러 완료합니다. 성적에서 결과를 확인할 수 있어요." },
    ],
    tourPath: "/student/submit/assignment",
    tourSteps: [
      {
        selector: '[data-guide="submit-target"]',
        title: "제출 대상 선택",
        description: "먼저 제출할 과제나 시험을 여기서 선택하세요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="submit-file"]',
        title: "파일 첨부",
        description: "사진을 찍거나 파일을 올려서 첨부하세요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="submit-btn"]',
        title: "제출하기",
        description: "모든 준비가 끝나면 이 버튼으로 제출합니다.",
        placement: "top",
      },
    ],
  },
  {
    id: "daily-routine",
    icon: <IconHome style={{ width: 24, height: 24 }} />,
    title: "오늘 할 일 확인하기",
    summary: "홈 화면에서 오늘의 수업, 과제, 시험을 한눈에 파악하는 방법이에요.",
    steps: [
      { title: "홈 화면 확인", description: "앱을 열면 바로 홈 화면이 보입니다." },
      { title: "공지사항 확인", description: "상단에서 학원의 중요한 공지를 확인합니다." },
      { title: "학습 현황", description: "'나의 학습 현황'에서 수업 횟수, 과제 완료율, 시험 평균을 봅니다." },
      { title: "오늘 할 일", description: "'오늘 할 일' 섹션에서 미제출 과제, 예정 시험을 확인합니다." },
      { title: "바로가기", description: "하단 아이콘 메뉴에서 원하는 기능으로 바로 이동할 수 있어요." },
    ],
    tourPath: "/student/dashboard",
    tourSteps: [
      {
        selector: '[data-guide="dash-notice"]',
        title: "공지사항",
        description: "학원의 중요한 소식이 여기에 표시돼요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="dash-stats"]',
        title: "학습 현황",
        description: "수업, 과제, 시험 진행률을 한눈에 볼 수 있어요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="dash-todo"]',
        title: "오늘 할 일",
        description: "미제출 과제나 예정 시험이 여기에 나타나요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="dash-apps"]',
        title: "바로가기 메뉴",
        description: "자주 쓰는 기능으로 바로 이동할 수 있어요.",
        placement: "top",
      },
    ],
  },
  {
    id: "check-clinic",
    icon: <IconClinic style={{ width: 24, height: 24 }} />,
    title: "클리닉 확인하기",
    summary: "선생님이 지정한 보충 항목을 확인하고 해결하는 방법이에요.",
    steps: [
      { title: "클리닉으로 이동", description: "홈 화면 아이콘 메뉴에서 '클리닉'을 누릅니다." },
      { title: "항목 확인", description: "선생님이 지정한 보충 항목 목록을 확인합니다." },
      { title: "해결", description: "각 항목을 학습하고, 해결 여부를 체크할 수 있어요." },
    ],
    tourPath: "/student/clinic",
    tourSteps: [
      {
        selector: '[data-guide="clinic-list"]',
        title: "클리닉 항목",
        description: "보충이 필요한 항목이 여기에 표시돼요. 하나씩 해결해 나가세요.",
        placement: "bottom",
      },
    ],
  },
];

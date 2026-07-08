/**
 * 학생앱 가이드 — 첫 로그인 기준 업무 흐름 데이터
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
    id: "daily-routine",
    icon: <IconHome />,
    title: "오늘 할 일 확인하기",
    summary: "처음 로그인하면 홈에서 수업, 공지, 과제, 시험을 먼저 확인해요.",
    steps: [
      { title: "첫 비밀번호 변경", description: "처음 받은 임시 비밀번호로 로그인하면 비밀번호 변경 화면이 먼저 나올 수 있어요. 새 비밀번호로 바꾼 뒤 다시 로그인하면 됩니다." },
      { title: "홈 화면 확인", description: "앱을 열면 오늘 해야 할 일이 먼저 보입니다. 비어 있으면 선생님이 아직 수업이나 과제를 배정하지 않은 상태일 수 있어요." },
      { title: "공지사항 확인", description: "학원에서 전달한 중요한 안내가 있는지 확인합니다." },
      { title: "오늘 할 일 보기", description: "미제출 과제, 예정 시험, 수업 일정이 있으면 이 영역에서 바로 이동할 수 있습니다." },
      { title: "바로가기 사용", description: "영상, 시험, 성적, 과제, 클리닉은 하단 메뉴나 홈의 아이콘에서 바로 들어갈 수 있어요." },
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
        selector: '[data-guide="dash-todo"]',
        title: "오늘 할 일",
        description: "미제출 과제나 예정 시험이 여기에 나타나요.",
        placement: "bottom",
      },
      {
        selector: '[data-guide="dash-stats"]',
        title: "학습 현황",
        description: "수업, 과제, 시험 진행률을 한눈에 볼 수 있어요.",
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
    id: "watch-video",
    icon: <IconPlay />,
    title: "영상 시청하기",
    summary: "수강 중인 강의 영상을 찾아 보고, 이어보기로 이어서 학습해요.",
    steps: [
      { title: "영상 탭으로 이동", description: "하단 메뉴에서 '영상' 탭을 누릅니다." },
      { title: "강좌 선택", description: "수강 중인 강좌 목록에서 원하는 강좌를 선택합니다. 목록이 비어 있으면 선생님에게 강의 배정을 확인해 주세요." },
      { title: "영상 선택", description: "차시별 영상 목록에서 보고 싶은 영상을 누릅니다." },
      { title: "시청", description: "영상이 재생됩니다. 이전에 보던 위치가 있으면 이어보기가 자동으로 적용돼요." },
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
    icon: <IconClipboard />,
    title: "과제 제출하기",
    summary: "사진이나 파일로 과제와 답안을 제출하는 방법이에요.",
    steps: [
      { title: "과제 제출로 이동", description: "홈 화면 '오늘 할 일'에서 과제를 누르거나, 메뉴에서 '과제 제출'을 누릅니다." },
      { title: "제출 대상 선택", description: "제출할 과제 또는 시험을 목록에서 선택합니다. 마감일이 있으면 먼저 확인하세요." },
      { title: "파일 첨부", description: "'파일 선택' 버튼으로 사진을 찍거나 파일을 첨부합니다. 글자가 잘 보이는지 확인하면 좋아요." },
      { title: "제출", description: "'제출하기' 버튼을 눌러 완료합니다. 제출 결과는 성적이나 제출 내역에서 확인할 수 있어요." },
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
    id: "take-exam",
    icon: <IconExam />,
    title: "시험 보기",
    summary: "등록된 시험에 응시하고 결과를 확인하는 방법이에요.",
    steps: [
      { title: "시험 탭으로 이동", description: "하단 메뉴에서 '시험' 탭을 누릅니다." },
      { title: "시험 선택", description: "응시할 시험을 목록에서 선택합니다. 마감일과 응시 가능 상태를 확인하세요." },
      { title: "시험 응시", description: "'시험 보기' 버튼을 눌러 시작하고 답안을 입력합니다." },
      { title: "제출", description: "모든 답안을 입력한 후 '제출' 버튼을 누릅니다. 제출 전에는 빠진 답이 없는지 확인하세요." },
      { title: "결과 확인", description: "채점이 완료되면 점수와 오답을 확인할 수 있어요." },
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
    icon: <IconGrade />,
    title: "성적 확인하기",
    summary: "시험 점수, 과제 결과, 성적 변화를 확인하는 방법이에요.",
    steps: [
      { title: "성적 페이지 이동", description: "하단 메뉴 또는 더보기 메뉴에서 '성적'을 누릅니다." },
      { title: "요약 확인", description: "상단에서 평균 점수, 합격률, 최근 결과를 한눈에 봅니다." },
      { title: "추이 그래프", description: "그래프로 성적 변화를 볼 수 있어요. 과목별 필터가 있으면 원하는 과목만 볼 수 있습니다." },
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
    id: "check-clinic",
    icon: <IconClinic />,
    title: "클리닉 확인하기",
    summary: "선생님이 지정한 보충 항목을 확인하고 해결하는 방법이에요.",
    steps: [
      { title: "클리닉으로 이동", description: "홈 화면 아이콘 메뉴나 더보기 메뉴에서 '클리닉'을 누릅니다." },
      { title: "항목 확인", description: "선생님이 지정한 보충 항목 목록을 확인합니다." },
      { title: "해결", description: "각 항목을 학습하고 해결 여부를 체크합니다. 잘 모르겠으면 커뮤니티나 QnA로 질문할 수 있어요." },
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

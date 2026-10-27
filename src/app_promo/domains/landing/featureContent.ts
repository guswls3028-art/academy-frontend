import { BellRing, BookOpenCheck, ClipboardCheck, Globe2, GraduationCap, Presentation, ShieldCheck, Smartphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ProofCard = {
  id: string;
  badge: string;
  title: string;
  body: string;
  image: string;
  alt: string;
  imageWidth: number;
  imageHeight: number;
  secondaryVisual?: {
    label: string;
    image: string;
    alt: string;
    width: number;
    height: number;
  };
  points: string[];
  ctaPath: string;
  ctaLabel: string;
  tone: "video" | "alimtalk" | "website" | "matchup";
  phone?: boolean;
};

type FeatureGroup = {
  id: string;
  title: string;
  kicker: string;
  body: string;
  icon: LucideIcon;
  accentBg: string;
  items: { title: string; desc: string }[];
};

export const PROOF_CARDS: ProofCard[] = [
  {
    id: "student-video",
    badge: "학생전용앱 실제 화면",
    title: "영상 재생과 시청 기록",
    body: "외부 링크를 따로 보내지 않아도 학생전용앱 안에서 강의 목록, 재생, 댓글, 이어보기가 됩니다.",
    image: "/promo/student-video-player.webp",
    alt: "학생전용앱 영상 플레이어와 댓글 화면",
    imageWidth: 780,
    imageHeight: 1688,
    points: ["영상 플레이어, 댓글, 좋아요가 학생앱 안에 표시", "마지막 재생 위치와 시청 상태 확인", "미시청 학생에게 영상 확인 알림톡 발송"],
    ctaPath: "/promo/video-platform",
    ctaLabel: "영상 기능 상세 보기",
    tone: "video",
    phone: true,
  },
  {
    id: "alimtalk",
    badge: "관리자 알림톡 화면",
    title: "알림톡 설정과 발송",
    body: "가입·비밀번호 안내는 처리와 함께 발송됩니다. 클리닉·답변 알림은 설정된 항목만 자동으로 보내며, 수업 관련 안내는 학생별 최종 문구를 미리 본 뒤 발송합니다.",
    image: "/promo/admin-alimtalk-auto-send.png",
    alt: "관리자 알림톡 발송 설정 화면",
    imageWidth: 1440,
    imageHeight: 820,
    points: ["가입·비밀번호 안내는 항상 자동", "클리닉·답변 알림은 설정 후 자동", "대상·제외 인원·학생별 문구 미리보기"],
    ctaPath: "/promo/features#alimtalk-guide",
    ctaLabel: "자동·직접 발송 범위 보기",
    tone: "alimtalk",
  },
  {
    id: "academy-homepage",
    badge: "학원 홈페이지 예시",
    title: "학원 소개와 공개 자료",
    body: "학원명, 수업 소개, 강사 소개, 후기와 상담 정보를 편집하고 적중 보고서와 공개 게시글을 함께 보여줄 수 있습니다.",
    image: "/promo/landing-daechi-preview-20260527.png",
    alt: "학원 소개와 적중 보고서를 함께 보여주는 학원 홈페이지 예시",
    imageWidth: 1080,
    imageHeight: 956,
    points: ["4가지 홈페이지 형식", "소개·후기·상담 정보 편집", "적중 보고서·공개 글 게시"],
    ctaPath: "/promo/landing-samples",
    ctaLabel: "홈페이지 형식 보기",
    tone: "website",
  },
  {
    id: "matchup-ppt",
    badge: "매치업·PPT 실제 화면",
    title: "시험지 비교와 PPT 제작",
    body: "매치업은 학교 시험지와 우리 학원 사전 자료를 문항별로 비교해 유사 출제 근거를 정리합니다. 칠판용 PPT 도구는 PDF·이미지를 슬라이드로 구성하고 흑백반전합니다.",
    image: "/promo/matchup-gaepo-candidates-20260725.png",
    alt: "실제 시험지 문항과 사전 자료의 유사 후보를 보여주는 매치업 실제 화면",
    imageWidth: 1280,
    imageHeight: 720,
    secondaryVisual: {
      label: "칠판용 PPT 제작",
      image: "/promo/ppt-gaepo-setup-20260725.png",
      alt: "PDF와 이미지로 칠판용 PPT를 만드는 실제 화면",
      width: 1280,
      height: 720,
    },
    points: ["매치업: 문항 자동 분리·유사 후보 제공", "매치업: 비교 자료와 적중 근거 저장", "PPT: 슬라이드 구성·흑백반전 후 내려받기"],
    ctaPath: "/promo/matchup-ppt",
    ctaLabel: "PPT · 매치업 자세히 보기",
    tone: "matchup",
  },
];

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "matchup-ppt-flow",
    title: "적중 매치업·칠판용 PPT",
    kicker: "매치업·칠판용 PPT",
    body: "매치업은 학교 시험지와 우리 학원 사전 자료를 비교해 유사 출제 근거를 남기고, 칠판용 PPT 도구는 수업자료를 빔프로젝터용 슬라이드로 만듭니다.",
    icon: Presentation,
    accentBg: "#dce8ff",
    items: [
      { title: "매치업 · 문항 자동 분리", desc: "실제 시험지와 사전 대비 자료를 문항별로 나눠 비교할 수 있게 준비합니다." },
      { title: "매치업 · 유사 후보 확인", desc: "문항별 후보를 나란히 보고 선생님이 유사 문항과 적중 근거를 확정합니다." },
      { title: "칠판용 PPT · 자료 구성", desc: "PDF 문항 또는 준비한 이미지를 한 장씩 슬라이드로 배치해 순서를 정합니다." },
      { title: "칠판용 PPT · 내려받기", desc: "흑백반전과 밝기·대비를 적용해 16:9·4:3 PPT로 내려받습니다." },
    ],
  },
  {
    id: "parent-report",
    title: "학부모 상담에 필요한 기록",
    kicker: "상담 전 설명",
    body: "학부모가 궁금해하는 출결, 성적, 영상, 보강 내역을 화면에서 확인하고 상담과 안내에 활용합니다.",
    icon: ShieldCheck,
    accentBg: "#c8f4ec",
    items: [
      { title: "수업 기록 확인", desc: "수업 참여, 시험 결과, 영상 시청, 보강 필요 여부를 실제 화면에서 확인합니다." },
      { title: "다음 조치 판단", desc: "취약 문항, 미시청 영상, 보강 후보 중 이번에 안내할 내용을 고릅니다." },
      { title: "선생님 최종 검수", desc: "알림톡을 보내기 전에 대상과 선생님 메모를 확인합니다." },
      { title: "상담 자료 활용", desc: "적중 리포트와 학교별 내신반 소개 화면을 상담에 함께 활용합니다." },
    ],
  },
  {
    id: "class-management",
    title: "수업·수강생 관리",
    kicker: "수업 준비",
    body: "선생님이 매일 확인하는 강의, 차시, 담당 수강생, 출결 상태를 한 화면에 모았습니다.",
    icon: BookOpenCheck,
    accentBg: "#dff7f4",
    items: [
      { title: "강의·차시 구조", desc: "강의 목록, 지난 강의, 수강생, 출결 기록을 함께 관리합니다." },
      { title: "수강생 상태 관리", desc: "수강 상태, 메모, 담당 강사, 학부모 연락처를 수업 화면에서 확인합니다." },
      { title: "출결 기록", desc: "입실, 결석, 보강 필요 여부를 남기고 알림톡으로 안내합니다." },
      { title: "오늘 할 일 확인", desc: "미답변 질문, 학생 제출, 채점·성적, 영상 관리를 대시보드에서 확인합니다." },
    ],
  },
  {
    id: "exam-score",
    title: "시험·과제·성적",
    kicker: "시험 후 처리",
    body: "시험이 끝난 뒤 선생님이 해야 하는 채점, 분석, 피드백, 보강 판단을 이어서 처리합니다.",
    icon: ClipboardCheck,
    accentBg: "#e7ecff",
    items: [
      { title: "시험 생성", desc: "객관식, OX형, 단답형, 서술형 문항과 배점을 설정합니다." },
      { title: "과제 제출 확인", desc: "제출 대기, 제출 완료, 미처리 상태를 선생님이 판단할 수 있게 보여줍니다." },
      { title: "성적 분석", desc: "점수 입력, 총점 계산, 시험별·수강생별 분석을 한 화면에서 봅니다." },
      { title: "피드백 기록", desc: "수업 결과와 성적 코멘트를 남기고 학부모에게 안내합니다." },
    ],
  },
  {
    id: "student-video-flow",
    title: "학생전용앱 영상 학습",
    kicker: "학생앱 복습",
    body: "학생은 앱에서 복습하고, 선생님은 시청 상태를 보고 챙길 학생을 찾습니다.",
    icon: Smartphone,
    accentBg: "#fff0d2",
    items: [
      { title: "앱 안의 영상 목록", desc: "수강생은 학생전용앱에서 강의별 영상 목록과 재생 목록을 확인합니다." },
      { title: "자체 플레이어", desc: "이어보기, 배속, 전체화면, 댓글을 앱 안에서 제공합니다." },
      { title: "시청 이력", desc: "시청 시간, 마지막 위치, 완료 여부를 확인합니다." },
      { title: "영상 안내", desc: "미시청 학생에게 복습 영상을 확인하라고 알림톡을 보냅니다." },
    ],
  },
  {
    id: "communication",
    title: "알림톡·학부모 커뮤니케이션",
    kicker: "학부모 안내",
    body: "알림톡은 승인된 공용 양식을 사용하며, 업무 성격에 따라 항상 자동·설정 후 자동·확인 후 발송으로 나뉩니다.",
    icon: BellRing,
    accentBg: "#ffe7ef",
    items: [
      { title: "계정 안내 자동 발송", desc: "학생·학부모 가입과 비밀번호 변경 안내는 계정 처리와 함께 발송됩니다." },
      { title: "설정 가능한 자동 안내", desc: "클리닉 예약·변경·입실과 질문 답변 등 준비된 항목만 설정에 따라 자동 발송합니다." },
      { title: "학생별 발송 미리보기", desc: "출결·성적·수업 결과는 발송 가능·제외 대상과 학생별 최종 문구를 확인합니다." },
      { title: "수신 화면·발송 결과", desc: "학부모는 카카오톡으로 받고, 선생님은 실제 성공·실패를 발송 내역에서 확인합니다." },
    ],
  },
  {
    id: "academy-homepage-flow",
    title: "학원 홈페이지",
    kicker: "학원 소개·공개",
    body: "학원에 맞는 홈페이지 형식을 고르고 수업 소개, 강사 정보, 후기와 상담 내용을 직접 관리합니다.",
    icon: Globe2,
    accentBg: "#dff3eb",
    items: [
      { title: "4가지 홈페이지 형식", desc: "학원 분위기와 안내 목적에 맞는 형식을 골라 시작합니다." },
      { title: "소개 내용 편집", desc: "학원명, 수업 소개, 강사, 후기, 자주 묻는 질문과 상담 정보를 수정합니다." },
      { title: "공개 자료 게시", desc: "적중 보고서와 공개 게시글을 학원 홈페이지에서 보여줄 수 있습니다." },
      { title: "학생앱 연결", desc: "학원 홈페이지에서 학생·선생님 로그인과 수업 화면으로 이어집니다." },
    ],
  },
  {
    id: "clinic",
    title: "보강·클리닉·후속 조치",
    kicker: "수업 후 조치",
    body: "성적, 과제, 영상 시청 기록을 확인하고 보강이 필요한 학생을 관리합니다.",
    icon: GraduationCap,
    accentBg: "#e7f7fb",
    items: [
      { title: "보강 예약", desc: "보강 일정을 등록하고 학생별 보강 이력을 확인합니다." },
      { title: "클리닉 메모", desc: "상담, 피드백, 약점, 과제 이력을 학생별로 누적합니다." },
      { title: "후속 대상자 판단", desc: "성적, 과제, 영상 시청 상태를 보고 다음 조치가 필요한 학생을 찾습니다." },
      { title: "학부모 안내 자료", desc: "선생님이 학부모에게 설명할 내용을 화면에 남깁니다." },
    ],
  },
];

export const FEATURE_WORKFLOWS: Record<string, { mode: string; title: string; desc: string }[]> = {
  "class-management": [
    { mode: "직접 준비", title: "강의·차시·수강생 등록", desc: "학원의 실제 수업 구조와 담당 학생을 먼저 정합니다." },
    { mode: "자동 연결", title: "학생 기록을 강의 기준으로 모음", desc: "출결·시험·과제·영상 기록이 수강생과 강의에 연결됩니다." },
    { mode: "선생님 확인", title: "출결과 수업 메모", desc: "입실·결석·보강 필요 여부와 수업 내용을 직접 남깁니다." },
    { mode: "운영 결과", title: "오늘 할 일 확인", desc: "질문·제출·시험처럼 먼저 처리할 업무를 대시보드에서 봅니다." },
  ],
  "exam-score": [
    { mode: "직접 준비", title: "문항·정답·배점 설정", desc: "시험 성격에 맞춰 객관식·OX·단답형·서술형을 구성합니다." },
    { mode: "자동 처리", title: "정답이 명확한 문항 채점", desc: "객관식·OX형과 지원 범위의 수학 단답형은 정답과 대조합니다." },
    { mode: "선생님 확인", title: "서술형 채점·피드백", desc: "서술형 점수와 최종 피드백은 선생님이 확인해 확정합니다." },
    { mode: "운영 결과", title: "성적·취약 문항·후속 조치", desc: "시험 결과를 보고 재시험과 보강 대상을 정합니다." },
  ],
  "student-video-flow": [
    { mode: "직접 준비", title: "차시별 영상 등록", desc: "복습 영상을 강의와 차시에 연결하고 공개 대상을 정합니다." },
    { mode: "학생 사용", title: "앱에서 재생·이어보기", desc: "학생은 학생전용앱 안에서 마지막 위치부터 이어 봅니다." },
    { mode: "자동 기록", title: "시청 시간·상태 저장", desc: "마지막 위치와 미시청·시청중·완료 상태가 남습니다." },
    { mode: "선생님 확인", title: "미시청 학생 후속 안내", desc: "시청 이력을 확인해 필요한 학생에게 복습을 안내합니다." },
  ],
  communication: [
    { mode: "항상 자동", title: "가입·비밀번호 안내", desc: "계정 생성과 비밀번호 변경 안내는 처리와 함께 발송됩니다." },
    { mode: "설정 후 자동", title: "클리닉·답변 알림", desc: "승인 양식과 학원 설정이 준비된 항목만 자동으로 발송합니다." },
    { mode: "선생님 확인", title: "출결·성적·수업 결과", desc: "기본은 대상별 최종 문구를 미리 본 뒤 직접 발송합니다." },
    { mode: "발송 결과", title: "성공·실패 내역 확인", desc: "발송 요청 후 실제 성공·실패를 발송 내역에서 확인합니다." },
  ],
  "academy-homepage-flow": [
    { mode: "처음 준비", title: "형식·소개 내용 결정", desc: "네 가지 형식 중 학원에 맞는 구성과 공개 정보를 정합니다." },
    { mode: "학원에서 편집", title: "소개·후기·상담 정보", desc: "운영 중 바뀌는 내용을 관리자 화면에서 직접 수정합니다." },
    { mode: "공개 반영", title: "적중 보고서·게시글 게시", desc: "공개로 정한 자료와 글을 학원 홈페이지에 보여줍니다." },
    { mode: "방문자 화면", title: "상담·서비스 연결", desc: "방문자는 학원을 확인하고 상담 또는 로그인 화면으로 이동합니다." },
  ],
  clinic: [
    { mode: "선생님 판단", title: "보강·클리닉 대상 선정", desc: "성적·과제·영상 기록을 보고 후속 관리할 학생을 정합니다." },
    { mode: "직접 준비", title: "일정·장소·학생 예약", desc: "클리닉 시간과 장소를 잡고 참여 학생을 등록합니다." },
    { mode: "설정 후 자동", title: "예약·변경·입실 안내", desc: "승인 양식과 설정이 준비되면 상태 변경에 맞춰 안내합니다." },
    { mode: "선생님 확인", title: "참석·결과·메모 기록", desc: "실제 참여와 보강 결과는 선생님이 확인해 남깁니다." },
  ],
  "matchup-ppt-flow": [
    { mode: "매치업", title: "문항 자동 분리", desc: "실제 시험지와 사전 대비 자료를 문항 단위로 나눕니다." },
    { mode: "매치업", title: "유사 후보·적중 근거 확정", desc: "후보를 나란히 보고 선생님이 유사 문항 여부를 직접 판단합니다." },
    { mode: "칠판용 PPT", title: "PDF·이미지 슬라이드 구성", desc: "문항 또는 개념 이미지를 수업 순서에 맞게 배치합니다." },
    { mode: "칠판용 PPT", title: "반전 설정·PPT 다운로드", desc: "화면비율과 흑백반전을 확인한 뒤 수업용 PPT로 내려받습니다." },
  ],
  "parent-report": [
    { mode: "기록 연결", title: "출결·성적·영상·보강 확인", desc: "학생별로 남아 있는 수업 전후 기록을 한데 모아 봅니다." },
    { mode: "선생님 판단", title: "이번에 안내할 내용 선택", desc: "상담에서 설명할 변화와 다음 조치를 선생님이 정합니다." },
    { mode: "발송 전 확인", title: "대상·학생별 문구 미리보기", desc: "학생별로 실제 적용된 문구와 제외 대상을 확인합니다." },
    { mode: "학부모 확인", title: "알림톡·상담 자료로 확인", desc: "학부모는 안내를 받고 필요한 경우 기록을 보며 상담합니다." },
  ],
};

const FEATURE_GROUP_ORDER = [
  "class-management",
  "exam-score",
  "student-video-flow",
  "communication",
  "academy-homepage-flow",
  "clinic",
  "matchup-ppt-flow",
  "parent-report",
];

export const ORDERED_FEATURE_GROUPS = FEATURE_GROUP_ORDER.map((id) => FEATURE_GROUPS.find((group) => group.id === id)).filter(
  (group): group is FeatureGroup => Boolean(group),
);

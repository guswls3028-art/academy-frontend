import { Link } from "react-router";
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Globe2,
  GraduationCap,
  LayoutDashboard,
  MessageSquareText,
  PlayCircle,
  Presentation,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import CtaSection from "../components/CtaSection";
import PromoEvidenceImage from "../components/PromoEvidenceImage";
import styles from "./PromoPages.module.css";

type ProofCard = {
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

const PROOF_CARDS: ProofCard[] = [
  {
    id: "student-video",
    badge: "학생전용앱 실제 화면",
    title: "수강생은 앱에서 영상을 이어 보고, 선생님은 시청 이력으로 챙깁니다",
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
    title: "알림톡은 항상 자동·설정 후 자동·확인 후 발송으로 나뉩니다",
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
    title: "학원 소개와 공개 자료를 우리 학원 홈페이지에 정리합니다",
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
    title: "학교 시험지와 학원 자료를 비교하고 칠판용 PPT를 만듭니다",
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

const FEATURE_WORKFLOWS: Record<string, { mode: string; title: string; desc: string }[]> = {
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

const ORDERED_FEATURE_GROUPS = FEATURE_GROUP_ORDER.map((id) => FEATURE_GROUPS.find((group) => group.id === id)).filter(
  (group): group is FeatureGroup => Boolean(group),
);

const NAV_LINKS = [
  { label: "강의·학생 관리", href: "#class-management" },
  { label: "학생앱 영상", href: "#student-video-flow" },
  { label: "알림톡 안내", href: "#communication" },
  { label: "학원 홈페이지", href: "#academy-homepage-flow" },
  { label: "매치업·PPT", href: "#matchup-ppt-flow" },
  { label: "시험·성적", href: "#exam-score" },
  { label: "보강·클리닉", href: "#clinic" },
];

function AlimtalkGuideSection() {
  const modes = [
    {
      label: "항상 자동",
      title: "계정 안내",
      desc: "학생·학부모 가입 안내와 비밀번호 변경 안내는 계정 처리와 함께 발송됩니다.",
      tone: "system",
      icon: Settings2,
    },
    {
      label: "설정 후 자동",
      title: "클리닉·답변 안내",
      desc: "클리닉 예약·변경·입실과 질문 답변 등 승인 양식과 설정이 준비된 항목만 자동으로 발송합니다.",
      tone: "configured",
      icon: BellRing,
    },
    {
      label: "확인 후 직접",
      title: "출결·성적·수업 결과",
      desc: "기본은 선생님이 대상, 학생별 최종 문구와 제외 대상을 확인한 뒤 직접 발송합니다.",
      tone: "manual",
      icon: UserCheck,
    },
  ] as const;

  return (
    <section id="alimtalk-guide" className={styles.alimtalkGuideSection} aria-labelledby="alimtalk-guide-title">
      <div className={styles.sectionWrap}>
        <header className={styles.sectionHead}>
          <span>
            <BellRing size={16} />
            알림톡 사용 범위
          </span>
          <h2 id="alimtalk-guide-title">알림톡마다 발송 시점과 확인 범위가 정해져 있습니다</h2>
          <p>
            모든 안내를 자동으로 보내지 않습니다. 계정 안내, 설정된 자동 안내,
            선생님 확인이 필요한 수업 안내를 서로 다른 방식으로 처리합니다.
          </p>
        </header>

        <div className={styles.alimtalkGuideLayout}>
          <div className={styles.alimtalkModeList}>
            {modes.map((mode) => {
              const Icon = mode.icon;
              return (
                <article key={mode.label} data-tone={mode.tone}>
                  <span className={styles.alimtalkModeIcon}>
                    <Icon size={19} />
                  </span>
                  <div>
                    <span>{mode.label}</span>
                    <h3>{mode.title}</h3>
                    <p>{mode.desc}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.alimtalkPreviewBoard}>
            <div className={styles.alimtalkPreviewSteps}>
              <span>직접 발송 화면</span>
              <ol>
                <li>
                  <strong>01</strong>
                  <div>
                    <span>대상 확인</span>
                    <p>발송 가능 인원과 연락처 없음·대상 변경으로 제외된 인원을 구분합니다.</p>
                  </div>
                </li>
                <li>
                  <strong>02</strong>
                  <div>
                    <span>학생별 미리보기</span>
                    <p>학생을 누르면 이름·강의·차시가 들어간 실제 최종 문구로 바뀝니다.</p>
                  </div>
                </li>
                <li>
                  <strong>03</strong>
                  <div>
                    <span>확인 후 발송</span>
                    <p>대상과 학생별 최종 문구를 확인한 뒤 발송합니다.</p>
                  </div>
                </li>
                <li>
                  <strong>04</strong>
                  <div>
                    <span>발송 결과 확인</span>
                    <p>발송 요청 후 실제 성공·실패를 발송 내역에서 확인합니다.</p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.kakaoReceivePreview} aria-label="학부모가 받는 알림톡 예시">
              <header>
                <span>알림톡</span>
                <strong>학원플러스</strong>
              </header>
              <div>
                <span>출석 안내</span>
                <p>
                  홍길동 학생의 출석 안내입니다.
                  <br />
                  강의&nbsp;&nbsp;수학 심화반
                  <br />
                  차시&nbsp;&nbsp;3회차
                  <br />
                  날짜&nbsp;&nbsp;7월 26일
                  <br />
                  시간&nbsp;&nbsp;14:00
                </p>
                <small>학생 이름·강의·차시·날짜·시간은 기록에서 자동으로 채워집니다.</small>
              </div>
              <footer>
                <MessageSquareText size={14} />
                학부모가 카카오톡에서 받는 형태
              </footer>
            </div>
          </div>
        </div>

        <div className={styles.alimtalkBoundary}>
          <Eye size={18} />
          <p>
            <strong>발송 전 미리보기는 제공합니다.</strong>
            현재 ‘내 번호로 테스트 받아보기’는 별도 기능으로 제공하지 않습니다.
            학생별 최종 문구를 화면에서 확인한 뒤 발송하고, 실제 성공·실패는 발송 내역에서 확인합니다.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <div className={styles.page}>
      <section className={`${styles.hero} ${styles.heroFeatures}`} aria-labelledby="features-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>학원 운영 기능 · 실제 화면 안내</span>
            <h1 id="features-title">매일 쓰는 학원 관리와 주요 기능을 한곳에서 이용합니다</h1>
            <p>
              강의·수강생·출결·성적·보강 관리가 중심입니다. 학생앱 영상, 알림톡,
              칠판용 PPT·매치업과 학원 홈페이지까지 수업 전후에 필요한 기능을 제공합니다.
            </p>
            <div className={styles.heroActions}>
              <a href="#feature-catalog-title" className={styles.primaryCta}>
                업무별 기능 보기
                <LayoutDashboard size={18} />
              </a>
              <Link to="/promo/video-platform" className={styles.secondaryCta}>
                학생앱 영상 보기
                <Smartphone size={18} />
              </Link>
            </div>
          </div>

          <aside className={styles.heroProofStack} aria-label="학원 운영 실제 화면 미리보기">
            <figure className={styles.heroScreen}>
              <PromoEvidenceImage
                src="/promo/admin-home.png"
                alt="강의, 시험, 제출과 질문 현황을 확인하는 학원플러스 대시보드 실제 화면"
                width={1440}
                height={820}
              />
              <figcaption className={styles.heroScreenCaption}>
                <strong>학원 운영 대시보드</strong>
                <span>강의 · 시험 · 제출 · 질문</span>
              </figcaption>
            </figure>
            <div className={styles.miniProofGrid}>
              <article>
                <PlayCircle size={16} />
                <strong>학생앱 영상</strong>
                <p>학생은 앱에서 복습하고 선생님은 시청 상태를 확인합니다.</p>
              </article>
              <article>
                <BellRing size={16} />
                <strong>알림톡 안내</strong>
                <p>수업 기록을 확인한 뒤 필요한 내용을 안내합니다.</p>
              </article>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.proofSection} aria-labelledby="proof-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>
              <Sparkles size={16} />
              실제 화면
            </span>
            <h2 id="proof-title">주요 기능을 실제 화면으로 확인하세요</h2>
            <p>
              영상, 알림톡, 홈페이지와 칠판용 PPT·매치업을 각각 언제 쓰는지 실제 화면과 함께 보여드립니다.
            </p>
          </header>

          <div className={styles.proofGrid}>
            {PROOF_CARDS.map((card) => (
              <article
                key={card.id}
                id={card.id}
                className={styles.proofCard}
                data-tone={card.tone}
              >
                <div className={`${styles.proofVisual} ${card.phone ? styles.proofPhoneVisual : ""} ${card.secondaryVisual ? styles.proofVisualPair : ""}`}>
                  <PromoEvidenceImage
                    src={card.image}
                    alt={card.alt}
                    width={card.imageWidth}
                    height={card.imageHeight}
                    loading="lazy"
                  />
                  {card.secondaryVisual && (
                    <figure>
                      <PromoEvidenceImage
                        src={card.secondaryVisual.image}
                        alt={card.secondaryVisual.alt}
                        width={card.secondaryVisual.width}
                        height={card.secondaryVisual.height}
                        loading="lazy"
                      />
                      <figcaption>{card.secondaryVisual.label}</figcaption>
                    </figure>
                  )}
                </div>
                <div className={styles.proofText}>
                  <span className={styles.proofBadge}>{card.badge}</span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <ul>
                    {card.points.map((point) => (
                      <li key={point}>
                        <CheckCircle2 size={16} />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link to={card.ctaPath} className={styles.textButton}>
                    {card.ctaLabel}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <AlimtalkGuideSection />

      <section className={styles.catalogSection} aria-labelledby="feature-catalog-title">
        <div className={styles.sectionWrap}>
          <header className={styles.sectionHead}>
            <span>업무별 기능</span>
            <h2 id="feature-catalog-title">수업 준비부터 학부모 안내까지</h2>
            <p>수업 준비부터 학부모 안내까지 사용하는 순서대로 정리했습니다.</p>
          </header>

          <div className={styles.catalogLayout}>
            <aside className={styles.catalogRail} aria-label="기능 바로가기">
              <span className={styles.railTitle}>바로가기</span>
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                  <ArrowRight size={14} />
                </a>
              ))}
            </aside>

            <div className={styles.groupStack}>
              {ORDERED_FEATURE_GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <article key={group.id} id={group.id} className={styles.groupCard}>
                    <div className={styles.groupHeader}>
                      <span className={styles.groupIcon} style={{ "--accent-bg": group.accentBg } as CSSProperties}>
                        <Icon size={22} />
                      </span>
                      <div>
                        <span className={styles.groupKicker}>{group.kicker}</span>
                        <h2>{group.title}</h2>
                        <p>{group.body}</p>
                      </div>
                    </div>
                    <ol className={styles.featureWorkflow} aria-label={`${group.title} 사용 흐름`}>
                      {(FEATURE_WORKFLOWS[group.id] ?? []).map((step, index) => (
                        <li key={step.title}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <div>
                            <small>{step.mode}</small>
                            <strong>{step.title}</strong>
                            <p>{step.desc}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <div className={styles.featureGrid}>
                      {group.items.map((item) => (
                        <div key={item.title} className={styles.featureItem}>
                          <strong>{item.title}</strong>
                          <p>{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <CtaSection
        title="현재 관리 방식에 맞는 기능을 확인해 보세요"
        subtitle="강의·학생 관리부터 영상, 알림톡, 칠판용 PPT·매치업과 학원 홈페이지까지 필요한 화면을 안내합니다."
        secondaryPath="/promo/video-platform"
        secondaryLabel="학생앱 영상 보기"
      />
    </div>
  );
}

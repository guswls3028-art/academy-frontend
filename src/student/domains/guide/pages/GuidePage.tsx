/**
 * PATH: src/student/domains/guide/pages/GuidePage.tsx
 * 학생 앱 사용 가이드 — 각 기능별 간단한 설명 카드
 */
import { Link } from "react-router-dom";
import {
  IconHome,
  IconNotice,
  IconGrade,
  IconExam,
  IconPlay,
  IconCalendar,
  IconClinic,
  IconBoard,
  IconUser,
  IconClipboard,
  IconBell,
  IconFolder,
  IconSettings,
} from "@/student/shared/ui/icons/Icons";
import type { ReactNode } from "react";

type GuideSection = {
  icon: ReactNode;
  title: string;
  to: string;
  description: string;
};

const GUIDE_SECTIONS: GuideSection[] = [
  {
    icon: <IconHome style={{ width: 28, height: 28 }} />,
    title: "홈 화면",
    to: "/student/dashboard",
    description:
      "로그인하면 처음 보이는 화면이에요. 오늘 할 일, 다가오는 시험, 최근 공지 등을 한눈에 볼 수 있어요.",
  },
  {
    icon: <IconNotice style={{ width: 28, height: 28 }} />,
    title: "공지사항",
    to: "/student/notices",
    description:
      "학원에서 알려주는 중요한 소식을 확인할 수 있어요. 새 공지가 오면 알림이 와요.",
  },
  {
    icon: <IconGrade style={{ width: 28, height: 28 }} />,
    title: "성적 확인",
    to: "/student/grades",
    description:
      "시험 성적과 과제 결과를 확인할 수 있어요. 합격/불합격 여부와 점수를 볼 수 있어요.",
  },
  {
    icon: <IconExam style={{ width: 28, height: 28 }} />,
    title: "시험 응시",
    to: "/student/exams",
    description:
      "선생님이 등록한 시험에 응시할 수 있어요. 시험 목록에서 '시험 보기'를 눌러 시작하세요.",
  },
  {
    icon: <IconClipboard style={{ width: 28, height: 28 }} />,
    title: "과제 제출",
    to: "/student/submit",
    description:
      "과제나 점수를 제출할 수 있어요. 사진을 찍거나 파일을 올려서 제출하면 돼요.",
  },
  {
    icon: <IconPlay style={{ width: 28, height: 28 }} />,
    title: "영상 시청",
    to: "/student/video",
    description:
      "학원에서 올린 강의 영상을 볼 수 있어요. 강좌별로 정리되어 있고, 이어보기도 돼요.",
  },
  {
    icon: <IconCalendar style={{ width: 28, height: 28 }} />,
    title: "일정 확인",
    to: "/student/sessions",
    description:
      "수업 일정을 확인할 수 있어요. 날짜별로 어떤 수업이 있는지 볼 수 있어요.",
  },
  {
    icon: <IconClinic style={{ width: 28, height: 28 }} />,
    title: "클리닉",
    to: "/student/clinic",
    description:
      "부족한 부분을 보충할 수 있는 클리닉이에요. 선생님이 지정한 항목을 확인하고 해결하세요.",
  },
  {
    icon: <IconBoard style={{ width: 28, height: 28 }} />,
    title: "커뮤니티",
    to: "/student/community",
    description:
      "질문이나 이야기를 나눌 수 있는 게시판이에요. 자유롭게 글을 쓰고 답글도 달 수 있어요.",
  },
  {
    icon: <IconBell style={{ width: 28, height: 28 }} />,
    title: "알림",
    to: "/student/notifications",
    description:
      "새 공지, 시험 결과, 메시지 등 중요한 알림을 모아서 볼 수 있어요.",
  },
  {
    icon: <IconFolder style={{ width: 28, height: 28 }} />,
    title: "내 인벤토리",
    to: "/student/inventory",
    description:
      "선생님이 나눠준 자료나 파일을 모아볼 수 있는 공간이에요.",
  },
  {
    icon: <IconUser style={{ width: 28, height: 28 }} />,
    title: "프로필",
    to: "/student/profile",
    description:
      "내 이름, 사진 등 정보를 확인할 수 있어요.",
  },
  {
    icon: <IconSettings style={{ width: 28, height: 28 }} />,
    title: "설정",
    to: "/student/settings",
    description:
      "앱 설정을 바꿀 수 있어요. 화면 모드(라이트/다크/시스템)를 변경할 수 있어요.",
  },
];

function GuideCard({ section }: { section: GuideSection }) {
  return (
    <Link
      to={section.to}
      style={{
        display: "flex",
        gap: "var(--stu-space-4)",
        padding: "var(--stu-space-4)",
        borderRadius: "var(--stu-radius-md)",
        background: "var(--stu-surface)",
        border: "1px solid var(--stu-border)",
        textDecoration: "none",
        color: "var(--stu-text)",
        transition: "box-shadow 150ms, border-color 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--stu-primary)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--stu-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--stu-radius)",
          background: "color-mix(in srgb, var(--stu-primary) 10%, transparent)",
          color: "var(--stu-primary)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {section.icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          {section.title}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--stu-text-muted)",
          }}
        >
          {section.description}
        </div>
      </div>
    </Link>
  );
}

export default function GuidePage() {
  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      <div style={{ marginBottom: "var(--stu-space-6)" }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "var(--stu-text)",
            marginBottom: "var(--stu-space-2)",
          }}
        >
          사용 가이드
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--stu-text-muted)",
            lineHeight: 1.5,
          }}
        >
          각 기능을 누르면 해당 페이지로 이동해요.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--stu-space-3)",
        }}
      >
        {GUIDE_SECTIONS.map((section) => (
          <GuideCard key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}

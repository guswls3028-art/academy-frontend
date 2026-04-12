/**
 * PATH: src/features/guide/pages/AdminGuidePage.tsx
 * 선생앱(관리자) 사용 가이드 — 각 기능별 간단한 설명 카드
 */
import { Link } from "react-router-dom";
import { DomainLayout } from "@/shared/ui/layout";
import { NavIcon } from "@admin/layout/adminNavConfig";

type GuideSection = {
  iconPath: string;
  title: string;
  to: string;
  description: string;
};

const GUIDE_SECTIONS: GuideSection[] = [
  {
    iconPath: "M3 11l9-7 9 7v9H3z",
    title: "대시보드",
    to: "/admin/dashboard",
    description:
      "로그인하면 처음 보이는 화면이에요. 오늘 수업, 최근 알림, 학생 현황 등을 한눈에 볼 수 있어요.",
  },
  {
    iconPath: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0",
    title: "학생 관리",
    to: "/admin/students",
    description:
      "학생 목록을 보고, 새 학생을 등록하거나 정보를 수정할 수 있어요. 학생 상세 페이지에서 수강 강의, 성적, 출결을 한번에 확인할 수 있어요.",
  },
  {
    iconPath: "M4 4h16v12H4zM8 20h8",
    title: "강의/차시 관리",
    to: "/admin/lectures",
    description:
      "강의를 만들고 수강생을 배정할 수 있어요. 각 강의에서 차시(수업 일정)를 추가하고, 차시별로 출결/시험/과제/영상을 관리해요.",
  },
  {
    iconPath: "M7 3h10v18H7zM9 7h6M9 11h6M9 15h4",
    title: "시험 생성 및 채점",
    to: "/admin/exams",
    description:
      "시험을 만들고 답안지를 등록할 수 있어요. 학생이 제출하면 자동 채점되고, 결과를 바로 확인할 수 있어요.",
  },
  {
    iconPath: "M4 18h16M6 15V9M12 15V5M18 15v-7",
    title: "성적 확인",
    to: "/admin/results",
    description:
      "전체 학생의 시험 성적을 한눈에 볼 수 있어요. 강의별, 시험별로 필터링해서 확인할 수 있어요.",
  },
  {
    iconPath: "M3 6h14v12H3zM17 10l4-2v8l-4-2z",
    title: "영상 관리",
    to: "/admin/videos",
    description:
      "강의 영상을 업로드하고 관리할 수 있어요. 차시에 영상을 배정하면 학생이 볼 수 있어요.",
  },
  {
    iconPath: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
    title: "메시지 발송",
    to: "/admin/message",
    description:
      "학생이나 학부모에게 문자 메시지를 보낼 수 있어요. 단체 발송도 가능해요.",
  },
  {
    iconPath: "M4 4h16v12H7l-3 3z",
    title: "커뮤니티",
    to: "/admin/community",
    description:
      "공지사항을 작성하고, 게시판을 관리할 수 있어요. 학생 질문에 답변도 할 수 있어요.",
  },
  {
    iconPath: "M12 21s7-4 7-10a7 7 0 0 0-14 0c0 6 7 10 7 10Z",
    title: "클리닉 관리",
    to: "/admin/clinic",
    description:
      "학생의 부족한 부분을 클리닉으로 관리해요. 항목을 지정하고 해결 여부를 체크할 수 있어요.",
  },
  {
    iconPath: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
    title: "저장소",
    to: "/admin/storage",
    description:
      "파일과 자료를 보관하고 관리할 수 있어요. 학생에게 자료를 배포할 수도 있어요.",
  },
  {
    iconPath: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
    title: "도구",
    to: "/admin/tools",
    description:
      "PPT 생성 등 업무에 도움이 되는 도구를 사용할 수 있어요.",
  },
  {
    iconPath: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    title: "설정",
    to: "/admin/settings",
    description:
      "학원 이름, 프로필, 외관, 구독 등을 설정할 수 있어요.",
  },
];

function GuideCard({ section }: { section: GuideSection }) {
  return (
    <Link
      to={section.to}
      className="group"
      style={{
        display: "flex",
        gap: 16,
        padding: 16,
        borderRadius: 12,
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-divider)",
        textDecoration: "none",
        color: "var(--color-text-primary)",
        transition: "box-shadow 150ms, border-color 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--color-brand-primary)";
        e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-border-divider)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: "color-mix(in srgb, var(--color-brand-primary) 10%, transparent)",
          color: "var(--color-brand-primary)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <NavIcon d={section.iconPath} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          {section.title}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--color-text-secondary)",
          }}
        >
          {section.description}
        </div>
      </div>
    </Link>
  );
}

export default function AdminGuidePage() {
  return (
    <DomainLayout title="사용 가이드" description="각 기능의 사용법을 안내합니다">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 12,
        }}
      >
        {GUIDE_SECTIONS.map((section) => (
          <GuideCard key={section.title} section={section} />
        ))}
      </div>
    </DomainLayout>
  );
}

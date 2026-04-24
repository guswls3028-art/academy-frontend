// PATH: src/app_teacher/domains/profile/pages/DesktopOnlyPage.tsx
// 모바일 미지원 기능 안내 — 수납/자료실/랜딩 편집 등 PC 전용 도메인 진입로
import { useNavigate } from "react-router-dom";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";
import { Card, BackButton, SectionTitle } from "@teacher/shared/ui/Card";
import { Monitor, Award, FolderPlus, FileText, Settings, ChevronRight } from "@teacher/shared/ui/Icons";

type DesktopFeature = {
  icon: React.ReactNode;
  title: string;
  desc: string;
  desktopPath: string;
};

const FEATURES: DesktopFeature[] = [
  {
    icon: <FolderPlus size={20} />,
    title: "매치업 (OCR)",
    desc: "문제 이미지에서 영역을 지정해 매치하는 작업은 큰 캔버스가 필요합니다.",
    desktopPath: "/admin/storage/matchup",
  },
  {
    icon: <FileText size={20} />,
    title: "랜딩 페이지 편집기",
    desc: "학원 홈페이지 디자인·섹션 배치·이미지 업로드는 데스크톱에서 진행하세요.",
    desktopPath: "/admin/settings/landing",
  },
  {
    icon: <Settings size={20} />,
    title: "기능 플래그 / 고급 설정",
    desc: "베타 기능 토글·세부 정책은 PC에서 확인하세요.",
    desktopPath: "/admin/developer/flags",
  },
  {
    icon: <Award size={20} />,
    title: "자료실 전체 뷰",
    desc: "여러 학생·폴더를 한 화면에서 드래그해 이동할 때는 PC가 편합니다.",
    desktopPath: "/admin/storage",
  },
];

export default function DesktopOnlyPage() {
  const navigate = useNavigate();

  const goDesktop = (path?: string) => {
    setPreferAdmin(true);
    if (path) {
      navigate(path);
    } else {
      navigate("/admin");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 py-0.5">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-[17px] font-bold flex-1" style={{ color: "var(--tc-text)" }}>
          PC에서 처리하는 기능
        </h1>
      </div>

      {/* Lead */}
      <Card>
        <div className="text-[13px] leading-relaxed" style={{ color: "var(--tc-text-secondary)" }}>
          아래 기능은 캔버스·드래그 조작이 중심이라 모바일에서 불편합니다.
          버튼을 누르면 데스크톱 모드로 전환됩니다.
        </div>
        <button
          onClick={() => goDesktop()}
          className="flex items-center justify-center gap-2 w-full text-sm font-bold cursor-pointer mt-3"
          style={{
            padding: "12px",
            minHeight: "var(--tc-touch-min)",
            borderRadius: "var(--tc-radius)",
            border: "none",
            background: "var(--tc-primary)",
            color: "#fff",
          }}
        >
          <Monitor size={16} /> 데스크톱 버전으로 이동
        </button>
      </Card>

      <SectionTitle>기능별 바로가기</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {FEATURES.map((f) => (
          <button
            key={f.title}
            onClick={() => goDesktop(f.desktopPath)}
            className="flex items-start gap-3 rounded-xl w-full text-left cursor-pointer"
            style={{
              padding: "var(--tc-space-3) var(--tc-space-4)",
              minHeight: "var(--tc-touch-min)",
              background: "var(--tc-surface)",
              border: "1px solid var(--tc-border)",
            }}
          >
            <span
              className="flex items-center justify-center shrink-0 rounded"
              style={{
                width: 32,
                height: 32,
                background: "var(--tc-primary-bg)",
                color: "var(--tc-primary)",
              }}
            >
              {f.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold" style={{ color: "var(--tc-text)" }}>
                {f.title}
              </div>
              <div className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--tc-text-muted)" }}>
                {f.desc}
              </div>
            </div>
            <ChevronRight size={16} style={{ color: "var(--tc-text-muted)", flexShrink: 0, marginTop: 8 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

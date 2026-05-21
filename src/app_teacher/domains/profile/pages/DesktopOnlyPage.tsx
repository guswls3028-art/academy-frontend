// PATH: src/app_teacher/domains/profile/pages/DesktopOnlyPage.tsx
// 모바일 미지원 기능 안내 — 수납/자료실/랜딩 편집 등 PC 전용 도메인 진입로
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ICON } from "@/shared/ui/ds";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";
import { Card, BackButton, SectionTitle } from "@teacher/shared/ui/Card";
import { Monitor, Award, FolderPlus, FileText, Settings, ChevronRight } from "@teacher/shared/ui/Icons";

import styles from "./DesktopOnlyPage.module.css";

type DesktopFeature = {
  icon: ReactNode;
  title: string;
  desc: string;
  desktopPath: string;
};

const FEATURES: DesktopFeature[] = [
  {
    icon: <FolderPlus size={ICON.lg} />,
    title: "매치업 (OCR)",
    desc: "문제 이미지에서 영역을 지정해 매치하는 작업은 큰 캔버스가 필요합니다.",
    desktopPath: "/admin/storage/matchup",
  },
  {
    icon: <FileText size={ICON.lg} />,
    title: "랜딩 페이지 편집기",
    desc: "학원 홈페이지 디자인·섹션 배치·이미지 업로드는 데스크톱에서 진행하세요.",
    desktopPath: "/admin/settings/landing",
  },
  {
    icon: <Settings size={ICON.lg} />,
    title: "기능 플래그 / 고급 설정",
    desc: "베타 기능 토글·세부 정책은 PC에서 확인하세요.",
    desktopPath: "/admin/developer/flags",
  },
  {
    icon: <Award size={ICON.lg} />,
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
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <BackButton onClick={() => navigate(-1)} />
        <h1 className={styles.title}>
          PC에서 처리하는 기능
        </h1>
      </div>

      {/* Lead */}
      <Card>
        <div className={styles.leadText}>
          아래 기능은 캔버스·드래그 조작이 중심이라 모바일에서 불편합니다.
          버튼을 누르면 데스크톱 모드로 전환됩니다.
        </div>
        <button
          type="button"
          onClick={() => goDesktop()}
          className={styles.primaryButton}
        >
          <Monitor size={ICON.sm} /> 데스크톱 버전으로 이동
        </button>
      </Card>

      <SectionTitle>기능별 바로가기</SectionTitle>
      <div className={styles.featureList}>
        {FEATURES.map((f) => (
          <button
            key={f.title}
            type="button"
            onClick={() => goDesktop(f.desktopPath)}
            className={styles.featureButton}
          >
            <span className={styles.featureIcon}>
              {f.icon}
            </span>
            <div className={styles.featureBody}>
              <div className={styles.featureTitle}>
                {f.title}
              </div>
              <div className={styles.featureDesc}>
                {f.desc}
              </div>
            </div>
            <ChevronRight size={ICON.sm} className={styles.chevron} />
          </button>
        ))}
      </div>
    </div>
  );
}

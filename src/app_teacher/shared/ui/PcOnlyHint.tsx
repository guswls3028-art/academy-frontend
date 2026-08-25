// PATH: src/app_teacher/shared/ui/PcOnlyHint.tsx
// PC 전용 기능 안내 — 모바일에서 미지원 도메인 진입 시 표시.
// "PC 버전" 버튼으로 데스크톱 업무 라우트로 즉시 전환.
import { useNavigate } from "react-router";
import { ICON } from "@/shared/ui/ds";
import { setPreferFullWorkspace } from "@/core/router/MobileWorkspaceRedirect";
import { Monitor, ChevronLeft } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import styles from "./PcOnlyHint.module.css";

interface Props {
  title: string;
  description?: string;
  /** 데스크톱에서 열 통합 업무 경로 (예: "/workspace/fees") */
  desktopPath: string;
  /** 사유 (왜 모바일에서 못 하는지) */
  reason?: string;
}

export default function PcOnlyHint({ title, description, desktopPath, reason }: Props) {
  const navigate = useNavigate();

  const openDesktop = () => {
    setPreferFullWorkspace(true);
    window.location.href = desktopPath;
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={styles.backButton}
        >
          <ChevronLeft size={ICON.lg} />
        </button>
        <h1 className={styles.title}>
          {title}
        </h1>
      </div>

      <Card>
        <div className={styles.content}>
          <div className={styles.iconWrap}>
            <Monitor size={ICON.xl} />
          </div>
          <div className={styles.heading}>
            PC 버전에서 사용해 주세요
          </div>
          {description && (
            <div className={styles.description}>
              {description}
            </div>
          )}
          {reason && (
            <div className={styles.reason}>
              {reason}
            </div>
          )}

          <button
            type="button"
            onClick={openDesktop}
            className={styles.desktopButton}
          >
            <Monitor size={ICON.xs} /> PC 버전
          </button>
        </div>
      </Card>
    </div>
  );
}

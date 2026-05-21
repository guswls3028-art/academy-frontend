// PATH: src/app_teacher/shared/ui/PcOnlyHint.tsx
// PC 전용 기능 안내 — 모바일에서 미지원 도메인 진입 시 표시.
// "데스크톱 버전 열기" 버튼으로 admin 라우트로 즉시 전환.
import { useNavigate } from "react-router-dom";
import { ICON } from "@/shared/ui/ds";
import { setPreferAdmin } from "@/core/router/MobileTeacherRedirect";
import { Monitor, ChevronLeft } from "@teacher/shared/ui/Icons";
import { Card } from "@teacher/shared/ui/Card";
import styles from "./PcOnlyHint.module.css";

interface Props {
  title: string;
  description?: string;
  /** 데스크톱에서 열 admin 경로 (예: "/admin/fees") */
  desktopPath: string;
  /** 사유 (왜 모바일에서 못 하는지) */
  reason?: string;
}

export default function PcOnlyHint({ title, description, desktopPath, reason }: Props) {
  const navigate = useNavigate();

  const openDesktop = () => {
    setPreferAdmin(true);
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
            PC에서 처리해주세요
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
            <Monitor size={ICON.xs} /> 데스크톱 버전 열기
          </button>
        </div>
      </Card>
    </div>
  );
}

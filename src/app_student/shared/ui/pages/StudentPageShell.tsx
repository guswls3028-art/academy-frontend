// PATH: src/app_student/shared/components/StudentPageShell.tsx

import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { IconChevronRight } from "../icons/Icons";

export default function StudentPageShell({
  title,
  description,
  actions,
  children,
  onBack,
  /** 영상 강의/차시 상세처럼 배경을 검정으로 채울 때 사용. .stu-section 외곽 박스/패딩 제거 */
  noSectionFrame,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  noSectionFrame?: boolean;
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          {onBack && (
            <button
              type="button"
              onClick={handleBack}
              className="stu-back-btn"
              style={{ marginBottom: 10 }}
            >
              <IconChevronRight style={{ width: 16, height: 16, transform: "rotate(180deg)" }} />
              <span>뒤로</span>
            </button>
          )}
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</div>
          {description && (
            <div className="stu-muted" style={{ marginTop: 4 }}>
              {description}
            </div>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>

      <div className={noSectionFrame ? "stu-section stu-section--video-page" : "stu-section"}>
        {children}
      </div>
    </div>
  );
}

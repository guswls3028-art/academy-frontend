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
  const hasHeader = Boolean(title || description || actions || onBack);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="student-page-shell">
      {hasHeader && (
        <header className="student-page-shell__header">
          <div className="student-page-shell__copy">
            {onBack && (
              <button
                type="button"
                onClick={handleBack}
                className="stu-back-btn student-page-shell__back"
              >
                <IconChevronRight className="student-page-shell__back-icon" />
                <span>뒤로</span>
              </button>
            )}
            {title && <h1 className="student-page-shell__title">{title}</h1>}
            {description && (
              <p className="student-page-shell__description">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="student-page-shell__actions">{actions}</div>}
        </header>
      )}

      <div className={`${noSectionFrame ? "stu-section stu-section--video-page" : "stu-section"} student-page-shell__section`}>
        {children}
      </div>
    </div>
  );
}

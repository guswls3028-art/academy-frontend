import { useEffect, useId, useRef, useState } from "react";
import BugReportForm from "./feedback/BugReportForm";

type Props = {
  recovering: boolean;
  route: string;
  sentryEventId?: string;
  onReload: () => void;
};

export default function ErrorRecoveryScreen({ recovering, route, sentryEventId, onReload }: Props) {
  const titleId = useId();
  const reportButton = useRef<HTMLButtonElement>(null);
  const restoreReportFocus = useRef(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!reportOpen && restoreReportFocus.current) {
      reportButton.current?.focus();
      restoreReportFocus.current = false;
    }
  }, [reportOpen]);

  return (
    <div className="error-recovery">
      <section className="error-recovery__card" aria-labelledby={titleId}>
        {!reportOpen && <span className="error-recovery__mark" aria-hidden="true">!</span>}
        <h1 id={titleId}>
          {reportOpen ? "버그 제보" : "화면을 불러오지 못했어요"}
        </h1>
        {reportOpen ? (
          <BugReportForm
            route={route}
            sentryEventId={sentryEventId}
            onReload={onReload}
            onClose={() => setReportOpen(false)}
          />
        ) : (
          <>
            <p role={recovering ? "status" : "alert"}>
              {recovering
                ? "새 버전을 반영하고 있어요. 잠시 후 자동으로 다시 불러옵니다."
                : "다시 불러와 보고, 문제가 계속되면 제보해 주세요."}
            </p>
            <div className="error-recovery__actions">
              <button type="button" data-primary onClick={onReload}>다시 불러오기</button>
              {!recovering && (
                <button
                  ref={reportButton}
                  type="button"
                  onClick={() => {
                    restoreReportFocus.current = true;
                    setReportOpen(true);
                  }}
                >
                  버그 제보
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

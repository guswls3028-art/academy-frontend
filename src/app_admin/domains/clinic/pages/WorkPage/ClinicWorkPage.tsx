import { useSearchParams } from "react-router";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { renderLazyRoute } from "@/core/router/renderLazyRoute";
import styles from "./ClinicWorkPage.module.css";

const ClinicOperationsConsolePage = lazy(() => import("../OperationsConsolePage/ClinicOperationsConsolePage"));
const ClinicBookingsPage = lazy(() => import("../BookingsPage/ClinicBookingsPage"));

export default function ClinicWorkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isUnresolved = searchParams.get("panel") === "unresolved";

  const changeView = (unresolved: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (unresolved) next.set("panel", "unresolved");
    else next.delete("panel");
    setSearchParams(next);
  };

  return (
    <div className={styles.page}>
      <nav className={styles.switcher} aria-label="클리닉 운영 화면">
        <div className={styles.switcherCopy}>
          <strong>클리닉 운영</strong>
          <span>예약·출석은 날짜별로, 미통과 항목은 기간 전체에서 처리합니다.</span>
        </div>
        <div className={styles.switcherButtons}>
          <button type="button" className={!isUnresolved ? styles.active : ""}
            aria-current={!isUnresolved ? "page" : undefined}
            onClick={() => changeView(false)}>예약·출석</button>
          <button type="button" className={isUnresolved ? styles.active : ""}
            aria-current={isUnresolved ? "page" : undefined}
            onClick={() => changeView(true)}>미통과 처리 · 전체 기간</button>
        </div>
      </nav>
      {isUnresolved ? renderLazyRoute(ClinicBookingsPage) : renderLazyRoute(ClinicOperationsConsolePage)}
    </div>
  );
}

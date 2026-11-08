import { useSearchParams } from "react-router";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { renderLazyRoute } from "@/core/router/renderLazyRoute";
import styles from "./ClinicWorkPage.module.css";

const ClinicOperationsConsolePage = lazy(() => import("../OperationsConsolePage/ClinicOperationsConsolePage"));
const ClinicBookingsPage = lazy(() => import("../BookingsPage/ClinicBookingsPage"));
const ClinicReservationSearch = lazy(() => import("./ClinicReservationSearch"));

const PANELS = [
  { key: "day", label: "예약·출석", component: ClinicOperationsConsolePage },
  { key: "reservations", label: "예약 검색", component: ClinicReservationSearch },
  { key: "unresolved", label: "미통과 처리 · 전체 기간", component: ClinicBookingsPage },
] as const;

export default function ClinicWorkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = PANELS.find(({ key }) => key === searchParams.get("panel")) ?? PANELS[0];

  return (
    <div className={styles.page}>
      <nav className={styles.switcher} aria-label="클리닉 운영 화면">
        <div className={styles.switcherCopy}>
          <strong>클리닉 운영</strong>
          <span>날짜별 출석, 학생 예약 검색, 미통과 처리를 한 곳에서 확인합니다.</span>
        </div>
        <div className={styles.switcherButtons}>
          {PANELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={key === current.key ? styles.active : ""}
              aria-current={key === current.key ? "page" : undefined}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (key === "day") next.delete("panel");
                else next.set("panel", key);
                setSearchParams(next);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      {renderLazyRoute(current.component)}
    </div>
  );
}

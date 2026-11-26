import { dawonStaffPreviewRole } from "@/shared/product/dawon/staffPreview";
import { useSearchParams } from "react-router";
import { lazyWithRetry as lazy } from "@/shared/utils/lazyWithRetry";
import { renderLazyRoute } from "@/core/router/renderLazyRoute";
import "../../clinic.css";
import styles from "./ClinicWorkPage.module.css";

const ClinicOperationsConsolePage = lazy(() => import("../OperationsConsolePage/ClinicOperationsConsolePage"));
const ClinicBookingsPage = lazy(() => import("../BookingsPage/ClinicBookingsPage"));
const ClinicReservationSearch = lazy(() => import("./ClinicReservationSearch"));

const ClinicRequests = lazy(() => import("@/shared/product/dawon/DawonTeacherClinicRequests"));

const PANELS = [
  { key: "day", label: "예약·출석", component: ClinicOperationsConsolePage },
  { key: "reservations", label: "예약 검색", component: ClinicReservationSearch },
  { key: "unresolved", label: "미통과 처리 · 전체 기간", component: ClinicBookingsPage },
] as const;

export default function ClinicWorkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const role=dawonStaffPreviewRole();
  const dedicated=role==="teacher" || role==="admin";
  const applications={key:"applications",label:"신청 현황",component:ClinicRequests};
  const panels=dedicated ? [applications,...(role==="admin" ? PANELS : PANELS.filter(panel=>panel.key!=="unresolved"))] : PANELS;
  const defaultPanel=dedicated && !searchParams.has("date") && !searchParams.has("session") && !searchParams.has("scope")
    ? applications : PANELS[0];
  const current=panels.find(({key})=>key===searchParams.get("panel")) ?? defaultPanel;

  const content=(
    <div className={styles.page}>
      <nav className={styles.switcher} aria-label="클리닉 운영 화면">
        <div className={styles.switcherCopy}>
          <strong>클리닉 운영</strong>
          <span>{dedicated ? "신청을 처리하고 날짜별 출석과 학생 예약을 확인합니다." : "날짜별 출석, 학생 예약 검색, 미통과 처리를 한 곳에서 확인합니다."}</span>
        </div>
        <div className={styles.switcherButtons}>
          {panels.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={key === current.key ? styles.active : ""}
              aria-current={key === current.key ? "page" : undefined}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("record");
                if (key === "day" && !dedicated) next.delete("panel");
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
  return content;
}

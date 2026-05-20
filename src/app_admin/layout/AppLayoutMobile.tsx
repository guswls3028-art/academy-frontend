/**
 * 선생앱 모바일 전용 레이아웃: 상단 헤더 + 메인 스크롤 + 하단 탭바. 네비는 드로어로.
 */
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import AdminNavDrawer from "./AdminNavDrawer";
import TeacherBottomBar from "./TeacherBottomBar";
import { AsyncStatusBar } from "@/shared/ui/asyncStatus";
import styles from "./AppLayoutMobile.module.css";

export default function AppLayoutMobile() {
  const location = useLocation();
  return (
    <div data-app="admin" className={styles.root}>
      <header className={styles.header}>
        <Header />
      </header>

      <main className={styles.main}>
        <Outlet key={location.pathname} />
      </main>

      <AdminNavDrawer />
      <TeacherBottomBar />
      <AsyncStatusBar />
    </div>
  );
}

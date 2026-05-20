/**
 * 선생앱 모바일 전용: 하단 탭바. 홈/학생/강의/커뮤니티/메뉴(드로어)
 */
import { NavLink } from "react-router-dom";
import { useAdminLayout } from "./useAdminLayout";
import { ADMIN_MOBILE_TABS, NavIcon } from "./adminNavConfig";
import styles from "./TeacherBottomBar.module.css";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export default function TeacherBottomBar() {
  const layout = useAdminLayout();

  return (
    <nav
      aria-label="하단 메뉴"
      className={cx("teacher-tabbar", styles.root)}
    >
      <div className={styles.items}>
        {ADMIN_MOBILE_TABS.map((t) => {
          if (t.to === "") {
            return (
              <button
                key="menu"
                type="button"
                onClick={() => layout?.openDrawer()}
                className={cx(styles.item, styles.menuButton)}
              >
                <span className={styles.icon}>
                  <NavIcon d={t.iconPath} />
                </span>
                <span className={styles.label}>{t.label}</span>
              </button>
            );
          }
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) => cx(styles.item, isActive && styles.itemActive)}
            >
              <span className={styles.icon}>
                <NavIcon d={t.iconPath} />
              </span>
              <span className={styles.label}>{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

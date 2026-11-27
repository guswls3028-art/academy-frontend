import styles from "./Sidebar.module.css";
import AdminPrimaryNavigation from "./AdminPrimaryNavigation";

export default function Sidebar({ collapsed, onExpand }: { collapsed: boolean; onExpand: () => void }) {
  return (
    <div className={`sidebar-shell ${styles.shell}`}>
      <div className={`sidebar-scroll ${styles.scroll}`}>
        <AdminPrimaryNavigation compact={collapsed} onExpandSidebar={collapsed ? onExpand : undefined} />
      </div>
    </div>
  );
}

import styles from "./Sidebar.module.css";
import AdminPrimaryNavigation from "./AdminPrimaryNavigation";

export default function Sidebar({ collapsed, onExpand }: { collapsed: boolean; onExpand: () => void }) {
  return (
    <aside id="admin-workspace-sidebar" className={`sidebar sidebar-shell ${styles.shell}`} data-analytics-placement="admin.sidebar">
      <div className={`sidebar-scroll ${styles.scroll}`}>
        <AdminPrimaryNavigation compact={collapsed} onExpandSidebar={collapsed ? onExpand : undefined} />
      </div>
    </aside>
  );
}

import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Tabs } from "antd";

export default function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = location.pathname.includes("/operations")
    ? "operations"
    : location.pathname.includes("/reports")
    ? "reports"
    : "home";

  return (
    <div className="p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">직원 관리</div>
      </div>

      {/* 로컬 네비게이션 */}
      <Tabs
        activeKey={activeKey}
        onChange={(key) => navigate(`/admin/staff/${key}`)}
        items={[
          { key: "home", label: "홈" },
          { key: "operations", label: "작업" },
          { key: "reports", label: "리포트" },
        ]}
      />

      {/* 페이지 */}
      <Outlet />
    </div>
  );
}

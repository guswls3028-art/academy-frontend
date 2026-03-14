import { Routes, Route, Navigate } from "react-router-dom";
import { DevToastProvider } from "@/dev_app/components/DevToast";
import DevLayout from "@/dev_app/layout/DevLayout";
import DashboardPage from "@/dev_app/pages/DashboardPage";
import TenantsPage from "@/dev_app/pages/TenantsPage";
import TenantDetailPage from "@/dev_app/pages/TenantDetailPage";
import AgentMonitorPage from "@/dev_app/pages/AgentMonitorPage";

export default function DevAppRouter() {
  return (
    <DevToastProvider>
      <Routes>
        <Route element={<DevLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="tenants/:tenantId" element={<TenantDetailPage />} />
          <Route path="agents" element={<AgentMonitorPage />} />
          {/* Legacy paths redirect to new structure */}
          <Route path="home" element={<Navigate to="/dev/dashboard" replace />} />
          <Route path="branding" element={<Navigate to="/dev/tenants" replace />} />
          <Route path="branding/:tenantId" element={<Navigate to="/dev/tenants" replace />} />
          <Route path="branding/:tenantId/*" element={<Navigate to="/dev/tenants" replace />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </DevToastProvider>
  );
}

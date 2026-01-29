import { Outlet } from "react-router-dom";
import { ConfigProvider } from "antd";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useTheme } from "@/context/ThemeContext";

export default function AppLayout() {
  const { theme } = useTheme();

  return (
    <ConfigProvider
      theme={{
        /** 🔥 algorithm 완전 차단 (단일 진실 유지 핵심) */
        algorithm: false,

        token: {
          /* ===== Brand ===== */
          colorPrimary: "var(--color-primary)",

          /* ===== Background ===== */
          colorBgBase: "var(--bg-app)",
          colorBgLayout: "var(--bg-app)",
          colorBgContainer: "var(--bg-surface)",
          colorBgElevated: "var(--bg-surface)",

          /* ===== Border ===== */
          colorBorder: "var(--border-divider)",

          /* ===== Text ===== */
          colorText: "var(--text-primary)",
          colorTextSecondary: "var(--text-secondary)",
          colorTextTertiary: "var(--text-muted)",
          colorTextQuaternary: "var(--text-disabled)",
          colorTextPlaceholder: "var(--text-muted)",

          /* ===== Fill (hover / active) ===== */
          colorFillSecondary: "var(--bg-surface-soft)",
          colorFillTertiary: "var(--bg-surface-soft)",
        },

        components: {
          Segmented: {
            itemColor: "var(--text-secondary)",
            itemHoverColor: "var(--text-primary)",
            itemSelectedColor: "var(--text-on-primary)",
            itemSelectedBg: "var(--color-primary)",
            trackBg: "var(--bg-surface-soft)",
            borderRadius: 8,
          },

          Button: {
            colorPrimary: "var(--color-primary)",
            colorTextLightSolid: "var(--text-on-primary)",
            borderRadius: 8,
          },

          Checkbox: {
            colorPrimary: "var(--color-primary)",
          },

          /** 🔥 Table 기본 헤더 침범 완전 차단 */
          Table: {
            headerBg: "var(--bg-surface-soft)",
            headerColor: "var(--text-secondary)",
            headerSplitColor: "var(--border-divider)",
            rowHoverBg: "var(--bg-surface-soft)",
            borderColor: "var(--border-divider)",
          },
        },
      }}
    >
      <div className="flex min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ConfigProvider>
  );
}

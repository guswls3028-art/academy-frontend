// PATH: src/shared/ui/layout/AppLayout.tsx

import { Outlet } from "react-router-dom";
import { ConfigProvider } from "antd";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useTheme } from "@/context/ThemeContext";

export default function AppLayout() {
  useTheme(); // theme 값 자체는 data-theme 트리거용

  return (
    <ConfigProvider
      theme={{
        /** 🔒 AntD algorithm 완전 차단 */
        algorithm: false,

        token: {
          /* ===== Brand ===== */
          colorPrimary: "var(--color-brand-primary)",

          /* ===== Background ===== */
          colorBgBase: "var(--color-bg-canvas)",
          colorBgLayout: "var(--color-bg-canvas)",
          colorBgContainer: "var(--color-bg-surface)",
          colorBgElevated: "var(--color-bg-surface)",

          /* ===== Border ===== */
          colorBorder: "var(--color-border-divider)",

          /* ===== Text ===== */
          colorText: "var(--color-text-primary)",
          colorTextSecondary: "var(--color-text-secondary)",
          colorTextTertiary: "var(--color-text-muted)",
          colorTextQuaternary: "var(--color-text-disabled)",
          colorTextPlaceholder: "var(--color-text-muted)",

          /* ===== Fill (hover / active) ===== */
          colorFillSecondary: "var(--color-bg-surface-hover)",
          colorFillTertiary: "var(--color-bg-surface-hover)",
        },

        components: {
          Segmented: {
            itemColor: "var(--color-text-secondary)",
            itemHoverColor: "var(--color-text-primary)",
            itemSelectedColor: "var(--color-text-inverse)",
            itemSelectedBg: "var(--color-brand-primary)",
            trackBg: "var(--color-bg-surface-hover)",
            borderRadius: 8,
          },

          Button: {
            colorPrimary: "var(--color-brand-primary)",
            colorTextLightSolid: "var(--color-text-inverse)",
            borderRadius: 8,
          },

          Checkbox: {
            colorPrimary: "var(--color-brand-primary)",
          },

          /** 🔒 Table 헤더 침범 완전 차단 */
          Table: {
            headerBg: "var(--color-bg-surface-hover)",
            headerColor: "var(--color-text-secondary)",
            headerSplitColor: "var(--color-border-divider)",
            rowHoverBg: "var(--color-bg-surface-hover)",
            borderColor: "var(--color-border-divider)",
          },
        },
      }}
    >
      <div className="flex min-h-screen bg-[var(--color-bg-canvas)] text-[var(--color-text-primary)]">
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

/**
 * 선생앱 모바일: 드로어 열기/닫기. AppLayout(모바일)에서만 제공.
 */
import { createContext, useContext, useCallback, useState } from "react";

type AdminLayoutContextValue = {
  openDrawer: () => void;
  closeDrawer: () => void;
  drawerOpen: boolean;
};

const AdminLayoutContext = createContext<AdminLayoutContextValue | null>(null);

export function AdminLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  return (
    <AdminLayoutContext.Provider
      value={{ openDrawer, closeDrawer, drawerOpen }}
    >
      {children}
    </AdminLayoutContext.Provider>
  );
}

export function useAdminLayout() {
  const ctx = useContext(AdminLayoutContext);
  return ctx;
}

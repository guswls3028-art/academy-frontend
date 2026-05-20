/**
 * 선생앱 모바일: 드로어 열기/닫기. AppLayout(모바일)에서만 제공.
 */
import { useCallback, useState } from "react";
import { AdminLayoutContext } from "./adminLayoutState";

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

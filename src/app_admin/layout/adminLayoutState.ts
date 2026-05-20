import { createContext } from "react";

export type AdminLayoutContextValue = {
  openDrawer: () => void;
  closeDrawer: () => void;
  drawerOpen: boolean;
};

export const AdminLayoutContext = createContext<AdminLayoutContextValue | null>(null);

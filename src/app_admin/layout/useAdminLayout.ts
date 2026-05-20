import { useContext } from "react";
import { AdminLayoutContext } from "./adminLayoutState";

export function useAdminLayout() {
  return useContext(AdminLayoutContext);
}

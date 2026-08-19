import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStaffMe } from "@/shared/staff/api";
import { staffQueryKeys } from "@admin/domains/staff/queryKeys";
import useAuth from "@/auth/hooks/useAuth";
import { useProgram } from "@/shared/program";
import { ADMIN_NAV_GROUPS } from "./adminNavConfig";

export function useAvailableAdminNavigation() {
  const { data: staffMe } = useQuery({
    queryKey: staffQueryKeys.me,
    queryFn: fetchStaffMe,
  });
  const { program } = useProgram();
  const { user } = useAuth();

  return useMemo(() => {
    const isStaffAdmin = Boolean(staffMe?.is_payroll_manager);
    const isTenantAdmin = user?.tenantRole === "owner"
      || user?.tenantRole === "admin"
      || Boolean(user?.is_superuser);
    const flags = program?.feature_flags ?? {};

    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => (
        (!item.requiresStaffAdmin || isStaffAdmin)
        && (!item.requiresTenantAdmin || isTenantAdmin)
        && (!item.requiresFeatureFlag || Boolean(flags[item.requiresFeatureFlag]))
      )),
    })).filter((group) => group.items.length > 0);
  }, [program?.feature_flags, staffMe?.is_payroll_manager, user?.is_superuser, user?.tenantRole]);
}

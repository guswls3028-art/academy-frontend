// PATH: src/app_teacher/shared/ui/RoleGuard.tsx
// 원장/관리자 전용 페이지 보호
import type { ReactNode } from "react";
import useAuth from "@/auth/hooks/useAuth";
import { EmptyState } from "@/shared/ui/ds";

type TenantRole = "owner" | "admin" | "teacher" | "staff";

interface Props {
  allow: TenantRole[];
  children: ReactNode;
  title?: string;
  message?: string;
}

export default function RoleGuard({ allow, children, title, message }: Props) {
  const { user } = useAuth();
  const role = (user?.tenantRole ?? "") as TenantRole;

  if (!allow.includes(role)) {
    return (
      <EmptyState
        scope="panel"
        tone="error"
        title={title ?? "접근 권한이 없습니다"}
        description={message ?? `이 페이지는 ${allow.map(labelOf).join(" · ")}만 접근할 수 있습니다.`}
      />
    );
  }
  return <>{children}</>;
}

function labelOf(r: TenantRole): string {
  return r === "owner" ? "원장" : r === "admin" ? "관리자" : r === "teacher" ? "강사" : "직원";
}

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { feedback } from "@/shared/ui/feedback/feedback";

type Snapshot = {
  scope: string;
  updatedAt: number;
  counts: Readonly<Record<string, number>> | null;
};

export function useHomeworkReviewForegroundAlert(
  counts: Snapshot["counts"],
  updatedAt: number,
  pendingPath: string,
) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenant = getTenantCodeForApiRequest();
  const scope = tenant && user ? `${tenant}:${user.id}` : "";
  const mountedAt = useRef(Date.now());
  const previous = useRef<Snapshot | undefined>(undefined);

  useEffect(() => {
    if (!scope || updatedAt < mountedAt.current) return;
    const baseline = previous.current;
    if (baseline?.scope === scope && baseline.updatedAt === updatedAt) return;
    previous.current = { scope, updatedAt, counts };
    if (!counts || !baseline?.counts || baseline.scope !== scope || document.visibilityState !== "visible") return;

    const increase = Object.entries(counts).reduce(
      (sum, [id, count]) => sum + Math.max(0, count - (baseline.counts?.[id] ?? 0)),
      0,
    );
    if (increase > 0) {
      feedback.successWithAction({
        message: `확인 대기 과제 제출 ${increase}건 추가`,
        action: { label: "확인 대기 과제 보기", onClick: () => navigate(pendingPath) },
      });
    }
  }, [counts, navigate, pendingPath, scope, updatedAt]);
}

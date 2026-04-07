import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { deleteStaff } from "../api/staff.api";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";

/**
 * 직원 삭제 공통 훅.
 * StaffDetailOverlay 헤더, StaffSettingsTab 모두 이 훅을 사용한다.
 */
export function useDeleteStaff(opts?: {
  /** 삭제 성공 후 이동할 경로. 기본값: /admin/staff/home */
  navigateTo?: string;
  /** 삭제 성공 후 추가 콜백 */
  onSuccess?: () => void;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const navigateTo = opts?.navigateTo ?? "/admin/staff/home";

  return useMutation({
    mutationFn: (staffId: number) => deleteStaff(staffId),
    onSuccess: () => {
      feedback.success("직원이 삭제되었습니다.");
      qc.invalidateQueries({ queryKey: ["staffs"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      opts?.onSuccess?.();
      nav(navigateTo);
    },
    onError: (e: unknown) => {
      feedback.error(extractApiError(e, "직원 삭제에 실패했습니다."));
    },
  });
}

// PATH: src/app_admin/domains/clinic/hooks/useClinicParticipants.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchClinicParticipants,
  patchClinicParticipantStatus,
  ClinicParticipantStatus,
} from "../api/clinicParticipants.api";

export function useClinicParticipants(params: {
  session?: number;
  session_date_from?: string;
  session_date_to?: string;
  status?: ClinicParticipantStatus;
}) {
  const qc = useQueryClient();

  // ✅ Home / Reports 에서 날짜 기반 조회 허용; 예약 신청 목록은 status=pending 만으로 조회 가능(날짜 무관)
  const enabled =
    !!params.session ||
    (!!params.session_date_from && !!params.session_date_to) ||
    params.status === "pending";

  const listQ = useQuery({
    queryKey: ["clinic-participants", params],
    queryFn: () => fetchClinicParticipants(params),
    enabled,
  });

  const patchM = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      patchClinicParticipantStatus(id, payload),
    onSuccess: (_data: unknown, variables: { id: number; payload: any }) => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
      const statusLabel: Record<string, string> = { booked: "승인", attended: "출석", no_show: "결석", cancelled: "취소", rejected: "거절" };
      const label = statusLabel[variables.payload?.status] ?? "변경";
      import("@/shared/ui/feedback/feedback").then(({ feedback }) => feedback.success(`${label} 처리되었습니다.`));
    },
    onError: () => {
      import("@/shared/ui/feedback/feedback").then(({ feedback }) =>
        feedback.error("클리닉 참가자 상태 변경에 실패했습니다.")
      );
    },
  });

  return { listQ, patchM };
}

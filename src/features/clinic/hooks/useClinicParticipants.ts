// PATH: src/features/clinic/hooks/useClinicParticipants.ts
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
  });

  return { listQ, patchM };
}

import { useClinicClock } from "@/shared/ui/clinic/useClinicClock";
import { useQuery } from "@tanstack/react-query";
import { isOngoingPreviousClinic } from "@/shared/ui/clinic/clinicTimeRange";
import { fetchClinicSessionTree } from "../../api/clinicSessions.api";
import { clinicQueryKeys } from "../../queryKeys";

export default function OngoingClinicSessions({ onSelect }: {
  onSelect: (date: string, sessionId: number) => void;
}) {
  const now = useClinicClock();
  const yesterday = now.subtract(1, "day");
  const year = yesterday.year();
  const month = yesterday.month() + 1;
  const sessionsQ = useQuery({
    queryKey: clinicQueryKeys.sessionsTreeByMonth(year, month),
    queryFn: () => fetchClinicSessionTree({ year, month }),
    refetchInterval: 10_000,
    retry: 0,
  });
  const ongoing = (sessionsQ.data ?? []).filter((session) => isOngoingPreviousClinic(session, now));
  if (ongoing.length === 0 && !sessionsQ.isError) return null;
  return (
    <div className="clinic-console__time-rail" role="group" aria-label="전날 시작한 진행 중 클리닉">
      {sessionsQ.isError && <div role="alert">전날 진행 중인 클리닉을 확인하지 못했습니다.
        <button type="button" className="clinic-console__time-button" disabled={sessionsQ.isFetching}
          onClick={() => void sessionsQ.refetch()}>다시 확인</button>
      </div>}
      {ongoing.map((session) => (
        <button key={session.id} type="button" className="clinic-console__time-button"
          onClick={() => onSelect(session.date, session.id)}>
          전날 시작·진행 중 · {session.date} {session.start_time.slice(0, 5)}
        </button>
      ))}
    </div>
  );
}

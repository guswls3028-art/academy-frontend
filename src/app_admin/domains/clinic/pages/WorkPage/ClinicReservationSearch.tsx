import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Badge, Button, EmptyState, type BadgeTone } from "@/shared/ui/ds";
import { fetchClinicParticipants, type ClinicParticipantStatus } from "../../api/clinicParticipants.api";
import { clinicQueryKeys } from "../../queryKeys";

const STATUS: Record<ClinicParticipantStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "승인 대기", tone: "warning" },
  booked: { label: "예약 완료", tone: "primary" },
  attended: { label: "출석", tone: "success" },
  no_show: { label: "결석", tone: "danger" },
  cancelled: { label: "취소", tone: "neutral" },
  rejected: { label: "거절", tone: "danger" },
};

const bookingTimestamp = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

export default function ClinicReservationSearch() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const params = { search };
  const reservations = useQuery({
    queryKey: clinicQueryKeys.participantsList(params),
    queryFn: ({ signal }) => fetchClinicParticipants(params, signal),
    enabled: search.length > 0,
    retry: false,
    staleTime: 30_000,
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = input.trim();
    if (!next) return;
    if (next === search) void reservations.refetch();
    else setSearch(next);
  }

  return (
    <section className="ds-panel grid min-w-0 gap-4 p-4 sm:p-5" aria-labelledby="clinic-reservation-search">
      <div>
        <h2 id="clinic-reservation-search" className="text-base font-bold">예약 검색</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          학생 이름이나 장소로 지난 예약과 예정 예약을 찾을 수 있습니다.
        </p>
      </div>
      <form className="flex items-end gap-2" role="search" aria-label="클리닉 예약 검색" onSubmit={submitSearch}>
        <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold sm:max-w-sm">
          학생 이름 또는 장소
          <input
            className="ds-input min-w-0"
            type="search"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (!event.target.value.trim()) setSearch("");
            }}
            maxLength={100}
            autoComplete="off"
          />
        </label>
        <Button type="submit" intent="primary" disabled={!input.trim()}>검색</Button>
      </form>
      {search && (
        <div aria-busy={reservations.isFetching}>
          {reservations.isPending ? (
            <EmptyState scope="panel" tone="loading" title="예약을 찾는 중…" />
          ) : reservations.isError ? (
            <div role="alert" className="grid justify-items-start gap-2">
              <p>예약을 불러오지 못했습니다.</p>
              <Button onClick={() => void reservations.refetch()}>다시 시도</Button>
            </div>
          ) : reservations.data.length === 0 ? (
            <EmptyState scope="panel" tone="empty" title="검색 결과가 없습니다." description="학생 이름이나 장소를 확인하고 다시 검색해 주세요." />
          ) : (
            <ul aria-label="예약 검색 결과" className="grid gap-2">
              {reservations.data.map((row) => {
                const status = STATUS[row.status] ?? { label: "상태 확인 필요", tone: "muted" };
                const registered = row.created_at ? new Date(row.created_at) : null;
                const sessionLink = new URLSearchParams({
                  scope: "day",
                  date: row.session_date,
                  session: String(row.session),
                });
                return (
                  <li key={row.id} className="grid min-w-0 gap-2 rounded-xl border border-[var(--color-border-divider)] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="min-w-0 break-words">{row.student_name} · {row.session_title || "클리닉"}</strong>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-[var(--color-text-secondary)]">클리닉 일정</dt>
                        <dd>
                          {row.booking_start_date ?? row.session_date}{" "}
                          {(row.booking_start_time ?? row.preferred_start_time ?? row.session_start_time)?.slice(0, 5)}
                          {row.session_location && <> · {row.session_location}</>}
                        </dd>
                      </div>
                      {registered && Number.isFinite(registered.getTime()) && (
                        <div>
                          <dt className="text-[var(--color-text-secondary)]">등록 시각</dt>
                          <dd><time dateTime={row.created_at}>{bookingTimestamp.format(registered)}</time></dd>
                        </div>
                      )}
                    </dl>
                    <Link
                      className="justify-self-start text-sm font-semibold text-[var(--color-brand-primary)] underline underline-offset-4"
                      to={"/workspace/clinic/operations?" + sessionLink.toString()}
                    >
                      해당 일정 열기
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

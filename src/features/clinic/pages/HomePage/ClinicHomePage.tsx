// PATH: src/features/clinic/pages/HomePage/ClinicHomePage.tsx
// 클리닉 홈 — 오늘 일정 리스트, 예약대상자 리스트, 예약신청자 리스트 + 자동 승인 설정

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { DatePicker } from "@/shared/ui/date";
import { Button } from "@/shared/ui/ds";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import { useClinicTargets } from "../../hooks/useClinicTargets";
import { fetchClinicSettings, updateClinicSettings } from "../../api/clinicSettings.api";
import { patchClinicParticipantStatus } from "../../api/clinicParticipants.api";
import ClinicTodaySummary from "../../components/home/ClinicTodaySummary";

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

function weekRangeISO(base: string) {
  const d = dayjs(base);
  const start = d.startOf("week").add(1, "day");
  const end = start.add(6, "day");
  return { from: start.format("YYYY-MM-DD"), to: end.format("YYYY-MM-DD") };
}

export default function ClinicHomePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const wk = useMemo(() => weekRangeISO(date), [date]);

  const todayQ = useClinicParticipants({
    session_date_from: date,
    session_date_to: date,
  });
  const weekQ = useClinicParticipants({
    session_date_from: wk.from,
    session_date_to: wk.to,
  });
  const targetsQ = useClinicTargets();
  const pendingQ = useClinicParticipants({
    status: "pending",
  });
  const settingsQ = useQuery({
    queryKey: ["clinic-settings"],
    queryFn: fetchClinicSettings,
  });

  const bookedEnrollmentIds = useMemo(() => {
    const set = new Set<number>();
    (weekQ.listQ.data ?? []).forEach((p) => {
      if (!p.enrollment_id || p.status === "cancelled") return;
      set.add(p.enrollment_id);
    });
    return set;
  }, [weekQ.listQ.data]);

  const requiredCount = useMemo(() => {
    const targets = targetsQ.data ?? [];
    return targets.filter((t) => !bookedEnrollmentIds.has(t.enrollment_id)).length;
  }, [targetsQ.data, bookedEnrollmentIds]);

  const targetsList = (targetsQ.data ?? []) as { enrollment_id: number; student_name: string }[];
  const pendingList = pendingQ.listQ.data ?? [];
  const autoApproved = !!settingsQ.data?.auto_approve_booking;

  const updateAutoApprovedM = useMutation({
    mutationFn: (on: boolean) =>
      updateClinicSettings(undefined, undefined, on),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-settings"] });
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? err?.message ?? "자동 승인 설정 저장에 실패했습니다.";
      console.error("[Clinic] auto_approve_booking PATCH failed:", err?.response?.status, msg);
      alert(`자동 승인 설정을 저장할 수 없습니다. ${typeof msg === "string" ? msg : ""}`);
    },
  });

  const patchStatusM = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "booked" | "rejected" }) =>
      patchClinicParticipantStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
    },
  });

  return (
    <div className="clinic-page clinic-home">
      <div className="clinic-toolbar">
        <DatePicker value={date} onChange={setDate} placeholder="날짜" />
      </div>

      {/* 1. 오늘 클리닉 일정 — 섹션 */}
      <ClinicTodaySummary
        date={date}
        rows={todayQ.listQ.data ?? []}
        loading={todayQ.listQ.isLoading}
        onGoOperations={() => nav("/admin/clinic/operations")}
        onGoBookings={() => nav("/admin/clinic/bookings")}
      />

      {/* 2. 예약대상자 · 예약신청 — 섹션형 2열 */}
      <div className="clinic-home__row border-b border-[var(--color-border-divider)] pb-8">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
          <div className="clinic-home__section lg:border-r lg:border-b-0 lg:pr-8 lg:pr-[var(--space-8)]">
          <div className="clinic-home__header flex items-center justify-between gap-4">
            <div>
              <h2 className="clinic-home__title">예약 대상자</h2>
              <p className="clinic-home__meta">
                이번 주 미예약 {requiredCount}명
              </p>
            </div>
            <Button
              type="button"
              intent="primary"
              size="sm"
              onClick={() => nav("/admin/clinic/bookings?focus=required")}
            >
              관리
            </Button>
          </div>
          <div className="clinic-home__body">
            {targetsQ.isLoading && (
              <p className="text-sm text-[var(--color-text-muted)]">불러오는 중…</p>
            )}
            {!targetsQ.isLoading && targetsList.length === 0 && (
              <p className="ds-section__empty">대상자가 없습니다.</p>
            )}
            {!targetsQ.isLoading && targetsList.length > 0 && (
              <ul className="space-y-2 max-h-[240px] overflow-auto">
                {targetsList.map((t) => (
                  <li
                    key={t.enrollment_id}
                    className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-[var(--color-bg-surface-soft)] border border-[var(--color-border-divider)]"
                  >
                    <span className="font-medium text-[var(--color-text-primary)] truncate">
                      {t.student_name}
                    </span>
                    {bookedEnrollmentIds.has(t.enrollment_id) ? (
                      <span className="text-xs text-[var(--color-success)] shrink-0">예약됨</span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)] shrink-0">미예약</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="clinic-home__section lg:pl-8 lg:pl-[var(--space-8)]">
          <div className="clinic-home__header flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="clinic-home__title">예약 신청</h2>
              <p className="clinic-home__meta">승인 대기 {pendingList.length}건</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoApproved}
                onChange={(e) => updateAutoApprovedM.mutate(e.target.checked)}
                disabled={updateAutoApprovedM.isPending || settingsQ.isError}
                className="rounded border-[var(--color-border-divider)]"
                aria-describedby={settingsQ.isError ? "clinic-auto-approve-error" : undefined}
              />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                자동 승인
              </span>
            </label>
            {settingsQ.isError && (
              <p id="clinic-auto-approve-error" className="text-xs text-[var(--color-error)] mt-1 w-full">
                설정을 불러올 수 없습니다. 네트워크 또는 로그인을 확인하세요.
              </p>
            )}
          </div>
          <div className="clinic-home__body">
            {pendingQ.listQ.isLoading && (
              <p className="text-sm text-[var(--color-text-muted)]">불러오는 중…</p>
            )}
            {!pendingQ.listQ.isLoading && pendingList.length === 0 && (
              <p className="ds-section__empty">대기 중인 신청이 없습니다.</p>
            )}
            {!pendingQ.listQ.isLoading && pendingList.length > 0 && (
              <ul className="space-y-2 max-h-[240px] overflow-auto">
                {pendingList.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-[var(--color-bg-surface-soft)] border border-[var(--color-border-divider)]"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--color-text-primary)] truncate">
                        {p.student_name}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {p.session_date ?? "-"} {p.session_start_time?.slice(0, 5) ?? ""} · {p.session_location ?? "-"}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => patchStatusM.mutate({ id: p.id, status: "booked" })}
                        disabled={patchStatusM.isPending}
                        className="text-xs font-semibold px-2 py-1 rounded bg-[var(--color-success)] text-white hover:opacity-90"
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        onClick={() => patchStatusM.mutate({ id: p.id, status: "rejected" })}
                        disabled={patchStatusM.isPending}
                        className="text-xs font-semibold px-2 py-1 rounded bg-[var(--color-error)] text-white hover:opacity-90"
                      >
                        거절
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

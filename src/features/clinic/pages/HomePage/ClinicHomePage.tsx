// PATH: src/features/clinic/pages/HomePage/ClinicHomePage.tsx
// 클리닉 홈 — "오늘의 워크스페이스" 단일 컬럼 레이아웃
// Phase 3: 액션바 + 오늘 일정 타임라인 + 미예약 배너
// Phase 7: 빈 상태 CTA, 조건부 액션바, 세션 미니 진행 표시, "다음" 뱃지

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ko";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useClinicParticipants } from "../../hooks/useClinicParticipants";
import { useClinicTargets } from "../../hooks/useClinicTargets";
import { fetchClinicSettings, updateClinicSettings } from "../../api/clinicSettings.api";
import { patchClinicParticipantStatus, ClinicParticipant } from "../../api/clinicParticipants.api";

dayjs.locale("ko");

function todayISO() {
  return dayjs().format("YYYY-MM-DD");
}

function weekRangeISO(base: string) {
  const d = dayjs(base);
  const start = d.startOf("week").add(1, "day");
  const end = start.add(6, "day");
  return { from: start.format("YYYY-MM-DD"), to: end.format("YYYY-MM-DD") };
}

function nowHHMM() {
  return dayjs().format("HH:mm");
}

function groupBySession(rows: ClinicParticipant[]) {
  const map = new Map<number, ClinicParticipant[]>();
  rows.forEach((r) => {
    if (!r.session) return;
    map.set(r.session, [...(map.get(r.session) ?? []), r]);
  });
  const items = Array.from(map.entries()).map(([sessionId, rs]) => {
    const first = rs[0];
    const time = (first?.session_start_time || "").slice(0, 5) || "-";
    const end = first?.session_end_time ? first.session_end_time.slice(0, 5) : "";
    const location = first?.session_location || "";
    const booked = rs.filter((x) => x.status === "booked").length;
    const attended = rs.filter((x) => x.status === "attended").length;
    const noShow = rs.filter((x) => x.status === "no_show").length;
    const total = rs.length;
    return { sessionId, time, end, location, total, booked, attended, noShow };
  });
  items.sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
  return items;
}

export default function ClinicHomePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const today = todayISO();
  const wk = useMemo(() => weekRangeISO(today), [today]);

  // Re-render every 60s so currentTime, "다음" badge, and past-session detection stay fresh
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTimeTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentTime = nowHHMM();

  const todayQ = useClinicParticipants({
    session_date_from: today,
    session_date_to: today,
  });
  const weekQ = useClinicParticipants({
    session_date_from: wk.from,
    session_date_to: wk.to,
  });
  const targetsQ = useClinicTargets();
  const pendingQ = useClinicParticipants({ status: "pending" });
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

  const pendingList = pendingQ.listQ.data ?? [];
  const autoApproved = !!settingsQ.data?.auto_approve_booking;
  const todayRows = todayQ.listQ.data ?? [];
  const sessions = useMemo(() => groupBySession(todayRows), [todayRows]);
  const noShowCount = todayRows.filter((r) => r.status === "no_show").length;

  // 오늘 출석 요약 계산
  const todaySummary = useMemo(() => {
    const active = todayRows.filter((r) => r.status !== "cancelled");
    const total = active.length;
    const attended = active.filter((r) => r.status === "attended").length;
    return { total, attended };
  }, [todayRows]);

  // Phase 7: 액션바 표시 조건 — 할 일이 있을 때만
  const hasActionableItems = pendingList.length > 0 || noShowCount > 0;

  // Phase 7: "다음" 세션 계산 — 아직 시작 안 된 가장 이른 세션
  const nextSessionId = useMemo(() => {
    const upcoming = sessions.filter((s) => s.time > currentTime);
    return upcoming.length > 0 ? upcoming[0].sessionId : null;
  }, [sessions, currentTime]);

  // --- mutations ---
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
      feedback.error(`자동 승인 설정을 저장할 수 없습니다. ${typeof msg === "string" ? msg : ""}`);
    },
  });

  const patchStatusM = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "booked" | "rejected" }) =>
      patchClinicParticipantStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.allSettled(
        ids.map((id) => patchClinicParticipantStatus(id, { status: "booked" }))
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-participants"] });
      qc.invalidateQueries({ queryKey: ["admin", "notification-counts"] });
    },
  });

  const approveAll = () => {
    bulkApproveMutation.mutate(pendingList.map((p) => p.id));
  };

  const todayLabel = dayjs(today).format("YYYY-MM-DD (dd)");

  return (
    <div className="clinic-page clinic-home clinic-home--workspace">
      {/* ── 1) 액션바: 승인 대기 + 불참 + 자동승인 — 할 일이 없으면 완전 숨김 ── */}
      {hasActionableItems && (
        <div className="clinic-home__action-bar">
          <div className="clinic-home__action-bar-left">
            {pendingList.length > 0 ? (
              <div className="clinic-home__action-bar-group">
                <span className="clinic-home__action-bar-badge clinic-home__action-bar-badge--pending">
                  승인 대기 {pendingList.length}건
                </span>
                <button
                  type="button"
                  className="clinic-home__action-btn clinic-home__action-btn--approve"
                  onClick={approveAll}
                  disabled={bulkApproveMutation.isPending}
                >
                  {bulkApproveMutation.isPending ? "처리 중…" : "일괄 승인"}
                </button>
                <button
                  type="button"
                  className="clinic-home__action-bar-link"
                  onClick={() => nav("/admin/clinic/bookings?focus=pending")}
                >
                  개별 관리
                </button>
              </div>
            ) : null}

            {noShowCount > 0 && (
              <span className="clinic-home__action-bar-badge clinic-home__action-bar-badge--alert">
                불참 {noShowCount}명
              </span>
            )}
          </div>

          <div className="clinic-home__action-bar-right">
            <label className="clinic-home__auto-approve-compact">
              <input
                type="checkbox"
                checked={autoApproved}
                onChange={(e) => updateAutoApprovedM.mutate(e.target.checked)}
                disabled={updateAutoApprovedM.isPending}
                className="clinic-home__auto-approve-checkbox-sm"
              />
              <span className="clinic-home__auto-approve-text-sm">자동 승인</span>
            </label>
            {settingsQ.isError && (
              <span className="clinic-home__body-text clinic-home__body-text--error">
                설정 불러오기 실패
              </span>
            )}
          </div>
        </div>
      )}

      {/* 자동 승인 토글 — 액션바 없을 때만 독립 표시 */}
      {!hasActionableItems && !settingsQ.isLoading && (
        <div className="clinic-home__auto-approve-standalone">
          <label className="clinic-home__auto-approve-compact">
            <input
              type="checkbox"
              checked={autoApproved}
              onChange={(e) => updateAutoApprovedM.mutate(e.target.checked)}
              disabled={updateAutoApprovedM.isPending}
              className="clinic-home__auto-approve-checkbox-sm"
            />
            <span className="clinic-home__auto-approve-text-sm">자동 승인</span>
          </label>
        </div>
      )}

      {/* ── 2) 오늘 일정 타임라인 ── */}
      <div className="clinic-home__section">
        <div className="clinic-home__header">
          <div>
            <h2 className="clinic-home__title">오늘 클리닉 일정</h2>
            <p className="clinic-home__meta">{todayLabel}</p>
          </div>
        </div>

        <div className="clinic-home__body">
          {/* 오늘 출석 요약 한 줄 */}
          {!todayQ.listQ.isLoading && sessions.length > 0 && (
            <p className="clinic-home__today-summary">
              오늘 전체 {todaySummary.total}명 중 출석 {todaySummary.attended}명
            </p>
          )}

          {todayQ.listQ.isLoading && (
            <p className="clinic-home__body-text clinic-home__body-text--muted">불러오는 중…</p>
          )}

          {!todayQ.listQ.isLoading && sessions.length === 0 && (
            <div className="clinic-home__empty-sessions">
              <p className="clinic-home__empty-sessions-text">
                오늘 예정된 클리닉이 없습니다.
              </p>
              <button
                type="button"
                className="clinic-home__empty-sessions-cta"
                onClick={() => nav("/admin/clinic/schedule")}
              >
                <CalendarPlus size={15} aria-hidden />
                일정 관리에서 만들기
              </button>
            </div>
          )}

          {!todayQ.listQ.isLoading && sessions.length > 0 && (
            <ul className="clinic-home__timeline">
              {sessions.map((s) => {
                const isPast = s.end ? s.end <= currentTime : s.time < currentTime;
                const isNext = s.sessionId === nextSessionId;

                return (
                  <li key={s.sessionId} className="clinic-home__timeline-row">
                    <div className="clinic-home__timeline-time">
                      <span className="clinic-home__timeline-time-text">
                        {s.time}{s.end ? `~${s.end}` : ""}
                      </span>
                    </div>

                    <div className={`clinic-home__timeline-card ${isNext ? "clinic-home__timeline-card--next" : ""}`}>
                      <div className="clinic-home__timeline-card-info">
                        {isNext && (
                          <span className="clinic-home__timeline-card-next-badge">다음</span>
                        )}
                        {s.location && (
                          <span className="clinic-home__timeline-card-location">{s.location}</span>
                        )}
                        <span className="clinic-home__timeline-card-fill">
                          {s.booked}/{s.total}명
                          {s.noShow > 0 && (
                            <span className="clinic-home__timeline-card-alert"> · 불참 {s.noShow}</span>
                          )}
                        </span>

                        {isPast && (s.attended > 0 || s.noShow > 0) && (
                          <span className="clinic-home__timeline-card-progress">
                            출석 {s.attended} · 불참 {s.noShow}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="clinic-home__timeline-card-action"
                        onClick={() => nav(`/admin/clinic/operations?date=${today}`)}
                      >
                        출석 확인 →
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── 3) 미예약 배너 — 대상자 있고 미예약자 있을 때만 표시 ── */}
      {!targetsQ.isLoading && (targetsQ.data ?? []).length > 0 && requiredCount > 0 && (
        <button
          type="button"
          className="clinic-home__unbooked-banner"
          onClick={() => nav("/admin/clinic/bookings?focus=required")}
        >
          <span className="clinic-home__unbooked-banner-text">
            이번 주 미예약 학생 <strong>{requiredCount}명</strong>
          </span>
          <span className="clinic-home__unbooked-banner-arrow">예약 탭으로 이동 →</span>
        </button>
      )}
    </div>
  );
}

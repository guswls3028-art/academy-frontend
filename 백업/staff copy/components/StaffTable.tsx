// PATH: src/features/staff/components/StaffTable.tsx

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { lockWorkMonth } from "../api/staffWorkMonthLock.api";

interface Props {
  staffs: any[];
  summaries: Record<number, any>;
  me: any;
  loading: boolean;
  onRefresh?: () => Promise<void> | void;
}

function badgeTone(kind: "locked" | "open") {
  if (kind === "locked") return "bg-red-50 text-red-700 border-red-200";
  return "bg-green-50 text-green-700 border-green-200";
}

export function StaffTable({ staffs, summaries, me, loading, onRefresh }: Props) {
  const navigate = useNavigate();

  const canManagePayroll =
    !!me && (me.is_superuser || me.is_payroll_manager || me.is_staff);

  const rows = useMemo(() => staffs ?? [], [staffs]);

  if (loading) {
    return <div className="py-8 text-center text-[var(--text-muted)]">로딩중...</div>;
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">
        표시할 직원이 없습니다. 필터를 변경하거나 직원을 등록해 주세요.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="grid grid-cols-[240px_140px_140px_160px_220px] gap-4 px-4 py-3 text-xs font-semibold text-[var(--text-muted)] border-b bg-[var(--bg-surface-soft)]">
        <div>직원</div>
        <div>월 상태</div>
        <div>승인 대기</div>
        <div>이번달 요약</div>
        <div className="text-right">빠른 작업</div>
      </div>

      {/* Body */}
      {rows.map((staff) => {
        const summary = summaries?.[staff.id];

        const isLocked = !!summary?.is_locked;
        const pendingCount = Number(summary?.pending_expense_count || 0);

        const year = Number(summary?.year);
        const month = Number(summary?.month);

        const lockDisabledReason = isLocked
          ? "이미 마감된 월입니다."
          : !canManagePayroll
          ? "월 마감은 관리자만 가능합니다."
          : !Number.isFinite(year) || !Number.isFinite(month)
          ? "마감 월 정보(year/month)가 없습니다. (summary 응답 확인 필요)"
          : "";

        return (
          <div
            key={staff.id}
            className="grid grid-cols-[240px_140px_140px_160px_220px] gap-4 px-4 py-3 text-sm border-b last:border-b-0 items-center"
          >
            {/* 직원 */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-semibold truncate">{staff.name}</div>
                {!staff.is_active && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-gray-100 text-gray-700 border-gray-200">
                    비활성
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {staff.pay_type === "MONTHLY" ? "강사(월급)" : "조교(시급)"}
                {staff.phone ? ` · ${staff.phone}` : ""}
              </div>
            </div>

            {/* 월 상태 */}
            <div>
              <span
                className={[
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
                  badgeTone(isLocked ? "locked" : "open"),
                ].join(" ")}
                title={isLocked ? "마감됨(수정 불가)" : "진행중"}
              >
                {isLocked ? "🔒 마감" : "🔓 진행중"}
              </span>
            </div>

            {/* 승인 대기 */}
            <div>
              {pendingCount > 0 ? (
                <button
                  className="text-[var(--color-primary)] font-semibold hover:underline"
                  onClick={() => navigate(`/staffs/${staff.id}?tab=expenses`)}
                  title="승인 대기 비용으로 이동"
                >
                  {pendingCount}건
                </button>
              ) : (
                <span className="text-[var(--text-muted)]">—</span>
              )}
            </div>

            {/* 이번달 요약 */}
            <div>
              <div className="text-xs text-[var(--text-muted)]">
                근무 {Number(summary?.work_hours || 0)}h
              </div>
              <div className="font-semibold">
                {(Number(summary?.total_amount || 0) || 0).toLocaleString()}원
              </div>
            </div>

            {/* 작업 */}
            <div className="flex justify-end gap-2">
              <button
                className="h-[32px] px-3 rounded-lg border border-[var(--border-divider)] text-xs font-semibold hover:bg-[var(--bg-surface-soft)]"
                onClick={() => navigate(`/staffs/${staff.id}?tab=work-records`)}
                title="근무기록으로 이동"
              >
                근무
              </button>

              <button
                className="h-[32px] px-3 rounded-lg border border-[var(--border-divider)] text-xs font-semibold hover:bg-[var(--bg-surface-soft)]"
                onClick={() => navigate(`/staffs/${staff.id}?tab=expenses`)}
                title="비용으로 이동"
              >
                비용
              </button>

              <button
                disabled={!!lockDisabledReason}
                title={
                  lockDisabledReason ||
                  "이번 달 근무/비용을 확정(마감)합니다. 이후 수정/삭제 불가하며 급여 스냅샷이 생성됩니다."
                }
                className={[
                  "h-[32px] px-3 rounded-lg text-xs font-semibold border",
                  lockDisabledReason
                    ? "bg-gray-200 text-gray-600 border-gray-200 cursor-not-allowed"
                    : "bg-red-600 text-white border-red-600 hover:opacity-90",
                ].join(" ")}
                onClick={async () => {
                  if (lockDisabledReason) return;

                  const ok = window.confirm(
                    [
                      `${staff.name}의 ${year}년 ${month}월을 마감할까요?`,
                      "",
                      "- 마감 후에는 근무/비용 수정·삭제가 불가능합니다.",
                      "- 급여 스냅샷(확정 데이터)이 생성됩니다.",
                    ].join("\n")
                  );
                  if (!ok) return;

                  try {
                    await lockWorkMonth({ staff: staff.id, year, month });
                    alert("월 마감이 완료되었습니다.");
                    await onRefresh?.();
                  } catch (e: any) {
                    const msg =
                      e?.response?.data?.message ||
                      e?.response?.data?.detail ||
                      "월 마감에 실패했습니다.";
                    alert(msg);
                  }
                }}
              >
                월 마감
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

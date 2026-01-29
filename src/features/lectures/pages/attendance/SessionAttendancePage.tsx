// src/features/lectures/pages/attendance/SessionAttendancePage.tsx

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAttendance,
  updateAttendance,
} from "@/features/lectures/api/attendance";
import { PageSection } from "@/shared/ui/page";

/* ================= 출결 상수 (색상 통일 HARD CODE) ================= */

const STATUS_BUTTONS = [
  {
    code: "PRESENT",
    label: "현장",
    active: "bg-[var(--color-primary)] text-white border-[var(--color-primary)]",
    idle: "text-[var(--color-primary)] border-[var(--color-primary)]/40",
  },
  {
    code: "LATE",
    label: "지각",
    active: "bg-yellow-500 text-white border-yellow-500",
    idle: "text-yellow-600 border-yellow-400/40",
  },
  {
    code: "ONLINE",
    label: "영상",
    active: "bg-sky-500 text-white border-sky-500",
    idle: "text-sky-600 border-sky-400/40",
  },
  {
    code: "SUPPLEMENT",
    label: "보강",
    active: "bg-violet-500 text-white border-violet-500",
    idle: "text-violet-600 border-violet-400/40",
  },
  {
    code: "EARLY_LEAVE",
    label: "조퇴",
    active: "bg-amber-500 text-white border-amber-500",
    idle: "text-amber-600 border-amber-400/40",
  },
  {
    code: "ABSENT",
    label: "결석",
    active: "bg-red-500 text-white border-red-500",
    idle: "text-red-600 border-red-400/40",
  },
  {
    code: "RUNAWAY",
    label: "출튀",
    active: "bg-rose-500 text-white border-rose-500",
    idle: "text-rose-600 border-rose-400/40",
  },
  {
    code: "MATERIAL",
    label: "자료",
    active: "bg-slate-500 text-white border-slate-500",
    idle: "text-slate-600 border-slate-400/40",
  },
  {
    code: "INACTIVE",
    label: "부재",
    active: "bg-gray-400 text-white border-gray-400",
    idle: "text-gray-500 border-gray-300",
  },
  {
    code: "SECESSION",
    label: "퇴원",
    active: "bg-gray-700 text-white border-gray-700",
    idle: "text-gray-600 border-gray-500/40",
  },
];

const STATUS_STYLE_MAP = Object.fromEntries(
  STATUS_BUTTONS.map((b) => [
    b.code,
    { active: b.active, idle: b.idle, label: b.label },
  ])
);

export default function SessionAttendancePage({
  sessionId,
}: {
  sessionId: number;
}) {
  const qc = useQueryClient();
  const safeSessionId = Number(sessionId);

  const { data: attendance } = useQuery({
    queryKey: ["attendance", safeSessionId],
    queryFn: () => fetchAttendance(safeSessionId),
    enabled: Number.isFinite(safeSessionId),
  });

  const mutationStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateAttendance(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", safeSessionId] });
    },
  });

  const mutationMemo = useMutation({
    mutationFn: ({ id, memo }: { id: number; memo: string }) =>
      updateAttendance(id, { memo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", safeSessionId] });
    },
  });

  if (!attendance) {
    return (
      <PageSection title="출결 관리">
        <div className="text-sm text-[var(--text-muted)]">로딩중...</div>
      </PageSection>
    );
  }

  return (
    <PageSection title="출결 관리">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border-divider)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-3 py-2 text-left">이름</th>
              <th className="px-3 py-2 text-left">현재 상태</th>
              <th className="px-3 py-2 text-left">출결 변경</th>
              <th className="px-3 py-2 text-left">메모</th>
            </tr>
          </thead>

          <tbody>
            {attendance.map((att: any) => {
              const style = STATUS_STYLE_MAP[att.status];

              return (
                <tr
                  key={att.id}
                  className="border-b border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
                >
                  {/* 이름 */}
                  <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                    {att.name}
                  </td>

                  {/* 현재 상태 (색상 반영) */}
                  <td className="px-3 py-2">
                    {style ? (
                      <span
                        className={[
                          "inline-flex rounded-full border px-2 py-1 text-xs font-semibold",
                          style.active,
                        ].join(" ")}
                      >
                        {style.label}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* 출결 변경 */}
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {STATUS_BUTTONS.map((btn) => {
                        const active = att.status === btn.code;

                        return (
                          <button
                            key={btn.code}
                            type="button"
                            className={[
                              "rounded border px-2 py-1 text-xs font-semibold transition",
                              active ? btn.active : btn.idle,
                              !active &&
                                "hover:bg-[var(--bg-surface-soft)]",
                            ].join(" ")}
                            onClick={() => {
                              if (active) return;
                              mutationStatus.mutate({
                                id: att.id,
                                status: btn.code,
                              });
                            }}
                          >
                            {btn.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  {/* 메모 */}
                  <td className="px-3 py-2">
                    <input
                      defaultValue={att.memo}
                      placeholder="메모 입력"
                      className="w-full rounded-md border border-[var(--border-divider)] bg-[var(--bg-app)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                      onBlur={(e) =>
                        mutationMemo.mutate({
                          id: att.id,
                          memo: e.target.value,
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageSection>
  );
}

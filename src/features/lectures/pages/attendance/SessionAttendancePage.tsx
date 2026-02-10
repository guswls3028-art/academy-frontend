// PATH: src/features/lectures/pages/attendance/SessionAttendancePage.tsx
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAttendance, updateAttendance } from "@/features/lectures/api/attendance";
import { EmptyState } from "@/shared/ui/ds";
import AttendanceStatusBadge from "@/shared/ui/badges/AttendanceStatusBadge";

const STATUS_LIST = [
  "PRESENT",
  "LATE",
  "ONLINE",
  "SUPPLEMENT",
  "EARLY_LEAVE",
  "ABSENT",
  "RUNAWAY",
  "MATERIAL",
] as const;

type AttendanceStatus = (typeof STATUS_LIST)[number];

const TH_STYLE = {
  background:
    "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface-hover))",
  color:
    "color-mix(in srgb, var(--color-brand-primary) 55%, var(--color-text-secondary))",
};

function formatPhone(v?: string | null) {
  if (!v) return "-";
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  return v;
}

export default function SessionAttendancePage({ sessionId }: { sessionId: number }) {
  const qc = useQueryClient();

  const { data: attendance, isLoading } = useQuery({
    queryKey: ["attendance", sessionId],
    queryFn: () => fetchAttendance(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AttendanceStatus }) =>
      updateAttendance(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", sessionId] }),
  });

  const updateMemo = useMutation({
    mutationFn: ({ id, memo }: { id: number; memo: string }) =>
      updateAttendance(id, { memo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", sessionId] }),
  });

  if (isLoading) return <EmptyState scope="panel" tone="loading" title="불러오는 중…" />;
  if (!attendance || attendance.length === 0) return <EmptyState scope="panel" title="출결 데이터 없음" />;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ overflow: "hidden", borderRadius: 14, border: "1px solid var(--color-border-divider)" }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr>
              {[
                { label: "이름", align: "left", width: 140 },
                { label: "학생 전화번호", align: "left", width: 180 },
                { label: "학부모 전화번호", align: "left", width: 180 },
                { label: "현재 상태", align: "left", width: 140 },
                { label: "출결 변경", align: "left" },
                { label: "메모", align: "left", width: 260 },
              ].map((h) => (
                <th
                  key={h.label}
                  className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                  style={{
                    textAlign: h.align as any,
                    whiteSpace: "nowrap",
                    width: h.width as any,
                    ...TH_STYLE,
                  }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--color-border-divider)]">
            {attendance.map((att: any) => (
              <tr key={att.id} className="hover:bg-[var(--color-bg-surface-soft)]">
                <td className="px-4 py-3 text-left text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                  {att.name}
                </td>

                <td className="px-4 py-3 text-left text-[14px] text-[var(--color-text-secondary)]">
                  {formatPhone(att.student_phone)}
                </td>

                <td className="px-4 py-3 text-left text-[14px] text-[var(--color-text-muted)]">
                  {formatPhone(att.parent_phone)}
                </td>

                <td className="px-4 py-3">
                  <AttendanceStatusBadge status={att.status} />
                </td>

                <td className="px-4 py-3">
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", whiteSpace: "nowrap", paddingBottom: 2 }}>
                    {STATUS_LIST.map((code) => {
                      const active = att.status === code;
                      return (
                        <div
                          key={code}
                          role="button"
                          aria-pressed={active}
                          onClick={() => {
                            if (active) return;
                            updateStatus.mutate({ id: att.id, status: code });
                          }}
                          style={{
                            cursor: active ? "default" : "pointer",
                            opacity: active ? 1 : 0.7,
                            transition: "opacity 120ms ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!active) (e.currentTarget as HTMLDivElement).style.opacity = "1";
                          }}
                          onMouseLeave={(e) => {
                            if (!active) (e.currentTarget as HTMLDivElement).style.opacity = "0.7";
                          }}
                        >
                          <AttendanceStatusBadge status={code} />
                        </div>
                      );
                    })}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <input
                    defaultValue={att.memo || ""}
                    placeholder="메모 입력"
                    className="ds-input w-full"
                    onBlur={(e) => updateMemo.mutate({ id: att.id, memo: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// PATH: src/features/students/components/StudentsTable.tsx
import { useMemo } from "react";
import { EmptyState, Button } from "@/shared/ui/ds";
import { toggleStudentActive } from "../api/students";
import { useQueryClient } from "@tanstack/react-query";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, keyword: string) {
  if (!keyword) return text;
  const k = keyword.trim();
  if (!k) return text;

  const parts = String(text).split(new RegExp(`(${escapeRegExp(k)})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === k.toLowerCase() ? (
      <mark
        key={i}
        className="px-0.5 rounded"
        style={{
          backgroundColor: "var(--state-selected-bg)",
          color: "inherit",
        }}
      >
        {p}
      </mark>
    ) : (
      p
    )
  );
}

function formatPhone(v: any) {
  if (!v) return "-";
  return String(v);
}

export default function StudentsTable({
  data = [],
  search,
  sort,
  onSortChange,
  onDelete,
  onRowClick,
  onEditClick,
}: {
  data: any[];
  search: string;
  sort: string;
  onSortChange: (v: string) => void;
  onDelete: (id: number) => void;
  onRowClick: (id: number) => void;
  onEditClick: (id: number) => void;
}) {
  const qc = useQueryClient();

  const columns = useMemo(
    () => [
      { key: "name", label: "이름", w: 140 },
      { key: "studentPhone", label: "학생 전화/식별자", w: 190 },
      { key: "parentPhone", label: "학부모 전화", w: 170 },
      { key: "school", label: "학교", w: 160 },
      { key: "schoolClass", label: "반", w: 80 },
      { key: "registeredAt", label: "등록일", w: 120 },
      { key: "active", label: "상태", w: 110 },
    ],
    []
  );

  if (!data.length) {
    return (
      <EmptyState
        title="학생 정보가 없습니다."
        description="검색/필터 조건을 확인하거나, 새 학생을 등록해 주세요."
        scope="panel"
      />
    );
  }

  async function toggle(id: number, active: boolean) {
    await toggleStudentActive(id, !active);
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["student", id] });
  }

  function sortHeader(key: string, label: string) {
    const isAsc = sort === key;
    const isDesc = sort === `-${key}`;
    const next = isAsc ? `-${key}` : isDesc ? "" : key;

    return (
      <th
        onClick={() => onSortChange(next)}
        className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)] cursor-pointer select-none"
        style={{
          textAlign: "center",
          whiteSpace: "nowrap",
          background:
            "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface-hover))",
          color:
            "color-mix(in srgb, var(--color-brand-primary) 55%, var(--color-text-secondary))",
        }}
        aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
        scope="col"
      >
        <span className="inline-flex items-center gap-2">
          {label}
          <span
            aria-hidden
            style={{
              fontSize: 11,
              opacity: isAsc || isDesc ? 1 : 0.35,
              color: "var(--color-brand-primary)",
            }}
          >
            {isAsc ? "▲" : isDesc ? "▼" : "⇅"}
          </span>
        </span>
      </th>
    );
  }

  return (
    <div style={{ overflow: "hidden" }}>
      <table className="w-full" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={{ width: c.w }} />
          ))}
          <col style={{ width: 160 }} />
        </colgroup>

        <thead>
          <tr>
            {columns.map((c) => sortHeader(c.key, c.label))}
            <th
              className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
              style={{
                textAlign: "center",
                whiteSpace: "nowrap",
                background:
                  "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface-hover))",
                color:
                  "color-mix(in srgb, var(--color-brand-primary) 55%, var(--color-text-secondary))",
              }}
              scope="col"
            >
              작업
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[var(--color-border-divider)]">
          {data.map((s) => (
            <tr
              key={s.id}
              onClick={() => onRowClick(s.id)}
              tabIndex={0}
              role="button"
              className="group cursor-pointer hover:bg-[var(--color-bg-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/40"
            >
              {/* 이름 */}
              <td className="px-4 py-3 text-center text-[15px] font-bold leading-6 text-[var(--color-text-primary)] truncate">
                {highlight(s.name || "-", search)}
              </td>

              {/* 학생 전화 */}
              <td className="px-4 py-3 text-center text-[14px] leading-6 text-[var(--color-text-secondary)] truncate">
                {highlight(formatPhone(s.studentPhone), search)}
              </td>

              {/* 학부모 전화 */}
              <td className="px-4 py-3 text-center text-[14px] leading-6 text-[var(--color-text-secondary)] truncate">
                {highlight(s.parentPhone || "-", search)}
              </td>

              {/* 학교 */}
              <td className="px-4 py-3 text-center text-[14px] leading-6 text-[var(--color-text-secondary)] truncate">
                {s.school || "-"}
              </td>

              {/* 반 */}
              <td className="px-4 py-3 text-center text-[14px] leading-6 text-[var(--color-text-secondary)] truncate">
                {s.schoolClass || "-"}
              </td>

              {/* 등록일 */}
              <td className="px-4 py-3 text-center text-[13px] leading-6 font-semibold text-[var(--color-text-muted)] truncate">
                {s.registeredAt?.slice(0, 10) || "-"}
              </td>

              {/* 상태 */}
              <td
                className="px-4 py-3 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <span
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: 12,
                    color: "white",
                    backgroundColor: s.active ? "#22c55e" : "#ef4444",
                  }}
                >
                  {s.active ? "활성" : "비활성"}
                </span>
              </td>

              {/* 작업 */}
              <td
                className="px-4 py-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center gap-2">
                  <Button intent="primary" size="sm" onClick={() => onEditClick(s.id)}>
                    수정
                  </Button>
                  <Button intent="danger" size="sm" onClick={() => onDelete(s.id)}>
                    삭제
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

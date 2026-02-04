// PATH: src/features/students/components/StudentsTable.tsx

import EmptyState from "@/shared/ui/feedback/EmptyState";
import { toggleStudentActive } from "../api/students";
import { useQueryClient } from "@tanstack/react-query";

function highlight(text: string, keyword: string) {
  if (!keyword) return text;
  const parts = text.split(new RegExp(`(${keyword})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={i} className="bg-yellow-300/40 px-0.5 rounded">
        {p}
      </mark>
    ) : (
      p
    )
  );
}

export default function StudentsTable({
  data = [],
  search,
  sort,
  onSortChange,
  onDelete,
  onRowClick,
}: {
  data: any[];
  search: string;
  sort: string;
  onSortChange: (v: string) => void;
  onDelete: (id: number) => void;
  onRowClick: (id: number) => void;
}) {
  const qc = useQueryClient();

  if (!data.length) {
    return <EmptyState message="학생 정보가 없습니다." />;
  }

  async function toggle(id: number, active: boolean) {
    await toggleStudentActive(id, !active);
    qc.invalidateQueries({ queryKey: ["students"] });
  }

  function sortHeader(key: string, label: string) {
    const isAsc = sort === key;
    const isDesc = sort === `-${key}`;

    // ✅ 3단 클릭: ASC -> DESC -> 해제
    const next = isAsc ? `-${key}` : isDesc ? "" : key;

    return (
      <th
        className="
          px-3 py-2 font-semibold cursor-pointer text-center select-none
          border-b-2 border-[var(--border-divider)]
          text-[13px]
        "
        onClick={() => onSortChange(next)}
        title="클릭하여 정렬"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {isAsc && <span className="text-[11px]">▲</span>}
          {isDesc && <span className="text-[11px]">▼</span>}
        </span>
      </th>
    );
  }

  return (
    <table className="w-full text-sm border border-[var(--border-divider)] rounded-md overflow-hidden">
      <thead className="bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]">
        <tr>
          {sortHeader("name", "이름")}
          {sortHeader("studentPhone", "학생 전화번호(식별자)")}
          {sortHeader("parentPhone", "학부모 전화번호")}
          {sortHeader("school", "학교")}
          {sortHeader("schoolClass", "반")}
          {sortHeader("registeredAt", "등록일")}
          {sortHeader("active", "상태")}
          <th className="px-3 py-2 text-center border-b-2 border-[var(--border-divider)] text-[13px]">
            관리
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-[var(--border-divider)]">
        {data.map((s) => (
          <tr
            key={s.id}
            onClick={() => onRowClick(s.id)}
            className="hover:bg-[var(--bg-surface-soft)] cursor-pointer transition"
          >
            <td className="px-3 py-2 font-semibold text-center text-[var(--text-primary)]">
              {highlight(s.name || "-", search)}
            </td>

            <td className="px-3 py-2 text-center">
              {s.studentPhone && String(s.studentPhone).length === 8 ? (
                <span className="text-[var(--text-muted)]">
                  식별자 {highlight(String(s.studentPhone), search)}
                </span>
              ) : (
                highlight(s.studentPhone || "-", search)
              )}
            </td>

            <td className="px-3 py-2 text-center">
              {highlight(s.parentPhone || "-", search)}
            </td>

            <td className="px-3 py-2 text-center">{s.school || "-"}</td>
            <td className="px-3 py-2 text-center">{s.schoolClass || "-"}</td>

            <td className="px-3 py-2 text-center text-xs text-[var(--text-secondary)]">
              {s.registeredAt?.slice(0, 10) || "-"}
            </td>

            <td
              className="px-3 py-2 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => toggle(s.id, s.active)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition
                  ${
                    s.active
                      ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                      : "bg-[var(--bg-surface-soft)] text-[var(--text-muted)]"
                  }`}
              >
                {s.active ? "활성" : "비활성"}
              </button>
            </td>

            <td
              className="px-3 py-2 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="text-xs text-[var(--color-danger)] hover:underline"
                onClick={() => onDelete(s.id)}
              >
                삭제
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

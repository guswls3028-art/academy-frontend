import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkCreateAttendance } from "../api/attendance";
import {
  fetchStudents as fetchStudentList,
  type ClientStudent,
} from "@/features/students/api/students";

interface Props {
  sessionId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Student = {
  id: number;
  name: string;
  phone?: string | null;
};

export default function EnrollStudentModal({
  sessionId,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient();

  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(keyword.trim()), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["enroll-modal-students", search],
    queryFn: async (): Promise<Student[]> => {
      const list: ClientStudent[] = await fetchStudentList(search, {});
      return list.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.studentPhone,
      }));
    },
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: (ids: number[]) => bulkCreateAttendance(sessionId, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", sessionId] });
      onSuccess?.();
      onClose();
      setSelectedIds([]);
    },
  });

  if (!isOpen) return null;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-lg bg-[var(--bg-surface)] shadow-xl text-sm">
        <div className="flex items-center justify-between border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-2">
          <h2 className="font-semibold text-[var(--text-primary)]">
            학생 추가 (세션 기준)
          </h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="border-b border-[var(--border-divider)] px-4 py-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="학생 이름 검색"
            className="w-full rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2"
          />
        </div>

        <div className="max-h-72 overflow-y-auto px-4 py-2">
          {isLoading ? (
            <div className="py-6 text-center text-[var(--text-muted)]">
              불러오는 중…
            </div>
          ) : (
            <ul className="divide-y">
              {students.map((st) => {
                const checked = selectedIds.includes(st.id);
                return (
                  <li
                    key={st.id}
                    onClick={() => toggleSelect(st.id)}
                    className={`
                      flex cursor-pointer items-center gap-3 py-2
                      ${checked
                        ? "bg-[var(--bg-surface-soft)]"
                        : "hover:bg-[var(--bg-surface-soft)]"}
                    `}
                  >
                    <input type="checkbox" checked={checked} readOnly />
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">
                        {st.name}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {st.phone || "-"}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--border-divider)] px-4 py-1.5"
          >
            취소
          </button>
          <button
            onClick={() => mutation.mutate(selectedIds)}
            disabled={mutation.isPending}
            className="rounded-md bg-[var(--color-primary)] px-4 py-1.5 text-white disabled:opacity-50"
          >
            {mutation.isPending ? "추가 중…" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

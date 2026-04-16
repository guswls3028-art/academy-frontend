// PATH: src/app_teacher/domains/lectures/components/EnrollStudentSheet.tsx
// 수강생 등록 바텀시트 — 학생 검색 + 선택 + 일괄 등록
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkCreateEnrollments } from "../api";
import { fetchStudents } from "@teacher/domains/students/api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { Search, Check, Plus } from "@teacher/shared/ui/Icons";

interface Props {
  open: boolean;
  onClose: () => void;
  lectureId: number;
  enrolledStudentIds: number[];
}

export default function EnrollStudentSheet({ open, onClose, lectureId, enrolledStudentIds }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const { data } = useQuery({
    queryKey: ["all-students-for-enroll", search],
    queryFn: () => fetchStudents({ search: search || undefined, page_size: 100 }),
    enabled: open,
  });

  const students = (data?.data ?? []).filter((s: any) => !enrolledStudentIds.includes(s.id));

  const mutation = useMutation({
    mutationFn: () => bulkCreateEnrollments(lectureId, selected),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecture-enrollments"] });
      qc.invalidateQueries({ queryKey: ["lecture-detail"] });
      setSelected([]);
      onClose();
    },
  });

  const toggle = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="수강생 등록">
      <div className="flex flex-col gap-2" style={{ padding: "var(--tc-space-2) 0" }}>
        {/* Search */}
        <div className="flex items-center gap-2" style={{ padding: "0 0 var(--tc-space-2)", borderBottom: "1px solid var(--tc-border-subtle)" }}>
          <Search size={16} style={{ color: "var(--tc-text-muted)" }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="학생 이름/전화 검색"
            className="flex-1 text-sm"
            style={{ border: "none", background: "transparent", color: "var(--tc-text)", outline: "none" }} />
        </div>

        {/* Student list */}
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {students.length === 0 ? (
            <div className="text-sm text-center py-4" style={{ color: "var(--tc-text-muted)" }}>
              {search ? "검색 결과 없음" : "등록 가능한 학생 없음"}
            </div>
          ) : (
            students.map((s: any) => {
              const checked = selected.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggle(s.id)}
                  className="flex items-center gap-2 w-full text-left cursor-pointer"
                  style={{ padding: "8px 4px", background: "none", border: "none", borderBottom: "1px solid var(--tc-border-subtle)" }}>
                  <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                    style={{ border: checked ? "none" : "1.5px solid var(--tc-border-strong)", background: checked ? "var(--tc-primary)" : "transparent" }}>
                    {checked && <Check size={13} style={{ color: "#fff" }} />}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--tc-text)" }}>{s.name}</span>
                  <span className="text-[11px] ml-auto" style={{ color: "var(--tc-text-muted)" }}>
                    {s.grade ? `${s.grade}학년` : ""} {s.school || ""}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Submit */}
        <button onClick={() => mutation.mutate()} disabled={selected.length === 0 || mutation.isPending}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: selected.length > 0 ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: selected.length > 0 ? "#fff" : "var(--tc-text-muted)" }}>
          {mutation.isPending ? "등록 중..." : `${selected.length}명 등록`}
        </button>
      </div>
    </BottomSheet>
  );
}

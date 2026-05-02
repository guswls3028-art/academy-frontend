/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any */
// PATH: src/app_teacher/domains/clinic/components/AddParticipantSheet.tsx
// 클리닉 세션 참가자 추가 — 학생 검색 + 다중 선택 + 일괄 등록
// PC ClinicCreatePanel + ClinicTargetSelectModal 의 모바일 단순화 버전 (student 모드만).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStudents } from "@teacher/domains/students/api";
import { createClinicParticipant } from "../api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { Search, Check } from "@teacher/shared/ui/Icons";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { extractApiError } from "@/shared/utils/extractApiError";

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  alreadyParticipantStudentIds: number[];
}

export default function AddParticipantSheet({ open, onClose, sessionId, alreadyParticipantStudentIds }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const { data } = useQuery({
    queryKey: ["clinic-add-students", search],
    queryFn: () => fetchStudents({ search: search || undefined, page_size: 100 }),
    enabled: open,
  });

  const students = (data?.data ?? []).filter(
    (s: any) => !alreadyParticipantStudentIds.includes(s.id),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        selected.map((sid) =>
          createClinicParticipant({ session: sessionId, student: sid }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected");
      const firstError = failed.length > 0 ? (failed[0] as PromiseRejectedResult).reason : null;
      return { ok: selected.length - failed.length, failed: failed.length, firstError };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["teacher-clinic-participants", sessionId] });
      qc.invalidateQueries({ queryKey: ["teacher-clinic-sessions"] });
      if (r.failed > 0) {
        const detail = r.firstError ? extractApiError(r.firstError, "") : "";
        teacherToast.error(
          `${r.ok}명 추가됨, ${r.failed}명 실패${detail ? ` (${detail.split("\n")[0]})` : ""}`,
        );
      } else {
        teacherToast.success(`${r.ok}명이 클리닉에 추가되었습니다.`);
      }
      setSelected([]);
      setSearch("");
      onClose();
    },
    onError: (e) => teacherToast.error(extractApiError(e, "학생 추가에 실패했습니다.")),
  });

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="학생 추가">
      <div className="flex flex-col gap-2" style={{ padding: "var(--tc-space-2) 0" }}>
        {/* Search */}
        <div className="flex items-center gap-2" style={{ padding: "0 0 var(--tc-space-2)", borderBottom: "1px solid var(--tc-border-subtle)" }}>
          <Search size={16} style={{ color: "var(--tc-text-muted)" }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="학생 이름/전화 검색"
            className="flex-1 text-sm"
            style={{ border: "none", background: "transparent", color: "var(--tc-text)", outline: "none" }} />
        </div>

        {/* Student list */}
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {students.length === 0 ? (
            <div className="text-sm text-center py-4" style={{ color: "var(--tc-text-muted)" }}>
              {search ? "검색 결과 없음" : "추가 가능한 학생이 없습니다"}
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
          {mutation.isPending ? "추가 중..." : `${selected.length}명 추가`}
        </button>
      </div>
    </BottomSheet>
  );
}

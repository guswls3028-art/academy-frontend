/* eslint-disable no-restricted-syntax, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// PATH: src/app_teacher/domains/lectures/components/EnrollStudentSheet.tsx
// 수강생 등록 바텀시트 — 학생 검색 + 선택 + 일괄 등록
// R-11: 기존 인라인 style baseline. 마이그레이션은 별도 백로그.
import { useState } from "react";
import { ICON } from "@/shared/ui/ds";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchLectureEnrollments } from "../api";
import EnrollmentNoticeOptions from "@/shared/ui/enrollment/EnrollmentNoticeOptions";
import { useNoticeRegistration } from "@/shared/ui/enrollment/useNoticeRegistration";
import { fetchStudents } from "@teacher/domains/students/api";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { Search, Check, Plus } from "@teacher/shared/ui/Icons";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import { teacherLectureQueryKeys } from "../queryKeys";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
interface Props {
  open: boolean;
  onClose: () => void;
  lectureId: number;
  enrolledStudentIds: number[];
}

export default function EnrollStudentSheet(props: Props) {
  return props.open ? <EnrollStudents key={props.lectureId} {...props} /> : null;
}

function EnrollStudents({ open, onClose, lectureId, enrolledStudentIds }: Props) {
  const notice = useNoticeRegistration(lectureId);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const settledSearch = useDebouncedValue(search.trim());
  const [selected, setSelected] = useState<number[]>([]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: teacherLectureQueryKeys.allStudentsForEnroll(settledSearch),
    queryFn: ({ signal }) => fetchStudents({ search: settledSearch || undefined, page_size: 100 }, signal),
    enabled: open,
  });

  const students = (data?.data ?? []).filter((s: any) => notice.explicit || !enrolledStudentIds.includes(s.id));

  const submit = async () => {
    const count = notice.pending?.students.length ?? selected.length;
    const complete = await notice.submit(selected, async ids => {
      const roster = await fetchLectureEnrollments(lectureId);
      const active = new Set(roster.filter(row => row.status === "ACTIVE").map(row => row.student_id ?? row.student?.id));
      if (!ids.every(id => active.has(id))) throw new Error("incomplete-readback");
      qc.setQueryData(teacherLectureQueryKeys.lectureEnrollmentsFor(lectureId), roster);
      void qc.invalidateQueries({ queryKey: teacherLectureQueryKeys.legacyLectureDetail });
    });
    if (complete) {
      teacherToast.success(`${count}명의 수강 등록을 확인했습니다.`);
      onClose();
    }
  };

  const toggle = (id: number) => {
    if (!selected.includes(id) && selected.length >= 200) {
      teacherToast.error("한 번에 200명까지 등록할 수 있습니다.");
      return;
    }
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <BottomSheet open={open} onClose={onClose} closeDisabled={notice.busy} title="수강생 등록">
      <div className="flex flex-col gap-2" style={{ padding: "var(--tc-space-2) 0" }}>
        {/* Search */}
        <div className="flex items-center gap-2" style={{ padding: "0 0 var(--tc-space-2)", borderBottom: "1px solid var(--tc-border-subtle)" }}>
          <Search size={ICON.sm} style={{ color: "var(--tc-text-muted)" }} />
          <input type="text" disabled={notice.locked} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="학생 이름/전화 검색"
            className="flex-1 text-sm"
            style={{ border: "none", background: "transparent", color: "var(--tc-text)", outline: "none" }} />
        </div>

        {/* Student list */}
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          {isPending || search.trim() !== settledSearch ? (
            <div role="status" className="text-sm text-center py-4">학생 검색 중…</div>
          ) : isError ? (
            <div role="alert" className="text-sm text-center py-4">
              학생 명단을 불러오지 못했습니다.
              <button type="button" className="ml-2 underline" onClick={() => void refetch()}>다시 시도</button>
            </div>
          ) : students.length === 0 ? (
            <div className="text-sm text-center py-4" style={{ color: "var(--tc-text-muted)" }}>
              {search ? "검색 결과 없음" : "등록 가능한 학생 없음"}
            </div>
          ) : (
            students.map((s: any) => {
              const checked = selected.includes(s.id);
              return (
                <button key={s.id} disabled={notice.locked} aria-pressed={checked} onClick={() => toggle(s.id)}
                  className="flex items-center gap-2 w-full text-left cursor-pointer"
                  style={{ padding: "8px 4px", background: "none", border: "none", borderBottom: "1px solid var(--tc-border-subtle)" }}>
                  <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                    style={{ border: checked ? "none" : "1.5px solid var(--tc-border-strong)", background: checked ? "var(--tc-primary)" : "transparent" }}>
                    {checked && <Check size={ICON.xs} style={{ color: "#fff" }} />}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--tc-text)" }}>{s.name}{enrolledStudentIds.includes(s.id) && " · 수강 중"}</span>
                  <span className="text-[11px] ml-auto" style={{ color: "var(--tc-text-muted)" }}>
                    {s.grade ? `${s.grade}학년` : ""} {s.school || ""}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {notice.error && <p role="alert">{notice.error}</p>}
        {notice.pending && !notice.error && !notice.busy && <p>이전 {notice.pending.students.length}명 등록 요청의 결과를 확인해 주세요.</p>}
        <EnrollmentNoticeOptions choices={notice.choices} disabled={notice.locked} onChange={next => {
          notice.setChoices(next);
          if (next.student_notice !== "send" && next.parent_notice !== "send") {
            setSelected(previous => previous.filter(id => !enrolledStudentIds.includes(id)));
          }
        }} />
        <button onClick={() => void submit()} disabled={notice.busy || (!selected.length && !notice.pending)}
          className="w-full text-sm font-bold cursor-pointer mt-1"
          style={{ padding: "12px", borderRadius: "var(--tc-radius)", border: "none", background: selected.length > 0 ? "var(--tc-primary)" : "var(--tc-surface-soft)", color: selected.length > 0 ? "var(--tc-primary-contrast)" : "var(--tc-text-muted)" }}>
          {notice.busy ? "등록 확인 중…" : notice.pending ? notice.retryLabel : notice.explicit ? `${selected.length}명 등록 및 안내 요청` : `${selected.length}명 등록`}
        </button>
      </div>
    </BottomSheet>
  );
}

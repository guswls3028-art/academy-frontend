/**
 * ExamEnrollmentPanel – OPERATOR UX
 *
 * WHY:
 * - 대상자 관리는 "설정 화면"이 아니라 "선택 모달"이 맞다
 * - ExamEnrollment PUT = 완전 치환 계약 유지
 * - enrollment_id만 사용 (student_id 추론 ❌)
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useExamEnrollmentRows,
  useUpdateExamEnrollmentRows,
} from "../../hooks/useExamEnrollments";
import { fetchSessionEnrollments } from "../../api/sessionEnrollments";
import BlockReason from "../../components/BlockReason";

export default function ExamEnrollmentPanel({ examId }: { examId: number }) {
  const [sp] = useSearchParams();
  const sessionId = Number(sp.get("session_id"));

  if (!sessionId) {
    return (
      <BlockReason
        title="세션 컨텍스트 필요"
        description="대상자 관리는 세션(Session) 기준으로만 가능합니다."
      />
    );
  }

  const rowsQ = useExamEnrollmentRows(examId, sessionId);
  const updateMut = useUpdateExamEnrollmentRows(examId, sessionId);

  const serverRows = rowsQ.data?.items ?? [];

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    const init = new Set<number>();
    serverRows.forEach((r) => {
      if (r.is_selected) init.add(r.enrollment_id);
    });
    setSelected(init);
  }, [serverRows]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const apply = async () => {
    await updateMut.mutateAsync({
      enrollment_ids: Array.from(selected),
    });
    setOpen(false);
  };

  const importFromSession = async () => {
    const list = await fetchSessionEnrollments(sessionId);
    const ids = list.map((x) => x.enrollment);
    setSelected(new Set(ids));
  };

  return (
    <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm font-semibold">시험 대상자</div>
          <div className="text-xs text-[var(--text-muted)]">
            현재 선택: {selected.size}명
          </div>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="h-10 px-4 rounded bg-[var(--color-primary)] text-white text-sm font-semibold"
        >
          대상자 등록
        </button>
      </div>

      {/* 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[560px] max-h-[80vh] overflow-hidden rounded bg-white shadow">
            <div className="border-b px-4 py-3 flex justify-between">
              <div className="font-semibold">대상자 선택</div>
              <button onClick={() => setOpen(false)}>닫기</button>
            </div>

            <div className="p-4 space-y-3 overflow-auto">
              <button
                onClick={importFromSession}
                className="text-sm underline"
              >
                세션 내 학생 전체 선택
              </button>

              <div className="space-y-2">
                {serverRows.map((r) => (
                  <label
                    key={r.enrollment_id}
                    className="flex justify-between items-center border rounded px-3 py-2 text-sm"
                  >
                    <span>{r.student_name}</span>
                    <input
                      type="checkbox"
                      checked={selected.has(r.enrollment_id)}
                      onChange={() => toggle(r.enrollment_id)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t px-4 py-3 flex justify-end gap-2">
              <button className="btn" onClick={() => setOpen(false)}>
                취소
              </button>
              <button
                className="btn-primary"
                onClick={apply}
                disabled={updateMut.isPending}
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * ExamEnrollmentPanel – OPERATOR UX
 *
 * WHY:
 * - 대상자 관리는 "설정 화면"이 아니라 "선택 모달"이 맞다
 * - ExamEnrollment PUT = 완전 치환 계약 유지
 * - enrollment_id만 사용 (student_id 추론 ❌)
 */

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useSessionParams } from "@/features/sessions/hooks/useSessionParams";
import {
  useExamEnrollmentRows,
  useUpdateExamEnrollmentRows,
} from "../../hooks/useExamEnrollments";
import BlockReason from "../../components/BlockReason";
import type { EnrollmentRow } from "@/features/sessions/components/enrollment/types";
import EnrollmentManageModal from "@/features/sessions/components/enrollment/EnrollmentManageModal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

export default function ExamEnrollmentPanel({ examId }: { examId: number }) {
  const qc = useQueryClient();
  const { sessionId: sessionIdFromPath } = useSessionParams();
  const [sp] = useSearchParams();
  const sessionIdFromQuery = Number(sp.get("session_id"));
  const sessionId = Number.isFinite(sessionIdFromQuery) && sessionIdFromQuery > 0
    ? sessionIdFromQuery
    : (sessionIdFromPath ?? 0);

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
  const [originSelected, setOriginSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    const init = new Set<number>();
    serverRows.forEach((r) => r.is_selected && init.add(r.enrollment_id));
    setSelected(new Set(init));
    setOriginSelected(new Set(init));
  }, [serverRows]);

  useEffect(() => {
    if (!open) return;
    // 최신 목록으로 편집 시작
    rowsQ.refetch?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (enrollmentId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(enrollmentId) ? next.delete(enrollmentId) : next.add(enrollmentId);
      return next;
    });
  };

  const dirty = useMemo(() => {
    if (selected.size !== originSelected.size) return true;
    for (const id of selected) if (!originSelected.has(id)) return true;
    return false;
  }, [selected, originSelected]);

  const apply = async () => {
    await updateMut.mutateAsync({
      enrollment_ids: Array.from(selected),
    });
    await qc.invalidateQueries({ queryKey: ["exam-enrollment", examId, sessionId] });
    setOpen(false);
  };

  const rows: EnrollmentRow[] = useMemo(
    () =>
      serverRows.map((r) => ({
        enrollment_id: r.enrollment_id,
        student_name: r.student_name,
        profile_photo_url: r.profile_photo_url ?? undefined,
        lectures:
          r.lecture_title != null && r.lecture_title !== ""
            ? [
                {
                  lectureName: r.lecture_title,
                  color: r.lecture_color ?? undefined,
                  chipLabel: r.lecture_chip_label ?? undefined,
                },
              ]
            : undefined,
        parent_phone: r.parent_phone ?? null,
        student_phone: r.student_phone ?? null,
        school: r.school ?? null,
        grade: r.grade ?? null,
      })),
    [serverRows]
  );

  const selectedCountFromServer = useMemo(
    () => serverRows.filter((r) => r.is_selected).length,
    [serverRows]
  );

  return (
    <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border-divider)] px-4 py-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          시험 대상 학생
        </div>
        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
          이 시험에 응시할 학생을 지정합니다. 대상으로 등록된 학생만 성적탭에 표시되고 점수 입력이 가능합니다.
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
          style={{
            borderColor: !rowsQ.isLoading && selectedCountFromServer === 0
              ? "color-mix(in srgb, var(--color-warning) 50%, var(--color-border-divider))"
              : "var(--color-border-divider)",
            background: !rowsQ.isLoading && selectedCountFromServer === 0
              ? "color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-surface))"
              : "var(--bg-surface-soft)",
          }}
        >
          <div className="text-sm text-[var(--text-primary)]">
            선택됨{" "}
            <span className={`font-semibold ${!rowsQ.isLoading && selectedCountFromServer === 0 ? "text-[var(--color-warning)]" : ""}`}>
              {rowsQ.isLoading ? "..." : selectedCountFromServer}
            </span>
            명
            {!rowsQ.isLoading && selectedCountFromServer === 0 && (
              <span className="ml-2 text-xs text-[var(--color-warning)]">
                — 대상자를 등록해야 성적 입력이 가능합니다
              </span>
            )}
            {rowsQ.isError && (
              <span className="ml-2 text-xs text-[var(--color-danger)]">
                (불러오기 실패)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              intent="secondary"
              size="sm"
              disabled={rowsQ.isLoading || updateMut.isPending || serverRows.length === 0}
              onClick={async () => {
                const allIds = serverRows.map((r) => r.enrollment_id);
                if (allIds.length === 0) return;
                try {
                  await updateMut.mutateAsync({ enrollment_ids: allIds });
                  await qc.invalidateQueries({ queryKey: ["exam-enrollment", examId, sessionId] });
                  feedback.success(`수강생 ${allIds.length}명 일괄배정 완료`);
                } catch {
                  feedback.error("전체 등록에 실패했습니다.");
                }
              }}
            >
              수강생 일괄배정
            </Button>
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={() => setOpen(true)}
            >
              대상자 관리
            </Button>
          </div>
        </div>

        <EnrollmentManageModal
          open={open}
          onClose={() => setOpen(false)}
          title="시험 대상 학생 관리"
          sessionId={sessionId}
          rows={rows}
          loading={rowsQ.isLoading}
          error={rowsQ.isError ? "목록 조회 실패" : null}
          selectedIds={selected}
          onToggle={toggle}
          onSetSelectedIds={setSelected}
          onSave={() => {
            if (updateMut.isPending) return;
            if (!dirty) return;
            apply();
          }}
          saving={updateMut.isPending}
          dirty={dirty}
        />
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { AlertTriangle } from "lucide-react";
import { useLectureSessionParams } from "@/shared/hooks/useLectureSessionParams";
import {
  useExamEnrollmentRows,
  useUpdateExamEnrollmentRows,
} from "../../hooks/useExamEnrollments";
import BlockReason from "../../components/BlockReason";
import EnrollmentManageModal from "@/shared/ui/enrollment/EnrollmentManageModal";
import type { EnrollmentRow } from "@/shared/ui/enrollment/types";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import formStyles from "@/shared/ui/assessment/AssessmentSetupForm.module.css";
import { adminExamsQueryKeys } from "../../queryKeys";
import styles from "./ExamEnrollmentPanel.module.css";

export default function ExamEnrollmentPanel({ examId }: { examId: number }) {
  const qc = useQueryClient();
  const { sessionId: sessionIdFromPath } = useLectureSessionParams();
  const [sp] = useSearchParams();
  const sessionIdFromQuery = Number(sp.get("session_id"));
  const sessionId = Number.isFinite(sessionIdFromQuery) && sessionIdFromQuery > 0
    ? sessionIdFromQuery
    : (sessionIdFromPath ?? 0);

  const rowsQ = useExamEnrollmentRows(examId, sessionId);
  const updateMut = useUpdateExamEnrollmentRows(examId, sessionId);

  const serverRows = useMemo(() => rowsQ.data?.items ?? [], [rowsQ.data?.items]);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [originSelected, setOriginSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    const init = new Set<number>();
    serverRows.forEach((r) => r.is_selected && init.add(r.enrollment_id));
    setSelected(new Set(init));
    setOriginSelected(new Set(init));
  }, [open, serverRows]);

  useEffect(() => {
    if (!open) return;
    // 최신 목록으로 편집 시작
    rowsQ.refetch?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (enrollmentId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId);
      } else {
        next.add(enrollmentId);
      }
      return next;
    });
  };

  const dirty = useMemo(() => {
    if (selected.size !== originSelected.size) return true;
    for (const id of selected) if (!originSelected.has(id)) return true;
    return false;
  }, [selected, originSelected]);

  const apply = async () => {
    try {
      await updateMut.mutateAsync({
        enrollment_ids: Array.from(selected),
      });
      await qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examEnrollment(examId, sessionId) });
      feedback.success(`시험 대상 학생을 ${selected.size}명으로 저장했습니다.`);
      setOpen(false);
    } catch (error: unknown) {
      feedback.error(extractApiError(error, "시험 대상 학생을 저장하지 못했습니다."));
    }
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

  // 세션 컨텍스트 없으면 차단 (hooks 뒤에 배치 — React Rules of Hooks 준수)
  if (!sessionId) {
    return (
      <BlockReason
        title="세션 컨텍스트 필요"
        description="대상자 관리는 세션(Session) 기준으로만 가능합니다."
      />
    );
  }

  return (
    <section
      id="assessment-audience"
      tabIndex={-1}
      className={formStyles.section}
    >
      <div className={formStyles.header}>
        <div>
          <h2 className={formStyles.title}>시험 대상 학생</h2>
          <p className={formStyles.description}>
            이 시험에 응시할 학생을 지정합니다. 대상으로 등록된 학생만 성적탭에 표시되고 점수 입력이 가능합니다.
          </p>
        </div>
      </div>

      <div className={formStyles.body}>
        {!rowsQ.isLoading && selectedCountFromServer === 0 && (
          <div
            role="alert"
            className={`flex items-start gap-2 rounded px-3 py-2.5 text-sm ${styles.targetWarning}`}
          >
            <AlertTriangle size={18} className={styles.targetWarningIcon} aria-hidden />
            <div className="flex-1 leading-relaxed">
              <div className="font-semibold">대상 학생이 0명입니다.</div>
              <div className={`text-xs mt-0.5 ${styles.targetWarningText}`}>
                학생을 등록해야 시험 응시·성적 입력이 가능합니다. 아래 <b>이 시험에 일괄배정</b> 또는 <b>대상자 관리</b>로 등록하세요.
              </div>
            </div>
          </div>
        )}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 ${styles.selectionSummary}`}
        >
          <div className="text-sm text-[var(--text-primary)]">
            선택됨{" "}
            <span className={`font-semibold ${!rowsQ.isLoading && selectedCountFromServer === 0 ? "text-[var(--color-warning)]" : ""}`}>
              {rowsQ.isLoading ? "..." : selectedCountFromServer}
            </span>
            명
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
                  await qc.invalidateQueries({ queryKey: adminExamsQueryKeys.examEnrollment(examId, sessionId) });
                  feedback.success(`이 시험에 수강생 ${allIds.length}명 일괄배정 완료`);
                } catch {
                  feedback.error("전체 등록에 실패했습니다.");
                }
              }}
              title="이 시험에만 차시 수강생 전원을 응시 대상으로 등록합니다 (성적탭 전체 시험·과제 일괄배정과 별개)"
            >
              이 시험에 일괄배정
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
          description="현재 차시 수강생 중 시험에 응시할 학생을 선택합니다."
          rows={rows}
          loading={rowsQ.isLoading}
          error={rowsQ.isError ? "목록 조회 실패" : null}
          selectedIds={selected}
          originSelectedIds={originSelected}
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

/**
 * 서버 배정 목록을 요약의 단일 진실로 사용하고 모달에는 임시 편집 상태만 둔다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import EnrollmentManageModal from "@/shared/ui/enrollment/EnrollmentManageModal";
import type { EnrollmentRow } from "@/shared/ui/enrollment/types";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { useConfirm } from "@/shared/ui/confirm";
import { useTrackedTask } from "@/shared/productAnalytics";
import formStyles from "@/shared/ui/assessment/AssessmentSetupForm.module.css";

import { QUERY_KEYS } from "@admin/domains/homework/queryKeys";
import { useAdminHomework } from "@admin/domains/homework/hooks/useAdminHomework";
import { useHomeworkAssignments } from "@admin/domains/homework/hooks/useHomeworkAssignments";
import {
  putHomeworkAssignments,
  type HomeworkAssignmentsState,
} from "@admin/domains/homework/api/homeworkAssignments";
import styles from "./HomeworkEnrollmentPanel.module.css";

export default function HomeworkEnrollmentPanel({
  homeworkId,
}: {
  homeworkId: number;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const runTrackedTask = useTrackedTask();
  const hid = Number(homeworkId);
  const hasHomework = Number.isFinite(hid) && hid > 0;

  const { data: homework } = useAdminHomework(hid);
  const sessionId = Number(homework?.session_id ?? 0);

  const {
    data: assignments,
    isLoading: loadingAssignments,
    isError: isAssignmentsError,
    refetch: refetchAssignments,
  } = useHomeworkAssignments(hid);
  const assignmentsRef = useRef(assignments);
  const refetchAssignmentsRef = useRef(refetchAssignments);
  assignmentsRef.current = assignments;
  refetchAssignmentsRef.current = refetchAssignments;

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);

  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [originSelectedIds, setOriginSelectedIds] = useState<Set<number>>(
    new Set()
  );

  const selectedCount = useMemo(() => {
    return assignments?.selected_ids?.length ?? 0;
  }, [assignments?.selected_ids]);

  const showEmptyAssignmentWarning = !loadingAssignments && selectedCount === 0;

  const hydrateLocalFromQuery = useCallback((q: HomeworkAssignmentsState | undefined) => {
    const items = q?.items ?? [];
    const normalizedRows: EnrollmentRow[] = items.map((x) => ({
      enrollment_id: x.enrollment_id,
      student_name: x.student_name,
      profile_photo_url: x.profile_photo_url ?? undefined,
      lectures:
        x.lecture_title != null && x.lecture_title !== ""
          ? [
              {
                lectureName: x.lecture_title,
                color: x.lecture_color ?? undefined,
                chipLabel: x.lecture_chip_label ?? undefined,
              },
            ]
          : undefined,
      parent_phone: x.parent_phone ?? null,
      student_phone: x.student_phone ?? null,
      school: x.school ?? null,
      grade: x.grade ?? null,
    }));
    const initSelected = new Set<number>(q?.selected_ids ?? []);
    setRows(normalizedRows);
    setSelectedIds(new Set(initSelected));
    setOriginSelectedIds(new Set(initSelected));
  }, []);

  const loadEditor = useCallback(async () => {
    setError(null);
    setEditorLoading(true);
    try {
      const result = await refetchAssignmentsRef.current();
      if (result.error || !result.data) throw result.error ?? new Error("목록 조회 실패");
      hydrateLocalFromQuery(result.data);
    } catch {
      hydrateLocalFromQuery(assignmentsRef.current);
      setError("최신 명단을 불러오지 못했습니다. 다시 불러온 뒤 저장해 주세요.");
    } finally {
      setEditorLoading(false);
    }
  }, [hydrateLocalFromQuery]);

  useEffect(() => {
    if (!open) return;
    void loadEditor();
  }, [loadEditor, open]);

  const dirty = useMemo(() => {
    if (selectedIds.size !== originSelectedIds.size) return true;
    for (const id of selectedIds) {
      if (!originSelectedIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, originSelectedIds]);

  const toggleOne = (enrollmentId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId);
      } else {
        next.add(enrollmentId);
      }
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      setError(null);
      await runTrackedTask(
        "assignments.enrollment.save",
        () => putHomeworkAssignments({
          homeworkId: hid,
          enrollment_ids: Array.from(selectedIds),
        }),
      );
    },
    onSuccess: async () => {
      setOriginSelectedIds(new Set(selectedIds));
      setOpen(false);

      await qc.invalidateQueries({
        queryKey: QUERY_KEYS.HOMEWORK_ASSIGNMENTS(hid),
      });

      if (Number.isFinite(sessionId) && sessionId > 0) {
        await qc.invalidateQueries({
          queryKey: QUERY_KEYS.SESSION_SCORES(sessionId),
        });

        await qc.invalidateQueries({
          queryKey: QUERY_KEYS.HOMEWORK_SESSION_ENROLLMENTS(sessionId),
        });
      }
      feedback.success(`과제 대상 학생을 ${selectedIds.size}명으로 저장했습니다.`);
    },
    onError: (e: unknown) => {
      setError(extractApiError(e, "저장에 실패했습니다. 다시 시도해주세요."));
    },
  });

  return (
    <section
      id="assessment-audience"
      tabIndex={-1}
      className={formStyles.section}
    >
      <div className={formStyles.header}>
        <div>
          <h2 className={formStyles.title}>과제 대상 학생</h2>
          <p className={formStyles.description}>
            이 과제를 제출할 학생을 지정합니다. 대상으로 등록된 학생만 성적탭에 표시되고 점수 입력이 가능합니다.
          </p>
        </div>
      </div>

      <div className={formStyles.body}>
        {!hasHomework && (
          <div className="rounded border bg-[var(--bg-surface-soft)] p-3 text-sm text-[var(--text-muted)]">
            ⚠️ homeworkId가 없어 대상자를 관리할 수 없습니다.
          </div>
        )}

        {hasHomework && (
          <>
            <div
              className={[
                "flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2",
                showEmptyAssignmentWarning ? styles.summaryBoxWarning : styles.summaryBox,
              ].join(" ")}
            >
              <div className="text-sm text-[var(--text-primary)]">
                선택됨{" "}
                <span className={`font-semibold ${showEmptyAssignmentWarning ? "text-[var(--color-warning)]" : ""}`}>
                  {loadingAssignments ? "..." : selectedCount}
                </span>
                명
                {showEmptyAssignmentWarning && (
                  <span className="ml-2 text-xs text-[var(--color-warning)]">
                    — 대상자를 등록해야 성적 입력이 가능합니다
                  </span>
                )}
                {isAssignmentsError && (
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
                  disabled={loadingAssignments || isAssignmentsError || saveMut.isPending || !assignments?.items?.length}
                  onClick={async () => {
                    const allIds = (assignments?.items ?? []).map((x) => x.enrollment_id);
                    if (allIds.length === 0) return;
                    const newlyIncluded = Math.max(0, allIds.length - selectedCount);
                    const confirmed = await confirm({
                      title: `${allIds.length}명을 이 과제에 배정`,
                      message: newlyIncluded > 0
                        ? `현재 ${selectedCount}명에서 ${allIds.length}명으로 바뀝니다. 제외해 둔 학생 ${newlyIncluded}명도 다시 포함됩니다.`
                        : "현재 차시 수강생 전원이 이미 과제 대상입니다.",
                      confirmText: `${allIds.length}명 배정`,
                    });
                    if (!confirmed) return;
                    try {
                      await runTrackedTask(
                        "assignments.enrollment.save",
                        () => putHomeworkAssignments({ homeworkId: hid, enrollment_ids: allIds }),
                      );
                      await qc.invalidateQueries({ queryKey: QUERY_KEYS.HOMEWORK_ASSIGNMENTS(hid) });
                      if (Number.isFinite(sessionId) && sessionId > 0) {
                        await qc.invalidateQueries({ queryKey: QUERY_KEYS.SESSION_SCORES(sessionId) });
                        await qc.invalidateQueries({ queryKey: QUERY_KEYS.HOMEWORK_SESSION_ENROLLMENTS(sessionId) });
                      }
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
                  onClick={() => {
                    setEditorLoading(true);
                    setOpen(true);
                  }}
                >
                  대상자 관리
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <EnrollmentManageModal
        open={open}
        onClose={() => setOpen(false)}
        title="과제 대상 학생 관리"
        description="현재 차시 수강생 중 이 과제를 제출할 학생을 선택합니다."
        rows={rows}
        loading={editorLoading}
        error={error}
        onRetry={() => void loadEditor()}
        selectedIds={selectedIds}
        originSelectedIds={originSelectedIds}
        onToggle={toggleOne}
        onSetSelectedIds={setSelectedIds}
        onSave={() => {
          if (saveMut.isPending) return;
          if (!dirty) return;
          saveMut.mutate();
        }}
        saving={saveMut.isPending}
        saveDisabled={Boolean(error)}
        dirty={dirty}
      />
    </section>
  );
}

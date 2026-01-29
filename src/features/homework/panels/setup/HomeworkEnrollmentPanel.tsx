// PATH: src/features/homework/panels/setup/HomeworkEnrollmentPanel.tsx
/**
 * HomeworkEnrollmentPanel ✅ FINAL (0명 문제 종결판)
 *
 * 규칙(대기업 기준):
 * - "선택됨 N명" 요약은 항상 서버 단일 진실(query)로 표시
 * - 모달은 편집용 임시 state만 사용
 * - 저장 성공 시에만 invalidate (닫기/취소 시 invalidate 금지)
 * - 모달 open 시 refetch로 최신 편집 시작
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import HomeworkEnrollmentManageModal from "@/features/homework/components/HomeworkEnrollmentManageModal";
import type { EnrollmentRow } from "@/features/sessions/components/enrollment/types";

import { QUERY_KEYS } from "@/features/homework/queryKeys";
import { useAdminHomework } from "@/features/homework/hooks/useAdminHomework";
import { useHomeworkAssignments } from "@/features/homework/hooks/useHomeworkAssignments";
import {
  putHomeworkAssignments,
  type HomeworkAssignmentsResponse,
} from "@/features/homework/api/homeworkAssignments";

export default function HomeworkEnrollmentPanel({
  homeworkId,
}: {
  homeworkId: number;
}) {
  const qc = useQueryClient();
  const hid = Number(homeworkId);
  const hasHomework = Number.isFinite(hid) && hid > 0;

  const { data: homework } = useAdminHomework(hid);
  const sessionId = Number(homework?.session_id ?? 0);

  // ✅ 단일 진실 query (요약 표시용)
  const {
    data: assignments,
    isLoading: loadingAssignments,
    isError: isAssignmentsError,
    refetch: refetchAssignments,
  } = useHomeworkAssignments(hid);

  // ----------------------------
  // modal local editing states
  // ----------------------------
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [originSelectedIds, setOriginSelectedIds] = useState<Set<number>>(
    new Set()
  );

  const selectedCount = useMemo(() => {
    // ✅ 요약은 단일 진실
    return assignments?.selected_ids?.length ?? 0;
  }, [assignments?.selected_ids]);

  const hydrateLocalFromQuery = (q: HomeworkAssignmentsResponse | undefined) => {
    const items = q?.items ?? [];
    const normalizedRows: EnrollmentRow[] = items.map((x) => ({
      enrollment_id: x.enrollment_id,
      student_name: x.student_name,
    }));
    const initSelected = new Set<number>(q?.selected_ids ?? []);
    setRows(normalizedRows);
    setSelectedIds(new Set(initSelected));
    setOriginSelectedIds(new Set(initSelected));
  };

  // 모달 열 때 최신 데이터로 편집 시작
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);

    // 1) 최신화
    Promise.resolve(refetchAssignments())
      .then((res) => {
        if (cancelled) return;
        hydrateLocalFromQuery(res.data);
      })
      .catch(() => {
        if (cancelled) return;
        // refetch 실패해도 기존 캐시로라도 편집 시작
        hydrateLocalFromQuery(assignments);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ----------------------------
  // dirty 계산 (모달 내부 단일 진실)
  // ----------------------------
  const dirty = useMemo(() => {
    if (selectedIds.size !== originSelectedIds.size) return true;
    for (const id of selectedIds) {
      if (!originSelectedIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, originSelectedIds]);

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ----------------------------
  // SAVE (성공 시에만 invalidate)
  // ----------------------------
  const saveMut = useMutation({
    mutationFn: async () => {
      setError(null);
      await putHomeworkAssignments({
        homeworkId: hid,
        enrollment_ids: Array.from(selectedIds),
      });
    },
    onSuccess: async () => {
      // ✅ 편집 상태 확정
      setOriginSelectedIds(new Set(selectedIds));
      setOpen(false);

      // ✅ 단일 진실 동기화 (저장 성공 시만)
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
    },
    onError: (e: any) => {
      setError(e?.response?.data?.detail || "저장에 실패했습니다. 다시 시도해주세요.");
    },
  });

  return (
    <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border-divider)] px-4 py-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          과제 대상 학생
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          이 과제에 포함될 학생을 선택합니다.
        </div>
      </div>

      <div className="space-y-3 p-4">
        {!hasHomework && (
          <div className="rounded border bg-[var(--bg-surface-soft)] p-3 text-sm text-[var(--text-muted)]">
            ⚠️ homeworkId가 없어 대상자를 관리할 수 없습니다.
          </div>
        )}

        {hasHomework && (
          <>
            <div className="flex items-center justify-between rounded border bg-[var(--bg-surface-soft)] px-3 py-2">
              <div className="text-sm text-[var(--text-primary)]">
                선택됨{" "}
                <span className="font-semibold">
                  {loadingAssignments ? "..." : selectedCount}
                </span>
                명
                {isAssignmentsError && (
                  <span className="ml-2 text-xs text-[var(--color-danger)]">
                    (불러오기 실패)
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)]">homework #{hid}</div>
            </div>

            <button
              type="button"
              className="rounded border border-[var(--border-divider)] px-3 py-2 text-sm hover:bg-[var(--bg-surface-soft)]"
              onClick={() => setOpen(true)}
            >
              대상자 목록 보기 / 관리
            </button>
          </>
        )}
      </div>

      <HomeworkEnrollmentManageModal
        open={open}
        onClose={() => setOpen(false)}
        title="과제 대상 학생 관리"
        description="이 과제에 포함할 학생을 선택 후 저장하세요."
        rows={rows}
        loading={saveMut.isPending ? false : false /* 모달 내부 로딩은 refetch로 처리 */}
        error={error}
        selectedIds={selectedIds}
        onToggle={toggleOne}
        onSetSelectedIds={setSelectedIds}
        onSave={() => {
          if (saveMut.isPending) return;
          if (!dirty) return;
          saveMut.mutate();
        }}
        saving={saveMut.isPending}
        dirty={dirty}
      />
    </section>
  );
}

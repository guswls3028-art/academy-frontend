// PATH: src/features/homework/components/HomeworkEnrollmentModal.tsx
/**
 * HomeworkEnrollmentManageModal
 *
 * ✅ ExamEnrollmentManageModal 1:1 UX 복제
 * ✅ endpoint만 homework로 변경
 *
 * API:
 * - GET /homework/enrollments/?session_id=123
 * - PUT /homework/enrollments/?session_id=123
 *
 * 저장 방식:
 * - replace(완전 치환)
 */

import { useEffect, useMemo, useState } from "react";
import api from "@/shared/api/axios";

type Row = {
  enrollment_id: number;
  student_name: string;
  is_selected: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
};

export default function HomeworkEnrollmentManageModal({
  open,
  onClose,
  sessionId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [originSelected, setOriginSelected] = useState<Set<number>>(new Set());

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((r) =>
      (r.student_name ?? "").toLowerCase().includes(keyword)
    );
  }, [items, q]);

  const dirty = useMemo(() => {
    if (selected.size !== originSelected.size) return true;
    for (const v of selected) {
      if (!originSelected.has(v)) return true;
    }
    return false;
  }, [selected, originSelected]);

  useEffect(() => {
    if (!open) return;
    if (!Number.isFinite(sessionId) || sessionId <= 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get(`/homework/enrollments/`, {
        params: { session_id: sessionId },
      })
      .then((res) => {
        if (cancelled) return;

        const data = res.data ?? {};
        const list: Row[] = Array.isArray(data?.items) ? data.items : [];

        setItems(list);

        const init = new Set<number>(
          list.filter((x) => x.is_selected).map((x) => x.enrollment_id)
        );
        setSelected(init);
        setOriginSelected(new Set(init));
      })
      .catch((e) => {
        if (cancelled) return;
        const msg =
          e?.response?.data?.detail ||
          "과제 등록 학생 정보를 불러오지 못했습니다.";
        setError(String(msg));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  const toggleOne = (enrollmentId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) next.delete(enrollmentId);
      else next.add(enrollmentId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of filtered) next.add(r.enrollment_id);
      return next;
    });
  };

  const clearAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of filtered) next.delete(r.enrollment_id);
      return next;
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        enrollment_ids: Array.from(selected.values()),
      };

      await api.put(`/homework/enrollments/`, payload, {
        params: { session_id: sessionId },
      });

      setOriginSelected(new Set(selected));
      onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        "저장에 실패했습니다. 다시 시도해주세요.";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const disabled = saving || loading || !dirty;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-[var(--bg-surface)] shadow-lg">
        <div className="flex items-center justify-between border-b border-[var(--border-divider)] px-5 py-4">
          <div>
            <div className="text-base font-semibold text-[var(--text-primary)]">
              과제 등록 학생 관리
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              세션 등록 학생 중에서 과제 등록 대상자를 선택 후 저장하세요.
            </div>
          </div>

          <button
            type="button"
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="학생 이름 검색"
              className="h-9 w-[240px] rounded border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />

            <div className="text-xs text-[var(--text-secondary)]">
              선택됨: <b>{selected.size}</b>명 / 전체 {items.length}명
              <span className="ml-2 text-[var(--text-muted)]">
                session #{sessionId}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllVisible}
                className="h-9 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm hover:bg-[var(--bg-surface-soft)]"
                disabled={loading}
              >
                현재 목록 전체 선택
              </button>

              <button
                type="button"
                onClick={clearAllVisible}
                className="h-9 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] px-3 text-sm hover:bg-[var(--bg-surface-soft)]"
                disabled={loading}
              >
                현재 목록 전체 해제
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          )}

          <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] px-4 py-3 text-xs text-[var(--text-secondary)]">
            ⚠ 저장을 눌러야 서버에 실제 반영됩니다.
          </div>

          <div className="max-h-[340px] overflow-auto rounded border border-[var(--border-divider)]">
            {loading ? (
              <div className="p-6 text-sm text-[var(--text-muted)]">
                불러오는 중...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-[var(--text-muted)]">
                표시할 학생이 없습니다.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="w-12 px-3 py-2 text-left">선택</th>
                    <th className="px-3 py-2 text-left">학생</th>
                    <th className="px-3 py-2 text-left">enrollment_id</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const checked = selected.has(r.enrollment_id);
                    return (
                      <tr
                        key={r.enrollment_id}
                        className="border-t border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(r.enrollment_id)}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--text-primary)]">
                          {r.student_name || "(이름 없음)"}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">
                          {r.enrollment_id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-divider)] px-5 py-4">
          <div className="text-xs text-[var(--text-muted)]">
            {dirty ? (
              <span className="text-[var(--color-danger)]">
                변경사항이 있습니다. 저장하면 확정됩니다.
              </span>
            ) : (
              "변경사항 없음"
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 rounded border border-[var(--border-divider)] px-4 text-sm hover:bg-[var(--bg-surface-soft)]"
              onClick={onClose}
              disabled={saving}
            >
              취소
            </button>

            <button
              type="button"
              className="h-9 rounded bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              onClick={save}
              disabled={disabled}
            >
              {saving ? "저장중..." : "선택 확정(저장)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

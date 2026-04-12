/**
 * PATH: src/features/results/panels/StudentResultPanel.tsx
 *
 * ✅ FINAL (A2 + C-1 UX)
 *
 * - 상태 파생: deriveFrontResultStatusFromDetail 단일 기준
 * - edit/read 모드 전역 시각 분리
 * - lock_reason 항상 노출
 * - EditReasonInput 연결 (UI only)
 *
 * ❌ 점수 계산 ❌
 * ❌ optimistic update ❌
 * ❌ 상태 판단 인라인 ❌
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchAdminExamResultDetail } from "../api/adminExamResultDetail";
import { patchExamItemScore } from "../api/adminExamItemScore";

import AttemptSelectorPanel from "../components/AttemptSelectorPanel";
import AttemptViewerPanel from "../components/attempt/AttemptViewerPanel";
import FrontResultStatusBadge from "../components/FrontResultStatusBadge";

// ✅ FIX: results 도메인 내부 컴포넌트
import EditReasonInput from "@admin/domains/results/components/EditReasonInput";

import { deriveFrontResultStatusFromDetail } from "../utils/deriveFrontResultStatusFromDetail";

type Props = {
  examId: number;
  enrollmentId: number;
};

export default function StudentResultPanel({ examId, enrollmentId }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-exam-detail", examId, enrollmentId],
    queryFn: () => fetchAdminExamResultDetail(examId, enrollmentId),
    enabled: Number.isFinite(examId) && Number.isFinite(enrollmentId),
  });

  const [mode, setMode] = useState<"read" | "edit">("read");
  const [tab, setTab] = useState<"items" | "omr">("items");
  const [editReason, setEditReason] = useState("");

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">상세 불러오는 중...</div>;
  }

  if (error || !data) {
    return <div className="p-4 text-sm text-red-600">상세 조회 실패</div>;
  }

  const editState = data.edit_state;
  const canEdit = editState.can_edit && !editState.is_locked;

  const headerStatus = deriveFrontResultStatusFromDetail(data);

  return (
    <div className={`flex h-full flex-col ${mode === "edit" ? "bg-blue-50/20" : ""}`}>
      {/* ================= Header ================= */}
      <div className="border-b px-4 py-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold">
              enrollment #{data.enrollment_id}
            </div>

            <div className="text-xs text-gray-500">
              총점 {data.total_score}/{data.max_score}
            </div>

            {editState.is_locked && (
              <div className="text-xs text-red-600">
                🔒 {editState.lock_reason ?? "편집 잠김"}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <FrontResultStatusBadge status={headerStatus} />

            {mode === "read" ? (
              <button
                className="rounded border px-3 py-1 text-xs disabled:opacity-40"
                disabled={!canEdit}
                title={
                  !canEdit
                    ? editState.is_locked
                      ? editState.lock_reason ?? "편집 잠김"
                      : "편집 권한 없음"
                    : "편집 모드로 전환"
                }
                onClick={() => setMode("edit")}
              >
                편집
              </button>
            ) : (
              <button
                className="rounded border border-blue-600 bg-blue-50 px-3 py-1 text-xs font-semibold"
                onClick={() => setMode("read")}
              >
                편집 종료
              </button>
            )}
          </div>
        </div>

        {mode === "edit" && (
          <div className="mt-2 text-xs text-blue-600">
            ✏️ 편집 모드 · 변경 사항은 즉시 저장됩니다
          </div>
        )}
      </div>

      {/* ================= Edit Reason ================= */}
      {mode === "edit" && (
        <EditReasonInput value={editReason} onChange={setEditReason} />
      )}

      {/* ================= Attempt Selector ================= */}
      {mode === "edit" && (
        <AttemptSelectorPanel
          examId={examId}
          enrollmentId={enrollmentId}
          onChanged={refetch}
        />
      )}

      {/* ================= Tabs ================= */}
      <div className="flex gap-4 border-b px-4 text-sm">
        {[
          ["items", "결과"],
          ["omr", "OMR"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className={`py-2 ${
              tab === k
                ? "border-b-2 border-blue-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ================= Body ================= */}
      <div className="flex-1 overflow-auto p-4">
        {tab === "items" && (
          <ul className="space-y-1 text-sm">
            {(data.items ?? []).map((it) => {
              const isEditableItem = it.is_editable === true;

              return (
                <li
                  key={it.question_id}
                  className={`flex items-center justify-between rounded border p-2 ${
                    mode === "edit" && isEditableItem ? "bg-blue-50/40" : ""
                  }`}
                >
                  <div>
                    Q{it.question_id} {it.is_correct ? "✅" : "❌"}
                  </div>

                  {mode === "edit" && isEditableItem ? (
                    <input
                      type="number"
                      min={0}
                      max={it.max_score}
                      defaultValue={it.score}
                      className="w-16 rounded border px-1 py-0.5 text-xs"
                      onBlur={async (e) => {
                        const next = Number(e.target.value);

                        if (!Number.isFinite(next)) {
                          e.target.value = String(it.score);
                          return;
                        }

                        try {
                          await patchExamItemScore({
                            examId,
                            enrollmentId,
                            questionId: it.question_id,
                            score: next,
                          });
                          refetch();
                        } catch {
                          e.target.value = String(it.score);
                        }
                      }}
                    />
                  ) : (
                    <div className="text-xs text-gray-500">
                      {it.score}/{it.max_score}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {tab === "omr" && data.attempt_id && (
          <AttemptViewerPanel
            attemptId={data.attempt_id}
            facts={data.items}
            autoSelectFirst
          />
        )}
      </div>
    </div>
  );
}

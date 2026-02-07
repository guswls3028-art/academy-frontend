// PATH: src/features/materials/sheets/components/submissions/SheetsSubmissionsTab.tsx
// SSOT ALIGN (domains/submissions):
// - list: GET /submissions/exams/<exam_id>/
// - 운영자 수동 개입: manual-edit / retry

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import type { SheetQuestionEntity } from "../../sheets.api";
import {
  listExamSubmissionsApi,
  retrySubmissionApi,
  uploadOmrBatchApi,
  type ExamSubmissionRow,
} from "./submissions.api";
import SubmissionRow from "./SubmissionRow";
import SubmissionManualEditModal from "./SubmissionManualEditModal";

type Props = {
  examId: number;
  sheetTitle?: string;
  questions: SheetQuestionEntity[];
};

type StatusFilter = "all" | "pending" | "processing" | "done" | "failed";

export default function SheetsSubmissionsTab({ examId, sheetTitle, questions }: Props) {
  const qc = useQueryClient();

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // batch upload
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchSheetId, setBatchSheetId] = useState<string>("");

  const listQ = useQuery({
    queryKey: ["materials-submissions", examId],
    queryFn: () => listExamSubmissionsApi(examId),
    enabled: examId > 0,
    refetchInterval: 10_000, // 운영 화면: 자동 갱신
  });

  const retryMut = useMutation({
    mutationFn: (submissionId: number) => retrySubmissionApi(submissionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials-submissions", examId] }),
    onError: (e: any) => alert(e?.message || "재시도 실패"),
  });

  const batchMut = useMutation({
    mutationFn: async () => {
      const files = batchFiles ?? [];
      return await uploadOmrBatchApi({
        examId,
        files,
        sheetId: batchSheetId.trim() ? batchSheetId.trim() : null,
      });
    },
    onSuccess: () => {
      setBatchFiles([]);
      setBatchSheetId("");
      qc.invalidateQueries({ queryKey: ["materials-submissions", examId] });
      alert("업로드 요청이 접수되었습니다. 처리 상태는 목록에서 확인하세요.");
    },
    onError: (e: any) => alert(e?.message || "다건 업로드 실패"),
  });

  const items: ExamSubmissionRow[] = useMemo(() => {
    const rows = listQ.data ?? [];
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [listQ.data, filter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">제출</div>
          <div className="text-xs text-gray-600 mt-1">
            시험: <span className="font-medium">{sheetTitle || `#${examId}`}</span> (exam_id: {examId})
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => listQ.refetch()} disabled={listQ.isFetching}>
            {listQ.isFetching ? "갱신 중..." : "새로고침"}
          </button>

          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)}>
            <option value="all">전체</option>
            <option value="pending">대기(pending)</option>
            <option value="processing">처리중(processing)</option>
            <option value="done">완료(done)</option>
            <option value="failed">실패(failed)</option>
          </select>
        </div>
      </div>

      {/* Batch upload panel */}
      <div className="rounded-xl border bg-[var(--bg-surface-soft)] p-4 space-y-3">
        <div className="text-sm font-semibold">OMR 다건 업로드</div>
        <div className="text-xs text-gray-600">
          백엔드 SSOT: <code>/submissions/exams/&lt;exam_id&gt;/omr/batch/</code>
          <br />
          (선택) sheet_id를 함께 보내면 AI 워커가 문항 ROI를 더 안정적으로 사용합니다.
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input w-40"
            placeholder="(선택) sheet_id"
            value={batchSheetId}
            onChange={(e) => setBatchSheetId(e.target.value)}
          />

          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setBatchFiles(Array.from(e.target.files ?? []))}
          />

          <button
            className="btn-primary"
            disabled={batchMut.isPending || (batchFiles?.length ?? 0) === 0}
            onClick={() => batchMut.mutate()}
          >
            {batchMut.isPending ? "업로드 중..." : `업로드 (${batchFiles.length})`}
          </button>

          {(batchFiles?.length ?? 0) > 0 && (
            <button type="button" className="btn" onClick={() => setBatchFiles([])} disabled={batchMut.isPending}>
              선택 해제
            </button>
          )}
        </div>

        {(batchFiles?.length ?? 0) > 0 && (
          <div className="text-xs text-gray-600">
            선택된 파일: {batchFiles.map((f) => f.name).join(", ")}
          </div>
        )}
      </div>

      {/* List */}
      <div className="surface p-0 rounded-xl border overflow-hidden">
        {listQ.isLoading && <div className="p-4 text-sm">불러오는 중...</div>}

        {!listQ.isLoading && items.length === 0 && (
          <div className="p-4">
            <EmptyState title="제출이 없습니다" message="아직 제출된 OMR이 없습니다." />
          </div>
        )}

        {items.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>학생</th>
                <th>상태</th>
                <th>점수</th>
                <th>제출시각</th>
                <th className="text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <SubmissionRow
                  key={row.id}
                  row={row}
                  onManualEdit={() => setSelectedId(row.id)}
                  onRetry={() => retryMut.mutate(row.id)}
                  retryLoading={retryMut.isPending}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual edit modal */}
      {selectedId && (
        <SubmissionManualEditModal
          open
          onClose={() => setSelectedId(null)}
          examId={examId}
          submissionId={selectedId}
          questions={questions}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["materials-submissions", examId] });
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

// PATH: src/features/submissions/components/AdminOmrBatchUploadBox.tsx
// src/features/submissions/components/AdminOmrBatchUploadBox.tsx

import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { adminOmrUpload } from "@/features/submissions/api/adminOmrUpload";

type Item = {
  file: File;
  enrollment_id: number | null;
  status: "ready" | "uploading" | "done" | "failed";
  message?: string;
  submission_id?: number;
};

function inferEnrollmentId(filename: string): number | null {
  const base = filename.split(".")[0] || "";
  const m1 = base.match(/^(\d+)[-_ ]/);
  if (m1?.[1]) return Number(m1[1]);

  const m2 = base.match(/^(\d+)$/);
  if (m2?.[1]) return Number(m2[1]);

  const m3 = base.match(/(?:E|enroll)(\d+)/i);
  if (m3?.[1]) return Number(m3[1]);

  return null;
}

export default function AdminOmrBatchUploadBox(props: {
  examId: number;
  onSubmissionCreated?: (submissionId: number) => void;
}) {
  const { examId, onSubmissionCreated } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<Item[]>([]);

  const total = items.length;
  const done = items.filter((x) => x.status === "done").length;
  const failed = items.filter((x) => x.status === "failed").length;

  const hasInvalid = useMemo(() => items.some((x) => !x.enrollment_id), [items]);

  const batchMut = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.enrollment_id) continue;

        setItems((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "uploading", message: "" } : p
          )
        );

        try {
          const res = await adminOmrUpload({
            examId,
            enrollmentId: it.enrollment_id,
            file: it.file,
          });

          setItems((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? {
                    ...p,
                    status: "done",
                    submission_id: res.submission_id,
                    message: res.status,
                  }
                : p
            )
          );

          onSubmissionCreated?.(res.submission_id);
        } catch (e: any) {
          setItems((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, status: "failed", message: e?.message || "failed" }
                : p
            )
          );
        }
      }
    },
  });

  const onPick = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const next: Item[] = Array.from(files).map((f) => ({
      file: f,
      enrollment_id: inferEnrollmentId(f.name),
      status: "ready",
    }));

    setItems(next);
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-100">다건 OMR 업로드</div>
        <div className="text-xs text-neutral-400">
          {done}/{total} done · {failed} failed
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-100"
          onClick={() => inputRef.current?.click()}
        >
          여러 파일 선택
        </button>

        <button
          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-950 disabled:opacity-40"
          disabled={items.length === 0 || hasInvalid || batchMut.isPending}
          onClick={() => batchMut.mutate()}
          title={hasInvalid ? "파일명에서 enrollment_id를 추출 못한 항목이 있음" : ""}
        >
          {batchMut.isPending ? "업로드 중..." : "일괄 업로드 시작"}
        </button>

        {hasInvalid ? (
          <div className="text-xs text-yellow-300">
            ⚠️ enrollment_id 추출 실패 항목 있음 (파일명 규칙: 12_xxx.png / E12_xxx.jpg)
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => onPick(e.target.files)}
      />

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="px-3 py-2 text-left">파일</th>
              <th className="px-3 py-2 text-left">enrollment_id</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">submission</th>
              <th className="px-3 py-2 text-left">메시지</th>
            </tr>
          </thead>
          <tbody className="text-neutral-100">
            {items.map((it, idx) => (
              <tr key={idx} className="border-b border-neutral-900">
                <td className="px-3 py-2">{it.file.name}</td>
                <td className="px-3 py-2">
                  {it.enrollment_id ?? <span className="text-yellow-300">?</span>}
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs text-neutral-300">{it.status}</span>
                </td>
                <td className="px-3 py-2">
                  {it.submission_id ? <span className="text-xs">#{it.submission_id}</span> : "-"}
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs text-neutral-400">{it.message ?? ""}</span>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                  아직 파일 선택 안 함
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900/30 p-3 text-xs text-neutral-400">
        업로드가 완료되면 submission_id가 생성됩니다. 아래 “제출 현황”에서 상태를 자동 추적합니다.
      </div>
    </div>
  );
}

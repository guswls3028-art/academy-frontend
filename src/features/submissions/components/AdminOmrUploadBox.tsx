import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { adminOmrUpload } from "@/features/submissions/api/adminOmrUpload";

type Props = {
  examId: number;
  onUploaded?: (submissionId: number) => void;
};

export default function AdminOmrUploadBox({ examId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [enrollmentId, setEnrollmentId] = useState<number | "">("");
  const [dragOver, setDragOver] = useState(false);
  const [lastFileName, setLastFileName] = useState<string>("");

  const canSubmit = useMemo(() => {
    return typeof enrollmentId === "number" && enrollmentId > 0;
  }, [enrollmentId]);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!canSubmit) throw new Error("enrollment_id required");
      setLastFileName(file.name);
      return adminOmrUpload({ examId, enrollmentId: enrollmentId as number, file });
    },
    onSuccess: (data) => {
      onUploaded?.(data.submission_id);
      alert(`업로드 완료: submission_id=${data.submission_id} / status=${data.status}`);
    },
    onError: (e: any) => {
      alert(e?.message || "업로드 실패");
    },
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadMut.mutate(files[0]); // 1개 업로드 박스는 단일 파일만
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-neutral-100">관리자 OMR 업로드</div>
        <div className="text-xs text-neutral-400">exam_id: {examId}</div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
        <label className="text-xs text-neutral-400">enrollment_id</label>
        <input
          className="md:col-span-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none"
          placeholder="예: 12"
          value={enrollmentId}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (v === "") return setEnrollmentId("");
            const n = Number(v);
            if (!Number.isFinite(n)) return;
            setEnrollmentId(n);
          }}
        />
      </div>

      <div
        className={[
          "rounded-xl border border-dashed p-6 text-center transition",
          dragOver ? "border-neutral-400 bg-neutral-900/40" : "border-neutral-700 bg-neutral-950",
        ].join(" ")}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="text-sm text-neutral-200">
          파일을 드래그&드롭 하거나, 아래 버튼으로 선택
        </div>
        <div className="mt-2 text-xs text-neutral-500">
          pdf / png / jpg 등 (서버에서 R2 업로드 → AI job 발행)
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-100"
            onClick={() => inputRef.current?.click()}
            disabled={uploadMut.isPending}
          >
            파일 선택
          </button>

          <button
            type="button"
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-950 disabled:opacity-40"
            onClick={() => inputRef.current?.click()}
            disabled={!canSubmit || uploadMut.isPending}
            title={!canSubmit ? "enrollment_id 입력 필요" : ""}
          >
            업로드
          </button>
        </div>

        {lastFileName ? (
          <div className="mt-3 text-xs text-neutral-400">
            last: <span className="text-neutral-200">{lastFileName}</span>
          </div>
        ) : null}

        {uploadMut.isPending ? (
          <div className="mt-2 text-xs text-neutral-400">업로드 중...</div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}

// src/features/submissions/components/AdminOmrUploadBox.tsx
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { adminOmrUpload } from "@/features/submissions/api/adminOmrUpload";
import { getRejectionMessage } from "@/features/submissions/contracts/aiJobContract";

export default function AdminOmrUploadBox({
  examId,
  onUploaded,
}: {
  examId: number;
  onUploaded?: (submissionId: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string>("");
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      return adminOmrUpload({
        examId,
        enrollmentId: Number(enrollmentId || 0),
        file,
      });
    },
    onSuccess: (data) => {
      setRejectMessage(null);
      onUploaded?.(data.submission_id);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.rejection_code;
      setRejectMessage(getRejectionMessage(code ?? undefined));
    },
  });

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="text-sm font-semibold text-neutral-100 mb-1">
        OMR 답안 업로드
      </div>
      <div className="text-xs text-neutral-400 mb-3">
        휴대폰 번호 뒤 8자리를 입력하고 스캔 파일을 올리세요.
      </div>

      <input
        className="w-full mb-3 rounded border px-3 py-2 text-sm bg-neutral-900 text-neutral-100"
        placeholder="예: 12345678"
        value={enrollmentId}
        onChange={(e) => setEnrollmentId(e.target.value)}
      />

      <button
        className="w-full rounded-lg bg-neutral-100 px-4 py-2 text-sm text-neutral-950"
        onClick={() => inputRef.current?.click()}
      >
        스캔 파일 선택
      </button>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setRejectMessage(null);
            uploadMut.mutate(f);
          }
        }}
      />

      {rejectMessage && (
        <div className="mt-2 rounded border border-amber-600/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          {rejectMessage}
        </div>
      )}
      <div className="mt-2 text-xs text-neutral-400">
        {uploadMut.isPending
          ? "업로드 중입니다. 잠시만 기다려주세요."
          : "업로드 후 자동으로 인식·채점이 시작됩니다."}
      </div>
    </div>
  );
}

// src/features/submissions/components/AdminOmrUploadBox.tsx
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/shared/ui/ds";
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
    <div className="rounded-xl p-4" style={{ border: '1px solid var(--color-border-divider)', background: 'var(--color-bg-surface)' }}>
      <div className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
        OMR 답안 업로드
      </div>
      <div className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        휴대폰 번호 뒤 8자리를 입력하고 스캔 파일을 올리세요.
      </div>

      <input
        className="w-full mb-3 rounded border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-bg-canvas)', color: 'var(--color-text-primary)' }}
        placeholder="예: 12345678"
        value={enrollmentId}
        onChange={(e) => setEnrollmentId(e.target.value)}
      />

      <Button type="button" intent="primary" size="md" className="w-full" onClick={() => inputRef.current?.click()}>
        스캔 파일 선택
      </Button>

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
        <div className="mt-2 rounded border px-3 py-2 text-xs" style={{ borderColor: 'color-mix(in srgb, var(--color-warning) 40%, var(--color-border-divider))', background: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-surface))', color: 'var(--color-text-primary)' }}>
          {rejectMessage}
        </div>
      )}
      <div className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {uploadMut.isPending
          ? "업로드 중입니다. 잠시만 기다려주세요."
          : "업로드 후 자동으로 인식·채점이 시작됩니다."}
      </div>
    </div>
  );
}

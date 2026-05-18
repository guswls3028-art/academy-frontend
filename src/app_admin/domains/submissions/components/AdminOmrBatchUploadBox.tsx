import { useMemo, useState } from "react";
import type { AxiosError } from "axios";
import api from "@/shared/api/axios";
import { Button } from "@/shared/ui/ds";
import FileUploadZone from "@/shared/ui/upload/FileUploadZone";
import { getRejectionMessage } from "@admin/domains/submissions/contracts/aiJobContract";

type Props = {
  examId: number;
  onUploaded?: () => void;
};

type UploadItem = {
  file: File;
  status: "ready" | "uploading" | "done" | "fail";
  message?: string;
};

type UploadErrorPayload = {
  detail?: unknown;
  rejection_code?: string;
};

const MAX_FILES = 100;

function humanizeBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * AdminOmrBatchUploadBox
 * - OMR 다건 업로드, FileUploadZone(드래그 or 클릭) SSOT 디자인 사용
 * - 서버: POST /submissions/submissions/exams/{examId}/omr/batch/
 */
export default function AdminOmrBatchUploadBox({ examId, onUploaded }: Props) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const readyCount = useMemo(() => items.filter((x) => x.status === "ready").length, [items]);
  const doneCount = useMemo(() => items.filter((x) => x.status === "done").length, [items]);
  const failCount = useMemo(() => items.filter((x) => x.status === "fail").length, [items]);

  const onPickFiles = (files: File[]) => {
    if (!files.length) return;
    setNotice(null);
    const remaining = Math.max(0, MAX_FILES - items.length);
    if (remaining === 0) {
      setNotice(`한 번에 최대 ${MAX_FILES}개 파일까지 업로드할 수 있습니다.`);
      return;
    }
    const accepted = files.slice(0, remaining);
    if (accepted.length < files.length) {
      setNotice(`한 번에 최대 ${MAX_FILES}개 파일까지 업로드할 수 있습니다.`);
    }
    const next: UploadItem[] = accepted.map((f) => ({ file: f, status: "ready" as const }));
    setItems((prev) => [...prev, ...next]);
  };

  const clear = () => {
    if (busy) return;
    setItems([]);
    setNotice(null);
  };

  const removeOne = (idx: number) => {
    if (busy) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const upload = async () => {
    if (busy) return;
    if (!Number.isFinite(examId) || examId <= 0) {
      setNotice("유효하지 않은 examId 입니다.");
      return;
    }
    if (items.length === 0) {
      setNotice("업로드할 파일이 없습니다.");
      return;
    }

    setBusy(true);
    setNotice(null);
    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.status !== "ready") continue;

      setItems((prev) =>
        prev.map((x, idx) => (idx === i ? { ...x, status: "uploading", message: undefined } : x))
      );

      try {
        const fd = new FormData();
        fd.append("files", it.file);

        await api.post(`/submissions/submissions/exams/${examId}/omr/batch/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setItems((prev) =>
          prev.map((x, idx) => (idx === i ? { ...x, status: "done", message: "등록됨" } : x))
        );
        successCount++;
      } catch (e: unknown) {
        const err = e as AxiosError<UploadErrorPayload>;
        const status = err.response?.status;
        const data = err.response?.data;
        const detail = data?.detail;
        const rejectionCode = data?.rejection_code;

        if (status === 404) {
          setItems((prev) =>
            prev.map((x, idx) =>
              idx === i ? { ...x, status: "fail", message: "시험 또는 업로드 경로 확인 필요" } : x
            )
          );
          setNotice(
            "OMR 다건 업로드 경로를 찾지 못했습니다(404). 시험 ID와 배포된 백엔드 라우트를 확인해 주세요."
          );
          break;
        }

        const message = rejectionCode
          ? getRejectionMessage(rejectionCode)
          : String(detail || "업로드 실패");
        setItems((prev) =>
          prev.map((x, idx) =>
            idx === i ? { ...x, status: "fail", message } : x
          )
        );
      }
    }

    setBusy(false);
    if (successCount > 0) onUploaded?.();
  };

  return (
    <>
      <div className="space-y-3">
        <FileUploadZone
          titleLabel="OMR"
          multiple
          accept="image/*,application/pdf"
          hintText="이미지 또는 1페이지 PDF · 최대 100개"
          disabled={busy}
          onFilesSelect={onPickFiles}
        />

        {notice && (
          <div className="rounded border border-yellow-600/30 bg-yellow-600/10 p-3 text-sm text-yellow-800">
            {notice}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            intent="primary"
            size="md"
            disabled={busy || items.length === 0}
            onClick={() => void upload()}
          >
            {busy ? "업로드 중..." : "업로드 시작"}
          </Button>
          <Button
            type="button"
            intent="secondary"
            size="md"
            disabled={busy || items.length === 0}
            onClick={clear}
          >
            비우기
          </Button>
          <span className="text-xs text-[var(--text-muted)]">
            준비 {readyCount} · 완료 {doneCount} · 실패 {failCount}
          </span>
        </div>

        {items.length > 0 ? (
          <div className="rounded border overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>파일</th>
                  <th className="w-[120px]">크기</th>
                  <th className="w-[140px]">상태</th>
                  <th className="w-[100px]">삭제</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={`${it.file.name}-${idx}`}>
                    <td className="text-sm">{it.file.name}</td>
                    <td className="text-sm text-[var(--text-muted)]">{humanizeBytes(it.file.size)}</td>
                    <td className="text-sm">
                      {it.status === "ready" && "대기"}
                      {it.status === "uploading" && "업로드 중..."}
                      {it.status === "done" && <span className="text-emerald-600">완료</span>}
                      {it.status === "fail" && <span className="text-red-600">실패</span>}
                      {it.message ? <span className="ml-2 text-xs text-[var(--text-muted)]">({it.message})</span> : null}
                    </td>
                    <td>
                      <Button type="button" intent="secondary" size="sm" disabled={busy} onClick={() => removeOne(idx)}>
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="text-xs text-[var(--text-muted)]">
          ※ PDF는 답안지 1장당 1개 파일만 지원합니다.
        </div>
      </div>
    </>
  );
}

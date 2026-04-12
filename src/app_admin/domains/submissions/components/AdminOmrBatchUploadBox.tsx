import { useMemo, useRef, useState } from "react";
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
 * - 서버: POST /submissions/exams/{examId}/omr/batch/
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
    const next: UploadItem[] = files.map((f) => ({ file: f, status: "ready" as const }));
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
      } catch (e: any) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        const detail = data?.detail;
        const rejectionCode = data?.rejection_code;

        if (status === 404 || status === 501) {
          setItems((prev) =>
            prev.map((x, idx) =>
              idx === i ? { ...x, status: "fail", message: "API 미연결(404/501)" } : x
            )
          );
          setNotice(
            "다건 업로드 API가 아직 연결되지 않았습니다(404/501). 백엔드에 batch endpoint를 연결하면 바로 활성화됩니다."
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
          hintText="이미지 또는 PDF"
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
                  <th style={{ width: 120 }}>크기</th>
                  <th style={{ width: 140 }}>상태</th>
                  <th style={{ width: 100 }}>삭제</th>
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
          ※ batch API가 없으면 404/501 시 UI가 안내만 표시합니다.
        </div>
      </div>
    </>
  );
}

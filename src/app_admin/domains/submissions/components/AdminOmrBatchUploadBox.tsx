import { useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { CheckCircle2, Trash2, UploadCloud } from "lucide-react";
import api from "@/shared/api/axios";
import { Badge, Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import FileUploadZone from "@/shared/ui/upload/FileUploadZone";
import { getRejectionMessage } from "@admin/domains/submissions/contracts/aiJobContract";
import "./AdminOmrBatchUploadBox.css";

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

function statusLabel(status: UploadItem["status"]): string {
  if (status === "ready") return "대기";
  if (status === "uploading") return "등록 중";
  if (status === "done") return "완료";
  return "실패";
}

function statusTone(status: UploadItem["status"]): "neutral" | "info" | "success" | "danger" {
  if (status === "uploading") return "info";
  if (status === "done") return "success";
  if (status === "fail") return "danger";
  return "neutral";
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
      setNotice("시험 정보를 찾을 수 없습니다.");
      return;
    }
    if (items.length === 0) {
      setNotice("파일을 먼저 선택해주세요.");
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
              idx === i ? { ...x, status: "fail", message: "시험 정보 확인 필요" } : x
            )
          );
          setNotice(
            "시험 정보를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요."
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
    if (successCount > 0) {
      setNotice("등록을 시작했습니다. 잠시 후 성적표에 반영됩니다.");
      onUploaded?.();
    }
  };

  return (
    <div className="admin-omr-upload">
      <div className="admin-omr-upload__zone">
        <FileUploadZone
          titleLabel="스캔 파일 선택"
          multiple
          accept="image/*,application/pdf"
          hintText="사진 또는 1페이지 PDF · 여러 장 선택 가능"
          disabled={busy}
          onFilesSelect={onPickFiles}
        />
      </div>

      {notice && (
        <div className="admin-omr-upload__notice">
          {notice}
        </div>
      )}

      <div className="admin-omr-upload__actions">
        <Button
          type="button"
          intent={items.length === 0 ? "secondary" : "primary"}
          size="lg"
          disabled={busy || items.length === 0}
          onClick={() => void upload()}
          leftIcon={<UploadCloud size={ICON_FOR_BUTTON.lg} />}
        >
          {busy ? "등록 중..." : "등록 시작"}
        </Button>
        <Button
          type="button"
          intent="secondary"
          size="md"
          disabled={busy || items.length === 0}
          onClick={clear}
          leftIcon={<Trash2 size={ICON_FOR_BUTTON.md} />}
        >
          비우기
        </Button>
        <div className="admin-omr-upload__summary" aria-live="polite">
          <Badge variant="soft" tone="neutral">대기 {readyCount}</Badge>
          <Badge variant="soft" tone="success">완료 {doneCount}</Badge>
          <Badge variant="soft" tone={failCount > 0 ? "danger" : "neutral"}>실패 {failCount}</Badge>
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="admin-omr-upload__file-list" aria-label="선택한 OMR 파일">
          {items.map((it, idx) => (
            <li key={`${it.file.name}-${idx}`} className="admin-omr-upload__file">
              <div className="admin-omr-upload__file-main">
                {it.status === "done" ? (
                  <CheckCircle2 size={ICON.sm} className="admin-omr-upload__file-icon admin-omr-upload__file-icon--done" />
                ) : (
                  <UploadCloud size={ICON.sm} className="admin-omr-upload__file-icon" />
                )}
                <div className="admin-omr-upload__file-text">
                  <span className="admin-omr-upload__file-name">{it.file.name}</span>
                  <span className="admin-omr-upload__file-size">{humanizeBytes(it.file.size)}</span>
                </div>
              </div>
              <div className="admin-omr-upload__file-state">
                <Badge variant="solid" tone={statusTone(it.status)}>
                  {statusLabel(it.status)}
                </Badge>
                {it.message ? <span className="admin-omr-upload__file-message">{it.message}</span> : null}
                <Button
                  type="button"
                  intent="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => removeOne(idx)}
                  leftIcon={<Trash2 size={ICON_FOR_BUTTON.sm} />}
                >
                  삭제
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="admin-omr-upload__footnote">
        PDF는 답안지 1장당 1개 파일만 지원합니다.
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { CheckCircle2, Trash2, UploadCloud } from "lucide-react";
import {
  fetchOmrUploadBatchApi,
  initializeOmrUploadBatchApi,
  uploadOmrBatchApi,
} from "@/shared/api/contracts/submissions";
import { Badge, Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import FileUploadZone from "@/shared/ui/upload/FileUploadZone";
import { getRejectionMessage } from "@admin/domains/submissions/contracts/aiJobContract";
import "./AdminOmrBatchUploadBox.css";

type Props = {
  examId: number;
  sessionId?: number | null;
  resumeBatchId?: string | null;
  onUploaded?: () => void;
};

type UploadItem = {
  file: File;
  ordinal?: number;
  status: "ready" | "uploading" | "received" | "fail";
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
  if (status === "received") return "접수됨";
  return "실패";
}

function statusTone(status: UploadItem["status"]): "neutral" | "info" | "success" | "danger" {
  if (status === "uploading") return "info";
  if (status === "received") return "success";
  if (status === "fail") return "danger";
  return "neutral";
}

/**
 * AdminOmrBatchUploadBox
 * - OMR 다건 업로드, FileUploadZone(드래그 or 클릭) SSOT 디자인 사용
 * - 서버: POST /submissions/submissions/exams/{examId}/omr/batch/
 */
export default function AdminOmrBatchUploadBox({
  examId,
  sessionId,
  resumeBatchId,
  onUploaded,
}: Props) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingResume, setLoadingResume] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(resumeBatchId ?? null);
  const [resumeOrdinals, setResumeOrdinals] = useState<number[]>([]);

  const readyCount = useMemo(() => items.filter((x) => x.status === "ready").length, [items]);
  const receivedCount = useMemo(
    () => items.filter((x) => x.status === "received").length,
    [items],
  );
  const failCount = useMemo(() => items.filter((x) => x.status === "fail").length, [items]);

  useEffect(() => {
    if (!resumeBatchId) return;
    let cancelled = false;
    setLoadingResume(true);
    fetchOmrUploadBatchApi(resumeBatchId)
      .then((batch) => {
        if (cancelled) return;
        const fileRetryOrdinals = [
          ...new Set([
            ...batch.pending_admission_ordinals,
            ...batch.admission_failed_ordinals,
          ]),
        ].sort((left, right) => left - right);
        if (batch.exam_id !== examId || fileRetryOrdinals.length === 0) {
          setNotice("다시 선택할 파일이 없거나 시험 정보가 일치하지 않습니다.");
          return;
        }
        setBatchId(batch.id);
        setResumeOrdinals(fileRetryOrdinals);
        setNotice(`${fileRetryOrdinals.length}개 미접수 파일을 순서대로 다시 선택해 주세요.`);
        asyncStatusStore.upsertOmrBatch(batch);
      })
      .catch(() => {
        if (!cancelled) setNotice("OMR 등록 작업을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoadingResume(false);
      });
    return () => { cancelled = true; };
  }, [examId, resumeBatchId]);

  const onPickFiles = (files: File[]) => {
    if (!files.length) return;
    setNotice(null);
    const selectionLimit = resumeOrdinals.length > 0 ? resumeOrdinals.length : MAX_FILES;
    const remaining = Math.max(0, selectionLimit - items.length);
    if (remaining === 0) {
      setNotice(
        resumeOrdinals.length > 0
          ? `${resumeOrdinals.length}개 미접수 파일만 다시 선택할 수 있습니다.`
          : `한 번에 최대 ${MAX_FILES}개 파일까지 업로드할 수 있습니다.`,
      );
      return;
    }
    const accepted = files.slice(0, remaining);
    if (accepted.length < files.length) {
      setNotice(
        resumeOrdinals.length > 0
          ? `${resumeOrdinals.length}개 미접수 파일만 다시 선택할 수 있습니다.`
          : `한 번에 최대 ${MAX_FILES}개 파일까지 업로드할 수 있습니다.`,
      );
    }
    const next: UploadItem[] = accepted.map((file, index) => ({
      file,
      ordinal: resumeOrdinals.length > 0 ? resumeOrdinals[items.length + index] : undefined,
      status: "ready" as const,
    }));
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

    if (resumeOrdinals.length > 0 && items.length !== resumeOrdinals.length) {
      setNotice(`${resumeOrdinals.length}개 미접수 파일을 모두 다시 선택해 주세요.`);
      return;
    }

    setBusy(true);
    setNotice(null);
    let activeBatchId = batchId;
    let uploadItems = items.filter((item) => item.status === "ready" || item.status === "fail");
    try {
      if (!activeBatchId) {
        const initialized = await initializeOmrUploadBatchApi({
          examId,
          totalCount: uploadItems.length,
          sessionId,
        });
        activeBatchId = initialized.id;
        setBatchId(initialized.id);
        asyncStatusStore.upsertOmrBatch(initialized);
        uploadItems = uploadItems.map((item, index) => ({ ...item, ordinal: index + 1 }));
        setItems(uploadItems.map((item) => ({ ...item, status: "uploading", message: undefined })));
      } else {
        setItems((previous) => previous.map((item) =>
          uploadItems.includes(item)
            ? { ...item, status: "uploading", message: undefined }
            : item
        ));
      }

      const result = await uploadOmrBatchApi({
        examId,
        files: uploadItems.map((item) => item.file),
        batchId: activeBatchId,
        itemOrdinals: uploadItems.map((item) => Number(item.ordinal)),
      });
      asyncStatusStore.upsertOmrBatch(result);
      const failed = new Set(result.admission_failed_ordinals);
      setItems((previous) => failed.size > 0
        ? []
        : previous.map((item) => ({
            ...item,
            status: "received",
            message: "접수됨 · AI 처리 대기",
          })));
      setResumeOrdinals(result.admission_failed_ordinals);
      setNotice(
        result.admission_failed_ordinals.length > 0
          ? `${result.created_count}건 접수, ${result.admission_failed_ordinals.length}건은 다시 선택이 필요합니다.`
          : `${result.created_count}건을 접수했습니다. AI 처리 상태는 작업박스에서 계속 확인할 수 있습니다.`,
      );
      if (result.created_count > 0) onUploaded?.();
    } catch (e: unknown) {
      const err = e as AxiosError<UploadErrorPayload>;
      const detail = err.response?.data?.detail;
      const rejectionCode = err.response?.data?.rejection_code;
      const message = rejectionCode
        ? getRejectionMessage(rejectionCode)
        : String(detail || "접수 응답을 확인하지 못했습니다.");
      if (activeBatchId) {
        try {
          const recovered = await fetchOmrUploadBatchApi(activeBatchId);
          asyncStatusStore.upsertOmrBatch(recovered);
          const fileRetryOrdinals = [
            ...new Set([
              ...recovered.pending_admission_ordinals,
              ...recovered.admission_failed_ordinals,
            ]),
          ].sort((left, right) => left - right);
          const requiresFile = new Set(fileRetryOrdinals);
          setItems((previous) => requiresFile.size > 0
            ? []
            : previous.map((item) => ({
                ...item,
                status: "received",
                message: "서버에서 접수 상태 확인됨",
              })));
          setResumeOrdinals(fileRetryOrdinals);
          setNotice("응답이 중단되어 서버의 접수 결과를 복구했습니다. 미접수 항목만 다시 선택해 주세요.");
        } catch {
          setItems((previous) => previous.map((item) =>
            item.status === "uploading"
              ? { ...item, status: "fail", message: "작업박스에서 상태 확인 필요" }
              : item
          ));
          setNotice(`${message} 작업박스에서 현재 상태를 확인해 주세요.`);
        }
      } else {
        setItems((previous) => previous.map((item) =>
          item.status === "uploading" ? { ...item, status: "fail", message } : item
        ));
        setNotice(message);
      }
    } finally {
      setBusy(false);
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
          disabled={busy || loadingResume}
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
          disabled={busy || loadingResume || items.length === 0}
          onClick={() => void upload()}
          leftIcon={<UploadCloud size={ICON_FOR_BUTTON.lg} />}
        >
          {busy ? "접수 중..." : resumeOrdinals.length > 0 ? "미접수 파일 다시 접수" : "등록 시작"}
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
          <Badge variant="soft" tone="success">접수됨 {receivedCount}</Badge>
          <Badge variant="soft" tone={failCount > 0 ? "danger" : "neutral"}>실패 {failCount}</Badge>
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="admin-omr-upload__file-list" aria-label="선택한 OMR 파일">
          {items.map((it, idx) => (
            <li key={`${it.file.name}-${idx}`} className="admin-omr-upload__file">
              <div className="admin-omr-upload__file-main">
                {it.status === "received" ? (
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

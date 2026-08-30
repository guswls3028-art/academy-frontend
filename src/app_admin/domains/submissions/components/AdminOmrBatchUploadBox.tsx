import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AxiosError } from "axios";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  RotateCcw,
  RotateCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  fetchOmrUploadBatchApi,
  initializeOmrUploadBatchApi,
  uploadOmrBatchApi,
} from "@/shared/api/contracts/submissions";
import { Badge, Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
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
  rotation: 0 | 90 | 180 | 270;
  ordinal?: number;
  status: "ready" | "uploading" | "received" | "fail";
  message?: string;
};

type UploadErrorPayload = {
  detail?: unknown;
  rejection_code?: string;
};

const MAX_FILES = 100;

function rotateValue(
  current: UploadItem["rotation"],
  delta: 90 | 270,
): UploadItem["rotation"] {
  return ((current + delta) % 360) as UploadItem["rotation"];
}

async function rotatedImageFile(
  file: File,
  rotation: UploadItem["rotation"],
): Promise<File> {
  if (rotation === 0 || !file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  try {
    const quarterTurn = rotation === 90 || rotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = quarterTurn ? bitmap.height : bitmap.width;
    canvas.height = quarterTurn ? bitmap.width : bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지 회전 도구를 사용할 수 없습니다.");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("회전 이미지 생성에 실패했습니다.")),
        outputType,
        outputType === "image/jpeg" ? 0.96 : undefined,
      );
    });
    return new File([blob], file.name, { type: outputType, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

function UploadPreview({ item }: { item: UploadItem }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!item.file.type.startsWith("image/")) {
      setSrc(null);
      return;
    }
    const next = URL.createObjectURL(item.file);
    setSrc(next);
    return () => URL.revokeObjectURL(next);
  }, [item.file]);
  if (!src) return <UploadCloud size={ICON.sm} className="admin-omr-upload__file-icon" />;
  return (
    <span className="admin-omr-upload__preview" aria-hidden="true">
      <img
        src={src}
        alt=""
        className={`admin-omr-upload__preview-image admin-omr-upload__preview-image--rotation-${item.rotation}`}
      />
    </span>
  );
}

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

function isValidOrdinal(value: number, totalCount: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= totalCount;
}

function hasExactOrdinals(items: UploadItem[], expectedOrdinals: number[]): boolean {
  const selectedOrdinals = items.map((item) => item.ordinal);
  if (
    selectedOrdinals.length !== expectedOrdinals.length
    || selectedOrdinals.some((ordinal) => ordinal === undefined || !Number.isInteger(ordinal))
  ) {
    return false;
  }
  const selected = new Set(selectedOrdinals);
  return selected.size === selectedOrdinals.length
    && expectedOrdinals.every((ordinal) => selected.has(ordinal));
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
  const [batchId, setBatchId] = useState<string | null>(null);
  const [resumeOrdinals, setResumeOrdinals] = useState<number[]>([]);
  const [validatedResumeBatchId, setValidatedResumeBatchId] = useState<string | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const isCurrentSession = useCallback((tenant: string, generation: number) => (
    mountedRef.current
    && asyncStatusStore.getSessionGeneration() === generation
    && (getTenantCodeForApiRequest() ?? "") === tenant
  ), []);
  const resumeUploadBlocked = Boolean(
    resumeBatchId && validatedResumeBatchId !== resumeBatchId,
  );

  const readyCount = useMemo(() => items.filter((x) => x.status === "ready").length, [items]);
  const receivedCount = useMemo(
    () => items.filter((x) => x.status === "received").length,
    [items],
  );
  const failCount = useMemo(() => items.filter((x) => x.status === "fail").length, [items]);

  useEffect(() => {
    if (!resumeBatchId) {
      setValidatedResumeBatchId(null);
      return;
    }
    let cancelled = false;
    const tenant = getTenantCodeForApiRequest() ?? "";
    const generation = asyncStatusStore.getSessionGeneration();
    const isActive = () => !cancelled && isCurrentSession(tenant, generation);
    setLoadingResume(true);
    setValidatedResumeBatchId(null);
    setBatchId(null);
    setResumeOrdinals([]);
    setItems([]);
    fetchOmrUploadBatchApi(resumeBatchId)
      .then((batch) => {
        if (!isActive()) return;
        const rawRetryOrdinals = [
          ...batch.pending_admission_ordinals,
          ...batch.admission_failed_ordinals,
        ];
        const fileRetryOrdinals = [...rawRetryOrdinals].sort((left, right) => left - right);
        const validOrdinals = Number.isInteger(batch.total_count)
          && batch.total_count > 0
          && rawRetryOrdinals.length === new Set(rawRetryOrdinals).size
          && rawRetryOrdinals.every((ordinal) => isValidOrdinal(ordinal, batch.total_count));
        if (
          batch.id !== resumeBatchId
          || batch.exam_id !== examId
          || batch.session_id !== sessionId
          || !validOrdinals
          || fileRetryOrdinals.length === 0
        ) {
          setNotice("다시 선택할 파일이 없거나 시험 정보가 일치하지 않습니다.");
          return;
        }
        setBatchId(batch.id);
        setResumeOrdinals(fileRetryOrdinals);
        setValidatedResumeBatchId(resumeBatchId);
        setNotice(`${fileRetryOrdinals.length}개 미접수 파일을 순서대로 다시 선택해 주세요.`);
        asyncStatusStore.upsertOmrBatch(batch);
      })
      .catch(() => {
        if (isActive()) setNotice("OMR 등록 작업을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (isActive()) setLoadingResume(false);
      });
    return () => { cancelled = true; };
  }, [examId, isCurrentSession, resumeBatchId, sessionId]);

  const onPickFiles = (files: File[]) => {
    if (!files.length || resumeUploadBlocked) return;
    setNotice(null);
    const selectionLimit = resumeOrdinals.length > 0 ? resumeOrdinals.length : MAX_FILES;
    const usedOrdinals = new Set(items.map((item) => item.ordinal));
    const vacantResumeOrdinals = resumeOrdinals.filter((ordinal) => !usedOrdinals.has(ordinal));
    const remaining = resumeOrdinals.length > 0
      ? vacantResumeOrdinals.length
      : Math.max(0, selectionLimit - items.length);
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
      rotation: 0,
      ordinal: resumeOrdinals.length > 0 ? vacantResumeOrdinals[index] : undefined,
      status: "ready" as const,
    }));
    setItems((prev) => [...prev, ...next]);
  };

  const clear = () => {
    if (busy) return;
    setItems([]);
    setNotice(null);
    if (resumeOrdinals.length === 0) setBatchId(null);
  };

  const removeOne = (idx: number) => {
    if (busy) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveOne = (idx: number, delta: -1 | 1) => {
    if (busy || resumeOrdinals.length > 0) return;
    setItems((previous) => {
      const nextIndex = idx + delta;
      if (nextIndex < 0 || nextIndex >= previous.length) return previous;
      const next = [...previous];
      [next[idx], next[nextIndex]] = [next[nextIndex], next[idx]];
      return next;
    });
  };

  const rotateOne = (idx: number, delta: 90 | 270) => {
    if (busy) return;
    setItems((previous) => previous.map((item, itemIndex) => (
      itemIndex === idx && item.file.type.startsWith("image/")
        ? { ...item, rotation: rotateValue(item.rotation, delta) }
        : item
    )));
  };

  const upload = async () => {
    if (busy) return;
    if (!Number.isFinite(examId) || examId <= 0) {
      setNotice("시험 정보를 찾을 수 없습니다.");
      return;
    }
    if (resumeUploadBlocked) {
      setNotice("OMR 등록 작업을 확인하지 못해 파일을 접수할 수 없습니다.");
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

    let activeBatchId = batchId;
    let uploadItems = items.filter((item) => item.status === "ready" || item.status === "fail");
    if (
      activeBatchId
      && (
        resumeOrdinals.length === 0
        || !hasExactOrdinals(uploadItems, resumeOrdinals)
      )
    ) {
      setNotice("미접수 파일 순서를 확인할 수 없습니다. 작업을 다시 불러와 주세요.");
      return;
    }
    const tenant = getTenantCodeForApiRequest() ?? "";
    const generation = asyncStatusStore.getSessionGeneration();
    const isActive = () => isCurrentSession(tenant, generation);
    setBusy(true);
    setNotice(null);
    try {
      // Client-side rotation must succeed before reserving a durable server
      // batch. A corrupt image then stays in the editable list instead of
      // creating a pending batch that forces the teacher to reselect files.
      const preparedFiles = await Promise.all(
        uploadItems.map((item) => rotatedImageFile(item.file, item.rotation)),
      );
      if (!activeBatchId) {
        const initialized = await initializeOmrUploadBatchApi({
          examId,
          totalCount: uploadItems.length,
          sessionId,
        });
        if (!isActive()) return;
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
        files: preparedFiles,
        batchId: activeBatchId,
        itemOrdinals: uploadItems.map((item) => Number(item.ordinal)),
      });
      if (!isActive()) return;
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
      if (result.admission_failed_ordinals.length === 0) setBatchId(null);
      setNotice(
        result.admission_failed_ordinals.length > 0
          ? `${result.created_count}건 접수, ${result.admission_failed_ordinals.length}건은 다시 선택이 필요합니다.`
          : result.counts.duplicate > 0
            ? `${result.created_count}건 신규 접수, 동일 파일 ${result.counts.duplicate}건은 기존 답안지를 사용합니다.`
            : `${result.created_count}건을 접수했습니다. AI 처리 상태는 작업박스에서 계속 확인할 수 있습니다.`,
      );
      if (result.created_count > 0) onUploaded?.();
    } catch (e: unknown) {
      if (!isActive()) return;
      const err = e as AxiosError<UploadErrorPayload>;
      const detail = err.response?.data?.detail;
      const rejectionCode = err.response?.data?.rejection_code;
      const message = rejectionCode
        ? getRejectionMessage(rejectionCode)
        : String(detail || (e instanceof Error ? e.message : "") || "접수 응답을 확인하지 못했습니다.");
      if (activeBatchId) {
        try {
          const recovered = await fetchOmrUploadBatchApi(activeBatchId);
          if (!isActive()) return;
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
          if (fileRetryOrdinals.length === 0) setBatchId(null);
          setNotice("응답이 중단되어 서버의 접수 결과를 복구했습니다. 미접수 항목만 다시 선택해 주세요.");
        } catch {
          if (!isActive()) return;
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
      if (isActive()) setBusy(false);
    }
  };

  return (
    <div className="admin-omr-upload">
      <fieldset
        className="admin-omr-upload__zone"
        disabled={busy || loadingResume || resumeUploadBlocked}
      >
        <FileUploadZone
          titleLabel="스캔 파일 선택"
          multiple
          accept="image/*,application/pdf"
          hintText="사진 또는 1페이지 PDF · 여러 장 선택 가능"
          disabled={busy || loadingResume || resumeUploadBlocked}
          onFilesSelect={onPickFiles}
        />
      </fieldset>

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
          disabled={busy || loadingResume || resumeUploadBlocked || readyCount + failCount === 0}
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
                  <UploadPreview item={it} />
                )}
                <div className="admin-omr-upload__file-text">
                  <span className="admin-omr-upload__file-name">{it.file.name}</span>
                  <span className="admin-omr-upload__file-size">{humanizeBytes(it.file.size)}</span>
                  {it.rotation !== 0 ? (
                    <span className="admin-omr-upload__file-rotation">업로드 회전 {it.rotation}°</span>
                  ) : null}
                </div>
              </div>
              <div className="admin-omr-upload__file-state">
                <Badge variant="solid" tone={statusTone(it.status)}>
                  {statusLabel(it.status)}
                </Badge>
                {it.message ? <span className="admin-omr-upload__file-message">{it.message}</span> : null}
                <div className="admin-omr-upload__file-controls" aria-label={`${it.file.name} 조정`}>
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    disabled={busy || resumeOrdinals.length > 0 || idx === 0}
                    onClick={() => moveOne(idx, -1)}
                    aria-label="위로 이동"
                    title={resumeOrdinals.length > 0 ? "재접수 순서는 변경할 수 없습니다." : "위로 이동"}
                  >
                    <ArrowUp size={ICON_FOR_BUTTON.sm} />
                  </Button>
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    disabled={busy || resumeOrdinals.length > 0 || idx === items.length - 1}
                    onClick={() => moveOne(idx, 1)}
                    aria-label="아래로 이동"
                    title={resumeOrdinals.length > 0 ? "재접수 순서는 변경할 수 없습니다." : "아래로 이동"}
                  >
                    <ArrowDown size={ICON_FOR_BUTTON.sm} />
                  </Button>
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    disabled={busy || !it.file.type.startsWith("image/")}
                    onClick={() => rotateOne(idx, 270)}
                    aria-label="왼쪽 회전"
                    title={it.file.type.startsWith("image/") ? "왼쪽 90°" : "PDF는 업로드 후 검토 화면에서 회전해 주세요."}
                  >
                    <RotateCcw size={ICON_FOR_BUTTON.sm} />
                  </Button>
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    disabled={busy || !it.file.type.startsWith("image/")}
                    onClick={() => rotateOne(idx, 90)}
                    aria-label="오른쪽 회전"
                    title={it.file.type.startsWith("image/") ? "오른쪽 90°" : "PDF는 업로드 후 검토 화면에서 회전해 주세요."}
                  >
                    <RotateCw size={ICON_FOR_BUTTON.sm} />
                  </Button>
                </div>
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

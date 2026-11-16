import { useCallback, useEffect, useRef, useState } from "react";
import type { AxiosError } from "axios";
import {
  ArrowDown,
  ArrowUp,
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
import type { OmrUploadBatchSummary } from "@/shared/api/contracts/submissions";
import { Badge, Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { asyncStatusStore } from "@/shared/ui/asyncStatus/asyncStatusStore";
import { useAsyncStatus } from "@/shared/ui/asyncStatus/useAsyncStatus";
import OmrBatchLedger from "@/shared/ui/asyncStatus/OmrBatchLedger";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import FileUploadZone from "@/shared/ui/upload/FileUploadZone";
import { createRandomUuid } from "@/shared/utils/randomUuid";
import { getRejectionMessage } from "@admin/domains/submissions/contracts/aiJobContract";
import "./AdminOmrBatchUploadBox.css";

type Props = {
  examId: number;
  sessionId?: number | null;
  resumeBatchId?: string | null;
  onUploaded?: () => void;
};

type UploadItem = {
  id: number;
  file: File;
  rotation: 0 | 90 | 180 | 270;
  ordinal?: number;
  status: "ready" | "uploading" | "fail";
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
        loading="lazy"
        decoding="async"
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
  return "실패";
}

function statusTone(status: UploadItem["status"]): "neutral" | "info" | "danger" {
  if (status === "uploading") return "info";
  if (status === "fail") return "danger";
  return "neutral";
}

function isValidOrdinal(value: number, totalCount: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= totalCount;
}

function getFileRetryOrdinals(batch: OmrUploadBatchSummary): number[] {
  return [...batch.pending_admission_ordinals, ...batch.admission_failed_ordinals]
    .sort((left, right) => left - right);
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
  const [ledgerBatchId, setLedgerBatchId] = useState<string | null>(null);
  const [ledgerFileNames, setLedgerFileNames] = useState<Record<number, string>>({});
  const tasks = useAsyncStatus();
  const ledgerBatch = tasks.find((task) => task.omrBatch?.id === ledgerBatchId)?.omrBatch;
  const [resumeOrdinals, setResumeOrdinals] = useState<number[]>([]);
  const [validatedResumeBatchId, setValidatedResumeBatchId] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const nextFileId = useRef(0);
  const initializationRef = useRef<{ scope: string; id: string } | null>(null);
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
  const resuming = resumeOrdinals.length > 0;
  const needsResumeOrdering = resuming && items.some((item) => item.ordinal === undefined);
  const resumeSelectionComplete = !resuming || items.length === resumeOrdinals.length;

  const ledgerRetryCount = ledgerBatch ? getFileRetryOrdinals(ledgerBatch).length : 0;
  const ledgerReceivedCount = ledgerBatch
    ? ledgerBatch.total_count - ledgerBatch.duplicate_ordinals.length - ledgerRetryCount
    : 0;

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
    setLedgerBatchId(null);
    setLedgerFileNames({});
    setResumeOrdinals([]);
    setItems([]);
    fetchOmrUploadBatchApi(resumeBatchId)
      .then((batch) => {
        if (!isActive()) return;
        const fileRetryOrdinals = getFileRetryOrdinals(batch);
        const validOrdinals = Number.isInteger(batch.total_count)
          && batch.total_count > 0
          && fileRetryOrdinals.length === new Set(fileRetryOrdinals).size
          && fileRetryOrdinals.every((ordinal) => isValidOrdinal(ordinal, batch.total_count));
        if (
          batch.id !== resumeBatchId
          || batch.exam_id !== examId
          || batch.session_id !== sessionId
          || !validOrdinals
        ) {
          setNotice("등록 작업의 시험 또는 파일 순서가 일치하지 않습니다.");
          return;
        }
        setLedgerBatchId(batch.id);
        asyncStatusStore.upsertOmrBatch(batch);
        if (fileRetryOrdinals.length > 0) {
          setBatchId(batch.id);
          setResumeOrdinals(fileRetryOrdinals);
          setValidatedResumeBatchId(resumeBatchId);
        }
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
    const emptyFileCount = files.filter((file) => file.size <= 0).length;
    if (emptyFileCount > 0) {
      setNotice(`빈 파일 ${emptyFileCount}개가 있어 선택을 중단했습니다.`);
      return;
    }
    setNotice(null);
    const remainingCapacity = MAX_FILES - items.length;
    if (remainingCapacity === 0 || (resuming && files.length > remainingCapacity)) {
      setNotice(`최대 ${MAX_FILES}장까지 선택할 수 있습니다. 목록에서 파일을 빼고 다시 선택해 주세요.`);
      return;
    }
    const accepted = files.slice(0, remainingCapacity);
    if (accepted.length < files.length) {
      setNotice(`한 번에 최대 ${MAX_FILES}개 파일까지 업로드할 수 있습니다.`);
    }
    const usedOrdinals = new Set(items.map((item) => item.ordinal));
    const vacantResumeOrdinals = resumeOrdinals.filter((ordinal) => !usedOrdinals.has(ordinal));
    const reviewSelection = resuming && (needsResumeOrdering || accepted.length > vacantResumeOrdinals.length);
    const next: UploadItem[] = accepted.map((file, index) => ({
      id: ++nextFileId.current,
      file,
      rotation: 0,
      ordinal: reviewSelection ? undefined : vacantResumeOrdinals[index],
      status: "ready" as const,
    }));
    setItems((prev) => [
      ...(reviewSelection ? prev.map((item) => ({ ...item, ordinal: undefined })) : prev),
      ...next,
    ]);
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

  const moveOne = (idx: number, delta: -1 | 1, button: HTMLButtonElement) => {
    const nextIndex = idx + delta;
    if (busy || nextIndex < 0 || nextIndex >= items.length) return;
    if (document.activeElement === button) {
      requestAnimationFrame(() => {
        if (button.isConnected && document.activeElement === document.body) {
          button.focus({ preventScroll: true });
        }
      });
    }
    setItems((previous) => {
      if (nextIndex >= previous.length || idx >= previous.length) return previous;
      const next = [...previous];
      next[idx] = { ...previous[nextIndex], ordinal: previous[idx].ordinal };
      next[nextIndex] = { ...previous[idx], ordinal: previous[nextIndex].ordinal };
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

    if (!resumeSelectionComplete) {
      setNotice(`${resumeOrdinals.length}개 미접수 파일을 모두 다시 선택해 주세요.`);
      return;
    }

    let activeBatchId = batchId;
    let initializationSent = false;
    const orderedItems = needsResumeOrdering
      ? items.map((item, index) => ({ ...item, ordinal: resumeOrdinals[index] }))
      : items;
    let uploadItems = orderedItems.filter((item) => item.status === "ready" || item.status === "fail");
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
    const rememberSelectedNames = (replayedOrdinals?: ReadonlySet<number>) => {
      const names = Object.fromEntries(uploadItems.flatMap((item) =>
        item.ordinal === undefined || replayedOrdinals?.has(item.ordinal)
          ? []
          : [[item.ordinal, item.file.name]]));
      setLedgerFileNames((previous) => ({ ...previous, ...names }));
    };
    const showReceipt = (batch: OmrUploadBatchSummary) => {
      const fileRetryOrdinals = getFileRetryOrdinals(batch);
      asyncStatusStore.upsertOmrBatch(batch);
      setItems([]);
      setResumeOrdinals(fileRetryOrdinals);
      setBatchId(fileRetryOrdinals.length > 0 ? batch.id : null);
      if (fileRetryOrdinals.length < batch.total_count) onUploaded?.();
    };
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
        const scope = JSON.stringify([tenant, generation, examId, sessionId ?? null, uploadItems.length]);
        if (initializationRef.current?.scope !== scope) {
          initializationRef.current = { scope, id: createRandomUuid() };
        }
        initializationSent = true;
        const initialized = await initializeOmrUploadBatchApi({
          examId,
          totalCount: uploadItems.length,
          sessionId,
          clientRequestId: initializationRef.current.id,
        });
        if (!isActive()) return;
        initializationRef.current = null;
        activeBatchId = initialized.id;
        setBatchId(initialized.id);
        setLedgerBatchId(initialized.id);
        setLedgerFileNames({});
        asyncStatusStore.upsertOmrBatch(initialized);
        uploadItems = uploadItems.map((item, index) => ({ ...item, ordinal: index + 1 }));
      }
      setItems(uploadItems.map((item) => ({ ...item, status: "uploading" })));

      const result = await uploadOmrBatchApi({
        examId,
        files: preparedFiles,
        batchId: activeBatchId,
        itemOrdinals: uploadItems.map((item) => Number(item.ordinal)),
      });
      if (!isActive()) return;
      const createdIds = new Set(result.submission_ids);
      const replayedOrdinals = new Set(result.items
        ?.filter((item) => item.admission_status === "received" && !createdIds.has(item.submission_id ?? 0))
        .map((item) => item.ordinal));
      rememberSelectedNames(replayedOrdinals);
      showReceipt(result);
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
          rememberSelectedNames();
          showReceipt(recovered);
          setNotice("응답이 중단되어 서버의 접수 결과를 복구했습니다.");
        } catch {
          if (!isActive()) return;
          setItems(uploadItems.map((item) => ({ ...item, status: "fail" })));
          setResumeOrdinals(uploadItems.map((item) => Number(item.ordinal)).sort((left, right) => left - right));
          setNotice(`${message} 같은 파일로 다시 접수하거나 작업박스에서 현재 상태를 확인해 주세요.`);
        }
      } else {
        setItems((previous) => previous.map((item) =>
          item.status === "uploading" ? { ...item, status: "fail", message } : item
        ));
        setNotice(initializationSent && (!err.response || err.response.status >= 500)
          ? "등록 작업 응답을 확인하지 못했습니다. 선택한 파일로 등록 시작을 다시 눌러 주세요."
          : message);
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
          titleLabel="스캔본·촬영 사진 선택"
          multiple
          accept="image/*,application/pdf"
          hintText="JPG·PNG·TIFF·1페이지 PDF · 최대 100장 · 파일당 10MB"
          disabled={busy || loadingResume || resumeUploadBlocked}
          onFilesSelect={onPickFiles}
          onInvalidFile={setNotice}
          rejectMixedInvalid
        />
      </fieldset>

      {notice && (
        <div className="admin-omr-upload__notice" role="status">
          {notice}
        </div>
      )}
      {resuming && items.length > 0 && !busy && (
        <p className="admin-omr-upload__notice" role="status">
          {needsResumeOrdering
            ? `미접수 ${resumeOrdinals.length}장만 남도록 이미 접수된 파일을 선택에서 빼고 답안지 번호 순서로 맞춰 주세요.`
            : `미접수 ${resumeOrdinals.length}장의 파일과 접수 순번을 확인해 주세요.`}
        </p>
      )}

      <div className="admin-omr-upload__actions">
        <Button
          type="button"
          intent={items.length === 0 ? "secondary" : "primary"}
          size="lg"
          disabled={busy || loadingResume || resumeUploadBlocked || items.length === 0 || !resumeSelectionComplete}
          onClick={() => void upload()}
          leftIcon={<UploadCloud size={ICON_FOR_BUTTON.lg} />}
        >
          {busy ? "접수 중..." : resuming ? "미접수 파일 다시 접수" : "등록 시작"}
        </Button>
        {items.length > 0 && (
          <Button type="button" intent="secondary" size="md" disabled={busy} onClick={clear}>
            선택 비우기
          </Button>
        )}
        {items.length > 0 && <span className="admin-omr-upload__count">선택 {items.length}장</span>}
      </div>

      {items.length > 0 ? (
        <ul className="admin-omr-upload__file-list" aria-label="선택한 OMR 파일">
          {items.map((it, idx) => (
            <li key={it.id} className="admin-omr-upload__file">
              <div className="admin-omr-upload__file-main">
                <UploadPreview item={it} />
                <div className="admin-omr-upload__file-text">
                  <span className="admin-omr-upload__file-name" title={it.file.name}>{it.file.name}</span>
                  <span className="admin-omr-upload__file-size">{humanizeBytes(it.file.size)}</span>
                  {resuming && items.length <= resumeOrdinals.length && (
                    <span className="admin-omr-upload__file-size">{it.ordinal ?? resumeOrdinals[idx]}번 답안지</span>
                  )}
                  {it.rotation !== 0 ? (
                    <span className="admin-omr-upload__file-rotation">업로드 회전 {it.rotation}°</span>
                  ) : null}
                </div>
              </div>
              <div className="admin-omr-upload__file-status">
                <Badge variant="solid" tone={statusTone(it.status)}>
                  {statusLabel(it.status)}
                </Badge>
              </div>
              <div className="admin-omr-upload__file-controls" role="group" aria-label={`${it.file.name} 조정`}>
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    disabled={busy}
                    aria-disabled={idx === 0 || undefined}
                    tabIndex={idx === 0 ? -1 : undefined}
                    onClick={(event) => moveOne(idx, -1, event.currentTarget)}
                    aria-label="위로 이동"
                    title="위로 이동"
                  >
                    <ArrowUp size={ICON_FOR_BUTTON.sm} />
                  </Button>
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    disabled={busy}
                    aria-disabled={idx === items.length - 1 || undefined}
                    tabIndex={idx === items.length - 1 ? -1 : undefined}
                    onClick={(event) => moveOne(idx, 1, event.currentTarget)}
                    aria-label="아래로 이동"
                    title="아래로 이동"
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
                <Button
                  type="button"
                  intent="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => removeOne(idx)}
                  leftIcon={<Trash2 size={ICON_FOR_BUTTON.sm} />}
                >
                  {needsResumeOrdering ? "선택에서 빼기" : "삭제"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {ledgerBatch && !busy && (
        <section className="admin-omr-upload__receipt" aria-label="OMR 등록 결과">
          <div className="admin-omr-upload__summary" role="status">
            <strong>전체 {ledgerBatch.total_count}장</strong>
            <Badge variant="soft" tone={ledgerReceivedCount > 0 ? "success" : "neutral"}>
              접수 확인 {ledgerReceivedCount}장
            </Badge>
            {ledgerBatch.duplicate_ordinals.length > 0 && (
              <Badge variant="soft" tone="neutral">동일 파일 {ledgerBatch.duplicate_ordinals.length}장</Badge>
            )}
            {ledgerRetryCount > 0 && <Badge variant="soft" tone="warning">다시 선택 {ledgerRetryCount}장</Badge>}
          </div>
          {ledgerRetryCount > 0 && items.length === 0 && (
            <p>아래 접수 내역에서 미접수 파일을 확인하고 답안지 번호 순서대로 다시 선택해 주세요.</p>
          )}
          {ledgerBatch.duplicate_ordinals.length > 0 && <p>동일 파일은 기존에 접수된 답안지를 사용합니다.</p>}
          <p>채점 진행과 검토가 필요한 답안은 작업박스에서 확인할 수 있습니다.</p>
          <OmrBatchLedger batch={ledgerBatch} fileNames={ledgerFileNames} inline />
        </section>
      )}
    </div>
  );
}

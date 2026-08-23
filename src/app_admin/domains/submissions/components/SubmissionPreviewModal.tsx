import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileImage, FileText } from "lucide-react";

import { getPresignedUrl } from "@admin/domains/storage/api/storage.api";
import type { PendingSubmissionRow } from "@admin/domains/submissions/api/adminPendingSubmissions";
import { Badge, Button, EmptyState, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";

type Props = {
  open: boolean;
  row: PendingSubmissionRow | null;
  onClose: () => void;
  onIdentify: () => void;
};

const SAFE_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function extensionFromFileName(fileName: string): string {
  const match = fileName.match(/\.([^.]+)$/);
  return match?.[1]?.toLowerCase() ?? "";
}

// Shared with the compact inbox row so list and preview use the same file label.
// eslint-disable-next-line react-refresh/only-export-components
export function submissionFileName(fileKey: string | null | undefined): string {
  if (!fileKey) return "제출 파일";
  const rawName = fileKey.split(/[\\/]/).pop() || "제출 파일";
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function submissionFileKind(
  fileType: string | null | undefined,
  fileKey: string | null | undefined,
): string {
  const normalized = fileType?.toLowerCase().split(";")[0]?.trim() ?? "";
  const extension = extensionFromFileName(submissionFileName(fileKey));
  if (normalized === "application/pdf" || extension === "pdf") return "PDF";
  if (normalized === "image/jpeg" || extension === "jpg" || extension === "jpeg") return "JPG";
  if (normalized === "image/png" || extension === "png") return "PNG";
  if (normalized === "image/webp" || extension === "webp") return "WEBP";
  if (normalized === "image/gif" || extension === "gif") return "GIF";
  if (extension && extension.length <= 8) return extension.toUpperCase();
  return "파일";
}

// eslint-disable-next-line react-refresh/only-export-components
export function submissionFileSize(fileSize: number | null | undefined): string {
  if (fileSize == null || !Number.isFinite(fileSize) || fileSize < 0) return "크기 정보 없음";
  if (fileSize < 1024) return `${Math.round(fileSize)} B`;
  if (fileSize < 1024 ** 2) return `${(fileSize / 1024).toFixed(1)} KB`;
  if (fileSize < 1024 ** 3) return `${(fileSize / 1024 ** 2).toFixed(1)} MB`;
  return `${(fileSize / 1024 ** 3).toFixed(1)} GB`;
}

function previewKind(row: PendingSubmissionRow): "image" | "pdf" | "unsupported" {
  const normalized = row.file_type?.toLowerCase().split(";")[0]?.trim() ?? "";
  const extension = extensionFromFileName(submissionFileName(row.file_key));
  if (SAFE_IMAGE_TYPES.has(normalized) || ["gif", "jpg", "jpeg", "png", "webp"].includes(extension)) {
    return "image";
  }
  if (normalized === "application/pdf" || extension === "pdf") return "pdf";
  return "unsupported";
}

export default function SubmissionPreviewModal({ open, row, onClose, onIdentify }: Props) {
  const fileKey = row?.file_key ?? null;
  const previewQ = useQuery({
    queryKey: ["submission-file-preview", row?.id, fileKey],
    queryFn: () => getPresignedUrl(String(fileKey), 900),
    enabled: open && !!fileKey,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });

  if (!row) return null;

  const fileName = submissionFileName(fileKey);
  const fileKind = submissionFileKind(row.file_type, fileKey);
  const kind = previewKind(row);
  const canIdentify =
    row.status === "needs_identification" && row.target_resolved && !!row.target_id;
  const previewUrl = previewQ.data?.url;

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      type="inspect"
      width="min(1120px, calc(100vw - 24px))"
      noMinimize
      className="submission-preview-modal"
    >
      <ModalHeader
        type="inspect"
        title="제출물 확인"
        description="학생을 지정하기 전에 실제 제출 파일을 먼저 확인하세요."
      />
      <ModalBody>
        <div
          className="grid max-h-[calc(100vh-220px)] min-h-[360px] grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_280px]"
          data-testid="submission-preview-content"
        >
          <section
            className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-page)] lg:min-h-[520px]"
            aria-label="제출 파일 미리보기"
          >
            {!fileKey && (
              <EmptyState
                scope="panel"
                tone="empty"
                title="연결된 제출 파일이 없습니다."
                description="파일 정보 없이 접수된 제출입니다. 학생과 시험 정보를 다시 확인해 주세요."
              />
            )}
            {fileKey && previewQ.isLoading && (
              <EmptyState scope="panel" tone="loading" title="제출 파일을 여는 중..." />
            )}
            {fileKey && previewQ.isError && !previewQ.isLoading && (
              <EmptyState
                scope="panel"
                tone="error"
                title="제출 파일을 불러올 수 없습니다."
                description="잠시 후 다시 시도해 주세요. 학생 지정은 파일을 확인한 뒤 진행하세요."
                actions={
                  <Button type="button" intent="secondary" size="sm" onClick={() => void previewQ.refetch()}>
                    다시 시도
                  </Button>
                }
              />
            )}
            {previewUrl && !previewQ.isLoading && !previewQ.isError && kind === "image" && (
              <img
                src={previewUrl}
                alt={`${fileName} 제출물`}
                className="max-h-[60vh] max-w-full object-contain"
              />
            )}
            {previewUrl && !previewQ.isLoading && !previewQ.isError && kind === "pdf" && (
              <iframe
                src={previewUrl}
                title={`${fileName} 제출물`}
                className="h-[60vh] min-h-[420px] w-full bg-white"
              />
            )}
            {previewUrl && !previewQ.isLoading && !previewQ.isError && kind === "unsupported" && (
              <EmptyState
                scope="panel"
                tone="empty"
                title="이 형식은 화면에서 바로 볼 수 없습니다."
                description="오른쪽의 원본 열기를 눌러 파일을 확인한 뒤 학생을 지정하세요."
              />
            )}
          </section>

          <aside className="flex min-w-0 flex-col gap-4 rounded-xl border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[var(--color-text-muted)]">제출 파일</span>
              <Badge tone={kind === "unsupported" ? "neutral" : "primary"}>{fileKind}</Badge>
            </div>

            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-surface-soft)] text-[var(--color-primary)]">
                {kind === "image" ? <FileImage size={ICON.md} /> : <FileText size={ICON.md} />}
              </div>
              <div className="min-w-0">
                <p className="break-all text-sm font-bold text-[var(--color-text-primary)]" title={fileName}>
                  {fileName}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {submissionFileSize(row.file_size)}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-[70px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-[var(--color-border-divider)] pt-4 text-xs">
              <dt className="text-[var(--color-text-muted)]">대상</dt>
              <dd className="min-w-0 break-words font-medium text-[var(--color-text-primary)]">
                {row.target_title || "대상 정보 없음"}
              </dd>
              <dt className="text-[var(--color-text-muted)]">접수 시각</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">
                {new Intl.DateTimeFormat("ko-KR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(row.created_at))}
              </dd>
            </dl>

            <p className="rounded-lg bg-[var(--color-bg-surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--color-text-muted)]">
              파일은 확인용으로만 열리며 이 화면에서 원본이 변경되지는 않습니다.
            </p>

            {previewUrl && (
              <Button
                type="button"
                intent="secondary"
                size="sm"
                leftIcon={<ExternalLink size={ICON_FOR_BUTTON.sm} />}
                onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
              >
                새 창에서 원본 열기
              </Button>
            )}
          </aside>
        </div>
      </ModalBody>
      <ModalFooter
        left={
          canIdentify ? (
            <span className="text-xs text-[var(--color-text-muted)]">
              파일과 시험을 확인했다면 학생을 선택할 수 있습니다.
            </span>
          ) : undefined
        }
        right={
          <>
            <Button type="button" intent="ghost" onClick={onClose}>
              닫기
            </Button>
            {canIdentify && (
              <Button
                type="button"
                intent="primary"
                disabled={!!fileKey && (previewQ.isLoading || previewQ.isError)}
                onClick={onIdentify}
              >
                확인하고 학생 지정
              </Button>
            )}
          </>
        }
      />
    </AdminModal>
  );
}

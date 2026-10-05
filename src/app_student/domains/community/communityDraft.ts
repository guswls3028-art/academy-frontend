import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";

export type PendingCommunityUpload = {
  postId: number;
  requestKey: string;
  attachments: DraftAttachmentMeta[];
  canReplace?: boolean;
};

function isPendingCommunityUpload(value: unknown): value is PendingCommunityUpload {
  if (!value || typeof value !== "object") return false;
  const pending = value as Record<string, unknown>;
  return typeof pending.postId === "number" && Number.isSafeInteger(pending.postId) && pending.postId > 0
    && typeof pending.requestKey === "string" && /^[a-zA-Z0-9._-]{1,128}$/.test(pending.requestKey)
    && (pending.canReplace == null || typeof pending.canReplace === "boolean")
    && Array.isArray(pending.attachments) && pending.attachments.length > 0 && pending.attachments.length <= 10
    && pending.attachments.every(isDraftAttachmentMeta);
}

export function matchesPendingAttachments(files: File[], pending: PendingCommunityUpload): boolean {
  const selected = toDraftAttachmentMeta(files);
  return selected.length === pending.attachments.length && selected.every((file, index) => {
    const expected = pending.attachments[index];
    return file.name === expected.name && file.size === expected.size && file.type === expected.type;
  });
}

export type StudentCommunityDraftData = {
  title: string;
  content: string;
  categoryLabel: string;
  hadAttachments?: boolean;
  attachments?: DraftAttachmentMeta[];
  pendingUpload?: PendingCommunityUpload | null;
};

export type DraftAttachmentMeta = {
  name: string;
  size: number;
  type: string;
};

function isDraftAttachmentMeta(value: unknown): value is DraftAttachmentMeta {
  if (!value || typeof value !== "object") return false;
  const attachment = value as Record<string, unknown>;
  return typeof attachment.name === "string"
    && attachment.name.length <= 120
    && typeof attachment.size === "number"
    && Number.isFinite(attachment.size)
    && attachment.size >= 0
    && typeof attachment.type === "string"
    && attachment.type.length <= 100;
}

export function toDraftAttachmentMeta(files: File[]): DraftAttachmentMeta[] {
  return files.slice(0, 10).map((file) => ({
    name: file.name.trim().slice(0, 120),
    size: Math.max(0, Math.round(file.size)),
    type: file.type.trim().slice(0, 100),
  }));
}

export function isStudentCommunityDraftData(value: unknown): value is StudentCommunityDraftData {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.title === "string"
    && typeof draft.content === "string"
    && typeof draft.categoryLabel === "string"
    && (draft.pendingUpload == null || isPendingCommunityUpload(draft.pendingUpload))
    && (draft.hadAttachments == null || typeof draft.hadAttachments === "boolean")
    && (draft.attachments == null || (
      Array.isArray(draft.attachments)
      && draft.attachments.length <= 10
      && draft.attachments.every(isDraftAttachmentMeta)
    ));
}

export function isStudentCommunityDraftEmpty(value: StudentCommunityDraftData): boolean {
  return !value.title.trim()
    && !richHtmlToPlainText(value.content).trim()
    && !value.categoryLabel.trim()
    && !value.hadAttachments
    && !(value.attachments?.length)
    && !value.pendingUpload;
}

export function communityDraftStorageKey(kind: "qna" | "counsel", userId: number | undefined, parent: boolean, childId: number | null): string | null {
  const childScope = parent ? `:student-${childId ?? "unselected"}` : "";
  return getTenantUserLocalKey(`student-community-draft:${kind}${childScope}`, userId);
}


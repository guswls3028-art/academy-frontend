/* eslint-disable no-restricted-syntax */
// PATH: src/app_admin/domains/developer/pages/DeveloperPage.tsx
// To개발자 — 패치노트 / 버그 제보 / 피드백 페이지 (각 탭 = 별도 라우트)

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bug, MessageSquare, ImagePlus, Send, Trash2, Paperclip, X, Zap, Wrench, Shield, ArrowUpCircle } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import { createClientRequestKey } from "@/shared/api/contracts/community";
import {
  uploadPostAttachments,
} from "@admin/domains/community/api/community.api";
import {
  createSupportTicket,
  listSupportTickets,
  supportText,
  type SupportTicket,
} from "@/shared/api/contracts/supportTickets";
import { adminDeveloperQueryKeys } from "../queryKeys";
import styles from "./DeveloperPage.module.css";
import { PATCH_NOTES, type PatchNote, type NoteCategory } from "./patchNotesData";

// ═══════════════════ 패치노트 페이지 (기본) ═══════════════════

const CATEGORY_META: Record<NoteCategory, { label: string; icon: typeof Zap }> = {
  new:      { label: "NEW",      icon: Zap },
  fix:      { label: "FIX",      icon: Wrench },
  improve:  { label: "IMPROVE",  icon: ArrowUpCircle },
  security: { label: "SECURITY", icon: Shield },
};

export default function PatchNotesPage() {
  const [selected, setSelected] = useState<PatchNote | null>(null);

  return (
    <>
      <div className={styles.pnTimeline}>
        {PATCH_NOTES.map((note, i) => {
          const counts = { new: 0, fix: 0, improve: 0, security: 0 };
          note.entries.forEach((e) => counts[e.category]++);
          const isLatest = i === 0;

          return (
            <button
              key={note.version}
              type="button"
              className={styles.pnCard + (isLatest ? " " + styles.pnCardLatest : "")}
              onClick={() => setSelected(note)}
            >
              <div className={styles.pnCardHead}>
                <span className={styles.pnCardVersion}>{note.version}</span>
                {isLatest && <span className={styles.pnCardNew}>LATEST</span>}
                <span className={styles.pnCardDate}>{note.date}</span>
              </div>
              <div className={styles.pnCardCodename}>{note.codename}</div>
              <p className={styles.pnCardSummary}>{note.summary}</p>
              <div className={styles.pnCardTags}>
                {counts.new > 0 && <span className={styles.pnTag} data-cat="new">+{counts.new} NEW</span>}
                {counts.fix > 0 && <span className={styles.pnTag} data-cat="fix">{counts.fix} FIX</span>}
                {counts.improve > 0 && <span className={styles.pnTag} data-cat="improve">{counts.improve} IMPROVE</span>}
                {counts.security > 0 && <span className={styles.pnTag} data-cat="security">{counts.security} SECURITY</span>}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <PatchNoteModal note={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function PatchNoteModal({ note, onClose }: { note: PatchNote; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  const grouped: Record<NoteCategory, string[]> = { new: [], fix: [], improve: [], security: [] };
  note.entries.forEach((e) => grouped[e.category].push(e.text));

  const order: NoteCategory[] = ["new", "improve", "fix", "security"];
  const total = note.entries.length;

  return (
    <div className={styles.pnOverlay} data-testid="pn-overlay" onClick={onClose}>
      <div className={styles.pnModal} data-testid="pn-modal" onClick={(e) => e.stopPropagation()}>
        <div className={styles.pnModalHeader}>
          <div className={styles.pnModalHeaderLeft}>
            <span className={styles.pnModalVersion}>{note.version}</span>
            <span className={styles.pnModalCodename}>&ldquo;{note.codename}&rdquo;</span>
          </div>
          <div className={styles.pnModalHeaderRight}>
            <span className={styles.pnModalDate}>{note.date}</span>
            <button type="button" className={styles.pnModalClose} onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className={styles.pnModalSummary}>
          <p className={styles.pnModalSummaryText}>{note.summary}</p>
          <div className={styles.pnModalStats}>
            <span className={styles.pnModalStatsTotal}>{total}건 변경</span>
            {grouped.new.length > 0 && <span className={styles.pnTag} data-cat="new">+{grouped.new.length} NEW</span>}
            {grouped.improve.length > 0 && <span className={styles.pnTag} data-cat="improve">{grouped.improve.length} IMPROVE</span>}
            {grouped.fix.length > 0 && <span className={styles.pnTag} data-cat="fix">{grouped.fix.length} FIX</span>}
            {grouped.security.length > 0 && <span className={styles.pnTag} data-cat="security">{grouped.security.length} SECURITY</span>}
          </div>
        </div>

        <div className={styles.pnModalBody}>
          {order.map((cat) => {
            const items = grouped[cat];
            if (items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            return (
              <div key={cat} className={styles.pnSection} data-cat={cat}>
                <div className={styles.pnSectionHead}>
                  <Icon size={13} />
                  <span>{meta.label}</span>
                  <span className={styles.pnSectionCount}>{items.length}</span>
                </div>
                <ul className={styles.pnSectionList}>
                  {items.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════ 버그 제보 페이지 ═══════════════════

export function BugReportPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [pendingAttachmentTicketId, setPendingAttachmentTicketId] = useState<number | null>(null);
  const [pendingAttachmentUploadKey, setPendingAttachmentUploadKey] = useState<string | null>(null);
  const ticketRequestKeyRef = useRef(createClientRequestKey());
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bugPostsQueryKey = adminDeveloperQueryKeys.posts("bug_report");

  const postsQuery = useQuery({
    queryKey: bugPostsQueryKey,
    queryFn: () => listSupportTickets(api, "bug"),
  });

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addImage(file);
        break;
      }
    }
  }, []);

  const addImage = (file: File) => {
    setImages((prev) => [...prev, file]);
    const url = URL.createObjectURL(file);
    setPreviews((prev) => [...prev, url]);
  };

  const removeImage = (idx: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.type.startsWith("image/")) addImage(f);
    }
    e.target.value = "";
  };

  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  useEffect(() => {
    return () => previewsRef.current.forEach(URL.revokeObjectURL);
  }, []);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("제목을 입력해주세요.");
      const attachmentUploadKey = images.length > 0 ? createClientRequestKey() : null;
      const post = await createSupportTicket(api, {
        type: "bug",
        subject: title.trim(),
        content: content.trim(),
        idempotency_key: ticketRequestKeyRef.current,
      });
      let attachmentFailed = false;
      if (images.length > 0 && attachmentUploadKey) {
        try {
          await uploadPostAttachments(post.id, images, attachmentUploadKey);
        } catch {
          attachmentFailed = true;
        }
      }
      return { post, attachmentFailed, attachmentUploadKey };
    },
    onSuccess: ({ post, attachmentFailed, attachmentUploadKey }) => {
      ticketRequestKeyRef.current = createClientRequestKey();
      setTitle("");
      setContent("");
      qc.invalidateQueries({ queryKey: bugPostsQueryKey });
      if (attachmentFailed) {
        setPendingAttachmentTicketId(post.id);
        setPendingAttachmentUploadKey(attachmentUploadKey);
        feedback.warning("제보는 등록됐지만 첨부 업로드가 실패했습니다. 아래에서 첨부만 다시 시도해 주세요.");
        return;
      }
      feedback.success("버그 제보가 등록되었습니다.");
      previews.forEach(URL.revokeObjectURL);
      setImages([]);
      setPreviews([]);
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  const retryAttachmentMut = useMutation({
    mutationFn: async () => {
      if (
        pendingAttachmentTicketId == null
        || pendingAttachmentUploadKey == null
        || images.length === 0
      ) return;
      await uploadPostAttachments(
        pendingAttachmentTicketId,
        images,
        pendingAttachmentUploadKey,
      );
    },
    onSuccess: () => {
      feedback.success("첨부파일을 등록했습니다.");
      previews.forEach(URL.revokeObjectURL);
      setImages([]);
      setPreviews([]);
      setPendingAttachmentTicketId(null);
      setPendingAttachmentUploadKey(null);
      qc.invalidateQueries({ queryKey: bugPostsQueryKey });
    },
    onError: () => feedback.error("첨부 업로드에 다시 실패했습니다."),
  });

  return (
    <div className={styles.panel}>
      <div className={styles.guide}>
        <Bug size={18} className={styles.guideIcon} />
        <div>
          <p className={styles.guideTitle}>버그 발견 시 스크린샷을 첨부해주세요</p>
          <p className={styles.guideDesc}>
            화면 캡처를 입력란에 끌어놓거나 <kbd>Ctrl</kbd>+<kbd>V</kbd>로 붙여넣으면 함께 전송됩니다.
            <br />
            <span style={{ opacity: 0.7, fontSize: "0.92em" }}>
              화면 캡처는 <kbd>PrtSc</kbd>(Windows) 또는 <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>4</kbd>(Mac).
            </span>
          </p>
        </div>
      </div>

      <div className={styles.form}>
        <input
          type="text"
          className={styles.titleInput}
          placeholder="버그 제목 (어떤 문제인지 간략히)"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            ticketRequestKeyRef.current = createClientRequestKey();
          }}
        />
        <div className={styles.contentWrap}>
          <textarea
            ref={contentRef}
            className={styles.contentInput}
            placeholder="버그 상세 내용을 입력하세요. Ctrl+V로 스크린샷 붙여넣기 가능"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              ticketRequestKeyRef.current = createClientRequestKey();
            }}
            onPaste={handlePaste}
            rows={5}
          />
          {previews.length > 0 && (
            <div className={styles.imageGrid}>
              {previews.map((src, i) => (
                <div key={i} className={styles.imageThumb}>
                  <img src={src} alt={`첨부 ${i + 1}`} />
                  <button
                    type="button"
                    className={styles.imageRemove}
                    onClick={() => removeImage(i)}
                    aria-label={`첨부 이미지 ${i + 1} 제거`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.formActions}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFileSelect}
          />
          <button type="button" className={styles.attachBtn} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={16} />
            이미지 첨부
          </button>
          <Button
            intent="primary"
            size="sm"
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending || pendingAttachmentTicketId != null || !title.trim()}
            leftIcon={<Send size={14} />}
          >
            {submitMut.isPending ? "등록 중..." : "제보하기"}
          </Button>
          {pendingAttachmentTicketId != null && (
            <Button
              intent="primary"
              size="sm"
              onClick={() => retryAttachmentMut.mutate()}
              disabled={retryAttachmentMut.isPending || images.length === 0}
              leftIcon={<Paperclip size={14} />}
            >
              {retryAttachmentMut.isPending ? "첨부 재시도 중..." : "첨부만 다시 올리기"}
            </Button>
          )}
        </div>
      </div>

      <PostList
        posts={postsQuery.data?.results ?? []}
        emptyText="아직 제보한 버그가 없습니다."
        toneBadge="bug"
        isLoading={postsQuery.isLoading}
        isError={postsQuery.isError}
        onRetry={() => postsQuery.refetch()}
      />
    </div>
  );
}

// ═══════════════════ 피드백 페이지 ═══════════════════

export function FeedbackPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pendingAttachmentTicketId, setPendingAttachmentTicketId] = useState<number | null>(null);
  const [pendingAttachmentUploadKey, setPendingAttachmentUploadKey] = useState<string | null>(null);
  const ticketRequestKeyRef = useRef(createClientRequestKey());
  const fileRef = useRef<HTMLInputElement>(null);
  const feedbackPostsQueryKey = adminDeveloperQueryKeys.posts("dev_feedback");

  const postsQuery = useQuery({
    queryKey: feedbackPostsQueryKey,
    queryFn: () => listSupportTickets(api, "feedback"),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files;
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("제목을 입력해주세요.");
      const attachmentUploadKey = files.length > 0 ? createClientRequestKey() : null;
      const post = await createSupportTicket(api, {
        type: "feedback",
        subject: title.trim(),
        content: content.trim(),
        idempotency_key: ticketRequestKeyRef.current,
      });
      let attachmentFailed = false;
      if (files.length > 0 && attachmentUploadKey) {
        try {
          await uploadPostAttachments(post.id, files, attachmentUploadKey);
        } catch {
          attachmentFailed = true;
        }
      }
      return { post, attachmentFailed, attachmentUploadKey };
    },
    onSuccess: ({ post, attachmentFailed, attachmentUploadKey }) => {
      ticketRequestKeyRef.current = createClientRequestKey();
      setTitle("");
      setContent("");
      qc.invalidateQueries({ queryKey: feedbackPostsQueryKey });
      if (attachmentFailed) {
        setPendingAttachmentTicketId(post.id);
        setPendingAttachmentUploadKey(attachmentUploadKey);
        feedback.warning("피드백은 등록됐지만 첨부 업로드가 실패했습니다. 아래에서 첨부만 다시 시도해 주세요.");
        return;
      }
      feedback.success("피드백이 등록되었습니다.");
      setFiles([]);
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  const retryAttachmentMut = useMutation({
    mutationFn: async () => {
      if (
        pendingAttachmentTicketId == null
        || pendingAttachmentUploadKey == null
        || files.length === 0
      ) return;
      await uploadPostAttachments(
        pendingAttachmentTicketId,
        files,
        pendingAttachmentUploadKey,
      );
    },
    onSuccess: () => {
      feedback.success("첨부파일을 등록했습니다.");
      setFiles([]);
      setPendingAttachmentTicketId(null);
      setPendingAttachmentUploadKey(null);
      qc.invalidateQueries({ queryKey: feedbackPostsQueryKey });
    },
    onError: () => feedback.error("첨부 업로드에 다시 실패했습니다."),
  });

  return (
    <div className={styles.panel}>
      <div className={styles.guide}>
        <MessageSquare size={18} className={styles.guideIcon} />
        <div>
          <p className={styles.guideTitle}>서비스 개선 의견을 보내주세요</p>
          <p className={styles.guideDesc}>
            기능 요청, 개선 사항, 사용 중 불편했던 점 등 자유롭게 작성해주세요.
          </p>
        </div>
      </div>

      <div className={styles.form}>
        <input
          type="text"
          className={styles.titleInput}
          placeholder="피드백 제목"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            ticketRequestKeyRef.current = createClientRequestKey();
          }}
        />
        <textarea
          className={styles.contentInput}
          placeholder="상세 내용을 입력하세요"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            ticketRequestKeyRef.current = createClientRequestKey();
          }}
          rows={5}
        />
        {files.length > 0 && (
          <div className={styles.fileList}>
            {files.map((f, i) => (
              <div key={i} className={styles.fileItem}>
                <Paperclip size={14} />
                <span className={styles.fileName}>{f.name}</span>
                <button
                  type="button"
                  className={styles.fileRemoveBtn}
                  onClick={() => removeFile(i)}
                  aria-label={`${f.name} 첨부 제거`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.formActions}>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={handleFileSelect}
          />
          <button type="button" className={styles.attachBtn} onClick={() => fileRef.current?.click()}>
            <Paperclip size={16} />
            파일 첨부
          </button>
          <Button
            intent="primary"
            size="sm"
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending || pendingAttachmentTicketId != null || !title.trim()}
            leftIcon={<Send size={14} />}
          >
            {submitMut.isPending ? "등록 중..." : "보내기"}
          </Button>
          {pendingAttachmentTicketId != null && (
            <Button
              intent="primary"
              size="sm"
              onClick={() => retryAttachmentMut.mutate()}
              disabled={retryAttachmentMut.isPending || files.length === 0}
              leftIcon={<Paperclip size={14} />}
            >
              {retryAttachmentMut.isPending ? "첨부 재시도 중..." : "첨부만 다시 올리기"}
            </Button>
          )}
        </div>
      </div>

      <PostList
        posts={postsQuery.data?.results ?? []}
        emptyText="아직 보낸 피드백이 없습니다."
        toneBadge="feedback"
        isLoading={postsQuery.isLoading}
        isError={postsQuery.isError}
        onRetry={() => postsQuery.refetch()}
      />
    </div>
  );
}

// ═══════════════════ 공통: 게시물 목록 ═══════════════════

function PostList({
  posts,
  emptyText,
  toneBadge,
  isLoading,
  isError,
  onRetry,
}: {
  posts: SupportTicket[];
  emptyText: string;
  toneBadge: "bug" | "feedback";
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return <div className={styles.empty}>문의 내역을 불러오는 중입니다.</div>;
  }
  if (isError) {
    return (
      <div className={styles.empty}>
        <p>문의 내역을 불러오지 못했습니다.</p>
        <button type="button" className={styles.retryButton} onClick={onRetry}>다시 시도</button>
      </div>
    );
  }
  if (posts.length === 0) {
    return <div className={styles.empty}>{emptyText}</div>;
  }
  return (
    <div className={styles.postList}>
      <h3 className={styles.listTitle}>우리 학원 {toneBadge === "bug" ? "제보" : "피드백"} 내역</h3>
      {posts.map((p) => (
        <div key={p.id} className={styles.postCard}>
          <div className={styles.postHeader}>
            <span className={styles.postBadge} data-tone={toneBadge}>
              {toneBadge === "bug" ? "버그" : "피드백"}
            </span>
            <span className={styles.postTitle}>{p.subject}</span>
            <span className={styles.postDate}>
              {new Date(p.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
          {p.content && <p className={styles.postContent}>{supportText(p.content)}</p>}
          {(p.attachments?.length ?? 0) > 0 && (
            <div className={styles.postAttachments}>
              <Paperclip size={12} />
              <span>첨부 {p.attachments!.length}개</span>
            </div>
          )}
          {p.replies.filter((reply) => reply.is_platform_reply).map((reply) => (
            <div className={styles.postReply} key={reply.id}>
              <MessageSquare size={12} />
              <div>
                <strong>개발팀 답변</strong>
                <span>{supportText(reply.content)}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// PATH: src/app_admin/domains/developer/pages/DeveloperPage.tsx
// To개발자 — 패치노트 / 버그 제보 / 피드백 페이지 (각 탭 = 별도 라우트)

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bug, MessageSquare, ImagePlus, Send, Trash2, Paperclip, X, Zap, Wrench, Shield, ArrowUpCircle } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  createPost,
  uploadPostAttachments,
  fetchAdminPosts,
  deletePost,
  type PostEntity,
} from "@admin/domains/community/api/community.api";
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
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: posts } = useQuery({
    queryKey: ["dev-posts", "bug_report"],
    queryFn: async () => {
      const { results } = await fetchAdminPosts({ postType: "board", pageSize: 200 });
      return { results: results.filter((p) => p.title?.startsWith("[BUG]")), count: 0 };
    },
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
      const post = await createPost({
        post_type: "board",
        title: `[BUG] ${title.trim()}`,
        content: content.trim(),
        node_ids: [],
      });
      if (images.length > 0) {
        await uploadPostAttachments(post.id, images);
      }
      return post;
    },
    onSuccess: () => {
      feedback.success("버그 제보가 등록되었습니다.");
      setTitle("");
      setContent("");
      previews.forEach(URL.revokeObjectURL);
      setImages([]);
      setPreviews([]);
      qc.invalidateQueries({ queryKey: ["dev-posts", "bug_report"] });
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (postId: number) => deletePost(postId),
    onSuccess: () => {
      feedback.success("삭제되었습니다.");
      qc.invalidateQueries({ queryKey: ["dev-posts", "bug_report"] });
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  return (
    <div className={styles.panel}>
      <div className={styles.guide}>
        <Bug size={18} className={styles.guideIcon} />
        <div>
          <p className={styles.guideTitle}>버그 발견 시 스크린샷을 첨부해주세요</p>
          <p className={styles.guideDesc}>
            <kbd>F12</kbd> 키로 개발자 도구를 연 상태에서 <kbd>PrtSc</kbd> 키로 화면을 캡처한 뒤,
            아래 입력란에서 <kbd>Ctrl</kbd>+<kbd>V</kbd>로 이미지를 붙여넣을 수 있습니다.
          </p>
        </div>
      </div>

      <div className={styles.form}>
        <input
          type="text"
          className={styles.titleInput}
          placeholder="버그 제목 (어떤 문제인지 간략히)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className={styles.contentWrap}>
          <textarea
            ref={contentRef}
            className={styles.contentInput}
            placeholder="버그 상세 내용을 입력하세요. Ctrl+V로 스크린샷 붙여넣기 가능"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            rows={5}
          />
          {previews.length > 0 && (
            <div className={styles.imageGrid}>
              {previews.map((src, i) => (
                <div key={i} className={styles.imageThumb}>
                  <img src={src} alt={`첨부 ${i + 1}`} />
                  <button type="button" className={styles.imageRemove} onClick={() => removeImage(i)}>
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
            disabled={submitMut.isPending || !title.trim()}
          >
            <Send size={14} style={{ marginRight: 4 }} />
            {submitMut.isPending ? "등록 중..." : "제보하기"}
          </Button>
        </div>
      </div>

      <PostList
        posts={posts?.results ?? []}
        emptyText="아직 제보한 버그가 없습니다."
        onDelete={(id) => deleteMut.mutate(id)}
        toneBadge="bug"
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
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: posts } = useQuery({
    queryKey: ["dev-posts", "dev_feedback"],
    queryFn: async () => {
      const { results } = await fetchAdminPosts({ postType: "board", pageSize: 200 });
      return { results: results.filter((p) => p.title?.startsWith("[FB]")), count: 0 };
    },
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
      const post = await createPost({
        post_type: "board",
        title: `[FB] ${title.trim()}`,
        content: content.trim(),
        node_ids: [],
      });
      if (files.length > 0) {
        await uploadPostAttachments(post.id, files);
      }
      return post;
    },
    onSuccess: () => {
      feedback.success("피드백이 등록되었습니다.");
      setTitle("");
      setContent("");
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["dev-posts", "dev_feedback"] });
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (postId: number) => deletePost(postId),
    onSuccess: () => {
      feedback.success("삭제되었습니다.");
      qc.invalidateQueries({ queryKey: ["dev-posts", "dev_feedback"] });
    },
    onError: (e: Error) => feedback.error(e.message),
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
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={styles.contentInput}
          placeholder="상세 내용을 입력하세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
        />
        {files.length > 0 && (
          <div className={styles.fileList}>
            {files.map((f, i) => (
              <div key={i} className={styles.fileItem}>
                <Paperclip size={14} />
                <span className={styles.fileName}>{f.name}</span>
                <button type="button" className={styles.fileRemoveBtn} onClick={() => removeFile(i)}>
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
            disabled={submitMut.isPending || !title.trim()}
          >
            <Send size={14} style={{ marginRight: 4 }} />
            {submitMut.isPending ? "등록 중..." : "보내기"}
          </Button>
        </div>
      </div>

      <PostList
        posts={posts?.results ?? []}
        emptyText="아직 보낸 피드백이 없습니다."
        onDelete={(id) => deleteMut.mutate(id)}
        toneBadge="feedback"
      />
    </div>
  );
}

// ═══════════════════ 공통: 게시물 목록 ═══════════════════

function PostList({
  posts,
  emptyText,
  onDelete,
  toneBadge,
}: {
  posts: PostEntity[];
  emptyText: string;
  onDelete: (id: number) => void;
  toneBadge: "bug" | "feedback";
}) {
  if (posts.length === 0) {
    return <div className={styles.empty}>{emptyText}</div>;
  }
  return (
    <div className={styles.postList}>
      <h3 className={styles.listTitle}>내 {toneBadge === "bug" ? "제보" : "피드백"} 내역</h3>
      {posts.map((p) => (
        <div key={p.id} className={styles.postCard}>
          <div className={styles.postHeader}>
            <span className={styles.postBadge} data-tone={toneBadge}>
              {toneBadge === "bug" ? "버그" : "피드백"}
            </span>
            <span className={styles.postTitle}>{p.title}</span>
            <span className={styles.postDate}>
              {new Date(p.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
          {p.content && <p className={styles.postContent}>{p.content}</p>}
          {(p.attachments?.length ?? 0) > 0 && (
            <div className={styles.postAttachments}>
              <Paperclip size={12} />
              <span>첨부 {p.attachments!.length}개</span>
            </div>
          )}
          {(p.replies_count ?? 0) > 0 && (
            <div className={styles.postReply}>
              <MessageSquare size={12} />
              <span>개발자 응답 {p.replies_count}건</span>
            </div>
          )}
          <button
            type="button"
            className={styles.postDeleteBtn}
            onClick={() => onDelete(p.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* eslint-disable no-restricted-syntax */
// PATH: src/app_admin/domains/developer/pages/DeveloperPage.tsx
// To개발자 — 패치노트 / 버그 제보 / 피드백 페이지 (각 탭 = 별도 라우트)

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpCircle,
  BookOpenText,
  Bug,
  CheckCircle2,
  ChevronRight,
  ImagePlus,
  MessageSquare,
  Paperclip,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  createPost,
  uploadPostAttachments,
  fetchAdminPosts,
  deletePost,
  type PostEntity,
} from "@admin/domains/community/api/community.api";
import { adminDeveloperQueryKeys } from "../queryKeys";
import styles from "./DeveloperPage.module.css";
import { PATCH_NOTES, type PatchNote, type NoteCategory } from "./patchNotesData";

// ═══════════════════ 패치노트 페이지 (기본) ═══════════════════

const CATEGORY_META: Record<NoteCategory, { label: string; shortLabel: string; icon: typeof Sparkles }> = {
  new: { label: "새 기능", shortLabel: "신규", icon: Sparkles },
  improve: { label: "사용성 개선", shortLabel: "개선", icon: ArrowUpCircle },
  fix: { label: "오류 수정", shortLabel: "수정", icon: Wrench },
  security: { label: "보안·안정성", shortLabel: "안정성", icon: Shield },
};

const CATEGORY_ORDER: NoteCategory[] = ["new", "improve", "fix", "security"];

function getCategoryCounts(note: PatchNote): Record<NoteCategory, number> {
  const counts: Record<NoteCategory, number> = { new: 0, fix: 0, improve: 0, security: 0 };
  note.entries.forEach((entry) => counts[entry.category]++);
  return counts;
}

export default function PatchNotesPage() {
  const [selected, setSelected] = useState<PatchNote | null>(null);
  const latest = PATCH_NOTES[0];

  return (
    <section className={styles.releasePage} aria-labelledby="release-ledger-title" data-testid="patch-notes-page">
      <header className={styles.releaseIntro}>
        <div className={styles.releaseIntroCopy}>
          <div className={styles.releaseEyebrow}>
            <BookOpenText size={15} aria-hidden="true" />
            운영 릴리스 장부
          </div>
          <h2 id="release-ledger-title">운영에 반영된 변경만 기록합니다.</h2>
          <p>
            봉인된 릴리스 문서와 배포 검증 결과를 기준으로, 실제 사용에 영향을 주는 내용을 간결하게 정리했습니다.
          </p>
        </div>
        <dl className={styles.releaseProof} aria-label="현재 릴리스 기준">
          <div>
            <dt>현재 기준</dt>
            <dd>{latest.version}</dd>
          </div>
          <div>
            <dt>운영 반영일</dt>
            <dd>{latest.date}</dd>
          </div>
          <div className={styles.releaseProofStatus}>
            <dt>상태</dt>
            <dd><CheckCircle2 size={14} aria-hidden="true" /> 운영 반영</dd>
          </div>
        </dl>
      </header>

      <div className={styles.releaseSectionHead}>
        <div>
          <h3>최근 운영 릴리스</h3>
          <p>최신순 · {PATCH_NOTES.length}건</p>
        </div>
        <span>카드를 선택하면 상세 변경을 확인할 수 있습니다.</span>
      </div>

      <div className={styles.releaseLedger}>
        {PATCH_NOTES.map((note, i) => {
          const counts = getCategoryCounts(note);
          const isLatest = i === 0;

          return (
            <button
              key={note.version}
              type="button"
              className={`${styles.releaseCard} ${isLatest ? styles.releaseCardLatest : ""}`}
              onClick={() => setSelected(note)}
              aria-label={`${note.version} ${note.codename} 상세 보기`}
            >
              <div className={styles.releaseRail} aria-hidden="true">
                <span>{note.date}</span>
              </div>
              <div className={styles.releaseCardBody}>
                <div className={styles.releaseCardMeta}>
                  <span className={styles.releaseVersion}>{note.version}</span>
                  {isLatest && <span className={styles.releaseLatest}>최신</span>}
                  <span className={styles.releaseStatus}><CheckCircle2 size={12} aria-hidden="true" /> 운영 반영</span>
                </div>
                <h4>{note.codename}</h4>
                <p className={styles.releaseSummary}>{note.summary}</p>
                <div className={styles.releaseTags} aria-label="변경 분류">
                  {CATEGORY_ORDER.map((category) => counts[category] > 0 && (
                    <span key={category} className={styles.releaseTag} data-cat={category}>
                      {CATEGORY_META[category].shortLabel} {counts[category]}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight className={styles.releaseChevron} size={18} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {selected && (
        <PatchNoteModal note={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

function PatchNoteModal({ note, onClose }: { note: PatchNote; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handler);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handler);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const grouped: Record<NoteCategory, string[]> = { new: [], fix: [], improve: [], security: [] };
  note.entries.forEach((e) => grouped[e.category].push(e.text));

  const total = note.entries.length;

  return (
    <div className={styles.pnOverlay} data-testid="pn-overlay" onClick={onClose}>
      <div
        className={styles.pnModal}
        data-testid="pn-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-note-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.pnModalHeader}>
          <div className={styles.pnModalHeading}>
            <div className={styles.pnModalMeta}>
              <span className={styles.pnModalStatus}><CheckCircle2 size={13} aria-hidden="true" /> 운영 반영</span>
              <span className={styles.pnModalVersion}>{note.version}</span>
              <span className={styles.pnModalDate}>{note.date}</span>
            </div>
            <h2 id="patch-note-dialog-title">{note.codename}</h2>
            <p>{note.summary}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.pnModalClose}
            onClick={onClose}
            aria-label="릴리스 상세 닫기"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.pnModalBody}>
          <div className={styles.pnModalCount}>{total}개 변경 사항</div>
          {CATEGORY_ORDER.map((cat) => {
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
  const bugPostsQueryKey = adminDeveloperQueryKeys.posts("bug_report");

  const { data: posts } = useQuery({
    queryKey: bugPostsQueryKey,
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
      qc.invalidateQueries({ queryKey: bugPostsQueryKey });
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (postId: number) => deletePost(postId),
    onSuccess: () => {
      feedback.success("삭제되었습니다.");
      qc.invalidateQueries({ queryKey: bugPostsQueryKey });
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
            leftIcon={<Send size={14} />}
          >
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
  const feedbackPostsQueryKey = adminDeveloperQueryKeys.posts("dev_feedback");

  const { data: posts } = useQuery({
    queryKey: feedbackPostsQueryKey,
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
      qc.invalidateQueries({ queryKey: feedbackPostsQueryKey });
    },
    onError: (e: Error) => feedback.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (postId: number) => deletePost(postId),
    onSuccess: () => {
      feedback.success("삭제되었습니다.");
      qc.invalidateQueries({ queryKey: feedbackPostsQueryKey });
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
            leftIcon={<Send size={14} />}
          >
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

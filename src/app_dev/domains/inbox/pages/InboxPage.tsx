// PATH: src/dev_app/pages/InboxPage.tsx
// Platform inbox — 전체 테넌트 버그/피드백 수신함 + 답변

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInboxPosts, useCreateInboxReply, useDeleteInboxReply } from "@dev/domains/inbox/hooks/useInbox";
import { getInboxAttachmentUrl } from "@dev/domains/inbox/api/inbox.api";
import { useDevToast } from "@dev/shared/components/DevToast";
import type { InboxPost } from "@dev/domains/inbox/api/inbox.api";
import s from "@dev/layout/DevLayout.module.css";
import i from "./InboxPage.module.css";

type FilterType = "all" | "bug" | "feedback";

export default function InboxPage() {
  const { toast } = useDevToast();
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data, isLoading } = useInboxPosts(filter);
  const replyMut = useCreateInboxReply();
  const deleteMut = useDeleteInboxReply();

  const posts = useMemo(() => data?.results ?? [], [data]);
  const hasLoadedPosts = data != null;

  const selected: InboxPost | null = useMemo(
    () => (selectedId == null ? null : posts.find((p) => p.id === selectedId) ?? null),
    [posts, selectedId],
  );

  // Stats
  const stats = useMemo(() => {
    const all = posts;
    const bugs = all.filter((p) => p.inquiry_type === "bug");
    const fbs = all.filter((p) => p.inquiry_type === "feedback");
    const unanswered = all.filter((p) => p.replies_count === 0);
    return { total: all.length, bugs: bugs.length, feedbacks: fbs.length, unanswered: unanswered.length };
  }, [posts]);

  // selected는 selectedId+data로 derived. 별도 sync effect 불필요.
  useEffect(() => {
    if (selectedId != null && hasLoadedPosts && !posts.some((p) => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [hasLoadedPosts, posts, selectedId]);

  async function handleReply() {
    if (!selected || !replyText.trim()) return;
    try {
      await replyMut.mutateAsync({ postId: selected.id, content: replyText.trim() });
      setReplyText("");
      toast("답변 등록 완료");
    } catch {
      toast("답변 등록 실패", "error");
    }
  }

  async function handleDeleteReply(replyId: number) {
    if (!selected) return;
    if (!confirm("이 답변을 삭제하시겠습니까?")) return;
    try {
      await deleteMut.mutateAsync({ postId: selected.id, replyId });
      toast("답변 삭제됨");
    } catch {
      toast("삭제 실패", "error");
    }
  }

  return (
    <>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <Link to="/dev/dashboard" className={i.breadcrumbLink}>
            Dashboard
          </Link>
          <span className={i.breadcrumbSeparator}>/</span>
          <span className={i.breadcrumbCurrent}>문의함</span>
        </div>
        <div className={s.headerRight}>
          <span className={`${s.headerBadge} ${i.answerStatus}`} data-state={stats.unanswered > 0 ? "pending" : "done"}>
            {stats.unanswered > 0 ? `미답변 ${stats.unanswered}건` : "전체 답변 완료"}
          </span>
        </div>
      </header>

      <div className={s.content}>
        {/* Summary */}
        <div className={i.summaryGrid}>
          <SummaryCard label="전체" value={stats.total} />
          <SummaryCard label="버그" value={stats.bugs} tone="danger" />
          <SummaryCard label="피드백" value={stats.feedbacks} tone="primary" />
          <SummaryCard label="미답변" value={stats.unanswered} warn={stats.unanswered > 0} />
        </div>

        {/* Two-pane layout */}
        <div className={`${i.workspace} ${selected ? i.workspaceSplit : ""}`}>
          {/* Left: List */}
          <div className={`${s.card} ${i.pane}`}>
            {/* Filters */}
            <div className={i.filterBar}>
              {(["all", "bug", "feedback"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={i.filterButton}
                  data-active={filter === f ? "true" : undefined}
                >
                  {f === "all" ? "전체" : f === "bug" ? "버그" : "피드백"}
                </button>
              ))}
            </div>

            {/* Post list */}
            <div className={i.postList}>
              {isLoading ? (
                <div className={i.emptyState}>로딩 중...</div>
              ) : posts.length === 0 ? (
                <div className={i.emptyState}>문의가 없습니다.</div>
              ) : (
                posts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => { setSelectedId(post.id); setReplyText(""); }}
                    className={i.postButton}
                    data-selected={selected?.id === post.id ? "true" : undefined}
                  >
                    <div className={i.postMetaRow}>
                      <TypeBadge type={post.inquiry_type} />
                      <TenantBadge code={post.tenant_code} />
                      {post.replies_count === 0 && (
                        <span className={i.newBadge}>
                          NEW
                        </span>
                      )}
                      <span className={i.postTime}>
                        {formatRelative(post.created_at)}
                      </span>
                    </div>
                    <div className={i.postTitle}>
                      {stripPrefix(post.title)}
                    </div>
                    <div className={i.postFooter}>
                      <span className={i.postMutedText}>
                        {post.author_display_name || "관리자"}
                      </span>
                      {post.replies_count > 0 && (
                        <span className={i.replyCount}>
                          답변 {post.replies_count}
                        </span>
                      )}
                      {post.attachments.length > 0 && (
                        <span className={i.postMutedText}>
                          첨부 {post.attachments.length}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: Detail */}
          {selected && (
            <div className={`${s.card} ${i.pane}`}>
              {/* Header */}
              <div className={i.detailHeader}>
                <div className={i.detailMetaRow}>
                  <TypeBadge type={selected.inquiry_type} />
                  <TenantBadge code={selected.tenant_code} />
                  <span className={i.detailTenantName}>
                    {selected.tenant_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className={i.closeButton}
                    aria-label="상세 닫기"
                  >
                    &times;
                  </button>
                </div>
                <h3 className={i.detailTitle}>
                  {stripPrefix(selected.title)}
                </h3>
                <div className={i.detailByline}>
                  {selected.author_display_name || "관리자"} &middot; {formatDate(selected.created_at)}
                </div>
              </div>

              {/* Body */}
              <div className={i.detailBody}>
                {/* Content */}
                {selected.content && (
                  <div className={i.detailContent}>
                    {selected.content}
                  </div>
                )}

                {/* Attachments */}
                {selected.attachments.length > 0 && (
                  <div className={i.sectionBlock}>
                    <div className={i.sectionLabel}>
                      첨부파일
                    </div>
                    {selected.attachments.map((att) => (
                      <button
                        key={att.id}
                        type="button"
                        onClick={async () => {
                          try {
                            const { url } = await getInboxAttachmentUrl(selected.id, att.id);
                            window.open(url, "_blank", "noopener,noreferrer");
                          } catch {
                            toast("첨부 다운로드 URL 발급 실패", "error");
                          }
                        }}
                        className={i.attachmentButton}
                        title="새 탭에서 열기"
                      >
                        <span>📎</span>
                        <span className={i.attachmentName}>{att.original_name}</span>
                        <span className={i.attachmentSize}>
                          ({(att.size_bytes / 1024).toFixed(0)}KB)
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Replies */}
                {selected.replies.length > 0 && (
                  <div className={i.replySection}>
                    <div className={i.sectionLabel}>
                      답변 ({selected.replies.length})
                    </div>
                    {selected.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={i.replyCard}
                        data-dev-reply={reply.author_role === "staff" && reply.created_by === null ? "true" : undefined}
                      >
                        <div className={i.replyMetaRow}>
                          <span className={i.replyAuthor}>
                            {reply.created_by_display}
                          </span>
                          {reply.created_by === null && reply.author_role === "staff" && (
                            <span className={i.devBadge}>
                              DEV
                            </span>
                          )}
                          <span className={i.replyTime}>
                            {formatDate(reply.created_at)}
                          </span>
                          {reply.created_by === null && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReply(reply.id)}
                              className={i.deleteReplyButton}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                        <div className={i.replyContent}>
                          {reply.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply input */}
              <div className={i.replyComposer}>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="답변을 입력하세요..."
                  rows={2}
                  className={i.replyTextarea}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                />
                <button
                  className={`${s.btn} ${s.btnPrimary} ${i.submitButton}`}
                  onClick={handleReply}
                  disabled={replyMut.isPending || !replyText.trim()}
                >
                  {replyMut.isPending ? "전송 중..." : "답변"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Helpers ──

function stripPrefix(title: string): string {
  return title.replace(/^\[(BUG|FB)\]\s*/, "");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return formatDate(iso).split(" ")[0];
}

function TypeBadge({ type }: { type: "bug" | "feedback" }) {
  const isBug = type === "bug";
  return (
    <span className={i.typeBadge} data-type={type}>
      {isBug ? "BUG" : "FB"}
    </span>
  );
}

function TenantBadge({ code }: { code: string }) {
  return (
    <span className={i.tenantBadge}>
      {code}
    </span>
  );
}

function SummaryCard({ label, value, tone, warn }: { label: string; value: number; tone?: "danger" | "primary"; warn?: boolean }) {
  const resolvedTone = warn ? "danger" : tone ?? "default";

  return (
    <div className={i.summaryCard}>
      <div className={i.summaryLabel}>
        {label}
      </div>
      <div className={i.summaryValue} data-tone={resolvedTone}>
        {value}
      </div>
    </div>
  );
}

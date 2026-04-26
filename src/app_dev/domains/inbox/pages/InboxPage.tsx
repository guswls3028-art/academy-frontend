// PATH: src/dev_app/pages/InboxPage.tsx
// Platform inbox — 전체 테넌트 버그/피드백 수신함 + 답변

import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useInboxPosts, useCreateInboxReply, useDeleteInboxReply } from "@dev/domains/inbox/hooks/useInbox";
import { getInboxAttachmentUrl } from "@dev/domains/inbox/api/inbox.api";
import { useDevToast } from "@dev/shared/components/DevToast";
import type { InboxPost } from "@dev/domains/inbox/api/inbox.api";
import s from "@dev/layout/DevLayout.module.css";

type FilterType = "all" | "bug" | "feedback";

export default function InboxPage() {
  const { toast } = useDevToast();
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data, isLoading } = useInboxPosts(filter);
  const replyMut = useCreateInboxReply();
  const deleteMut = useDeleteInboxReply();

  const selected: InboxPost | null = useMemo(
    () => (selectedId == null ? null : data?.results.find((p) => p.id === selectedId) ?? null),
    [data, selectedId],
  );

  const posts = data?.results ?? [];

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
    if (selectedId != null && data && !data.results.find((p) => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [data, selectedId]);

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
          <Link to="/dev/dashboard" style={{ color: "var(--dev-text-muted)", textDecoration: "none", fontSize: 13 }}>
            Dashboard
          </Link>
          <span style={{ margin: "0 6px", color: "var(--dev-text-muted)" }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>문의함</span>
        </div>
        <div className={s.headerRight}>
          <span className={s.headerBadge} style={{
            background: stats.unanswered > 0 ? "var(--dev-danger-subtle)" : "var(--dev-success-subtle)",
            color: stats.unanswered > 0 ? "var(--dev-danger)" : "var(--dev-success)",
          }}>
            {stats.unanswered > 0 ? `미답변 ${stats.unanswered}건` : "전체 답변 완료"}
          </span>
        </div>
      </header>

      <div className={s.content}>
        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 20 }}>
          <SummaryCard label="전체" value={stats.total} />
          <SummaryCard label="버그" value={stats.bugs} color="var(--dev-danger)" />
          <SummaryCard label="피드백" value={stats.feedbacks} color="var(--dev-primary)" />
          <SummaryCard label="미답변" value={stats.unanswered} warn={stats.unanswered > 0} />
        </div>

        {/* Two-pane layout */}
        <div style={{ display: "grid", gridTemplateColumns: selected ? "380px 1fr" : "1fr", gap: 16, minHeight: 500 }}>
          {/* Left: List */}
          <div className={s.card} style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Filters */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--dev-border)", display: "flex", gap: 0 }}>
              {(["all", "bug", "feedback"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "4px 12px", fontSize: 12, fontWeight: filter === f ? 600 : 400,
                    border: "none", borderRadius: 6, cursor: "pointer",
                    background: filter === f ? "var(--dev-primary-subtle)" : "transparent",
                    color: filter === f ? "var(--dev-primary)" : "var(--dev-text-muted)",
                  }}
                >
                  {f === "all" ? "전체" : f === "bug" ? "버그" : "피드백"}
                </button>
              ))}
            </div>

            {/* Post list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {isLoading ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--dev-text-muted)" }}>로딩 중...</div>
              ) : posts.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--dev-text-muted)" }}>문의가 없습니다.</div>
              ) : (
                posts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => { setSelectedId(post.id); setReplyText(""); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "12px 16px", border: "none", cursor: "pointer",
                      borderBottom: "1px solid var(--dev-border-light)",
                      background: selected?.id === post.id ? "var(--dev-primary-subtle)" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <TypeBadge type={post.inquiry_type} />
                      <TenantBadge code={post.tenant_code} />
                      {post.replies_count === 0 && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                          background: "var(--dev-danger-subtle)", color: "var(--dev-danger)",
                        }}>
                          NEW
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--dev-text-muted)" }}>
                        {formatRelative(post.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--dev-text)", lineHeight: 1.4 }}>
                      {stripPrefix(post.title)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--dev-text-muted)" }}>
                        {post.author_display_name || "관리자"}
                      </span>
                      {post.replies_count > 0 && (
                        <span style={{ fontSize: 11, color: "var(--dev-success)" }}>
                          답변 {post.replies_count}
                        </span>
                      )}
                      {post.attachments.length > 0 && (
                        <span style={{ fontSize: 11, color: "var(--dev-text-muted)" }}>
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
            <div className={s.card} style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--dev-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <TypeBadge type={selected.inquiry_type} />
                  <TenantBadge code={selected.tenant_code} />
                  <span style={{ fontSize: 12, color: "var(--dev-text-muted)" }}>
                    {selected.tenant_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    style={{
                      marginLeft: "auto", border: "none", background: "none",
                      cursor: "pointer", color: "var(--dev-text-muted)", fontSize: 18, lineHeight: 1,
                    }}
                  >
                    &times;
                  </button>
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                  {stripPrefix(selected.title)}
                </h3>
                <div style={{ fontSize: 12, color: "var(--dev-text-muted)", marginTop: 4 }}>
                  {selected.author_display_name || "관리자"} &middot; {formatDate(selected.created_at)}
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                {/* Content */}
                {selected.content && (
                  <div style={{
                    fontSize: 14, lineHeight: 1.7, color: "var(--dev-text)",
                    whiteSpace: "pre-wrap", marginBottom: 16,
                  }}>
                    {selected.content}
                  </div>
                )}

                {/* Attachments */}
                {selected.attachments.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--dev-text-muted)", marginBottom: 6 }}>
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
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "4px 8px",
                          fontSize: 12, color: "var(--dev-text-secondary)",
                          background: "var(--dev-bg)", borderRadius: 6, marginBottom: 4,
                          width: "100%", textAlign: "left", border: "1px solid var(--dev-border-light)",
                          cursor: "pointer",
                        }}
                        title="새 탭에서 열기"
                      >
                        <span>📎</span>
                        <span style={{ flex: 1 }}>{att.original_name}</span>
                        <span style={{ color: "var(--dev-text-muted)" }}>
                          ({(att.size_bytes / 1024).toFixed(0)}KB)
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Replies */}
                {selected.replies.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--dev-border-light)", paddingTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--dev-text-muted)", marginBottom: 8 }}>
                      답변 ({selected.replies.length})
                    </div>
                    {selected.replies.map((reply) => (
                      <div key={reply.id} style={{
                        padding: "10px 12px", marginBottom: 8, borderRadius: 8,
                        background: reply.author_role === "staff" && reply.created_by === null
                          ? "#eff6ff" : "var(--dev-bg)",
                        border: `1px solid ${reply.author_role === "staff" && reply.created_by === null
                          ? "#bfdbfe" : "var(--dev-border-light)"}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--dev-text)" }}>
                            {reply.created_by_display}
                          </span>
                          {reply.created_by === null && reply.author_role === "staff" && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                              background: "#dbeafe", color: "#2563eb",
                            }}>
                              DEV
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: "var(--dev-text-muted)" }}>
                            {formatDate(reply.created_at)}
                          </span>
                          {reply.created_by === null && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReply(reply.id)}
                              style={{
                                marginLeft: "auto", border: "none", background: "none",
                                cursor: "pointer", color: "var(--dev-text-muted)", fontSize: 12,
                              }}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {reply.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply input */}
              <div style={{
                padding: "12px 20px", borderTop: "1px solid var(--dev-border)",
                display: "flex", gap: 8, alignItems: "flex-end",
              }}>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="답변을 입력하세요..."
                  rows={2}
                  style={{
                    flex: 1, resize: "vertical", padding: "8px 12px", fontSize: 13,
                    border: "1px solid var(--dev-border)", borderRadius: 8,
                    fontFamily: "inherit", lineHeight: 1.5,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                />
                <button
                  className={`${s.btn} ${s.btnPrimary}`}
                  onClick={handleReply}
                  disabled={replyMut.isPending || !replyText.trim()}
                  style={{ whiteSpace: "nowrap" }}
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
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 4,
      fontSize: 10, fontWeight: 700,
      background: isBug ? "var(--dev-danger-subtle)" : "var(--dev-primary-subtle)",
      color: isBug ? "var(--dev-danger)" : "var(--dev-primary)",
    }}>
      {isBug ? "BUG" : "FB"}
    </span>
  );
}

function TenantBadge({ code }: { code: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 4,
      fontSize: 10, fontWeight: 600,
      background: "#f1f5f9", color: "#475569",
      border: "1px solid #e2e8f0",
    }}>
      {code}
    </span>
  );
}

function SummaryCard({ label, value, color, warn }: { label: string; value: number; color?: string; warn?: boolean }) {
  return (
    <div style={{
      background: "var(--dev-surface)", border: "1px solid var(--dev-border)",
      borderRadius: "var(--dev-radius)", padding: "14px 16px",
      boxShadow: "var(--dev-shadow-sm)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--dev-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums",
        color: warn ? "var(--dev-danger)" : color ?? "var(--dev-text)",
      }}>
        {value}
      </div>
    </div>
  );
}

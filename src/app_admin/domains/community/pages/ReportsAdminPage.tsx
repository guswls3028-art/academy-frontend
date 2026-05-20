// PATH: src/app_admin/domains/community/pages/ReportsAdminPage.tsx
// 학원장 신고함 console — /admin/community/reports
//
// CommunityReport list + 상태 변경(resolved/dismissed) + target 글/댓글 링크.
// 사용자 spec(2026-05-11 추가 cycle #9): 부적절한 글/댓글을 학원장이 검토.
/* eslint-disable no-restricted-syntax */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";

type ReportStatus = "pending" | "resolved" | "dismissed";
type TargetType = "post" | "reply";

interface ReportTargetPost { kind: "post"; id: number; title: string; post_type: string; status: string; author_user_id?: number | null; author_name?: string | null }
interface ReportTargetReply { kind: "reply"; id: number; post_id: number; post_title: string; post_type: string; content_excerpt: string; author_user_id?: number | null; author_name?: string | null }
type ReportTarget = ReportTargetPost | ReportTargetReply;

interface ReportItem {
  id: number;
  target_type: TargetType;
  target_id: number;
  target: ReportTarget | null;
  reason: string;
  reason_label: string;
  detail: string;
  reporter_id: number | null;
  reporter_name: string | null;
  status: ReportStatus;
  status_label: string;
  created_at: string | null;
  resolved_at: string | null;
  triage?: "auto_dismiss" | "auto_escalate" | "manual";
}

const STATUS_FILTERS: { key: ReportStatus | "all"; label: string }[] = [
  { key: "pending", label: "대기" },
  { key: "resolved", label: "처리됨" },
  { key: "dismissed", label: "기각" },
  { key: "all", label: "전체" },
];

export default function ReportsAdminPage() {
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("pending");
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const fetchList = useCallback(() => {
    setItems(null); setError(false);
    const params: Record<string, string | number> = { page, page_size: 20 };
    if (statusFilter !== "all") params.status = statusFilter;
    api.get("/community/admin/reports/", { params } as ApiRequestConfig)
      .then((r) => {
        const data = r?.data;
        setItems(Array.isArray(data?.results) ? data.results : []);
        setCount(typeof data?.count === "number" ? data.count : 0);
      })
      .catch(() => { setError(true); setItems([]); });
  }, [page, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const onSelectStatusFilter = (next: ReportStatus | "all") => {
    setStatusFilter(next);
    setPage(1);
  };

  const onBlockUser = async (userId: number, name: string | null) => {
    const reason = window.prompt(`작성자 "${name || "이 사용자"}"를 학원 커뮤니티에서 차단하시겠습니까?\n사유(선택, 학원 내부 메모):`, "");
    if (reason === null) return;
    try {
      await api.post("/community/admin/user-blocks/", { user_id: userId, reason: reason.trim().slice(0, 500) });
      alert(`${name || "사용자"} 차단 완료. 학원 커뮤니티 작성·반응이 제한됩니다.`);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(detail || "차단 실패. 잠시 후 다시 시도해주세요.");
    }
  };

  const onSetStatus = async (id: number, next: "resolved" | "dismissed") => {
    if (pending !== null) return;
    setPending(id);
    try {
      await api.patch(`/community/admin/reports/${id}/`, { status: next });
      setItems((cur) => cur ? cur.map((r) => r.id === id ? { ...r, status: next, status_label: next === "resolved" ? "처리됨" : "기각" } : r) : cur);
    } catch {
      alert("상태 변경 실패. 잠시 후 다시 시도해주세요.");
    }
    setPending(null);
  };

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div style={{ padding: "24px 28px 80px", fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <header style={{ marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            Community · 신고함
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>커뮤니티 신고 관리</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>부적절한 글/댓글을 검토하고 처리·기각하세요.</p>
        </div>
        <Link to="/admin/community/board" style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 600 }}>← 게시판 관리로</Link>
      </header>

      {/* status filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => {
          const on = f.key === statusFilter;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onSelectStatusFilter(f.key)}
              style={{
                padding: "8px 14px", borderRadius: 999, border: "none",
                background: on ? "rgba(37,99,235,0.10)" : "transparent",
                color: on ? "#1E40AF" : "#475569",
                fontSize: 13, fontWeight: on ? 700 : 600,
                cursor: "pointer", letterSpacing: "-0.01em",
              }}
            >{f.label}</button>
          );
        })}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8" }}>총 {count}건</span>
      </div>

      {error ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", background: "#F8FAFC", borderRadius: 12 }}>잠시 후 다시 시도해 주세요.</div>
      ) : items === null ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 56, textAlign: "center", color: "#64748B", background: "#F8FAFC", borderRadius: 14, border: "1px dashed #CBD5E1" }}>
          📭 처리할 신고가 없습니다.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((r) => {
            const targetLink = r.target?.kind === "post"
              ? `/landing/community/${r.target.post_type}/posts/${r.target.id}`
              : r.target?.kind === "reply"
                ? `/landing/community/${r.target.post_type}/posts/${r.target.post_id}?reply=${r.target.id}`
                : null;
            const isPendingAction = pending === r.id;
            return (
              <li key={r.id} style={{
                padding: 18, borderRadius: 12,
                border: `1px solid ${r.status === "pending" ? "#FCA5A5" : "#E2E8F0"}`,
                background: r.status === "pending" ? "#FEF2F2" : "#FFFFFF",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: r.target_type === "post" ? "rgba(37,99,235,0.1)" : "rgba(124,58,237,0.1)", color: r.target_type === "post" ? "#1E40AF" : "#6D28D9" }}>
                    {r.target_type === "post" ? "글 신고" : "댓글 신고"}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "rgba(239,68,68,0.1)", color: "#B91C1C" }}>
                    {r.reason_label}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: r.status === "pending" ? "#FECACA" : r.status === "resolved" ? "rgba(16,185,129,0.12)" : "#E2E8F0", color: r.status === "pending" ? "#991B1B" : r.status === "resolved" ? "#065F46" : "#475569" }}>
                    {r.status_label}
                  </span>
                  {r.triage === "auto_escalate" && (
                    <span title="자동 분류: 즉시 검토 권장" style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "rgba(220,38,38,0.12)", color: "#B91C1C" }}>🚨 즉시 검토</span>
                  )}
                  {r.triage === "auto_dismiss" && (
                    <span title="자동 분류: 신뢰 낮은 신고 (over-reporting 가능성)" style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#E2E8F0", color: "#64748B" }}>🤔 검토 약함</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#94A3B8" }}>{formatDate(r.created_at)}</span>
                </div>
                <div>
                  {r.target ? (
                    <>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>
                        대상 {r.target.kind === "post" ? `글 (${r.target.post_type})` : `댓글 (글: ${r.target.post_type})`}
                      </div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>
                        {r.target.kind === "post" ? r.target.title : `↳ ${r.target.content_excerpt || "(빈 댓글)"}`}
                      </div>
                      {r.target.kind === "reply" && (
                        <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>원글: {r.target.post_title}</div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#94A3B8", fontStyle: "italic" }}>대상이 삭제되었습니다 (id: {r.target_id})</div>
                  )}
                </div>
                {r.detail && (
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "#F1F5F9", color: "#334155", fontSize: 13, lineHeight: 1.55 }}>
                    {/* React 기본 escape — XSS 방어. dangerouslySetInnerHTML 사용 X. */}
                    "{r.detail}"
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    신고자: <strong style={{ color: "#0F172A" }}>{r.reporter_name || "(탈퇴 사용자)"}</strong>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {targetLink && (
                      <Link to={targetLink} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 14px", borderRadius: 8, background: "#fff", border: "1px solid #CBD5E1", color: "#1E40AF", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                        대상 보기 ↗
                      </Link>
                    )}
                    {r.target?.author_user_id && (
                      <button
                        type="button"
                        onClick={() => onBlockUser(r.target!.author_user_id!, r.target!.author_name || null)}
                        title="이 작성자 학원 커뮤니티 차단"
                        style={{ padding: "7px 14px", borderRadius: 8, background: "#fff", border: "1px solid #FCA5A5", color: "#B91C1C", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >🚫 작성자 차단</button>
                    )}
                    {r.status === "pending" && (
                      <>
                        <button type="button" onClick={() => onSetStatus(r.id, "dismissed")} disabled={isPendingAction}
                          style={{ padding: "7px 14px", borderRadius: 8, background: "#fff", border: "1px solid #CBD5E1", color: "#475569", fontSize: 12, fontWeight: 600, cursor: isPendingAction ? "wait" : "pointer" }}
                        >기각</button>
                        <button type="button" onClick={() => onSetStatus(r.id, "resolved")} disabled={isPendingAction}
                          style={{ padding: "7px 14px", borderRadius: 8, background: "#1E40AF", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: isPendingAction ? "wait" : "pointer" }}
                        >{isPendingAction ? "처리 중…" : "처리됨"}</button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* pagination */}
      {totalPages > 1 && (
        <nav style={{ marginTop: 24, display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            style={{ minWidth: 32, height: 32, borderRadius: 8, border: "1px solid #CBD5E1", background: "#fff", color: "#475569", fontSize: 13, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}
          >‹</button>
          <span style={{ fontSize: 12, color: "#64748B", padding: "0 10px" }}>{page} / {totalPages}</span>
          <button type="button" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            style={{ minWidth: 32, height: 32, borderRadius: 8, border: "1px solid #CBD5E1", background: "#fff", color: "#475569", fontSize: 13, cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}
          >›</button>
        </nav>
      )}
    </div>
  );
}

function formatDate(raw: string | null): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}.${m}.${day} ${hh}:${mm}`;
  } catch { return ""; }
}

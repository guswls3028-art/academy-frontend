// PATH: src/app_admin/domains/landing-public/pages/LandingPublicInboxPage.tsx
// 학원장 외부 공개 커뮤니티 통합 모더레이션 inbox (Phase 4-C).
//
// 3탭 단일 페이지:
//   1) 승인대기 후기 (pending PublicReview) — approve/reject/verify 인라인 액션
//   2) 신고 처리 (pending PublicReport) — 대상 hide/reject + reviewed/dismissed
//   3) 차단 사용자 (PublicUserBlock) — 추가/해제
//
// family-only `app_admin/domains/community/`(공지/QnA/자료실/상담)와 데이터 트랙 분리 SSOT.
/* eslint-disable no-restricted-syntax */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  blockUser,
  fetchModerationSummary,
  fetchReportsList,
  fetchReviewsList,
  fetchUserBlocks,
  moderateReview,
  reviewReport,
  unblockUser,
  type ModerationSummary,
  type PublicReview,
  type ReportEntry,
  type ReportReason,
  type ReportTargetKind,
  type UserBlockEntry,
} from "@/landing/api/publicCommunity";

type Tab = "reviews" | "reports" | "blocks";

const REASON_LABEL: Record<ReportReason, string> = {
  spam: "광고/스팸",
  abuse: "욕설/비방",
  false: "허위/조작",
  copyright: "저작권",
  privacy: "개인정보",
  other: "기타",
};

const TARGET_LABEL: Record<ReportTargetKind, string> = {
  board: "자유게시판",
  review: "수강후기",
  reply: "댓글",
};

export default function LandingPublicInboxPage() {
  const [tab, setTab] = useState<Tab>("reviews");
  const [summary, setSummary] = useState<ModerationSummary | null>(null);

  const loadSummary = useCallback(() => {
    fetchModerationSummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto", fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif" }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em" }}>외부 공개 모더레이션</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--color-text-secondary, #475569)" }}>
          학원 홈페이지 공개 커뮤니티(자유게시판 / 수강후기 / 댓글) 통합 검토. family-only 커뮤니티(공지·QnA·자료실)와 별개 트랙입니다.
        </p>
      </header>

      <nav style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-border, rgba(0,0,0,0.08))", marginBottom: 20 }}>
        <TabButton on={tab === "reviews"} onClick={() => setTab("reviews")} label="승인대기 후기" badge={summary?.pending_reviews ?? 0} testid="moder-tab-reviews" />
        <TabButton on={tab === "reports"} onClick={() => setTab("reports")} label="신고 처리" badge={summary?.pending_reports ?? 0} testid="moder-tab-reports" />
        <TabButton on={tab === "blocks"} onClick={() => setTab("blocks")} label="차단 사용자" testid="moder-tab-blocks" />
      </nav>

      {tab === "reviews" && <PendingReviewsPanel onChange={loadSummary} />}
      {tab === "reports" && <ReportsPanel onChange={loadSummary} />}
      {tab === "blocks" && <BlocksPanel />}
    </div>
  );
}

function TabButton({ on, onClick, label, badge, testid }: { on: boolean; onClick: () => void; label: string; badge?: number; testid: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      style={{
        padding: "12px 18px", background: "transparent", border: "none",
        borderBottom: `2px solid ${on ? "#2563EB" : "transparent"}`,
        color: on ? "#0F172A" : "#64748B",
        fontSize: 14, fontWeight: on ? 700 : 600, cursor: "pointer",
        letterSpacing: "-0.01em", display: "inline-flex", alignItems: "center", gap: 6,
      }}
    >
      <span>{label}</span>
      {!!badge && badge > 0 && (
        <span style={{ minWidth: 20, padding: "2px 7px", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700 }}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// Pending Reviews Panel
// ─────────────────────────────────────────────────────────
function PendingReviewsPanel({ onChange }: { onChange: () => void }) {
  const [list, setList] = useState<PublicReview[] | null>(null);
  const [pending, setPending] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchReviewsList({ page: 1, page_size: 50, ordering: "latest" })
      .then((r) => {
        // staff 시점 — 본인 학원의 pending 만 노출 (backend는 staff에게 모든 status 노출)
        const onlyPending = r.results.filter((x) => x.status === "pending");
        setList(onlyPending);
        setPending(onlyPending.length);
      })
      .catch(() => { setList([]); setPending(0); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: number, payload: Parameters<typeof moderateReview>[1]) => {
    try {
      await moderateReview(id, payload);
      load(); onChange();
    } catch { window.alert("처리 실패"); }
  };

  if (list === null) return <Skeleton rows={3} />;
  if (list.length === 0) return <Empty message="승인 대기 중인 후기가 없습니다." />;

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {list.map((r) => (
        <li key={r.id} data-testid={`pending-review-${r.id}`}
          style={{ padding: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Stars n={r.rating} />
              {r.is_verified && <Chip color="#0a8d4d" bg="#dcfce7">✓ 인증</Chip>}
              <span style={{ fontSize: 12, color: "#64748B" }}>{r.display_name} · {r.grade || "—"} · {r.subject || "—"}</span>
            </div>
            <Link to={`/landing/reviews/${r.id}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "#2563EB", textDecoration: "underline", textUnderlineOffset: 2 }}
            >미리보기 ↗</Link>
          </div>
          {r.title && <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>{r.title}</div>}
          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <ActionBtn color="#0a8d4d" bg="#dcfce7" onClick={() => act(r.id, { status: "approved" })} testid={`approve-${r.id}`}>승인</ActionBtn>
            {!r.is_verified && (
              <ActionBtn color="#2563EB" bg="#dbeafe" onClick={() => act(r.id, { status: "approved", is_verified: true })} testid={`approve-verify-${r.id}`}>승인 + 인증</ActionBtn>
            )}
            <ActionBtn color="#b91c1c" bg="#fee2e2" onClick={() => act(r.id, { status: "rejected" })} testid={`reject-${r.id}`}>거절</ActionBtn>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────
// Reports Panel
// ─────────────────────────────────────────────────────────
function ReportsPanel({ onChange }: { onChange: () => void }) {
  const [list, setList] = useState<ReportEntry[] | null>(null);

  const load = useCallback(() => {
    fetchReportsList({ status: "pending", page_size: 50 })
      .then((r) => setList(r.results))
      .catch(() => setList([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id: number, payload: Parameters<typeof reviewReport>[1]) => {
    try {
      await reviewReport(id, payload);
      load(); onChange();
    } catch { window.alert("처리 실패"); }
  };

  if (list === null) return <Skeleton rows={3} />;
  if (list.length === 0) return <Empty message="처리 대기 중인 신고가 없습니다." />;

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {list.map((r) => (
        <li key={r.id} data-testid={`pending-report-${r.id}`}
          style={{ padding: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Chip color="#b91c1c" bg="#fee2e2">{REASON_LABEL[r.reason]}</Chip>
              <Chip color="#475569" bg="#f1f5f9">{TARGET_LABEL[r.target_kind]} #{r.target_id}</Chip>
              {r.target_status && <Chip color="#475569" bg="#f8fafc">{r.target_status}</Chip>}
              <span style={{ fontSize: 12, color: "#64748B" }}>{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <Link to={r.target_kind === "board" ? `/landing/board/${r.target_id}` : r.target_kind === "review" ? `/landing/reviews/${r.target_id}` : `/landing/board/${r.target_id}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "#2563EB", textDecoration: "underline", textUnderlineOffset: 2 }}
            >미리보기 ↗</Link>
          </div>
          <div style={{ fontSize: 13, color: "#0F172A", marginBottom: 6 }}>{r.target_preview || "(대상 미리보기 없음)"}</div>
          {r.description && (
            <div style={{ marginTop: 6, padding: "8px 12px", background: "#f8fafc", borderRadius: 8, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
              <strong>신고 사유:</strong> {r.description}
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <ActionBtn color="#b91c1c" bg="#fee2e2" onClick={() => act(r.id, { action: "reviewed", target_action: "hide" })} testid={`hide-${r.id}`}>대상 숨김 + 처리</ActionBtn>
            {r.target_kind === "review" && (
              <ActionBtn color="#b91c1c" bg="#fee2e2" onClick={() => act(r.id, { action: "reviewed", target_action: "reject" })} testid={`reject-target-${r.id}`}>후기 거절</ActionBtn>
            )}
            <ActionBtn color="#64748B" bg="#f1f5f9" onClick={() => act(r.id, { action: "dismissed" })} testid={`dismiss-${r.id}`}>신고 기각</ActionBtn>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────
// Blocks Panel
// ─────────────────────────────────────────────────────────
function BlocksPanel() {
  const [list, setList] = useState<UserBlockEntry[] | null>(null);
  const [userIdInput, setUserIdInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");

  const load = useCallback(() => {
    fetchUserBlocks().then((r) => setList(r.results)).catch(() => setList([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const uid = Number(userIdInput.trim());
    if (!Number.isFinite(uid) || uid <= 0) { window.alert("user_id 입력 필요"); return; }
    try {
      await blockUser(uid, reasonInput.trim());
      setUserIdInput(""); setReasonInput("");
      load();
    } catch (e: any) {
      window.alert(e?.response?.data?.detail || "차단 실패");
    }
  };

  const remove = async (uid: number) => {
    if (!window.confirm(`사용자 #${uid} 차단 해제하시겠어요?`)) return;
    try { await unblockUser(uid); load(); } catch { window.alert("해제 실패"); }
  };

  return (
    <div>
      <div style={{ padding: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>새 차단 추가</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="number" value={userIdInput} onChange={(e) => setUserIdInput(e.target.value)}
            data-testid="block-user-id"
            placeholder="user_id"
            style={{ width: 140, padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, outline: "none" }}
          />
          <input type="text" value={reasonInput} onChange={(e) => setReasonInput(e.target.value)}
            data-testid="block-reason"
            placeholder="사유 (선택)" maxLength={200}
            style={{ flex: "1 1 220px", minWidth: 200, padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, outline: "none" }}
          />
          <button type="button" onClick={add} data-testid="block-submit"
            style={{ padding: "9px 18px", borderRadius: 999, border: "none", background: "#0F172A", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >차단</button>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "#64748B" }}>※ 차단된 사용자는 board/review/reply 작성이 제한됩니다. 기존 글은 자동 숨김되지 않으므로 별도로 모더레이션하세요.</p>
      </div>

      {list === null ? <Skeleton rows={3} />
        : list.length === 0 ? <Empty message="차단된 사용자가 없습니다." />
        : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((b) => (
              <li key={b.id} data-testid={`block-row-${b.blocked_user_id}`}
                style={{ padding: "12px 16px", background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>#{b.blocked_user_id}</span>
                  <span style={{ fontSize: 13, color: "#0F172A" }}>{b.blocked_user_name || "(이름 없음)"}</span>
                  {b.reason && <span style={{ fontSize: 12, color: "#64748B" }}>· {b.reason}</span>}
                </div>
                <button type="button" onClick={() => remove(b.blocked_user_id)}
                  data-testid={`unblock-${b.blocked_user_id}`}
                  style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >해제</button>
              </li>
            ))}
          </ul>
        )
      }
    </div>
  );
}

// ─── Shared ───

function Skeleton({ rows }: { rows: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: 96, background: "#f1f5f9", borderRadius: 12 }} />
      ))}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748B", fontSize: 13.5, background: "#fafbfc", border: "1px dashed rgba(0,0,0,0.08)", borderRadius: 12 }}>
      {message}
    </div>
  );
}

function ActionBtn({ children, onClick, color, bg, testid }: { children: React.ReactNode; onClick: () => void; color: string; bg: string; testid: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      style={{ padding: "8px 14px", borderRadius: 999, border: "none", background: bg, color, fontSize: 12.5, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}
    >{children}</button>
  );
}

function Chip({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{ padding: "3px 8px", borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 700, letterSpacing: "0.02em" }}>{children}</span>
  );
}

function Stars({ n }: { n: number }) {
  const stars = "★★★★★".slice(0, Math.max(0, Math.min(5, n)));
  const dim = "★★★★★".slice(0, 5 - Math.max(0, Math.min(5, n)));
  return (
    <span style={{ letterSpacing: 1, fontSize: 14 }}>
      <span style={{ color: "#D4A04C" }}>{stars}</span>
      <span style={{ color: "rgba(140,140,140,0.4)" }}>{dim}</span>
    </span>
  );
}

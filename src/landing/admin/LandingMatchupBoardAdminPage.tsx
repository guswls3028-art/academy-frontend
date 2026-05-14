// PATH: src/landing/admin/LandingMatchupBoardAdminPage.tsx
// 매치업 적중보고서 공개 게시판 관리 (Phase #69, 2026-05-13).
//
// 학원장(owner/admin) 전용 페이지 — 사이드바 "수정하기 (학원장) → 매치업 적중보고서 게시판 관리" 진입.
//
// 본질:
//   - 박철T 호소: "어떻게 매치업을 홈피에 올리지? 카페에 PDF로 올리던 흐름을 우리 게시판으로 흡수"
//   - PublicMatchupShowcase entity로 게시 시점 PDF 스냅샷 + visibility window 자동 비공개
//   - 원본 MatchupHitReport는 immutable — 게시물에 변동 영향 X (snapshot 박힌 그대로)
/* eslint-disable no-restricted-syntax */

import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchMatchupShowcaseList,
  unpublishMatchupShowcase,
  deleteMatchupShowcase,
  type MatchupShowcaseCard,
  type MatchupShowcaseStatus,
} from "../api/matchupShowcase";
import EditShowcaseModal from "./matchup_board/EditShowcaseModal";
import PublishShowcaseModal, { type PublishMode } from "./matchup_board/PublishShowcaseModal";
import { formatDate } from "./matchup_board/helpers";

function StatusBadge({ status, expired }: { status: MatchupShowcaseStatus; expired: boolean }) {
  let label = "공개";
  let bg = "#16a34a";
  const fg = "#fff";
  if (expired || status === "expired") { label = "기간 만료"; bg = "#f59e0b"; }
  else if (status === "hidden") { label = "비공개"; bg = "#6b7280"; }
  else if (status === "draft") { label = "초안"; bg = "#94a3b8"; }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      background: bg, color: fg,
    }}>{label}</span>
  );
}

// PublishFormState / INITIAL_FORM 은 PublishShowcaseModal 안 own state 로 이동.

export default function LandingMatchupBoardAdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isOwner = !!(user?.is_superuser || user?.tenantRole === "owner" || user?.tenantRole === "admin");
  const navigate = useNavigate();

  const [items, setItems] = useState<MatchupShowcaseCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // publish 모달 — PublishShowcaseModal 컴포넌트 분리 (P1 audit step 2 2026-05-14).
  // state 모두 모달 안 own. main page 는 open + initialMode 만.
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishInitialMode, setPublishInitialMode] = useState<PublishMode>("existing");

  // ?compose=upload query param 자동 진입.
  const [searchParams, setSearchParams] = useSearchParams();

  // edit 모달 — EditShowcaseModal 컴포넌트 분리 (P1 audit 2026-05-14).
  // form/submit state 는 모달 안 own state, main page는 card 참조만.
  const [editing, setEditing] = useState<MatchupShowcaseCard | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchMatchupShowcaseList();
      setItems(resp.results);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "게시물 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOwner) void reload();
  }, [isOwner, reload]);

  const openPublishModal = useCallback((initialMode: PublishMode = "existing") => {
    setPublishInitialMode(initialMode);
    setPublishOpen(true);
  }, []);

  const handlePublished = useCallback(async () => {
    setPublishOpen(false);
    await reload();
  }, [reload]);

  // ?compose=upload / ?compose=existing 감지 → 자동 모달 open + mode 설정.
  useEffect(() => {
    if (!isOwner) return;
    const compose = searchParams.get("compose");
    if (compose === "upload" || compose === "existing") {
      openPublishModal(compose);
      const next = new URLSearchParams(searchParams);
      next.delete("compose");
      setSearchParams(next, { replace: true });
    }
  }, [isOwner, searchParams, setSearchParams, openPublishModal]);

  const openEdit = useCallback((card: MatchupShowcaseCard) => {
    setEditing(card);
  }, []);

  const handleEditSaved = useCallback(async () => {
    setEditing(null);
    await reload();
  }, [reload]);

  const handleUnpublish = useCallback(async (card: MatchupShowcaseCard) => {
    if (!window.confirm(`"${card.title}" 게시를 비공개로 전환하시겠습니까?\n(일반인에게 숨겨지지만 데이터는 보존됩니다.)`)) return;
    try {
      await unpublishMatchupShowcase(card.id);
      feedback.success("비공개로 전환했습니다.");
      await reload();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      feedback.error(typeof detail === "string" ? detail : "처리 실패");
    }
  }, [reload]);

  const handleCopyShareLink = useCallback(async (card: MatchupShowcaseCard) => {
    // 학원장 spec (박철T 2026-05-13): 매치업 게시물 단일 외부 공개 URL 카톡 공유.
    // /landing/matchup-board/<id> — 비로그인 OK (PUBLISHED + window 안만).
    const absolute = `${window.location.origin}/landing/matchup-board/${card.id}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(absolute);
      copied = true;
    } catch {
      window.prompt("학생용 공유 링크 (복사해서 카톡으로 보내세요)", absolute);
    }
    if (copied) feedback.success("학생용 링크를 복사했습니다. 카톡에 붙여넣으면 학생들이 PDF만 봅니다.");
    else feedback.info("학생용 링크가 위 입력창에 표시되었습니다.");
  }, []);

  const handleDelete = useCallback(async (card: MatchupShowcaseCard) => {
    if (!window.confirm(`"${card.title}" 게시물을 삭제하시겠습니까?\n(게시판에서 사라지며 일반인에게 노출되지 않습니다.)`)) return;
    try {
      await deleteMatchupShowcase(card.id);
      feedback.success("삭제했습니다.");
      await reload();
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      feedback.error(typeof detail === "string" ? detail : "삭제 실패");
    }
  }, [reload]);

  // useAuth hydrate 시점 race 방어 — isLoading 중에는 redirect 금지.
  // 직전 결함: race 시 학원장 진입에도 /login 으로 튕김.
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 13 }}>
        불러오는 중…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent("/landing/admin/matchup-board")}`} replace />;
  }
  if (!isOwner) {
    return (
      <div style={{ maxWidth: 720, margin: "80px auto", padding: 24, textAlign: "center", color: "#475569" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>접근 권한이 없습니다</h2>
        <p style={{ marginBottom: 20 }}>학원장(원장/운영자)만 접근할 수 있는 페이지입니다.</p>
        <Link to="/landing" style={{ color: "#2563eb", textDecoration: "none" }}>← 홈으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      {/* 헤더 */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "20px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#D4A04C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>학원장 콘솔</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>매치업 적중보고서 게시판</h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: "6px 0 0", lineHeight: 1.5 }}>
              작성 완료한 적중보고서를 게시판에 박아 학생/학부모에게 노출합니다. 게시 시점의 PDF가 저장되어 이후 원본 변경 무관 (스냅샷).
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => navigate("/landing")}
              style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >← 홈으로</button>
            <button
              type="button"
              data-testid="open-publish-modal"
              onClick={() => void openPublishModal("existing")}
              style={{
                padding: "10px 18px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
                color: "#0A0E1A", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 6px 18px rgba(212,160,76,0.28)",
              }}
            >+ 적중보고서 게시</button>
          </div>
        </div>
      </div>

      {/* list */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px" }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: "center", color: "#64748b" }}>불러오는 중…</div>
        ) : error ? (
          <div style={{ padding: 24, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
            <strong>오류:</strong> {error}
            <button type="button" onClick={() => void reload()} style={{ marginLeft: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", color: "#991b1b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>다시 시도</button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 64, textAlign: "center", background: "#fff", borderRadius: 16, border: "1px dashed #cbd5e1" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>아직 게시된 적중보고서가 없습니다</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px", lineHeight: 1.5 }}>
              매치업에서 적중보고서를 작성한 뒤 우상단 <strong>+ 적중보고서 게시</strong> 버튼으로 게시판에 박아두세요.<br />
              학생/학부모는 학원 홈페이지의 매치업 섹션에서 PDF를 봅니다.
            </p>
            <button type="button" onClick={() => void openPublishModal("existing")} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)", color: "#0A0E1A", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ 적중보고서 게시</button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((card) => (
              <div key={card.id} data-testid={`matchup-showcase-row-${card.id}`} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <StatusBadge status={card.status} expired={card.expired} />
                    <span style={{ fontSize: 11, color: "#64748b" }}>#{card.id}</span>
                    {card.snapshot_meta?.hit_rate !== undefined && (
                      <span style={{ fontSize: 11, color: "#D4A04C", fontWeight: 700 }}>
                        적중률 {Math.round((card.snapshot_meta.hit_rate || 0) * 100)}% ({card.snapshot_meta.hit_count}/{card.snapshot_meta.counted_entries})
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.title}</h3>
                  {card.description && (
                    <p style={{ fontSize: 13, color: "#475569", margin: "0 0 8px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.description}</p>
                  )}
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                    <span>공개 {formatDate(card.published_at)}</span>
                    <span>종료 {card.published_until ? formatDate(card.published_until) : "무기한"}</span>
                    <span>조회 {card.view_count}회</span>
                    {card.snapshot_meta?.author_name && <span>강사 {card.snapshot_meta.author_name}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {/* 박철T spec (Phase #74, 2026-05-13): "매치업만 볼 수 있는 링크에
                      위에 올린 파일만". 게시물 단일 detail URL 카톡 1클릭 공유. */}
                  <button type="button" onClick={() => handleCopyShareLink(card)}
                    data-testid={`matchup-share-${card.id}`}
                    title="학생/학부모 카톡으로 보낼 단일 PDF 링크"
                    style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(212,160,76,0.5)", background: "rgba(212,160,76,0.08)", color: "#B8862F", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >🔗 링크 복사</button>
                  <button type="button" onClick={() => openEdit(card)}
                    style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >수정</button>
                  {card.status === "published" && (
                    <button type="button" onClick={() => handleUnpublish(card)}
                      style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >비공개</button>
                  )}
                  <button type="button" onClick={() => handleDelete(card)}
                    style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Publish 모달 — 분리 (P1 audit step 2 2026-05-14) */}
      <PublishShowcaseModal
        open={publishOpen}
        initialMode={publishInitialMode}
        onClose={() => setPublishOpen(false)}
        onPublished={handlePublished}
      />

      {/* Edit 모달 — 분리된 컴포넌트 (P1 audit 2026-05-14) */}
      {editing && (
        <EditShowcaseModal
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  );
}

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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchHitReportList,
  type HitReportListItem,
} from "@/app_admin/domains/storage/api/matchup.api";
import {
  fetchMatchupShowcaseList,
  publishMatchupShowcase,
  publishMatchupShowcaseUpload,
  unpublishMatchupShowcase,
  deleteMatchupShowcase,
  type MatchupShowcaseCard,
  type MatchupShowcaseStatus,
} from "../api/matchupShowcase";
import EditShowcaseModal from "./matchup_board/EditShowcaseModal";
import { formatDate, inputDatetimeLocalToISO } from "./matchup_board/helpers";

type PublishMode = "existing" | "upload";

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

// 형식 변환 헬퍼는 matchup_board/helpers.ts 로 분리 (P1 audit step 2026-05-14).
// EditShowcaseModal 도 같은 helper 재사용.

interface PublishFormState {
  hit_report_id: number | null;
  title: string;
  description: string;
  published_at: string;
  published_until: string;
}

const INITIAL_FORM: PublishFormState = {
  hit_report_id: null,
  title: "",
  description: "",
  published_at: "",
  published_until: "",
};

export default function LandingMatchupBoardAdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isOwner = !!(user?.is_superuser || user?.tenantRole === "owner" || user?.tenantRole === "admin");
  const navigate = useNavigate();

  const [items, setItems] = useState<MatchupShowcaseCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // publish 모달
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishMode, setPublishMode] = useState<PublishMode>("existing");
  const [reports, setReports] = useState<HitReportListItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [form, setForm] = useState<PublishFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  // upload mode 전용
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ?compose=upload query param 자동 진입 — 매치업 콘솔에서 "PDF 업로드 게시" 1클릭 deep link.
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

  const openPublishModal = useCallback(async (initialMode: PublishMode = "existing") => {
    setPublishOpen(true);
    setPublishMode(initialMode);
    setForm(INITIAL_FORM);
    setUploadFile(null);
    if (reports.length === 0) {
      setReportsLoading(true);
      try {
        // 학원장이 자기 학원 전체 보고서 풀에서 선택 (제출/초안 모두 가능 — 게시는 별개 결정).
        const resp = await fetchHitReportList({});
        setReports(resp.reports || []);
      } catch (e) {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        feedback.error(typeof detail === "string" ? detail : "적중보고서 목록 조회 실패");
      } finally {
        setReportsLoading(false);
      }
    }
  }, [reports.length]);

  // ?compose=upload / ?compose=existing 감지 → 자동 모달 open + mode 설정.
  // 매치업 콘솔에서 "PDF 업로드 게시" 1클릭 deep link.
  useEffect(() => {
    if (!isOwner) return;
    const compose = searchParams.get("compose");
    if (compose === "upload" || compose === "existing") {
      void openPublishModal(compose);
      const next = new URLSearchParams(searchParams);
      next.delete("compose");
      setSearchParams(next, { replace: true });
    }
  }, [isOwner, searchParams, setSearchParams, openPublishModal]);

  const selectedReport = useMemo(() => reports.find((r) => r.id === form.hit_report_id) || null, [reports, form.hit_report_id]);

  const submitPublish = useCallback(async () => {
    if (publishMode === "existing") {
      if (!form.hit_report_id) {
        feedback.error("적중보고서를 먼저 선택해주세요.");
        return;
      }
      setSubmitting(true);
      try {
        await publishMatchupShowcase({
          hit_report_id: form.hit_report_id,
          title: form.title.trim() || undefined,
          description: form.description.trim() || undefined,
          published_at: inputDatetimeLocalToISO(form.published_at),
          published_until: inputDatetimeLocalToISO(form.published_until),
        });
        feedback.success("게시판에 박혔습니다.");
        setPublishOpen(false);
        setForm(INITIAL_FORM);
        await reload();
      } catch (e) {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        feedback.error(typeof detail === "string" ? detail : "게시 실패");
      } finally {
        setSubmitting(false);
      }
    } else {
      // upload mode — PC PDF 직접 업로드 (박철T 학원장 라이브 spec 2026-05-13)
      if (!uploadFile) {
        feedback.error("PDF 파일을 선택해주세요.");
        return;
      }
      if (!uploadFile.name.toLowerCase().endsWith(".pdf")) {
        feedback.error("PDF 파일만 업로드 가능합니다.");
        return;
      }
      if (uploadFile.size > 20 * 1024 * 1024) {
        feedback.error("PDF는 20MB 이하만 가능합니다.");
        return;
      }
      setSubmitting(true);
      try {
        await publishMatchupShowcaseUpload({
          file: uploadFile,
          title: form.title.trim() || undefined,
          description: form.description.trim() || undefined,
          published_at: inputDatetimeLocalToISO(form.published_at),
          published_until: inputDatetimeLocalToISO(form.published_until),
          source_hit_report_id: form.hit_report_id ?? null,
        });
        feedback.success("PDF 게시 완료!");
        setPublishOpen(false);
        setForm(INITIAL_FORM);
        setUploadFile(null);
        await reload();
      } catch (e) {
        const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        feedback.error(typeof detail === "string" ? detail : "업로드 실패");
      } finally {
        setSubmitting(false);
      }
    }
  }, [publishMode, form, uploadFile, reload]);

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

      {/* Publish 모달 */}
      {publishOpen && (
        <div
          onClick={() => !submitting && setPublishOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,12,22,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 100%)", maxHeight: "90vh", background: "#fff", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>적중보고서 게시</h3>
              <button type="button" onClick={() => setPublishOpen(false)} disabled={submitting} aria-label="닫기"
                style={{ width: 30, height: 30, borderRadius: 6, background: "transparent", border: "1px solid #cbd5e1", cursor: "pointer", color: "#475569", fontSize: 16, lineHeight: 1 }}
              >×</button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {/* 게시 mode 라디오 (Phase #71, 박철T 학원장 라이브 spec 2026-05-13).
                  existing = 콘솔 작성 보고서를 그대로 / upload = PC에서 편집한 PDF 직접 업로드 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                <button type="button" data-testid="publish-mode-existing"
                  onClick={() => setPublishMode("existing")}
                  style={{
                    padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                    background: publishMode === "existing" ? "rgba(212,160,76,0.12)" : "#f8fafc",
                    border: `1px solid ${publishMode === "existing" ? "rgba(212,160,76,0.55)" : "#e2e8f0"}`,
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: publishMode === "existing" ? "#B8862F" : "#0f172a" }}>📋 콘솔의 보고서 그대로</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>작성하신 보고서를 그대로 게시 (서버가 PDF 생성)</div>
                </button>
                <button type="button" data-testid="publish-mode-upload"
                  onClick={() => setPublishMode("upload")}
                  style={{
                    padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                    background: publishMode === "upload" ? "rgba(212,160,76,0.12)" : "#f8fafc",
                    border: `1px solid ${publishMode === "upload" ? "rgba(212,160,76,0.55)" : "#e2e8f0"}`,
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: publishMode === "upload" ? "#B8862F" : "#0f172a" }}>📎 내 PC의 PDF 업로드</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>다운받아 수정한 PDF 직접 올리기 (출처 가린 버전 등)</div>
                </button>
              </div>

              {publishMode === "existing" ? (
                <>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                    적중보고서 선택
                  </label>
                  {reportsLoading ? (
                    <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>보고서 불러오는 중…</div>
                  ) : reports.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13, background: "#f1f5f9", borderRadius: 10 }}>
                      적중보고서가 없습니다. 매치업 페이지에서 먼저 보고서를 작성해주세요.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 6, marginBottom: 16, maxHeight: 240, overflowY: "auto" }}>
                      {reports.map((r) => (
                        <label key={r.id}
                          data-testid={`publish-pick-${r.id}`}
                          style={{
                            display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center",
                            padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                            background: form.hit_report_id === r.id ? "rgba(212,160,76,0.1)" : "#f8fafc",
                            border: `1px solid ${form.hit_report_id === r.id ? "rgba(212,160,76,0.5)" : "#e2e8f0"}`,
                          }}
                        >
                          <input type="radio" name="hr" checked={form.hit_report_id === r.id}
                            onChange={() => setForm((f) => ({ ...f, hit_report_id: r.id, title: f.title || r.title || r.document_title }))}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title || r.document_title}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>
                              {r.author_name} · {r.status === "submitted" ? "제출됨" : "초안"} · 적중률 {r.hit_rate}% ({r.hit_count}/{r.exam_count})
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>#{r.id}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* upload mode — PDF file input + optional source 보고서 참조 */}
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                    PDF 파일 (≤ 20MB)
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files?.[0];
                      if (f) setUploadFile(f);
                    }}
                    style={{
                      border: `2px dashed ${uploadFile ? "rgba(212,160,76,0.5)" : "#cbd5e1"}`,
                      borderRadius: 12, padding: 24, marginBottom: 12,
                      cursor: "pointer", background: uploadFile ? "rgba(212,160,76,0.06)" : "#f8fafc",
                      textAlign: "center",
                    }}
                  >
                    <input ref={fileInputRef} type="file" accept="application/pdf,.pdf"
                      data-testid="publish-pdf-file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      style={{ display: "none" }}
                    />
                    {uploadFile ? (
                      <>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>📎</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4, wordBreak: "break-all" }}>{uploadFile.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {(uploadFile.size / 1024 / 1024).toFixed(2)} MB · 클릭하면 다른 파일 선택
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>PDF 파일을 끌어 놓거나 클릭해서 선택</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>출처 부분을 가려서 편집한 적중보고서 PDF</div>
                      </>
                    )}
                  </div>

                  <details style={{ marginBottom: 12 }}>
                    <summary style={{ fontSize: 12, color: "#64748b", cursor: "pointer", marginBottom: 6 }}>
                      원본 보고서 연결 (선택) — 적중률 자동 입력용
                    </summary>
                    <div style={{ marginTop: 8, padding: 8, background: "#f8fafc", borderRadius: 8 }}>
                      {reportsLoading ? (
                        <div style={{ fontSize: 12, color: "#64748b" }}>보고서 불러오는 중…</div>
                      ) : reports.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#64748b" }}>연결 가능한 보고서가 없습니다 (없어도 게시 가능).</div>
                      ) : (
                        <div style={{ display: "grid", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}>
                            <input type="radio" name="src_hr" checked={form.hit_report_id === null}
                              onChange={() => setForm((f) => ({ ...f, hit_report_id: null }))}
                            />
                            <span style={{ color: "#64748b" }}>원본 연결 안 함</span>
                          </label>
                          {reports.map((r) => (
                            <label key={r.id} style={{
                              display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 8, alignItems: "center",
                              padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                              background: form.hit_report_id === r.id ? "rgba(212,160,76,0.1)" : "transparent",
                            }}>
                              <input type="radio" name="src_hr" checked={form.hit_report_id === r.id}
                                onChange={() => setForm((f) => ({ ...f, hit_report_id: r.id }))}
                              />
                              <div style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {r.title || r.document_title} <span style={{ color: "#94a3b8" }}>({r.hit_rate}%)</span>
                              </div>
                              <span style={{ fontSize: 10, color: "#94a3b8" }}>#{r.id}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                </>
              )}

              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                게시 제목 {publishMode === "existing" ? "(비우면 보고서 제목 자동 사용)" : "(비우면 파일명 자동 사용)"}
              </label>
              <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={
                  publishMode === "existing"
                    ? (selectedReport?.title || selectedReport?.document_title || "예: 2025 1학기 중간 적중 보고서")
                    : (uploadFile?.name.replace(/\.pdf$/i, "") || "예: 2025 1학기 중간 적중 보고서")
                }
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 12, fontSize: 14, fontFamily: "inherit" }}
              />

              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                코멘트 (선택)
              </label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="학원장 코멘트를 남기면 카드에 함께 노출됩니다."
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 12, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                    공개 시작 (비우면 즉시)
                  </label>
                  <input type="datetime-local" value={form.published_at} onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
                    공개 종료 (비우면 무기한)
                  </label>
                  <input type="datetime-local" value={form.published_until} onChange={(e) => setForm((f) => ({ ...f, published_until: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>
              </div>
              <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 8px", lineHeight: 1.5 }}>
                공개 종료가 지나면 일반 학생/학부모에게는 카드 요약만 노출됩니다. 학원장은 항상 전체 보기 가능.
              </p>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setPublishOpen(false)} disabled={submitting}
                style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >취소</button>
              <button type="button" onClick={submitPublish}
                disabled={submitting || (publishMode === "existing" ? !form.hit_report_id : !uploadFile)}
                data-testid="submit-publish"
                style={{
                  padding: "10px 18px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
                  color: "#0A0E1A", fontSize: 13, fontWeight: 700,
                  cursor: submitting || (publishMode === "existing" ? !form.hit_report_id : !uploadFile) ? "not-allowed" : "pointer",
                  opacity: submitting || (publishMode === "existing" ? !form.hit_report_id : !uploadFile) ? 0.6 : 1,
                }}
              >{submitting ? "게시 중…" : "게시"}</button>
            </div>
          </div>
        </div>
      )}

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

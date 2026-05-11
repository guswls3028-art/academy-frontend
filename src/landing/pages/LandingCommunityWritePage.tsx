// PATH: src/landing/pages/LandingCommunityWritePage.tsx
// 랜딩 커뮤니티 글 작성 — /landing/community/:boardType/write
//
// 권한:
//   - 학원장/admin/teacher → 모든 board_type
//   - 학생 → board(자유), qna(질문)만
//   - 학부모 → 차단(read-only)
//   - 비로그인 → 로그인 유도
//
// backend POST /community/posts/ (학부모 차단, post_type 검증). 성공 시 글 상세로 navigate.
/* eslint-disable no-restricted-syntax */

import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import useAuth from "@/auth/hooks/useAuth";
import { useEffect } from "react";
import { fetchLandingPublic } from "../api";
import type { LandingPublicResponse } from "../types";
import { LandingNavBar, type NavBarTokens } from "../templates/shared";
import LandingFooter, { FOOTER_TOKENS_DARK } from "../components/LandingFooter";
import LandingRoleFab from "../components/LandingRoleFab";

const NAV_TOKENS: NavBarTokens = {
  bg: "rgba(10,14,26,0.85)",
  border: "rgba(255,255,255,0.08)",
  textPrimary: "#F5F1E8",
  textSecondary: "#9CA3AF",
  primaryColor: "#D4A04C",
  primaryRgb: "212,160,76",
  ctaGradient: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
  ctaTextColor: "#0A0E1A",
  panelBg: "#0F1525",
};

type BoardType = "board" | "qna" | "notice" | "materials";
const VALID: BoardType[] = ["board", "qna", "notice", "materials"];
const BOARD_LABEL: Record<BoardType, string> = {
  board: "자유게시판", qna: "질문게시판", notice: "공지사항", materials: "자료실",
};
const STAFF_ONLY: BoardType[] = ["notice", "materials"];

function BrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800 }}>{initial}</div>
  );
}

export default function LandingCommunityWritePage() {
  const { boardType } = useParams<{ boardType: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const isValid = VALID.includes(boardType as BoardType);
  const initialBoard = (isValid ? (boardType as BoardType) : "board");
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  const isStaff = !!u?.is_superuser || ["owner", "admin", "teacher", "assistant"].includes(role);
  const isStudent = role === "student";
  const isParent = role === "parent";

  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<BoardType>(initialBoard);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 이미지 첨부 (P3) — backend는 PostAttachment multipart endpoint 완비.
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);

  // 학생이 staff-only board를 선택한 상태로 진입하면 board로 강제 변경
  useEffect(() => {
    if (isStudent && STAFF_ONLY.includes(selectedBoard)) setSelectedBoard("board");
  }, [isStudent, selectedBoard]);

  if (boardType && !isValid) return <Navigate to="/landing/community/board/write" replace />;
  if (!landing) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const cfg = landing.config!;
  const bg = "#0A0E1A";
  const bgAlt = "#0F1525";
  const border = "rgba(255,255,255,0.08)";
  const cardBg = "rgba(255,255,255,0.03)";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";
  const textMuted = "#6B7280";
  const gold = "#D4A04C";

  // 권한 게이트
  const block: { reason: string; cta: { label: string; to: string } } | null = (() => {
    if (!isAuthenticated) {
      return { reason: "글 작성은 로그인 후에 이용하실 수 있습니다.", cta: { label: "로그인하기", to: "/login" } };
    }
    if (isParent) {
      return { reason: "학부모 계정은 글 작성이 제한됩니다. 학생 또는 강사 계정으로 작성해 주세요.", cta: { label: `${BOARD_LABEL[initialBoard]} 목록으로`, to: `/landing/community/${initialBoard}` } };
    }
    return null;
  })();

  // 권한별 board_type 노출 SSOT.
  // staff는 board/notice/materials 작성 가능. qna는 학생 질문 전용 — staff가 작성하면 backend가
  // profile_required(400) 반환(qna는 created_by=Student 필수). 그러므로 staff에게는 qna 노출 X.
  // 학생은 board/qna 가능. 공지/자료실은 student write 허용 안 됨(backend는 통과시키나 정책상 노출 안 함).
  const allowedBoards: BoardType[] = isStaff ? ["board", "notice", "materials"] : ["board", "qna"];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErr(null);
    if (!title.trim()) { setErr("제목을 입력해주세요."); return; }
    if (!content.trim()) { setErr("내용을 입력해주세요."); return; }
    if (!allowedBoards.includes(selectedBoard)) { setErr("선택한 게시판에 글을 쓸 권한이 없습니다."); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        post_type: selectedBoard,
        title: title.trim(),
        content: content.trim(),
        status: "published",
      };
      if (isStaff) {
        payload.is_urgent = isUrgent;
        payload.is_pinned = isPinned;
      }
      const r = await api.post("/community/posts/", payload as object, { } as ApiRequestConfig);
      const created = r.data as { id: number };
      // 첨부 이미지가 있으면 multipart로 업로드(글 등록 직후). 부분 실패 시 안내만, 글 자체는 유지.
      if (files.length > 0) {
        try {
          const form = new FormData();
          files.forEach((f) => form.append("files", f));
          await api.post(`/community/posts/${created.id}/attachments/`, form, {
            headers: { "Content-Type": "multipart/form-data" },
          } as ApiRequestConfig);
        } catch {
          alert("글은 등록되었지만 첨부 일부가 실패했습니다. 글 상세에서 다시 확인해 주세요.");
        }
      }
      navigate(`/landing/community/${selectedBoard}/posts/${created.id}`);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string | string[] } } })?.response?.data?.detail;
      setErr(Array.isArray(detail) ? detail[0] : (typeof detail === "string" ? detail : "글 등록 실패. 잠시 후 다시 시도해주세요."));
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={NAV_TOKENS} brandMark={<BrandMark name={cfg.brand_name} />} />

      <section style={{ padding: "40px 24px 24px", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Community · 글쓰기
          </div>
          <h1 style={{ fontSize: "clamp(22px, 2.6vw, 30px)", fontWeight: 800, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.3 }}>
            새 글 쓰기
          </h1>
        </div>
      </section>

      <section style={{ padding: "32px 24px 64px", background: bgAlt, minHeight: "60vh" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {block ? (
            <div style={{ padding: "48px 24px", borderRadius: 14, background: cardBg, border: `1px solid ${border}`, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.9 }}>🔒</div>
              <p style={{ fontSize: 15.5, fontWeight: 700, margin: "0 0 18px", letterSpacing: "-0.01em" }}>{block.reason}</p>
              <Link to={block.cta.to} style={{ padding: "10px 22px", borderRadius: 999, background: gold, color: "#0A0E1A", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
                {block.cta.label} →
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 게시판 선택 */}
              <Field label="게시판" textSecondary={textSecondary}>
                <select
                  value={selectedBoard}
                  onChange={(e) => setSelectedBoard(e.target.value as BoardType)}
                  disabled={submitting}
                  data-testid="landing-community-write-board-select"
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: 10,
                    border: `1px solid ${border}`, background: cardBg,
                    color: textPrimary, fontSize: 14, fontFamily: "inherit", outline: "none",
                  }}
                >
                  {allowedBoards.map((b) => (
                    <option key={b} value={b} style={{ background: "#0A0E1A", color: textPrimary }}>{BOARD_LABEL[b]}</option>
                  ))}
                </select>
                {!isStaff ? (
                  <p style={{ marginTop: 6, fontSize: 12, color: textMuted, lineHeight: 1.5 }}>
                    공지/자료실 작성은 강사·운영진만 가능합니다.
                  </p>
                ) : (
                  <p style={{ marginTop: 6, fontSize: 12, color: textMuted, lineHeight: 1.5 }}>
                    질문게시판(QnA)은 학생이 질문하고 강사가 답변하는 구조입니다. 강사·운영진은 학생 글에 답변으로 응대해 주세요.
                  </p>
                )}
              </Field>

              {/* 제목 */}
              <Field label="제목" textSecondary={textSecondary} required>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  maxLength={200}
                  placeholder="제목을 입력하세요"
                  data-testid="landing-community-write-title"
                  required
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: 10,
                    border: `1px solid ${border}`, background: cardBg,
                    color: textPrimary, fontSize: 15, fontFamily: "inherit", outline: "none",
                  }}
                />
              </Field>

              {/* 내용 */}
              <Field label="내용" textSecondary={textSecondary} required>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={submitting}
                  rows={12}
                  maxLength={20000}
                  placeholder="본문 내용을 입력하세요. 줄바꿈은 그대로 표시됩니다."
                  data-testid="landing-community-write-content"
                  required
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    border: `1px solid ${border}`, background: cardBg,
                    color: textPrimary, fontSize: 14.5, fontFamily: "inherit", outline: "none",
                    resize: "vertical", lineHeight: 1.7,
                  }}
                />
              </Field>

              {/* 이미지 첨부 (P3) — 최대 5장, 각 5MB. backend validation 따름. */}
              <Field label="이미지 첨부 (선택)" textSecondary={textSecondary}>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={submitting}
                  data-testid="landing-community-write-files"
                  onChange={(e) => {
                    const list = Array.from(e.target.files || []).slice(0, 5);
                    setFiles(list);
                  }}
                  style={{ fontSize: 13, color: textSecondary }}
                />
                {files.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {files.map((f, i) => (
                      <span key={i} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, background: cardBg, border: `1px solid ${border}`, color: textPrimary }}>
                        {f.name}
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ marginTop: 6, fontSize: 11.5, color: textMuted, lineHeight: 1.5 }}>이미지만 업로드 가능합니다. 최대 5장, 한 장 5MB 이내.</p>
              </Field>

              {/* 학원장 옵션 */}
              {isStaff && (
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: textPrimary, cursor: "pointer" }}>
                    <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} disabled={submitting} />
                    상단 고정
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: textPrimary, cursor: "pointer" }}>
                    <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} disabled={submitting} />
                    중요 표시
                  </label>
                </div>
              )}

              {err && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "#fca5a5", fontSize: 13, fontWeight: 500 }}>{err}</div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                <button type="button" onClick={() => navigate(`/landing/community/${initialBoard}`)} disabled={submitting}
                  style={{ padding: "11px 22px", borderRadius: 10, background: "transparent", border: `1px solid ${border}`, color: textSecondary, fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}
                >취소</button>
                <button type="submit" disabled={submitting || !title.trim() || !content.trim()}
                  data-testid="landing-community-write-submit"
                  style={{
                    padding: "11px 26px", borderRadius: 10, border: "none",
                    background: (submitting || !title.trim() || !content.trim()) ? "rgba(255,255,255,0.08)" : gold,
                    color: (submitting || !title.trim() || !content.trim()) ? textMuted : "#0A0E1A",
                    fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em",
                    cursor: (submitting || !title.trim() || !content.trim()) ? "not-allowed" : "pointer",
                  }}
                >{submitting ? "등록 중..." : "글 등록"}</button>
              </div>
            </form>
          )}
        </div>
      </section>

      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}

function Field({ label, required, textSecondary, children }: { label: string; required?: boolean; textSecondary: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: textSecondary, marginBottom: 7, letterSpacing: "0.02em" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
      </div>
      {children}
    </label>
  );
}

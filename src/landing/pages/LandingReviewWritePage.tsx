// PATH: src/landing/pages/LandingReviewWritePage.tsx
// 수강후기 작성 — 학생/학부모만 가능. 평점★ + 학년 + 과목 + 수강기간 + 본문 + 사진.
// 등록 후 status=pending → 학원장 승인 후 외부 공개.
/* eslint-disable no-restricted-syntax */

import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import useAuth from "@/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { fetchLandingPublic } from "../api";
import { createReview } from "../api/publicCommunity";
import { usePublicPhotoDraft } from "../hooks/usePublicPhotoDraft";
import { PublicPhotoPicker } from "../components/PublicPhotos";
import type { LandingConfig, LandingPublicResponse } from "../types";
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

const GRADE_OPTIONS = ["초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3", "N수", "기타"];

function BrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800 }}>{initial}</div>
  );
}

export default function LandingReviewWritePage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();

  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [months, setMonths] = useState(0);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const photoDraft = usePublicPhotoDraft();
  const submitLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);

  // useAuth hydrate race 방어 — 토큰이 있어도 /core/me 완료 전에는 user=null일 수 있다.
  if (authLoading) return <CenterSpin />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // staff(owner/admin/staff/teacher) 자작 차단 — backend에서도 막지만 UI에서 명시
  if (!["student", "parent"].includes(role) && !u?.is_superuser) {
    return (
      <Shell cfg={landing?.config}>
        <Refuse title="학원 운영자는 수강 후기를 작성할 수 없습니다" body="후기는 학원에 등록된 학생·학부모의 진솔한 의견을 받기 위한 공간입니다." />
      </Shell>
    );
  }

  const valid = rating >= 1 && rating <= 5 && content.trim().length >= 10;

  const onSubmit = async () => {
    if (!valid || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const photos = await photoDraft.upload();
      const created = await createReview({
        rating,
        title: title.trim(),
        content: content.trim(),
        grade: grade.trim(),
        subject: subject.trim(),
        enrollment_months: months,
        is_anonymous: isAnonymous,
        photos: photos.length > 0 ? photos : undefined,
      });
      navigate(`/landing/reviews/${created.id}`, { replace: true });
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, "후기 등록 실패. 잠시 후 다시 시도해주세요."));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (!landing?.config) {
    return <CenterSpin />;
  }

  const border = "rgba(255,255,255,0.08)";
  const cardBg = "rgba(255,255,255,0.03)";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";
  const gold = "#D4A04C";

  return (
    <Shell cfg={landing.config}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 20 }}>
          <Link to="/landing/reviews" data-testid="review-write-back"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: textSecondary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="15,18 9,12 15,6" /></svg>
            수강후기
          </Link>
        </div>

        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: textPrimary, letterSpacing: "-0.025em" }}>수강 후기 남기기</h1>
        <p style={{ marginTop: 8, fontSize: 13, color: textSecondary, lineHeight: 1.6 }}>
          작성 후 학원장 승인을 거쳐 외부에 공개됩니다. 학년·과목·수강 기간은 외부 학부모의 신뢰 신호로 활용됩니다.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 18 }}
        >
          <fieldset disabled={submitting} style={{ display: "contents" }}>
          {/* 평점 */}
          <div>
            <label style={lblStyle(textSecondary)}>평점</label>
            <StarPicker value={rating} onChange={setRating} gold={gold} />
          </div>

          {/* 제목 (옵션) */}
          <div>
            <label style={lblStyle(textSecondary)}>제목 (선택)</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              data-testid="review-write-title" maxLength={200}
              placeholder="예: 6개월간 통합과학 수강 후기"
              style={inputStyle(border, cardBg, textPrimary)}
            />
          </div>

          {/* 학년 / 과목 / 수강기간 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={lblStyle(textSecondary)}>학년</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} data-testid="review-write-grade"
                style={selStyle(border, cardBg, textPrimary)}
              >
                <option value="">선택 안함</option>
                {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={lblStyle(textSecondary)}>과목</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                data-testid="review-write-subject" maxLength={40}
                placeholder="예: 통합과학"
                style={inputStyle(border, cardBg, textPrimary)}
              />
            </div>
            <div>
              <label style={lblStyle(textSecondary)}>수강 개월</label>
              <input type="number" value={months || ""} onChange={(e) => setMonths(Math.max(0, Number(e.target.value) || 0))}
                data-testid="review-write-months" min={0} max={120}
                placeholder="예: 6"
                style={inputStyle(border, cardBg, textPrimary)}
              />
            </div>
          </div>

          {/* 본문 */}
          <div>
            <label style={lblStyle(textSecondary)}>후기 본문 *</label>
            <textarea
              value={content} onChange={(e) => setContent(e.target.value)}
              data-testid="review-write-content"
              placeholder="수업·관리·결과 등 직접 경험한 내용을 진솔하게 적어주세요 (최소 10자)"
              rows={8}
              style={{ ...inputStyle(border, cardBg, textPrimary), resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
            />
            <p style={{ marginTop: 6, fontSize: 11, color: textSecondary }}>현재 {content.trim().length}자 / 최소 10자</p>
          </div>

          <div data-testid="review-write-photos"><PublicPhotoPicker draft={photoDraft} disabled={submitting} /></div>

          <label data-testid="review-write-anonymous" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: textSecondary }}>
            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: gold }}
            />
            <span>익명으로 등록</span>
          </label>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ padding: "12px 14px", borderRadius: 10, background: `${gold}1A`, border: `1px solid ${gold}55`, fontSize: 12.5, color: textPrimary, lineHeight: 1.6 }}>
            ℹ 작성 후 학원장이 검토하고 승인합니다. 승인되면 외부 학부모도 볼 수 있는 공개 후기에 노출됩니다.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => navigate(-1)}
              style={{ padding: "11px 22px", borderRadius: 999, border: `1px solid ${border}`, background: "transparent", color: textSecondary, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >취소</button>
            <button type="submit" disabled={!valid || submitting} data-testid="review-write-submit"
              style={{
                padding: "11px 22px", borderRadius: 999, border: "none",
                background: valid && !submitting ? gold : "rgba(255,255,255,0.08)",
                color: valid && !submitting ? "#0A0E1A" : textSecondary,
                fontSize: 14, fontWeight: 700, cursor: valid && !submitting ? "pointer" : "not-allowed",
                letterSpacing: "-0.01em",
              }}
            >{submitting ? "등록 중…" : "후기 등록"}</button>
          </div>
          </fieldset>
        </form>
      </div>
    </Shell>
  );

  function CenterSpin() {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }
}

function StarPicker({ value, onChange, gold }: { value: number; onChange: (n: number) => void; gold: string }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div data-testid="review-write-rating" style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          data-testid={`review-write-star-${n}`}
          style={{
            background: "transparent", border: "none", padding: 0, cursor: "pointer",
            fontSize: 32, lineHeight: 1, color: n <= display ? gold : "rgba(140,140,140,0.4)",
          }}
        >★</button>
      ))}
      <span style={{ marginLeft: 8, fontSize: 14, color: "#F5F1E8", fontWeight: 700 }}>{display} / 5</span>
    </div>
  );
}

function Shell({ cfg, children }: { cfg?: LandingConfig; children: React.ReactNode }) {
  if (!cfg) return <>{children}</>;
  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", color: "#F5F1E8", fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={NAV_TOKENS} brandMark={<BrandMark name={cfg.brand_name} />} />
      {children}
      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}

function Refuse({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "100px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 42, marginBottom: 14 }}>🙅</div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#F5F1E8", letterSpacing: "-0.02em" }}>{title}</h1>
      <p style={{ marginTop: 10, fontSize: 14, color: "#9CA3AF", lineHeight: 1.6 }}>{body}</p>
      <Link to="/landing/reviews" style={{ display: "inline-block", marginTop: 22, padding: "11px 22px", borderRadius: 999, background: "#D4A04C", color: "#0A0E1A", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>수강후기로 →</Link>
    </div>
  );
}

function lblStyle(color: string): React.CSSProperties {
  return {
    display: "block", fontSize: 12, fontWeight: 700,
    color, marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase",
  };
}

function inputStyle(border: string, bg: string, color: string): React.CSSProperties {
  return {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    background: bg, border: `1px solid ${border}`,
    color, fontSize: 14, fontFamily: "inherit", outline: "none", letterSpacing: "-0.01em",
    boxSizing: "border-box",
  };
}

function selStyle(border: string, bg: string, color: string): React.CSSProperties {
  return { ...inputStyle(border, bg, color), cursor: "pointer" };
}

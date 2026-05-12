// PATH: src/landing/components/LandingInlineEditorFab.tsx
// 학원장(owner/admin) 시점 우상단 톱니바퀴 — 랜딩 페이지 inline editor 진입 (#F1, 2026-05-12).
//
// 학원장 spec: "로그인 계정이 대표 계정이라면. 랜딩페이지내에서 수정하기 버튼 내지 우상단
// 톱니바퀴 버튼 노출 등으로. 시각적으로 보면서 직관적으로 수정 할수있게."
//
// - owner / admin / superuser 만 노출.
// - 클릭 → 우측 drawer slide-in.
// - drawer 내 입력 → PublicLandingPage state 즉시 갱신 → Template re-render WYSIWYG.
// - "저장 + 게시" → backend PUT /core/landing/admin/ (draft) + POST /core/landing/publish/.
//
// 비로그인 외부인 / 학생 / 학부모에겐 안 보임 — 시각 노이즈 0.
/* eslint-disable no-restricted-syntax */

import { useEffect, useRef, useState } from "react";
import useAuth from "@/auth/hooks/useAuth";
import api from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";
import type { LandingConfig } from "../types";
import { uploadLandingHeroSlot, uploadLandingImage } from "../api";

interface Props {
  /** PublicLandingPage가 hold하는 config — drawer 입력 즉시 setState 호출. */
  config: LandingConfig;
  /** drawer 입력 시 호출. live preview용 partial merge. */
  onConfigPreview: (partial: Partial<LandingConfig>) => void;
}

const TEMPLATES: Array<{ key: string; label: string; tone: string }> = [
  { key: "minimal_tutor", label: "미니멀", tone: "밝고 깔끔, 가독성" },
  { key: "premium_dark", label: "프리미엄 다크", tone: "검정 + 골드, 신뢰 + 스튜디오" },
  { key: "academic_trust", label: "성적/관리", tone: "체계 + 신뢰" },
  { key: "program_promo", label: "프로그램 홍보", tone: "활기 + CTA" },
];

export default function LandingInlineEditorFab({ config, onConfigPreview }: Props) {
  const { user } = useAuth();
  const isOwner = !!(user?.is_superuser || user?.tenantRole === "owner" || user?.tenantRole === "admin");
  const [open, setOpen] = useState(false);

  // ESC 키 + body scroll lock (drawer 패턴)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!isOwner) return null;

  return (
    <>
      {/* 우상단 톱니바퀴 — fixed top-right, NavBar 우측 영역 침범 안 하도록 top:80 (NavBar 64 아래 16 buffer) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="페이지 편집 (학원장)"
        title="페이지 편집 (학원장 전용)"
        data-testid="landing-inline-editor-fab"
        style={{
          position: "fixed", top: 80, right: 20, zIndex: 40,
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
          border: "1px solid rgba(212,160,76,0.5)",
          color: "#D4A04C", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 10px 28px rgba(0,0,0,0.32), 0 0 0 1px rgba(212,160,76,0.15)",
          transition: "transform 0.18s, box-shadow 0.18s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <EditorDrawer
          config={config}
          onClose={() => setOpen(false)}
          onConfigPreview={onConfigPreview}
        />
      )}
    </>
  );
}

function EditorDrawer({ config, onClose, onConfigPreview }: {
  config: LandingConfig;
  onClose: () => void;
  onConfigPreview: (partial: Partial<LandingConfig>) => void;
}) {
  // local form state — config 변경 시 onConfigPreview로 live preview 호출.
  const [brandName, setBrandName] = useState(config.brand_name || "");
  const [tagline, setTagline] = useState(config.tagline || "");
  const [subtitle, setSubtitle] = useState(config.subtitle || "");
  const [primaryColor, setPrimaryColor] = useState(config.primary_color || "#1E3A5F");
  const [templateKey, setTemplateKey] = useState((config as LandingConfig & { template_key?: string }).template_key || "minimal_tutor");
  const [ctaText, setCtaText] = useState(config.cta_text || "");
  const [ctaLink, setCtaLink] = useState(config.cta_link || "");
  // 히어로 이미지 슬라이드 — backend에서 hero_slot 업로드 시 url이 presigned로 반환됨.
  // hero_images 빈 배열이면 hero_image_url을 첫 슬롯으로 fallback (legacy 호환).
  const initialHeroSlides = (config.hero_images && config.hero_images.length > 0)
    ? config.hero_images
    : (config.hero_image_url ? [config.hero_image_url] : []);
  const [heroSlides, setHeroSlides] = useState<string[]>(initialHeroSlides);
  const [logoUrl, setLogoUrl] = useState(config.logo_url || "");
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const slotFileInputs = useRef<Array<HTMLInputElement | null>>([]);
  const logoFileInput = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);

  // input 변경 시 즉시 live preview (publish 안 함, state만).
  const preview = (partial: Partial<LandingConfig>) => onConfigPreview(partial);

  const handleSlotFile = async (slot: number, file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { feedback.error("5MB 이하 이미지만 업로드 가능합니다."); return; }
    if (!file.type.startsWith("image/")) { feedback.error("이미지 파일만 가능합니다."); return; }
    setUploadingSlot(slot);
    try {
      const res = await uploadLandingHeroSlot(file, slot);
      // backend가 draft.hero_images[slot]에 R2 key를 set + presigned URL 반환.
      setHeroSlides((prev) => {
        const next = [...prev];
        while (next.length <= slot) next.push("");
        next[slot] = res.url;
        const filtered = next.filter(Boolean);
        preview({ hero_images: filtered });
        return next;
      });
      feedback.success(`히어로 이미지 ${slot + 1}번 업로드 완료`);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      feedback.error(typeof detail === "string" ? detail : "업로드 실패");
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleRemoveSlot = (slot: number) => {
    setHeroSlides((prev) => {
      const next = prev.filter((_, i) => i !== slot);
      preview({ hero_images: next.filter(Boolean) });
      return next;
    });
  };

  const handleLogoFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { feedback.error("5MB 이하 이미지만 업로드 가능합니다."); return; }
    if (!file.type.startsWith("image/")) { feedback.error("이미지 파일만 가능합니다."); return; }
    setUploadingLogo(true);
    try {
      const res = await uploadLandingImage(file, "logo");
      setLogoUrl(res.url);
      preview({ logo_url: res.url });
      feedback.success("로고 업로드 완료");
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      feedback.error(typeof detail === "string" ? detail : "업로드 실패");
    } finally {
      setUploadingLogo(false);
    }
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // GET 현재 draft → merge → PUT.
      const res = await api.get<{ draft_config: LandingConfig }>("/core/landing/admin/");
      const draft = res.data?.draft_config || {};
      const next: LandingConfig = {
        ...draft,
        brand_name: brandName.trim() || draft.brand_name,
        tagline: tagline.trim() || draft.tagline,
        subtitle: subtitle.trim() || draft.subtitle,
        primary_color: primaryColor,
        cta_text: ctaText.trim() || draft.cta_text,
        cta_link: ctaLink.trim() || draft.cta_link,
        // hero_images / logo_url은 업로드 시점에 backend가 이미 draft에 직접 set한 R2 key를
        // 유지해야 함 — preview URL(presigned)을 그대로 PUT하면 R2 key가 사라지므로
        // backend가 set한 draft.hero_images / draft.logo_url을 신뢰해서 유지.
        // 사용자가 슬롯을 삭제했다면 client state에 반영된 길이만큼 자름.
        hero_images: heroSlides.filter(Boolean).length === 0
          ? []
          : (draft.hero_images && draft.hero_images.length > 0
            ? draft.hero_images.slice(0, heroSlides.filter(Boolean).length)
            : draft.hero_images || []),
        logo_url: logoUrl ? (draft.logo_url || logoUrl) : "",
      };
      // template_key는 LandingPublicResponse top-level이라 admin payload에 별도 key.
      await api.put("/core/landing/admin/", { draft_config: next, template_key: templateKey });
      await api.post("/core/landing/publish/");
      feedback.success("홈페이지에 반영되었습니다.");
      // 게시 후 페이지 reload — 후속 진입자에게 즉시 반영.
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      feedback.error(typeof detail === "string" ? detail : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const cardBorder = "rgba(255,255,255,0.08)";
  const inputBg = "rgba(255,255,255,0.04)";
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 6px" };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    background: inputBg, border: `1px solid ${cardBorder}`,
    color: "#F5F1E8", fontSize: 14, outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 110,
        background: "rgba(8,12,22,0.6)", backdropFilter: "blur(6px)",
        animation: "landingEditorFade 0.18s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="페이지 편집"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(420px, 90vw)",
          background: "#0F1525", borderLeft: `1px solid ${cardBorder}`,
          padding: 24, overflowY: "auto",
          color: "#F5F1E8",
          fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
          animation: "landingEditorSlideIn 0.22s cubic-bezier(.2,.7,.2,1)",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
        }}
      >
        <style>{`
          @keyframes landingEditorFade { from { opacity: 0 } to { opacity: 1 } }
          @keyframes landingEditorSlideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
        `}</style>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${cardBorder}` }}>
          <div>
            <div style={{ fontSize: 11, color: "#D4A04C", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Owner Console</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>페이지 편집</h2>
          </div>
          <button
            type="button" onClick={onClose} aria-label="닫기"
            style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: `1px solid ${cardBorder}`, color: "#9CA3AF", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></svg>
          </button>
        </div>

        {/* Section: 브랜드 */}
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.01em" }}>브랜드</h3>
          <p style={labelStyle}>학원 이름</p>
          <input type="text" value={brandName} onChange={(e) => { setBrandName(e.target.value); preview({ brand_name: e.target.value }); }} style={{ ...inputStyle, marginBottom: 12 }} />
          <p style={labelStyle}>대표 색상</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <input type="color" value={primaryColor} onChange={(e) => { setPrimaryColor(e.target.value); preview({ primary_color: e.target.value }); }} style={{ width: 56, height: 36, borderRadius: 6, border: `1px solid ${cardBorder}`, background: "transparent", cursor: "pointer" }} />
            <input type="text" value={primaryColor} onChange={(e) => { setPrimaryColor(e.target.value); preview({ primary_color: e.target.value }); }} style={{ ...inputStyle, fontFamily: "monospace" }} />
          </div>
        </section>

        {/* Section: 히어로 */}
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.01em" }}>대문 (히어로)</h3>
          <p style={labelStyle}>슬로건 (한 줄)</p>
          <input type="text" value={tagline} onChange={(e) => { setTagline(e.target.value); preview({ tagline: e.target.value }); }} placeholder="예: 과학은 철두철미하게" style={{ ...inputStyle, marginBottom: 12 }} />
          <p style={labelStyle}>부제 / 설명</p>
          <textarea value={subtitle} onChange={(e) => { setSubtitle(e.target.value); preview({ subtitle: e.target.value }); }} placeholder="예: 결과는 철옹성처럼" rows={3} style={{ ...inputStyle, resize: "vertical", marginBottom: 12 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <p style={labelStyle}>CTA 버튼 텍스트</p>
              <input type="text" value={ctaText} onChange={(e) => { setCtaText(e.target.value); preview({ cta_text: e.target.value }); }} placeholder="예: 수강 문의" style={inputStyle} />
            </div>
            <div>
              <p style={labelStyle}>CTA 링크</p>
              <input type="text" value={ctaLink} onChange={(e) => { setCtaLink(e.target.value); preview({ cta_link: e.target.value }); }} placeholder="/login" style={inputStyle} />
            </div>
          </div>
        </section>

        {/* Section: 히어로 이미지 슬라이드 */}
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>히어로 이미지</h3>
          <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 12px", lineHeight: 1.5 }}>
            1장이면 정적, 2장 이상이면 자동 슬라이드(5초). 최대 6장.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {Array.from({ length: 6 }).map((_, slot) => {
              const url = heroSlides[slot] || "";
              const isUploading = uploadingSlot === slot;
              return (
                <div
                  key={slot}
                  style={{
                    position: "relative",
                    aspectRatio: "4/3",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: url ? "transparent" : inputBg,
                    border: `1px dashed ${url ? "transparent" : cardBorder}`,
                  }}
                >
                  {url ? (
                    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{
                      position: "absolute", inset: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#6B7280", fontSize: 11, fontWeight: 600,
                    }}>{slot + 1}</div>
                  )}
                  {isUploading && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 600 }}>업로드…</div>
                  )}
                  <input
                    ref={(el) => { slotFileInputs.current[slot] = el; }}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={(e) => handleSlotFile(slot, e.target.files?.[0] || null)}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => slotFileInputs.current[slot]?.click()}
                    disabled={isUploading}
                    aria-label={`히어로 이미지 ${slot + 1} ${url ? "교체" : "업로드"}`}
                    style={{
                      position: "absolute", inset: 0,
                      background: "transparent", border: "none",
                      cursor: isUploading ? "wait" : "pointer",
                    }}
                  />
                  {url && !isUploading && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveSlot(slot); }}
                      aria-label="이미지 삭제"
                      title="이미지 삭제"
                      style={{
                        position: "absolute", top: 4, right: 4,
                        width: 22, height: 22, borderRadius: "50%",
                        background: "rgba(0,0,0,0.65)", border: "none",
                        color: "#fff", fontSize: 12, fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}
                    >×</button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section: 로고 */}
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em" }}>로고</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 12,
              background: inputBg, border: `1px solid ${cardBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {logoUrl ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 10, color: "#6B7280" }}>없음</span>}
            </div>
            <input
              ref={logoFileInput}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              onChange={(e) => handleLogoFile(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => logoFileInput.current?.click()}
              disabled={uploadingLogo}
              style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${cardBorder}`, background: inputBg, color: "#F5F1E8", fontSize: 13, fontWeight: 600, cursor: uploadingLogo ? "wait" : "pointer" }}
            >{uploadingLogo ? "업로드…" : (logoUrl ? "로고 교체" : "로고 업로드")}</button>
          </div>
        </section>

        {/* Section: 템플릿 */}
        <section style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.01em" }}>템플릿</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {TEMPLATES.map((t) => (
              <label
                key={t.key}
                style={{
                  padding: "12px 10px", borderRadius: 8, cursor: "pointer",
                  background: templateKey === t.key ? "rgba(212,160,76,0.12)" : inputBg,
                  border: `1px solid ${templateKey === t.key ? "rgba(212,160,76,0.5)" : cardBorder}`,
                  display: "flex", flexDirection: "column", gap: 4,
                }}
              >
                <input type="radio" name="tpl" checked={templateKey === t.key} onChange={() => setTemplateKey(t.key)} style={{ display: "none" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: templateKey === t.key ? "#D4A04C" : "#F5F1E8" }}>{t.label}</span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{t.tone}</span>
              </label>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#9CA3AF", margin: "8px 0 0", lineHeight: 1.5 }}>
            템플릿 변경은 저장 후 페이지 새로고침 시 적용됩니다.
          </p>
        </section>

        {/* 게시 버튼 */}
        <div style={{ display: "flex", gap: 8, paddingTop: 16, borderTop: `1px solid ${cardBorder}` }}>
          <button
            type="button" onClick={onClose} disabled={saving}
            style={{ flex: 1, padding: "12px 18px", background: "transparent", color: "#9CA3AF", border: `1px solid ${cardBorder}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >취소</button>
          <button
            type="button" onClick={onSave} disabled={saving}
            data-testid="landing-inline-editor-save"
            style={{
              flex: 1.5, padding: "12px 18px",
              background: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
              color: "#0A0E1A", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
              boxShadow: "0 8px 22px rgba(212,160,76,0.32)",
            }}
          >
            {saving ? "게시 중..." : "저장 + 게시"}
          </button>
        </div>

        {/* 안내 */}
        <p style={{ fontSize: 11, color: "#6B7280", margin: "16px 0 0", lineHeight: 1.6 }}>
          입력하면 즉시 미리보기에 반영됩니다. "저장 + 게시" 누르면 실제 학원 홈페이지에 적용됩니다.<br />
          더 자세한 편집(섹션 ON/OFF, 강사 카드, 후기 등)은 <a href="/admin/settings/landing" style={{ color: "#D4A04C" }}>관리실 → 홈페이지 편집</a>으로.
        </p>
      </div>
    </div>
  );
}

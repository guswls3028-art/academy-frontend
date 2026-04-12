// PATH: src/app_admin/domains/landing/editor/LandingEditorPage.tsx
// 설정 > 랜딩페이지 꾸미기. 구조화된 편집 + 실시간 미리보기.

import { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchLandingAdmin,
  updateLandingDraft,
  publishLanding,
  unpublishLanding,
  uploadLandingImage,
  fetchLandingTemplates,
} from "../api";
import type {
  LandingAdminResponse,
  LandingConfig,
  TemplateKey,
  TemplateMeta,
  LandingSection,
  FeatureItem,
  TestimonialItem,
  ProgramItem,
  FaqItem,
} from "../types";
import { ALLOWED_COLORS } from "../types";
import { getTemplateComponent } from "../templates";

type ViewMode = "edit" | "preview";
type PreviewDevice = "desktop" | "tablet" | "mobile";

const SECTION_LABELS: Record<string, string> = {
  hero: "히어로 (메인 배너)",
  features: "특징 소개",
  about: "소개",
  testimonials: "수강생 후기",
  programs: "프로그램 안내",
  faq: "자주 묻는 질문",
  contact: "문의 정보",
  notice: "공지/안내",
};

const ICON_OPTIONS = ["book", "chart", "users", "star", "shield", "clock", "check", "heart", "target", "award"];

export default function LandingEditorPage() {
  const [landing, setLanding] = useState<LandingAdminResponse | null>(null);
  const [draft, setDraft] = useState<LandingConfig | null>(null);
  const [templateKey, setTemplateKey] = useState<TemplateKey>("minimal_tutor");
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [activeSection, setActiveSection] = useState<string>("brand");
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    Promise.all([fetchLandingAdmin(), fetchLandingTemplates()])
      .then(([adminData, tpls]) => {
        if (!mountedRef.current) return;
        setLanding(adminData);
        setDraft(adminData.draft_config);
        setTemplateKey(adminData.template_key);
        setTemplates(tpls);
        setLoading(false);
      })
      .catch(() => { if (mountedRef.current) { setLoading(false); setLoadError(true); } });
    return () => { mountedRef.current = false; };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { if (mountedRef.current) setToast(null); }, 2500);
  };

  const updateDraft = useCallback((updater: (prev: LandingConfig) => LandingConfig) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      setDirty(true);
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await updateLandingDraft({ template_key: templateKey, draft_config: draft });
      setLanding((prev) => prev ? { ...prev, ...res } : prev);
      setDirty(false);
      showToast("저장되었습니다");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      showToast(Array.isArray(detail) ? detail[0] : (typeof detail === "string" ? detail : "저장 실패"));
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (saving) return; // save 진행 중이면 무시
    if (dirty) await handleSave();
    setPublishing(true);
    try {
      await publishLanding();
      setLanding((prev) => prev ? { ...prev, is_published: true } : prev);
      showToast("게시되었습니다");
    } catch {
      showToast("게시 실패");
    }
    setPublishing(false);
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    try {
      await unpublishLanding();
      setLanding((prev) => prev ? { ...prev, is_published: false } : prev);
      showToast("게시가 중단되었습니다");
    } catch {
      showToast("게시 중단 실패");
    }
    setPublishing(false);
  };

  const handleImageUpload = async (field: "hero" | "logo") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast("5MB 이하만 가능합니다"); return; }
      try {
        const res = await uploadLandingImage(file, field);
        updateDraft((prev) => ({
          ...prev,
          [field === "hero" ? "hero_image_url" : "logo_url"]: res.url,
        }));
        showToast("이미지 업로드 완료");
      } catch {
        showToast("이미지 업로드 실패");
      }
    };
    input.click();
  };

  if (loadError) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "#dc2626", fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>랜딩페이지 설정을 불러오지 못했습니다</p>
        <button onClick={() => { setLoadError(false); setLoading(true); window.location.reload(); }} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          다시 시도
        </button>
      </div>
    );
  }

  if (loading || !draft) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
        불러오는 중…
      </div>
    );
  }

  const sections = draft.sections || [];
  const Template = getTemplateComponent(templateKey);

  const previewWidths: Record<PreviewDevice, number | string> = {
    desktop: "100%",
    tablet: 768,
    mobile: 375,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 9999, padding: "10px 24px", background: "#1e293b", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
          {toast}
        </div>
      )}

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--color-border-divider, #e2e8f0)", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-text-primary, #1e293b)" }}>랜딩페이지 꾸미기</h1>
          {landing?.is_published ? (
            <span style={{ padding: "3px 10px", borderRadius: 99, background: "#dcfce7", color: "#16a34a", fontSize: 12, fontWeight: 600 }}>게시 중</span>
          ) : (
            <span style={{ padding: "3px 10px", borderRadius: 99, background: "#f1f5f9", color: "#64748b", fontSize: 12, fontWeight: 600 }}>미게시</span>
          )}
          {dirty && <span style={{ fontSize: 12, color: "#f59e0b" }}>변경사항 있음</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", borderRadius: 8, border: "1px solid var(--color-border-divider, #e2e8f0)", overflow: "hidden" }}>
            {(["edit", "preview"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding: "6px 14px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
                  background: viewMode === m ? "var(--color-primary, #2563EB)" : "transparent",
                  color: viewMode === m ? "#fff" : "var(--color-text-secondary, #64748b)",
                }}
              >
                {m === "edit" ? "편집" : "미리보기"}
              </button>
            ))}
          </div>
          <button onClick={handleSave} disabled={saving || !dirty} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid var(--color-border-divider, #e2e8f0)", background: "var(--color-bg-surface, #fff)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--color-text-primary, #1e293b)", opacity: dirty ? 1 : 0.5 }}>
            {saving ? "저장 중…" : "저장"}
          </button>
          {landing?.is_published ? (
            <button onClick={handleUnpublish} disabled={publishing} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#dc2626" }}>
              게시 중단
            </button>
          ) : (
            <button onClick={handlePublish} disabled={publishing || saving} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "var(--color-primary, #2563EB)", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", opacity: (publishing || saving) ? 0.6 : 1 }}>
              {publishing ? "게시 중…" : saving ? "저장 중…" : "게시하기"}
            </button>
          )}
        </div>
      </div>

      {/* Main */}
      {viewMode === "edit" ? (
        <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 0, marginTop: 16 }}>
          {/* Left panel - section nav (desktop) */}
          <div className="landing-editor-sidebar" style={{ width: 160, flexShrink: 0, borderRight: "1px solid var(--color-border-divider, #e2e8f0)", paddingRight: 12, overflowY: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <SectionNav id="brand" label="브랜드 설정" active={activeSection} onClick={setActiveSection} />
              <SectionNav id="template" label="템플릿 선택" active={activeSection} onClick={setActiveSection} />
              <SectionNav id="media" label="이미지" active={activeSection} onClick={setActiveSection} />
              <SectionNav id="cta" label="CTA 버튼" active={activeSection} onClick={setActiveSection} />
              <SectionNav id="contact" label="연락처" active={activeSection} onClick={setActiveSection} />
              <div style={{ margin: "8px 0", borderTop: "1px solid var(--color-border-divider, #e2e8f0)" }} />
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted, #94a3b8)", margin: "4px 0", padding: "0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>섹션</p>
              {[...sections].sort((a, b) => a.order - b.order).map((sec) => (
                <SectionNav key={sec.type} id={`sec-${sec.type}`} label={SECTION_LABELS[sec.type] || sec.type} active={activeSection} onClick={setActiveSection} badge={sec.enabled} />
              ))}
            </div>
          </div>

          {/* Mobile section selector (horizontal scroll) */}
          <style>{`
            @media (max-width: 768px) {
              .landing-editor-sidebar { display: none !important; }
              .landing-editor-mobile-tabs { display: flex !important; }
            }
            @media (min-width: 769px) {
              .landing-editor-mobile-tabs { display: none !important; }
            }
          `}</style>

          {/* Right panel - editor */}
          <div style={{ flex: 1, overflowY: "auto", paddingLeft: 24, paddingRight: 8, minWidth: 0 }}>
            {/* Mobile tabs */}
            <div className="landing-editor-mobile-tabs" style={{ display: "none", gap: 6, overflowX: "auto", paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid var(--color-border-divider, #e2e8f0)", marginLeft: -24, paddingLeft: 24 }}>
              {[
                { id: "brand", label: "브랜드" },
                { id: "template", label: "템플릿" },
                { id: "media", label: "이미지" },
                { id: "cta", label: "CTA" },
                { id: "contact", label: "연락처" },
                ...[...sections].sort((a, b) => a.order - b.order).map((s) => ({ id: `sec-${s.type}`, label: SECTION_LABELS[s.type]?.split(" ")[0] || s.type })),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  style={{
                    padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
                    border: activeSection === tab.id ? "1px solid var(--color-primary, #2563EB)" : "1px solid var(--color-border-divider, #e2e8f0)",
                    background: activeSection === tab.id ? "var(--color-primary, #2563EB)" : "transparent",
                    color: activeSection === tab.id ? "#fff" : "var(--color-text-secondary, #64748b)",
                    cursor: "pointer",
                  }}
                >{tab.label}</button>
              ))}
            </div>
            {activeSection === "brand" && <BrandEditor draft={draft} updateDraft={updateDraft} />}
            {activeSection === "template" && <TemplateSelector templates={templates} selected={templateKey} onSelect={(k) => { setTemplateKey(k); setDirty(true); }} />}
            {activeSection === "media" && <MediaEditor draft={draft} onUpload={handleImageUpload} updateDraft={updateDraft} />}
            {activeSection === "cta" && <CtaEditor draft={draft} updateDraft={updateDraft} />}
            {activeSection === "contact" && <ContactEditor draft={draft} updateDraft={updateDraft} />}
            {activeSection.startsWith("sec-") && (
              <SectionEditor
                sectionType={activeSection.replace("sec-", "")}
                sections={sections}
                updateDraft={updateDraft}
              />
            )}
          </div>
        </div>
      ) : (
        /* Preview mode */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", overflow: "auto", padding: "16px 0", background: "#f1f5f9" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["desktop", "tablet", "mobile"] as PreviewDevice[]).map((d) => (
              <button key={d} onClick={() => setPreviewDevice(d)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid", borderColor: previewDevice === d ? "var(--color-primary, #2563EB)" : "#e2e8f0", background: previewDevice === d ? "var(--color-primary, #2563EB)" : "#fff", color: previewDevice === d ? "#fff" : "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
                {d === "desktop" ? "데스크탑" : d === "tablet" ? "태블릿" : "모바일"}
              </button>
            ))}
          </div>
          <div style={{
            width: previewWidths[previewDevice],
            maxWidth: "100%",
            background: "#fff",
            borderRadius: previewDevice !== "desktop" ? 12 : 0,
            boxShadow: previewDevice !== "desktop" ? "0 4px 24px rgba(0,0,0,0.1)" : "none",
            overflow: "hidden",
            border: previewDevice !== "desktop" ? "1px solid #e2e8f0" : "none",
          }}>
            <Template config={draft} isPreview />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function SectionNav({ id, label, active, onClick, badge }: { id: string; label: string; active: string; onClick: (id: string) => void; badge?: boolean }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
        borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13,
        fontWeight: isActive ? 600 : 500, textAlign: "left", width: "100%",
        background: isActive ? "color-mix(in srgb, var(--color-primary, #2563EB) 9%, transparent)" : "transparent",
        color: isActive ? "var(--color-primary, #2563EB)" : "var(--color-text-secondary, #64748b)",
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge ? "#22c55e" : "#d1d5db" }} />
      )}
    </button>
  );
}

function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "var(--color-text-primary, #1e293b)" }}>{title}</h3>
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary, #64748b)", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, maxLength }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border-divider, #e2e8f0)", fontSize: 14, background: "var(--color-bg-surface, #fff)", color: "var(--color-text-primary, #1e293b)", outline: "none" }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border-divider, #e2e8f0)", fontSize: 14, background: "var(--color-bg-surface, #fff)", color: "var(--color-text-primary, #1e293b)", outline: "none", resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }}
    />
  );
}

// ─── Editor Panels ───

function BrandEditor({ draft, updateDraft }: { draft: LandingConfig; updateDraft: (fn: (p: LandingConfig) => LandingConfig) => void }) {
  return (
    <EditorSection title="브랜드 설정">
      <FieldRow label="브랜드명 (최대 50자)">
        <TextInput value={draft.brand_name} onChange={(v) => updateDraft((p) => ({ ...p, brand_name: v }))} placeholder="학원/교실 이름" maxLength={50} />
      </FieldRow>
      <FieldRow label="한 줄 소개 (최대 100자)">
        <TextInput value={draft.tagline} onChange={(v) => updateDraft((p) => ({ ...p, tagline: v }))} placeholder="체계적인 수학 교육의 시작" maxLength={100} />
      </FieldRow>
      <FieldRow label="보조 설명">
        <TextArea value={draft.subtitle} onChange={(v) => updateDraft((p) => ({ ...p, subtitle: v }))} placeholder="학원/교실의 특징이나 철학을 소개해주세요" rows={3} />
      </FieldRow>
      <FieldRow label="메인 컬러">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ALLOWED_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => updateDraft((p) => ({ ...p, primary_color: c.value }))}
              title={c.label}
              style={{
                width: 32, height: 32, borderRadius: 8, border: draft.primary_color === c.value ? "2px solid #1e293b" : "2px solid transparent",
                background: c.value, cursor: "pointer", outline: draft.primary_color === c.value ? "2px solid #fff" : "none",
                outlineOffset: -4,
              }}
            />
          ))}
        </div>
      </FieldRow>
    </EditorSection>
  );
}

function TemplateSelector({ templates, selected, onSelect }: { templates: TemplateMeta[]; selected: TemplateKey; onSelect: (k: TemplateKey) => void }) {
  return (
    <EditorSection title="템플릿 선택">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {templates.map((t) => (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            style={{
              padding: 20, borderRadius: 12, cursor: "pointer", textAlign: "left",
              border: selected === t.key ? `2px solid ${t.preview_color}` : "2px solid var(--color-border-divider, #e2e8f0)",
              background: selected === t.key ? `color-mix(in srgb, ${t.preview_color} 5%, var(--color-bg-surface, #fff))` : "var(--color-bg-surface, #fff)",
            }}
          >
            <div style={{ width: "100%", height: 6, borderRadius: 3, background: t.preview_color, marginBottom: 14 }} />
            <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: "var(--color-text-primary, #1e293b)" }}>{t.name}</p>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary, #94a3b8)", margin: "0 0 8px" }}>{t.mood}</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary, #64748b)", margin: 0, lineHeight: 1.5 }}>{t.description}</p>
          </button>
        ))}
      </div>
    </EditorSection>
  );
}

function MediaEditor({ draft, onUpload, updateDraft }: { draft: LandingConfig; onUpload: (f: "hero" | "logo") => void; updateDraft: (fn: (p: LandingConfig) => LandingConfig) => void }) {
  return (
    <EditorSection title="이미지">
      <FieldRow label="로고">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {draft.logo_url ? (
            <img src={draft.logo_url} alt="로고" style={{ height: 48, width: "auto", objectFit: "contain", borderRadius: 8, border: "1px solid var(--color-border-divider, #e2e8f0)" }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12 }}>없음</div>
          )}
          <button onClick={() => onUpload("logo")} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--color-border-divider, #e2e8f0)", background: "var(--color-bg-surface, #fff)", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--color-text-primary, #1e293b)" }}>
            {draft.logo_url ? "변경" : "업로드"}
          </button>
          {draft.logo_url && (
            <button onClick={() => updateDraft((p) => ({ ...p, logo_url: "" }))} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "#dc2626" }}>제거</button>
          )}
        </div>
      </FieldRow>
      <FieldRow label="히어로 이미지 (권장 1200×900)">
        <div>
          {draft.hero_image_url ? (
            <div style={{ marginBottom: 12 }}>
              <img src={draft.hero_image_url} alt="히어로" style={{ width: "100%", maxWidth: 360, borderRadius: 10, objectFit: "cover", aspectRatio: "4/3", border: "1px solid var(--color-border-divider, #e2e8f0)" }} />
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onUpload("hero")} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--color-border-divider, #e2e8f0)", background: "var(--color-bg-surface, #fff)", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--color-text-primary, #1e293b)" }}>
              {draft.hero_image_url ? "변경" : "업로드"}
            </button>
            {draft.hero_image_url && (
              <button onClick={() => updateDraft((p) => ({ ...p, hero_image_url: "" }))} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "#dc2626" }}>제거</button>
            )}
          </div>
        </div>
      </FieldRow>
      <p style={{ fontSize: 12, color: "var(--color-text-muted, #94a3b8)", margin: "8px 0 0" }}>이미지는 5MB 이하, JPG/PNG/WebP/GIF 가능</p>
    </EditorSection>
  );
}

function CtaEditor({ draft, updateDraft }: { draft: LandingConfig; updateDraft: (fn: (p: LandingConfig) => LandingConfig) => void }) {
  return (
    <EditorSection title="CTA 버튼">
      <FieldRow label="버튼 문구">
        <TextInput value={draft.cta_text} onChange={(v) => updateDraft((p) => ({ ...p, cta_text: v }))} placeholder="로그인" maxLength={20} />
      </FieldRow>
      <FieldRow label="버튼 링크">
        <TextInput value={draft.cta_link} onChange={(v) => updateDraft((p) => ({ ...p, cta_link: v }))} placeholder="/login" />
      </FieldRow>
      <p style={{ fontSize: 12, color: "var(--color-text-muted, #94a3b8)" }}>기본값: /login (로그인 페이지)</p>
    </EditorSection>
  );
}

function ContactEditor({ draft, updateDraft }: { draft: LandingConfig; updateDraft: (fn: (p: LandingConfig) => LandingConfig) => void }) {
  const contact = draft.contact || { phone: "", email: "", address: "" };
  const updateContact = (field: string, value: string) => {
    updateDraft((p) => ({ ...p, contact: { ...p.contact, [field]: value } }));
  };
  return (
    <EditorSection title="연락처 정보">
      <FieldRow label="전화번호">
        <TextInput value={contact.phone} onChange={(v) => updateContact("phone", v)} placeholder="02-1234-5678" />
      </FieldRow>
      <FieldRow label="이메일">
        <TextInput value={contact.email} onChange={(v) => updateContact("email", v)} placeholder="info@example.com" />
      </FieldRow>
      <FieldRow label="주소">
        <TextInput value={contact.address} onChange={(v) => updateContact("address", v)} placeholder="서울시 강남구..." />
      </FieldRow>
    </EditorSection>
  );
}

function SectionEditor({ sectionType, sections, updateDraft }: { sectionType: string; sections: LandingSection[]; updateDraft: (fn: (p: LandingConfig) => LandingConfig) => void }) {
  const section = sections.find((s) => s.type === sectionType);
  if (!section) return null;

  const updateSection = (updater: (s: LandingSection) => LandingSection) => {
    updateDraft((p) => ({
      ...p,
      sections: p.sections.map((s) => s.type === sectionType ? updater(s) : s),
    }));
  };

  const label = SECTION_LABELS[sectionType] || sectionType;

  return (
    <EditorSection title={label}>
      {/* Enable toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => updateSection((s) => ({ ...s, enabled: !s.enabled }))}
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative",
            background: section.enabled ? "var(--color-primary, #2563EB)" : "#d1d5db", transition: "background 0.15s",
          }}
        >
          <span style={{ position: "absolute", top: 2, left: section.enabled ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary, #1e293b)" }}>
          {section.enabled ? "표시" : "숨김"}
        </span>
      </div>

      {section.enabled && (
        <>
          {/* Title/Description for about, notice */}
          {(sectionType === "about" || sectionType === "notice") && (
            <>
              <FieldRow label="제목">
                <TextInput value={section.title || ""} onChange={(v) => updateSection((s) => ({ ...s, title: v }))} placeholder={sectionType === "about" ? "소개" : "공지"} />
              </FieldRow>
              <FieldRow label="내용">
                <TextArea value={section.description || ""} onChange={(v) => updateSection((s) => ({ ...s, description: v }))} placeholder="내용을 입력하세요" rows={4} />
              </FieldRow>
            </>
          )}

          {/* Items for features, testimonials, programs, faq */}
          {["features", "testimonials", "programs", "faq"].includes(sectionType) && (
            <ItemsEditor sectionType={sectionType} items={(section.items || []) as any[]} updateSection={updateSection} />
          )}
        </>
      )}

      {/* Order controls */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-border-divider, #e2e8f0)" }}>
        <p style={{ fontSize: 12, color: "var(--color-text-muted, #94a3b8)", margin: "0 0 8px" }}>순서: {section.order + 1}번째</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              updateDraft((p) => {
                const sorted = [...p.sections].sort((a, b) => a.order - b.order);
                const idx = sorted.findIndex((s) => s.type === sectionType);
                if (idx <= 0) return p;
                const newSections = sorted.map((s, i) => {
                  if (i === idx) return { ...s, order: idx - 1 };
                  if (i === idx - 1) return { ...s, order: idx };
                  return { ...s, order: i };
                });
                return { ...p, sections: newSections };
              });
            }}
            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-border-divider, #e2e8f0)", background: "var(--color-bg-surface, #fff)", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary, #64748b)" }}
          >
            ↑ 위로
          </button>
          <button
            onClick={() => {
              updateDraft((p) => {
                const sorted = [...p.sections].sort((a, b) => a.order - b.order);
                const idx = sorted.findIndex((s) => s.type === sectionType);
                if (idx >= sorted.length - 1) return p;
                const newSections = sorted.map((s, i) => {
                  if (i === idx) return { ...s, order: idx + 1 };
                  if (i === idx + 1) return { ...s, order: idx };
                  return { ...s, order: i };
                });
                return { ...p, sections: newSections };
              });
            }}
            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-border-divider, #e2e8f0)", background: "var(--color-bg-surface, #fff)", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary, #64748b)" }}
          >
            ↓ 아래로
          </button>
        </div>
      </div>
    </EditorSection>
  );
}

function ItemsEditor({ sectionType, items, updateSection }: { sectionType: string; items: any[]; updateSection: (fn: (s: LandingSection) => LandingSection) => void }) {
  const maxItems = 6;

  const updateItem = (idx: number, field: string, value: string) => {
    updateSection((s) => ({
      ...s,
      items: (s.items || []).map((item: any, i: number) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const addItem = () => {
    if (items.length >= maxItems) return;
    const newItem: any = sectionType === "features" ? { icon: "star", title: "", description: "" }
      : sectionType === "testimonials" ? { name: "", text: "", role: "" }
      : sectionType === "programs" ? { title: "", description: "", badge: "" }
      : { question: "", answer: "" };
    updateSection((s) => ({ ...s, items: [...(s.items || []), newItem] }));
  };

  const removeItem = (idx: number) => {
    updateSection((s) => ({ ...s, items: ((s.items || []) as any[]).filter((_: any, i: number) => i !== idx) }));
  };

  return (
    <div>
      {items.map((item, idx) => (
        <div key={idx} style={{ padding: 16, borderRadius: 10, border: "1px solid var(--color-border-divider, #e2e8f0)", marginBottom: 12, background: "var(--color-bg-surface, #fff)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted, #94a3b8)" }}>항목 {idx + 1}</span>
            <button onClick={() => removeItem(idx)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "#dc2626" }}>삭제</button>
          </div>

          {sectionType === "features" && (
            <>
              <FieldRow label="아이콘">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ICON_OPTIONS.map((icon) => (
                    <button key={icon} onClick={() => updateItem(idx, "icon", icon)} style={{
                      width: 32, height: 32, borderRadius: 6, border: (item as FeatureItem).icon === icon ? "2px solid var(--color-primary, #2563EB)" : "1px solid var(--color-border-divider, #e2e8f0)",
                      background: "var(--color-bg-surface, #fff)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-primary, #1e293b)",
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={
                          icon === "book" ? "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          : icon === "chart" ? "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6M15 19V9a2 2 0 012-2h2a2 2 0 012 2v10"
                          : icon === "users" ? "M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                          : icon === "star" ? "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                          : icon === "shield" ? "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                          : icon === "clock" ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          : icon === "check" ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          : icon === "heart" ? "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"
                          : icon === "target" ? "M22 12h-4M6 12H2M12 6V2M12 22v-4M12 12m-3 0a3 3 0 106 0 3 3 0 00-6 0"
                          : "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        } />
                      </svg>
                    </button>
                  ))}
                </div>
              </FieldRow>
              <FieldRow label="제목"><TextInput value={item.title} onChange={(v) => updateItem(idx, "title", v)} placeholder="특징 제목" /></FieldRow>
              <FieldRow label="설명"><TextInput value={item.description} onChange={(v) => updateItem(idx, "description", v)} placeholder="간단한 설명" /></FieldRow>
            </>
          )}

          {sectionType === "testimonials" && (
            <>
              <FieldRow label="이름"><TextInput value={item.name} onChange={(v) => updateItem(idx, "name", v)} placeholder="김OO" /></FieldRow>
              <FieldRow label="역할"><TextInput value={item.role} onChange={(v) => updateItem(idx, "role", v)} placeholder="중2 학부모" /></FieldRow>
              <FieldRow label="후기"><TextArea value={item.text} onChange={(v) => updateItem(idx, "text", v)} placeholder="후기 내용" rows={2} /></FieldRow>
            </>
          )}

          {sectionType === "programs" && (
            <>
              <FieldRow label="프로그램명"><TextInput value={item.title} onChange={(v) => updateItem(idx, "title", v)} placeholder="프로그램 이름" /></FieldRow>
              <FieldRow label="설명"><TextArea value={item.description} onChange={(v) => updateItem(idx, "description", v)} placeholder="프로그램 설명" rows={2} /></FieldRow>
              <FieldRow label="뱃지 (선택)"><TextInput value={item.badge || ""} onChange={(v) => updateItem(idx, "badge", v)} placeholder="인기" /></FieldRow>
            </>
          )}

          {sectionType === "faq" && (
            <>
              <FieldRow label="질문"><TextInput value={item.question} onChange={(v) => updateItem(idx, "question", v)} placeholder="자주 묻는 질문" /></FieldRow>
              <FieldRow label="답변"><TextArea value={item.answer} onChange={(v) => updateItem(idx, "answer", v)} placeholder="답변 내용" rows={2} /></FieldRow>
            </>
          )}
        </div>
      ))}

      {items.length < maxItems && (
        <button onClick={addItem} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px dashed var(--color-border-divider, #d1d5db)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary, #64748b)" }}>
          + 항목 추가 (최대 {maxItems}개)
        </button>
      )}
    </div>
  );
}

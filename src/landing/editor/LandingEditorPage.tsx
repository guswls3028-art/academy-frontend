// PATH: src/app_admin/domains/landing/editor/LandingEditorPage.tsx
// 설정 > 홈페이지 꾸미기. 구조화된 편집 + 실시간 미리보기.
//
// 학원장 어드민 편집기 — 동적 테넌트 색상 + 미리보기 격리 + 모달 등 inline style 핵심 도구.
// 도메인 전체 면제 (랜딩 템플릿/공개 페이지와 동일 사유).
/* eslint-disable no-restricted-syntax, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

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
  InstructorProfileItem,
} from "../types";
import { ALLOWED_COLORS, SECTION_META } from "../types";
import { getTemplateComponent } from "../templates";
import { SvgIcon } from "../templates/shared";

type ViewMode = "edit" | "preview";
type PreviewDevice = "desktop" | "tablet" | "mobile";

// SECTION_META(SSOT, types/index.ts)에서 라벨 조회. 별도 dict 유지 X.
const sectionLabel = (type: string): string =>
  (SECTION_META as Record<string, { label?: string }>)[type]?.label ?? type;

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
  const [activeSection, setActiveSection] = useState<string>("sections-grid");
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [uploadModalField, setUploadModalField] = useState<"hero" | "logo" | null>(null);
  const [editingSectionType, setEditingSectionType] = useState<string | null>(null);
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

  const handleImageUpload = (field: "hero" | "logo") => {
    // 모달 띄움 — 모달 안에서 file 선택 / 클립보드 paste / drop 모두 가능.
    setUploadModalField(field);
  };

  const handleModalUpload = async (file: File) => {
    if (!uploadModalField) return;
    if (file.size > 5 * 1024 * 1024) { showToast("5MB 이하만 가능합니다"); return; }
    try {
      const res = await uploadLandingImage(file, uploadModalField);
      const targetField = uploadModalField;
      updateDraft((prev) => ({
        ...prev,
        [targetField === "hero" ? "hero_image_url" : "logo_url"]: res.url,
      }));
      showToast("이미지 업로드 완료");
      setUploadModalField(null);
    } catch {
      showToast("이미지 업로드 실패");
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "#dc2626", fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>홈페이지 설정을 불러오지 못했습니다</p>
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
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-text-primary, #1e293b)" }}>홈페이지 꾸미기</h1>
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
          {/* Left panel - 카테고리 네비 (단순화) */}
          <div className="landing-editor-sidebar" style={{ width: 180, flexShrink: 0, borderRight: "1px solid var(--color-border-divider, #e2e8f0)", paddingRight: 12, overflowY: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted, #94a3b8)", margin: "4px 0", padding: "0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>기본 정보</p>
              <SectionNav id="brand" label="브랜드 / 색상" active={activeSection} onClick={setActiveSection} />
              <SectionNav id="template" label="템플릿 선택" active={activeSection} onClick={setActiveSection} />
              <SectionNav id="media" label="로고 / 이미지" active={activeSection} onClick={setActiveSection} />
              <SectionNav id="cta" label="CTA 버튼" active={activeSection} onClick={setActiveSection} />
              <SectionNav id="contact" label="연락처" active={activeSection} onClick={setActiveSection} />
              <SectionNav id="notice-popup" label="공지 팝업" active={activeSection} onClick={setActiveSection} />
              <div style={{ margin: "12px 0 6px", borderTop: "1px solid var(--color-border-divider, #e2e8f0)" }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted, #94a3b8)", margin: "4px 0", padding: "0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>홈페이지 모듈</p>
              <SectionNav id="sections-grid" label="모듈 모음" active={activeSection} onClick={setActiveSection} />
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
                { id: "sections-grid", label: "모듈" },
                { id: "brand", label: "브랜드" },
                { id: "template", label: "템플릿" },
                { id: "media", label: "이미지" },
                { id: "cta", label: "CTA" },
                { id: "contact", label: "연락처" },
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
            {activeSection === "notice-popup" && <NoticePopupEditor draft={draft} updateDraft={updateDraft} />}
            {activeSection === "sections-grid" && (
              <SectionCardGrid
                sections={sections}
                updateDraft={updateDraft}
                onEdit={(t) => setEditingSectionType(t)}
              />
            )}
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

      {uploadModalField && (
        <ImageUploadModal
          field={uploadModalField}
          onClose={() => setUploadModalField(null)}
          onUpload={handleModalUpload}
        />
      )}

      {editingSectionType && (
        <SectionEditModal
          sectionType={editingSectionType}
          sections={sections}
          updateDraft={updateDraft}
          onClose={() => setEditingSectionType(null)}
        />
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
  const heroCta = draft.hero_primary_cta || {};
  const updateHero = (patch: Partial<NonNullable<LandingConfig["hero_primary_cta"]>>) => {
    updateDraft((p) => ({ ...p, hero_primary_cta: { ...(p.hero_primary_cta || {}), ...patch } }));
  };
  return (
    <EditorSection title="CTA 버튼">
      <FieldRow label="버튼 문구">
        <TextInput value={draft.cta_text} onChange={(v) => updateDraft((p) => ({ ...p, cta_text: v }))} placeholder="로그인" maxLength={20} />
      </FieldRow>
      <FieldRow label="버튼 링크">
        <TextInput value={draft.cta_link} onChange={(v) => updateDraft((p) => ({ ...p, cta_link: v }))} placeholder="/login" />
      </FieldRow>
      <p style={{ fontSize: 12, color: "var(--color-text-muted, #94a3b8)" }}>기본값: /login (로그인 페이지)</p>

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--color-border, #e2e8f0)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text, #0f172a)", marginBottom: 4 }}>히어로 메인 CTA (2026-05-12 #60)</div>
        <p style={{ fontSize: 11.5, color: "var(--color-text-muted, #94a3b8)", margin: "0 0 12px", lineHeight: 1.5 }}>
          히어로 섹션의 큰 버튼. 학원이 가장 보여주고 싶은 것에 맞춰 선택.
        </p>
        <FieldRow label="변형">
          <select
            value={heroCta.variant || "consult"}
            onChange={(e) => updateHero({ variant: e.target.value as "consult" | "matchup" | "video" | "custom" })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border, #e2e8f0)", fontSize: 14, fontFamily: "inherit" }}
          >
            <option value="consult">기본 — 수강 문의 (config CTA 활용)</option>
            <option value="matchup">매치업 — 적중 보고서 페이지로</option>
            <option value="video">영상 — 강의 영상 link로</option>
            <option value="custom">자유 — label/link 직접 입력</option>
          </select>
        </FieldRow>
        {(heroCta.variant === "video" || heroCta.variant === "custom") && (
          <>
            <FieldRow label="버튼 라벨 (선택)">
              <TextInput value={heroCta.label || ""} onChange={(v) => updateHero({ label: v })} placeholder="강의 영상 보기" maxLength={30} />
            </FieldRow>
            <FieldRow label="링크 (선택)">
              <TextInput value={heroCta.link || ""} onChange={(v) => updateHero({ link: v })} placeholder="https://... 또는 /landing/community/board" />
            </FieldRow>
          </>
        )}
      </div>
    </EditorSection>
  );
}

function NoticePopupEditor({ draft, updateDraft }: { draft: LandingConfig; updateDraft: (fn: (p: LandingConfig) => LandingConfig) => void }) {
  const popup = draft.notice_popup || {};
  const update = (patch: Partial<NonNullable<LandingConfig["notice_popup"]>>) => {
    updateDraft((p) => ({ ...p, notice_popup: { ...(p.notice_popup || {}), ...patch } }));
  };
  return (
    <EditorSection title="공지 팝업 (2026-05-11)">
      <FieldRow label="활성화">
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!!popup.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          공지 팝업 노출
        </label>
      </FieldRow>
      <FieldRow label="제목">
        <TextInput
          value={popup.title || ""}
          onChange={(v) => update({ title: v })}
          placeholder="예: 신규 강좌 개강 안내"
          maxLength={80}
        />
      </FieldRow>
      <FieldRow label="내용">
        <textarea
          value={popup.content || ""}
          onChange={(e) => update({ content: e.target.value })}
          placeholder="공지 본문 (줄바꿈 그대로 표시)"
          maxLength={1000}
          rows={5}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1px solid var(--color-border, #E2E8F0)",
            fontSize: 14, fontFamily: "inherit", resize: "vertical", lineHeight: 1.6,
          }}
        />
      </FieldRow>
      <FieldRow label="자세히 보기 링크 (선택)">
        <TextInput
          value={popup.link || ""}
          onChange={(v) => update({ link: v })}
          placeholder="/landing#contact 또는 https://..."
        />
      </FieldRow>
      <FieldRow label="만료 일시 (선택)">
        <input
          type="datetime-local"
          value={popup.expire_at ? popup.expire_at.slice(0, 16) : ""}
          onChange={(e) => update({ expire_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
          style={{
            padding: "9px 12px", borderRadius: 8,
            border: "1px solid var(--color-border, #E2E8F0)",
            fontSize: 14, fontFamily: "inherit",
          }}
        />
      </FieldRow>
      <p style={{ fontSize: 12, color: "var(--color-text-muted, #94a3b8)", margin: "8px 0 0", lineHeight: 1.6 }}>
        외부 학부모/학생이 랜딩 첫 진입 시 노출됩니다. "24시간 동안 보지 않기" 클릭 후엔 24시간 동안 자동 숨김.
        만료 일시 지나면 자동 비노출.
      </p>
    </EditorSection>
  );
}

interface HeroItemDraft {
  kind: "hit_report" | "post" | "custom";
  report_id?: number;
  post_id?: number;
  category?: string;
  title?: string;
  subtitle?: string;
  cta_label?: string;
  cta_link?: string;
  image_url?: string;
}

function HeroCarouselItemsEditor({ items, updateSection }: {
  items: Array<Record<string, unknown>>;
  updateSection: (updater: (s: LandingSection) => LandingSection) => void;
}) {
  const list: HeroItemDraft[] = items.map((it) => ({
    kind: ((it.kind as string) || "custom") as HeroItemDraft["kind"],
    report_id: typeof it.report_id === "number" ? it.report_id : undefined,
    post_id: typeof it.post_id === "number" ? it.post_id : undefined,
    category: typeof it.category === "string" ? it.category : undefined,
    title: typeof it.title === "string" ? it.title : undefined,
    subtitle: typeof it.subtitle === "string" ? it.subtitle : undefined,
    cta_label: typeof it.cta_label === "string" ? it.cta_label : undefined,
    cta_link: typeof it.cta_link === "string" ? it.cta_link : undefined,
    image_url: typeof it.image_url === "string" ? it.image_url : undefined,
  }));

  const saveAll = (next: HeroItemDraft[]) => {
    updateSection((s) => ({ ...s, items: next.map((it) => ({ ...it })) as unknown as LandingSection["items"] }));
  };
  const update = (i: number, patch: Partial<HeroItemDraft>) => {
    const next = list.map((it, idx) => idx === i ? { ...it, ...patch } : it);
    saveAll(next);
  };
  const remove = (i: number) => saveAll(list.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    saveAll(next);
  };
  const add = (kind: HeroItemDraft["kind"]) => saveAll([...list, { kind }]);

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-text-muted, #94a3b8)", margin: "0 0 12px", lineHeight: 1.6 }}>
        hero 영역에 자동 회전 카드를 추가합니다. 매치업 보고서 / 일반 게시글 / 자유 커스텀 카드 자유 mix. 5초마다 회전.
      </p>
      {list.length === 0 ? (
        <div style={{ padding: 18, border: "1px dashed var(--color-border, #e2e8f0)", borderRadius: 10, textAlign: "center", fontSize: 13, color: "var(--color-text-muted, #94a3b8)", marginBottom: 12 }}>
          등록된 hero 카드가 없습니다. 아래 버튼으로 추가해 보세요.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {list.map((it, i) => (
            <div key={i} style={{ padding: 12, borderRadius: 10, background: "var(--color-bg-surface-soft, #F8FAFC)", border: "1px solid var(--color-border, #e2e8f0)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                  background: it.kind === "hit_report" ? "rgba(212,160,76,0.12)" : it.kind === "post" ? "rgba(37,99,235,0.10)" : "rgba(124,58,237,0.10)",
                  color: it.kind === "hit_report" ? "#A16207" : it.kind === "post" ? "#1E40AF" : "#6D28D9",
                }}>
                  {it.kind === "hit_report" ? "🎯 매치업 보고서" : it.kind === "post" ? "📰 staff 글" : "✨ 커스텀 카드"}
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={miniBtn}>↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} style={miniBtn}>↓</button>
                  <button type="button" onClick={() => remove(i)} style={{ ...miniBtn, color: "#B91C1C", borderColor: "#FCA5A5" }}>×</button>
                </div>
              </div>
              {it.kind === "hit_report" && (
                <FieldRow label="보고서 ID">
                  <TextInput value={String(it.report_id ?? "")} onChange={(v) => update(i, { report_id: Number(v) || undefined })} placeholder="예: 123" />
                </FieldRow>
              )}
              {it.kind === "post" && (
                <FieldRow label="게시글 ID (staff 작성·published만)">
                  <TextInput value={String(it.post_id ?? "")} onChange={(v) => update(i, { post_id: Number(v) || undefined })} placeholder="예: 1641" />
                </FieldRow>
              )}
              {it.kind === "custom" && (
                <>
                  <FieldRow label="카테고리 라벨">
                    <TextInput value={it.category || ""} onChange={(v) => update(i, { category: v })} placeholder="예: 공지 / 이벤트" maxLength={20} />
                  </FieldRow>
                  <FieldRow label="제목">
                    <TextInput value={it.title || ""} onChange={(v) => update(i, { title: v })} placeholder="강조 제목" maxLength={80} />
                  </FieldRow>
                  <FieldRow label="부제 (선택)">
                    <TextInput value={it.subtitle || ""} onChange={(v) => update(i, { subtitle: v })} placeholder="부가 설명" maxLength={120} />
                  </FieldRow>
                  <FieldRow label="이미지 URL (선택, 배경)">
                    <TextInput value={it.image_url || ""} onChange={(v) => update(i, { image_url: v })} placeholder="https://..." />
                  </FieldRow>
                  <FieldRow label="버튼 라벨 (선택)">
                    <TextInput value={it.cta_label || ""} onChange={(v) => update(i, { cta_label: v })} placeholder="자세히 보기" maxLength={20} />
                  </FieldRow>
                  <FieldRow label="버튼 링크">
                    <TextInput value={it.cta_link || ""} onChange={(v) => update(i, { cta_link: v })} placeholder="/landing#contact 또는 https://..." />
                  </FieldRow>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => add("hit_report")} style={addBtn}>+ 매치업 보고서</button>
        <button type="button" onClick={() => add("post")} style={addBtn}>+ staff 글</button>
        <button type="button" onClick={() => add("custom")} style={addBtn}>+ 커스텀 카드</button>
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: "1px solid var(--color-border, #e2e8f0)",
  background: "#fff", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary, #64748b)",
};
const addBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "1px dashed var(--color-border, #cbd5e1)",
  background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600,
  color: "var(--color-text-secondary, #475569)",
};

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

  const label = sectionLabel(sectionType);

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
          {/* Title/Description for text-led sections */}
          {(sectionType === "about" || sectionType === "notice" || sectionType === "instructor_profile") && (
            <>
              <FieldRow label="제목">
                <TextInput value={section.title || ""} onChange={(v) => updateSection((s) => ({ ...s, title: v }))} placeholder={sectionType === "about" ? "소개" : sectionType === "instructor_profile" ? "강사 프로필" : "공지"} />
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

          {sectionType === "instructor_profile" && (
            <InstructorProfileItemsEditor
              items={(section.items || []) as InstructorProfileItem[]}
              updateSection={updateSection}
            />
          )}

          {/* hero_carousel: 자유 mix(hit_report/post/custom). 학원장 자율(#48 #22). */}
          {sectionType === "hero_carousel" && (
            <HeroCarouselItemsEditor items={(section.items as unknown as Array<Record<string, unknown>> | undefined) || []} updateSection={updateSection} />
          )}

          {/* hit_reports: title + description + 보고서 picker + 종료 날짜 입력 */}
          {sectionType === "hit_reports" && (
            <>
              <FieldRow label="제목">
                <TextInput value={section.title || ""} onChange={(v) => updateSection((s) => ({ ...s, title: v }))} placeholder="최근 적중 사례" />
              </FieldRow>
              <FieldRow label="안내문">
                <TextArea value={section.description || ""} onChange={(v) => updateSection((s) => ({ ...s, description: v }))} placeholder="우리 학원의 시험지 적중 결과를 소개합니다." rows={2} />
              </FieldRow>
              <HitReportPicker
                selectedIds={(((section.items || []) as Array<{ report_id: number }>).map((it) => it.report_id))}
                onChange={(ids) => {
                  // 기존 items에서 report_id 매칭되는 항목의 published_until 보존
                  const existing = (section.items || []) as Array<{ report_id: number; published_until?: string }>;
                  const byId = new Map(existing.map((it) => [it.report_id, it]));
                  updateSection((s) => ({
                    ...s,
                    items: ids.map((id) => byId.get(id) ?? { report_id: id }),
                  }));
                }}
              />
              {/* Phase #14 — 선택된 보고서별 외부 노출 종료 날짜.
                  학원장이 종료 날짜 지정하면 외부 학부모는 카드 메타만 보이고 PDF 본문 차단됨. */}
              <HitReportPublishedUntilEditor
                items={(section.items || []) as Array<{ report_id: number; published_until?: string | null }>}
                onChange={(items) => updateSection((s) => ({ ...s, items }))}
              />
            </>
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

function InstructorProfileItemsEditor({ items, updateSection }: {
  items: InstructorProfileItem[];
  updateSection: (fn: (s: LandingSection) => LandingSection) => void;
}) {
  const maxItems = 12;

  const normalized: InstructorProfileItem[] = items.map((item) => ({
    name: item.name || "",
    title: item.title || "",
    photo_url: item.photo_url || "",
    bio: item.bio || "",
    experience: Array.isArray(item.experience) ? item.experience : [],
  }));

  const updateItem = (idx: number, patch: Partial<InstructorProfileItem>) => {
    updateSection((s) => ({
      ...s,
      items: ((s.items || []) as InstructorProfileItem[]).map((item, i) => (
        i === idx ? { ...item, ...patch } : item
      )),
    }));
  };

  const removeItem = (idx: number) => {
    updateSection((s) => ({
      ...s,
      items: ((s.items || []) as InstructorProfileItem[]).filter((_, i) => i !== idx),
    }));
  };

  const addItem = () => {
    if (normalized.length >= maxItems) return;
    updateSection((s) => ({
      ...s,
      items: [
        ...((s.items || []) as InstructorProfileItem[]),
        { name: "", title: "", photo_url: "", bio: "", experience: [] },
      ],
    }));
  };

  return (
    <div>
      {normalized.map((item, idx) => (
        <div key={idx} style={{ padding: 16, borderRadius: 8, border: "1px solid var(--color-border-divider, #e2e8f0)", marginBottom: 12, background: "var(--color-bg-surface, #fff)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted, #94a3b8)" }}>강사 {idx + 1}</span>
            <button onClick={() => removeItem(idx)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "#dc2626" }}>삭제</button>
          </div>

          <FieldRow label="이름">
            <TextInput value={item.name} onChange={(v) => updateItem(idx, { name: v })} placeholder="박철T" maxLength={40} />
          </FieldRow>
          <FieldRow label="직함">
            <TextInput value={item.title} onChange={(v) => updateItem(idx, { title: v })} placeholder="통합과학 전임 강사" maxLength={60} />
          </FieldRow>
          <FieldRow label="프로필 사진 URL">
            <TextInput value={item.photo_url || ""} onChange={(v) => updateItem(idx, { photo_url: v })} placeholder="https://..." />
          </FieldRow>
          <FieldRow label="소개">
            <TextArea value={item.bio || ""} onChange={(v) => updateItem(idx, { bio: v })} placeholder="강사 소개" rows={4} />
          </FieldRow>
          <FieldRow label="경력 (줄바꿈으로 구분)">
            <TextArea
              value={(item.experience || []).join("\n")}
              onChange={(v) => updateItem(idx, { experience: v.split("\n").map((line) => line.trim()).filter(Boolean) })}
              placeholder={"현 대치명인학원 통합과학 출강\n현 대치두각학원 통합과학 출강"}
              rows={5}
            />
          </FieldRow>
        </div>
      ))}

      {normalized.length < maxItems && (
        <button onClick={addItem} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px dashed var(--color-border-divider, #d1d5db)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary, #64748b)" }}>
          + 강사 추가 (최대 {maxItems}명)
        </button>
      )}
    </div>
  );
}

function ItemsEditor({ sectionType, items, updateSection }: { sectionType: string; items: any[]; updateSection: (fn: (s: LandingSection) => LandingSection) => void }) {
  // backend MAX_SECTION_ITEMS와 정합 — process_timeline(7+주차), management_system(6+카드) 수용.
  const maxItems = 12;

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

/** Phase #14 (2026-05-12) — 선택된 적중보고서 항목별 외부 노출 종료 날짜 입력.
 *  HitReportPicker 와 별도 UI. items 직접 조작.
 */
function HitReportPublishedUntilEditor({
  items, onChange,
}: {
  items: Array<{ report_id: number; published_until?: string | null }>;
  onChange: (items: Array<{ report_id: number; published_until?: string | null }>) => void;
}) {
  if (items.length === 0) return null;
  const updateOne = (id: number, value: string | null) => {
    onChange(items.map((it) => {
      if (it.report_id !== id) return it;
      if (!value) {
        const { published_until, ...rest } = it;
        void published_until;
        return rest;
      }
      return { ...it, published_until: value };
    }));
  };
  return (
    <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "var(--color-bg-canvas, #f8fafc)", border: "1px solid var(--color-border-divider, #e2e8f0)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary, #1e293b)", marginBottom: 6 }}>
        🗓 외부 노출 종료 날짜 <span style={{ fontWeight: 500, color: "var(--color-text-muted, #94a3b8)", fontSize: 11 }}>(선택)</span>
      </div>
      <p style={{ fontSize: 11, color: "var(--color-text-secondary, #64748b)", margin: "0 0 10px", lineHeight: 1.5 }}>
        종료 날짜 지정 시 외부 학부모는 카드 통계만 보이고 PDF 본문은 가립니다. <strong>학원장은 영구 열람 가능</strong>합니다.
        빈 칸 = 영구 노출.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it) => (
          <div key={it.report_id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
            <span style={{ width: 70, color: "var(--color-text-muted, #94a3b8)", fontWeight: 600 }}>#{it.report_id}</span>
            <input
              type="date"
              value={(it.published_until || "").slice(0, 10)}
              onChange={(e) => updateOne(it.report_id, e.target.value || null)}
              data-testid={`hit-report-published-until-${it.report_id}`}
              style={{
                flex: 1, padding: "6px 10px", borderRadius: 6,
                border: "1px solid var(--color-border-divider, #e2e8f0)",
                background: "var(--color-bg-surface, #fff)", fontSize: 13,
                color: "var(--color-text-primary, #1e293b)",
              }}
            />
            {it.published_until && (
              <button
                type="button"
                onClick={() => updateOne(it.report_id, null)}
                title="종료 날짜 해제 (영구 노출)"
                style={{
                  background: "transparent", border: "none", padding: 0,
                  color: "var(--color-text-muted, #94a3b8)", fontSize: 14, cursor: "pointer",
                }}
              >×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 매치업 적중보고서 picker — 학원장이 자기 학원 보고서 중 홈페이지 카드로 노출할 것을 체크박스로 선택.
 * 텍스트 입력 X, 다른 곳에서 만든 보고서를 골라 박는 한 단계 인터페이스.
 */
function HitReportPicker({ selectedIds, onChange }: { selectedIds: number[]; onChange: (ids: number[]) => void }) {
  const [reports, setReports] = useState<Array<{ id: number; document_title: string; document_category: string; hit_rate: number; hit_count: number; exam_count: number; status: string }> | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  // 2026-05-12 — backend MAX_REPORTS(12) 와 일치. 기존 6 제한은 frontend-only constraint 였고
  // chip toggle / submit 통합 흐름은 12까지 OK 였음 → GUI picker 도 12로 동기.
  const MAX = 12;

  useEffect(() => {
    let cancelled = false;
    import("@admin/domains/storage/api/matchup.api").then(({ fetchHitReportList }) =>
      fetchHitReportList({ mine: false }).then((res) => {
        if (cancelled) return;
        setReports(res.reports.map((r) => ({
          id: r.id,
          document_title: r.document_title,
          document_category: r.document_category,
          hit_rate: r.hit_rate,
          hit_count: r.hit_count,
          exam_count: r.exam_count,
          status: r.status,
        })));
      }).catch(() => { if (!cancelled) setLoadErr(true); }),
    ).catch(() => { if (!cancelled) setLoadErr(true); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      if (selectedIds.length >= MAX) return;
      onChange([...selectedIds, id]);
    }
  };

  if (loadErr) {
    return <p style={{ fontSize: 13, color: "var(--color-status-error, #dc2626)", margin: "12px 0" }}>적중 보고서 목록을 불러오지 못했습니다.</p>;
  }
  if (reports === null) {
    return <p style={{ fontSize: 13, color: "var(--color-text-muted, #94a3b8)", margin: "12px 0" }}>보고서 목록 불러오는 중...</p>;
  }
  if (reports.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--color-text-secondary, #64748b)", padding: "16px", background: "var(--color-bg-canvas, #f8fafc)", borderRadius: 10, lineHeight: 1.6 }}>
        아직 만들어진 적중 보고서가 없습니다.<br />
        먼저 매치업 페이지에서 시험지를 분석해 보고서를 만들어주세요.
      </div>
    );
  }

  const openPdf = (rid: number) => {
    // 어드민 인증된 PDF endpoint — staff 본인 보고서/admin은 권한 OK
    window.open(`/api/v1/matchup/hit-reports/${rid}/curated.pdf`, "_blank", "noopener");
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary, #64748b)", margin: "0 0 6px" }}>
        홈페이지에 보여줄 보고서를 골라주세요. <strong style={{ color: "var(--color-text-primary, #1e293b)" }}>최대 {MAX}개</strong>까지 선택 가능 (현재 {selectedIds.length}개 선택됨).
      </p>
      <p style={{ fontSize: 11, color: "var(--color-text-muted, #94a3b8)", margin: "0 0 10px" }}>
        💡 보고서를 <strong>더블클릭</strong>하거나 우측 <strong>👁 미리보기</strong>를 누르면 본문 PDF가 열립니다. 학원장이 어떤 보고서인지 직접 확인 후 선택하세요.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto", border: "1px solid var(--color-border-divider, #e2e8f0)", borderRadius: 10, padding: 8 }}>
        {reports.map((r) => {
          const checked = selectedIds.includes(r.id);
          const disabled = !checked && selectedIds.length >= MAX;
          const ratePct = Math.round(r.hit_rate);
          return (
            <div
              key={r.id}
              onDoubleClick={() => openPdf(r.id)}
              title="더블클릭하면 본문 PDF가 새 탭에서 열립니다"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                background: checked ? "var(--color-brand-primary-soft, rgba(37,99,235,0.08))" : "transparent",
                opacity: disabled ? 0.5 : 1,
                border: checked ? "1px solid var(--color-brand-primary, #2563EB)" : "1px solid transparent",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox" checked={checked} disabled={disabled}
                onChange={() => toggle(r.id)}
                style={{ width: 16, height: 16, cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0, cursor: disabled ? "not-allowed" : "pointer" }} onClick={() => !disabled && toggle(r.id)}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary, #1e293b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.document_title || r.document_category || "(제목 없음)"}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted, #94a3b8)", marginTop: 2 }}>
                  적중 {r.hit_count} / {r.exam_count} 문항 · 적중률 {ratePct}%{r.status === "draft" ? " · 작성 중" : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openPdf(r.id); }}
                title="본문 PDF 미리보기 (새 탭)"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "5px 10px", borderRadius: 7,
                  background: "rgba(15,23,42,0.05)", color: "#475569",
                  border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                미리보기
              </button>
              <span style={{ fontSize: 17, fontWeight: 800, color: ratePct >= 60 ? "var(--color-status-success, #10b981)" : ratePct >= 30 ? "var(--color-brand-primary, #2563EB)" : "var(--color-text-muted, #94a3b8)", letterSpacing: "-0.02em", flexShrink: 0, minWidth: 44, textAlign: "right" }}>
                {ratePct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 모듈 모음 카드 그리드 — 네이버 블로그 꾸미기 식 시각적 토글.
 * 각 섹션이 큰 카드. 아이콘 + 라벨 + ON/OFF + "편집" 버튼.
 * 메타는 SECTION_META(SSOT)에서 직접 조회 — 별도 dict 유지 X.
 */
function SectionCardGrid({ sections, updateDraft, onEdit }: { sections: LandingSection[]; updateDraft: (fn: (p: LandingConfig) => LandingConfig) => void; onEdit: (type: string) => void }) {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const toggle = (type: string) => {
    updateDraft((p) => ({
      ...p,
      sections: p.sections.map((s) => s.type === type ? { ...s, enabled: !s.enabled } : s),
    }));
  };
  const move = (type: string, direction: -1 | 1) => {
    updateDraft((p) => {
      const arr = [...p.sections].sort((a, b) => a.order - b.order);
      const idx = arr.findIndex((s) => s.type === type);
      if (idx < 0) return p;
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= arr.length) return p;
      const next = arr.map((s, i) => {
        if (i === idx) return { ...s, order: swapIdx };
        if (i === swapIdx) return { ...s, order: idx };
        return { ...s, order: i };
      });
      return { ...p, sections: next };
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px", color: "var(--color-text-primary, #1e293b)" }}>
          홈페이지 모듈
        </h3>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary, #64748b)", margin: 0, lineHeight: 1.6 }}>
          켜기/끄기 + 편집 + 순서 변경. 카드를 클릭하면 자세한 편집 창이 열립니다.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {sorted.map((sec, i) => {
          const meta = (SECTION_META as Record<string, { icon: string; tagline: string }>)[sec.type] || { icon: "star", tagline: "모듈" };
          const label = sectionLabel(sec.type);
          return (
            <div
              key={sec.type}
              style={{
                position: "relative",
                padding: 18,
                borderRadius: 14,
                background: sec.enabled ? "#fff" : "#f8fafc",
                border: `1.5px solid ${sec.enabled ? "var(--color-brand-primary, #2563EB)" : "var(--color-border-divider, #e2e8f0)"}`,
                boxShadow: sec.enabled ? "0 2px 6px rgba(37,99,235,0.08)" : "none",
                display: "flex", flexDirection: "column", gap: 10,
                opacity: sec.enabled ? 1 : 0.75,
                transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: sec.enabled ? "rgba(37,99,235,0.12)" : "rgba(0,0,0,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: sec.enabled ? "var(--color-brand-primary, #2563EB)" : "var(--color-text-muted, #94a3b8)",
                  flexShrink: 0,
                }}>
                  <SvgIcon name={meta.icon} size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary, #1e293b)", letterSpacing: "-0.01em" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted, #94a3b8)", marginTop: 2 }}>
                    {meta.tagline}
                  </div>
                </div>
                {/* 토글 스위치 */}
                <button
                  type="button"
                  onClick={() => toggle(sec.type)}
                  aria-label={sec.enabled ? "끄기" : "켜기"}
                  style={{
                    width: 38, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                    background: sec.enabled ? "var(--color-brand-primary, #2563EB)" : "#cbd5e1",
                    position: "relative", flexShrink: 0,
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 2, left: sec.enabled ? 18 : 2,
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                    transition: "left 0.15s",
                  }} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => onEdit(sec.type)}
                  style={{
                    flex: 1,
                    padding: "7px 10px", borderRadius: 8,
                    border: "1px solid var(--color-border-divider, #e2e8f0)",
                    background: "#fff", color: "var(--color-text-primary, #1e293b)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >편집</button>
                <button type="button" onClick={() => move(sec.type, -1)} disabled={i === 0} title="위로" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--color-border-divider, #e2e8f0)", background: "#fff", cursor: i === 0 ? "not-allowed" : "pointer", opacity: i === 0 ? 0.4 : 1, fontSize: 14, color: "var(--color-text-secondary, #64748b)" }}>↑</button>
                <button type="button" onClick={() => move(sec.type, 1)} disabled={i === sorted.length - 1} title="아래로" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--color-border-divider, #e2e8f0)", background: "#fff", cursor: i === sorted.length - 1 ? "not-allowed" : "pointer", opacity: i === sorted.length - 1 ? 0.4 : 1, fontSize: 14, color: "var(--color-text-secondary, #64748b)" }}>↓</button>
              </div>
              <span style={{
                position: "absolute", top: 8, right: 8,
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                background: sec.enabled ? "rgba(34,197,94,0.12)" : "rgba(0,0,0,0.05)",
                color: sec.enabled ? "#16a34a" : "var(--color-text-muted, #94a3b8)",
                letterSpacing: "0.04em",
                pointerEvents: "none",
              }}>
                {sec.enabled ? "ON" : "OFF"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 섹션 편집 모달 — 모듈 카드 클릭 시 펼쳐지는 풀 편집기. SectionEditor 재사용. */
function SectionEditModal({ sectionType, sections, updateDraft, onClose }: { sectionType: string; sections: LandingSection[]; updateDraft: (fn: (p: LandingConfig) => LandingConfig) => void; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,0.55)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px",
      overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 720, background: "#fff", borderRadius: 16,
        padding: "8px 28px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} aria-label="닫기" style={{ width: 36, height: 36, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#64748b", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <SectionEditor sectionType={sectionType} sections={sections} updateDraft={updateDraft} />
      </div>
    </div>
  );
}

/** 이미지 업로드 모달 — 파일 선택 + 클립보드 paste(Ctrl+V) + drop 모두 지원.
 * 사용자가 캡처본을 즉시 paste할 수 있어 학원장 작업 흐름 매우 단축.
 */
function ImageUploadModal({ field, onClose, onUpload }: { field: "hero" | "logo"; onClose: () => void; onUpload: (file: File) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // P2 audit (2026-05-14): URL.createObjectURL revoke 페어 — 이전 preview blob 누수 회피.
  // preview state 변경 또는 unmount 시 이전 blob URL 해제. setPreview 직접 호출 곳도
  // useEffect cleanup이 자동 처리.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // 클립보드 paste — 모달 열려있는 동안만 활성. textarea/input에 focus 시 그쪽이 paste 받도록 양보.
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      // 다른 텍스트 입력 element에 focus 있으면 모달이 가로채지 않음 (양보).
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && (ae as HTMLInputElement).type !== "file"))) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            setPendingFile(f);
            setPreview(URL.createObjectURL(f));
            return;
          }
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, []);

  // ESC 닫기
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const choose = (f: File) => {
    if (!f.type.startsWith("image/")) return;
    setPendingFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const fieldLabel = field === "hero" ? "메인 이미지" : "로고";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(15,23,42,0.55)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520,
        background: "#fff", borderRadius: 16, padding: 28,
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        display: "flex", flexDirection: "column", gap: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "#0f172a" }}>{fieldLabel} 업로드</h3>
          <button onClick={onClose} aria-label="닫기" style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#64748b", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) choose(f);
          }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${drag ? "#2563EB" : "#cbd5e1"}`,
            background: drag ? "rgba(37,99,235,0.05)" : "#f8fafc",
            borderRadius: 12, padding: preview ? 12 : 36,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            cursor: "pointer", textAlign: "center", minHeight: preview ? 0 : 180,
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          {preview ? (
            <img src={preview} alt="미리보기" style={{ maxWidth: "100%", maxHeight: 280, borderRadius: 8, objectFit: "contain" }} />
          ) : (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
              <p style={{ fontSize: 14, color: "#475569", margin: "12px 0 4px", fontWeight: 600 }}>이미지를 끌어다 놓거나 클릭해서 선택</p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>또는 <kbd style={{ padding: "1px 6px", background: "#e2e8f0", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Ctrl+V</kbd>로 붙여넣기 (5MB 이하)</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) choose(f); }}
            style={{ display: "none" }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {preview && (
            <button onClick={() => { setPreview(null); setPendingFile(null); }} style={{
              padding: "10px 18px", borderRadius: 10, border: "1px solid #e2e8f0",
              background: "#fff", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>다른 이미지 선택</button>
          )}
          <button
            disabled={!pendingFile}
            onClick={() => pendingFile && onUpload(pendingFile)}
            style={{
              padding: "10px 22px", borderRadius: 10, border: "none",
              background: pendingFile ? "#2563EB" : "#cbd5e1",
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: pendingFile ? "pointer" : "not-allowed",
            }}
          >업로드</button>
        </div>
      </div>
    </div>
  );
}

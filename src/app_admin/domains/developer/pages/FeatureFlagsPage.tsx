// PATH: src/app_admin/domains/developer/pages/FeatureFlagsPage.tsx
// 개발자 콘솔 > 운영 설정 — feature_flags 관리 (owner/tenant 1 전용)
// 모드 프리셋 + 운영 테넌트 설정 불러오기 지원

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Settings,
  ToggleLeft,
  ToggleRight,
  Zap,
  Eye,
  ChevronDown,
  Building2,
} from "lucide-react";
import { useProgram } from "@/shared/program";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import styles from "./DeveloperPage.module.css";

/* ── Types ── */

type FeatureFlags = {
  section_mode?: boolean;
  school_level_mode?: string;
  clinic_mode?: string;
  [key: string]: unknown;
};

type TenantWithFlags = {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  featureFlags: FeatureFlags;
};

/* ── Presets ── */

type Preset = {
  id: string;
  label: string;
  description: string;
  flags: { section_mode: boolean; school_level_mode: string; clinic_mode: string };
  color: string;
};

const PRESETS: Preset[] = [
  {
    id: "default",
    label: "기본",
    description: "중고등 · 반 없음 · 보충 클리닉",
    flags: { section_mode: false, school_level_mode: "middle_high", clinic_mode: "remediation" },
    color: "var(--color-text-secondary)",
  },
  {
    id: "sswe",
    label: "SSWE",
    description: "중고등 · A/B반 · 정규 클리닉",
    flags: { section_mode: true, school_level_mode: "middle_high", clinic_mode: "regular" },
    color: "#7c3aed",
  },
  {
    id: "elementary",
    label: "초중등",
    description: "초중등 · 반 없음 · 보충 클리닉",
    flags: { section_mode: false, school_level_mode: "elementary_middle", clinic_mode: "remediation" },
    color: "#0891b2",
  },
  {
    id: "elementary_section",
    label: "초중등+반",
    description: "초중등 · A/B반 · 보충 클리닉",
    flags: { section_mode: true, school_level_mode: "elementary_middle", clinic_mode: "remediation" },
    color: "#0d9488",
  },
];

/* ── Mode Options (individual toggles) ── */

const MODE_OPTIONS: {
  key: string;
  label: string;
  description: string;
  options: { value: string; label: string; description: string }[];
}[] = [
  {
    key: "section_mode",
    label: "반 편성 모드",
    description: "강의 내 A/B반 운영 여부",
    options: [
      { value: "false", label: "기본 (반 없음)", description: "하나의 강의에 모든 학생이 동일한 차시로 수업" },
      { value: "true", label: "A/B반 운영", description: "강의 내 수업/클리닉을 A반·B반으로 분리 운영 (SSWE 방식)" },
    ],
  },
  {
    key: "school_level_mode",
    label: "학생 대상 (학령)",
    description: "학생 등록 시 허용되는 학교급",
    options: [
      { value: "middle_high", label: "중고등 (기본)", description: "중학교·고등학교 학생 대상" },
      { value: "elementary_middle", label: "초중등", description: "초등학교·중학교 학생 대상 (DNB 방식)" },
    ],
  },
  {
    key: "clinic_mode",
    label: "클리닉 모드",
    description: "클리닉 운영 방식",
    options: [
      { value: "remediation", label: "보충형 (기본)", description: "시험/과제 불합격 학생의 보충수업 관리용" },
      { value: "regular", label: "정규형 (필수 클리닉)", description: "수업의 연장. 모든 학생이 클리닉 A/B 슬롯에 참여 (SSWE 방식)" },
    ],
  },
];

/* ── Component ── */

export default function FeatureFlagsPage() {
  const { program, refetch } = useProgram();
  const ff: FeatureFlags = program?.feature_flags ?? {};

  // Local state for edits
  const [sectionMode, setSectionMode] = useState<string>(String(Boolean(ff.section_mode)));
  const [schoolLevel, setSchoolLevel] = useState<string>(
    (ff.school_level_mode as string) || "middle_high"
  );
  const [clinicMode, setClinicMode] = useState<string>(
    (ff.clinic_mode as string) || "remediation"
  );
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);

  // Current saved values
  const currentSectionMode = String(Boolean(ff.section_mode));
  const currentSchoolLevel = (ff.school_level_mode as string) || "middle_high";
  const currentClinicMode = (ff.clinic_mode as string) || "remediation";

  const hasChanges =
    sectionMode !== currentSectionMode ||
    schoolLevel !== currentSchoolLevel ||
    clinicMode !== currentClinicMode;

  // Fetch tenants (platform admin only - Tenant 1)
  const { data: tenants } = useQuery<TenantWithFlags[]>({
    queryKey: ["tenants-feature-flags"],
    queryFn: async () => {
      const res = await api.get<TenantWithFlags[]>("/core/tenants/");
      return res.data;
    },
    staleTime: 60_000,
  });

  // Save mutation
  const saveMut = useMutation({
    mutationFn: async () => {
      const newFlags: FeatureFlags = {
        ...ff,
        section_mode: sectionMode === "true",
        school_level_mode: schoolLevel,
        clinic_mode: clinicMode,
      };
      await api.patch("/core/program/", { feature_flags: newFlags });
    },
    onSuccess: async () => {
      await refetch();
      feedback.success("운영 설정이 저장되었습니다.");
    },
    onError: () => feedback.error("저장 실패. 권한을 확인하세요."),
  });

  const stateMap: Record<string, { get: string; set: (v: string) => void }> = {
    section_mode: { get: sectionMode, set: setSectionMode },
    school_level_mode: { get: schoolLevel, set: setSchoolLevel },
    clinic_mode: { get: clinicMode, set: setClinicMode },
  };

  // Apply a preset or tenant config
  function applyFlags(flags: { section_mode?: boolean; school_level_mode?: string; clinic_mode?: string }) {
    setSectionMode(String(Boolean(flags.section_mode)));
    setSchoolLevel(flags.school_level_mode || "middle_high");
    setClinicMode(flags.clinic_mode || "remediation");
  }

  // Check which preset matches current local state
  function matchesPreset(preset: Preset): boolean {
    return (
      sectionMode === String(preset.flags.section_mode) &&
      schoolLevel === preset.flags.school_level_mode &&
      clinicMode === preset.flags.clinic_mode
    );
  }

  // Other tenants (exclude Tenant 1 = self)
  const otherTenants = tenants?.filter((t) => t.id !== 1 && t.isActive) ?? [];

  return (
    <div className={styles.panel}>
      {/* Guide */}
      <div className={styles.guide}>
        <Settings size={18} className={styles.guideIcon} />
        <div>
          <p className={styles.guideTitle}>운영 모드 설정</p>
          <p className={styles.guideDesc}>
            이 학원의 운영 방식을 설정합니다. 프리셋으로 빠르게 전환하거나 운영 테넌트 설정을 불러올 수 있습니다.
          </p>
        </div>
      </div>

      {/* ── Presets ── */}
      <div
        style={{
          border: "1px solid var(--color-border-divider)",
          borderRadius: 10,
          background: "var(--color-bg-surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px 10px",
            borderBottom: "1px solid var(--color-border-divider)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Zap size={15} style={{ color: "var(--color-brand-primary)" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>
            모드 프리셋
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginLeft: 4 }}>
            원클릭 전환
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {PRESETS.map((preset) => {
            const active = matchesPreset(preset);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyFlags(preset.flags)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  padding: "14px 16px",
                  border: "none",
                  borderRight: "1px solid var(--color-border-divider)",
                  borderBottom: "1px solid var(--color-border-divider)",
                  background: active
                    ? `color-mix(in srgb, ${preset.color} 8%, var(--color-bg-surface))`
                    : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 120ms",
                  outline: active ? `2px solid ${preset.color}` : "none",
                  outlineOffset: -2,
                  borderRadius: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: active ? 800 : 600,
                    color: active ? preset.color : "var(--color-text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: active ? preset.color : "var(--color-text-muted)",
                      opacity: active ? 1 : 0.3,
                      flexShrink: 0,
                    }}
                  />
                  {preset.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", paddingLeft: 14 }}>
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tenant Config Loader ── */}
      {otherTenants.length > 0 && (
        <div
          style={{
            border: "1px solid var(--color-border-divider)",
            borderRadius: 10,
            background: "var(--color-bg-surface)",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setTenantDropdownOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "14px 18px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Eye size={15} style={{ color: "var(--color-brand-primary)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>
                운영 테넌트 설정 불러오기
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                실제 운영 중인 테넌트의 설정을 가져와 미리보기
              </div>
            </div>
            <ChevronDown
              size={16}
              style={{
                color: "var(--color-text-muted)",
                transition: "transform 150ms",
                transform: tenantDropdownOpen ? "rotate(180deg)" : "rotate(0)",
              }}
            />
          </button>
          {tenantDropdownOpen && (
            <div
              style={{
                borderTop: "1px solid var(--color-border-divider)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {otherTenants.map((tenant) => {
                const tff = tenant.featureFlags || {};
                const desc = [
                  tff.school_level_mode === "elementary_middle" ? "초중등" : "중고등",
                  tff.section_mode ? "A/B반" : "반 없음",
                  tff.clinic_mode === "regular" ? "정규 클리닉" : "보충 클리닉",
                ].join(" · ");
                return (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => {
                      applyFlags(tff);
                      setTenantDropdownOpen(false);
                      feedback.success(`${tenant.name} 설정을 불러왔습니다. 저장 후 반영됩니다.`);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 18px",
                      border: "none",
                      borderBottom: "1px solid var(--color-border-divider)",
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 120ms",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "color-mix(in srgb, var(--color-brand-primary) 4%, var(--color-bg-surface))";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <Building2 size={16} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--color-text-primary)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {tenant.name}
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: "var(--color-text-muted)",
                            fontFamily: "ui-monospace, monospace",
                          }}
                        >
                          #{tenant.id}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Individual Toggles ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {MODE_OPTIONS.map((mode) => {
          const state = stateMap[mode.key];
          return (
            <div
              key={mode.key}
              style={{
                border: "1px solid var(--color-border-divider)",
                borderRadius: 10,
                background: "var(--color-bg-surface)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 18px 10px",
                  borderBottom: "1px solid var(--color-border-divider)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 2 }}>
                  {mode.label}
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  {mode.description}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {mode.options.map((opt) => {
                  const selected = state.get === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => state.set(opt.value)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 18px",
                        border: "none",
                        borderBottom: "1px solid var(--color-border-divider)",
                        background: selected
                          ? "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface))"
                          : "transparent",
                        cursor: "pointer",
                        transition: "background 120ms",
                        textAlign: "left",
                      }}
                    >
                      {selected ? (
                        <ToggleRight
                          size={22}
                          style={{ color: "var(--color-brand-primary)", flexShrink: 0 }}
                        />
                      ) : (
                        <ToggleLeft
                          size={22}
                          style={{ color: "var(--color-text-muted)", flexShrink: 0, opacity: 0.5 }}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: selected ? 700 : 500,
                            color: selected ? "var(--color-brand-primary)" : "var(--color-text-primary)",
                          }}
                        >
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 1 }}>
                          {opt.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Save bar ── */}
      {hasChanges && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--color-warning, #d97706) 8%, var(--color-bg-surface))",
            border: "1px solid color-mix(in srgb, var(--color-warning, #d97706) 25%, var(--color-border-divider))",
            position: "sticky",
            bottom: 16,
            zIndex: 10,
            boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
            변경사항이 있습니다.
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              intent="ghost"
              size="sm"
              onClick={() => {
                setSectionMode(currentSectionMode);
                setSchoolLevel(currentSchoolLevel);
                setClinicMode(currentClinicMode);
              }}
            >
              취소
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              loading={saveMut.isPending}
            >
              {saveMut.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Current value summary ── */}
      <div
        style={{
          padding: "14px 18px",
          borderRadius: 10,
          border: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
          fontSize: 13,
          color: "var(--color-text-muted)",
          lineHeight: 1.8,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          현재 적용 중
        </div>
        <div>
          <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>반 편성:</span>{" "}
          {Boolean(ff.section_mode) ? "A/B반 운영" : "기본 (반 없음)"}
        </div>
        <div>
          <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>학생 대상:</span>{" "}
          {ff.school_level_mode === "elementary_middle" ? "초중등" : "중고등"}
        </div>
        <div>
          <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>클리닉:</span>{" "}
          {ff.clinic_mode === "regular" ? "정규형 (필수 클리닉)" : "보충형 (불합격 관리)"}
        </div>
      </div>
    </div>
  );
}

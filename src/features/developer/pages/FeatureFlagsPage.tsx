// PATH: src/features/developer/pages/FeatureFlagsPage.tsx
// 개발자 콘솔 > 운영 설정 — feature_flags 관리 (owner/tenant 1 전용)

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Settings, ToggleLeft, ToggleRight } from "lucide-react";
import { useProgram } from "@/shared/program";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import styles from "./DeveloperPage.module.css";

type SectionMode = boolean;
type ClinicMode = "remediation" | "regular";
type SchoolLevelMode = "middle_high" | "elementary_middle";

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

export default function FeatureFlagsPage() {
  const { program, refetch } = useProgram();
  const ff = program?.feature_flags ?? {};

  // Local state for edits
  const [sectionMode, setSectionMode] = useState<string>(String(Boolean(ff.section_mode)));
  const [schoolLevel, setSchoolLevel] = useState<string>(
    (ff.school_level_mode as string) || "middle_high"
  );
  const [clinicMode, setClinicMode] = useState<string>(
    (ff.clinic_mode as string) || "remediation"
  );

  // Track if anything changed
  const currentSectionMode = String(Boolean(ff.section_mode));
  const currentSchoolLevel = (ff.school_level_mode as string) || "middle_high";
  const currentClinicMode = (ff.clinic_mode as string) || "remediation";

  const hasChanges =
    sectionMode !== currentSectionMode ||
    schoolLevel !== currentSchoolLevel ||
    clinicMode !== currentClinicMode;

  const saveMut = useMutation({
    mutationFn: async () => {
      const newFlags = {
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

  return (
    <div className={styles.panel}>
      <div className={styles.guide}>
        <Settings size={18} className={styles.guideIcon} />
        <div>
          <p className={styles.guideTitle}>운영 모드 설정</p>
          <p className={styles.guideDesc}>
            이 학원의 운영 방식을 설정합니다. 변경 시 즉시 반영됩니다.
          </p>
        </div>
      </div>

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

      {/* 현재 값 요약 */}
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

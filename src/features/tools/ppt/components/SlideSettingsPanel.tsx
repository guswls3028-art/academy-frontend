// PATH: src/features/tools/ppt/components/SlideSettingsPanel.tsx
// PPT 생성 설정 패널 — 비율, 배경, 배치, 반전, 밝기/대비

import type { PptSettings } from "../api/pptApi";

interface SlideSettingsPanelProps {
  settings: PptSettings;
  onChange: (s: PptSettings) => void;
  disabled?: boolean;
}

const RATIO_OPTIONS = [
  { value: "16:9" as const, label: "16:9", desc: "와이드" },
  { value: "4:3" as const, label: "4:3", desc: "표준" },
];

const BG_OPTIONS = [
  { value: "black", label: "검정", color: "#000" },
  { value: "dark_gray", label: "진회", color: "#1e1e1e" },
  { value: "white", label: "흰색", color: "#fff" },
];

const FIT_OPTIONS = [
  { value: "contain" as const, label: "맞춤", desc: "여백 포함" },
  { value: "cover" as const, label: "채움", desc: "일부 잘림" },
  { value: "stretch" as const, label: "늘림", desc: "꽉 채움" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 12,
      fontWeight: 600,
      color: "var(--color-text-muted)",
      marginBottom: 6,
      letterSpacing: "0.02em",
    }}>
      {children}
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  disabled,
  style,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 10px",
        borderRadius: "var(--radius-md, 8px)",
        border: selected ? "2px solid var(--color-primary)" : "1px solid var(--color-border-divider)",
        background: selected
          ? "color-mix(in srgb, var(--color-primary) 10%, var(--bg-surface))"
          : "var(--bg-surface)",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "center",
        transition: "all 0.15s",
        overflow: "hidden",
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  active,
  onClick,
  disabled,
  icon,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: "var(--radius-md, 8px)",
        border: active ? "2px solid var(--color-primary)" : "1px solid var(--color-border-divider)",
        background: active
          ? "color-mix(in srgb, var(--color-primary) 10%, var(--bg-surface))"
          : "var(--bg-surface)",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        transition: "all 0.15s",
        width: "100%",
      }}
    >
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "var(--color-primary)" : "var(--color-bg-disabled)",
        color: active ? "#fff" : "var(--color-text-muted)",
        flexShrink: 0,
        transition: "all 0.15s",
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-primary)" }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
          {desc}
        </div>
      </div>
    </button>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onReset,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const isDefault = Math.abs(value - 1.0) < 0.05;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>
          {label}
        </span>
        {!isDefault && (
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            style={{
              fontSize: 10,
              color: "var(--color-text-muted)",
              background: "none",
              border: "1px solid var(--color-border-divider)",
              borderRadius: 4,
              padding: "1px 5px",
              cursor: "pointer",
              lineHeight: 1.4,
            }}
          >
            초기화
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{
          width: "100%",
          height: 4,
          appearance: "none",
          background: `linear-gradient(to right, var(--color-primary) ${((value - min) / (max - min)) * 100}%, var(--color-bg-disabled) ${((value - min) / (max - min)) * 100}%)`,
          borderRadius: 2,
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          accentColor: "var(--color-primary)",
        }}
      />
    </div>
  );
}

export default function SlideSettingsPanel({ settings, onChange, disabled }: SlideSettingsPanelProps) {
  const update = (partial: Partial<PptSettings>) => onChange({ ...settings, ...partial });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 슬라이드 비율 */}
      <div>
        <SectionLabel>슬라이드 비율</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 6 }}>
          {RATIO_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={settings.aspect_ratio === opt.value}
              onClick={() => update({ aspect_ratio: opt.value })}
              disabled={disabled}
            >
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)" }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 1 }}>
                {opt.desc}
              </div>
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 배경색 */}
      <div>
        <SectionLabel>배경색</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap: 6 }}>
          {BG_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={settings.background === opt.value}
              onClick={() => update({ background: opt.value })}
              disabled={disabled}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <div style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: opt.color,
                border: "1px solid var(--color-border-divider-strong)",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                {opt.label}
              </span>
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 이미지 배치 */}
      <div>
        <SectionLabel>이미지 배치</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap: 6 }}>
          {FIT_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={settings.fit_mode === opt.value}
              onClick={() => update({ fit_mode: opt.value })}
              disabled={disabled}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text-primary)" }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 1 }}>
                {opt.desc}
              </div>
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 빔프로젝터 효과 */}
      <div>
        <SectionLabel>빔프로젝터 효과</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <ToggleRow
            active={settings.auto_enhance}
            onClick={() => update({ auto_enhance: !settings.auto_enhance })}
            disabled={disabled}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v1m0 16v1m-9-9h1m16 0h1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            }
            label="자동 밝기 보정"
            desc="어두운 사진 자동 보정"
          />

          <ToggleRow
            active={settings.invert}
            onClick={() => update({ invert: !settings.invert })}
            disabled={disabled}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2v20" />
                <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" />
              </svg>
            }
            label="흑백 반전"
            desc="밝은 글씨로 색상 반전"
          />

          <ToggleRow
            active={settings.grayscale}
            onClick={() => update({ grayscale: !settings.grayscale })}
            disabled={disabled}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <rect x="3" y="3" width="9" height="9" fill="currentColor" />
              </svg>
            }
            label="그레이스케일"
            desc="흑백 변환"
          />
        </div>
      </div>

      {/* 밝기 / 대비 수동 조절 */}
      <div>
        <SectionLabel>밝기 / 대비</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SliderRow
            label="밝기"
            value={settings.brightness}
            min={0.2}
            max={3.0}
            step={0.1}
            onChange={(v) => update({ brightness: v })}
            onReset={() => update({ brightness: 1.0 })}
            disabled={disabled}
          />
          <SliderRow
            label="대비"
            value={settings.contrast}
            min={0.2}
            max={3.0}
            step={0.1}
            onChange={(v) => update({ contrast: v })}
            onReset={() => update({ contrast: 1.0 })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

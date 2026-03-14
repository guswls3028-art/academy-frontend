// PATH: src/features/tools/ppt/components/SlideSettingsPanel.tsx
// PPT 생성 설정 패널 — 비율, 배경, 배치, 반전 등

import type { PptSettings } from "../api/pptApi";

interface SlideSettingsPanelProps {
  settings: PptSettings;
  onChange: (s: PptSettings) => void;
  disabled?: boolean;
}

const RATIO_OPTIONS = [
  { value: "16:9" as const, label: "16:9 와이드", desc: "빔프로젝터 표준" },
  { value: "4:3" as const, label: "4:3 표준", desc: "구형 프로젝터" },
];

const BG_OPTIONS = [
  { value: "black", label: "검정", color: "#000" },
  { value: "dark_gray", label: "진회", color: "#1e1e1e" },
  { value: "white", label: "흰색", color: "#fff" },
];

const FIT_OPTIONS = [
  { value: "contain" as const, label: "맞춤", desc: "비율 유지, 여백 포함" },
  { value: "cover" as const, label: "채움", desc: "가득 채움, 일부 잘림" },
  { value: "stretch" as const, label: "늘림", desc: "비율 무시, 꽉 채움" },
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
        padding: "8px 12px",
        borderRadius: "var(--radius-md, 8px)",
        border: selected ? "2px solid var(--color-primary)" : "1px solid var(--color-border-divider)",
        background: selected
          ? "color-mix(in srgb, var(--color-primary) 10%, var(--bg-surface))"
          : "var(--bg-surface)",
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        transition: "all 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function SlideSettingsPanel({ settings, onChange, disabled }: SlideSettingsPanelProps) {
  const update = (partial: Partial<PptSettings>) => onChange({ ...settings, ...partial });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 슬라이드 비율 */}
      <div>
        <SectionLabel>슬라이드 비율</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {RATIO_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={settings.aspect_ratio === opt.value}
              onClick={() => update({ aspect_ratio: opt.value })}
              disabled={disabled}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2, whiteSpace: "nowrap" }}>
                {opt.desc}
              </div>
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 배경색 */}
      <div>
        <SectionLabel>배경색</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {BG_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={settings.background === opt.value}
              onClick={() => update({ background: opt.value })}
              disabled={disabled}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px" }}
            >
              <div style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                background: opt.color,
                border: "1px solid var(--color-border-divider-strong)",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
                {opt.label}
              </span>
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 이미지 배치 */}
      <div>
        <SectionLabel>이미지 배치</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {FIT_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={settings.fit_mode === opt.value}
              onClick={() => update({ fit_mode: opt.value })}
              disabled={disabled}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginTop: 2, lineHeight: 1.3, whiteSpace: "nowrap" }}>
                {opt.desc}
              </div>
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 빔프로젝터 효과 — 세로 배치 (가로에선 글자가 밀림) */}
      <div>
        <SectionLabel>빔프로젝터 효과</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <OptionButton
            selected={settings.invert}
            onClick={() => update({ invert: !settings.invert })}
            disabled={disabled}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: settings.invert ? "var(--color-primary)" : "var(--color-bg-disabled)",
              flexShrink: 0,
              transition: "background 0.15s",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={settings.invert ? "#fff" : "var(--color-text-muted)"} strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2v20" />
                <path d="M12 2a10 10 0 0 1 0 20" fill={settings.invert ? "#fff" : "var(--color-text-muted)"} />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-primary)" }}>
                흑백 반전
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                어두운 배경에서 밝은 글씨로 색상 반전
              </div>
            </div>
          </OptionButton>

          <OptionButton
            selected={settings.grayscale}
            onClick={() => update({ grayscale: !settings.grayscale })}
            disabled={disabled}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: settings.grayscale ? "var(--color-primary)" : "var(--color-bg-disabled)",
              flexShrink: 0,
              transition: "background 0.15s",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={settings.grayscale ? "#fff" : "var(--color-text-muted)"} strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <rect x="3" y="3" width="9" height="9" fill={settings.grayscale ? "#fff" : "var(--color-text-muted)"} />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-primary)" }}>
                그레이스케일
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                모든 이미지를 흑백으로 변환
              </div>
            </div>
          </OptionButton>
        </div>
      </div>
    </div>
  );
}

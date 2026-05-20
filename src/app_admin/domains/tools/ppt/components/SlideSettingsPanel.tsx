// PATH: src/app_admin/domains/tools/ppt/components/SlideSettingsPanel.tsx
// PPT 생성 설정 패널 — 비율, 배경, 배치, 반전, 밝기/대비

import type { PptSettings } from "../api/ppt.api";
import styles from "./SlideSettingsPanel.module.css";

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
  { value: "black", label: "검정" },
  { value: "dark_gray", label: "진회" },
  { value: "white", label: "흰색" },
];

const FIT_OPTIONS = [
  { value: "contain" as const, label: "맞춤", desc: "여백 포함" },
  { value: "cover" as const, label: "채움", desc: "일부 잘림" },
  { value: "stretch" as const, label: "늘림", desc: "꽉 채움" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.sectionLabel}>
      {children}
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  disabled,
  className = "",
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${styles.optionButton} ${selected ? styles.optionButtonSelected : ""} ${className}`}
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
      className={`${styles.toggleRow} ${active ? styles.toggleRowActive : ""}`}
    >
      <div className={`${styles.toggleIcon} ${active ? styles.toggleIconActive : ""}`}>
        {icon}
      </div>
      <div className={styles.toggleCopy}>
        <div className={styles.toggleLabel}>
          {label}
        </div>
        <div className={styles.toggleDesc}>
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
      <div className={styles.sliderHeader}>
        <span className={styles.sliderLabel}>
          {label}
        </span>
        {!isDefault && (
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className={styles.resetButton}
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
        className={styles.slider}
      />
    </div>
  );
}

export default function SlideSettingsPanel({ settings, onChange, disabled }: SlideSettingsPanelProps) {
  const update = (partial: Partial<PptSettings>) => onChange({ ...settings, ...partial });

  return (
    <div className={styles.root}>
      {/* 슬라이드 비율 */}
      <div>
        <SectionLabel>슬라이드 비율</SectionLabel>
        <div className={styles.gridTwo}>
          {RATIO_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={settings.aspect_ratio === opt.value}
              onClick={() => update({ aspect_ratio: opt.value })}
              disabled={disabled}
            >
              <div className={styles.ratioLabel}>
                {opt.label}
              </div>
              <div className={styles.optionDesc}>
                {opt.desc}
              </div>
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 배경색 */}
      <div>
        <SectionLabel>배경색</SectionLabel>
        <div className={styles.gridThree}>
          {BG_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={settings.background === opt.value}
              onClick={() => update({ background: opt.value })}
              disabled={disabled}
              className={styles.backgroundOption}
            >
              <div className={styles.backgroundSwatch} data-tone={opt.value} />
              <span className={styles.backgroundLabel}>
                {opt.label}
              </span>
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 이미지 배치 */}
      <div>
        <SectionLabel>이미지 배치</SectionLabel>
        <div className={styles.gridThree}>
          {FIT_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={settings.fit_mode === opt.value}
              onClick={() => update({ fit_mode: opt.value })}
              disabled={disabled}
            >
              <div className={styles.fitLabel}>
                {opt.label}
              </div>
              <div className={styles.fitDesc}>
                {opt.desc}
              </div>
            </OptionButton>
          ))}
        </div>
      </div>

      {/* 빔프로젝터 효과 */}
      <div>
        <SectionLabel>빔프로젝터 효과</SectionLabel>
        <div className={styles.toggleStack}>
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
            desc="어두운 사진을 분석하여 자동으로 밝게"
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
            desc="흰 배경 → 검정, 검정 글씨 → 흰색"
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
            desc="컬러 사진을 흑백으로 변환"
          />
        </div>
      </div>

      {/* 밝기 / 대비 수동 조절 */}
      <div>
        <SectionLabel>밝기 / 대비 수동 조절</SectionLabel>
        <div className={styles.helperText}>
          자동 보정 결과가 맘에 안 들 때 직접 조절
        </div>
        <div className={styles.sliderStack}>
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

// PATH: src/shared/ui/domain/ColorPickerField.tsx
// 색상 선택 UI — 태그·강의 아이콘 등 공통

import { PRESET_COLORS } from "./constants";

type ColorPickerFieldProps = {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  disabled?: boolean;
};

export default function ColorPickerField({
  value,
  onChange,
  label = "색상",
  disabled,
}: ColorPickerFieldProps) {
  return (
    <div>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-text-muted)",
            marginBottom: 10,
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            disabled={disabled}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: c,
              border:
                value === c
                  ? "2px solid var(--color-text-primary)"
                  : "2px solid transparent",
              boxShadow:
                value === c
                  ? "0 0 0 2px var(--color-bg-surface)"
                  : "0 1px 3px rgba(0,0,0,0.2)",
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.6 : 1,
            }}
            aria-label={`색상 ${c} 선택`}
          />
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={{
              width: 32,
              height: 32,
              padding: 0,
              border: "none",
              cursor: disabled ? "default" : "pointer",
              background: "transparent",
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text-muted)",
            }}
          >
            직접 선택
          </span>
        </div>
      </div>
    </div>
  );
}

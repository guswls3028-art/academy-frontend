// PATH: src/shared/ui/domain/ColorPickerField.tsx
// 색상 선택 UI — 태그·강의 아이콘 등 공통

import type { CSSProperties } from "react";
import { PRESET_COLORS } from "./constants";
import "./ColorPickerField.css";

type ColorPickerFieldProps = {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  disabled?: boolean;
};

type SwatchStyle = CSSProperties & {
  "--color-picker-swatch": string;
};

function getSwatchStyle(color: string): SwatchStyle {
  return { "--color-picker-swatch": color };
}

export default function ColorPickerField({
  value,
  onChange,
  label = "색상",
  disabled,
}: ColorPickerFieldProps) {
  return (
    <div className="color-picker-field">
      {label && (
        <label className="color-picker-field__label">
          {label}
        </label>
      )}
      <div className="color-picker-field__body">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            disabled={disabled}
            className="color-picker-field__swatch"
            data-selected={value === c ? "true" : undefined}
            style={getSwatchStyle(c)}
            aria-pressed={value === c}
            aria-label={`색상 ${c} 선택`}
          />
        ))}
        <div className="color-picker-field__custom">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="color-picker-field__native"
            aria-label="직접 색상 선택"
          />
          <span className="color-picker-field__hint">
            직접 선택
          </span>
        </div>
      </div>
    </div>
  );
}

import { useId } from "react";
import type { EssayNumbering } from "../types";
import styles from "./EssayNumberingField.module.css";

function continuousExample(numbers: number[]): string {
  if (!numbers.length) return "전체 문항 번호 사용";
  if (numbers.length === 1) return `${numbers[0]}번`;
  if (numbers.every((number, index) => number === numbers[0] + index)) {
    return `${numbers[0]}~${numbers[numbers.length - 1]}번`;
  }
  return numbers.slice(0, 3).map(number => `${number}번`).join(", ") + (numbers.length > 3 ? " …" : "");
}

export default function EssayNumberingField({ value, onChange, numbers, help, disabled }: {
  value: EssayNumbering;
  onChange: (value: EssayNumbering) => void;
  numbers: number[];
  help: string;
  disabled?: boolean;
}) {
  const id = useId();
  const options = [
    { mode: "continuous", label: "전체 순서대로", example: continuousExample(numbers) },
    { mode: "separate", label: "서술형끼리", example: numbers.length > 1
      ? `서술형 1~${numbers.length}번` : numbers.length ? "서술형 1번" : "서술형 1번부터 시작" },
  ] as const;

  return (
    <fieldset className={styles.field} disabled={disabled} aria-describedby={`${id}-help`}>
      <legend>서술형 번호</legend>
      <div className={styles.options}>
        {options.map(({ mode, label, example }) => (
          <label key={mode} className={styles.option}>
            <input type="radio" name={id} value={mode} checked={value === mode} onChange={() => onChange(mode)} />
            <span><strong>{label}</strong><small>{example}</small></span>
          </label>
        ))}
      </div>
      <p id={`${id}-help`} className={styles.help}>{help}</p>
    </fieldset>
  );
}

// PATH: src/features/videos/ui/ToggleSwitch.tsx

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export default function ToggleSwitch({ checked, onChange, disabled = false }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={[
        "relative h-6 w-11 rounded-full border transition",
        "border-[var(--border-divider)]",
        checked ? "bg-[var(--color-primary)]" : "bg-[var(--bg-app)]",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-[var(--bg-surface-soft)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition",
          checked ? "left-5" : "left-0.5",
        ].join(" ")}
      />
    </button>
  );
}

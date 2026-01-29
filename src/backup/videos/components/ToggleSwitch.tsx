// src/features/videos/components/ToggleSwitch.tsx

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
      className={`relative h-5 w-10 rounded-full transition
        ${checked ? "bg-green-500" : "bg-gray-400"}
        ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition
          ${checked ? "left-5" : "left-0.5"}
        `}
      />
    </button>
  );
}

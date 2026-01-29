// PATH: src/features/scores/components/HomeworkScoreInput.tsx
// 역할: 조교가 "대충" 입력하는 UI (32문항 / 80%)

type Props = {
  value: number | null;
  locked: boolean;
  onChange: (v: number | null) => void;
};

export default function HomeworkScoreInput({
  value,
  locked,
  onChange,
}: Props) {
  if (locked) {
    return <span className="text-gray-400">{value ?? "-"}</span>;
  }

  return (
    <input
      type="number"
      min={0}
      max={100}
      step={5}
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : Number(e.target.value))
      }
      className="w-16 rounded border px-1 py-0.5 text-sm"
      placeholder="%"
    />
  );
}

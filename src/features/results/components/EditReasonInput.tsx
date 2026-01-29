/**
 * PATH: src/features/results/components/EditReasonInput.tsx
 *
 * ✅ EditReasonInput
 *
 * 책임:
 * - 편집 사유 입력 (UI 전용)
 *
 * ⚠️ Phase 4:
 * - 서버 전송 ❌
 * - 상태 보존만
 */

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function EditReasonInput({ value, onChange }: Props) {
  return (
    <div className="border-b bg-yellow-50 px-4 py-2">
      <div className="mb-1 text-xs font-semibold text-yellow-800">
        편집 사유 (선택)
      </div>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예: 주관식 채점 보정"
        className="w-full rounded border px-2 py-1 text-xs"
      />
    </div>
  );
}

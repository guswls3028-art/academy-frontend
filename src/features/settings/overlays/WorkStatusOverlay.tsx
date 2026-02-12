// PATH: src/features/settings/overlays/WorkStatusOverlay.tsx
import { Button } from "@/shared/ui/ds";

export default function WorkStatusOverlay() {
  return (
    <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] shadow-xl">
      <div className="font-black mb-2">근무 상태</div>

      <div className="flex gap-2">
        <Button intent="primary" size="sm">출근</Button>
        <Button intent="secondary" size="sm">휴식</Button>
        <Button intent="secondary" size="sm">복귀</Button>
        <Button intent="danger" size="sm">퇴근</Button>
      </div>

      <div className="mt-3 text-xs text-[var(--color-text-muted)]">
        근무중 · 02:14:33
      </div>
    </div>
  );
}

// PATH: src/features/settings/overlays/WorkStatusOverlay.tsx
export default function WorkStatusOverlay() {
  return (
    <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] shadow-xl">
      <div className="font-black mb-2">근무 상태</div>

      <div className="flex gap-2">
        <button className="btn-primary">출근</button>
        <button className="btn">휴식</button>
        <button className="btn">복귀</button>
        <button className="btn-danger">퇴근</button>
      </div>

      <div className="mt-3 text-xs text-[var(--color-text-muted)]">
        근무중 · 02:14:33
      </div>
    </div>
  );
}

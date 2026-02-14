// PATH: src/features/exams/components/AssetReadinessBadge.tsx
import { ExamAsset } from "../api/assets";
import { isAssetsReady } from "../hooks/useExamAssets";

export default function AssetReadinessBadge({ assets }: { assets: ExamAsset[] }) {
  const ready = isAssetsReady(assets);

  return (
    <span
      className={`ds-status-badge ${ready ? "!bg-emerald-600/10 !text-emerald-600" : "!bg-red-600/10 !text-red-600"}`}
    >
      {ready ? "운영 준비 완료" : "자산 누락"}
    </span>
  );
}

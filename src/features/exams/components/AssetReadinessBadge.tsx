// PATH: src/features/exams/components/AssetReadinessBadge.tsx
import { ExamAsset } from "../api/assets";
import { isAssetsReady } from "../hooks/useExamAssets";

export default function AssetReadinessBadge({ assets }: { assets: ExamAsset[] }) {
  const ready = isAssetsReady(assets);

  return (
    <span className="ds-status-badge" data-tone={ready ? "success" : "danger"}>
      {ready ? "운영 준비 완료" : "자산 누락"}
    </span>
  );
}

import { ExamAsset } from "../../api/assets";

export default function RequireAssetsReady({
  assets,
  children,
}: {
  assets: ExamAsset[];
  children: React.ReactNode;
}) {
  // ✅ 판매/체험 모드: 항상 통과
  return <>{children}</>;
}

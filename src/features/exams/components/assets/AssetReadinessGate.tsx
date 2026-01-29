import { ExamAsset } from "../../api/assets";
import RequireAssetsReady from "../guards/RequireAssetsReady";

/**
 * ✅ Gate 단일화:
 * 실제 로직은 RequireAssetsReady가 단일진실.
 */
export default function AssetReadinessGate({
  assets,
  children,
}: {
  assets: ExamAsset[];
  children: React.ReactNode;
}) {
  return (
    <RequireAssetsReady assets={assets}>
      {children}
    </RequireAssetsReady>
  );
}

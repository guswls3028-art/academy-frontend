import { ExamAsset } from "../../api/assets";

function isReady(assets: ExamAsset[]) {
  const hasPdf = assets.some(a => a.asset_type === "problem_pdf");
  const hasOmr = assets.some(a => a.asset_type === "omr_sheet");
  return hasPdf && hasOmr;
}

export default function RequireAssetsReady({
  assets,
  children,
}: {
  assets: ExamAsset[];
  children: React.ReactNode;
}) {
  if (!isReady(assets)) {
    return (
      <div className="rounded border border-yellow-600/30 bg-yellow-600/10 p-4 text-sm text-yellow-800">
        <div className="font-semibold">운영 불가</div>
        <div className="mt-1">
          시험지 PDF 또는 OMR 답안지가 누락되었습니다.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

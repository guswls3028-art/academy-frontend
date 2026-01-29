/**
 * ExamAssetsPanel (Production)
 * - assets 단일진실: GET /exams/{id}/assets/ (regular도 template resolve)
 * - template에서만 업로드 UI 노출(봉인 정책 존중)
 * - 자산 누락 시 "제출/채점 차단 사유" 체크리스트 안내
 */

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { useAdminExam } from "../hooks/useAdminExam";
import { useExamAssets } from "../hooks/useExamAssets";

import AssetReadinessBadge from "../components/AssetReadinessBadge";
import AssetBlockNotice from "../components/assets/AssetBlockNotice";
import AssetUploadSection from "../components/assets/AssetUploadSection";
import BlockReason from "../components/BlockReason";

function hasAsset(assets: any[], t: string) {
  return (assets ?? []).some((a) => a?.asset_type === t);
}

export default function ExamAssetsPanel({ examId }: { examId: number }) {
  const { data: exam } = useAdminExam(examId);
  const q = useExamAssets(examId);
  const assets = q.data ?? [];

  const [sp] = useSearchParams();
  const sessionId = Number(sp.get("session_id"));
  const hasSession = Number.isFinite(sessionId) && sessionId > 0;

  const hasPdf = useMemo(() => hasAsset(assets, "problem_pdf"), [assets]);
  const hasOmr = useMemo(() => hasAsset(assets, "omr_sheet"), [assets]);

  if (!exam) return null;

  const isTemplate = exam.exam_type === "template";
  const isRegular = exam.exam_type === "regular";

  return (
    <div className="space-y-4">
      <div className="flex justify-between border rounded p-4 bg-[var(--bg-surface)] border-[var(--border-divider)]">
        <div>
          <div className="font-semibold text-sm text-[var(--text-primary)]">
            시험 자산
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            운영에 필요한 PDF/OMR 상태 (제출/채점 게이트)
          </div>
        </div>

        <AssetReadinessBadge assets={assets} />
      </div>

      {q.isLoading && (
        <div className="text-sm text-[var(--text-muted)]">
          자산 불러오는 중...
        </div>
      )}

      {q.isError && (
        <BlockReason
          title="자산 조회 실패"
          description={
            String((q.error as any)?.response?.data?.detail || "자산 정보를 불러오지 못했습니다.")
          }
        />
      )}

      {!q.isLoading && !q.isError && (
        <>
          {/* ✅ 운영 시험 안내 */}
          {isRegular && (
            <AssetBlockNotice
              title="읽기 전용 (운영 시험)"
              description="운영 시험은 템플릿 자산을 사용합니다. 자산 업로드/교체는 템플릿 시험에서만 가능합니다."
            />
          )}

          {/* ✅ 자산 누락 체크리스트 */}
          {(!hasPdf || !hasOmr) && (
            <div className="rounded border border-yellow-600/30 bg-yellow-600/10 p-4 text-sm text-yellow-800 space-y-2">
              <div className="font-semibold">운영 불가: 자산이 준비되지 않았습니다</div>
              <div className="text-xs">
                아래 항목이 모두 충족되어야 제출/채점 기능이 열립니다.
              </div>

              <ul className="list-disc pl-5 text-sm">
                <li className={hasPdf ? "opacity-60" : ""}>
                  시험지 PDF (problem_pdf) {hasPdf ? "✅" : "❌"}
                </li>
                <li className={hasOmr ? "opacity-60" : ""}>
                  OMR 답안지 (omr_sheet) {hasOmr ? "✅" : "❌"}
                </li>
              </ul>

              {isRegular && (
                <div className="text-xs">
                  ※ 이 시험은 <b>운영 시험</b>이라 여기서 업로드할 수 없습니다. 템플릿 시험에서 자산을 등록한 뒤 다시 확인하세요.
                </div>
              )}
            </div>
          )}

          {/* ✅ session_id 안내(자산과는 별개지만 운영 흐름상 같이 보여주면 좋음) */}
          {!hasSession && (
            <div className="rounded border bg-[var(--bg-surface-soft)] p-3 text-sm text-[var(--text-muted)]">
              ℹ️ 현재 URL에 <b>session_id</b>가 없습니다. 자산 등록과 별개로, 제출/결과/대상자 관리는 session_id가 있어야 열립니다.
            </div>
          )}

          {/* ✅ 업로드 UI는 template에서만 */}
          {isTemplate && (
            <div className="space-y-4">
              <AssetUploadSection
                examId={examId}
                assetType="problem_pdf"
                title="시험지 PDF"
                accept="application/pdf"
              />

              <AssetUploadSection
                examId={examId}
                assetType="omr_sheet"
                title="OMR 답안지"
                accept="application/pdf"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

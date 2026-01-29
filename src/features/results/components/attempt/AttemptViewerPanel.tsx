// PATH: src/features/results/components/attempt/AttemptViewerPanel.tsx

import { useMemo, useState, useEffect } from "react";
import AttemptQuestionList from "./AttemptQuestionList";
import AttemptOMRViewer from "./AttemptOMRViewer";
import AttemptMetaPanel from "./AttemptMetaPanel";

/**
 * ✅ AttemptViewerPanel
 *
 * 책임:
 * - attempt_id 기준 ResultFact(meta 포함) 시각화
 * - 문항 선택 → OMR Overlay → 메타 정보 표시
 *
 * 🔧 PATCH 요약:
 * 1️⃣ 최초 진입 시 첫 문항 자동 선택 (UX 필수)
 * 2️⃣ imageSrc / originalWidth 없을 때 meta 기반 fallback
 * 3️⃣ OMR 이미지 미준비 상태 방어 UI
 */
type Fact = {
  question_id: number;
  answer: string;
  is_correct: boolean;
  score: number;
  max_score: number;
  meta?: any;
};

type Props = {
  attemptId: number;
  facts: Fact[];

  // ✅ 외부에서 주입 가능 (권장)
  imageSrc?: string;

  // ✅ 없으면 meta에서 자동 추론
  originalWidth?: number;

  // ✅ 화면 표시용 width
  displayWidth?: number;

  // ✅ UX 옵션: 첫 문항 자동 선택
  autoSelectFirst?: boolean;
};

/**
 * 🔧 PATCH: meta 기반 image url 자동 추론
 * - backend contract가 아직 고정되지 않은 상태를 대비
 */
function inferImageSrc(facts: Fact[]): string {
  for (const f of facts) {
    const m = f.meta;
    const candidates = [
      m?.omr?.image_url,
      m?.omr?.imageUrl,
      m?.image_url,
      m?.imageUrl,
      m?.omr?.page_image_url,
    ];
    const hit = candidates.find(
      (v) => typeof v === "string" && v.length > 0
    );
    if (hit) return hit;
  }
  return "";
}

/**
 * 🔧 PATCH: original width fallback
 */
function inferOriginalWidth(facts: Fact[]): number {
  for (const f of facts) {
    const w =
      f.meta?.omr?.original_width ??
      f.meta?.omr?.originalWidth ??
      f.meta?.original_width ??
      f.meta?.originalWidth;

    const n = Number(w);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // ⚠️ 최후 fallback (scale 계산용)
  return 1000;
}

export default function AttemptViewerPanel({
  attemptId,
  facts,
  imageSrc,
  originalWidth,
  displayWidth = 520,
  autoSelectFirst = true,
}: Props) {
  /**
   * =====================================
   * 선택된 문항 상태
   * =====================================
   */
  const [selectedQuestionId, setSelectedQuestionId] =
    useState<number | null>(null);

  /**
   * 🔥 PATCH #1
   * 최초 진입 시 첫 문항 자동 선택
   * - 없으면 우측 패널이 "빈 화면" → 고장난 UX
   */
  useEffect(() => {
    if (!autoSelectFirst) return;
    if (selectedQuestionId !== null) return;
    if (facts.length === 0) return;

    setSelectedQuestionId(facts[0].question_id);
  }, [facts, selectedQuestionId, autoSelectFirst]);

  const selectedFact = useMemo(
    () =>
      facts.find((f) => f.question_id === selectedQuestionId) ??
      null,
    [facts, selectedQuestionId]
  );

  /**
   * 🔧 PATCH #2
   * imageSrc / originalWidth 최종 결정
   */
  const finalImageSrc = imageSrc || inferImageSrc(facts);
  const finalOriginalWidth =
    typeof originalWidth === "number" && originalWidth > 0
      ? originalWidth
      : inferOriginalWidth(facts);

  return (
    <div className="flex h-full gap-4">
      {/* ===============================
          LEFT: 문항 리스트
         =============================== */}
      <div className="w-52 shrink-0 border-r pr-2">
        <div className="mb-2 text-xs text-gray-500">
          attempt #{attemptId}
        </div>

        <AttemptQuestionList
          facts={facts.map((f) => ({
            question_id: f.question_id,
            is_correct: f.is_correct,
            meta: f.meta,
          }))}
          selectedQuestionId={selectedQuestionId}
          onSelect={setSelectedQuestionId}
        />
      </div>

      {/* ===============================
          RIGHT: OMR + 메타
         =============================== */}
      <div className="flex flex-1 flex-col gap-3">
        {/* 🔥 PATCH #3: OMR 이미지 미존재 방어 */}
        {!finalImageSrc ? (
          <div className="rounded border bg-gray-50 p-4 text-sm text-gray-500">
            OMR 이미지가 아직 준비되지 않았습니다.
            <br />
            <span className="text-xs">
              (권장) backend에서 meta.omr.image_url 제공 또는
              상위에서 imageSrc prop 주입
            </span>
          </div>
        ) : (
          <AttemptOMRViewer
            imageSrc={finalImageSrc}
            fact={selectedFact}
            originalWidth={finalOriginalWidth}
            displayWidth={displayWidth}
          />
        )}

        <AttemptMetaPanel fact={selectedFact} />
      </div>
    </div>
  );
}

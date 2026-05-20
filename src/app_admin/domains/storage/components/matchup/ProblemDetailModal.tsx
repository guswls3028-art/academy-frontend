// PATH: src/app_admin/domains/storage/components/matchup/ProblemDetailModal.tsx
//
// 유사 문제 상세 모달 — 좌-우 비교 뷰.
//   좌: 원본(비교 대상, source = 현재 선택한 문제)
//   우: 매치 자료(클릭한 similar problem)
//
// 둘이 한 화면에서 동시에 보여 즉시 비교 가능 — 사용자가 따로 탭 전환 안 해도 됨.

import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, Copy, Check } from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import { getMatchupProblemPresignUrl } from "../../api/matchup.api";
import type { MatchupProblem, SimilarProblem } from "../../api/matchup.api";
import styles from "./ProblemDetailModal.module.css";

type Props = {
  problem: SimilarProblem;
  sourceProblem?: MatchupProblem | null;
  sourceDocumentTitle?: string;
  onClose: () => void;
  onNavigate?: (documentId: number, problemNumber: number) => void;
};

function PaneImage({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div className={styles.imageFallback}>
        이미지를 불러올 수 없습니다
      </div>
    );
  }

  return (
    <div className={styles.imageViewport}>
      <img
        src={url}
        alt={alt}
        className={styles.problemImage}
      />
    </div>
  );
}

function similarityClass(pct: number): string {
  if (pct >= 80) return styles.similarityHigh;
  if (pct >= 60) return styles.similarityMedium;
  return styles.similarityLow;
}

export default function ProblemDetailModal({
  problem,
  sourceProblem = null,
  sourceDocumentTitle = "",
  onClose,
  onNavigate,
}: Props) {
  const [matchUrl, setMatchUrl] = useState<string | null>(problem.image_url || null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(sourceProblem?.image_url || null);
  const [copied, setCopied] = useState<"source" | "match" | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (problem.image_url) {
      setMatchUrl(problem.image_url);
      return;
    }

    let cancelled = false;
    setMatchUrl(null);
    getMatchupProblemPresignUrl(problem.id)
      .then((u) => { if (!cancelled) setMatchUrl(u); })
      .catch(() => { if (!cancelled) setMatchUrl(null); });

    return () => { cancelled = true; };
  }, [problem.id, problem.image_url]);

  const sourceProblemId = sourceProblem?.id ?? null;
  const sourceProblemImageUrl = sourceProblem?.image_url ?? null;

  useEffect(() => {
    if (!sourceProblemId) {
      setSourceUrl(null);
      return;
    }

    if (sourceProblemImageUrl) {
      setSourceUrl(sourceProblemImageUrl);
      return;
    }

    let cancelled = false;
    setSourceUrl(null);
    getMatchupProblemPresignUrl(sourceProblemId)
      .then((u) => { if (!cancelled) setSourceUrl(u); })
      .catch(() => { if (!cancelled) setSourceUrl(null); });

    return () => { cancelled = true; };
  }, [sourceProblemId, sourceProblemImageUrl]);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
  }, []);

  const handleCopy = (text: string, which: "source" | "match") => {
    if (!text) return;

    const markCopied = () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      setCopied(which);
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(null);
        copyTimerRef.current = null;
      }, 1800);
    };

    const writeText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (!writeText) return;

    void writeText(text)
      .then(markCopied)
      .catch(() => setCopied(null));
  };

  const pct = Math.round(problem.similarity * 100);
  const hasSource = !!sourceProblem;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        data-testid="matchup-detail-modal"
        className={`${styles.modal} ${hasSource ? styles.modalCompare : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={`${styles.similarityBadge} ${similarityClass(pct)}`}>
              {pct}% 유사
            </div>
            <div className={styles.titleText}>
              {hasSource
                ? "내 문제 ↔ 매치 자료 비교"
                : `Q${problem.number} 매치`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            title="닫기 (Esc)"
          >
            <X size={ICON.md} />
          </button>
        </div>

        {/* 본문: 2-pane (source가 있을 때) 또는 1-pane */}
        <div className={styles.body}>
          {hasSource && sourceProblem && (
            <div className={`${styles.pane} ${styles.sourcePane}`}>
              {/* 좌 헤더 */}
              <div className={`${styles.paneHeader} ${styles.sourceHeader}`}>
                <div className={`${styles.eyebrow} ${styles.sourceEyebrow}`}>
                  내 문제 (원본)
                </div>
                <div className={styles.problemNumber}>
                  Q{sourceProblem.number}
                </div>
                {sourceDocumentTitle && (
                  <div className={styles.documentTitle}>
                    {sourceDocumentTitle}
                  </div>
                )}
              </div>
              <PaneImage url={sourceUrl} alt={`Q${sourceProblem.number} 원본`} />
              {sourceProblem.text && (
                <div className={styles.ocrPanel}>
                  <div className={styles.ocrHeader}>
                    <span className={styles.ocrLabel}>
                      OCR 텍스트
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(sourceProblem.text || "", "source")}
                      className={`${styles.copyButton} ${copied === "source" ? styles.copyButtonActive : ""}`}
                    >
                      {copied === "source" ? <><Check size={ICON.xs} /> 복사됨</> : <><Copy size={ICON.xs} /> 복사</>}
                    </button>
                  </div>
                  <p className={styles.ocrText}>
                    {sourceProblem.text}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 우: 매치 자료 */}
          <div className={styles.pane}>
            <div className={`${styles.paneHeader} ${styles.matchHeader}`}>
              <div className={`${styles.eyebrow} ${styles.matchEyebrow}`}>
                매치 자료
              </div>
              <div className={styles.problemNumber}>
                Q{problem.number}
              </div>
              <div className={styles.documentTitle}>
                {problem.document_title}
                {problem.source_lecture_title && <> · {problem.source_lecture_title}</>}
              </div>
            </div>
            <PaneImage url={matchUrl} alt={`Q${problem.number} 매치`} />
            {problem.text && (
              <div className={styles.ocrPanel}>
                <div className={styles.ocrHeader}>
                  <span className={styles.ocrLabel}>
                    OCR 텍스트
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(problem.text, "match")}
                    className={`${styles.copyButton} ${copied === "match" ? styles.copyButtonActive : ""}`}
                  >
                    {copied === "match" ? <><Check size={ICON.xs} /> 복사됨</> : <><Copy size={ICON.xs} /> 복사</>}
                  </button>
                </div>
                <p className={styles.ocrText}>
                  {problem.text}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 하단 액션 */}
        <div className={styles.footer}>
          <Button intent="ghost" size="sm" onClick={onClose}>
            닫기
          </Button>
          {onNavigate && (
            <Button
              size="sm"
              onClick={() => {
                onNavigate(problem.document_id, problem.number);
                onClose();
              }}
              leftIcon={<ExternalLink size={ICON.sm} />}
            >
              이 매치 문서로 이동
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

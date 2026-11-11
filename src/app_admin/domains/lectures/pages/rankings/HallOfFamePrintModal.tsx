// 명예의 전당 미리보기 + 인쇄 (A4 세로, 교실 게시용)
import { useEffect, useMemo, useRef, useState } from "react";
import { Printer, Trophy, X } from "lucide-react";
import { Button, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { buildHallOfFameHtml } from "./hallOfFameHtml";
import { topRanked, type PeriodRankingEntry } from "./periodRanking";
import styles from "./LectureRankingsPage.module.css";

const TOP_OPTIONS = [3, 5, 10] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  entries: PeriodRankingEntry[];
  lectureTitle: string;
  periodLabel: string;
  scopeLabel: string;
};

export default function HallOfFamePrintModal({
  open,
  onClose,
  entries,
  lectureTitle,
  periodLabel,
  scopeLabel,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [topN, setTopN] = useState<number>(3);
  const [showScores, setShowScores] = useState(true);
  const selected = useMemo(() => topRanked(entries, topN), [entries, topN]);
  const html = useMemo(() => buildHallOfFameHtml({
    lectureTitle,
    periodLabel,
    scopeLabel,
    topN,
    showScores,
    entries: selected,
    printedAt: new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }),
  }), [lectureTitle, periodLabel, scopeLabel, topN, showScores, selected]);

  useEffect(() => {
    if (!open) return;
    const frame = iframeRef.current;
    const doc = frame?.contentDocument ?? frame?.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [open, html]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      feedback.error("인쇄 화면을 준비하지 못했습니다. 다시 시도해 주세요.");
      return;
    }
    win.focus();
    win.print();
  };

  const tiedExtra = selected.length - Math.min(topN, selected.length);

  return (
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hall-of-fame-title"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={styles.modalPanel}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Trophy size={ICON.md} aria-hidden />
            <h2 id="hall-of-fame-title">명예의 전당 출력</h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="닫기">
            <X size={ICON.md} aria-hidden />
          </button>
        </div>
        <div className={styles.modalControls}>
          <div className={styles.segment} role="group" aria-label="출력할 등수">
            {TOP_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.segmentButton}
                aria-pressed={topN === value}
                onClick={() => setTopN(value)}
              >
                1~{value}등
              </button>
            ))}
          </div>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={showScores}
              onChange={(event) => setShowScores(event.target.checked)}
            />
            점수 표시
          </label>
          <span className={styles.modalHint}>
            {selected.length}명 출력{tiedExtra > 0 ? ` · 공동 등수 ${tiedExtra}명 포함` : ""}
          </span>
          <Button
            intent="primary"
            size="sm"
            onClick={handlePrint}
            disabled={selected.length === 0}
            leftIcon={<Printer size={ICON_FOR_BUTTON.sm} aria-hidden />}
          >
            인쇄
          </Button>
        </div>
        <div className={styles.previewViewport}>
          <iframe ref={iframeRef} title="명예의 전당 미리보기" className={styles.previewFrame} />
        </div>
      </div>
    </div>
  );
}

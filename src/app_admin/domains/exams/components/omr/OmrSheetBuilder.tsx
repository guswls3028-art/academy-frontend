import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  downloadOMRPdfForTarget,
  fetchOMRPreviewForTarget,
  type OMRParams,
  type OMRTarget,
} from "@admin/domains/exams/api/omr.api";

import styles from "./OmrSheetBuilder.module.css";

const PREVIEW_ERROR_HTML = "<html><body><p>미리보기를 불러올 수 없습니다.</p></body></html>";
const MAX_MC_COUNT = 60;
const MAX_ESSAY_COUNT = 10;

type OmrSheetBuilderLayout = "page" | "modal";

type OmrSheetBuilderProps = {
  target: OMRTarget;
  initialExamTitle: string;
  initialLectureName?: string;
  initialSessionName?: string;
  initialMcCount: number;
  initialEssayCount: number;
  countsEditable?: boolean;
  layout?: OmrSheetBuilderLayout;
};

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export default function OmrSheetBuilder({
  target,
  initialExamTitle,
  initialLectureName = "",
  initialSessionName = "",
  initialMcCount,
  initialEssayCount,
  countsEditable = false,
  layout = "page",
}: OmrSheetBuilderProps) {
  const [examTitle, setExamTitle] = useState(initialExamTitle || "");
  const [lectureName, setLectureName] = useState(initialLectureName || "");
  const [sessionName, setSessionName] = useState(initialSessionName || "");
  const [mcCount, setMcCount] = useState(clampInt(initialMcCount, 0, MAX_MC_COUNT));
  const [essayCount, setEssayCount] = useState(clampInt(initialEssayCount, 0, MAX_ESSAY_COUNT));
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const previewRequestRef = useRef(0);
  const targetType = target.type;
  const targetExamId = target.type === "exam" ? target.examId : undefined;
  const requestTarget = useMemo<OMRTarget>(() => (
    targetType === "exam" && targetExamId
      ? { type: "exam", examId: targetExamId }
      : { type: "tool" }
  ), [targetType, targetExamId]);

  useEffect(() => { setExamTitle(initialExamTitle || ""); }, [initialExamTitle]);
  useEffect(() => { setLectureName(initialLectureName || ""); }, [initialLectureName]);
  useEffect(() => { setSessionName(initialSessionName || ""); }, [initialSessionName]);
  useEffect(() => {
    if (!countsEditable) setMcCount(clampInt(initialMcCount, 0, MAX_MC_COUNT));
  }, [countsEditable, initialMcCount]);
  useEffect(() => {
    if (!countsEditable) setEssayCount(clampInt(initialEssayCount, 0, MAX_ESSAY_COUNT));
  }, [countsEditable, initialEssayCount]);

  useEffect(() => {
    return () => {
      previewRequestRef.current += 1;
    };
  }, []);

  const totalCount = mcCount + essayCount;
  const params = useCallback((): OMRParams => ({
    exam_title: examTitle,
    lecture_name: lectureName,
    session_name: sessionName,
    mc_count: mcCount,
    essay_count: essayCount,
    n_choices: 5,
  }), [examTitle, lectureName, sessionName, mcCount, essayCount]);

  const loadPreview = useCallback(async () => {
    if (totalCount < 1) return;

    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setPreviewLoading(true);
    try {
      const html = await fetchOMRPreviewForTarget(requestTarget, params());
      if (previewRequestRef.current === requestId) setPreviewHtml(html);
    } catch {
      if (previewRequestRef.current === requestId) setPreviewHtml(PREVIEW_ERROR_HTML);
    } finally {
      if (previewRequestRef.current === requestId) setPreviewLoading(false);
    }
  }, [params, requestTarget, totalCount]);

  useEffect(() => {
    if (totalCount < 1) return;
    const timer = window.setTimeout(() => { void loadPreview(); }, layout === "modal" ? 250 : 550);
    return () => window.clearTimeout(timer);
  }, [examTitle, lectureName, sessionName, mcCount, essayCount, layout, loadPreview, totalCount]);

  const handleDownload = async () => {
    if (totalCount < 1) return;
    setPdfLoading(true);
    try {
      await downloadOMRPdfForTarget(requestTarget, params(), examTitle || "OMR");
      feedback.success("PDF 다운로드 완료");
    } catch {
      feedback.error("PDF 다운로드 실패");
    } finally {
      setPdfLoading(false);
    }
  };

  const setClampedMcCount = (raw: string) => {
    const parsed = Number(raw);
    if (parsed > MAX_MC_COUNT) feedback.warning(`객관식은 최대 ${MAX_MC_COUNT}문항입니다.`);
    setMcCount(clampInt(parsed || 0, 0, MAX_MC_COUNT));
  };

  const setClampedEssayCount = (raw: string) => {
    const parsed = Number(raw);
    if (parsed > MAX_ESSAY_COUNT) feedback.warning(`서술형은 최대 ${MAX_ESSAY_COUNT}문항입니다.`);
    setEssayCount(clampInt(parsed || 0, 0, MAX_ESSAY_COUNT));
  };

  return (
    <div className={`${styles.builder} ${layout === "modal" ? styles.modal : styles.page}`}>
      <section className={styles.controls} aria-label="OMR 답안지 설정">
        <div className={styles.group}>
          <div className={styles.groupTitle}>시험 정보</div>

          <label className={styles.field}>
            <span>시험명</span>
            <input
              type="text"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              className="ds-input"
              placeholder="제1회 단원평가"
            />
          </label>

          <label className={styles.field}>
            <span>강의명</span>
            <input
              type="text"
              value={lectureName}
              onChange={(e) => setLectureName(e.target.value)}
              className="ds-input"
              placeholder="선택 입력"
            />
          </label>

          <label className={styles.field}>
            <span>차시명</span>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="ds-input"
              placeholder="선택 입력"
            />
          </label>
        </div>

        <div className={styles.group}>
          <div className={styles.groupTitle}>문항 설정</div>
          {countsEditable ? (
            <div className={styles.countGrid}>
              <label className={styles.field}>
                <span>객관식</span>
                <input
                  type="number"
                  min={0}
                  max={MAX_MC_COUNT}
                  value={mcCount}
                  onChange={(e) => setClampedMcCount(e.target.value)}
                  className="ds-input"
                />
              </label>
              <label className={styles.field}>
                <span>서술형</span>
                <input
                  type="number"
                  min={0}
                  max={MAX_ESSAY_COUNT}
                  value={essayCount}
                  onChange={(e) => setClampedEssayCount(e.target.value)}
                  className="ds-input"
                />
              </label>
            </div>
          ) : (
            <div className={styles.summary}>
              {mcCount > 0 && <span>객관식 {mcCount}문항</span>}
              {mcCount > 0 && essayCount > 0 && <span> · </span>}
              {essayCount > 0 && <span>서술형 {essayCount}문항</span>}
              {totalCount === 0 && <span>문항 없음</span>}
              <span> · 총 {totalCount}문항</span>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <Button type="button" intent="primary" size="md" className="w-full" onClick={handleDownload} disabled={pdfLoading || totalCount < 1}>
            <Download size={16} aria-hidden="true" />
            {pdfLoading ? "다운로드 중..." : "PDF 다운로드"}
          </Button>
          <Button type="button" intent="secondary" size="md" className="w-full" onClick={loadPreview} disabled={previewLoading || totalCount < 1}>
            <RefreshCw size={15} aria-hidden="true" />
            {previewLoading ? "생성 중..." : "미리보기 새로고침"}
          </Button>
        </div>
      </section>

      <section className={styles.preview} aria-label="OMR 답안지 미리보기">
        {previewHtml ? (
          <iframe
            srcDoc={previewHtml}
            className={styles.previewFrame}
            title="OMR 답안지 미리보기"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className={styles.previewEmpty}>
            {previewLoading ? "미리보기 로딩 중..." : "미리보기를 준비 중입니다."}
          </div>
        )}
      </section>
    </div>
  );
}

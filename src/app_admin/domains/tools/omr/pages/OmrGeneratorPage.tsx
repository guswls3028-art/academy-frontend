// PATH: src/app_admin/domains/tools/omr/pages/OmrGeneratorPage.tsx
// OMR 답안지 생성 도구 — /admin/tools/omr
// 백엔드 SSOT 기반: 미리보기(HTML) + PDF 다운로드

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchToolsOMRPreview, downloadToolsOMRPdf } from "@admin/domains/exams/api/omr.api";

export default function OmrGeneratorPage() {
  const [examName, setExamName] = useState("제1회 단원평가");
  const [lectureName, setLectureName] = useState("수학");
  const [sessionName, setSessionName] = useState("1차시");
  const [mcCount, setMcCount] = useState(20);
  const [essayCount, setEssayCount] = useState(5);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const getParams = useCallback(() => ({
    exam_title: examName,
    lecture_name: lectureName,
    session_name: sessionName,
    mc_count: mcCount,
    essay_count: essayCount,
    n_choices: 5,
  }), [examName, lectureName, sessionName, mcCount, essayCount]);

  const loadPreview = useCallback(async () => {
    if (mcCount + essayCount < 1) return;
    setPreviewLoading(true);
    try {
      const html = await fetchToolsOMRPreview(getParams());
      setPreviewHtml(html);
    } catch {
      setPreviewHtml("<html><body><p style='padding:20px;color:#999'>미리보기를 불러올 수 없습니다.</p></body></html>");
    } finally {
      setPreviewLoading(false);
    }
  }, [getParams, mcCount, essayCount]);

  // Auto-load on mount
  useEffect(() => { loadPreview(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = async () => {
    if (mcCount + essayCount < 1) return;
    setPdfLoading(true);
    try {
      await downloadToolsOMRPdf(getParams());
      feedback.success("PDF 다운로드 완료");
    } catch {
      feedback.error("PDF 다운로드 실패");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="flex gap-6" style={{ minHeight: "calc(100vh - 200px)" }}>
      {/* ── 설정 패널 ── */}
      <div className="w-[280px] flex-shrink-0 space-y-4">
        <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">시험 정보</div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">시험명</label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
              placeholder="제1회 단원평가"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">강의명</label>
            <input
              type="text"
              value={lectureName}
              onChange={(e) => setLectureName(e.target.value)}
              className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
              placeholder="선택 입력"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">차시명</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
              placeholder="선택 입력"
            />
          </div>
        </section>

        <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">문항 설정</div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[var(--text-muted)] mb-1">객관식</label>
              <input
                type="number"
                min={0}
                max={45}
                value={mcCount}
                onChange={(e) => setMcCount(Number(e.target.value) || 0)}
                className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[var(--text-muted)] mb-1">서술형</label>
              <input
                type="number"
                min={0}
                max={10}
                value={essayCount}
                onChange={(e) => setEssayCount(Number(e.target.value) || 0)}
                className="w-full rounded border border-[var(--border-divider)] px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>
        </section>

        <div className="space-y-2">
          <Button type="button" intent="primary" size="md" className="w-full" onClick={loadPreview} disabled={previewLoading || mcCount + essayCount < 1}>
            {previewLoading ? "생성 중..." : "답안지 생성"}
          </Button>
          <Button type="button" intent="secondary" size="md" className="w-full" onClick={handleDownload} disabled={pdfLoading || mcCount + essayCount < 1}>
            {pdfLoading ? "다운로드 중..." : "PDF 다운로드"}
          </Button>
        </div>

        <div className="rounded bg-[var(--bg-surface-soft)] p-3 text-xs text-[var(--text-muted)] leading-relaxed">
          <b>사용 안내</b><br />
          1. 시험 정보와 문항 수를 입력하세요.<br />
          2. "답안지 생성"을 클릭하면 미리보기가 갱신됩니다.<br />
          3. "PDF 다운로드"로 실제 PDF 파일을 받으세요.<br />
          4. 시험 탭에서도 답안 등록 후 OMR 탭에서 다운로드 가능합니다.
        </div>
      </div>

      {/* ── 미리보기 ── */}
      <div className="flex-1 rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] overflow-hidden">
        {previewHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={previewHtml}
            className="w-full h-full border-0"
            style={{ minHeight: 600 }}
            title="OMR 답안지 미리보기"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]" style={{ minHeight: 600 }}>
            {previewLoading ? "미리보기 로딩 중..." : "\"답안지 생성\"을 클릭하세요."}
          </div>
        )}
      </div>
    </div>
  );
}

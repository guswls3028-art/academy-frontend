// PATH: src/app_admin/domains/storage/pages/MatchupPage.tsx
// 매치업 메인 페이지 — 2-패널 (문서 목록 + 문제 그리드/유사 추천)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, AlertTriangle, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchMatchupDocuments,
  uploadMatchupDocument,
  deleteMatchupDocument,
  retryMatchupDocument,
  fetchMatchupProblems,
} from "../api/matchup.api";
import type { SimilarProblem } from "../api/matchup.api";
import { useMatchupPolling } from "../hooks/useMatchupPolling";
import DocumentList from "../components/matchup/DocumentList";
import DocumentUploadModal from "../components/matchup/DocumentUploadModal";
import ProblemGrid from "../components/matchup/ProblemGrid";
import SimilarResults from "../components/matchup/SimilarResults";
import ProblemDetailModal from "../components/matchup/ProblemDetailModal";
import DocumentPreviewModal from "../components/matchup/DocumentPreviewModal";
import MatchupEmptyState from "../components/matchup/MatchupEmptyState";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

export default function MatchupPage() {
  const qc = useQueryClient();
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailProblem, setDetailProblem] = useState<SimilarProblem | null>(null);
  const [previewDocId, setPreviewDocId] = useState<number | null>(null);
  const [pendingNavigateNumber, setPendingNavigateNumber] = useState<number | null>(null);

  // ── 문서 목록 ──
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["matchup-documents"],
    queryFn: fetchMatchupDocuments,
  });

  const progressMap = useMatchupPolling(documents);

  // ── 문제 목록 ──
  const selectedDoc = documents.find((d) => d.id === selectedDocId);
  const { data: problems = [], isLoading: problemsLoading } = useQuery({
    queryKey: ["matchup-problems", selectedDocId],
    queryFn: () => fetchMatchupProblems(selectedDocId!),
    enabled: !!selectedDocId && selectedDoc?.status === "done",
  });

  // 업로드 모달에 넘길 자동완성 값 — 기존 문서에서 unique 추출
  const existingTitles = useMemo(
    () => documents.map((d) => d.title).filter(Boolean),
    [documents],
  );
  const subjectSuggestions = useMemo(
    () => Array.from(new Set(documents.map((d) => d.subject).filter(Boolean))).sort(),
    [documents],
  );
  const gradeLevelSuggestions = useMemo(
    () => Array.from(new Set(documents.map((d) => d.grade_level).filter(Boolean))).sort(),
    [documents],
  );

  // 선택된 문서의 문제 번호 중복/결손 감지 (과분할 힌트)
  const numberAnomalies = useMemo(() => {
    if (problems.length === 0) return { duplicates: 0, gaps: 0 };
    const nums = problems.map((p) => p.number).sort((a, b) => a - b);
    const duplicates = nums.length - new Set(nums).size;
    let gaps = 0;
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] !== nums[i - 1] && nums[i] - nums[i - 1] > 1) gaps += 1;
    }
    return { duplicates, gaps };
  }, [problems]);

  // ── 핸들러 ──
  const handleUpload = useCallback(
    async (payload: { file: File; title: string; subject: string; grade_level: string }) => {
      await uploadMatchupDocument(payload);
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      feedback.success("업로드 완료. AI 분석 진행률은 좌측 목록에서 확인됩니다.");
    },
    [qc],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      await deleteMatchupDocument(id);
      if (selectedDocId === id) {
        setSelectedDocId(null);
        setSelectedProblemId(null);
      }
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      feedback.success("문서가 삭제되었습니다.");
    },
    [qc, selectedDocId],
  );

  const handleRetry = useCallback(
    async (id: number) => {
      await retryMatchupDocument(id);
      // 재시도 시 이전 문제는 삭제되므로 선택 해제 (API 404 방지)
      if (selectedDocId === id) setSelectedProblemId(null);
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      qc.invalidateQueries({ queryKey: ["matchup-problems", id] });
      feedback.success("재분석을 시작합니다.");
    },
    [qc, selectedDocId],
  );

  const handleSelectDoc = useCallback((id: number) => {
    setSelectedDocId(id);
    setSelectedProblemId(null);
  }, []);

  const handleNavigateToProblem = useCallback((documentId: number, problemNumber: number) => {
    setSelectedDocId(documentId);
    setPendingNavigateNumber(problemNumber);
    qc.invalidateQueries({ queryKey: ["matchup-problems", documentId] });
  }, [qc]);

  // pendingNavigateNumber 처리는 useEffect에서 (렌더 중 setState 금지)
  useEffect(() => {
    if (!pendingNavigateNumber || problems.length === 0) return;
    const target = problems.find((p) => p.number === pendingNavigateNumber);
    if (target) {
      setSelectedProblemId(target.id);
      setPendingNavigateNumber(null);
    }
  }, [pendingNavigateNumber, problems]);

  // 선택된 문제 카드로 스크롤
  const gridContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedProblemId || !gridContainerRef.current) return;
    const node = gridContainerRef.current.querySelector(
      `[data-problem-id="${selectedProblemId}"]`,
    ) as HTMLElement | null;
    if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedProblemId]);

  // ── 빈 상태 ──
  if (!docsLoading && documents.length === 0) {
    return (
      <>
        <MatchupEmptyState onUpload={() => setUploadOpen(true)} />
        {uploadOpen && (
          <DocumentUploadModal
            onClose={() => setUploadOpen(false)}
            onUpload={handleUpload}
            existingTitles={existingTitles}
            subjectSuggestions={subjectSuggestions}
            gradeLevelSuggestions={gradeLevelSuggestions}
          />
        )}
      </>
    );
  }

  const isFailed = selectedDoc?.status === "failed";
  const isNoneDetected = selectedDoc?.status === "done" && selectedDoc.meta?.segmentation_method === "none";

  return (
    <>
      <div className={css.root}>
        <div className={css.body}>
          {/* 좌측: 문서 목록 */}
          <div className={css.tree}>
            <DocumentList
              documents={documents}
              selectedId={selectedDocId}
              onSelect={handleSelectDoc}
              onUpload={() => setUploadOpen(true)}
              onDelete={handleDelete}
              onRetry={handleRetry}
              progressMap={progressMap}
            />
          </div>

          {/* 우측: 문제 + 유사 추천 */}
          <div className={css.gridWrap}>
            {!selectedDocId ? (
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                height: "100%", color: "var(--color-text-muted)", fontSize: 14,
              }}>
                <Sparkles size={32} style={{ marginBottom: "var(--space-3)", opacity: 0.4 }} />
                좌측에서 문서를 선택하세요
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", height: "100%" }}>
                {/* 문서 제목 */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
                    {selectedDoc?.title}
                  </h3>
                  {selectedDoc && (
                    <button
                      onClick={() => setPreviewDocId(selectedDoc.id)}
                      data-testid="matchup-doc-preview-btn"
                      title="원본 PDF/이미지 미리보기"
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 11, padding: "3px 10px", borderRadius: 4,
                        background: "var(--color-bg-surface-soft)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border-divider)",
                        cursor: "pointer",
                      }}
                    >
                      <Eye size={12} />
                      원본 보기
                    </button>
                  )}
                  {selectedDoc?.subject && (
                    <span
                      title="과목"
                      style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 4,
                        background: "var(--color-bg-surface-soft)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border-divider)",
                        fontWeight: 600,
                      }}
                    >
                      {selectedDoc.subject}
                    </span>
                  )}
                  {selectedDoc?.status === "processing" && progressMap[selectedDoc.id] && progressMap[selectedDoc.id].percent > 0 && (
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 4,
                      background: "color-mix(in srgb, var(--color-brand-primary) 10%, transparent)",
                      color: "var(--color-brand-primary)", fontWeight: 600,
                    }}>
                      {progressMap[selectedDoc.id].stepName} {Math.round(progressMap[selectedDoc.id].percent)}%
                    </span>
                  )}
                </div>

                {/* 실패 상세 배너 — error_message를 항상 노출 (hover만으로는 찾기 어려움) */}
                {isFailed && (
                  <div data-testid="matchup-failed-banner" style={{
                    flexShrink: 0,
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    background: "color-mix(in srgb, var(--color-danger) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
                    display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                  }}>
                    <AlertTriangle size={18} style={{ color: "var(--color-danger)", flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-danger)", marginBottom: 2 }}>
                        분석 실패
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                        {selectedDoc?.error_message || "원인을 확인할 수 없는 오류입니다. 재시도해 주세요."}
                      </div>
                    </div>
                    <Button
                      intent="ghost"
                      size="sm"
                      onClick={() => selectedDoc && handleRetry(selectedDoc.id)}
                    >
                      <RefreshCw size={13} style={{ marginRight: 4 }} />
                      재시도
                    </Button>
                  </div>
                )}

                {/* 미검출(none) 가이드 배너 */}
                {isNoneDetected && (
                  <div data-testid="matchup-none-banner" style={{
                    flexShrink: 0,
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    background: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)",
                    display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                  }}>
                    <AlertTriangle size={18} style={{ color: "var(--color-warning)", flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-warning)", marginBottom: 4 }}>
                        문제 영역을 찾지 못해 페이지 단위로 처리되었습니다
                      </div>
                      <ul style={{
                        fontSize: 12, color: "var(--color-text-secondary)",
                        lineHeight: 1.6, margin: 0, paddingLeft: "var(--space-4)",
                      }}>
                        <li>스캔 해상도를 높여 다시 시도해 주세요 (폰 카메라는 정면, 200dpi 이상 권장)</li>
                        <li>여러 페이지를 한 장에 담지 말고, 한 페이지씩 찍어주세요</li>
                        <li>기울기·그림자를 최소화하면 문항 인식이 좋아집니다</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* 과분할 감지 힌트 — 번호 중복/결손이 있을 때만 노출 */}
                {selectedDoc?.status === "done" && (numberAnomalies.duplicates > 0 || numberAnomalies.gaps > 0) && (
                  <div style={{
                    flexShrink: 0,
                    padding: "6px var(--space-3)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-bg-surface-soft)",
                    fontSize: 11, color: "var(--color-text-muted)",
                    display: "flex", alignItems: "center", gap: "var(--space-2)",
                  }}>
                    <AlertTriangle size={12} style={{ color: "var(--color-warning)" }} />
                    <span>
                      문항 번호에 중복·빈칸이 감지됐습니다
                      {numberAnomalies.duplicates > 0 && ` · 중복 ${numberAnomalies.duplicates}건`}
                      {numberAnomalies.gaps > 0 && ` · 빈칸 ${numberAnomalies.gaps}구간`}
                      . 원본과 대조해 주세요.
                    </span>
                  </div>
                )}

                {/* 본문: 좌 문제 그리드 + 우 유사 추천 */}
                <div style={{ display: "flex", gap: "var(--space-4)", flex: 1, minHeight: 0 }}>
                  <div ref={gridContainerRef} style={{ flex: 3, minWidth: 0, overflowY: "auto" }}>
                    <h4 style={{
                      fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)",
                      margin: "0 0 var(--space-3) 0",
                    }}>
                      추출된 문제
                    </h4>
                    <ProblemGrid
                      problems={problems}
                      loading={problemsLoading}
                      selectedProblemId={selectedProblemId}
                      onSelectProblem={setSelectedProblemId}
                      documentStatus={selectedDoc?.status}
                      fileSizeBytes={selectedDoc?.size_bytes}
                      progressPercent={selectedDoc ? progressMap[selectedDoc.id]?.percent : undefined}
                      progressStepName={selectedDoc ? progressMap[selectedDoc.id]?.stepName : undefined}
                    />
                  </div>

                  <div style={{
                    flex: 2, minWidth: 240, overflowY: "auto",
                    borderLeft: "1px solid var(--color-border-divider)",
                    paddingLeft: "var(--space-4)",
                  }}>
                    <h4 style={{
                      fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)",
                      margin: "0 0 var(--space-3) 0",
                      display: "flex", alignItems: "center", gap: "var(--space-1)",
                    }}>
                      <Sparkles size={14} />
                      유사 문제 추천
                    </h4>
                    <SimilarResults
                      problemId={selectedProblemId}
                      onSelectSimilar={setDetailProblem}
                      totalDocumentCount={documents.length}
                      sourceDocumentId={selectedDocId}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {uploadOpen && (
        <DocumentUploadModal
          onClose={() => setUploadOpen(false)}
          onUpload={handleUpload}
          existingTitles={existingTitles}
          subjectSuggestions={subjectSuggestions}
          gradeLevelSuggestions={gradeLevelSuggestions}
        />
      )}

      {previewDocId && (() => {
        const doc = documents.find((d) => d.id === previewDocId);
        return doc ? (
          <DocumentPreviewModal
            documentId={previewDocId}
            documentTitle={doc.title}
            onClose={() => setPreviewDocId(null)}
          />
        ) : null;
      })()}

      {detailProblem && (
        <ProblemDetailModal
          problem={detailProblem}
          onClose={() => setDetailProblem(null)}
          onNavigate={handleNavigateToProblem}
        />
      )}
    </>
  );
}

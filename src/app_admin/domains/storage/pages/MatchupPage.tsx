// PATH: src/app_admin/domains/storage/pages/MatchupPage.tsx
// 매치업 메인 페이지 — 2-패널 (문서 목록 + 문제 그리드/유사 추천)

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchMatchupDocuments,
  uploadMatchupDocument,
  deleteMatchupDocument,
  retryMatchupDocument,
  fetchMatchupProblems,
} from "../api/matchup.api";
import type { MatchupDocument, SimilarProblem } from "../api/matchup.api";
import { useMatchupPolling } from "../hooks/useMatchupPolling";
import DocumentList from "../components/matchup/DocumentList";
import DocumentUploadModal from "../components/matchup/DocumentUploadModal";
import ProblemGrid from "../components/matchup/ProblemGrid";
import SimilarResults from "../components/matchup/SimilarResults";
import ProblemDetailModal from "../components/matchup/ProblemDetailModal";
import MatchupEmptyState from "../components/matchup/MatchupEmptyState";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

export default function MatchupPage() {
  const qc = useQueryClient();
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailProblem, setDetailProblem] = useState<SimilarProblem | null>(null);

  // ── 문서 목록 ──
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["matchup-documents"],
    queryFn: fetchMatchupDocuments,
  });

  // 진행률 폴링
  useMatchupPolling(documents);

  // ── 문제 목록 ──
  const selectedDoc = documents.find((d) => d.id === selectedDocId);
  const { data: problems = [], isLoading: problemsLoading } = useQuery({
    queryKey: ["matchup-problems", selectedDocId],
    queryFn: () => fetchMatchupProblems(selectedDocId!),
    enabled: !!selectedDocId && selectedDoc?.status === "done",
  });

  // ── 핸들러 ──
  const handleUpload = useCallback(
    async (payload: { file: File; title: string; subject: string; grade_level: string }) => {
      await uploadMatchupDocument(payload);
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      feedback.success("문서가 업로드되었습니다. AI 분석을 시작합니다.");
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
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      feedback.success("재분석을 시작합니다.");
    },
    [qc],
  );

  const handleSelectDoc = useCallback((id: number) => {
    setSelectedDocId(id);
    setSelectedProblemId(null);
  }, []);

  const handleNavigateToProblem = useCallback((documentId: number, problemNumber: number) => {
    setSelectedDocId(documentId);
    // 문제 목록이 로드된 후 해당 문제 선택 — 약간의 지연 필요
    setTimeout(() => {
      // problems 쿼리가 갱신되면 해당 번호의 문제 ID를 찾아 선택
      qc.invalidateQueries({ queryKey: ["matchup-problems", documentId] });
    }, 300);
  }, [qc]);

  // ── 빈 상태 ──
  if (!docsLoading && documents.length === 0) {
    return (
      <>
        <MatchupEmptyState onUpload={() => setUploadOpen(true)} />
        {uploadOpen && (
          <DocumentUploadModal
            onClose={() => setUploadOpen(false)}
            onUpload={handleUpload}
          />
        )}
      </>
    );
  }

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
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
                    {selectedDoc?.title}
                  </h3>
                  {selectedDoc?.subject && (
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 4,
                      background: "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))",
                      color: "var(--color-brand-primary)", fontWeight: 600,
                    }}>
                      {selectedDoc.subject}
                    </span>
                  )}
                </div>

                {/* 본문: 좌 문제 그리드 + 우 유사 추천 */}
                <div style={{ display: "flex", gap: "var(--space-4)", flex: 1, minHeight: 0 }}>
                  {/* 문제 그리드 (좌측 60%) */}
                  <div style={{ flex: 3, minWidth: 0, overflowY: "auto" }}>
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
                    />
                  </div>

                  {/* 유사 문제 추천 (우측 40%) */}
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
        />
      )}

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

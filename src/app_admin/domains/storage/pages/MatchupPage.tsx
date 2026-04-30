// PATH: src/app_admin/domains/storage/pages/MatchupPage.tsx
// 매치업 메인 페이지 — 2-패널 (문서 목록 + 문제 그리드/유사 추천)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Sparkles, AlertTriangle, RefreshCw, Eye, FolderOpen, BookOpen, Crop, FileText, ClipboardList } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import api from "@/shared/api/axios";
import { asyncStatusStore } from "@/shared/ui/asyncStatus";
import {
  fetchMatchupDocuments,
  uploadMatchupDocument,
  deleteMatchupDocument,
  retryMatchupDocument,
  fetchMatchupProblems,
  updateMatchupDocument,
  renameMatchupCategory,
  assignMatchupCategory,
  fetchHitReportDraft,
  upsertHitReportEntries,
} from "../api/matchup.api";
import type { SimilarProblem } from "../api/matchup.api";
import { useMatchupPolling } from "../hooks/useMatchupPolling";
import DocumentList from "../components/matchup/DocumentList";
import DocumentUploadModal from "../components/matchup/DocumentUploadModal";
import PromoteFromInventoryModal from "../components/matchup/PromoteFromInventoryModal";
import ProblemGrid from "../components/matchup/ProblemGrid";
import SimilarResults from "../components/matchup/SimilarResults";
import CrossMatchesPanel from "../components/matchup/CrossMatchesPanel";
import ProblemDetailModal from "../components/matchup/ProblemDetailModal";
import DocumentPreviewModal from "../components/matchup/DocumentPreviewModal";
import ManualCropModal from "../components/matchup/ManualCropModal";
import HitReportEditor from "../components/matchup/HitReportEditor";
import MatchupEmptyState from "../components/matchup/MatchupEmptyState";
import { getDocumentIntent } from "../components/matchup/documentIntent";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

function hasAsyncWorkerTask(id: string): boolean {
  return asyncStatusStore
    .getState()
    .some((task) => task.id === id || task.meta?.jobId === id);
}

export default function MatchupPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDocId = (() => {
    const raw = searchParams.get("docId");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const [selectedDocId, setSelectedDocIdState] = useState<number | null>(initialDocId);
  const setSelectedDocId = useCallback((id: number | null) => {
    setSelectedDocIdState(id);
    // URL ↔ 상태 동기화: 저장소 explorer에서 ?docId=N으로 진입 가능
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("docId", String(id));
      else next.delete("docId");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadIntent, setUploadIntent] = useState<"reference" | "test">("reference");
  // 업로드 모달이 카테고리 컨텍스트에서 열릴 때 prefill 값 (빈 문자열이면 비어있는 상태로 시작)
  const [uploadDefaultCategory, setUploadDefaultCategory] = useState<string>("");
  // 저장소→매치업 승격 모달
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteDefaultCategory, setPromoteDefaultCategory] = useState<string>("");
  const [detailProblem, setDetailProblem] = useState<SimilarProblem | null>(null);
  const [previewDocId, setPreviewDocId] = useState<number | null>(null);
  const [cropDocId, setCropDocId] = useState<number | null>(null);
  const [hitReportDocId, setHitReportDocId] = useState<number | null>(null);
  // 적중 보고서 찜 — 시험지 doc 활성 시에만. selectedProblemId(시험지 문항)별 별표 후보 problem id Set.
  // 매치업 작업 중에 후보를 찜해두면 적중 보고서 작성기 진입 시 자동 선택됨.
  const [hitReportId, setHitReportId] = useState<number | null>(null);
  // examProblemId -> Set<candidateProblemId>
  const [pinsByExamPid, setPinsByExamPid] = useState<Record<number, Set<number>>>({});
  const [pendingNavigateNumber, setPendingNavigateNumber] = useState<number | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"similar" | "cross">("similar");
  const [intentUpdating, setIntentUpdating] = useState(false);
  const [categoryEditing, setCategoryEditing] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);

  // ── 문서 목록 ──
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["matchup-documents"],
    queryFn: fetchMatchupDocuments,
  });

  const progressMap = useMatchupPolling(documents);

  const openUpload = useCallback(
    (intent: "reference" | "test" = "reference", defaultCategory?: string) => {
      setUploadIntent(intent);
      setUploadDefaultCategory(defaultCategory ?? "");
      setUploadOpen(true);
    },
    [],
  );

  const openPromote = useCallback((defaultCategory?: string) => {
    setPromoteDefaultCategory(defaultCategory ?? "");
    setPromoteOpen(true);
  }, []);

  const handleRenameCategory = useCallback(
    async (from: string, to: string) => {
      if (!from || from === to) return;
      const res = await renameMatchupCategory({ from, to });
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      const trimmed = to.trim();
      if (res.updated > 0) {
        feedback.success(
          trimmed
            ? `"${from}" → "${trimmed}" (${res.updated}건)`
            : `"${from}" 카테고리를 미분류로 이동했습니다 (${res.updated}건)`,
        );
      } else {
        feedback.info("변경할 문서가 없습니다.");
      }
    },
    [qc],
  );

  const handleClearCategory = useCallback(
    async (name: string) => {
      if (!name) return;
      const targetIds = documents
        .filter((d) => (d.category || "").trim() === name)
        .map((d) => d.id);
      if (targetIds.length === 0) return;
      const res = await assignMatchupCategory({
        documentIds: targetIds,
        category: "",
      });
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      feedback.success(`"${name}" 카테고리의 ${res.updated}개 문서를 미분류로 이동했습니다.`);
    },
    [documents, qc],
  );

  // 처리 중 doc을 우상단 작업박스에 자동 재등록 (페이지 새로고침/탭 이동 후에도 진행률 유지)
  useEffect(() => {
    documents.forEach((d) => {
      if (d.status !== "processing" && d.status !== "pending") return;
      if (d.ai_job_id) {
        if (hasAsyncWorkerTask(d.ai_job_id)) return;
        asyncStatusStore.addWorkerJob(
          `매치업 분석: ${d.title}`,
          d.ai_job_id,
          "matchup_analysis",
        );
      } else {
        const watchId = `matchup-doc-${d.id}`;
        if (hasAsyncWorkerTask(watchId)) return;
        asyncStatusStore.addWorkerJob(
          `매치업 분석 준비 중: ${d.title}`,
          watchId,
          "matchup_document_watch",
        );
      }
    });
  }, [documents]);

  // ── 문제 목록 ──
  const selectedDoc = documents.find((d) => d.id === selectedDocId);
  const selectedDocIntent = selectedDoc ? getDocumentIntent(selectedDoc) : "reference";

  // 시험지(test) doc 진입 시 적중 보고서 draft 자동 로드 → pinnedIds Set 구성.
  // 사용자가 매치업 작업 중에 후보를 찜해두면 적중 보고서 작성기 진입 시 자동 선택된 상태로 표시.
  useEffect(() => {
    if (!selectedDocId || selectedDocIntent !== "test") {
      setHitReportId(null);
      setPinsByExamPid({});
      return;
    }
    let cancelled = false;
    fetchHitReportDraft(selectedDocId)
      .then((data) => {
        if (cancelled) return;
        setHitReportId(data.report.id);
        const map: Record<number, Set<number>> = {};
        for (const ep of data.exam_problems) {
          if (ep.entry?.selected_problem_ids?.length) {
            map[ep.id] = new Set(ep.entry.selected_problem_ids);
          }
        }
        setPinsByExamPid(map);
      })
      .catch(() => {
        // 시험지가 아니거나(400) 다른 에러면 silent — 매치업 작업에 영향 없음
        setHitReportId(null);
        setPinsByExamPid({});
      });
    return () => { cancelled = true; };
  }, [selectedDocId, selectedDocIntent]);

  const handleTogglePin = useCallback((candidateId: number, _candidate: SimilarProblem) => {
    if (!hitReportId || !selectedProblemId) return;
    const examPid = selectedProblemId;
    const cur = pinsByExamPid[examPid] || new Set<number>();
    const has = cur.has(candidateId);
    const next = new Set(cur);
    if (has) next.delete(candidateId);
    else next.add(candidateId);

    setPinsByExamPid((prev) => ({ ...prev, [examPid]: next }));

    upsertHitReportEntries(hitReportId, [
      {
        exam_problem_id: examPid,
        selected_problem_ids: Array.from(next),
        comment: "",
        order: 0,
      },
    ]).then(() => {
      feedback.success(has ? "보고서에서 뺐습니다" : "보고서에 담았습니다");
    }).catch(() => {
      setPinsByExamPid((prev) => ({ ...prev, [examPid]: cur }));
      feedback.error("저장 실패");
    });
  }, [hitReportId, selectedProblemId, pinsByExamPid]);

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
  const categorySuggestions = useMemo(
    () => Array.from(new Set(documents.map((d) => d.category || "").filter(Boolean))).sort(),
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
    async (payload: { file: File; title: string; category: string; subject: string; grade_level: string }) => {
      const doc = await uploadMatchupDocument({ ...payload, intent: uploadIntent });
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      if (doc.ai_job_id) {
        asyncStatusStore.addWorkerJob(
          `매치업 분석: ${doc.title || payload.file.name}`,
          doc.ai_job_id,
          "matchup_analysis",
        );
      } else if (doc.id) {
        asyncStatusStore.addWorkerJob(
          `매치업 분석 준비 중: ${doc.title || payload.file.name}`,
          `matchup-doc-${doc.id}`,
          "matchup_document_watch",
        );
      }
      feedback.success("업로드 완료. 우상단 작업 상자에서 분석 진행률 확인.");
    },
    [qc, uploadIntent],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      await deleteMatchupDocument(id);
      if (selectedDocId === id) {
        setSelectedDocId(null);
        setSelectedProblemId(null);
      }
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      // 사용자에게 storage-as-canonical 모델을 자명하게 — 원본은 살아있음
      feedback.success("매치업 분석 결과가 삭제되었습니다. 원본 PDF는 저장소에 그대로 있습니다.");
      qc.invalidateQueries({ queryKey: ["storage-inventory", "admin"] });
    },
    [qc, selectedDocId, setSelectedDocId],
  );

  const handleRetry = useCallback(
    async (id: number) => {
      const doc = await retryMatchupDocument(id);
      if (selectedDocId === id) setSelectedProblemId(null);
      qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      qc.invalidateQueries({ queryKey: ["matchup-problems", id] });
      if (doc?.ai_job_id) {
        asyncStatusStore.addWorkerJob(
          `매치업 분석 재시도: ${doc.title}`,
          doc.ai_job_id,
          "matchup_analysis",
        );
      } else if (doc?.id) {
        asyncStatusStore.addWorkerJob(
          `매치업 분석 준비 중: ${doc.title}`,
          `matchup-doc-${doc.id}`,
          "matchup_document_watch",
        );
      }
      feedback.success("재분석을 시작합니다. 우상단 작업 상자에서 진행률 확인.");
    },
    [qc, selectedDocId],
  );

  const startCategoryEdit = useCallback(() => {
    if (!selectedDoc) return;
    setCategoryDraft(selectedDoc.category || "");
    setCategoryEditing(true);
  }, [selectedDoc]);

  const cancelCategoryEdit = useCallback(() => {
    setCategoryEditing(false);
    setCategoryDraft("");
  }, []);

  const commitCategoryEdit = useCallback(async () => {
    if (!selectedDoc) return;
    const next = categoryDraft.trim();
    if (next === (selectedDoc.category || "").trim()) {
      cancelCategoryEdit();
      return;
    }
    setCategorySaving(true);
    try {
      await updateMatchupDocument(selectedDoc.id, { category: next });
      await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      feedback.success(next ? `카테고리를 "${next}"로 변경했습니다.` : "카테고리를 비웠습니다.");
      setCategoryEditing(false);
      setCategoryDraft("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "카테고리 변경 실패";
      feedback.error(msg);
    } finally {
      setCategorySaving(false);
    }
  }, [selectedDoc, categoryDraft, qc, cancelCategoryEdit]);

  // 다른 문서로 이동하면 편집 모드 해제
  useEffect(() => {
    setCategoryEditing(false);
    setCategoryDraft("");
  }, [selectedDocId]);

  const handleChangeIntent = useCallback(async (intent: "reference" | "test") => {
    if (!selectedDoc) return;
    if (getDocumentIntent(selectedDoc) === intent) return;
    setIntentUpdating(true);
    try {
      await updateMatchupDocument(selectedDoc.id, { intent });
      await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      if (intent === "test") {
        feedback.success("문서를 시험지로 변경했습니다. 자료별 매치 탭을 사용할 수 있습니다.");
      } else {
        setRightPanelTab("similar");
        feedback.success("문서를 참고자료로 변경했습니다. 자료별 매치는 시험지에서만 계산됩니다.");
      }
    } finally {
      setIntentUpdating(false);
    }
  }, [selectedDoc, qc]);

  const handleSelectDoc = useCallback((id: number) => {
    setSelectedDocId(id);
    setSelectedProblemId(null);
  }, [setSelectedDocId]);

  // 행 컨텍스트 메뉴 — intent 토글 (선택된 doc과 무관하게 임의 doc id에 대해)
  const handleRowChangeIntent = useCallback(
    async (id: number, next: "reference" | "test") => {
      const doc = documents.find((d) => d.id === id);
      if (!doc || getDocumentIntent(doc) === next) return;
      try {
        await updateMatchupDocument(id, { intent: next });
        await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
        feedback.success(next === "test"
          ? "문서를 시험지로 변경했습니다."
          : "문서를 참고자료로 변경했습니다.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "변경 실패";
        feedback.error(msg);
      }
    },
    [documents, qc],
  );

  // 행 컨텍스트 메뉴 — title rename (인라인 편집)
  const handleRowRename = useCallback(
    async (id: number, title: string) => {
      try {
        await updateMatchupDocument(id, { title });
        await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
        feedback.success("문서 이름을 변경했습니다.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "이름 변경 실패";
        feedback.error(msg);
      }
    },
    [qc],
  );

  const handleNavigateToProblem = useCallback((documentId: number, problemNumber: number) => {
    setSelectedDocId(documentId);
    setPendingNavigateNumber(problemNumber);
    qc.invalidateQueries({ queryKey: ["matchup-problems", documentId] });
  }, [qc, setSelectedDocId]);

  useEffect(() => {
    if (rightPanelTab === "cross" && selectedDocIntent !== "test") {
      setRightPanelTab("similar");
    }
  }, [rightPanelTab, selectedDocIntent]);

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
        <MatchupEmptyState onUpload={openUpload} />
        {uploadOpen && (
          <DocumentUploadModal
            onClose={() => { setUploadOpen(false); setUploadDefaultCategory(""); }}
            onUpload={handleUpload}
            intent={uploadIntent}
            existingTitles={existingTitles}
            categorySuggestions={categorySuggestions}
            subjectSuggestions={subjectSuggestions}
            gradeLevelSuggestions={gradeLevelSuggestions}
            defaultCategory={uploadDefaultCategory}
          />
        )}
      </>
    );
  }

  const isFailed = selectedDoc?.status === "failed";
  const isNoneDetected = selectedDoc?.status === "done" && selectedDoc.meta?.segmentation_method === "none";

  return (
    <>
      <div className={css.root} style={{
        // 좌측 트리가 페이지와 함께 스크롤되지 않도록 페이지 높이로 제한.
        // 헤더(상단 nav) + 탭 = ~120px 추정, 여유 1mm.
        maxHeight: "calc(100vh - 100px)",
        height: "calc(100vh - 100px)",
      }}>
        <div className={css.body}>
          {/* 좌측: 문서 목록 */}
          <div className={css.tree}>
            <DocumentList
              documents={documents}
              selectedId={selectedDocId}
              onSelect={handleSelectDoc}
              onUpload={openUpload}
              onPromoteFromInventory={openPromote}
              onRenameCategory={handleRenameCategory}
              onMergeCategory={handleRenameCategory}
              onClearCategory={handleClearCategory}
              onDelete={handleDelete}
              onRetry={handleRetry}
              onChangeIntent={handleRowChangeIntent}
              onRenameDocument={handleRowRename}
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
                {/* 문서 제목 + 액션 그룹 — 보기 / 편집 / 산출물 의미별 그룹화 */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", marginRight: "var(--space-2)" }}>
                    {selectedDoc?.title}
                  </h3>
                  {/* 그룹 1: 보기 (회색 톤) */}
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
                  {selectedDoc?.inventory_file_id && (
                    <button
                      onClick={() => navigate("/admin/storage/files")}
                      data-testid="matchup-doc-storage-link"
                      title="저장소에서 이 자료 보기"
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 11, padding: "3px 10px", borderRadius: 4,
                        background: "var(--color-bg-surface-soft)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border-divider)",
                        cursor: "pointer",
                      }}
                    >
                      <FolderOpen size={12} />
                      저장소에서 보기
                    </button>
                  )}
                  {/* 구분자 */}
                  {selectedDoc && (
                    <span style={{ width: 1, height: 16, background: "var(--color-border-divider)", margin: "0 2px" }} aria-hidden />
                  )}
                  {/* 그룹 2: 편집 (브랜드 컬러) */}
                  {selectedDoc && (
                    <button
                      onClick={() => setCropDocId(selectedDoc.id)}
                      data-testid="matchup-doc-manual-crop-btn"
                      title="원본 위에 직접 박스를 그려 문항을 추가/수정합니다"
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 11, padding: "3px 10px", borderRadius: 4,
                        background: "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)",
                        color: "var(--color-brand-primary)",
                        border: "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      <Crop size={12} />
                      직접 자르기
                    </button>
                  )}
                  {/* 구분자 */}
                  {selectedDoc && (
                    <span style={{ width: 1, height: 16, background: "var(--color-border-divider)", margin: "0 2px" }} aria-hidden />
                  )}
                  {/* 그룹 3: 산출물 (성공 컬러 — 학원 마케팅 보고서 강조) */}
                  {/* 처리 미완료 doc은 매치 결과가 0건이라 보고서 산출이 무의미. 사용자 혼란 방지. */}
                  {selectedDoc && (() => {
                    const isReady = selectedDoc.status === "done";
                    const reason = !isReady
                      ? selectedDoc.status === "failed"
                        ? "처리 실패한 문서는 보고서를 만들 수 없습니다"
                        : `처리가 완료된 후 사용할 수 있습니다 (현재 ${
                          progressMap[selectedDoc.id]?.percent != null
                            ? `${progressMap[selectedDoc.id]?.stepName ?? "처리 중"} ${progressMap[selectedDoc.id]?.percent}%`
                            : "처리 중"
                        })`
                      : "시험지 기준 학원 자료 적중률 PDF 보고서를 다운로드합니다";
                    return (
                      <button
                        type="button"
                        disabled={!isReady}
                        onClick={async () => {
                          try {
                            const resp = await api.get(
                              `/matchup/documents/${selectedDoc.id}/hit-report.pdf`,
                              { responseType: "blob", timeout: 5 * 60_000 },
                            );
                            const blob = new Blob([resp.data], { type: "application/pdf" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${selectedDoc.title || "matchup"}-적중보고서.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          } catch (e) {
                            console.error(e);
                            feedback.error("PDF 생성 실패");
                          }
                        }}
                        data-testid="matchup-doc-hit-report-btn"
                        title={reason}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          fontSize: 11, padding: "3px 10px", borderRadius: 4,
                          background: isReady
                            ? "color-mix(in srgb, var(--color-status-success) 14%, transparent)"
                            : "var(--color-bg-surface-soft)",
                          color: isReady ? "var(--color-status-success)" : "var(--color-text-muted)",
                          border: isReady
                            ? "1px solid color-mix(in srgb, var(--color-status-success) 35%, transparent)"
                            : "1px solid var(--color-border-divider)",
                          cursor: isReady ? "pointer" : "not-allowed",
                          opacity: isReady ? 1 : 0.55,
                          fontWeight: 700,
                        }}
                      >
                        <FileText size={12} />
                        자동 적중 PDF
                      </button>
                    );
                  })()}
                  {/* 큐레이션 적중 보고서 — 시험지(test)일 때만 노출. 사람이 직접 편집해서
                      학원장/선생에게 제출하는 내부 보고서. 자동 PDF와는 분리된 워크플로우.
                      처리 미완료 시 "시험지에 등록된 문항이 없습니다" 빈 편집기가 열리는 혼란 방지. */}
                  {selectedDoc && selectedDocIntent === "test" && (() => {
                    const isReady = selectedDoc.status === "done";
                    const reason = !isReady
                      ? selectedDoc.status === "failed"
                        ? "처리 실패한 시험지는 보고서를 작성할 수 없습니다"
                        : "분리가 완료된 후 작성할 수 있습니다"
                      : "시험지 문항별 적중 자료를 직접 골라 코멘트를 작성하여 보고서를 만듭니다";
                    return (
                      <button
                        type="button"
                        disabled={!isReady}
                        onClick={() => setHitReportDocId(selectedDoc.id)}
                        data-testid="matchup-doc-hit-report-curate-btn"
                        title={reason}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          fontSize: 11, padding: "3px 10px", borderRadius: 4,
                          background: isReady
                            ? "color-mix(in srgb, var(--color-brand-primary) 14%, transparent)"
                            : "var(--color-bg-surface-soft)",
                          color: isReady ? "var(--color-brand-primary)" : "var(--color-text-muted)",
                          border: isReady
                            ? "1px solid color-mix(in srgb, var(--color-brand-primary) 40%, transparent)"
                            : "1px solid var(--color-border-divider)",
                          cursor: isReady ? "pointer" : "not-allowed",
                          opacity: isReady ? 1 : 0.55,
                          fontWeight: 700,
                        }}
                      >
                        <ClipboardList size={12} />
                        적중 보고서 작성
                      </button>
                    );
                  })()}
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
                  {selectedDoc && categoryEditing ? (
                    <span
                      data-testid="matchup-doc-category-edit"
                      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <input
                        autoFocus
                        value={categoryDraft}
                        onChange={(e) => setCategoryDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitCategoryEdit(); }
                          else if (e.key === "Escape") { e.preventDefault(); cancelCategoryEdit(); }
                        }}
                        list="matchup-doc-category-suggestions"
                        disabled={categorySaving}
                        placeholder="카테고리 (비우면 미분류)"
                        style={{
                          fontSize: 11, padding: "2px 6px",
                          border: "1px solid var(--color-brand-primary)",
                          borderRadius: 4,
                          minWidth: 120,
                          background: "var(--color-bg-surface)",
                          color: "var(--color-text-primary)",
                          outline: "none",
                          fontWeight: 600,
                        }}
                      />
                      <datalist id="matchup-doc-category-suggestions">
                        {categorySuggestions.map((c) => <option key={c} value={c} />)}
                      </datalist>
                      <button
                        type="button"
                        onClick={commitCategoryEdit}
                        disabled={categorySaving}
                        title="저장 (Enter)"
                        data-testid="matchup-doc-category-save"
                        style={{
                          fontSize: 11, padding: "2px 7px", borderRadius: 4,
                          background: "var(--color-brand-primary)", color: "white",
                          border: "none", cursor: categorySaving ? "wait" : "pointer",
                          fontWeight: 700,
                        }}
                      >
                        {categorySaving ? "..." : "저장"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelCategoryEdit}
                        disabled={categorySaving}
                        title="취소 (Esc)"
                        style={{
                          fontSize: 11, padding: "2px 7px", borderRadius: 4,
                          background: "var(--color-bg-surface-soft)",
                          border: "1px solid var(--color-border-divider)",
                          color: "var(--color-text-muted)",
                          cursor: categorySaving ? "not-allowed" : "pointer",
                        }}
                      >
                        취소
                      </button>
                    </span>
                  ) : selectedDoc ? (
                    <button
                      type="button"
                      onClick={startCategoryEdit}
                      data-testid="matchup-doc-category-badge"
                      title="클릭해서 카테고리 변경"
                      style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 4,
                        background: selectedDoc.category
                          ? "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)"
                          : "var(--color-bg-surface-soft)",
                        color: selectedDoc.category
                          ? "var(--color-brand-primary)"
                          : "var(--color-text-muted)",
                        border: selectedDoc.category
                          ? "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)"
                          : "1px dashed var(--color-border-divider)",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {selectedDoc.category || "+ 카테고리 지정"}
                    </button>
                  ) : null}
                  {selectedDoc && (
                    <span
                      style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 4,
                        background: selectedDocIntent === "test"
                          ? "color-mix(in srgb, var(--color-warning) 14%, transparent)"
                          : "color-mix(in srgb, var(--color-brand-primary) 10%, transparent)",
                        color: selectedDocIntent === "test" ? "var(--color-warning)" : "var(--color-brand-primary)",
                        border: selectedDocIntent === "test"
                          ? "1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)"
                          : "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)",
                        fontWeight: 700,
                      }}
                    >
                      {selectedDocIntent === "test" ? "시험지" : "참고자료"}
                    </span>
                  )}
                  {selectedDoc && (
                    <button
                      type="button"
                      disabled={intentUpdating}
                      onClick={() => handleChangeIntent(selectedDocIntent === "test" ? "reference" : "test")}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 11, padding: "3px 10px", borderRadius: 4,
                        background: "var(--color-bg-surface-soft)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border-divider)",
                        cursor: intentUpdating ? "not-allowed" : "pointer",
                        opacity: intentUpdating ? 0.6 : 1,
                        fontWeight: 600,
                      }}
                      title={selectedDocIntent === "test" ? "참고자료로 변경" : "시험지로 변경"}
                    >
                      {intentUpdating
                        ? "유형 변경 중..."
                        : selectedDocIntent === "test"
                          ? "참고자료로 변경"
                          : "시험지로 변경"}
                    </button>
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
                        <li>아래 <strong>직접 자르기</strong> 버튼으로 원본 위에 박스를 그려 문항을 빠르게 추가할 수 있습니다.</li>
                        <li>스캔 해상도를 높여 다시 업로드해도 인식률이 좋아집니다 (200dpi 이상 권장)</li>
                        <li>여러 페이지를 한 장에 담지 말고, 한 페이지씩 찍어주세요</li>
                      </ul>
                    </div>
                    <Button
                      intent="primary"
                      size="sm"
                      onClick={() => selectedDoc && setCropDocId(selectedDoc.id)}
                      data-testid="matchup-none-banner-crop-btn"
                    >
                      <Crop size={13} style={{ marginRight: 4 }} />
                      직접 자르기
                    </Button>
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
                    flex: 2, minWidth: 280, overflowY: "auto",
                    borderLeft: "1px solid var(--color-border-divider)",
                    paddingLeft: "var(--space-4)",
                    display: "flex", flexDirection: "column", minHeight: 0,
                  }}>
                    <div style={{
                      display: "flex", gap: 4, marginBottom: "var(--space-2)",
                      borderBottom: "1px solid var(--color-border-divider)",
                    }}>
                      {[
                        { key: "similar", label: "유사 문제", icon: <Sparkles size={12} /> },
                        { key: "cross", label: "자료별 매치", icon: <BookOpen size={12} /> },
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            if (t.key === "cross" && selectedDocIntent !== "test") return;
                            setRightPanelTab(t.key as "similar" | "cross");
                          }}
                          disabled={t.key === "cross" && selectedDocIntent !== "test"}
                          data-testid={`matchup-right-tab-${t.key}`}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "6px 10px",
                            border: "none",
                            background: "transparent",
                            borderBottom: rightPanelTab === t.key
                              ? "2px solid var(--color-brand-primary)"
                              : "2px solid transparent",
                            color: rightPanelTab === t.key
                              ? "var(--color-brand-primary)"
                              : "var(--color-text-muted)",
                            fontWeight: rightPanelTab === t.key ? 700 : 500,
                            fontSize: 12,
                            cursor: t.key === "cross" && selectedDocIntent !== "test" ? "not-allowed" : "pointer",
                            opacity: t.key === "cross" && selectedDocIntent !== "test" ? 0.45 : 1,
                          }}
                          title={t.key === "cross" && selectedDocIntent !== "test"
                            ? "시험지 문서에서만 자료별 매치를 볼 수 있습니다."
                            : undefined}
                        >
                          {t.icon}
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                      {rightPanelTab === "similar" ? (
                        <SimilarResults
                          problemId={selectedProblemId}
                          onSelectSimilar={setDetailProblem}
                          totalDocumentCount={documents.length}
                          sourceDocumentId={selectedDocId}
                          pinnedIds={
                            selectedProblemId && selectedDocIntent === "test"
                              ? (pinsByExamPid[selectedProblemId] || new Set())
                              : undefined
                          }
                          onTogglePin={
                            selectedDocIntent === "test" && hitReportId
                              ? handleTogglePin
                              : undefined
                          }
                        />
                      ) : (
                        <CrossMatchesPanel
                          docId={selectedDocId}
                          enabled={selectedDoc?.status === "done" && selectedDocIntent === "test"}
                          selectedDocIntent={selectedDocIntent}
                          onSelectProblem={setSelectedProblemId}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {uploadOpen && (
        <DocumentUploadModal
          onClose={() => { setUploadOpen(false); setUploadDefaultCategory(""); }}
          onUpload={handleUpload}
          intent={uploadIntent}
          existingTitles={existingTitles}
          categorySuggestions={categorySuggestions}
          subjectSuggestions={subjectSuggestions}
          gradeLevelSuggestions={gradeLevelSuggestions}
          defaultCategory={uploadDefaultCategory}
        />
      )}

      {promoteOpen && (
        <PromoteFromInventoryModal
          onClose={() => { setPromoteOpen(false); setPromoteDefaultCategory(""); }}
          defaultCategory={promoteDefaultCategory}
          categorySuggestions={categorySuggestions}
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

      {cropDocId && (() => {
        const doc = documents.find((d) => d.id === cropDocId);
        return doc ? (
          <ManualCropModal
            document={doc}
            onClose={() => setCropDocId(null)}
          />
        ) : null;
      })()}

      {hitReportDocId && (
        <HitReportEditor
          docId={hitReportDocId}
          onClose={() => setHitReportDocId(null)}
        />
      )}

      {detailProblem && (
        <ProblemDetailModal
          problem={detailProblem}
          sourceProblem={problems.find((p) => p.id === selectedProblemId) ?? null}
          sourceDocumentTitle={selectedDoc?.title ?? ""}
          onClose={() => setDetailProblem(null)}
          onNavigate={handleNavigateToProblem}
        />
      )}
    </>
  );
}

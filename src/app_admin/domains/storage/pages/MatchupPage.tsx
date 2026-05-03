// PATH: src/app_admin/domains/storage/pages/MatchupPage.tsx
// 매치업 메인 페이지 — 2-패널 (문서 목록 + 문제 그리드/유사 추천)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Sparkles, AlertTriangle, RefreshCw, Eye, FolderOpen, BookOpen, Crop, ClipboardList, FolderTree, MoreHorizontal, Layers } from "lucide-react";
import { Button, ICON } from "@/shared/ui/ds";
import { useConfirm } from "@/shared/ui/confirm";
import useAuth from "@/auth/hooks/useAuth";
import { feedback } from "@/shared/ui/feedback/feedback";
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
  reanalyzeMatchupDocument,
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
import LowConfPageReviewer from "../components/matchup/LowConfPageReviewer";
import MergeProblemsModal from "../components/matchup/MergeProblemsModal";
import HitReportEditor from "../components/matchup/HitReportEditor";
import HitReportListModal from "../components/matchup/HitReportListModal";
import MatchupEmptyState from "../components/matchup/MatchupEmptyState";
import {
  getDocumentIntent, getSourceType, SOURCE_TYPE_LABELS, SOURCE_TYPE_ORDER,
  type MatchupSourceType,
} from "../components/matchup/documentIntent";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

// 자동 분류된 시험지 유형 라벨 (학원 사용자 노출용 한글).
// backend paper-type classifier enum과 동기.
const PAPER_TYPE_LABEL: Record<string, string> = {
  clean_pdf_single: "PDF (1단)",
  clean_pdf_dual: "PDF (2단)",
  quadrant: "4분할 시험지",
  scan_single: "스캔본 (1단)",
  scan_dual: "스캔본 (2단)",
  student_answer_photo: "학생 답안지 폰사진",
  side_notes: "학습자료 본문",
  non_question: "표지/정답지/해설지",
  unknown: "분류 불명",
};

function paperTypeLabel(key: string): string {
  return PAPER_TYPE_LABEL[key] ?? key;
}

function hasAsyncWorkerTask(id: string): boolean {
  return asyncStatusStore
    .getState()
    .some((task) => task.id === id || task.meta?.jobId === id);
}

export default function MatchupPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
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
  // Phase 5-deep — 직접 자르기 모달이 특정 페이지로 점프해서 열려야 할 때 (검수 모달에서 인계).
  const [cropInitialPage, setCropInitialPage] = useState<number | null>(null);
  const [reviewerDocId, setReviewerDocId] = useState<number | null>(null);
  const [hitReportDocId, setHitReportDocId] = useState<number | null>(null);
  // 강사별 보고서 누적 리스트 모달 (수업 히스토리/제출 KPI/홍보물 진입점).
  const [hitReportListOpen, setHitReportListOpen] = useState(false);
  // 학원장 inbox 모드 vs 강사 본인 시점 결정용. user.tenantRole로 판단.
  const { user } = useAuth();
  const isAcademyAdmin = !!(
    user?.is_superuser
    || user?.tenantRole === "owner"
    || user?.tenantRole === "admin"
  );
  // 적중 보고서 찜 — 시험지 doc 활성 시에만. selectedProblemId(시험지 문항)별 별표 후보 problem id Set.
  // 매치업 작업 중에 후보를 찜해두면 적중 보고서 작성기 진입 시 자동 선택됨.
  const [hitReportId, setHitReportId] = useState<number | null>(null);
  // examProblemId -> Set<candidateProblemId>
  const [pinsByExamPid, setPinsByExamPid] = useState<Record<number, Set<number>>>({});
  const [pendingNavigateNumber, setPendingNavigateNumber] = useState<number | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"similar" | "cross">("similar");
  // 합치기 모드
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelectedIds, setMergeSelectedIds] = useState<number[]>([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // status==='processing'에서도 활성화 — 백엔드가 세그멘테이션 직후 skeleton row를
    // INSERT하므로 신규 업로드 사용자에게 즉시 부분 결과(N개 카드 + "처리 중" 뱃지)
    // 노출 가능. useMatchupPolling이 polling 주기마다 invalidate해 자동 refetch.
    enabled: !!selectedDocId && (selectedDoc?.status === "done" || selectedDoc?.status === "processing"),
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
  // 누락된 번호를 명시해 사용자가 어디를 직접 자르기로 추가해야 하는지 즉시 인지.
  //
  // gap 분류:
  //   - 작은 본문 gap (diff <=10): 진짜 결함 의심 → 누락 번호 명시
  //   - 큰 점프이지만 다음 번호 <100: 본문에서 누락 의심 (e.g. 1~10→25) → 동일하게 표시
  //   - 큰 점프 + 다음 번호 >=100: 부록/해설 매핑 (예: 24→101) → 의도된 분리, 무시
  // 미싱 번호 표시는 8개 캡 — 큰 본문 gap이면 자연스럽게 잘려서 UI 짜부 안 됨.
  const numberAnomalies = useMemo(() => {
    if (problems.length === 0) {
      return { duplicates: 0, gaps: 0, missingNumbers: [] as number[] };
    }
    const nums = problems.map((p) => p.number).sort((a, b) => a - b);
    const duplicates = nums.length - new Set(nums).size;
    const missingNumbers: number[] = [];
    let gaps = 0;
    const MISSING_CAP = 8;
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] === nums[i - 1]) continue;
      const diff = nums[i] - nums[i - 1];
      if (diff <= 1) continue;
      // 부록/해설 매핑(다음 번호 >=100 + 큰 점프)은 의도된 분리로 보고 무시
      const looksAppendix = diff > 10 && nums[i] >= 100;
      if (looksAppendix) continue;
      gaps += 1;
      for (let m = nums[i - 1] + 1; m < nums[i]; m++) {
        if (missingNumbers.length >= MISSING_CAP) break;
        missingNumbers.push(m);
      }
    }
    return { duplicates, gaps, missingNumbers };
  }, [problems]);

  // ── 핸들러 ──
  const handleUpload = useCallback(
    async (payload: {
      file: File; title: string; category: string; subject: string; grade_level: string;
      source_type?: import("../components/matchup/documentIntent").MatchupSourceType;
    }) => {
      // source_type 우선, 미지정 시 legacy intent 그대로 전송 (backend에서 정규화).
      const doc = await uploadMatchupDocument({
        ...payload,
        intent: uploadIntent,
        source_type: payload.source_type,
      });
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
    setMergeMode(false);
    setMergeSelectedIds([]);
    setMergeModalOpen(false);
  }, [selectedDocId]);

  const handleToggleMergeMode = useCallback(() => {
    setMergeMode((prev) => {
      const next = !prev;
      if (!next) setMergeSelectedIds([]);
      return next;
    });
    // 합치기 모드에선 우측 SimilarResults가 의미 없음 — 단일 문항 매치 결과가
    // 합치기 작업과 무관해 노이즈만 됨. 모드 진입/종료 모두에서 problem 선택 해제.
    setSelectedProblemId(null);
  }, []);

  const handleToggleMergeSelect = useCallback((id: number) => {
    setMergeSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  }, []);

  const handleClearMergeSelection = useCallback(() => {
    setMergeSelectedIds([]);
  }, []);

  const handleOpenMergeModal = useCallback(() => {
    if (mergeSelectedIds.length < 2) {
      feedback.info("합치려면 2개 이상 선택해주세요.");
      return;
    }
    setMergeModalOpen(true);
  }, [mergeSelectedIds.length]);

  const handleMergeSuccess = useCallback((mergedProblemId: number) => {
    setSelectedProblemId(mergedProblemId);
    setMergeMode(false);
    setMergeSelectedIds([]);
  }, []);

  const handleChangeIntent = useCallback(async (intent: "reference" | "test") => {
    if (!selectedDoc) return;
    if (getDocumentIntent(selectedDoc) === intent) return;
    // 시험지 → 참고자료 전환은 적중 보고서 진입점/자료별 매치 탭이 모두 사라짐.
    // 학원장이 잘못 누른 경우 작업 손실이 크므로 명시 confirm.
    if (getDocumentIntent(selectedDoc) === "test" && intent === "reference") {
      const ok = await confirm({
        title: "시험지를 참고자료로 변경",
        message:
          "이 문서를 참고자료로 바꾸면 '적중 보고서' 작성과 '자료별 매치' 탭이 사라집니다. " +
          "이미 작성한 보고서 내용은 유지되지만 화면에서 보이지 않습니다. 계속하시겠어요?",
        confirmText: "참고자료로 변경",
        cancelText: "취소",
        danger: true,
      });
      if (!ok) return;
    }
    setIntentUpdating(true);
    try {
      await updateMatchupDocument(selectedDoc.id, { intent });
      await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
      if (intent === "test") {
        feedback.success("시험지로 바꿨습니다. 이제 적중 보고서를 작성할 수 있어요.");
      } else {
        setRightPanelTab("similar");
        feedback.success("참고자료로 바꿨습니다.");
      }
    } finally {
      setIntentUpdating(false);
    }
  }, [selectedDoc, qc, confirm]);

  // 자료 유형 변경 시 자동 재분석 토글 — localStorage 보존 (학원장 1회 설정).
  // ON 상태에서 chip을 바꾸면 즉시 reanalyze까지 자동 호출 → 학원장이 별도 버튼
  // 누르는 step 1 줄어듦.
  const AUTO_REANALYZE_KEY = "matchup-source-type-auto-reanalyze";
  const [autoReanalyze, setAutoReanalyze] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTO_REANALYZE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleAutoReanalyze = useCallback((next: boolean) => {
    setAutoReanalyze(next);
    try {
      localStorage.setItem(AUTO_REANALYZE_KEY, next ? "1" : "0");
    } catch {
      // localStorage 불가 환경(시크릿 모드 등)에서도 in-memory state는 유지
    }
  }, []);

  // Phase 17 — post-upload source_type 보정. 학원장이 잘못 백필된 라벨 즉시 정정.
  // autoReanalyze ON이면 변경 즉시 재분석까지 트리거.
  const handleChangeSourceType = useCallback(
    async (sourceType: import("../components/matchup/documentIntent").MatchupSourceType) => {
      if (!selectedDoc) return;
      try {
        await updateMatchupDocument(selectedDoc.id, { source_type: sourceType });
        await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
        if (autoReanalyze) {
          // 변경 즉시 재분석 트리거 — processing 충돌은 backend에서 409 반환.
          try {
            await reanalyzeMatchupDocument(selectedDoc.id);
            feedback.success("자료 유형 변경 + 재분석 시작");
            await qc.invalidateQueries({ queryKey: ["matchup-problems", selectedDoc.id] });
          } catch (e) {
            const msg =
              (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
              "재분석 트리거 실패";
            feedback.error(`유형 변경됨, 재분석 ${msg}`);
          }
        } else {
          feedback.success("자료 유형을 변경했습니다. 재분석 버튼으로 새 strategy 적용.");
        }
      } catch (e) {
        console.error(e);
        feedback.error("자료 유형 변경 실패");
      }
    },
    [selectedDoc, qc, autoReanalyze],
  );

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

  // 행 컨텍스트 메뉴 — 카테고리 변경 (디테일 패널 진입 없이 빠른 이동)
  const handleRowChangeCategory = useCallback(
    async (id: number, category: string) => {
      try {
        await updateMatchupDocument(id, { category });
        await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
        feedback.success(category
          ? `카테고리를 "${category}"로 변경했습니다.`
          : "카테고리를 미분류로 변경했습니다.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "카테고리 변경 실패";
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
      <div className={css.root} style={/* eslint-disable-line no-restricted-syntax */ {
        // 좌측 트리가 페이지와 함께 스크롤되지 않도록 페이지 높이로 제한.
        // 헤더(상단 nav) + 탭 = ~120px 추정, 여유 1mm.
        maxHeight: "calc(100vh - 100px)",
        height: "calc(100vh - 100px)",
      }}>
        <div className={css.body}>
          {/* 좌측: 문서 목록 */}
          <div className={css.tree}>
            {/* 강사/학원장 보고서 누적 진입점 — 작성한 보고서 모음/inbox.
                "보관함" 비유로 시작 시점부터 의미 명확. */}
            <div style={/* eslint-disable-line no-restricted-syntax */ {
              padding: "8px 10px",
              borderBottom: "1px solid var(--color-border-divider)",
              background: "var(--color-bg-surface-soft)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <button
                onClick={() => setHitReportListOpen(true)}
                title={isAcademyAdmin
                  ? "학원 전체 강사가 제출한 적중 보고서를 봅니다"
                  : "내가 작성한 적중 보고서를 모아 봅니다"}
                style={/* eslint-disable-line no-restricted-syntax */ {
                  flex: 1, padding: "7px 10px",
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, fontWeight: 700,
                  border: "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)",
                  borderRadius: 6,
                  background: "color-mix(in srgb, var(--color-brand-primary) 6%, transparent)",
                  color: "var(--color-brand-primary)",
                  cursor: "pointer",
                  transition: "background 0.12s, border-color 0.12s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "color-mix(in srgb, var(--color-brand-primary) 12%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "color-mix(in srgb, var(--color-brand-primary) 6%, transparent)";
                }}
              >
                <FolderTree size={ICON.sm} />
                {isAcademyAdmin ? "학원 적중 보고서 모음" : "내 적중 보고서 모음"}
              </button>
            </div>
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
              onChangeDocumentCategory={handleRowChangeCategory}
              progressMap={progressMap}
            />
          </div>

          {/* 우측: 문제 + 유사 추천 */}
          <div className={css.gridWrap}>
            {!selectedDocId ? (
              <div style={/* eslint-disable-line no-restricted-syntax */ {
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                height: "100%", color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.6,
                textAlign: "center", padding: "var(--space-6)",
              }}>
                <Sparkles size={32} style={/* eslint-disable-line no-restricted-syntax */ { marginBottom: "var(--space-3)", opacity: 0.4 }} />
                <strong style={/* eslint-disable-line no-restricted-syntax */ { fontSize: 15, fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: 4 }}>
                  왼쪽에서 문서를 선택해 주세요
                </strong>
                <span style={/* eslint-disable-line no-restricted-syntax */ { maxWidth: 320, fontSize: 12 }}>
                  시험지를 선택하면 적중 자료를 찾을 수 있고, 참고자료를 선택하면 추출된 문항을 검수할 수 있어요.
                </span>
              </div>
            ) : (
              <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", flexDirection: "column", gap: "var(--space-4)", height: "100%" }}>
                {/* ── Tier 1: 제목 + 적중 보고서 primary CTA + ⋮ 보조 액션 ──
                    학원장이 가장 자주 누르는 산출물 CTA를 우측에 강하게 시각화.
                    원본보기/저장소/직접자르기는 ⋮ 메뉴 또는 Tier 2 (배너/하단)에서 처리. */}
                <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0, flexWrap: "wrap" }}>
                  <h3 style={/* eslint-disable-line no-restricted-syntax */ { margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={selectedDoc?.title}>
                    {selectedDoc?.title}
                  </h3>
                  {/* 시험지 → 적중 보고서 primary CTA (도메인의 메인 산출물) */}
                  {selectedDoc && selectedDocIntent === "test" && (() => {
                    const isReady = selectedDoc.status === "done";
                    const pinnedCount = Object.values(pinsByExamPid)
                      .reduce((acc, s) => acc + s.size, 0);
                    const reason = !isReady
                      ? selectedDoc.status === "failed"
                        ? "처리 실패한 시험지는 보고서를 작성할 수 없습니다"
                        : "분석이 끝나면 작성할 수 있어요"
                      : pinnedCount > 0
                        ? `찜한 ${pinnedCount}개 자료로 적중 보고서 작성`
                        : "시험지 문항별 적중 자료를 직접 골라 보고서를 만듭니다";
                    return (
                      <Button
                        size="sm"
                        intent={isReady ? "primary" : "ghost"}
                        disabled={!isReady}
                        onClick={() => setHitReportDocId(selectedDoc.id)}
                        data-testid="matchup-doc-hit-report-curate-btn"
                        title={reason}
                        leftIcon={<ClipboardList size={ICON.sm} />}
                      >
                        적중 보고서 작성
                        {isReady && pinnedCount > 0 && (
                          <span style={/* eslint-disable-line no-restricted-syntax */ {
                            marginLeft: 6, padding: "1px 7px", borderRadius: 999,
                            background: "rgba(255,255,255,0.22)",
                            color: "white", fontSize: 11, fontWeight: 700, lineHeight: 1.4,
                          }}>
                            {pinnedCount}
                          </span>
                        )}
                      </Button>
                    );
                  })()}
                  {/* 직접 자르기 — 자동분리 결과를 사람이 보정하는 메인 편집 진입점.
                      시험지 보고서 옆에 두 번째로 자주 쓰이는 액션이라 가시화 유지. */}
                  {selectedDoc && (
                    <Button
                      size="sm"
                      intent="ghost"
                      onClick={() => setCropDocId(selectedDoc.id)}
                      data-testid="matchup-doc-manual-crop-btn"
                      title="원본 위에 직접 박스를 그려 문항을 추가/수정합니다"
                      leftIcon={<Crop size={ICON.sm} />}
                    >
                      직접 자르기
                    </Button>
                  )}
                  {/* 보조 액션 — ⋮ 메뉴로 묶음 (원본 보기 / 저장소에서 보기) */}
                  {selectedDoc && (
                    <HeaderMoreMenu
                      onPreview={() => setPreviewDocId(selectedDoc.id)}
                      onOpenStorage={selectedDoc.inventory_file_id ? () => navigate("/admin/storage/files") : null}
                    />
                  )}
                </div>

                {/* ── Tier 2: 메타 행 (과목 · 카테고리 · 시험지/참고자료 토글) ──
                    문서 정체성을 한눈에 + 변경 동선 제공. */}
                <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0, flexWrap: "wrap", marginTop: -8 }}>
                  {selectedDoc?.subject && (
                    <span
                      title="과목"
                      style={/* eslint-disable-line no-restricted-syntax */ {
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
                      style={/* eslint-disable-line no-restricted-syntax */ { display: "inline-flex", alignItems: "center", gap: 4 }}
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
                        style={/* eslint-disable-line no-restricted-syntax */ {
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
                        style={/* eslint-disable-line no-restricted-syntax */ {
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
                        style={/* eslint-disable-line no-restricted-syntax */ {
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
                      style={/* eslint-disable-line no-restricted-syntax */ {
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
                  {/* 시험지 ↔ 참고자료 segmented 토글 — 현재 상태 + 변경 동작이 한 컨트롤로 통합.
                      뱃지 + 변경 버튼 2개로 쪼개졌던 동선을 1 컨트롤로 단순화. */}
                  {selectedDoc && (
                    <IntentToggle
                      value={selectedDocIntent}
                      onChange={handleChangeIntent}
                      disabled={intentUpdating}
                    />
                  )}
                  {selectedDoc?.status === "processing" && progressMap[selectedDoc.id] && progressMap[selectedDoc.id].percent > 0 && (
                    <span style={/* eslint-disable-line no-restricted-syntax */ {
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
                  <div data-testid="matchup-failed-banner" style={/* eslint-disable-line no-restricted-syntax */ {
                    flexShrink: 0,
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    background: "color-mix(in srgb, var(--color-danger) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)",
                    display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                  }}>
                    <AlertTriangle size={18} style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-danger)", flexShrink: 0, marginTop: 2 }} />
                    <div style={/* eslint-disable-line no-restricted-syntax */ { flex: 1, minWidth: 0 }}>
                      <div style={/* eslint-disable-line no-restricted-syntax */ { fontSize: 13, fontWeight: 700, color: "var(--color-danger)", marginBottom: 2 }}>
                        분석 실패
                      </div>
                      <div style={/* eslint-disable-line no-restricted-syntax */ { fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                        {selectedDoc?.error_message || "원인을 확인할 수 없는 오류입니다. 재시도해 주세요."}
                      </div>
                    </div>
                    <Button
                      intent="ghost"
                      size="sm"
                      onClick={() => selectedDoc && handleRetry(selectedDoc.id)}
                    >
                      <RefreshCw size={13} style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                      재시도
                    </Button>
                  </div>
                )}

                {/* 미검출(none) 가이드 배너 */}
                {isNoneDetected && (
                  <div data-testid="matchup-none-banner" style={/* eslint-disable-line no-restricted-syntax */ {
                    flexShrink: 0,
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    background: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)",
                    display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                  }}>
                    <AlertTriangle size={18} style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-warning)", flexShrink: 0, marginTop: 2 }} />
                    <div style={/* eslint-disable-line no-restricted-syntax */ { flex: 1, minWidth: 0 }}>
                      <div style={/* eslint-disable-line no-restricted-syntax */ { fontSize: 13, fontWeight: 700, color: "var(--color-warning)", marginBottom: 4 }}>
                        문제 영역을 찾지 못해 페이지 단위로 처리되었습니다
                      </div>
                      <ul style={/* eslint-disable-line no-restricted-syntax */ {
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
                      <Crop size={13} style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                      직접 자르기
                    </Button>
                  </div>
                )}

                {/* Phase 17 — 자료 유형 (source_type) 변경 가능 chip.
                    backfill 결과를 학원장이 검수 후 즉시 정정 가능. backend가 reanalyze 트리거.
                    7-value SSOT (학생폰사진/학교PDF/시판교재/학원워크북/해설지/답안지/기타). */}
                {selectedDoc?.status === "done" && (() => {
                  const currentST = getSourceType(selectedDoc);
                  return (
                    <div data-testid="matchup-source-type-chip" style={/* eslint-disable-line no-restricted-syntax */ {
                      flexShrink: 0,
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--color-bg-surface)",
                      border: "1px solid var(--color-border-divider)",
                      display: "flex", alignItems: "center", gap: "var(--space-2)",
                      flexWrap: "wrap",
                    }}>
                      <span style={/* eslint-disable-line no-restricted-syntax */ {
                        fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)",
                      }}>
                        자료 유형:
                      </span>
                      <select
                        value={currentST}
                        onChange={(e) => handleChangeSourceType(e.target.value as MatchupSourceType)}
                        data-testid="matchup-source-type-select"
                        style={/* eslint-disable-line no-restricted-syntax */ {
                          fontSize: 12, fontWeight: 600,
                          padding: "4px 8px",
                          border: "1px solid var(--color-brand-primary)",
                          borderRadius: 4,
                          background: "var(--color-bg-canvas)",
                          color: "var(--color-text-primary)",
                          cursor: "pointer",
                        }}
                      >
                        {SOURCE_TYPE_ORDER.map((st) => (
                          <option key={st} value={st}>{SOURCE_TYPE_LABELS[st]}</option>
                        ))}
                      </select>
                      <label style={/* eslint-disable-line no-restricted-syntax */ {
                        marginLeft: "auto",
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 11, color: "var(--color-text-secondary)",
                        cursor: "pointer", userSelect: "none",
                      }} title="자료 유형을 바꾸면 즉시 재분석을 트리거합니다 (브라우저에 설정 저장)">
                        <input
                          type="checkbox"
                          checked={autoReanalyze}
                          onChange={(e) => toggleAutoReanalyze(e.target.checked)}
                          data-testid="matchup-source-type-auto-reanalyze-toggle"
                          style={/* eslint-disable-line no-restricted-syntax */ { cursor: "pointer" }}
                        />
                        변경 시 자동 재분석
                      </label>
                      {!autoReanalyze && (
                        <span style={/* eslint-disable-line no-restricted-syntax */ {
                          fontSize: 11, color: "var(--color-text-muted)",
                        }}>
                          ※ 변경 후 재분석 버튼으로 새 strategy 적용
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* 시험지 유형 자동 분류 결과 + 자동분리 신뢰도 경고.
                    백엔드 paper-type classifier가 페이지별로 분류한 결과의 doc-level summary.
                    학생 답안지 폰사진 / 표지·정답지 다수 / 저신뢰 source 다수일 때 사전 경고. */}
                {selectedDoc?.status === "done" && selectedDoc.meta?.paper_type_summary && (() => {
                  const summary = selectedDoc.meta.paper_type_summary;
                  if (!summary) return null;
                  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
                  const distribution = (summary.distribution ?? {}) as Record<string, number>;
                  const totalPages = Object.values(distribution).reduce((a, b) => a + (Number(b) || 0), 0);
                  const sortedDist = Object.entries(distribution)
                    .filter(([, n]) => Number(n) > 0)
                    .sort((a, b) => Number(b[1]) - Number(a[1]));

                  const hasStudentPhoto = warnings.includes("student_answer_photo_detected");
                  const hasLowConfidence = warnings.includes("low_confidence_source_majority");
                  const hasNonQuestionMajority = warnings.includes("non_question_majority");
                  const hasWarning = hasStudentPhoto || hasLowConfidence || hasNonQuestionMajority;

                  // 경고 없으면 banner 자체를 띄우지 않음 (정상 PDF 대다수에서 노이즈 방지).
                  if (!hasWarning) return null;

                  // 경고 톤: non_question_majority = warning(주의/권장), 나머지 = warning(자동분리 정확도 낮음 안내)
                  // 빨강(danger)은 실패 배너에서만 사용. 경고는 모두 warning 톤으로 통일.
                  const tone = "var(--color-warning)";
                  const title = hasStudentPhoto
                    ? "학생 답안지 폰사진으로 분류되었습니다"
                    : hasNonQuestionMajority
                      ? "비-문항 페이지가 다수입니다"
                      : "자동분리 정확도가 낮을 수 있습니다";
                  const message = hasStudentPhoto
                    ? "이 자료는 학생 답안지 폰사진으로 자동분리 정확도가 낮습니다. 필기가 본문을 가릴 수 있어 페이지 단위 매칭이 더 안전합니다. 정확한 매칭이 필요한 문항은 직접 자르기를 권장합니다."
                    : hasNonQuestionMajority
                      ? "표지·정답지·해설지 등 비-문항 페이지가 다수입니다. 출제본 PDF로 다시 업로드하시거나, 필요한 문항만 직접 자르기로 추가해 주세요."
                      : "스캔 품질·레이아웃 등으로 자동분리 신뢰도가 낮습니다. 결과를 검수하시고 누락·오분리 문항은 직접 자르기로 보정해 주세요.";

                  return (
                    <div data-testid="matchup-paper-type-banner" style={/* eslint-disable-line no-restricted-syntax */ {
                      flexShrink: 0,
                      padding: "var(--space-3) var(--space-4)",
                      borderRadius: "var(--radius-md)",
                      background: "color-mix(in srgb, var(--color-warning) 8%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)",
                      display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                    }}>
                      <AlertTriangle size={18} style={/* eslint-disable-line no-restricted-syntax */ { color: tone, flexShrink: 0, marginTop: 2 }} />
                      <div style={/* eslint-disable-line no-restricted-syntax */ { flex: 1, minWidth: 0 }}>
                        <div style={/* eslint-disable-line no-restricted-syntax */ {
                          fontSize: 13, fontWeight: 700,
                          color: tone, marginBottom: 4,
                        }}>
                          {title}
                        </div>
                        <div style={/* eslint-disable-line no-restricted-syntax */ {
                          fontSize: 12, color: "var(--color-text-secondary)",
                          lineHeight: 1.5,
                        }}>
                          {message}
                        </div>
                        {sortedDist.length > 0 && (
                          <details style={/* eslint-disable-line no-restricted-syntax */ { marginTop: 6 }}>
                            <summary style={/* eslint-disable-line no-restricted-syntax */ {
                              fontSize: 11, color: "var(--color-text-muted)",
                              cursor: "pointer", userSelect: "none",
                            }}>
                              페이지별 분류 상세 ({totalPages}페이지)
                            </summary>
                            <div style={/* eslint-disable-line no-restricted-syntax */ {
                              marginTop: 4, display: "flex", flexWrap: "wrap",
                              gap: "var(--space-1)",
                              fontSize: 11, color: "var(--color-text-muted)",
                            }}>
                              {sortedDist.map(([type, count]) => (
                                <span
                                  key={type}
                                  style={/* eslint-disable-line no-restricted-syntax */ {
                                    padding: "2px 6px", borderRadius: 4,
                                    background: "var(--color-bg-surface-soft)",
                                    border: "1px solid var(--color-border-divider)",
                                  }}
                                >
                                  {paperTypeLabel(type)} {count}p
                                </span>
                              ))}
                              {typeof summary.low_confidence_ratio === "number" && summary.low_confidence_ratio > 0 && (
                                <span style={/* eslint-disable-line no-restricted-syntax */ {
                                  padding: "2px 6px", borderRadius: 4,
                                  background: "var(--color-bg-surface-soft)",
                                  border: "1px solid var(--color-border-divider)",
                                }}>
                                  저신뢰 비율 {Math.round(summary.low_confidence_ratio * 100)}%
                                </span>
                              )}
                              {typeof summary.page_confidence_avg === "number" && (
                                <span style={/* eslint-disable-line no-restricted-syntax */ {
                                  padding: "2px 6px", borderRadius: 4,
                                  background: "var(--color-bg-surface-soft)",
                                  border: "1px solid var(--color-border-divider)",
                                }}>
                                  평균 신뢰도 {Math.round(summary.page_confidence_avg * 100)}%
                                </span>
                              )}
                            </div>
                          </details>
                        )}
                        {/* Phase 5-deep — 검수 필요 페이지 리스트 + 검수 모달 트리거 */}
                        {Array.isArray(summary.low_conf_pages) && summary.low_conf_pages.length > 0 && selectedDoc && (
                          <div style={/* eslint-disable-line no-restricted-syntax */ {
                            marginTop: 8,
                            display: "flex", alignItems: "center", gap: 8,
                            flexWrap: "wrap",
                          }}>
                            <span style={/* eslint-disable-line no-restricted-syntax */ {
                              fontSize: 11, fontWeight: 700,
                              color: "var(--color-warning)",
                            }}>
                              검수 필요 페이지 {summary.low_conf_pages.length}건 (신뢰도 55% 미만)
                            </span>
                            <Button
                              intent="primary"
                              size="sm"
                              onClick={() => setReviewerDocId(selectedDoc.id)}
                              data-testid="matchup-low-conf-reviewer-open-btn"
                            >
                              <Eye size={13} style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                              검수 페이지 열기
                            </Button>
                          </div>
                        )}
                      </div>
                      {selectedDoc && (
                        <Button
                          intent="primary"
                          size="sm"
                          onClick={() => setCropDocId(selectedDoc.id)}
                          data-testid="matchup-paper-type-banner-crop-btn"
                        >
                          <Crop size={13} style={/* eslint-disable-line no-restricted-syntax */ { marginRight: 4 }} />
                          직접 자르기
                        </Button>
                      )}
                    </div>
                  );
                })()}

                {/* 과분할 감지 힌트 — 번호 중복/결손이 있을 때만 노출.
                    시험지(test)는 적중 PDF에 직접 영향 → warning 톤으로 강조 + 직접 자르기 CTA. */}
                {selectedDoc?.status === "done" && (numberAnomalies.duplicates > 0 || numberAnomalies.gaps > 0) && (() => {
                  const isTest = selectedDocIntent === "test";
                  const missingShown = numberAnomalies.missingNumbers.slice(0, 8);
                  const remaining = numberAnomalies.missingNumbers.length - missingShown.length;
                  return (
                    <div data-testid="matchup-number-gap-banner" style={/* eslint-disable-line no-restricted-syntax */ {
                      flexShrink: 0,
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      background: isTest
                        ? "color-mix(in srgb, var(--color-warning) 8%, transparent)"
                        : "var(--color-bg-surface-soft)",
                      border: isTest
                        ? "1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)"
                        : "1px solid var(--color-border-divider)",
                      fontSize: 12,
                      color: isTest ? "var(--color-warning)" : "var(--color-text-secondary)",
                      display: "flex", alignItems: "center", gap: "var(--space-2)",
                      flexWrap: "wrap",
                    }}>
                      <AlertTriangle size={14} style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-warning)", flexShrink: 0 }} />
                      <span style={/* eslint-disable-line no-restricted-syntax */ { fontWeight: isTest ? 700 : 500 }}>
                        {isTest ? "시험지에 분리되지 않은 문항이 있습니다" : "문항 번호에 빈칸이 있습니다"}
                      </span>
                      {missingShown.length > 0 && (
                        <span style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-text-secondary)", fontWeight: 600 }}>
                          누락 Q{missingShown.join(", Q")}{remaining > 0 ? ` 외 ${remaining}건` : ""}
                        </span>
                      )}
                      {numberAnomalies.duplicates > 0 && (
                        <span style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-text-secondary)" }}>
                          · 중복 {numberAnomalies.duplicates}건
                        </span>
                      )}
                      {selectedDoc && (
                        <button
                          type="button"
                          onClick={() => setCropDocId(selectedDoc.id)}
                          data-testid="matchup-number-gap-crop-cta"
                          style={/* eslint-disable-line no-restricted-syntax */ {
                            marginLeft: "auto",
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "4px 10px", borderRadius: 4,
                            background: isTest ? "var(--color-warning)" : "var(--color-bg-surface)",
                            color: isTest ? "white" : "var(--color-brand-primary)",
                            border: isTest ? "none" : "1px solid var(--color-brand-primary)",
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                          }}
                          title={isTest
                            ? "직접 자르기로 누락된 문항을 추가하면 적중 PDF에 모두 포함됩니다"
                            : "직접 자르기로 누락 문항 추가"}
                        >
                          <Crop size={11} />
                          직접 자르기로 추가
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* 본문: 좌 문제 그리드 + 우 유사 추천 */}
                <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", gap: "var(--space-4)", flex: 1, minHeight: 0 }}>
                  <div ref={gridContainerRef} style={/* eslint-disable-line no-restricted-syntax */ { flex: 3, minWidth: 0, overflowY: "auto" }}>
                    <h4 style={/* eslint-disable-line no-restricted-syntax */ {
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
                      mergeMode={mergeMode}
                      mergeSelectedIds={mergeSelectedIds}
                      onToggleMergeMode={handleToggleMergeMode}
                      onToggleMergeSelect={handleToggleMergeSelect}
                      onClearMergeSelection={handleClearMergeSelection}
                      onConfirmMerge={handleOpenMergeModal}
                    />
                  </div>

                  <div style={/* eslint-disable-line no-restricted-syntax */ {
                    flex: 2.4, minWidth: 360, overflowY: "auto",
                    borderLeft: "1px solid var(--color-border-divider)",
                    paddingLeft: "var(--space-4)",
                    display: "flex", flexDirection: "column", minHeight: 0,
                  }}>
                    <div style={/* eslint-disable-line no-restricted-syntax */ {
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
                          style={/* eslint-disable-line no-restricted-syntax */ {
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
                            ? "이 탭은 '시험지'에서만 보입니다. 헤더의 시험지/참고자료 토글로 바꿀 수 있어요."
                            : undefined}
                        >
                          {t.icon}
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div style={/* eslint-disable-line no-restricted-syntax */ { flex: 1, minHeight: 0, overflowY: "auto" }}>
                      {/* 합치기 모드 도움말 — 우측 패널이 비어있으면 학원장이 "왜 안 보이지?" 혼란.
                          합치기 모드 컨텍스트를 명시적으로 안내. */}
                      {mergeMode && rightPanelTab === "similar" ? (
                        <MergeModeRightPanel
                          selectedCount={mergeSelectedIds.length}
                          onConfirm={handleOpenMergeModal}
                          onClear={handleClearMergeSelection}
                          onExit={handleToggleMergeMode}
                        />
                      ) : rightPanelTab === "similar" ? (
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
            initialPage={cropInitialPage ?? undefined}
            onClose={() => {
              setCropDocId(null);
              setCropInitialPage(null);
            }}
          />
        ) : null;
      })()}

      {reviewerDocId && (() => {
        const doc = documents.find((d) => d.id === reviewerDocId);
        const lowConfPages = doc?.meta?.paper_type_summary?.low_conf_pages ?? [];
        if (!doc || lowConfPages.length === 0) return null;
        return (
          <LowConfPageReviewer
            document={doc}
            lowConfPages={lowConfPages}
            onClose={() => setReviewerDocId(null)}
            onRequestManualCrop={(pageIndex) => {
              setReviewerDocId(null);
              setCropInitialPage(pageIndex);
              setCropDocId(doc.id);
            }}
          />
        );
      })()}

      {hitReportDocId && (
        <HitReportEditor
          docId={hitReportDocId}
          onClose={() => setHitReportDocId(null)}
        />
      )}

      {hitReportListOpen && (
        <HitReportListModal
          isAdmin={isAcademyAdmin}
          onClose={() => setHitReportListOpen(false)}
          onOpen={(docId) => {
            setHitReportListOpen(false);
            setHitReportDocId(docId);
          }}
        />
      )}

      {mergeModalOpen && selectedDocId && mergeSelectedIds.length >= 2 && (() => {
        const selectedProblems = mergeSelectedIds
          .map((id) => problems.find((p) => p.id === id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p));
        if (selectedProblems.length < 2) return null;
        return (
          <MergeProblemsModal
            docId={selectedDocId}
            problems={selectedProblems}
            onClose={() => setMergeModalOpen(false)}
            onSuccess={handleMergeSuccess}
          />
        );
      })()}

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

// ── 헤더 보조 액션 ⋮ 메뉴 — 원본보기/저장소 등 자주 안 쓰는 액션을 묶어 노이즈 감소.
//    학원장이 메인 CTA(적중보고서/직접자르기)에 집중할 수 있도록 분리.
function HeaderMoreMenu({
  onPreview,
  onOpenStorage,
}: {
  onPreview: () => void;
  onOpenStorage: (() => void) | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} style={/* eslint-disable-line no-restricted-syntax */ { position: "relative" }}>
      <Button
        size="sm"
        intent="ghost"
        onClick={() => setOpen((v) => !v)}
        title="더 보기"
        data-testid="matchup-doc-more-menu-trigger"
        leftIcon={<MoreHorizontal size={ICON.sm} />}
      >
        더 보기
      </Button>
      {open && (
        <div
          role="menu"
          data-testid="matchup-doc-more-menu"
          style={/* eslint-disable-line no-restricted-syntax */ {
            position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 30,
            minWidth: 200, padding: 4,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            display: "flex", flexDirection: "column", gap: 1,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onPreview(); }}
            data-testid="matchup-doc-preview-btn"
            style={moreMenuItemStyle}
          >
            <Eye size={ICON.sm} />
            <span>원본 PDF 보기</span>
          </button>
          {onOpenStorage && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onOpenStorage(); }}
              data-testid="matchup-doc-storage-link"
              style={moreMenuItemStyle}
            >
              <FolderOpen size={ICON.sm} />
              <span>저장소에서 보기</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const moreMenuItemStyle: React.CSSProperties = /* eslint-disable-line no-restricted-syntax */ {
  display: "flex", alignItems: "center", gap: 8,
  width: "100%", padding: "8px 12px",
  background: "transparent", border: "none",
  borderRadius: "var(--radius-sm)",
  textAlign: "left", fontSize: 13, fontWeight: 500,
  color: "var(--color-text-primary)",
  cursor: "pointer", fontFamily: "inherit",
};

// ── 합치기 모드 우측 패널 — 학원장이 "왜 추천이 안 보이지?" 혼란하지 않도록
//    현재 모드 컨텍스트와 다음 행동을 친절하게 가이드.
function MergeModeRightPanel({
  selectedCount,
  onConfirm,
  onClear,
  onExit,
}: {
  selectedCount: number;
  onConfirm: () => void;
  onClear: () => void;
  onExit: () => void;
}) {
  return (
    <div
      data-testid="matchup-merge-mode-right-panel"
      style={/* eslint-disable-line no-restricted-syntax */ {
        display: "flex", flexDirection: "column", gap: "var(--space-3)",
        padding: "var(--space-4)",
      }}
    >
      <div style={/* eslint-disable-line no-restricted-syntax */ {
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px",
        background: "color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-bg-surface))",
        border: "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)",
        borderRadius: "var(--radius-md)",
      }}>
        <Layers size={ICON.md} style={{ color: "var(--color-brand-primary)", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-brand-primary)" }}>
            합치기 모드
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
            한 문항이 여러 칸으로 쪼개진 경우 묶어서 1개로 만듭니다.
          </div>
        </div>
      </div>

      <ol
        style={/* eslint-disable-line no-restricted-syntax */ {
          margin: 0,
          paddingLeft: 18,
          fontSize: 12,
          lineHeight: 1.7,
          color: "var(--color-text-secondary)",
        }}
      >
        <li>좌측에서 합치고 싶은 문항을 <strong>위→아래 순서대로</strong> 클릭하세요.</li>
        <li>2개 이상 선택되면 아래 <strong>합치기</strong> 버튼이 활성화됩니다.</li>
        <li>합쳐진 결과는 즉시 그리드에 1개 카드로 반영됩니다.</li>
      </ol>

      <div
        style={/* eslint-disable-line no-restricted-syntax */ {
          padding: "12px 14px",
          borderRadius: "var(--radius-md)",
          background: selectedCount >= 2
            ? "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)"
            : "var(--color-bg-surface-soft)",
          border: selectedCount >= 2
            ? "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)"
            : "1px dashed var(--color-border-divider)",
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <strong style={{
          fontSize: 22, fontWeight: 800,
          color: selectedCount >= 2 ? "var(--color-brand-primary)" : "var(--color-text-muted)",
          minWidth: 28,
        }}>{selectedCount}</strong>
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)", flex: 1 }}>
          {selectedCount === 0
            ? "아직 선택된 문항이 없습니다."
            : selectedCount === 1
              ? "1개 더 선택하면 합칠 수 있어요."
              : `${selectedCount}개 → 1개로 합칠 준비 완료.`}
        </span>
      </div>

      <div style={/* eslint-disable-line no-restricted-syntax */ { display: "flex", gap: 8, flexDirection: "column" }}>
        <Button
          size="sm"
          intent="primary"
          disabled={selectedCount < 2}
          onClick={onConfirm}
          data-testid="matchup-merge-right-panel-confirm"
          leftIcon={<Layers size={ICON.sm} />}
        >
          {selectedCount < 2 ? "2개 이상 선택해 주세요" : `${selectedCount}개를 1개로 합치기`}
        </Button>
        {selectedCount > 0 && (
          <Button size="sm" intent="ghost" onClick={onClear}>
            선택 해제
          </Button>
        )}
        <Button size="sm" intent="ghost" onClick={onExit}>
          합치기 모드 종료
        </Button>
      </div>
    </div>
  );
}

// ── 시험지 ↔ 참고자료 segmented 토글.
//    뱃지 + 변경 버튼 2개로 쪼개졌던 컨트롤을 한 곳으로 통합. 현재 상태와 변경 동작을
//    한 컨트롤로 합쳐 학원장이 "지금 어느 쪽인지" 즉시 인지 + 한 번 클릭으로 전환.
function IntentToggle({
  value,
  onChange,
  disabled,
}: {
  value: "test" | "reference";
  onChange: (next: "test" | "reference") => void;
  disabled: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="문서 유형"
      data-testid="matchup-intent-toggle"
      style={/* eslint-disable-line no-restricted-syntax */ {
        display: "inline-flex",
        padding: 2,
        borderRadius: 999,
        background: "var(--color-bg-surface-soft)",
        border: "1px solid var(--color-border-divider)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {(["test", "reference"] as const).map((key) => {
        const active = value === key;
        const label = key === "test" ? "시험지" : "참고자료";
        const tone = key === "test" ? "var(--color-warning)" : "var(--color-brand-primary)";
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled || active}
            onClick={() => onChange(key)}
            data-active={active}
            data-testid={`matchup-intent-toggle-${key}`}
            style={/* eslint-disable-line no-restricted-syntax */ {
              padding: "3px 12px",
              border: "none",
              borderRadius: 999,
              background: active ? "var(--color-bg-surface)" : "transparent",
              color: active ? tone : "var(--color-text-muted)",
              fontWeight: active ? 700 : 500,
              fontSize: 12,
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              cursor: disabled || active ? "default" : "pointer",
              transition: "background 0.12s, color 0.12s",
            }}
            title={active ? `현재 ${label}` : `${label}로 변경`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

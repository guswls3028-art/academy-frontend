// PATH: src/app_admin/domains/storage/pages/MatchupPage.tsx
// 매치업 메인 페이지 — 2-패널 (문서 목록 + 문제 그리드/유사 추천)

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Sparkles, AlertTriangle, RefreshCw, Eye, BookOpen, Crop, ClipboardList, FolderTree, FolderInput, Plus } from "lucide-react";
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
  bulkDeleteMatchupProblems,
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
import DocumentGuidanceBanner from "../components/matchup/DocumentGuidanceBanner";
import BulkDeleteModal from "../components/matchup/BulkDeleteModal";
import HeaderMoreMenu from "./MatchupPage.parts/HeaderMoreMenu";
import MergeModeRightPanel from "./MatchupPage.parts/MergeModeRightPanel";
import IntentToggle from "./MatchupPage.parts/IntentToggle";
import {
  getDocumentIntent, getSourceType, SOURCE_TYPE_LABELS, SOURCE_TYPE_ORDER,
  type MatchupSourceType,
} from "../components/matchup/documentIntent";
import css from "@/shared/ui/domain/PanelWithTreeLayout.module.css";

// P2-θ — svh (small viewport height) 지원 여부 모듈 1회 detect. 미지원 브라우저
// (Safari 15.x 등) 에서는 vh fallback. CSS.supports 가 dev 환경에서 SSR 호환 위해
// typeof guard.
const SUPPORTS_SVH =
  typeof CSS !== "undefined" && typeof CSS.supports === "function"
    ? CSS.supports("height", "100svh")
    : false;

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
  // A-2 (2026-05-08) — 자동분리 잔존 일괄삭제 모달 (이전엔 native window.prompt).
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // P1 (2026-05-04) — HitReportListPage에서 navigate({state: {openHitReportForDoc: docId}})로
  // 진입 시 자동 doc 선택 + HitReportEditor 오픈. sidebar→리스트→편집기 흐름 단축.
  // navigate state 두 가지 처리:
  //   - openHitReportForDoc: 적중 보고서 리스트 → 편집기 다이렉트 진입
  //   - selectDocId: 우하단 작업박스(AsyncStatusBar) 매치업 작업 클릭 → 해당 doc 자동 선택
  const location = useLocation();
  useEffect(() => {
    const state = location.state as {
      openHitReportForDoc?: number;
      selectDocId?: number;
    } | null;
    const reportDocId = state?.openHitReportForDoc;
    const selectDocId = state?.selectDocId;
    let consumed = false;
    if (typeof reportDocId === "number" && reportDocId > 0) {
      setHitReportDocId(reportDocId);
      consumed = true;
    }
    if (typeof selectDocId === "number" && selectDocId > 0) {
      setSelectedDocId(selectDocId);
      setSelectedProblemId(null);
      consumed = true;
    }
    if (consumed) {
      // state 소비 — 한 번만 트리거. reload 시 잔존 방지.
      window.history.replaceState({}, "", location.pathname);
    }
  }, [location, setSelectedDocId]);
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

  // P2-γ (2026-05-08) — tenant/user swap 시 URL ?docId=N 자동 strip.
  // logout/login 으로 user.id 가 바뀌면 이전 사용자가 보고 있던 doc 의 id 가 URL 에
  // 잔존해 backend 에서 404/403 (cross-tenant 격리) 으로 막혀도 URL 자체가 leak 신호.
  // user 변경 감지 시 selection + URL 동시 reset.
  const prevUserIdRef = useRef<number | string | null | undefined>(undefined);
  useEffect(() => {
    const cur = user?.id ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== cur) {
      setSelectedDocIdState(null);
      setSelectedProblemId(null);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("docId");
        return next;
      }, { replace: true });
    }
    prevUserIdRef.current = cur;
  }, [user?.id, setSearchParams]);

  // 좌측 트리 폭 — 시험지 제목이 길어 250px 고정으론 가독성이 떨어진다는 사용자 피드백.
  // localStorage 에 영속하되 user.id 별로 분리. 같은 PC 에서 학원장 A/B 가 다른 폭을
  // 쓸 때 마지막 사용자가 다른 사용자 설정을 덮어쓰던 결함 fix (B-2 2026-05-08).
  const treeWidthKey = user?.id ? `matchup:tree-width:u${user.id}` : null;
  const [treeWidth, setTreeWidth] = useState<number>(280);
  // user 가 들어온 직후, 또는 user 가 바뀐 직후 (logout/login swap) 에 그 user 의
  // 저장값을 reload. 키가 없으면(비로그인 상태) default 유지.
  useEffect(() => {
    if (!treeWidthKey) return;
    try {
      const raw = window.localStorage.getItem(treeWidthKey);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n >= 220 && n <= 520) setTreeWidth(n);
    } catch { /* ignore */ }
  }, [treeWidthKey]);
  const handleTreeResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = treeWidth;
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(220, Math.min(520, startWidth + (ev.clientX - startX)));
      setTreeWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [treeWidth]);

  // treeWidth 변경 시 localStorage 동기화 (드래그 중 매 프레임 저장).
  useEffect(() => {
    if (!treeWidthKey) return;
    try {
      window.localStorage.setItem(treeWidthKey, String(treeWidth));
    } catch { /* ignore */ }
  }, [treeWidth, treeWidthKey]);

  // ── 문서 목록 ──
  // D-4 cold load 단축 (audit 2026-05-08) — staleTime 60s + gcTime 5min.
  // 학원장이 다른 페이지 갔다 다시 돌아오는 시간(보통 5초~수분) 안에는 마지막 데이터를
  // 그대로 보여주고 background refetch 만 수행 → "왼쪽에서 문서 선택해 주세요" 빈 상태가
  // 짧게 깜빡이던 결함 fix. 문서 status 변경은 useMatchupPolling 이 별도로 처리.
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["matchup-documents"],
    queryFn: fetchMatchupDocuments,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
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

  // 처리 중 doc을 우상단 작업박스에 자동 재등록 (페이지 새로고침/탭 이동 후에도 진행률 유지).
  // P2-ι (2026-05-08) — 이전엔 dep 이 `documents` array ref 라서 polling 시 매 refetch
  // 마다 effect 가 재실행 → asyncStatusStore.addWorkerJob 호출 (hasAsyncWorkerTask 로
  // 중복 방지되지만 store 구독자에 영향). stable string key 로 전환 — 처리 중 doc
  // 의 (id, ai_job_id) 조합이 바뀔 때만 트리거.
  const processingPendingKey = useMemo(
    () => documents
      .filter((d) => d.status === "processing" || d.status === "pending")
      .map((d) => `${d.id}:${d.ai_job_id ?? "watch"}:${d.title}`)
      .join("|"),
    [documents],
  );
  useEffect(() => {
    documents.forEach((d) => {
      if (d.status !== "processing" && d.status !== "pending") return;
      if (d.ai_job_id) {
        if (hasAsyncWorkerTask(d.ai_job_id)) return;
        asyncStatusStore.addWorkerJob(
          `매치업 분석: ${d.title}`,
          d.ai_job_id,
          "matchup_analysis",
          d.id,
        );
      } else {
        const watchId = `matchup-doc-${d.id}`;
        if (hasAsyncWorkerTask(watchId)) return;
        asyncStatusStore.addWorkerJob(
          `매치업 분석 준비 중: ${d.title}`,
          watchId,
          "matchup_document_watch",
          d.id,
        );
      }
    });
    // documents ref 가 매 polling 마다 바뀌어도 processingPendingKey 가 같으면 noop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingPendingKey]);

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

  // P2-δ (2026-05-08) — 진행 중인 별표 토글 race 방지. 옵티미스틱 저장 응답 전에
  // 같은 별을 또 클릭하면 stale base 로 second 요청이 출발해 결과가 꼬일 수 있음.
  // 진행 중 candidateId 를 Set 에 담아 SimilarResults 가 disable + spinner 노출.
  const [pendingPinIds, setPendingPinIds] = useState<Set<number>>(() => new Set());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTogglePin = useCallback((candidateId: number, _candidate: SimilarProblem) => {
    if (!hitReportId || !selectedProblemId) return;
    if (pendingPinIds.has(candidateId)) return;  // 진행 중이면 무시
    const examPid = selectedProblemId;
    const cur = pinsByExamPid[examPid] || new Set<number>();
    const has = cur.has(candidateId);
    const next = new Set(cur);
    if (has) next.delete(candidateId);
    else next.add(candidateId);

    // 옵티미스틱: 별표 색 즉시 반영. 토스트는 흐름 끊겨서 silent — 별표 색 변화로 충분.
    setPinsByExamPid((prev) => ({ ...prev, [examPid]: next }));
    setPendingPinIds((prev) => {
      const n = new Set(prev);
      n.add(candidateId);
      return n;
    });

    upsertHitReportEntries(hitReportId, [
      {
        exam_problem_id: examPid,
        selected_problem_ids: Array.from(next),
        comment: "",
        order: 0,
      },
    ])
      .catch(() => {
        // 실패 시에만 롤백 + 알림. 사용자가 변경 손실 즉시 인지해야 함.
        setPinsByExamPid((prev) => ({ ...prev, [examPid]: cur }));
        feedback.error("별표 저장 실패 — 다시 시도해 주세요");
      })
      .finally(() => {
        setPendingPinIds((prev) => {
          const n = new Set(prev);
          n.delete(candidateId);
          return n;
        });
      });
  }, [hitReportId, selectedProblemId, pinsByExamPid, pendingPinIds]);

  const { data: rawProblems = [], isLoading: problemsLoading } = useQuery({
    queryKey: ["matchup-problems", selectedDocId],
    queryFn: () => fetchMatchupProblems(selectedDocId!),
    // status==='processing'에서도 활성화 — 백엔드가 세그멘테이션 직후 skeleton row를
    // INSERT하므로 신규 업로드 사용자에게 즉시 부분 결과(N개 카드 + "처리 중" 뱃지)
    // 노출 가능. useMatchupPolling이 polling 주기마다 invalidate해 자동 refetch.
    enabled: !!selectedDocId && (selectedDoc?.status === "done" || selectedDoc?.status === "processing"),
  });

  // 카드 그리드는 항상 문항 번호 오름차순 — 백엔드 응답 순서 의존하지 않음.
  // 동일 번호 중복 시(merge_suspect 등) id로 안정 정렬.
  const problems = useMemo(
    () => [...rawProblems].sort((a, b) => (a.number - b.number) || (a.id - b.id)),
    [rawProblems],
  );

  // 첫 카드 자동 선택 — 학원장이 문서 클릭하자마자 우측에 매치 결과가 보이도록.
  // mergeMode 동안은 의도적으로 null이라 자동 선택 금지.
  useEffect(() => {
    if (mergeMode) return;
    if (selectedProblemId !== null) return;
    if (problems.length === 0) return;
    setSelectedProblemId(problems[0].id);
    // problems 변경(문서 전환·새 카드 추가) 또는 selection 해제 시에만 트리거.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems, mergeMode]);

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
          doc.id,
        );
      } else if (doc.id) {
        asyncStatusStore.addWorkerJob(
          `매치업 분석 준비 중: ${doc.title || payload.file.name}`,
          `matchup-doc-${doc.id}`,
          "matchup_document_watch",
          doc.id,
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
          doc.id,
        );
      } else if (doc?.id) {
        asyncStatusStore.addWorkerJob(
          `매치업 분석 준비 중: ${doc.title}`,
          `matchup-doc-${doc.id}`,
          "matchup_document_watch",
          doc.id,
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

  // 합치기 모드 진입 직전 selectedProblemId 보관 — 모드 종료 시 복귀해서
  // 학원장이 보던 매치 결과로 자연스럽게 돌아오도록.
  const preMergeProblemIdRef = useRef<number | null>(null);
  const handleToggleMergeMode = useCallback(() => {
    setMergeMode((prev) => {
      const next = !prev;
      if (next) {
        // 진입: 현재 선택한 problem 보관 + 우측 패널은 도움말로 교체되므로 selection 해제
        preMergeProblemIdRef.current = selectedProblemId;
        setSelectedProblemId(null);
      } else {
        // 종료: 보관해둔 problem 복귀 → 우측 SimilarResults가 자연스럽게 다시 보임
        setMergeSelectedIds([]);
        const restore = preMergeProblemIdRef.current;
        preMergeProblemIdRef.current = null;
        if (restore !== null) setSelectedProblemId(restore);
      }
      return next;
    });
  }, [selectedProblemId]);

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
  // B-2 (2026-05-08) — user.id namespace. 같은 PC 학원장 A/B 가 토글을 공유하던
  // 결함 fix. 학원장 A 가 ON 으로 둔 상태로 학원장 B 로그인 시 B 의 의도 없이
  // reanalyze 가 트리거되던 위험 차단.
  const autoReanalyzeKey = user?.id
    ? `matchup-source-type-auto-reanalyze:u${user.id}`
    : null;
  const [autoReanalyze, setAutoReanalyze] = useState<boolean>(false);
  useEffect(() => {
    if (!autoReanalyzeKey) {
      setAutoReanalyze(false);
      return;
    }
    try {
      setAutoReanalyze(localStorage.getItem(autoReanalyzeKey) === "1");
    } catch {
      setAutoReanalyze(false);
    }
  }, [autoReanalyzeKey]);
  const toggleAutoReanalyze = useCallback((next: boolean) => {
    setAutoReanalyze(next);
    if (!autoReanalyzeKey) return;
    try {
      localStorage.setItem(autoReanalyzeKey, next ? "1" : "0");
    } catch {
      // localStorage 불가 환경(시크릿 모드 등)에서도 in-memory state는 유지
    }
  }, [autoReanalyzeKey]);

  // Phase 17 — post-upload source_type 보정. 학원장이 잘못 백필된 라벨 즉시 정정.
  // autoReanalyze ON이면 변경 즉시 재분석까지 트리거.
  //
  // C-5 (2026-05-08) — autoReanalyze ON + manual cut 다수 시 confirm. 학원장 의도가
  // "유형 라벨만 바꾸자"인데 reanalyze 가 자동분리 결과 전체를 갈아엎는 인지 갭 차단.
  // manual cut 은 immutable safeguard 로 보존되지만 paper_type_summary / processing_quality
  // / 자동분리 잔존은 모두 새로 생성됨.
  const handleChangeSourceType = useCallback(
    async (sourceType: import("../components/matchup/documentIntent").MatchupSourceType) => {
      if (!selectedDoc) return;
      if (autoReanalyze) {
        const manualCount = problems.filter((p) => Boolean(p.meta?.manual)).length;
        const autoCount = problems.length - manualCount;
        const ok = await confirm({
          title: "자료 유형 변경 + 재분석",
          message:
            `자동 재분석이 켜져 있어 유형 변경 즉시 자동분리가 다시 실행됩니다.\n\n` +
            (autoCount > 0
              ? `· 자동분리 ${autoCount}개 문항이 새로 생성됩니다 (기존 결과 대체)\n`
              : "") +
            (manualCount > 0
              ? `· 직접 자른 ${manualCount}개 문항은 보존됩니다\n`
              : "") +
            `\n유형 라벨만 바꾸려면 "취소" 후 상단 토글을 끄고 다시 시도해 주세요.`,
          confirmText: "유형 변경 + 재분석",
          cancelText: "취소",
          danger: false,
        });
        if (!ok) return;
      }
      try {
        await updateMatchupDocument(selectedDoc.id, { source_type: sourceType });
        await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
        if (autoReanalyze) {
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
          feedback.success("자료 유형을 변경했습니다. 재분석 버튼을 누르면 새 방식으로 다시 추출합니다.");
        }
      } catch (e) {
        console.error(e);
        feedback.error("자료 유형 변경 실패");
      }
    },
    [selectedDoc, qc, autoReanalyze, problems, confirm],
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
        // svh(small viewport height)는 모바일 주소창 표시 상태에서 측정 — iPad/모바일에서
        // 100vh가 화면 밖으로 빠지는 사고 방지.
        // P2-θ (2026-05-08) — Safari 15.x 등 svh 미지원 브라우저 fallback. CSS.supports
        // 로 런타임 detect 후 vh fallback. CSS variable 사용 시 더 깔끔하지만 inline
        // 스타일이라 ternary 로 처리.
        maxHeight: SUPPORTS_SVH ? "calc(100svh - 100px)" : "calc(100vh - 100px)",
        height: SUPPORTS_SVH ? "calc(100svh - 100px)" : "calc(100vh - 100px)",
      }}>
        <div className={css.body}>
          {/* 좌측: 문서 목록 — 폭은 사용자가 우측 가장자리를 드래그해 조절 가능 (220~520px).
              CSS Module의 .tree는 250px 고정이므로 inline style로 override한다. */}
          <div className={css.tree} style={/* eslint-disable-line no-restricted-syntax */ {
            width: treeWidth, minWidth: treeWidth,
          }}>
            {/* 강사/학원장 보고서 누적 진입점 — quick-access ghost link.
                메인 진입은 상단 탭 "적중 보고서"(/admin/storage/hit-reports). 본문은 매치업 작업
                중 즉시 모달로 본인/학원 보고서 모음을 훑는 보조 진입. 큰 푸른 강조 → ghost 격하
                (D-1+D-3 audit 2026-05-08). */}
            <div style={/* eslint-disable-line no-restricted-syntax */ {
              padding: "4px 8px",
              borderBottom: "1px solid var(--color-border-divider)",
              display: "flex", alignItems: "center",
            }}>
              <button
                onClick={() => setHitReportListOpen(true)}
                title={isAcademyAdmin
                  ? "학원 전체 강사가 제출한 적중 보고서를 빠르게 봅니다 (메인은 상단 탭)"
                  : "내가 작성한 적중 보고서를 빠르게 봅니다 (메인은 상단 탭)"}
                data-testid="matchup-hit-report-quick-link"
                style={/* eslint-disable-line no-restricted-syntax */ {
                  flex: 1, padding: "4px 6px",
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 11, fontWeight: 500,
                  border: "none",
                  borderRadius: 4,
                  background: "transparent",
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                  transition: "color 0.12s, background 0.12s",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--color-brand-primary)";
                  e.currentTarget.style.background = "color-mix(in srgb, var(--color-brand-primary) 6%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <FolderTree size={ICON.xs} />
                <span>{isAcademyAdmin ? "학원 적중 보고서 모음" : "내 적중 보고서 모음"}</span>
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

          {/* 트리 ↔ 우측 패널 사이 리사이즈 핸들.
              트리 div의 형제로 두어, 트리 내부 overflow:auto 스크롤바·스크롤 흐름과 충돌하지 않게 한다.
              평소엔 보이지 않다가 hover 시 brand 컬러로 노출 (cursor만으로도 위치 인지 가능). */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="좌측 트리 폭 조절"
            onPointerDown={handleTreeResizeStart}
            onDoubleClick={() => setTreeWidth(280)}
            title="드래그로 폭 조절 · 더블클릭으로 기본값(280px)"
            style={/* eslint-disable-line no-restricted-syntax */ {
              flexShrink: 0,
              width: 6,
              marginLeft: -3, marginRight: -3,
              cursor: "ew-resize",
              zIndex: 5,
              touchAction: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "color-mix(in srgb, var(--color-brand-primary) 35%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          />

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
                  {(() => {
                    // 메인 헤더 = 자료명(title). 학원장이 "무슨 자료인지" 식별하는 1차 키.
                    // 과목·카테고리는 Tier 2 메타 행(아래)에서 chip으로 별도 표시 — 중복 회피.
                    // title 비어있을 때만 subject·category fallback (raw 파일명 결함은 별도
                    // 자료명 정리 워크플로로 해결, 헤더에서 가리지 않음).
                    const rawTitle = (selectedDoc?.title || "").trim();
                    const fallback = [selectedDoc?.subject, selectedDoc?.category]
                      .filter(Boolean)
                      .join(" · ");
                    const mainText = rawTitle || fallback || "(제목 없음)";
                    const tooltip = rawTitle && fallback ? `${rawTitle} · ${fallback}` : mainText;
                    return (
                      <h3 style={/* eslint-disable-line no-restricted-syntax */ { margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tooltip}>
                        {mainText}
                      </h3>
                    );
                  })()}
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
                  {/* 보조 액션 — ⋮ 메뉴로 묶음. 자주 안 쓰이는 "범위 일괄삭제"는
                      P2 헤더 정비로 ⋮ 메뉴 안으로 이동 (편의성 보존, 헤더 잡음 감소). */}
                  {selectedDoc && (
                    <HeaderMoreMenu
                      onPreview={() => setPreviewDocId(selectedDoc.id)}
                      onOpenStorage={selectedDoc.inventory_file_id ? () => navigate("/admin/storage/files") : null}
                      onBulkDelete={problems.length > 0 ? () => setBulkDeleteOpen(true) : null}
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
                      title={selectedDoc.category ? "클릭해서 카테고리 변경" : "클릭해서 카테고리 추가 — 학교/학기 등 자료를 묶을 폴더 이름"}
                      style={/* eslint-disable-line no-restricted-syntax */ {
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 11, padding: "2px 8px", borderRadius: 4,
                        background: selectedDoc.category
                          ? "color-mix(in srgb, var(--color-brand-primary) 8%, transparent)"
                          : "var(--color-bg-surface-soft)",
                        color: selectedDoc.category
                          ? "var(--color-brand-primary)"
                          : "var(--color-text-secondary)",
                        border: selectedDoc.category
                          ? "1px solid color-mix(in srgb, var(--color-brand-primary) 35%, transparent)"
                          : "1px dashed color-mix(in srgb, var(--color-brand-primary) 30%, var(--color-border-divider))",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {selectedDoc.category ? (
                        <>
                          <FolderInput size={ICON.xs} />
                          {selectedDoc.category}
                        </>
                      ) : (
                        <>
                          <Plus size={ICON.xs} />
                          카테고리 추가
                        </>
                      )}
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
                      leftIcon={<RefreshCw size={ICON.sm} />}
                    >
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
                      leftIcon={<Crop size={ICON.sm} />}
                    >
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
                      {/* P2 헤더 정비 — 안내 텍스트를 tooltip 으로 압축. 행 잡음 감소. */}
                      <label style={/* eslint-disable-line no-restricted-syntax */ {
                        marginLeft: "auto",
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 11, color: "var(--color-text-secondary)",
                        cursor: "pointer", userSelect: "none",
                      }} title={autoReanalyze
                        ? "유형을 바꾸면 즉시 재분석이 트리거됩니다. 직접 자른 문항은 보존되지만 자동분리 결과는 새로 생성됩니다."
                        : "현재 유형 변경만 저장됩니다. 새 방식으로 다시 추출하려면 별도로 재분석 버튼을 눌러주세요."
                      }>
                        <input
                          type="checkbox"
                          checked={autoReanalyze}
                          onChange={(e) => toggleAutoReanalyze(e.target.checked)}
                          data-testid="matchup-source-type-auto-reanalyze-toggle"
                          style={/* eslint-disable-line no-restricted-syntax */ { cursor: "pointer" }}
                        />
                        변경 시 자동 재분석
                      </label>
                    </div>
                  );
                })()}

                {/* Stage 6.7-policy P0 — paper_type / processing_quality / indexable
                    통합 안내 배너. 9 paper_type + 5 quality + indexable 의미를 학원장
                    1회 시각으로 인식. 빨간색 사용 0, "권장 행동" 중심 copy. */}
                <DocumentGuidanceBanner document={selectedDoc} />

                {/* 검수 필요 페이지 CTA — paper_type / quality 안내는 위 DocumentGuidanceBanner
                    가 흡수, 여기는 "신뢰도 55% 미만 페이지를 한곳에서 처리" 진입점만 별도. */}
                {selectedDoc?.status === "done"
                  && Array.isArray(selectedDoc.meta?.paper_type_summary?.low_conf_pages)
                  && (selectedDoc.meta?.paper_type_summary?.low_conf_pages?.length ?? 0) > 0 && (
                  <div
                    data-testid="matchup-low-conf-cta"
                    style={/* eslint-disable-line no-restricted-syntax */ {
                      flexShrink: 0,
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      background: "color-mix(in srgb, var(--color-warning) 6%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)",
                      display: "flex", alignItems: "center", gap: "var(--space-2)",
                      flexWrap: "wrap",
                    }}
                  >
                    <Eye size={ICON.sm} style={/* eslint-disable-line no-restricted-syntax */ { color: "var(--color-warning)", flexShrink: 0 }} />
                    <span style={/* eslint-disable-line no-restricted-syntax */ {
                      fontSize: 12, fontWeight: 700, color: "var(--color-warning)",
                    }}>
                      검수 필요 페이지 {selectedDoc.meta.paper_type_summary.low_conf_pages.length}건
                    </span>
                    <span style={/* eslint-disable-line no-restricted-syntax */ {
                      fontSize: 11, color: "var(--color-text-secondary)",
                    }}>
                      (자동분리 신뢰도 55% 미만)
                    </span>
                    <Button
                      intent="primary"
                      size="sm"
                      onClick={() => setReviewerDocId(selectedDoc.id)}
                      data-testid="matchup-low-conf-reviewer-open-btn"
                      leftIcon={<Eye size={ICON.sm} />}
                      style={/* eslint-disable-line no-restricted-syntax */ { marginLeft: "auto" }}
                    >
                      검수 페이지 열기
                    </Button>
                  </div>
                )}

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
                            whiteSpace: "nowrap", flexShrink: 0,
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
                      paperType={selectedDoc?.meta?.paper_type_summary?.primary}
                      fileSizeBytes={selectedDoc?.size_bytes}
                      progressPercent={selectedDoc ? progressMap[selectedDoc.id]?.percent : undefined}
                      progressStepName={selectedDoc ? progressMap[selectedDoc.id]?.stepName : undefined}
                      mergeMode={mergeMode}
                      mergeSelectedIds={mergeSelectedIds}
                      onToggleMergeMode={handleToggleMergeMode}
                      onToggleMergeSelect={handleToggleMergeSelect}
                      onClearMergeSelection={handleClearMergeSelection}
                      onConfirmMerge={handleOpenMergeModal}
                      onOpenManualCrop={selectedDoc ? () => setCropDocId(selectedDoc.id) : undefined}
                      onRetry={selectedDoc ? () => handleRetry(selectedDoc.id) : undefined}
                    />
                  </div>

                  <div style={/* eslint-disable-line no-restricted-syntax */ {
                    flex: 2, minWidth: 300, overflowY: "auto",
                    borderLeft: "1px solid var(--color-border-divider)",
                    paddingLeft: "var(--space-4)",
                    display: "flex", flexDirection: "column", minHeight: 0,
                  }}>
                    <div style={/* eslint-disable-line no-restricted-syntax */ {
                      display: "flex", gap: 4, marginBottom: "var(--space-2)",
                      borderBottom: "1px solid var(--color-border-divider)",
                    }}>
                      {[
                        { key: "similar", label: "유사 문제", icon: <Sparkles size={12} />, hint: "선택한 문항과 비슷한 문제를 전체 자료에서 찾아 보여줍니다" },
                        { key: "cross", label: "자료별 매치", icon: <BookOpen size={12} />, hint: "이 시험지의 모든 문항을 자료별로 묶어서 한 번에 봅니다" },
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
                            : t.hint}
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
                          pendingPinIds={
                            selectedDocIntent === "test" && hitReportId
                              ? pendingPinIds
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

      {bulkDeleteOpen && selectedDoc && (
        <BulkDeleteModal
          problems={problems}
          onClose={() => setBulkDeleteOpen(false)}
          onConfirm={async ({ numberFrom, numberTo }) => {
            try {
              const res = await bulkDeleteMatchupProblems(selectedDoc.id, {
                number_from: numberFrom,
                number_to: numberTo,
              });
              const preservedNote = res.preserved_manual > 0
                ? ` (직접 자른 ${res.preserved_manual}개 보호)`
                : "";
              feedback.success(`${res.deleted}개 문항 삭제 완료${preservedNote}`);
              await qc.invalidateQueries({ queryKey: ["matchup-problems", selectedDoc.id] });
              await qc.invalidateQueries({ queryKey: ["matchup-documents"] });
            } catch (e: unknown) {
              const msg = (e as Error)?.message ?? "일괄삭제 실패";
              feedback.error(msg);
              throw e;  // 모달 닫지 않도록 — 사용자가 재시도 가능
            }
          }}
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

// PATH: src/app_admin/domains/storage/components/matchup/HitReportEditor.tsx
// 매치업 적중 보고서 편집기 — 강사 1인의 3중 역할 산출물 (정체성 정정 2026-05-03).
//
// 비즈니스: 강사가 본인 수업 자료 중 시험에 적중한 항목을 직접 큐레이션 + 지도 코멘트 작성
//   → 소속 학원에 제출 (KPI) + 본인 누적 (수업 히스토리) + 카페/면담 신뢰자료/홍보물.
// 좌 pane = 학생 제출 학교 시험지 / 우 pane = 강사 본인 수업 자료.
//
// UI SSOT: 미리보기는 PDF 출력과 동일한 양식.
//   다크 헤더(Q번호 + 적중 라벨 + 유사도) + 좌/우 2-pane + 하단 코멘트 band.
//   사용자는 우측 후보 리스트 클릭으로 active 후보를 바꿔가며 비교 미리보기,
//   "+ PDF에 추가" 버튼으로 PDF에 들어갈 후보를 선택.
//
// 인라인 스타일은 PDF pane 색상/사이즈 토큰을 동적으로 매핑(적중분류색·캡션톤)하기 위해
// 의도적으로 사용. CSS 모듈로 옮기면 색상 매핑 함수 + className 조합이 더 복잡해지고
// PDF SSOT(_pane_color_for_class)와 동기화 비용 증가. 따라서 파일 단위 lint 예외.
/* eslint-disable no-restricted-syntax */

import { useEffect, useMemo, useState, useCallback } from "react";
import { X, Save, Send, FileText, Check, Share2, AlertTriangle, EyeOff, Eye } from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useConfirm } from "@/shared/ui/confirm";
import api from "@/shared/api/axios";
import ManualCropModal from "./ManualCropModal";
import {
  fetchHitReportDraft,
  updateHitReport,
  upsertHitReportEntries,
  submitHitReport,
  type HitReportDraftResponse,
  type HitReportSelectedMeta,
} from "../../api/matchup.api";
import { PreviewPane } from "./HitReportEditor.parts/PreviewPane";
import { SelectionPanel } from "./HitReportEditor.parts/SelectionPanel";
import type { CandidateMeta } from "./HitReportEditor.parts/types";

type Props = {
  docId: number;
  onClose: () => void;
};

type EntryDraft = {
  examProblemId: number;
  selectedProblemIds: number[];
  comment: string;
  order: number;
  // 강사가 매칭 못한/큐레이션 의도 없는 Q를 PDF에서 빼는 토글 (2026-05-05).
  // PDF 본문 + 적중률 분모 모두에서 skip.
  excluded: boolean;
  dirty: boolean;
};

export default function HitReportEditor({ docId, onClose }: Props) {
  const confirm = useConfirm();
  const [data, setData] = useState<HitReportDraftResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [entries, setEntries] = useState<Record<number, EntryDraft>>({});
  const [reportTitle, setReportTitle] = useState("");
  const [reportSummary, setReportSummary] = useState("");
  const [headerDirty, setHeaderDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 사용자 선택 problem 메타 (자동 후보에 없는 것까지 보강 캐시)
  const [extraMeta, setExtraMeta] = useState<Record<number, HitReportSelectedMeta>>({});
  // 미리보기 active 후보 — 우측 리스트에서 클릭한 항목. 선택과는 분리.
  const [activeCandidateId, setActiveCandidateId] = useState<number | null>(null);
  // 자료가 거의 똑같은데 잘린 게 애매해서 못 쓰는 경우(2026-05-05 강사 보고)
  // 보고서 화면에서 벗어나지 않고 ManualCropModal로 즉시 점프 → 자르기 → 닫으면
  // 후보 새로고침. 흐름 안 끊김.
  const [editSourceDoc, setEditSourceDoc] = useState<{ id: number; title: string } | null>(null);
  // 자동저장 실패 신호 — 1.5s debounce가 실패하면 토스트만으로는 사용자 인지 부족.
  // 상단 인디케이터를 빨간 "저장 실패" 상태로 stuck 시키고 클릭하면 재시도.
  const [autosaveError, setAutosaveError] = useState<boolean>(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const resp = await fetchHitReportDraft(docId);
      setData(resp);
      setReportTitle(resp.report.title || "");
      setReportSummary(resp.report.summary || "");
      setHeaderDirty(false);

      const next: Record<number, EntryDraft> = {};
      for (const ep of resp.exam_problems) {
        next[ep.id] = {
          examProblemId: ep.id,
          selectedProblemIds: ep.entry?.selected_problem_ids || [],
          comment: ep.entry?.comment || "",
          order: ep.entry?.order ?? 0,
          excluded: ep.entry?.excluded ?? false,
          dirty: false,
        };
      }
      setEntries(next);

      const m: Record<number, HitReportSelectedMeta> = {};
      for (const meta of resp.selected_problem_meta) m[meta.id] = meta;
      setExtraMeta(m);
    } catch (e) {
      console.error(e);
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "보고서 로드 실패 — 네트워크 또는 서버 오류.";
      setLoadError(msg);
      feedback.error(msg);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => { void load(); }, [load]);

  // useMemo로 array identity 안정화 — react-hooks/exhaustive-deps 경고 회피.
  const examProblems = useMemo(() => data?.exam_problems || [], [data]);
  const active = examProblems[activeIndex] || null;
  const activeEntry = active ? entries[active.id] : null;
  const reportId = data?.report.id ?? 0;
  const isSubmitted = data?.report.status === "submitted";

  // 후보 메타 + extraMeta로 selected problem 정보 lookup
  const candidateMap = useMemo(() => {
    const m = new Map<number, CandidateMeta>();
    for (const ep of examProblems) for (const c of ep.candidates) m.set(c.id, c);
    for (const v of Object.values(extraMeta)) m.set(v.id, v);
    return m;
  }, [examProblems, extraMeta]);

  const documentTitle = data?.report.document_title || "";
  const documentCategory = data?.report.document_category || "";

  // active Q 변경 시 → activeCandidateId 자동 설정 (선택된 첫번째 우선, 없으면 첫 후보)
  useEffect(() => {
    if (!active) {
      setActiveCandidateId(null);
      return;
    }
    const sel = activeEntry?.selectedProblemIds ?? [];
    if (sel.length > 0) {
      setActiveCandidateId(sel[0]);
    } else if (active.candidates.length > 0) {
      setActiveCandidateId(active.candidates[0].id);
    } else {
      setActiveCandidateId(null);
    }
    // active.id 변할 때만 — entry 갱신 시는 유지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // ── 편집 핸들러 ──

  const toggleSelect = useCallback((candidateId: number) => {
    if (isSubmitted || !active) return;
    setEntries((prev) => {
      const cur = prev[active.id];
      if (!cur) return prev;
      const has = cur.selectedProblemIds.includes(candidateId);
      const next = has
        ? cur.selectedProblemIds.filter((x) => x !== candidateId)
        : [...cur.selectedProblemIds, candidateId];
      return {
        ...prev,
        [active.id]: { ...cur, selectedProblemIds: next, dirty: true },
      };
    });
    // 신규 선택은 active로 끌어올림 (사용자가 방금 고른 자료 즉시 미리보기)
    setActiveCandidateId(candidateId);
  }, [active, isSubmitted]);

  const setComment = useCallback((value: string) => {
    if (isSubmitted || !active) return;
    setEntries((prev) => {
      const cur = prev[active.id];
      if (!cur) return prev;
      return { ...prev, [active.id]: { ...cur, comment: value, dirty: true } };
    });
  }, [active, isSubmitted]);

  // PDF 제외 토글 — 좌측 Q 리스트의 행 단위 토글.
  // ON이면 PDF 본문에 페이지 안 만들고 적중률 분모에서도 빠짐 (backend SSOT 동기).
  const toggleExcluded = useCallback((examProblemId: number) => {
    if (isSubmitted) return;
    setEntries((prev) => {
      const cur = prev[examProblemId];
      if (!cur) return prev;
      return {
        ...prev,
        [examProblemId]: { ...cur, excluded: !cur.excluded, dirty: true },
      };
    });
  }, [isSubmitted]);

  // ── 저장 ──

  const dirtyEntries = useMemo(
    () => Object.values(entries).filter((e) => e.dirty),
    [entries],
  );
  const dirtyCount = dirtyEntries.length + (headerDirty ? 1 : 0);

  // saveAll — silent=true면 성공 토스트 생략 (자동저장에서 사용).
  // 실패는 항상 토스트 (사용자가 데이터 손실 인지해야 함).
  const saveAll = useCallback(async (silent: boolean = false): Promise<boolean> => {
    if (!reportId) return false;
    if (isSubmitted) return false;
    if (saving) return false;  // race 방지 — autosave + manual 동시 호출 시 중복 PUT 차단
    setSaving(true);
    try {
      if (headerDirty) {
        await updateHitReport(reportId, {
          title: reportTitle,
          summary: reportSummary,
        });
        setHeaderDirty(false);
      }
      if (dirtyEntries.length > 0) {
        await upsertHitReportEntries(
          reportId,
          dirtyEntries.map((e) => ({
            exam_problem_id: e.examProblemId,
            selected_problem_ids: e.selectedProblemIds,
            comment: e.comment,
            order: e.order,
            excluded: e.excluded,
          })),
        );
        setEntries((prev) => {
          const next = { ...prev };
          for (const e of dirtyEntries) {
            const cur = next[e.examProblemId];
            if (cur) next[e.examProblemId] = { ...cur, dirty: false };
          }
          return next;
        });
      }
      setAutosaveError(false);
      if (!silent) feedback.success("보고서 저장 완료");
      return true;
    } catch (e) {
      console.error(e);
      // 자동/수동 모두 빨간 인디케이터로 stuck — 토스트는 휘발이라 인지 못 할 위험.
      // 자동 재시도(5초 후 1회)는 별도 useEffect에서 진행 — saving=false 보장 후 호출.
      setAutosaveError(true);
      feedback.error("저장 실패 — 잠시 후 자동 재시도. 안 되면 상단 '저장 실패' 버튼을 눌러주세요");
      return false;
    } finally {
      setSaving(false);
    }
  }, [dirtyEntries, headerDirty, isSubmitted, reportId, reportTitle, reportSummary, saving]);

  // 자동저장 실패 시 5초 후 1회 자동 재시도 — backend ResponseTime spike(50초+)가
  // 가라앉은 뒤 사용자 인지 전에 회복. 두번째도 fail이면 stuck 인디케이터 그대로.
  useEffect(() => {
    if (!autosaveError || isSubmitted || saving) return;
    const timer = setTimeout(() => { void saveAll(true); }, 5000);
    return () => clearTimeout(timer);
  }, [autosaveError, isSubmitted, saving, saveAll]);

  // 자동 저장 — dirty 후 1.5초 동안 추가 변경 없으면 자동 백엔드 동기화. 데이터 손실 방지.
  // silent=true로 토스트 노이즈 방지 (헤더 "저장됨" 표시로 충분).
  useEffect(() => {
    if (isSubmitted || !reportId) return;
    const dirtyAnyEntries = Object.values(entries).some((e) => e.dirty);
    if (!dirtyAnyEntries && !headerDirty) return;
    const timer = setTimeout(() => {
      void saveAll(true);
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, headerDirty, isSubmitted, reportId]);

  // ── 제출 ──

  const submit = useCallback(async () => {
    if (!reportId) return;
    if (isSubmitted) {
      feedback.info("이미 제출된 보고서입니다.");
      return;
    }
    const confirmMsg = dirtyCount > 0
      ? `미저장 ${dirtyCount}건을 자동 저장하고 학원에 제출합니다. 제출 후에는 수정이 잠깁니다. 진행할까요?`
      : "보고서를 학원에 제출하시겠습니까? 제출 후에는 수정이 잠깁니다.";
    const ok = await confirm({ title: "학원에 보고서 제출", message: confirmMsg, confirmText: "제출", cancelText: "취소" });
    if (!ok) return;
    setSubmitting(true);
    try {
      if (dirtyCount > 0) {
        const ok = await saveAll();
        if (!ok) {
          setSubmitting(false);
          return;
        }
      }
      const r = await submitHitReport(reportId);
      setData((prev) => (prev ? { ...prev, report: r } : prev));
      feedback.success("학원에 보고서가 제출되었습니다");
    } catch (e) {
      console.error(e);
      feedback.error("제출 실패");
    } finally {
      setSubmitting(false);
    }
  }, [dirtyCount, isSubmitted, reportId, saveAll, confirm]);

  const [pdfDownloading, setPdfDownloading] = useState(false);
  const downloadPdf = useCallback(async () => {
    if (!reportId) return;
    if (pdfDownloading) return;  // 중복 클릭 방지
    if (dirtyCount > 0) {
      const ok = await saveAll();
      if (!ok) return;
    }
    setPdfDownloading(true);
    try {
      const resp = await api.get(`/matchup/hit-reports/${reportId}/curated.pdf`, {
        responseType: "blob",
        timeout: 5 * 60_000,
      });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportTitle || documentTitle || "matchup"}-큐레이션보고서.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      feedback.success("PDF 다운로드 완료");
    } catch (e) {
      console.error(e);
      const status = (e as { response?: { status?: number } })?.response?.status;
      // 504 / timeout — 후보 수가 많으면 PDF 생성에 5분+ 소요. 사용자가 다음 행동을
      // 즉시 알 수 있도록 구체 가이드.
      const totalSelected = Object.values(entries).reduce(
        (n, e) => n + (e.selectedProblemIds?.length ?? 0),
        0,
      );
      const tooMany = totalSelected >= 30;
      const errMsg = status === 504
        ? tooMany
          ? `PDF 생성에 시간이 너무 오래 걸려 중단됐습니다 (담은 자료 ${totalSelected}개). 일부 자료의 별표를 빼서 30개 이하로 줄인 뒤 다시 시도해 주세요.`
          : "PDF 생성에 시간이 너무 오래 걸려 중단됐습니다. 잠시 후 다시 시도해 주세요. 같은 문제가 반복되면 담은 자료 수를 줄여보세요."
        : "PDF 생성 실패. 잠시 후 다시 시도해 주세요.";
      feedback.error(errMsg);
    } finally {
      setPdfDownloading(false);
    }
  }, [dirtyCount, documentTitle, reportId, reportTitle, saveAll, pdfDownloading, entries]);

  // 카페·블로그 공유용 ZIP — 페이지별 PNG + summary.md.
  // 강사가 본인 명의로 카페에 글 쓸 때 paste·업로드 가능.
  const [zipDownloading, setZipDownloading] = useState(false);
  const downloadShareZip = useCallback(async () => {
    if (!reportId) return;
    if (zipDownloading) return;
    if (dirtyCount > 0) {
      const ok = await saveAll();
      if (!ok) return;
    }
    setZipDownloading(true);
    try {
      const resp = await api.get(`/matchup/hit-reports/${reportId}/share.zip`, {
        responseType: "blob",
        timeout: 5 * 60_000,
      });
      const blob = new Blob([resp.data], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportTitle || documentTitle || "matchup"}-카페공유.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      feedback.success("카페·블로그용 이미지 묶음 다운로드 완료 (페이지 이미지 + 요약 텍스트)");
    } catch (e) {
      console.error(e);
      const status = (e as { response?: { status?: number } })?.response?.status;
      const errMsg = status === 504
        ? "이미지 묶음 생성에 시간이 너무 오래 걸려 중단됐습니다. 담은 자료 수를 줄이거나 잠시 후 다시 시도해 주세요."
        : "이미지 묶음 생성 실패. 잠시 후 다시 시도해 주세요.";
      feedback.error(errMsg);
    } finally {
      setZipDownloading(false);
    }
  }, [dirtyCount, documentTitle, reportId, reportTitle, saveAll, zipDownloading]);

  const closeWithDirtyGuard = useCallback(async () => {
    if (dirtyCount > 0) {
      const ok = await confirm({
        title: "보고서 닫기",
        message: `미저장 ${dirtyCount}건이 있습니다. 닫으시겠습니까?`,
        confirmText: "닫기",
        cancelText: "계속 작성",
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  }, [confirm, dirtyCount, onClose]);

  // 브라우저 새로고침/탭 닫기 가드 — 박철T 우려("작업 중 튕기진 않지?") 대응.
  // 1.5s 자동저장이 있어도 dirty 직후 새로고침 누르면 휘발. 표준 prompt로 차단.
  useEffect(() => {
    if (isSubmitted) return;
    const blocking = dirtyCount > 0 || saving || autosaveError;
    if (!blocking) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome ignores returnValue text but requires assignment for prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyCount, saving, autosaveError, isSubmitted]);

  // 키보드 네비
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") setActiveIndex((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight") setActiveIndex((i) => Math.min(examProblems.length - 1, i + 1));
      else if (e.key === "Escape") {
        void closeWithDirtyGuard();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [examProblems.length, closeWithDirtyGuard]);

  const headerStyle: React.CSSProperties = {
    padding: "12px 18px",
    borderBottom: "1px solid var(--color-border-divider)",
    background: "var(--color-bg-surface)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  };

  return (
    <>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="적중 보고서 작성"
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 1100,
        display: "flex", alignItems: "stretch", justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          void closeWithDirtyGuard();
        }
      }}
    >
      <div
        style={{
          width: "min(1500px, 97vw)",
          height: "min(95vh, 1040px)",
          margin: "auto 0",
          background: "var(--color-bg-canvas)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(15,23,42,0.32)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={headerStyle}>
          <FileText size={ICON.md} color="var(--color-status-success)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {documentCategory || "미분류"}
              {data?.report.author_name && (
                <>
                  {"  ·  "}
                  <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    {data.report.author_name} 강사
                  </span>
                </>
              )}
              {"  ·  "}매치업 적중 보고서
              {isSubmitted && (
                <span style={{
                  marginLeft: 8, padding: "1px 8px", borderRadius: 999,
                  background: "var(--color-status-success-bg, #dcfce7)",
                  color: "var(--color-status-success)", fontSize: 10, fontWeight: 700,
                }}>
                  학원 제출 완료
                </span>
              )}
            </div>
            <input
              value={reportTitle}
              placeholder={documentTitle || "보고서 제목"}
              onChange={(e) => { setReportTitle(e.target.value); setHeaderDirty(true); }}
              disabled={isSubmitted}
              style={{
                fontSize: 16, fontWeight: 700,
                border: "none", background: "transparent",
                color: "var(--color-text-primary)", outline: "none", padding: 0,
                width: "100%",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {/* 4-state 자동저장 인디케이터 —
                저장 중(파란) / 저장 실패(빨강·클릭 재시도) / 변경됨(주황) / 저장됨(회색 ✓) */}
            <button
              type="button"
              data-testid="matchup-hit-report-save-state"
              onClick={() => { if (autosaveError) void saveAll(); }}
              disabled={!autosaveError}
              title={autosaveError ? "클릭해서 다시 저장" : undefined}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 600,
                padding: "3px 9px", borderRadius: 999,
                cursor: autosaveError ? "pointer" : "default",
                background: saving
                  ? "color-mix(in srgb, var(--color-brand-primary) 10%, transparent)"
                  : autosaveError
                    ? "color-mix(in srgb, var(--color-status-error, #dc2626) 14%, transparent)"
                    : dirtyCount > 0
                      ? "color-mix(in srgb, var(--color-status-warning) 12%, transparent)"
                      : "var(--color-bg-surface-soft)",
                color: saving
                  ? "var(--color-brand-primary)"
                  : autosaveError
                    ? "var(--color-status-error, #dc2626)"
                    : dirtyCount > 0
                      ? "var(--color-status-warning)"
                      : "var(--color-text-muted)",
                border: "1px solid",
                borderColor: saving
                  ? "color-mix(in srgb, var(--color-brand-primary) 30%, transparent)"
                  : autosaveError
                    ? "color-mix(in srgb, var(--color-status-error, #dc2626) 35%, transparent)"
                    : dirtyCount > 0
                      ? "color-mix(in srgb, var(--color-status-warning) 30%, transparent)"
                      : "var(--color-border-divider)",
              }}
            >
              {autosaveError && <AlertTriangle size={ICON.xs} />}
              {saving
                ? "저장 중…"
                : autosaveError
                  ? "저장 실패 — 클릭해서 다시 저장"
                  : dirtyCount > 0
                    ? `변경됨 (${dirtyCount}건, 곧 자동 저장)`
                    : "저장됨 ✓"}
            </button>
            <Button
              size="sm"
              intent="ghost"
              onClick={() => void saveAll()}
              disabled={saving || isSubmitted || dirtyCount === 0}
              leftIcon={<Save size={ICON.sm} />}
            >
              지금 저장
            </Button>
            <Button
              size="sm"
              intent="ghost"
              onClick={() => void downloadPdf()}
              disabled={saving || pdfDownloading}
              leftIcon={<FileText size={ICON.sm} />}
            >
              {pdfDownloading ? "PDF 생성 중…" : "PDF 다운로드"}
            </Button>
            <Button
              size="sm" intent="ghost"
              onClick={() => void downloadShareZip()}
              disabled={saving || zipDownloading}
              title="페이지별 이미지 + 요약 텍스트 — 학원 카페·블로그에 그대로 붙여넣기 / 업로드"
              leftIcon={<Share2 size={ICON.sm} />}
            >
              {zipDownloading ? "압축 중…" : "카페·블로그용 이미지 묶음"}
            </Button>
            <Button
              size="sm"
              intent="primary"
              onClick={() => void submit()}
              disabled={submitting || isSubmitted}
              leftIcon={<Send size={ICON.sm} />}
            >
              {isSubmitted ? "제출 완료" : "학원에 제출"}
            </Button>
            <button
              onClick={() => void closeWithDirtyGuard()}
              aria-label="닫기"
              style={{
                marginLeft: 4, padding: 6, border: "none", background: "transparent",
                cursor: "pointer", color: "var(--color-text-secondary)",
              }}
            >
              <X size={ICON.md} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
            color: "var(--color-text-secondary)",
          }}>
            <div style={{
              width: 28, height: 28,
              border: "3px solid var(--color-border-divider)",
              borderTopColor: "var(--color-brand-primary)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              시험지 문항별 학원 자료를 검색하고 있습니다
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", maxWidth: 360, textAlign: "center", lineHeight: 1.5 }}>
              문항 수에 따라 10~30초 소요 (자동 매칭 후보 최대 15건/문항).
              검색 결과는 보고서 작성 후 자동 저장됩니다.
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : loadError ? (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
            color: "var(--color-text-secondary)", padding: 24,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-status-error, #dc2626)" }}>
              {loadError}
            </div>
            <Button size="sm" intent="primary" onClick={() => void load()}>
              다시 시도
            </Button>
          </div>
        ) : examProblems.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>
            시험지에 등록된 문항이 없습니다.
          </div>
        ) : (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "180px 1fr 360px", overflow: "hidden", minHeight: 0 }}>
            {/* 좌: 문항 사이드 — 번호+썸네일 리스트 */}
            <div style={{
              borderRight: "1px solid var(--color-border-divider)",
              overflow: "auto",
              background: "var(--color-bg-surface-soft)",
            }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--color-border-divider)" }}>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontWeight: 600 }}>
                  문항 ({examProblems.length})
                </div>
                {/* 진행률 bar — excluded 토글된 Q는 분모/분자 모두에서 제외 (PDF SSOT 동기). */}
                {examProblems.length > 0 && (() => {
                  const activeProblems = examProblems.filter(ep => !entries[ep.id]?.excluded);
                  const excludedCount = examProblems.length - activeProblems.length;
                  const denom = activeProblems.length || 1;  // 0 나눗셈 방지
                  const curatedCount = activeProblems.filter(ep =>
                    (entries[ep.id]?.selectedProblemIds?.length ?? 0) > 0
                  ).length;
                  const progress = activeProblems.length === 0 ? 0 : (curatedCount / denom) * 100;
                  const progressColor =
                    progress >= 80 ? "var(--color-status-success)" :
                    progress >= 40 ? "var(--color-brand-primary)" :
                    "var(--color-text-muted)";
                  return (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 10, color: progressColor, fontWeight: 700, marginBottom: 3 }}>
                        {curatedCount} / {activeProblems.length} 큐레이션 ({progress.toFixed(0)}%)
                        {excludedCount > 0 && (
                          <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>
                            {"  ·  PDF 제외 "}{excludedCount}
                          </span>
                        )}
                      </div>
                      <div style={{
                        width: "100%", height: 4, borderRadius: 2,
                        background: "var(--color-bg-canvas)", overflow: "hidden",
                      }}>
                        <div style={{
                          width: `${progress}%`, height: "100%",
                          background: progressColor, transition: "width 0.2s",
                        }} />
                      </div>
                    </div>
                  );
                })()}
              </div>
              {examProblems.map((ep, i) => {
                const ent = entries[ep.id];
                const ids = ent?.selectedProblemIds ?? [];
                // dangling = candidateMap 에 없는 pid (원본 자료 삭제됨 / hit-report
                // 생성 시점엔 있었으나 그 후 retry/replace 로 사라진 problem). 카운트는
                // 살아있는 것만 세서 사용자가 정확한 자료 수 인지하도록.
                const danglingCount = ids.filter((pid) => !candidateMap.has(pid)).length;
                const cnt = ids.length - danglingCount;
                const hasComment = !!(ent?.comment.trim());
                const isActive = i === activeIndex;
                const isExcluded = !!ent?.excluded;
                return (
                  <div
                    key={ep.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    onClick={() => setActiveIndex(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveIndex(i);
                      }
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "8px 12px",
                      background: isActive ? "var(--color-bg-active)" : "transparent",
                      borderLeft: isActive
                        ? "3px solid var(--color-brand-primary)"
                        : "3px solid transparent",
                      cursor: "pointer", textAlign: "left",
                      color: "var(--color-text-primary)",
                      opacity: isExcluded ? 0.5 : 1,
                    }}
                  >
                    <span style={{
                      minWidth: 28, fontSize: 12, fontWeight: 700,
                      color: isActive ? "var(--color-brand-primary)" : "var(--color-text-secondary)",
                      textDecoration: isExcluded ? "line-through" : "none",
                    }}>
                      Q{ep.number}
                    </span>
                    {isExcluded ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)" }}>
                        PDF 제외
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: cnt > 0 ? "var(--color-status-success)" : "var(--color-text-muted)" }}>
                        {cnt > 0 ? `자료 ${cnt}` : "선택 없음"}
                      </span>
                    )}
                    {danglingCount > 0 && !isExcluded && (
                      <span
                        title={`원본이 삭제된 자료 ${danglingCount}개 — 우측 후보 목록에서 정정해 주세요`}
                        style={{
                          fontSize: 10, fontWeight: 700,
                          padding: "1px 5px", borderRadius: 999,
                          background: "color-mix(in srgb, var(--color-status-error, #dc2626) 12%, transparent)",
                          color: "var(--color-status-error, #dc2626)",
                          border: "1px solid color-mix(in srgb, var(--color-status-error, #dc2626) 30%, transparent)",
                        }}
                      >
                        ⚠ {danglingCount}
                      </span>
                    )}
                    {hasComment && !isExcluded && (
                      <Check size={ICON.xs} color="var(--color-status-success)" />
                    )}
                    {ent?.dirty && (
                      <span style={{ marginLeft: 4, width: 6, height: 6, borderRadius: "50%", background: "var(--color-status-warning)", flexShrink: 0 }} />
                    )}
                    {/* PDF 제외 토글 — 자료 매칭 못한 Q를 결과물에서 빼는 강사 의사 */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleExcluded(ep.id); }}
                      disabled={isSubmitted}
                      aria-label={isExcluded ? "PDF에 다시 포함" : "PDF에서 제외"}
                      title={isExcluded ? "PDF에 다시 포함" : "이 Q는 매칭 못함 — PDF에서 제외"}
                      style={{
                        marginLeft: "auto", padding: 3,
                        border: "none", background: "transparent",
                        color: isExcluded ? "var(--color-status-error, #dc2626)" : "var(--color-text-muted)",
                        cursor: isSubmitted ? "default" : "pointer",
                        display: "inline-flex", alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isExcluded ? <Eye size={ICON.sm} /> : <EyeOff size={ICON.sm} />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 중: 2-pane 미리보기 (PDF 양식과 동일) + 코멘트 */}
            <PreviewPane
              active={active}
              activeIndex={activeIndex}
              examProblemsCount={examProblems.length}
              documentTitle={documentTitle}
              activeCandidateId={activeCandidateId}
              candidateMap={candidateMap}
              comment={activeEntry?.comment ?? ""}
              onComment={setComment}
              disabled={isSubmitted}
              onPrev={() => setActiveIndex((i) => Math.max(0, i - 1))}
              onNext={() => setActiveIndex((i) => Math.min(examProblems.length - 1, i + 1))}
            />

            {/* 우: 강사 본인 수업자료 후보 리스트 — 행 클릭 = 미리보기 active / "+PDF에 추가" 버튼 = 선택 토글 */}
            <SelectionPanel
              active={active}
              activeCandidateId={activeCandidateId}
              selectedIds={activeEntry?.selectedProblemIds ?? []}
              candidateMap={candidateMap}
              onToggle={toggleSelect}
              onSetActive={setActiveCandidateId}
              onEditSource={(docId, docTitle) => setEditSourceDoc({ id: docId, title: docTitle })}
              disabled={isSubmitted}
            />
          </div>
        )}

        {/* 하단 요약 입력 */}
        <div style={{
          padding: "10px 18px", borderTop: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)", flexShrink: 0,
          display: "flex", gap: 12, alignItems: "stretch",
        }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 600 }}>
              보고서 요약 (선택) — PDF 표지에 노출
            </label>
            <textarea
              value={reportSummary}
              onChange={(e) => { setReportSummary(e.target.value); setHeaderDirty(true); }}
              disabled={isSubmitted}
              placeholder="예: 1학기 중간고사 대비 반영률 종합 분석"
              rows={2}
              style={{
                fontSize: 12, padding: 6,
                border: "1px solid var(--color-border-divider)",
                borderRadius: 4, resize: "vertical",
                background: "var(--color-bg-canvas)",
                color: "var(--color-text-primary)", outline: "none",
              }}
            />
          </div>
        </div>
      </div>
    </div>
    {editSourceDoc && (
      <ManualCropModal
        document={editSourceDoc}
        onClose={() => {
          setEditSourceDoc(null);
          // load()가 entries를 응답으로 덮어쓰므로 dirty 코멘트가 유실될 위험 →
          // 닫을 때 미저장분 먼저 동기화, 그 다음에 후보 새로고침.
          (async () => {
            if (dirtyCount > 0) await saveAll(true);
            await load();
          })();
        }}
      />
    )}
    </>
  );
}

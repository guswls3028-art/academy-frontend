/**
 * PATH: src/app_admin/domains/results/components/omr-review/OmrReviewWorkspace.tsx
 *
 * OMR 검토 워크스페이스 — 3패널 전체화면 오버레이.
 *
 * 설계:
 * - 좌: 학생/답안지 리스트 (상태 필터 + 검색)
 * - 중: 원본 스캔 이미지 (줌/핏)
 * - 우: 답안 수정 폼 (문항별 현재값 + 수정 입력)
 *
 * API:
 * - 목록: listOmrReviewRows(examId)
 * - 상세: fetchOmrReviewDetail(submissionId)
 * - 저장: manualEditSubmissionApi
 *
 * 상태 카테고리:
 * - all: 전체
 * - ok:  정상 (manual_review 불필요 + enrollment 매칭됨)
 * - noid: 식별 실패 (needs_identification / no_match / missing)
 * - flag: 중복·빈칸·저신뢰도 (manual_review.required=true)
 * - failed: 처리 실패 (FAILED)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchOmrReviewDetail,
  listOmrReviewRows,
  type OmrReviewDetail,
  type OmrReviewDetailAnswer,
  type OmrReviewRow,
} from "./omrReviewApi";
import {
  discardSubmissionApi,
  manualEditSubmissionApi,
} from "@admin/domains/materials/sheets/components/submissions/submissions.api";
import StudentPickerModal from "./StudentPickerModal";
import BBoxOverlay from "./BBoxOverlay";
import type { CandidateRow } from "./omrReviewApi";
import "./OmrReviewWorkspace.css";

type FilterKey = "all" | "ok" | "noid" | "flag" | "failed";

const CHOICES = ["1", "2", "3", "4", "5"];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || "");
const SAVE_KBD_LABEL = isMac ? "⌘S" : "Ctrl+S";

function categorize(row: OmrReviewRow): FilterKey {
  const st = String(row.status || "").toLowerCase();
  if (st === "failed") return "failed";
  const idStatus = String(row.identifier_status || "").toLowerCase();
  if (st === "needs_identification" || idStatus === "no_match" || idStatus === "missing") {
    return "noid";
  }
  if (row.manual_review_required) return "flag";
  return "ok";
}

function toneForCategory(c: FilterKey): "success" | "danger" | "warning" | "primary" | "neutral" {
  switch (c) {
    case "ok":
      return "success";
    case "noid":
      return "warning";
    case "flag":
      return "primary";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

function labelForCategory(c: FilterKey): string {
  switch (c) {
    case "ok":
      return "정상";
    case "noid":
      return "식별실패";
    case "flag":
      return "검토필요";
    case "failed":
      return "실패";
    default:
      return "전체";
  }
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function shallowEqualAnswers(a: Record<number, string>, b: Record<number, string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[Number(k)] !== b[Number(k)]) return false;
  }
  return true;
}

type Props = {
  examId: number;
  examTitle: string;
  open: boolean;
  onClose: () => void;
};

export default function OmrReviewWorkspace({ examId, examTitle, open, onClose }: Props) {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState(true); // true = 컨테이너 맞춤, false = 100%*zoom
  const [editDirty, setEditDirty] = useState(false);
  const [focusedQid, setFocusedQid] = useState<number | null>(null);

  // 변경 사항 있을 때 닫기 가드 (백드롭/X 버튼/ESC 공통 경로).
  const handleClose = useCallback(() => {
    if (editDirty) {
      const ok = window.confirm(
        "저장하지 않은 변경 사항이 있습니다.\n정말 닫으시겠습니까?"
      );
      if (!ok) return;
    }
    onClose();
  }, [editDirty, onClose]);

  // 리스트
  const { data: rows = [], isLoading: listLoading } = useQuery({
    queryKey: ["omr-review-list", examId],
    queryFn: () => listOmrReviewRows(examId),
    enabled: open && Number.isFinite(examId),
    refetchInterval: open ? 8000 : false,
  });

  // 상세
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["omr-review-detail", selectedId],
    queryFn: () => fetchOmrReviewDetail(selectedId!),
    enabled: open && selectedId != null,
  });

  // 카테고리별 카운트
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: 0, ok: 0, noid: 0, flag: 0, failed: 0 };
    for (const r of rows) {
      c.all++;
      c[categorize(r)]++;
    }
    return c;
  }, [rows]);

  // 필터·검색된 리스트
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && categorize(r) !== filter) return false;
      if (!q) return true;
      return (
        (r.student_name || "").toLowerCase().includes(q) ||
        String(r.id).includes(q) ||
        (r.file_key || "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  // 자동 선택: 첫 아이템 또는 현재 선택이 filter 밖으로 나가면 재지정.
  // selectedId를 dep에서 제거하고 functional setter로 비교 → setState 무한 루프 방지.
  useEffect(() => {
    if (!open) return;
    setSelectedId((prev) => {
      if (visibleRows.length === 0) return prev === null ? prev : null;
      if (prev != null && visibleRows.some((r) => r.id === prev)) return prev;
      return visibleRows[0].id;
    });
  }, [open, visibleRows]);

  // open이 false로 닫히면 selection 초기화
  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setSearch("");
      setFilter("all");
      setEditDirty(false);
      setFocusedQid(null);
    }
  }, [open]);

  // 선택 submission 변경 시 focused 문항 리셋 (EditPane이 key로 리마운트되므로 state 싱크)
  useEffect(() => {
    setFocusedQid(null);
  }, [selectedId]);

  // ESC 키로 닫기 (dirty 가드 적용)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // StudentPickerModal이 열려있으면 그쪽이 먼저 가로챔 — 본 리스너는 최상단에서만 작동
        // 실제로는 PickerModal도 Esc로 닫히므로 여기까지 오지 않음
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  // 브라우저 탭 닫기·새로고침·뒤로가기 — dirty 시 기본 confirm 프롬프트 유도
  useEffect(() => {
    if (!open || !editDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 크롬/파폭은 returnValue 설정만으로 기본 문구 노출
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [open, editDirty]);

  // 학생 이동 (1=다음, -1=이전)
  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (visibleRows.length === 0) return;
      setSelectedId((prev) => {
        const idx = visibleRows.findIndex((r) => r.id === prev);
        const next = idx < 0 ? 0 : Math.max(0, Math.min(visibleRows.length - 1, idx + dir));
        return visibleRows[next].id;
      });
    },
    [visibleRows],
  );

  // 진행도: ok/noid/flag/failed 중 처리 완료 (ok+done) vs 전체
  const progress = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((r) => categorize(r) === "ok").length;
    return { done, total };
  }, [rows]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="orw-backdrop" onClick={handleClose} aria-hidden />
      <div className="orw-wrap" role="dialog" aria-modal="true" aria-label="OMR 검토">
        <header className="orw-header">
          <div className="orw-header__left">
            <span className="orw-header__title">OMR 검토</span>
            <span className="orw-header__exam">{examTitle}</span>
            <span className="orw-header__progress">
              처리 완료 <b>{progress.done}</b> / {progress.total}
            </span>
          </div>
          <div className="orw-header__actions">
            <span className="orw-header__sub">
              학생 <span className="orw-kbd">J</span>/<span className="orw-kbd">K</span>
              {" · "}검토 문항 <span className="orw-kbd">N</span>/<span className="orw-kbd">P</span>
              {" · "}답 <span className="orw-kbd">1-5</span>
              {" · "}저장 <span className="orw-kbd">{SAVE_KBD_LABEL}</span>
            </span>
            <button className="orw-header__close" onClick={handleClose} aria-label="닫기">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        <div className="orw-toolbar">
          <input
            className="orw-search"
            type="text"
            placeholder="학생명·파일명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(["all", "noid", "flag", "ok", "failed"] as FilterKey[]).map((k) => {
            const isZero = counts[k] === 0;
            return (
              <button
                key={k}
                type="button"
                className={`orw-filter-chip ${filter === k ? "orw-filter-chip--active" : ""} ${
                  isZero && filter !== k ? "orw-filter-chip--zero" : ""
                }`}
                onClick={() => setFilter(k)}
                aria-pressed={filter === k}
              >
                {labelForCategory(k)}
                <span className="orw-filter-chip__count">{counts[k]}</span>
              </button>
            );
          })}
        </div>

        <div className="orw-body">
          {/* ── LEFT ── */}
          <div className="orw-list-pane">
            {listLoading ? (
              <div className="orw-loading">불러오는 중…</div>
            ) : visibleRows.length === 0 ? (
              <div className="orw-list-empty">조건에 맞는 제출이 없습니다.</div>
            ) : (
              visibleRows.map((r) => {
                const cat = categorize(r);
                const tone = toneForCategory(cat);
                const label = labelForCategory(cat);
                return (
                  <div
                    key={r.id}
                    className={`orw-list-row ${selectedId === r.id ? "orw-list-row--active" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="orw-list-row__name">
                      {r.student_name || <span className="orw-list-row__noname">미식별 학생</span>}
                    </div>
                    <div className="orw-list-row__score">
                      {r.score != null ? `${r.score}점` : (cat === "noid" ? "식별 후 채점" : "—")}
                    </div>
                    <div className="orw-list-row__sub">
                      <span className="orw-ds-badge" data-tone={tone}>{label}</span>
                      <span className="orw-list-row__time">{formatTime(r.created_at)}</span>
                      {r.manual_review_reasons && r.manual_review_reasons.length > 0 && (
                        <span className="orw-list-row__reasons">
                          {r.manual_review_reasons.slice(0, 2).map(reasonLabel).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── CENTER: 스캔 이미지 ── */}
          <ScanPane
            detail={detail}
            detailLoading={detailLoading}
            zoom={zoom}
            setZoom={setZoom}
            fitMode={fitMode}
            setFitMode={setFitMode}
            studentName={visibleRows.find((r) => r.id === selectedId)?.student_name ?? null}
            createdAt={visibleRows.find((r) => r.id === selectedId)?.created_at ?? null}
            focusedQid={focusedQid}
            onPickQuestion={setFocusedQid}
            onImageLoadError={() => {
              // presigned URL 만료 등으로 이미지 실패 시 상세 재조회 → 새 URL 받기
              if (selectedId != null) {
                qc.invalidateQueries({ queryKey: ["omr-review-detail", selectedId] });
              }
            }}
          />

          {/* ── RIGHT: 답안 편집 ── */}
          <EditPane
            key={selectedId ?? "empty"}
            examId={examId}
            detail={detail}
            detailLoading={detailLoading}
            studentName={visibleRows.find((r) => r.id === selectedId)?.student_name ?? null}
            focusedQid={focusedQid}
            onFocusedQidChange={setFocusedQid}
            onDirtyChange={setEditDirty}
            onSaved={() => {
              setEditDirty(false);
              qc.invalidateQueries({ queryKey: ["omr-review-list", examId] });
              qc.invalidateQueries({ queryKey: ["omr-review-detail", selectedId] });
              qc.invalidateQueries({ queryKey: ["admin-exam-results", examId] });
              qc.invalidateQueries({ queryKey: ["admin-exam-detail", examId] });
              feedback.success("저장되었습니다. 다음 검토 대상으로 이동합니다.");
              // 자동 다음 학생 이동 (운영자 가속)
              window.setTimeout(() => navigate(1), 250);
            }}
            onNavigate={navigate}
          />
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ──────────────────────────────────────────────
 * 중앙 스캔 패널
 * ────────────────────────────────────────────── */
function ScanPane({
  detail,
  detailLoading,
  zoom,
  setZoom,
  fitMode,
  setFitMode,
  studentName,
  createdAt,
  focusedQid,
  onPickQuestion,
  onImageLoadError,
}: {
  detail: OmrReviewDetail | undefined;
  detailLoading: boolean;
  zoom: number;
  setZoom: (fn: (z: number) => number) => void;
  fitMode: boolean;
  setFitMode: (b: boolean) => void;
  studentName: string | null;
  createdAt: string | null;
  focusedQid: number | null;
  onPickQuestion: (qid: number) => void;
  onImageLoadError?: () => void;
}) {
  const [imgLoading, setImgLoading] = useState(false);
  const [imgErrored, setImgErrored] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  // submission 바뀌면 에러 플래그 리셋
  useEffect(() => {
    setImgErrored(false);
  }, [detail?.scan_image_url]);
  const imageSize = detail?.scan_image_size ?? naturalSize;
  const hasBBoxData =
    !!detail?.answers?.some(
      (a) => !!(a.omr?.rect || (a.omr?.bubble_rects && a.omr.bubble_rects.length > 0)),
    );
  return (
    <div className="orw-scan-pane">
      <div className="orw-scan-pane__toolbar">
        <span className="orw-scan-pane__label">
          {detail?.scan_image_url
            ? `${studentName || "미식별 학생"}${createdAt ? ` · ${formatTime(createdAt)}` : ""}`
            : "스캔 이미지"}
        </span>
        <div className="orw-scan-pane__controls">
          <button
            type="button"
            className="orw-scan-pane__zoom-btn"
            onClick={() => { setFitMode(false); setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2))); }}
            aria-label="축소"
          >−</button>
          <span className="orw-scan-pane__zoom-readout">
            {fitMode ? "맞춤" : `${Math.round(zoom * 100)}%`}
          </span>
          <button
            type="button"
            className="orw-scan-pane__zoom-btn"
            onClick={() => { setFitMode(false); setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2))); }}
            aria-label="확대"
          >+</button>
          <button
            type="button"
            className={`orw-scan-pane__zoom-btn ${fitMode ? "orw-scan-pane__zoom-btn--active" : ""}`}
            onClick={() => { setFitMode(true); setZoom(() => 1); }}
          >맞춤</button>
          {detail?.scan_image_url && (
            <a
              href={detail.scan_image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="orw-scan-pane__zoom-btn"
            >
              새 창
            </a>
          )}
        </div>
      </div>
      <div className={`orw-scan-pane__body ${fitMode ? "orw-scan-pane__body--fit" : ""}`}>
        {detailLoading ? (
          <div className="orw-loading">불러오는 중…</div>
        ) : !detail ? (
          <div className="orw-scan-pane__empty">
            학생을 선택하면 스캔 이미지가 여기에 표시됩니다.
          </div>
        ) : !detail.scan_image_url ? (
          <div className="orw-scan-pane__empty">
            스캔 이미지가 없습니다.
            <br />
            <span className="orw-scan-pane__empty-sub">(온라인 제출 또는 파일이 만료됨)</span>
          </div>
        ) : (
          <>
            {imgLoading && (
              <div className="orw-scan-pane__overlay-loading">스캔 이미지 불러오는 중…</div>
            )}
            <div
              className={`orw-scan-pane__img-wrap ${fitMode ? "orw-scan-pane__img-wrap--fit" : ""}`}
              style={fitMode ? undefined : { width: `${Math.round(100 * zoom)}%` }}
            >
              <img
                key={detail.scan_image_url}
                className={`orw-scan-pane__img ${fitMode ? "orw-scan-pane__img--fit" : ""}`}
                src={detail.scan_image_url}
                alt="OMR 스캔 원본"
                onLoadStart={() => setImgLoading(true)}
                onLoad={(e) => {
                  setImgLoading(false);
                  const el = e.currentTarget;
                  if (el.naturalWidth && el.naturalHeight) {
                    setNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
                  }
                }}
                onError={() => {
                  setImgLoading(false);
                  // 한 번만 자동 재조회 (presigned URL 만료 대응). 무한 루프 방지 위해 imgErrored 플래그.
                  if (!imgErrored) {
                    setImgErrored(true);
                    onImageLoadError?.();
                  }
                }}
              />
              {hasBBoxData && imageSize && (
                <BBoxOverlay
                  answers={detail.answers}
                  focusedQid={focusedQid}
                  imageSize={imageSize}
                  onPickQuestion={onPickQuestion}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
 * 우측 편집 패널
 * ────────────────────────────────────────────── */
function EditPane({
  examId,
  detail,
  detailLoading,
  studentName,
  focusedQid,
  onFocusedQidChange,
  onSaved,
  onNavigate,
  onDirtyChange,
}: {
  examId: number;
  detail: OmrReviewDetail | undefined;
  detailLoading: boolean;
  studentName: string | null;
  focusedQid: number | null;
  onFocusedQidChange: (qid: number | null) => void;
  onSaved: () => void;
  onNavigate: (dir: 1 | -1) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  // 초기 답안 (저장된 원본) — dirty 비교용
  const initialAnswers = useMemo(() => {
    const init: Record<number, string> = {};
    if (!detail) return init;
    for (const a of detail.answers) init[a.question_id] = a.answer ?? "";
    return init;
  }, [detail?.submission_id, detail?.answers]); // eslint-disable-line react-hooks/exhaustive-deps

  const [answers, setAnswers] = useState<Record<number, string>>(initialAnswers);
  const [pickedStudent, setPickedStudent] = useState<CandidateRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const setFocusedQid = onFocusedQidChange;

  // detail 바뀔 때 폼 리셋. dep을 submission_id (primitive)만으로 → 매 렌더 트리거 제거.
  useEffect(() => {
    setAnswers(initialAnswers);
    setPickedStudent(null);
    setPickerOpen(false);
  }, [detail?.submission_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const identifierNeeded = useMemo(() => {
    if (!detail) return false;
    const st = String(detail.submission_status || "").toLowerCase();
    const ids = String(detail.meta?.identifier_status || "").toLowerCase();
    return (
      st === "needs_identification" ||
      ids === "no_match" ||
      ids === "missing" ||
      !detail.enrollment_id
    );
  }, [detail]);

  const dirty = useMemo(() => {
    if (!detail) return false;
    if (identifierNeeded && pickedStudent) return true;
    return !shallowEqualAnswers(answers, initialAnswers);
  }, [detail, answers, initialAnswers, pickedStudent, identifierNeeded]);

  // 상위 워크스페이스에 dirty 상태 전파 (백드롭·ESC·X 버튼 close 가드에 사용)
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const mut = useMutation({
    mutationFn: async (opts: { allowDuplicate?: boolean } = {}) => {
      if (!detail) throw new Error("no detail");
      const payloadAnswers = Object.entries(answers).map(([qid, ans]) => ({
        exam_question_id: Number(qid),
        answer: String(ans ?? ""),
      }));
      const idPayload =
        identifierNeeded && pickedStudent
          ? { enrollment_id: pickedStudent.enrollment_id }
          : null;
      return await manualEditSubmissionApi({
        submissionId: detail.submission_id,
        identifier: idPayload,
        note: "omr_review_ui",
        answers: payloadAnswers,
        allowDuplicate: opts.allowDuplicate,
      });
    },
    onSuccess: () => onSaved(),
    onError: (e: unknown) => {
      const err = e as {
        response?: { status?: number; data?: { detail?: string; code?: string; conflict_submission_id?: number } };
        message?: string;
      };
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      // 409 DUPLICATE_ENROLLMENT — 운영자에게 덮어쓰기 확인 후 재시도
      if (status === 409 && code === "DUPLICATE_ENROLLMENT") {
        const conflictId = err?.response?.data?.conflict_submission_id;
        const ok = window.confirm(
          `이 학생은 이미 다른 답안지(#${conflictId ?? "?"})에 매칭돼 있습니다.\n\n` +
            "이 답안지로 덮어쓰기 하시겠어요?\n(기존 답안지는 그대로 남지만 대표 답안지는 변경됩니다.)",
        );
        if (ok) {
          mut.mutate({ allowDuplicate: true });
        }
        return;
      }
      feedback.error(err?.response?.data?.detail || err?.message || "저장 실패");
    },
  });

  // 답안지 폐기 (스캔 품질 불량·중복 업로드 등)
  const discardMut = useMutation({
    mutationFn: async () => {
      if (!detail) throw new Error("no detail");
      return await discardSubmissionApi(detail.submission_id, "operator_discarded");
    },
    onSuccess: () => {
      feedback.success("답안지를 폐기했습니다.");
      onSaved();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      feedback.error(err?.response?.data?.detail || err?.message || "폐기 실패");
    },
  });

  // mutate / navigate를 ref로 안정화 → 키보드 effect dep 최소화
  const submitRef = useRef<() => void>(() => {});
  submitRef.current = () => {
    if (!mut.isPending && dirty) mut.mutate({});
  };
  const navigateRef = useRef<(d: 1 | -1) => void>(() => {});
  navigateRef.current = (d) => onNavigate(d);

  // 첫 flagged 문항 focus (마운트 1회)
  useEffect(() => {
    if (!detail) return;
    const firstFlagged = detail.answers.find(isFlagged);
    if (firstFlagged) setFocusedQid(firstFlagged.question_id);
  }, [detail?.submission_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 문항 포커스 이동 헬퍼 (n: 다음, p: 이전). flaggedOnly=true면 flagged만 순회.
  const focusRelative = (dir: 1 | -1, flaggedOnly: boolean) => {
    if (!detail) return;
    const rows = detail.answers;
    if (rows.length === 0) return;
    const pool = flaggedOnly ? rows.filter(isFlagged) : rows;
    if (pool.length === 0) return;
    const curIdx = pool.findIndex((a) => a.question_id === focusedQid);
    const nextIdx =
      curIdx < 0
        ? (dir > 0 ? 0 : pool.length - 1)
        : Math.max(0, Math.min(pool.length - 1, curIdx + dir));
    setFocusedQid(pool[nextIdx].question_id);
  };

  // 키보드: J/K, ⌘S, 1~5, n/p (다음/이전 flagged), Enter (다음 문항)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        submitRef.current?.();
        return;
      }

      // input 안에서 Enter: 서술형 필드 종료 → 다음 문항 이동
      if (isEditable && e.key === "Enter") {
        e.preventDefault();
        (target as HTMLElement).blur?.();
        focusRelative(1, false);
        return;
      }
      if (isEditable) return;

      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        navigateRef.current?.(1);
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        navigateRef.current?.(-1);
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        focusRelative(1, true); // 다음 flagged
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        focusRelative(-1, true); // 이전 flagged
      } else if (e.key === "Enter") {
        e.preventDefault();
        focusRelative(1, false);
      } else if (focusedQid != null && /^[1-5]$/.test(e.key)) {
        // 1~5 빠른 답안: 현재 포커스된 선택형 문항에 즉시 입력 + 다음 flagged 자동 이동
        const q = detail?.answers.find((a) => a.question_id === focusedQid);
        if (!q) return;
        const isChoice = isChoiceAnswer(q, answers[focusedQid]);
        if (!isChoice) return;
        e.preventDefault();
        setAnswers((prev) => ({ ...prev, [focusedQid]: e.key }));
        // 바로 다음 flagged 문항 — 없으면 다음 문항
        window.setTimeout(() => focusRelative(1, true), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // detail/focusedQid는 ref 없이 closure에서 사용 — 변경 시 리바인딩
  }, [detail, answers, focusedQid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (detailLoading) {
    return (
      <div className="orw-edit-pane">
        <div className="orw-loading">불러오는 중…</div>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="orw-edit-pane">
        <div className="orw-loading">학생을 선택하면 답안 수정 폼이 여기에 표시됩니다.</div>
      </div>
    );
  }

  const reasons = detail.meta?.manual_review?.reasons ?? [];
  const headerName = studentName || (identifierNeeded ? "미식별 학생" : "학생");

  return (
    <div className="orw-edit-pane">
      <div className="orw-edit-pane__header">
        <div className="orw-edit-pane__title">{headerName} · 답안 수정</div>
        <div className="orw-edit-pane__summary">
          {detail.submission_status && (
            <span className="orw-edit-pane__status">상태 <b>{statusLabel(detail.submission_status)}</b></span>
          )}
          {reasons.length > 0 && (
            <span className="orw-edit-pane__warn">
              {reasons.map(reasonLabel).join(", ")}
            </span>
          )}
        </div>
      </div>

      <div className="orw-edit-pane__body">
        {identifierNeeded && (
          <div className="orw-identifier">
            <div className="orw-identifier__title">학생 식별 필요</div>
            <div className="orw-identifier__desc">
              자동 식별에 실패했습니다. 스캔 이미지의 이름·전화번호를 확인해
              <b> 학생을 검색·선택</b>하면 저장 시 매칭·채점이 자동 진행됩니다.
            </div>
            {pickedStudent ? (
              <div className="orw-identifier__picked">
                <div className="orw-identifier__picked-main">
                  <span className="orw-identifier__picked-name">{pickedStudent.student_name}</span>
                  {pickedStudent.lecture_title && (
                    <span className="orw-identifier__picked-lecture">
                      {pickedStudent.lecture_title}
                    </span>
                  )}
                  {pickedStudent.already_matched && (
                    <span className="orw-identifier__picked-warn" title="다른 답안지에 이미 매칭된 학생입니다.">
                      중복 경고
                    </span>
                  )}
                </div>
                <div className="orw-identifier__picked-actions">
                  <button
                    type="button"
                    className="orw-identifier__change-btn"
                    onClick={() => setPickerOpen(true)}
                  >
                    변경
                  </button>
                  <button
                    type="button"
                    className="orw-identifier__clear-btn"
                    onClick={() => setPickedStudent(null)}
                    aria-label="선택 해제"
                  >
                    해제
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="orw-identifier__pick-btn"
                onClick={() => setPickerOpen(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                학생 검색·연결
              </button>
            )}
          </div>
        )}

        {identifierNeeded && (
          <StudentPickerModal
            examId={examId}
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onPick={(c) => {
              setPickedStudent(c);
              setPickerOpen(false);
            }}
          />
        )}

        <div>
          {detail.answers.length === 0 ? (
            <div className="orw-loading">문항이 없습니다.</div>
          ) : (
            detail.answers.map((a, idx) => (
              <AnswerRow
                key={a.question_id}
                answer={a}
                label={questionLabel(a.question_no, a.question_id, idx)}
                current={answers[a.question_id] ?? ""}
                focused={focusedQid === a.question_id}
                onFocusRow={() => setFocusedQid(a.question_id)}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [a.question_id]: v }))}
              />
            ))
          )}
        </div>
      </div>

      <div className="orw-edit-pane__footer">
        <button
          className="orw-save-btn"
          type="button"
          onClick={() => mut.mutate({})}
          disabled={mut.isPending || !dirty || discardMut.isPending}
        >
          {mut.isPending
            ? "저장 중…"
            : dirty
              ? "저장 + 재채점"
              : "변경 사항 없음"}
        </button>
        <button
          className="orw-discard-btn"
          type="button"
          onClick={() => {
            if (!detail) return;
            const ok = window.confirm(
              "이 답안지를 폐기하시겠습니까?\n\n" +
                "• 스캔 품질 불량·중복 업로드·채점 대상 아님 등의 이유로 제외할 때 사용합니다.\n" +
                "• 상태는 \"실패\"로 전환되며 성적에 반영되지 않습니다.",
            );
            if (ok) discardMut.mutate();
          }}
          disabled={discardMut.isPending || mut.isPending}
          title="스캔 불량·중복 등으로 채점 제외"
        >
          {discardMut.isPending ? "처리 중…" : "답안지 폐기"}
        </button>
      </div>
    </div>
  );
}

function statusLabel(s: string | undefined | null): string {
  const v = String(s || "").toLowerCase();
  if (v === "done") return "완료";
  if (v === "needs_identification") return "식별 대기";
  if (v === "answers_ready") return "채점 대기";
  if (v === "failed") return "실패";
  return s || "—";
}

const REASON_LABEL: Record<string, string> = {
  answer_blank_or_multi: "빈칸·중복마킹",
  answer_low_confidence: "낮은 신뢰도",
  answer_status_not_ok: "인식 불완전",
  identifier_no_match: "학생 매칭 실패",
  identifier_missing: "식별자 미인식",
  identifier_invalid: "식별자 형식 오류",
};

function reasonLabel(r: string): string {
  const k = String(r || "").toLowerCase();
  return REASON_LABEL[k] || r;
}

function questionLabel(no: number | null | undefined, id: number, idx: number): string {
  if (typeof no === "number" && no > 0 && no < 1000) return `${no}번`;
  // 백엔드가 question_no를 안 주거나 question_id를 그대로 준 경우 → 순서 기반
  return `${idx + 1}번`;
}

function isChoiceAnswer(a: OmrReviewDetailAnswer, current: string): boolean {
  return (
    /^[1-5]$/.test((current || "").trim()) ||
    CHOICES.includes((a.answer || "").trim()) ||
    a.omr?.marking != null
  );
}

function isFlagged(a: OmrReviewDetailAnswer): boolean {
  const marking = String(a.omr?.marking || "").toLowerCase();
  if (marking === "blank" || marking === "multi") return true;
  const conf = a.omr?.confidence;
  if (typeof conf === "number" && conf < 0.5) return true;
  const st = String(a.omr?.status || "").toLowerCase();
  if (st && st !== "ok") return true;
  return false;
}

function AnswerRow({
  answer,
  label,
  current,
  focused,
  onChange,
  onFocusRow,
}: {
  answer: OmrReviewDetailAnswer;
  label: string;
  current: string;
  focused: boolean;
  onChange: (v: string) => void;
  onFocusRow: () => void;
}) {
  const isChoice = isChoiceAnswer(answer, current);
  const flagged = isFlagged(answer);
  const marking = String(answer.omr?.marking || "").toLowerCase();
  const conf = answer.omr?.confidence;
  const rowRef = useRef<HTMLDivElement | null>(null);

  // focused 상태로 전환 시 뷰포트 안으로 스크롤
  useEffect(() => {
    if (!focused) return;
    rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused]);

  return (
    <div
      ref={rowRef}
      className={`orw-q-row ${flagged ? "orw-q-row--flag" : ""} ${focused ? "orw-q-row--focused" : ""}`}
      onClick={onFocusRow}
    >
      <div className="orw-q-row__head">
        <span className="orw-q-row__num">{label}</span>
        <div className="orw-q-row__chips">
          {marking === "blank" && <span className="orw-chip orw-chip--blank">빈칸</span>}
          {marking === "multi" && <span className="orw-chip orw-chip--multi">중복마킹</span>}
          {typeof conf === "number" && conf < 0.5 && (
            <span className="orw-chip orw-chip--low">신뢰도 {Math.round(conf * 100)}%</span>
          )}
          {typeof conf === "number" && conf >= 0.5 && marking !== "blank" && marking !== "multi" && (
            <span className="orw-chip orw-chip--ok">{Math.round(conf * 100)}%</span>
          )}
        </div>
      </div>

      {isChoice ? (
        <div className="orw-q-row__bubbles">
          {CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              className={`orw-bubble ${current === c ? "orw-bubble--selected" : ""}`}
              onClick={(e) => { e.stopPropagation(); onFocusRow(); onChange(current === c ? "" : c); }}
            >
              {c}
            </button>
          ))}
          {current === "" && (
            <span className="orw-bubble-empty-hint">미선택</span>
          )}
        </div>
      ) : (
        <input
          className="orw-essay-input"
          type="text"
          value={current}
          onFocus={onFocusRow}
          onChange={(e) => onChange(e.target.value)}
          placeholder="답안 입력"
        />
      )}
    </div>
  );
}

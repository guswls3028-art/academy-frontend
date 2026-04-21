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
import { manualEditSubmissionApi } from "@admin/domains/materials/sheets/components/submissions/submissions.api";
import "./OmrReviewWorkspace.css";

type FilterKey = "all" | "ok" | "noid" | "flag" | "failed";

const CHOICES = ["1", "2", "3", "4", "5"];

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

  // 자동 선택: 첫 아이템 또는 현재 선택이 filter 밖으로 나가면 재지정
  useEffect(() => {
    if (!open) return;
    if (visibleRows.length === 0) {
      if (selectedId != null) setSelectedId(null);
      return;
    }
    if (selectedId == null || !visibleRows.some((r) => r.id === selectedId)) {
      setSelectedId(visibleRows[0].id);
    }
  }, [open, visibleRows, selectedId]);

  // J/K 네비게이션
  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (visibleRows.length === 0) return;
      const idx = visibleRows.findIndex((r) => r.id === selectedId);
      const next = idx < 0 ? 0 : Math.max(0, Math.min(visibleRows.length - 1, idx + dir));
      setSelectedId(visibleRows[next].id);
    },
    [visibleRows, selectedId],
  );

  if (!open) return null;

  return createPortal(
    <>
      <div className="orw-backdrop" onClick={onClose} aria-hidden />
      <div className="orw-wrap" role="dialog" aria-modal="true" aria-label="OMR 검토">
        <header className="orw-header">
          <div>
            <span className="orw-header__title">OMR 검토 · {examTitle}</span>
            <span className="orw-header__sub">
              학생 리스트 <span className="orw-kbd">J</span>/<span className="orw-kbd">K</span>
              {" · "}저장 <span className="orw-kbd">⌘S</span>
            </span>
          </div>
          <div className="orw-header__actions">
            <button className="orw-header__close" onClick={onClose} aria-label="닫기">
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
            placeholder="🔍 학생명·submission_id·파일명"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(["all", "ok", "noid", "flag", "failed"] as FilterKey[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`orw-filter-chip ${filter === k ? "orw-filter-chip--active" : ""}`}
              onClick={() => setFilter(k)}
            >
              {labelForCategory(k)}
              <span className="orw-filter-chip__count">{counts[k]}</span>
            </button>
          ))}
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
                      {r.student_name || <span style={{ color: "#9ca3af" }}>미식별</span>}
                    </div>
                    <div className="orw-list-row__score">
                      {r.score != null ? `${r.score}점` : "—"}
                    </div>
                    <div className="orw-list-row__sub">
                      <span className="orw-ds-badge" data-tone={tone}>{label}</span>
                      <span style={{ color: "#9ca3af" }}>#{r.id}</span>
                      {r.manual_review_reasons.length > 0 && (
                        <span style={{ color: "#9a3412" }}>
                          · {r.manual_review_reasons.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── CENTER: 스캔 이미지 ── */}
          <div className="orw-scan-pane">
            <div className="orw-scan-pane__toolbar">
              <span>
                {detail?.scan_image_url
                  ? `submission #${detail.submission_id}`
                  : "스캔 이미지"}
              </span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="orw-scan-pane__zoom-btn" onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}>−</button>
                <span style={{ minWidth: 44, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button className="orw-scan-pane__zoom-btn" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}>+</button>
                <button className="orw-scan-pane__zoom-btn" onClick={() => setZoom(1)}>Fit</button>
                {detail?.scan_image_url && (
                  <a
                    href={detail.scan_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="orw-scan-pane__zoom-btn"
                    style={{ textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center" }}
                  >
                    새 창
                  </a>
                )}
              </div>
            </div>
            <div className="orw-scan-pane__body">
              {detailLoading ? (
                <div className="orw-loading">불러오는 중…</div>
              ) : !detail ? (
                <div className="orw-scan-pane__empty">좌측에서 제출을 선택하세요.</div>
              ) : !detail.scan_image_url ? (
                <div className="orw-scan-pane__empty">
                  스캔 이미지가 없습니다.
                  <br />(온라인 제출 또는 파일 만료)
                </div>
              ) : (
                <img
                  className="orw-scan-pane__img"
                  src={detail.scan_image_url}
                  alt="OMR 스캔 원본"
                  style={{ width: `${Math.round(100 * zoom)}%` }}
                />
              )}
            </div>
          </div>

          {/* ── RIGHT: 답안 편집 ── */}
          <EditPane
            detail={detail}
            detailLoading={detailLoading}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["omr-review-list", examId] });
              qc.invalidateQueries({ queryKey: ["omr-review-detail", selectedId] });
              qc.invalidateQueries({ queryKey: ["admin-exam-results", examId] });
              qc.invalidateQueries({ queryKey: ["admin-exam-detail", examId] });
              feedback.success("수정 사항이 저장되고 재채점되었습니다.");
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
 * 우측 편집 패널
 * ────────────────────────────────────────────── */
function EditPane({
  detail,
  detailLoading,
  onSaved,
  onNavigate,
}: {
  detail: OmrReviewDetail | undefined;
  detailLoading: boolean;
  onSaved: () => void;
  onNavigate: (dir: 1 | -1) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [identifier, setIdentifier] = useState<string>("");
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

  // detail 바뀔 때 폼 리셋
  useEffect(() => {
    if (!detail) {
      setAnswers({});
      setIdentifier("");
      return;
    }
    const init: Record<number, string> = {};
    for (const a of detail.answers) init[a.question_id] = a.answer ?? "";
    setAnswers(init);
    setIdentifier("");
  }, [detail?.submission_id, detail?.answers]); // eslint-disable-line react-hooks/exhaustive-deps

  const mut = useMutation({
    mutationFn: async () => {
      if (!detail) throw new Error("no detail");
      const payloadAnswers = Object.entries(answers).map(([qid, ans]) => ({
        exam_question_id: Number(qid),
        answer: String(ans ?? ""),
      }));
      const idPayload =
        identifierNeeded && identifier.trim().length > 0
          ? { enrollment_id: Number(identifier.trim()) || identifier.trim() }
          : null;
      return await manualEditSubmissionApi({
        submissionId: detail.submission_id,
        identifier: idPayload,
        note: "omr_review_ui",
        answers: payloadAnswers,
      });
    },
    onSuccess: () => onSaved(),
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      feedback.error(err?.response?.data?.detail || err?.message || "저장 실패");
    },
  });

  // 첫 flagged 문항 focus
  const firstFlaggedRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!detail) return;
    const firstFlagged = detail.answers.find(isFlagged);
    if (firstFlagged && firstFlaggedRef.current) {
      firstFlaggedRef.current.focus?.();
    }
  }, [detail?.submission_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 키보드: J/K/⌘S
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      // input focus 중엔 J/K 스킵 (number 입력 방지)
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!mut.isPending) mut.mutate();
        return;
      }
      if (isEditable) return;
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        onNavigate(1);
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        onNavigate(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, mut, onNavigate]);

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
        <div className="orw-loading">좌측에서 제출을 선택하세요.</div>
      </div>
    );
  }

  const reasons = detail.meta?.manual_review?.reasons ?? [];

  return (
    <div className="orw-edit-pane">
      <div className="orw-edit-pane__header">
        <div className="orw-edit-pane__title">답안 수정 — #{detail.submission_id}</div>
        <div className="orw-edit-pane__summary">
          <span>상태: <b>{detail.submission_status}</b></span>
          {detail.enrollment_id != null && (
            <span>enrollment #{detail.enrollment_id}</span>
          )}
          {reasons.length > 0 && (
            <span style={{ color: "#9a3412" }}>⚠ {reasons.join(", ")}</span>
          )}
        </div>
      </div>

      <div className="orw-edit-pane__body">
        {identifierNeeded && (
          <div className="orw-identifier">
            <div className="orw-identifier__title">⚠ 학생 식별 필요</div>
            <div className="orw-identifier__desc">
              자동 식별에 실패했습니다. 학생의 <b>enrollment_id</b>를 입력하면 매칭 후 채점이 재개됩니다.
            </div>
            <input
              className="orw-identifier__input"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="enrollment_id (숫자)"
              inputMode="numeric"
            />
          </div>
        )}

        <div>
          {detail.answers.length === 0 ? (
            <div className="orw-loading">문항이 없습니다.</div>
          ) : (
            detail.answers.map((a, idx) => (
              <AnswerRow
                key={a.question_id}
                answer={a}
                current={answers[a.question_id] ?? ""}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [a.question_id]: v }))}
                flaggedRef={idx === 0 && isFlagged(a) ? firstFlaggedRef : null}
              />
            ))
          )}
        </div>
      </div>

      <div className="orw-edit-pane__footer">
        <button
          className="orw-save-btn"
          type="button"
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
        >
          {mut.isPending ? "저장 중…" : "저장 + 재채점"}
        </button>
      </div>
    </div>
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
  current,
  onChange,
  flaggedRef,
}: {
  answer: OmrReviewDetailAnswer;
  current: string;
  onChange: (v: string) => void;
  flaggedRef: React.RefObject<HTMLInputElement | null> | null;
}) {
  const isChoice = /^[1-5]$/.test((current || "").trim()) || CHOICES.includes((answer.answer || "").trim()) || answer.omr?.marking != null;
  const flagged = isFlagged(answer);
  const marking = String(answer.omr?.marking || "").toLowerCase();
  const conf = answer.omr?.confidence;

  return (
    <div className={`orw-q-row ${flagged ? "orw-q-row--flag" : ""}`}>
      <span className="orw-q-row__num">{answer.question_no ?? answer.question_id}</span>

      {isChoice ? (
        <div className="orw-q-row__bubbles">
          {CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              className={`orw-bubble ${current === c ? "orw-bubble--selected" : ""}`}
              onClick={() => onChange(current === c ? "" : c)}
            >
              {c}
            </button>
          ))}
        </div>
      ) : (
        <input
          ref={flaggedRef}
          className="orw-essay-input"
          type="text"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder="답안"
        />
      )}

      <div className="orw-q-row__meta">
        {marking === "blank" && <span className="orw-chip orw-chip--blank">빈칸</span>}
        {marking === "multi" && <span className="orw-chip orw-chip--multi">중복</span>}
        {typeof conf === "number" && conf < 0.5 && (
          <span className="orw-chip orw-chip--low">{Math.round(conf * 100)}%</span>
        )}
        {typeof conf === "number" && conf >= 0.5 && marking !== "blank" && marking !== "multi" && (
          <span style={{ color: "#9ca3af" }}>{Math.round(conf * 100)}%</span>
        )}
      </div>
    </div>
  );
}

/**
 * PATH: src/app_admin/domains/results/components/omr-review/StudentPickerModal.tsx
 *
 * OMR 검토 전용 학생 picker (Spotlight 스타일).
 *
 * - 시험의 응시 대상 학생을 이름/전화번호 뒤 4자리로 검색.
 * - 키보드: ↑/↓ 선택, Enter 확정, Esc 닫기.
 * - 이미 다른 submission과 매칭된 학생은 "중복 경고" 배지.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchExamCandidates, type CandidateRow } from "./omrReviewApi";
import "./StudentPickerModal.css";

type Props = {
  examId: number;
  open: boolean;
  onClose: () => void;
  onPick: (c: CandidateRow) => void;
};

export default function StudentPickerModal({ examId, open, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 최초 열릴 때 input 포커스
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  // debounce: 입력 끝난 뒤 250ms 대기
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(query), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["omr-candidates", examId, debouncedQ],
    queryFn: () => fetchExamCandidates(examId, debouncedQ),
    enabled: open && Number.isFinite(examId),
    staleTime: 30_000,
  });

  // 결과 바뀌면 highlight 0으로
  useEffect(() => {
    setHighlight(0);
  }, [rows.length, debouncedQ]);

  const total = rows.length;
  const hint = useMemo(() => {
    if (isFetching) return "검색 중…";
    if (!debouncedQ.trim()) return `응시 대상 ${total}명${total >= 50 ? " (상위 50명)" : ""}`;
    if (total === 0) return "검색 결과 없음";
    return `${total}명 일치${total >= 50 ? " (상위 50명)" : ""}`;
  }, [isFetching, debouncedQ, total]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(total - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = rows[highlight];
      if (picked) onPick(picked);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="spm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="spm-wrap" role="dialog" aria-modal="true" aria-label="학생 선택">
        <div className="spm-header">
          <span className="spm-header__icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            className="spm-search"
            placeholder="학생 이름 또는 전화번호 뒤 4자리"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            autoComplete="off"
          />
          <button type="button" className="spm-close" onClick={onClose} aria-label="닫기">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="spm-hint">
          {hint}
          <span className="spm-hint__kbd">
            <span className="spm-kbd">↑</span><span className="spm-kbd">↓</span> 이동 ·
            <span className="spm-kbd">Enter</span> 선택 ·
            <span className="spm-kbd">Esc</span> 닫기
          </span>
        </div>

        <div className="spm-list">
          {rows.length === 0 ? (
            <div className="spm-empty">
              {isFetching
                ? "검색 중…"
                : debouncedQ.trim()
                  ? "일치하는 학생이 없습니다."
                  : "응시 대상자가 없습니다."}
            </div>
          ) : (
            rows.map((r, idx) => (
              <button
                key={r.enrollment_id}
                type="button"
                className={`spm-row ${idx === highlight ? "spm-row--active" : ""}`}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => onPick(r)}
              >
                <span className="spm-row__name">{r.student_name || "이름 없음"}</span>
                <span className="spm-row__meta">
                  {r.lecture_title && <span className="spm-row__lecture">{r.lecture_title}</span>}
                  {r.student_phone_last4 && (
                    <span className="spm-row__phone">학생 ···{r.student_phone_last4}</span>
                  )}
                  {r.parent_phone_last4 && (
                    <span className="spm-row__phone">학부모 ···{r.parent_phone_last4}</span>
                  )}
                </span>
                {r.already_matched && (
                  <span className="spm-row__warn" title="다른 답안지에 이미 매칭된 학생입니다.">
                    중복 경고
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// PATH: src/shared/ui/assessment/SessionItemBrowser.tsx
// ------------------------------------------------------------
// 다른 강의/차시의 시험 또는 과제를 탐색하는 공유 컴포넌트
// cascade: 강의 선택 → 차시 선택 → 항목 목록 (멀티 선택)
// ------------------------------------------------------------

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  fetchAssessmentExams,
  fetchAssessmentHomeworks,
  type AssessmentExamListItem,
  type AssessmentHomeworkListItem,
} from "@/shared/api/contracts/assessments";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/shared/api/contracts/sessions";
import type { ExamSelection, HomeworkSelection } from "@/shared/types/selection";

export type BrowseMode = "exam" | "homework";

export type SelectedExamItem = {
  id: number;
  title: string;
  max_score: number;
  pass_score: number;
};

export type SelectedHomeworkItem = {
  id: number;
  title: string;
  max_score: number;
  grading_mode: "SCORE" | "COMPLETION";
  cutline_mode: "PERCENT" | "COUNT";
  cutline_value: number;
};

type Props = {
  mode: BrowseMode;
  /** 현재 세션 ID — 목록에서 제외 */
  excludeSessionId: number;
  /** 선택 완료 콜백 (rich typed items) */
  onSelectExams?: (items: SelectedExamItem[]) => void;
  onSelectHomeworks?: (items: SelectedHomeworkItem[]) => void;
  /** 선택 완료 콜백 (discriminated union — type-safe ID selection) */
  onSelect?: (selection: ExamSelection | HomeworkSelection) => void;
};

export default function SessionItemBrowser({
  mode,
  excludeSessionId,
  onSelectExams,
  onSelectHomeworks,
  onSelect,
}: Props) {
  // cascade state
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedLectureId, setSelectedLectureId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // items
  const [exams, setExams] = useState<AssessmentExamListItem[]>([]);
  const [homeworks, setHomeworks] = useState<AssessmentHomeworkListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // loading & error
  const [lecturesLoading, setLecturesLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [lecturesError, setLecturesError] = useState(false);
  const [sessionsError, setSessionsError] = useState(false);
  const [itemsError, setItemsError] = useState(false);
  const [lecturesRetry, setLecturesRetry] = useState(0);
  const [sessionsRetry, setSessionsRetry] = useState(0);
  const [itemsRetry, setItemsRetry] = useState(0);
  const [keyword, setKeyword] = useState("");

  // Load lectures
  useEffect(() => {
    let cancelled = false;
    setLecturesLoading(true);
    setLecturesError(false);
    fetchLectures({ is_active: true })
      .then((items) => {
        if (!cancelled) setLectures(items);
      })
      .catch(() => {
        if (!cancelled) setLecturesError(true);
      })
      .finally(() => {
        if (!cancelled) setLecturesLoading(false);
      });
    return () => { cancelled = true; };
  }, [lecturesRetry]);

  // Load sessions when lecture selected
  useEffect(() => {
    setSelectedSessionId(null);
    setSessions([]);
    setExams([]);
    setHomeworks([]);
    setSelectedIds(new Set());
    setKeyword("");
    setSessionsError(false);
    if (!selectedLectureId) {
      setSessionsLoading(false);
      return;
    }
    let cancelled = false;
    setSessionsLoading(true);
    fetchSessions(selectedLectureId)
      .then((items) => {
        if (!cancelled) {
          setSessions(items.filter((s) => s.id !== excludeSessionId));
        }
      })
      .catch(() => {
        if (!cancelled) setSessionsError(true);
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedLectureId, excludeSessionId, sessionsRetry]);

  // Load items when session selected
  useEffect(() => {
    setExams([]);
    setHomeworks([]);
    setSelectedIds(new Set());
    setKeyword("");
    setItemsError(false);
    if (!selectedSessionId) {
      setItemsLoading(false);
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    if (mode === "exam") {
      fetchAssessmentExams({ session_id: selectedSessionId, exam_type: "regular" })
        .then((items) => {
          if (!cancelled) setExams(items);
        })
        .catch(() => {
          if (!cancelled) setItemsError(true);
        })
        .finally(() => {
          if (!cancelled) setItemsLoading(false);
        });
    } else {
      fetchAssessmentHomeworks({ session_id: selectedSessionId })
        .then((items) => {
          if (!cancelled) setHomeworks(items);
        })
        .catch(() => {
          if (!cancelled) setItemsError(true);
        })
        .finally(() => {
          if (!cancelled) setItemsLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [selectedSessionId, mode, itemsRetry]);

  const toggleItem = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const items = mode === "exam" ? exams : homeworks;
  const filteredItems = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return items;
    return items.filter((item) => (item.title ?? "").toLowerCase().includes(k));
  }, [items, keyword]);

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));
  const toggleFilteredSelection = useCallback(() => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      const remove = filteredItems.every((item) => previous.has(item.id));
      for (const item of filteredItems) {
        if (remove) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }, [filteredItems]);

  // Notify parent on selection change
  const handleConfirm = useCallback(() => {
    const idArray = [...selectedIds];

    if (mode === "exam") {
      if (onSelectExams) {
        const selected = exams
          .filter((e) => selectedIds.has(e.id))
          .map((e) => ({
            id: e.id,
            title: e.title,
            max_score: e.max_score ?? 100,
            pass_score: e.pass_score ?? 0,
          }));
        onSelectExams(selected);
      }
      onSelect?.({ kind: "exam", examIds: idArray });
    } else if (mode === "homework") {
      if (onSelectHomeworks) {
        const selected = homeworks
          .filter((h) => selectedIds.has(h.id))
          .map((h) => ({
            id: h.id,
            title: h.title,
            max_score: h.max_score,
            grading_mode: h.grading_mode,
            cutline_mode: h.effective_cutline_mode,
            cutline_value: h.effective_cutline_value,
          }));
        onSelectHomeworks(selected);
      }
      onSelect?.({ kind: "homework", homeworkIds: idArray });
    }
  }, [mode, exams, homeworks, selectedIds, onSelectExams, onSelectHomeworks, onSelect]);

  const selectedLecture = lectures.find((l) => l.id === selectedLectureId);
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="space-y-3">
      {/* Step 1: Lecture selector */}
      <div>
        <label className="modal-section-label">강의 선택</label>
        {lecturesLoading ? (
          <div className="text-sm text-[var(--color-text-muted)]">불러오는 중…</div>
        ) : lecturesError ? (
          <div className="text-sm text-[var(--color-danger)]">
            강의 목록을 불러오지 못했습니다.
            <button type="button" className="ml-2 underline" onClick={() => setLecturesRetry((value) => value + 1)}>강의 다시 불러오기</button>
          </div>
        ) : lectures.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">등록된 강의가 없습니다.</div>
        ) : (
          <select
            aria-label="강의 선택"
            className="ds-input w-full"
            value={selectedLectureId ?? ""}
            onChange={(e) => setSelectedLectureId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">강의를 선택하세요</option>
            {lectures.map((l) => (
              <option key={l.id} value={l.id}>
                {l.chip_label ? `[${l.chip_label}] ` : ""}{l.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Step 2: Session selector */}
      {selectedLectureId && (
        <div>
          <label className="modal-section-label">차시 선택</label>
          {sessionsLoading ? (
            <div className="text-sm text-[var(--color-text-muted)]">불러오는 중…</div>
          ) : sessionsError ? (
            <div className="text-sm text-[var(--color-danger)]">
              차시 목록을 불러오지 못했습니다.
              <button type="button" className="ml-2 underline" onClick={() => setSessionsRetry((value) => value + 1)}>차시 다시 불러오기</button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)]">
              {selectedLecture ? `"${selectedLecture.title}"에 다른 차시가 없습니다.` : "차시가 없습니다."}
            </div>
          ) : (
            <select
              aria-label="차시 선택"
              className="ds-input w-full"
              value={selectedSessionId ?? ""}
              onChange={(e) => setSelectedSessionId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">차시를 선택하세요</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}{s.date ? ` (${s.date})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Step 3: Items list */}
      {selectedSessionId && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="modal-section-label mb-0">
              {mode === "exam" ? "시험 목록" : "과제 목록"}
              {selectedSession && (
                <span className="ml-1 text-[var(--color-text-muted)] font-normal">
                  — {selectedSession.title}
                </span>
              )}
            </label>
            {filteredItems.length > 0 && (
              <button
                type="button"
                onClick={toggleFilteredSelection}
                className="text-xs text-[var(--color-brand-primary)] hover:underline"
              >
                {keyword.trim()
                  ? allFilteredSelected ? "검색 결과 해제" : "검색 결과 선택"
                  : allFilteredSelected ? "전체 해제" : "전체 선택"}
              </button>
            )}
          </div>

          {/* Search */}
          {items.length > 3 && (
            <input
              className="ds-input w-full mb-2"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="제목 검색"
              aria-label="항목 검색"
            />
          )}

          {itemsLoading ? (
            <div className="text-sm text-[var(--color-text-muted)]">불러오는 중…</div>
          ) : itemsError ? (
            <div className="rounded border border-[var(--color-danger)] p-4 text-center text-sm text-[var(--color-danger)]">
              {mode === "exam" ? "시험" : "과제"} 목록을 불러오지 못했습니다.
              <button type="button" className="ml-2 underline" onClick={() => setItemsRetry((value) => value + 1)}>목록 다시 불러오기</button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded border border-[var(--color-border-divider)] p-4 text-center text-sm text-[var(--color-text-muted)]">
              {keyword ? "검색 결과가 없습니다." : mode === "exam" ? "이 차시에 시험이 없습니다." : "이 차시에 과제가 없습니다."}
            </div>
          ) : (
            <div className="max-h-[240px] overflow-y-auto rounded border border-[var(--color-border-divider)] divide-y divide-[var(--color-border-divider)]">
              {filteredItems.map((item) => {
                const checked = selectedIds.has(item.id);
                const isExam = mode === "exam";
                const exam = isExam ? (item as AssessmentExamListItem) : null;
                const homework = !isExam ? (item as AssessmentHomeworkListItem) : null;
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      checked ? "bg-[var(--state-selected-bg)]" : "hover:bg-[var(--color-bg-surface-hover)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(item.id)}
                      className="accent-[var(--color-brand-primary)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {item.title}
                      </div>
                      {exam && (
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          만점 {exam.max_score ?? 100} · 커트라인 {exam.pass_score ?? 0}
                        </div>
                      )}
                      {homework && (
                        <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                          {homework.grading_mode === "COMPLETION"
                            ? "완료/미완료로 검사"
                            : <>만점 {homework.max_score} · 기준 {homework.effective_cutline_value}
                                {homework.effective_cutline_mode === "PERCENT" ? "%" : "점"}</>}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Selection summary + confirm */}
          {selectedIds.size > 0 && (
            <div className="mt-3 flex items-center justify-between rounded border border-[var(--color-brand-primary)] bg-[color-mix(in_srgb,var(--color-brand-primary)_6%,var(--color-bg-surface))] p-3">
              <div className="text-sm font-medium text-[var(--color-brand-primary)]">
                {selectedIds.size}개 선택됨
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-brand-primary)] hover:opacity-90 transition-opacity"
              >
                불러오기
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info banner */}
      <div className="rounded border border-[var(--color-border-divider)] bg-[color-mix(in_srgb,var(--color-brand-primary)_4%,var(--color-bg-surface))] p-3">
        <div className="text-xs text-[var(--color-text-muted)]">
          선택한 {mode === "exam" ? "시험" : "과제"}을 현재 차시에 <strong>복사</strong>하여 새로 생성합니다.
          원본과 완전히 독립된 항목이 됩니다. 현재 차시의 등록 가능한 수강생을 대상자로 자동 등록합니다.
        </div>
      </div>
    </div>
  );
}

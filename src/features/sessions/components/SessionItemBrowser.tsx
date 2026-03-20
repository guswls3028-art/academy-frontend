// PATH: src/features/sessions/components/SessionItemBrowser.tsx
// ------------------------------------------------------------
// 다른 강의/차시의 시험 또는 과제를 탐색하는 공유 컴포넌트
// cascade: 강의 선택 → 차시 선택 → 항목 목록 (멀티 선택)
// ------------------------------------------------------------

import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/features/lectures/api/sessions";
import { fetchExams } from "@/features/exams/api/exams";
import type { Exam } from "@/features/exams/types";
import { fetchHomeworks, type HomeworkListItem } from "@/features/homework/api/homeworks";
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
  const [exams, setExams] = useState<Exam[]>([]);
  const [homeworks, setHomeworks] = useState<HomeworkListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // loading
  const [lecturesLoading, setLecturesLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [keyword, setKeyword] = useState("");

  // Load lectures
  useEffect(() => {
    let cancelled = false;
    setLecturesLoading(true);
    fetchLectures({ is_active: true })
      .then((items) => {
        if (!cancelled) setLectures(items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLecturesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Load sessions when lecture selected
  useEffect(() => {
    if (!selectedLectureId) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    setSessionsLoading(true);
    setSelectedSessionId(null);
    setExams([]);
    setHomeworks([]);
    setSelectedIds(new Set());
    fetchSessions(selectedLectureId)
      .then((items) => {
        if (!cancelled) {
          setSessions(items.filter((s) => s.id !== excludeSessionId));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedLectureId, excludeSessionId]);

  // Load items when session selected
  useEffect(() => {
    if (!selectedSessionId) {
      setExams([]);
      setHomeworks([]);
      setSelectedIds(new Set());
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    setSelectedIds(new Set());

    if (mode === "exam") {
      fetchExams({ session_id: selectedSessionId, exam_type: "regular" })
        .then((items) => {
          if (!cancelled) setExams(items);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setItemsLoading(false);
        });
    } else {
      fetchHomeworks({ session_id: selectedSessionId })
        .then((items) => {
          if (!cancelled) setHomeworks(items);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setItemsLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [selectedSessionId, mode]);

  const toggleItem = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const all = mode === "exam" ? exams.map((e) => e.id) : homeworks.map((h) => h.id);
    setSelectedIds(new Set(all));
  }, [mode, exams, homeworks]);

  const items = mode === "exam" ? exams : homeworks;
  const filteredItems = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return items;
    return items.filter((item) => (item.title ?? "").toLowerCase().includes(k));
  }, [items, keyword]);

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
            max_score: 100, // homework doesn't have max_score in list — default
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
        ) : lectures.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">등록된 강의가 없습니다.</div>
        ) : (
          <select
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
          ) : sessions.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)]">
              {selectedLecture ? `"${selectedLecture.title}"에 다른 차시가 없습니다.` : "차시가 없습니다."}
            </div>
          ) : (
            <select
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
            <label className="modal-section-label" style={{ marginBottom: 0 }}>
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
                onClick={selectedIds.size === filteredItems.length ? () => setSelectedIds(new Set()) : selectAll}
                className="text-xs text-[var(--color-brand-primary)] hover:underline"
              >
                {selectedIds.size === filteredItems.length ? "전체 해제" : "전체 선택"}
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
          ) : filteredItems.length === 0 ? (
            <div className="rounded border border-[var(--color-border-divider)] p-4 text-center text-sm text-[var(--color-text-muted)]">
              {keyword ? "검색 결과가 없습니다." : mode === "exam" ? "이 차시에 시험이 없습니다." : "이 차시에 과제가 없습니다."}
            </div>
          ) : (
            <div className="rounded border border-[var(--color-border-divider)] divide-y divide-[var(--color-border-divider)]" style={{ maxHeight: 240, overflowY: "auto" }}>
              {filteredItems.map((item) => {
                const checked = selectedIds.has(item.id);
                const isExam = mode === "exam";
                const exam = isExam ? (item as Exam) : null;
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
                    </div>
                    <span className={`ds-badge ${item.status === "OPEN" ? "ds-badge--success" : item.status === "CLOSED" ? "ds-badge--neutral" : "ds-badge--warning"}`}>
                      {item.status === "OPEN" ? "진행중" : item.status === "CLOSED" ? "마감" : "초안"}
                    </span>
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
          원본과 완전히 독립된 항목이 됩니다. 대상자는 자동 등록됩니다.
        </div>
      </div>
    </div>
  );
}

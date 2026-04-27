/**
 * 성적 홈 탭 — 시험 성적 / 과제 현황 내부 토글 + 목록
 * GradesPage에서 추출.
 */
import { useState, useMemo } from "react";
import EmptyState from "@student/layout/EmptyState";
import LectureExamGroup, { type ExamGroup } from "./LectureExamGroup";
import LectureHwGroup, { type HwGroup } from "./LectureHwGroup";
import type { MyExamGradeSummary, MyHomeworkGradeSummary } from "../api/grades.api";

type SubTab = "exams" | "homework";
type SortMode = "lecture" | "recent";

const UNGROUPED_KEY = "__ungrouped__";

/* ── Grouping helpers ── */

function groupExams(exams: MyExamGradeSummary[]): ExamGroup[] {
  const map = new Map<string, MyExamGradeSummary[]>();
  for (const e of exams) {
    const key = e.lecture_title ?? UNGROUPED_KEY;
    const arr = map.get(key);
    if (arr) arr.push(e);
    else map.set(key, [e]);
  }
  function calcAvgPct(items: MyExamGradeSummary[]): number {
    const scored = items.filter((e) => e.total_score != null && e.max_score > 0);
    return scored.length > 0
      ? Math.round(scored.reduce((s, e) => s + (e.total_score! / e.max_score) * 100, 0) / scored.length)
      : 0;
  }
  const groups: ExamGroup[] = [];
  for (const [key, items] of map) {
    if (key === UNGROUPED_KEY) continue;
    groups.push({ key, label: key, exams: items, avgPct: calcAvgPct(items) });
  }
  const ungrouped = map.get(UNGROUPED_KEY);
  if (ungrouped) {
    groups.push({ key: UNGROUPED_KEY, label: "기타 시험", exams: ungrouped, avgPct: calcAvgPct(ungrouped) });
  }
  return groups;
}

function groupHomeworks(homeworks: MyHomeworkGradeSummary[]): HwGroup[] {
  const map = new Map<string, MyHomeworkGradeSummary[]>();
  for (const h of homeworks) {
    const key = h.lecture_title ?? UNGROUPED_KEY;
    const arr = map.get(key);
    if (arr) arr.push(h);
    else map.set(key, [h]);
  }
  const groups: HwGroup[] = [];
  for (const [key, items] of map) {
    if (key === UNGROUPED_KEY) continue;
    const withMax = items.filter((h) => h.max_score != null && h.max_score > 0);
    const avgPct = withMax.length > 0
      ? Math.round(withMax.reduce((s, h) => s + (h.score / h.max_score!) * 100, 0) / withMax.length)
      : null;
    groups.push({ key, label: key, homeworks: items, avgPct });
  }
  const ungrouped = map.get(UNGROUPED_KEY);
  if (ungrouped) {
    const withMax = ungrouped.filter((h) => h.max_score != null && h.max_score > 0);
    const avgPct = withMax.length > 0
      ? Math.round(withMax.reduce((s, h) => s + (h.score / h.max_score!) * 100, 0) / withMax.length)
      : null;
    groups.push({ key: UNGROUPED_KEY, label: "기타 과제", homeworks: ungrouped, avgPct });
  }
  return groups;
}

type Props = {
  exams: MyExamGradeSummary[];
  homeworks: MyHomeworkGradeSummary[];
};

export default function GradesHomeTab({ exams, homeworks }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("exams");
  const [examSort, setExamSort] = useState<SortMode>("lecture");

  const sortedExams = useMemo(() => {
    if (examSort !== "recent") return exams;
    return [...exams].sort((a, b) => {
      const ta = a.submitted_at ? Date.parse(a.submitted_at) : 0;
      const tb = b.submitted_at ? Date.parse(b.submitted_at) : 0;
      return tb - ta; // 최신순
    });
  }, [exams, examSort]);

  const examGroups = useMemo(() => groupExams(exams), [exams]);
  const hwGroups = useMemo(() => groupHomeworks(homeworks), [homeworks]);

  return (
    <div style={stack}>
      {/* 내부 토글: 시험 성적 / 과제 현황 */}
      <div style={toggleBar}>
        <ToggleBtn active={subTab === "exams"} onClick={() => setSubTab("exams")}
          label={`시험 성적${exams.length > 0 ? ` ${exams.length}` : ""}`} />
        <ToggleBtn active={subTab === "homework"} onClick={() => setSubTab("homework")}
          label={`과제 현황${homeworks.length > 0 ? ` ${homeworks.length}` : ""}`} />
      </div>

      {subTab === "exams" && (
        <div>
          {exams.length === 0 ? (
            <EmptyState title="시험 결과가 아직 없습니다." description="시험 응시 후 채점이 완료되면 여기에 표시됩니다." />
          ) : (
            <>
              {/* 정렬 옵션 — 강좌별(기본) / 최근순 */}
              <div style={sortBar}>
                <SortChip active={examSort === "lecture"} onClick={() => setExamSort("lecture")} label="강좌별" />
                <SortChip active={examSort === "recent"} onClick={() => setExamSort("recent")} label="최근순" />
              </div>
              {examSort === "lecture" ? (
                <div data-guide="grades-list" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
                  {examGroups.map((group) => (
                    <LectureExamGroup key={group.key} group={group} />
                  ))}
                </div>
              ) : (
                <div data-guide="grades-list" style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
                  <LectureExamGroup
                    key="__recent__"
                    group={{ key: "__recent__", label: "최근 응시 순", exams: sortedExams, avgPct: null }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {subTab === "homework" && (
        <div>
          {homeworks.length === 0 ? (
            <EmptyState title="과제 성적이 아직 없습니다." description="과제 점수가 입력되면 여기에 표시됩니다." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
              {hwGroups.map((group) => (
                <LectureHwGroup key={group.key} group={group} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 12px",
        background: active ? "var(--stu-primary-bg)" : "transparent",
        border: `1px solid ${active ? "var(--stu-primary)" : "var(--stu-border)"}`,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        color: active ? "var(--stu-primary)" : "var(--stu-text-muted)",
        cursor: "pointer",
        transition: "all var(--stu-motion-base)",
      }}
    >
      {label}
    </button>
  );
}

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "var(--stu-space-3) var(--stu-space-3)",
        background: active ? "var(--stu-primary)" : "var(--stu-surface-soft)",
        border: active ? "1px solid var(--stu-primary)" : "1px solid var(--stu-border)",
        borderRadius: "var(--stu-radius)",
        fontWeight: active ? 700 : 500,
        fontSize: 13,
        color: active ? "var(--stu-primary-contrast, #fff)" : "var(--stu-text-muted)",
        cursor: "pointer",
        transition: "all var(--stu-motion-base)",
      }}
    >
      {label}
    </button>
  );
}

const stack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--stu-space-6)",
};

const toggleBar: React.CSSProperties = {
  display: "flex",
  gap: "var(--stu-space-2)",
};

const sortBar: React.CSSProperties = {
  display: "flex",
  gap: "var(--stu-space-2)",
  marginBottom: "var(--stu-space-4)",
};

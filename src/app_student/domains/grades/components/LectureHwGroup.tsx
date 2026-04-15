/**
 * 강좌별 과제 성적 그룹 — GradesPage에서 추출
 */
import { IconClipboard } from "@student/shared/ui/icons/Icons";
import GradeBadge from "./GradeBadge";
import type { MyHomeworkGradeSummary } from "../api/grades.api";

export type HwGroup = {
  key: string;
  label: string;
  homeworks: MyHomeworkGradeSummary[];
  avgPct: number | null;
};

export default function LectureHwGroup({ group }: { group: HwGroup }) {
  return (
    <div>
      <div style={groupHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--stu-text)" }}>{group.label}</div>
          <div className="stu-muted" style={{ fontSize: 12, marginTop: 2 }}>
            {group.homeworks.length}건{group.avgPct != null ? ` · 평균 ${group.avgPct}점` : ""}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-2)" }}>
        {group.homeworks.map((h, idx) => (
          <div
            key={`${h.homework_id}-${h.lecture_title ?? ""}-${idx}`}
            className="stu-panel stu-panel--accent"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-4)" }}>
              <div style={iconWrap}>
                <IconClipboard style={{ width: 22, height: 22, color: "var(--stu-primary)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{h.title}</div>
                <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {h.session_title && `${h.session_title} · `}
                  {h.max_score != null && h.max_score > 0
                    ? `${h.score}/${h.max_score}점`
                    : `${h.score}점`}
                </div>
              </div>
              <GradeBadge passed={h.passed} achievement={h.achievement} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const iconWrap: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 12,
  background: "var(--stu-surface-soft)", display: "grid", placeItems: "center", flexShrink: 0,
};

const groupHeader: React.CSSProperties = {
  display: "flex", alignItems: "center",
  padding: "var(--stu-space-4) var(--stu-space-5)",
  marginBottom: "var(--stu-space-2)",
  borderLeft: "4px solid var(--stu-primary)",
  background: "var(--stu-tint-primary)",
  borderRadius: "0 var(--stu-radius-xl) var(--stu-radius-xl) 0",
};

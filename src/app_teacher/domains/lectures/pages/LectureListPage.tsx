// PATH: src/app_teacher/domains/lectures/pages/LectureListPage.tsx
// 강의 목록 — 활성/과거 탭 + 딱지 + 강사 + 시간
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { ChevronRight, Plus } from "@teacher/shared/ui/Icons";
import { TabBar, SectionTitle } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchLectures } from "../api";
import LectureFormSheet from "../components/LectureFormSheet";

type Tab = "active" | "past";

export default function LectureListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("active");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: activeLectures, isLoading: loadingActive } = useQuery({
    queryKey: ["lectures-mobile", true],
    queryFn: () => fetchLectures(true),
  });

  const { data: pastLectures, isLoading: loadingPast } = useQuery({
    queryKey: ["lectures-mobile", false],
    queryFn: () => fetchLectures(false),
    enabled: tab === "past",
  });

  const lectures = tab === "active" ? activeLectures : pastLectures;
  const isLoading = tab === "active" ? loadingActive : loadingPast;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionTitle>강의</SectionTitle>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ padding: "6px 12px", borderRadius: "var(--tc-radius)", border: "none", background: "var(--tc-primary)", color: "#fff" }}>
          <Plus size={14} /> 강의 생성
        </button>
      </div>

      <TabBar
        tabs={[
          { key: "active" as Tab, label: `활성 (${activeLectures?.length ?? "…"})` },
          { key: "past" as Tab, label: "과거" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : lectures && lectures.length > 0 ? (
        <div className="flex flex-col gap-2">
          {lectures.map((l: any) => {
            const chipLabel = l.chip_label ?? l.chipLabel;
            const time = l.lecture_time ?? l.lectureTime;
            const dateRange = l.start_date && l.end_date ? `${l.start_date} ~ ${l.end_date}` : l.start_date;

            return (
              <button
                key={l.id}
                onClick={() => navigate(`/teacher/classes/${l.id}`)}
                className="flex gap-3 rounded-xl w-full text-left cursor-pointer"
                style={{ padding: "var(--tc-space-3) var(--tc-space-4)", background: "var(--tc-surface)", border: "1px solid var(--tc-border)" }}
              >
                <LectureChip lectureName={l.title} color={l.color} chipLabel={chipLabel} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-semibold truncate" style={{ color: "var(--tc-text)" }}>{l.title}</span>
                    {!l.is_active && <Badge tone="neutral" size="xs">종료</Badge>}
                  </div>
                  {l.subject && <div className="text-[12px] mt-0.5" style={{ color: "var(--tc-text-muted)" }}>{l.subject}</div>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                    {time && <span>{time}</span>}
                    {dateRange && <span>{dateRange}</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 self-center" style={{ color: "var(--tc-text-muted)" }} />
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title={tab === "active" ? "활성 강의가 없습니다" : "과거 강의가 없습니다"} />
      )}

      <LectureFormSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

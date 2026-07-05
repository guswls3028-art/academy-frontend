// PATH: src/app_teacher/domains/lectures/pages/LectureListPage.tsx
// 강의 목록 — 활성/과거 탭 + 딱지 + 강사 + 시간
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { ChevronRight, Plus } from "@teacher/shared/ui/Icons";
import { TabBar, SectionTitle } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { fetchLectures } from "../api";
import LectureFormSheet from "../components/LectureFormSheet";
import { teacherLectureQueryKeys } from "../queryKeys";
import styles from "./LectureListPage.module.css";

type Tab = "active" | "past";

export default function LectureListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("active");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: activeLectures, isLoading: loadingActive } = useQuery({
    queryKey: teacherLectureQueryKeys.lectureList(true),
    queryFn: () => fetchLectures(true),
  });

  const { data: pastLectures, isLoading: loadingPast } = useQuery({
    queryKey: teacherLectureQueryKeys.lectureList(false),
    queryFn: () => fetchLectures(false),
    enabled: tab === "past",
  });

  const lectures = tab === "active" ? activeLectures : pastLectures;
  const isLoading = tab === "active" ? loadingActive : loadingPast;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <SectionTitle>강의 관리</SectionTitle>
        <button onClick={() => setCreateOpen(true)} className={styles.createButton} type="button">
          <Plus size={ICON.xs} /> 강의 추가
        </button>
      </div>

      <TabBar
        tabs={[
          { key: "active" as Tab, label: `강의목록 (${activeLectures?.length ?? "…"})` },
          { key: "past" as Tab, label: "지난강의" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : lectures && lectures.length > 0 ? (
        <div className={styles.list}>
          {lectures.map((l) => {
            const chipLabel = l.chip_label ?? l.chipLabel;
            const time = l.lecture_time ?? l.lectureTime;
            const dateRange = l.start_date && l.end_date ? `${l.start_date} ~ ${l.end_date}` : l.start_date;
            const isActive = l.is_active ?? l.isActive ?? true;

            return (
              <button
                key={l.id}
                onClick={() => navigate(`/teacher/classes/${l.id}`)}
                className={styles.lectureButton}
                type="button"
              >
                <LectureChip lectureName={l.title} color={l.color ?? undefined} chipLabel={chipLabel} size={40} />
                <div className={styles.content}>
                  <div className={styles.titleRow}>
                    <span className={`ds-text-name font-semibold truncate ${styles.title}`}>{l.title}</span>
                    {!isActive && <Badge tone="neutral" size="xs">종료</Badge>}
                  </div>
                  {l.subject && <div className={styles.subject}>{l.subject}</div>}
                  <div className={styles.meta}>
                    {time && <span>{time}</span>}
                    {dateRange && <span>{dateRange}</span>}
                  </div>
                </div>
                <ChevronRight size={ICON.sm} className={styles.chevron} />
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState scope="panel" tone="empty" title={tab === "active" ? "강의가 없습니다" : "지난 강의가 없습니다"} />
      )}

      <LectureFormSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

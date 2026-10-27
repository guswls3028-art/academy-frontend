// PATH: src/app_teacher/domains/lectures/pages/LectureListPage.tsx
// 강의 목록 — 활성/과거 탭 + 딱지 + 강사 + 시간
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ICON } from "@/shared/ui/ds";
import LectureChip from "@/shared/ui/chips/LectureChip";
import { ChevronRight, Plus } from "@teacher/shared/ui/Icons";
import { TabBar, SectionTitle } from "@teacher/shared/ui/Card";
import { Badge } from "@teacher/shared/ui/Badge";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import { fetchLectures } from "../api";
import LectureFormSheet from "../components/LectureFormSheet";
import { teacherLectureQueryKeys } from "../queryKeys";
import { extractApiError } from "@/shared/utils/extractApiError";
import styles from "./LectureListPage.module.css";

type Tab = "active" | "past";

export default function LectureListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "past" ? "past" : "active";
  const search = searchParams.get("q") ?? "";
  const setTab = (nextTab: Tab) => {
    const next = new URLSearchParams(searchParams);
    if (nextTab === "past") next.set("tab", nextTab);
    else next.delete("tab");
    setSearchParams(next);
  };
  const setSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };
  const [createOpen, setCreateOpen] = useState(false);

  const activeQuery = useQuery({
    queryKey: teacherLectureQueryKeys.lectureList(true),
    queryFn: () => fetchLectures(true),
  });

  const pastQuery = useQuery({
    queryKey: teacherLectureQueryKeys.lectureList(false),
    queryFn: () => fetchLectures(false),
    enabled: tab === "past",
  });

  const activeLectures = activeQuery.data;
  const pastLectures = pastQuery.data;

  const lectures = tab === "active" ? activeLectures : pastLectures;
  const selectedQuery = tab === "active" ? activeQuery : pastQuery;
  const isLoading = selectedQuery.isLoading;
  const keyword = search.trim().toLocaleLowerCase();
  const filtered = lectures?.filter((lecture) =>
    [lecture.title, lecture.subject, lecture.name]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(keyword)),
  );

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

      <div className={styles.searchBar}>
        <label className={styles.searchLabel} htmlFor="teacher-lecture-search">강의 찾기</label>
        <div className={styles.searchControls}>
          <input id="teacher-lecture-search" type="search" value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="강의명·과목·강사 검색" className={styles.searchInput} />
          {search && <button type="button" className={styles.clearSearch} onClick={() => setSearch("")}>검색 지우기</button>}
        </div>
        {lectures && !selectedQuery.isError && <span className={styles.searchResult} role="status">
          {keyword ? `${filtered?.length ?? 0}개 검색됨 · 전체 ${lectures.length}개` : `전체 ${lectures.length}개`}
        </span>}
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : selectedQuery.isError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="강의 목록을 불러오지 못했습니다"
          description={extractApiError(selectedQuery.error, "연결 상태를 확인한 뒤 다시 시도해 주세요.")}
          actions={
            <EmptyActionButton onClick={() => void selectedQuery.refetch()}>
              다시 시도
            </EmptyActionButton>
          }
        />
      ) : filtered && filtered.length > 0 ? (
        <div className={styles.list}>
          {filtered.map((l) => {
            const chipLabel = l.chip_label ?? l.chipLabel;
            const time = l.lecture_time ?? l.lectureTime;
            const dateRange = l.start_date && l.end_date ? `${l.start_date} ~ ${l.end_date}` : l.start_date;
            const isActive = l.is_active ?? l.isActive ?? true;

            return (
              <button
                key={l.id}
                onClick={() => navigate(`/workspace/mobile/classes/${l.id}`)}
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
      ) : keyword && lectures && lectures.length > 0 ? (
        <EmptyState scope="panel" tone="empty" title="검색 결과가 없습니다"
          description="강의명, 과목 또는 강사 이름으로 다시 찾아보세요."
          actions={<EmptyActionButton variant="secondary" onClick={() => setSearch("")}>검색 지우기</EmptyActionButton>}
        />
      ) : (
        <EmptyState
          scope="panel"
          tone="empty"
          title={tab === "active" ? "강의가 없습니다" : "지난 강의가 없습니다"}
          description={tab === "active" ? "강의를 만들면 차시, 출결, 성적 입력이 같은 흐름으로 연결됩니다." : "종료된 강의가 이곳에 모입니다."}
          actions={tab === "active" ? (
            <EmptyActionButton onClick={() => setCreateOpen(true)}>
              강의 추가
            </EmptyActionButton>
          ) : (
            <EmptyActionButton variant="secondary" onClick={() => setTab("active")}>
              현재 강의 보기
            </EmptyActionButton>
          )}
        />
      )}

      <LectureFormSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

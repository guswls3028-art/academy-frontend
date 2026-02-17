/**
 * 강의 콘텐츠 통합 — 영상·성적·시험·메시지를 폴더 트리로 관리
 * 저장소와 동일한 좌측 트리 레이아웃: 강의명 > 차시1, 차시2...
 * 클릭 시 해당 차시 상세로 이동 (영상/성적/시험 탭 포함)
 */

import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { fetchLectures, fetchSessions, type Lecture, type Session } from "@/features/lectures/api/sessions";
import DomainLayout from "@/shared/ui/domain/DomainLayout";
import LectureSessionTree from "../components/LectureSessionTree";
import styles from "./CourseContentsPage.module.css";

type LectureWithSessions = Lecture & { sessions: Session[] };

function useLecturesWithSessions() {
  const { data: lectures = [] } = useQuery({
    queryKey: ["course-contents-lectures"],
    queryFn: () => fetchLectures({ is_active: undefined }),
  });

  const sessionQueries = useQueries({
    queries: lectures.map((l) => ({
      queryKey: ["course-contents-sessions", l.id],
      queryFn: () => fetchSessions(l.id),
    })),
  });

  const withSessions: LectureWithSessions[] = useMemo(() => {
    return lectures.map((lecture, i) => {
      const sessions = sessionQueries[i]?.data ?? [];
      return { ...lecture, sessions };
    });
  }, [lectures, sessionQueries]);

  const isLoading = sessionQueries.some((q) => q.isLoading);

  return { lectures: withSessions, isLoading };
}

export default function CourseContentsPage() {
  const navigate = useNavigate();
  const { lectureId, sessionId } = useParams<{ lectureId?: string; sessionId?: string }>();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const selectedLectureId = lectureId ? parseInt(lectureId, 10) : null;
  const selectedSessionId = sessionId ? parseInt(sessionId, 10) : null;

  const { lectures, isLoading } = useLecturesWithSessions();

  const filtered = useMemo(() => {
    if (!search.trim()) return lectures;
    const k = search.trim().toLowerCase();
    return lectures.filter(
      (l) =>
        (l.title && l.title.toLowerCase().includes(k)) ||
        (l.name && l.name.toLowerCase().includes(k)) ||
        (l.subject && l.subject.toLowerCase().includes(k))
    );
  }, [lectures, search]);

  const handleSelectLecture = (lectureId: number) => {
    navigate(`/admin/lectures/${lectureId}`);
  };

  const handleSelectSession = (lectureId: number, sessionId: number) => {
    navigate(`/admin/lectures/${lectureId}/sessions/${sessionId}`);
  };

  return (
    <DomainLayout
      title="강의 콘텐츠"
      description="영상·성적·시험·메시지를 강의·차시 단위로 통합 관리합니다. 차시를 클릭하면 해당 차시 상세로 이동합니다."
    >
      <div className={styles.wrap}>
        <div className={styles.toolbar}>
          <input
            type="text"
            className="ds-input"
            placeholder="강의명 · 과목 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onBlur={() => setSearch(searchInput)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
            style={{ maxWidth: 280 }}
          />
          <span className={styles.total}>
            {isLoading ? "…" : `총 ${filtered.length}개 강의`}
          </span>
        </div>

        <div className={styles.body}>
          <aside className={styles.tree}>
            <LectureSessionTree
              lectures={filtered}
              selectedSessionId={null}
              selectedLectureId={null}
              onSelectLecture={handleSelectLecture}
              onSelectSession={handleSelectSession}
            />
          </aside>
          <div className={styles.panel}>
            {isLoading ? (
              <div className={styles.placeholder}>로딩 중…</div>
            ) : (
              <div className={styles.placeholder}>
                <p>좌측 트리에서 <strong>강의</strong>를 클릭하면 강의 상세로,</p>
                <p><strong>차시</strong>를 클릭하면 해당 차시의 영상·성적·시험 관리 페이지로 이동합니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DomainLayout>
  );
}

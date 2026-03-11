/**
 * PATH: src/features/results/pages/ResultsExplorerPage.tsx
 * 성적 (사이드바 첫 페이지) — 저장소/메시지/시험과 동일한 폴더트리형 SSOT
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { BarChart2 } from "lucide-react";
import { Button } from "@/shared/ui/ds";
import Breadcrumb from "@/features/storage/components/Breadcrumb";
import LectureSessionTree from "@/features/exams/components/LectureSessionTree";
import {
  fetchLectures,
  fetchSessions,
  sortSessionsByDateDesc,
  type Lecture,
  type Session,
} from "@/features/lectures/api/sessions";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import styles from "../components/ResultsExplorer.module.css";

type LectureWithSessions = Lecture & { sessions: Session[] };

export default function ResultsExplorerPage() {
  const navigate = useNavigate();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const { data: lectures = [], isLoading: lecturesLoading } = useQuery({
    queryKey: ["admin-results-lectures"],
    queryFn: () => fetchLectures({ is_active: undefined }),
  });

  const sessionQueries = useQueries({
    queries: lectures.map((lec) => ({
      queryKey: ["lecture-sessions-results", lec.id],
      queryFn: () => fetchSessions(lec.id),
      enabled: lectures.length > 0,
    })),
  });

  const lecturesWithSessions: LectureWithSessions[] = useMemo(() => {
    return lectures.map((lec, i) => {
      const sessions = (sessionQueries[i]?.data as Session[] | undefined) ?? [];
      return { ...lec, sessions: sortSessionsByDateDesc(sessions) };
    });
  }, [lectures, sessionQueries]);

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null;
    for (const lec of lecturesWithSessions) {
      const s = lec.sessions.find((x) => x.id === selectedSessionId);
      if (s) return { lecture: lec, session: s };
    }
    return null;
  }, [lecturesWithSessions, selectedSessionId]);

  const breadcrumbPath = useMemo(() => {
    const path: { id: string | null; name: string }[] = [{ id: null, name: "성적" }];
    if (selectedSession) {
      path.push({
        id: String(selectedSession.lecture.id),
        name: selectedSession.lecture.title || selectedSession.lecture.name || "강의",
      });
      path.push({ id: String(selectedSession.session.id), name: `${selectedSession.session.order}차시` });
    }
    return path;
  }, [selectedSession]);

  const handleBreadcrumbSelect = (id: string | null) => {
    if (!id) {
      setSelectedSessionId(null);
      return;
    }
    const num = Number(id);
    const asSession = lecturesWithSessions.some((l) => l.sessions.some((s) => s.id === num));
    if (asSession) {
      setSelectedSessionId(num);
    } else {
      const lec = lecturesWithSessions.find((l) => l.id === num);
      const firstSession = lec?.sessions?.[0];
      setSelectedSessionId(firstSession ? firstSession.id : null);
    }
  };

  const sessionsLoading = sessionQueries.some((q) => q.isLoading);
  const isLoading = lecturesLoading || sessionsLoading;

  return (
      <div className={panelStyles.root}>
        <div className={panelStyles.toolbar}>
          <Breadcrumb
            path={breadcrumbPath.length > 1 ? breadcrumbPath : [{ id: null, name: "성적" }]}
            onSelect={(id) => handleBreadcrumbSelect(id)}
          />
          <div className={panelStyles.actions}>
            <Button intent="primary" size="sm" onClick={() => navigate("/admin/lectures")}>
              강의 목록
            </Button>
          </div>
        </div>

        <div className={panelStyles.body}>
          <aside className={panelStyles.tree}>
            <div className={panelStyles.treeNavHeader}>
              <span className={panelStyles.treeNavTitle}>강의 · 차시</span>
            </div>
            <div className={panelStyles.treeScroll}>
              <LectureSessionTree
              lectures={lecturesWithSessions}
              currentSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
              />
            </div>
          </aside>

          <div className={panelStyles.gridWrap}>
            {isLoading ? (
              <div className={panelStyles.placeholder}>
                <p className={panelStyles.placeholderTitle}>불러오는 중…</p>
              </div>
            ) : !selectedSessionId ? (
              <div className={panelStyles.placeholder}>
                <p className={panelStyles.placeholderTitle}>좌측에서 차시를 선택하세요</p>
                <p className={panelStyles.placeholderDesc}>
                  왼쪽 목록에서 강의·차시를 선택하면 여기에 해당 차시의 성적 정보가 표시됩니다.
                </p>
              </div>
            ) : !selectedSession ? (
              <div className={panelStyles.placeholder}>
                <p className={panelStyles.placeholderTitle}>차시를 선택하세요</p>
              </div>
            ) : (
              <div className={styles.grid}>
                <div
                  className={styles.item}
                  onClick={() =>
                    navigate(
                      `/admin/lectures/${selectedSession.lecture.id}/sessions/${selectedSession.session.id}/scores`
                    )
                  }
                  title="이 차시 성적 관리"
                >
                  <BarChart2 size={32} style={{ color: "var(--color-primary)" }} aria-hidden />
                  <span className={styles.itemLabel}>성적 보기</span>
                  <span className={styles.itemMeta}>
                    {selectedSession.lecture.title || selectedSession.lecture.name} · {selectedSession.session.order}차시
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

/**
 * 시험 (사이드바 첫 페이지) — 저장소/메시지 템플릿과 동일한 폴더트리형 SSOT
 * 강의명 > 1~n차시 트리, 우측에 해당 차시의 시험 그리드
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { FileText, FilePlus } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/layout";
import Breadcrumb from "@/features/storage/components/Breadcrumb";
import LectureSessionTree from "../components/LectureSessionTree";
import { fetchLectures, fetchSessions, sortSessionsByDateDesc, type Lecture, type Session } from "@/features/lectures/api/sessions";
import { fetchExams } from "../api/exams";
import styles from "../components/ExamExplorer.module.css";

type LectureWithSessions = Lecture & { sessions: Session[] };

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
}

export default function ExamExplorerPage() {
  const navigate = useNavigate();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const { data: lectures = [], isLoading: lecturesLoading } = useQuery({
    queryKey: ["admin-exams-lectures"],
    queryFn: () => fetchLectures({ is_active: undefined }),
  });

  const sessionQueries = useQueries({
    queries: lectures.map((lec) => ({
      queryKey: ["lecture-sessions", lec.id],
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

  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["admin-exams", selectedSessionId],
    queryFn: () => fetchExams({ session_id: selectedSessionId! }),
    enabled: Number.isFinite(selectedSessionId),
  });

  const sessionsLoading = sessionQueries.some((q) => q.isLoading);
  const isLoading = lecturesLoading || sessionsLoading;

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null;
    for (const lec of lecturesWithSessions) {
      const s = lec.sessions.find((x) => x.id === selectedSessionId);
      if (s) return { lecture: lec, session: s };
    }
    return null;
  }, [lecturesWithSessions, selectedSessionId]);

  const breadcrumbPath = useMemo(() => {
    const path: { id: string | null; name: string }[] = [{ id: null, name: "시험" }];
    if (selectedSession) {
      path.push({ id: String(selectedSession.lecture.id), name: selectedSession.lecture.title || selectedSession.lecture.name || "강의" });
      path.push({ id: String(selectedSession.session.id), name: `${selectedSession.session.order}차시` });
    }
    return path;
  }, [selectedSession]);

  const handleBreadcrumbSelect = (id: string | null) => {
    setSelectedSessionId(id ? Number(id) : null);
  };

  return (
    <DomainLayout
      title="시험"
      description="강의·차시 단위 시험을 한 화면에서 조회합니다. 시험 생성·관리는 각 강의 > 차시에서 진행하세요."
    >
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <Breadcrumb
            path={breadcrumbPath.length > 1 ? breadcrumbPath : [{ id: null, name: "시험" }]}
            onSelect={(id) => handleBreadcrumbSelect(id)}
          />
          <div className={styles.actions}>
            <Button intent="primary" size="sm" onClick={() => navigate("/admin/lectures")}>
              강의로 이동
            </Button>
          </div>
        </div>

        <div className={styles.body}>
          <aside className={styles.tree}>
            <LectureSessionTree
              lectures={lecturesWithSessions}
              currentSessionId={selectedSessionId}
              onSelectSession={setSelectedSessionId}
            />
          </aside>

          <div className={styles.gridWrap}>
            {isLoading ? (
              <div className={styles.placeholder}>불러오는 중…</div>
            ) : !selectedSessionId ? (
              <div className={styles.placeholder}>좌측에서 차시를 선택하세요</div>
            ) : examsLoading ? (
              <div className={styles.placeholder}>시험 목록 불러오는 중…</div>
            ) : exams.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                <EmptyState
                  scope="panel"
                  tone="empty"
                  title="이 차시에 시험이 없습니다"
                  description="강의 > 차시에서 시험을 추가할 수 있습니다."
                  actions={
                    selectedSession && (
                      <Button
                        intent="primary"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/admin/lectures/${selectedSession.lecture.id}/sessions/${selectedSession.session.id}/exams`
                          )
                        }
                      >
                        시험 관리
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <div className={styles.grid}>
                {selectedSession && (
                  <div
                    className={styles.item + " " + styles.itemAdd}
                    onClick={() =>
                      navigate(
                        `/admin/lectures/${selectedSession.lecture.id}/sessions/${selectedSession.session.id}/exams`
                      )
                    }
                    title="시험 추가/관리"
                  >
                    <FilePlus size={32} />
                    <span>추가</span>
                  </div>
                )}
                {exams.map((e) => (
                  <div
                    key={e.id}
                    className={styles.item}
                    onClick={() =>
                      selectedSession &&
                      navigate(
                        `/admin/lectures/${selectedSession.lecture.id}/sessions/${selectedSession.session.id}/exams?exam_id=${e.id}`
                      )
                    }
                  >
                    <FileText size={32} style={{ color: "var(--color-primary)" }} aria-hidden />
                    <span className={styles.itemLabel} title={e.title}>
                      {e.title || "—"}
                    </span>
                    <span className={styles.itemMeta}>{e.subject || "—"}</span>
                    <span className={styles.itemMeta}>{formatDate(e.created_at)}</span>
                    <span
                      className={styles.itemMeta}
                      style={{
                        color: e.is_active ? "var(--color-success)" : "var(--color-text-muted)",
                      }}
                    >
                      {e.is_active ? "활성" : "비활성"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DomainLayout>
  );
}

/**
 * PATH: src/features/exams/pages/ExamExplorerPage.tsx
 * 시험 — 좌(폴더 트리) | 우(탐색 영역)
 * 탭은 DomainLayout SSOT로 ExamDomainLayout에서 제공.
 */

import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { FilePlus, ClipboardList, FileCheck, FileClock, FileX } from "lucide-react";
import { Button, EmptyState, Badge } from "@/shared/ui/ds";
import Breadcrumb from "@admin/domains/storage/components/Breadcrumb";
import LectureSessionTree from "../components/LectureSessionTree";
import { fetchLectures, fetchSessions, sortSessionsByDateDesc, type Lecture, type Session } from "@admin/domains/lectures/api/sessions";
import { fetchExams } from "../api/exams.api";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
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

  // 첫 진입 시 첫 번째 차시 자동 선택
  useEffect(() => {
    if (selectedSessionId === null && lecturesWithSessions.length > 0) {
      for (const lec of lecturesWithSessions) {
        if (lec.sessions.length > 0) {
          setSelectedSessionId(lec.sessions[0].id);
          break;
        }
      }
    }
  }, [lecturesWithSessions, selectedSessionId]);

  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["admin-exams", selectedSessionId],
    queryFn: () => fetchExams({ session_id: selectedSessionId! }),
    enabled: Number.isFinite(selectedSessionId),
  });

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

  return (
    <div className={panelStyles.root}>
      <div className={panelStyles.toolbar}>
        <Breadcrumb
          path={breadcrumbPath.length > 1 ? breadcrumbPath : [{ id: null, name: "시험" }]}
          onSelect={(id) => handleBreadcrumbSelect(id)}
        />
        <div className={panelStyles.actions}>
          <Button intent="primary" size="sm" onClick={() => navigate("/admin/lectures")}>
            강의 목록
          </Button>
        </div>
      </div>
      <div className={panelStyles.body}>
        <aside data-guide="exams-tree" className={panelStyles.tree}>
          <div className={panelStyles.treeNavHeader}>
            <span className={panelStyles.treeNavTitle}>강의 · 차시</span>
          </div>
          <div className={panelStyles.treeScroll}>
            {lecturesLoading ? (
              <div className={panelStyles.placeholder}>
                <p className={panelStyles.placeholderTitle}>불러오는 중…</p>
              </div>
            ) : lecturesWithSessions.length === 0 ? (
              <div className={panelStyles.placeholder}>
                <p className={panelStyles.placeholderTitle}>강의가 없습니다</p>
                <p className={panelStyles.placeholderDesc}>
                  강의를 만든 뒤 차시를 추가하면 여기에 표시됩니다.
                </p>
              </div>
            ) : (
              <LectureSessionTree
                lectures={lecturesWithSessions}
                currentSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
              />
            )}
          </div>
        </aside>

        <div className={panelStyles.gridWrap}>
          {!selectedSessionId ? (
            <div className={panelStyles.placeholder}>
              <div className={panelStyles.placeholderIcon}>
                <ClipboardList size={28} />
              </div>
              <p className={panelStyles.placeholderTitle}>차시를 선택하세요</p>
              <p className={panelStyles.placeholderDesc}>
                왼쪽 목록에서 강의·차시를 선택하면 해당 차시의 시험을 확인할 수 있습니다.
              </p>
              <div className={panelStyles.placeholderSteps}>
                <div className={panelStyles.placeholderStep}>
                  <span className={panelStyles.placeholderStepNum}>1</span>
                  <span>좌측에서 강의 선택</span>
                </div>
                <div className={panelStyles.placeholderStep}>
                  <span className={panelStyles.placeholderStepNum}>2</span>
                  <span>차시 클릭</span>
                </div>
                <div className={panelStyles.placeholderStep}>
                  <span className={panelStyles.placeholderStepNum}>3</span>
                  <span>시험 확인·관리</span>
                </div>
              </div>
            </div>
          ) : examsLoading ? (
            <div className={panelStyles.placeholder}>
              <p className={panelStyles.placeholderTitle}>시험 목록 불러오는 중…</p>
            </div>
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
            <div className={styles.listWrap}>
              <div className={styles.listHeader}>
                <span className={styles.listCount}>{exams.length}건</span>
                {selectedSession && (
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
                )}
              </div>
              <div className={styles.list}>
                {exams.map((e) => {
                  const StatusIcon = e.status === "OPEN" ? FileCheck : e.status === "CLOSED" ? FileX : FileClock;
                  const statusTone = e.status === "OPEN" ? "success" : e.status === "CLOSED" ? "muted" : "warning";
                  const statusLabel = e.status === "OPEN" ? "진행 중" : e.status === "CLOSED" ? "마감" : "설정 중";
                  return (
                    <div
                      key={e.id}
                      className={styles.listItem}
                      onClick={() =>
                        selectedSession &&
                        navigate(
                          `/admin/lectures/${selectedSession.lecture.id}/sessions/${selectedSession.session.id}/exams?exam_id=${e.id}`
                        )
                      }
                    >
                      <div className={styles.listItemIcon} data-tone={statusTone}>
                        <StatusIcon size={20} />
                      </div>
                      <div className={styles.listItemBody}>
                        <div className={styles.listItemTitle}>{e.title || "—"}</div>
                        <div className={styles.listItemMeta}>
                          {e.subject && <span>{e.subject}</span>}
                          <span className={styles.metaDot} aria-hidden>·</span>
                          <span>만점 {e.max_score}</span>
                          {e.pass_score > 0 && (
                            <>
                              <span className={styles.metaDot} aria-hidden>·</span>
                              <span>합격 {e.pass_score}점</span>
                            </>
                          )}
                          <span className={styles.metaDot} aria-hidden>·</span>
                          <span>{formatDate(e.created_at)}</span>
                        </div>
                      </div>
                      <Badge variant="solid" tone={statusTone}>{statusLabel}</Badge>
                    </div>
                  );
                })}
                {selectedSession && (
                  <div
                    data-guide="exams-add"
                    className={styles.listItemAdd}
                    onClick={() =>
                      navigate(
                        `/admin/lectures/${selectedSession.lecture.id}/sessions/${selectedSession.session.id}/exams`
                      )
                    }
                  >
                    <FilePlus size={18} />
                    <span>시험 추가</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

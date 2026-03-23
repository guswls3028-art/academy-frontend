/**
 * PATH: src/features/exams/pages/ExamExplorerPage.tsx
 * 시험 — 좌(폴더 트리) | 우(탐색 영역) + 템플릿 관리 탭
 */

import { useState, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { FileText, FilePlus } from "lucide-react";
import { Button, EmptyState, Tabs } from "@/shared/ui/ds";
import { DomainLayout } from "@/shared/ui/domain";
import Breadcrumb from "@/features/storage/components/Breadcrumb";
import LectureSessionTree from "../components/LectureSessionTree";
import { fetchLectures, fetchSessions, sortSessionsByDateDesc, type Lecture, type Session } from "@/features/lectures/api/sessions";
import { fetchExams } from "../api/exams";
import panelStyles from "@/shared/ui/domain/PanelWithTreeLayout.module.css";
import styles from "../components/ExamExplorer.module.css";

const TemplateManagementPanel = lazy(() => import("../components/TemplateManagementPanel"));

type ExamExplorerTab = "by-session" | "templates";

const TAB_ITEMS = [
  { key: "by-session", label: "강의별 시험" },
  { key: "templates", label: "템플릿 관리" },
];

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
  const [activeTab, setActiveTab] = useState<ExamExplorerTab>("by-session");
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
    <DomainLayout title="시험">
      <div className={panelStyles.root}>
        <div className={panelStyles.toolbar}>
          <Tabs value={activeTab} items={TAB_ITEMS} onChange={(k) => setActiveTab(k as ExamExplorerTab)} />
          <div className={panelStyles.actions}>
            <Button intent="primary" size="sm" onClick={() => navigate("/admin/lectures")}>
              강의 목록
            </Button>
          </div>
        </div>

        {activeTab === "by-session" && (
          <div className={panelStyles.body}>
            <aside className={panelStyles.tree}>
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
                  <p className={panelStyles.placeholderTitle}>차시를 선택하세요</p>
                  <p className={panelStyles.placeholderDesc}>
                    왼쪽 목록에서 강의·차시를 선택하면 여기에 해당 차시의 시험 목록이 표시됩니다.
                  </p>
                  <p className={panelStyles.placeholderHint}>
                    시험 추가·관리는 강의 → 차시 → 시험 탭에서 진행하세요.
                  </p>
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
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
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
                        강의로 이동 · 시험 관리
                      </Button>
                    )}
                  </div>
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
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div className={panelStyles.gridWrap}>
            <Suspense fallback={<div className={panelStyles.placeholder}><p className={panelStyles.placeholderTitle}>불러오는 중…</p></div>}>
              <TemplateManagementPanel />
            </Suspense>
          </div>
        )}
      </div>
    </DomainLayout>
  );
}

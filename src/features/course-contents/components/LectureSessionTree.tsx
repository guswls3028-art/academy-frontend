// 강의·차시 폴더 트리 — 저장소 FolderTree와 유사한 구조

import { BookOpen, ChevronRight } from "lucide-react";
import type { Lecture } from "@/features/lectures/api/sessions";
import styles from "./LectureSessionTree.module.css";

export type SessionNode = {
  id: number;
  lecture: number;
  order: number;
  title: string;
  date?: string | null;
};

type LectureWithSessions = Lecture & { sessions: SessionNode[] };

type LectureSessionTreeProps = {
  lectures: LectureWithSessions[];
  selectedSessionId: number | null;
  selectedLectureId: number | null;
  onSelectLecture: (lectureId: number) => void;
  onSelectSession: (lectureId: number, sessionId: number) => void;
};

export default function LectureSessionTree({
  lectures,
  selectedSessionId,
  selectedLectureId,
  onSelectLecture,
  onSelectSession,
}: LectureSessionTreeProps) {
  const hasSelectedSession = selectedSessionId != null;
  const hasSelectedLecture = selectedLectureId != null;

  return (
    <div className={styles.root}>
      {lectures.length === 0 ? (
        <div className="text-[var(--color-text-muted)] text-sm py-4">
          강의가 없습니다
        </div>
      ) : (
        lectures.map((lecture) => {
          const isLectureActive = selectedLectureId === lecture.id && !hasSelectedSession;
          const sessions = lecture.sessions ?? [];

          return (
            <div key={lecture.id} className={styles.node}>
              <button
                type="button"
                className={styles.item + (isLectureActive ? " " + styles.itemActive : "")}
                onClick={() => onSelectLecture(lecture.id)}
              >
                <BookOpen size={16} />
                <span className="truncate" title={lecture.title || lecture.name}>
                  {lecture.title || lecture.name || `강의 ${lecture.id}`}
                </span>
              </button>
              {sessions.length > 0 && (
                <div className={styles.children}>
                  {sessions
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((session) => {
                      const isActive =
                        selectedSessionId === session.id && selectedLectureId === lecture.id;
                      const label = session.title || `차시 ${session.order ?? session.id}`;

                      return (
                        <div key={session.id} className={styles.node}>
                          <button
                            type="button"
                            className={
                              styles.item +
                              (isActive ? " " + styles.itemActive : "") +
                              " " +
                              styles.sessionLabel
                            }
                            onClick={() => onSelectSession(lecture.id, session.id)}
                          >
                            <ChevronRight size={14} style={{ flexShrink: 0 }} />
                            <span className="truncate" title={label}>
                              {label}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

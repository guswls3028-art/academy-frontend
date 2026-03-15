// 좌측 폴더 트리 — 시험/성적 공통: 강의명 > 1~n차시

import { FolderOpen } from "lucide-react";
import type { Lecture } from "@/features/lectures/api/sessions";
import type { Session } from "@/features/lectures/api/sessions";
import styles from "./LectureSessionTree.module.css";

type LectureWithSessions = Lecture & { sessions?: Session[] };

type Props = {
  lectures: LectureWithSessions[];
  currentSessionId: number | null;
  onSelectSession: (sessionId: number | null) => void;
};

function formatSessionTitle(s: Session): string {
  const title = (s.title ?? "").trim();
  const isSupplement = title.includes("보강");
  const label = isSupplement ? "보강" : `${s.order ?? 0}차시`;
  const date = s.date ? new Date(s.date).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "";
  return date ? `${label} ${date}` : label;
}

export default function LectureSessionTree({
  lectures,
  currentSessionId,
  onSelectSession,
}: Props) {
  return (
    <div className={styles.root}>
      {lectures.map((lec) => {
        const sessions = lec.sessions ?? [];
        return (
          <div key={lec.id} className={styles.node}>
            <div className={styles.lectureLabel}>
              <FolderOpen size={16} aria-hidden />
              <span>{lec.title || lec.name || "강의"}</span>
            </div>
            {sessions.length > 0 && (
              <div className={styles.children}>
                {sessions.map((s) => {
                  const isActive = currentSessionId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.item + (isActive ? " " + styles.itemActive : "")}
                      onClick={() => onSelectSession(s.id)}
                    >
                      <FolderOpen size={16} aria-hidden />
                      <span>{formatSessionTitle(s)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

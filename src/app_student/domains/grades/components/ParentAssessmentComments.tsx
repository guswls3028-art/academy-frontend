import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/auth/context/AuthContext";
import { getParentStudentId } from "@/shared/api/parentStudentSelection";
import { assessmentCommentQueryKeys, fetchParentComments, type ParentComment, type AssessmentKind } from "@/shared/api/assessmentComments";
import type { MyExamGradeSummary, MyHomeworkGradeSummary } from "../api/grades.api";

import styles from "./AssessmentFeedback.module.css";

const CommentContext = createContext<ParentComment[]>([]);

export function CommentText({ comment }: { comment: ParentComment }) {
  return <aside className={styles.comment} aria-label="학부모 코멘트"><strong>선생님 코멘트 · 학부모 전용</strong><p>{comment.text}</p><time dateTime={comment.updated_at}>{new Date(comment.updated_at).toLocaleDateString("ko-KR")} 작성·수정</time></aside>;
}

export function ParentAssessmentComment({ kind, assessmentId, sessionId }: { kind: AssessmentKind; assessmentId: number; sessionId: number | null | undefined }) {
  const comments = useContext(CommentContext);
  const comment = comments.find((item) => item.assessment_kind === kind && item.assessment_id === assessmentId && item.session_id === sessionId);
  return comment ? <CommentText comment={comment} /> : null;
}

export default function ParentAssessmentComments({ children, exams, homeworks }: { children: ReactNode; exams: MyExamGradeSummary[]; homeworks: MyHomeworkGradeSummary[] }) {
  const { user } = useAuthContext();
  const isParent = user?.tenantRole === "parent";
  const childId = isParent ? getParentStudentId() : null;
  const query = useQuery({ queryKey: assessmentCommentQueryKeys.parent(user?.id, childId), queryFn: fetchParentComments, enabled: isParent });
  const comments = isParent ? query.data ?? [] : [];
  const unscored = comments.filter((comment) => !(comment.assessment_kind === "exam" ? exams.some((item) => item.exam_id === comment.assessment_id && item.session_id === comment.session_id) : homeworks.some((item) => item.homework_id === comment.assessment_id && item.session_id === comment.session_id)));
  return <CommentContext.Provider value={comments}>
    {isParent && query.isPending && <p role="status">학부모 코멘트를 불러오는 중…</p>}
    {isParent && query.isError && <div role="alert" className={styles.error}>학부모 코멘트를 불러오지 못했습니다. <button type="button" onClick={() => void query.refetch()}>다시 시도</button></div>}
    {children}
    {unscored.length > 0 && <section aria-label="성적 입력 전 학부모 코멘트">{unscored.map((comment) => <div key={`${comment.session_id}-${comment.assessment_kind}-${comment.assessment_id}`}><h3>{comment.assessment_title} · {comment.session_title}</h3><CommentText comment={comment} /></div>)}</section>}
  </CommentContext.Provider>;
}

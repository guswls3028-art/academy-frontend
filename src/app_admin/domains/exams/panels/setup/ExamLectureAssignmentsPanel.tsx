import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, School, Target, Users } from "lucide-react";

import { fetchLectures, fetchSessions } from "@/shared/api/contracts/sessions";
import { Badge, Button, EmptyState, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import AdminModal from "@/shared/ui/modal/AdminModal";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  attachExamSession,
  fetchExamLectureAssignments,
  updateExamLectureCutoff,
  type ExamLectureAssignment,
} from "../../api/examLectureAssignments";
import { adminExamsQueryKeys } from "../../queryKeys";
import styles from "./ExamLectureAssignmentsPanel.module.css";


export default function ExamLectureAssignmentsPanel({
  examId,
  maxScore,
}: {
  examId: number;
  maxScore: number;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lectureId, setLectureId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [passScore, setPassScore] = useState(0);

  const assignmentsQuery = useQuery({
    queryKey: adminExamsQueryKeys.examLectureAssignments(examId),
    queryFn: () => fetchExamLectureAssignments(examId),
    enabled: examId > 0,
  });
  const lecturesQuery = useQuery({
    queryKey: adminExamsQueryKeys.examAssignmentLectures(),
    queryFn: () => fetchLectures({ is_active: true }),
  });
  const sessionsQuery = useQuery({
    queryKey: adminExamsQueryKeys.examAssignmentSessions(lectureId),
    queryFn: () => fetchSessions(lectureId!),
    enabled: lectureId != null,
  });

  const existingSessionIds = useMemo(
    () => new Set(
      (assignmentsQuery.data?.assignments ?? []).flatMap((assignment) =>
        assignment.sessions.map((session) => session.session_id)),
    ),
    [assignmentsQuery.data?.assignments],
  );
  const availableSessions = useMemo(
    () => (sessionsQuery.data ?? []).filter((session) => !existingSessionIds.has(session.id)),
    [existingSessionIds, sessionsQuery.data],
  );

  useEffect(() => {
    setSessionId(availableSessions[0]?.id ?? null);
  }, [availableSessions]);

  const attachMutation = useMutation({
    mutationFn: () => attachExamSession(examId, {
      session_id: sessionId!,
      pass_score: passScore,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.examLectureAssignments(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamResultsRoot(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.examEnrollmentRoot(examId) }),
      ]);
      feedback.success("강의를 연결하고 현재 활성 명단을 시험 대상에 합쳤습니다.");
      setOpen(false);
    },
    onError: (error) => feedback.error(
      extractApiError(error, "강의를 연결하지 못했습니다."),
    ),
  });

  const openAddModal = () => {
    const firstLectureId = lecturesQuery.data?.[0]?.id ?? null;
    const firstAssignment = assignmentsQuery.data?.assignments.find(
      (assignment) => assignment.lecture_id === firstLectureId,
    );
    setLectureId(firstLectureId);
    setSessionId(null);
    setPassScore(
      firstAssignment?.pass_score
        ?? assignmentsQuery.data?.default_pass_score
        ?? 0,
    );
    setOpen(true);
  };

  const payload = assignmentsQuery.data;

  return (
    <section id="assessment-lecture-assignments" className={styles.panel}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>SHARED EXAM</span>
          <h2>시험을 보는 강의</h2>
          <p>문제와 답안은 하나로 두고, 강의별 명단과 귀가 기준 점수만 따로 운영합니다.</p>
        </div>
        <Button
          type="button"
          intent="primary"
          size="sm"
          leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />}
          onClick={openAddModal}
        >
          강의 추가
        </Button>
      </header>

      {assignmentsQuery.isLoading ? (
        <EmptyState scope="panel" tone="loading" title="연결된 강의를 확인하는 중…" />
      ) : assignmentsQuery.isError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="연결된 강의를 불러오지 못했습니다."
          actions={<Button type="button" intent="secondary" size="sm" onClick={() => void assignmentsQuery.refetch()}>다시 시도</Button>}
        />
      ) : (
        <>
          <div className={styles.summary}>
            <span><School size={ICON.sm} /> {payload?.assignments?.length ?? 0}개 강의</span>
            <span><Users size={ICON.sm} /> 대상 {payload?.total_selected_count ?? 0}명</span>
            <small>연결 차시 활성 명단 {payload?.total_roster_count ?? 0}명 기준</small>
          </div>
          <div className={styles.lanes}>
            {(payload?.assignments ?? []).map((assignment) => (
              <LectureLane
                key={assignment.lecture_id}
                examId={examId}
                maxScore={maxScore}
                assignment={assignment}
              />
            ))}
          </div>
        </>
      )}

      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        closeDisabled={attachMutation.isPending}
        onEnterConfirm={() => {
          if (sessionId != null && !attachMutation.isPending) attachMutation.mutate();
        }}
      >
        <ModalHeader
          title="이 시험에 강의 추가"
          description="강의의 실제 시험 차시를 고르면 활성 수강생이 시험 대상에 자동으로 합쳐집니다."
        />
        <ModalBody>
          <div className={styles.formGrid}>
            <label>
              <span>강의</span>
              <select
                value={lectureId ?? ""}
                onChange={(event) => {
                  const nextLectureId = Number(event.target.value) || null;
                  const existingAssignment = assignmentsQuery.data?.assignments.find(
                    (assignment) => assignment.lecture_id === nextLectureId,
                  );
                  setLectureId(nextLectureId);
                  setPassScore(
                    existingAssignment?.pass_score
                      ?? assignmentsQuery.data?.default_pass_score
                      ?? 0,
                  );
                }}
              >
                <option value="">강의를 선택하세요</option>
                {(lecturesQuery.data ?? []).map((lecture) => (
                  <option key={lecture.id} value={lecture.id}>{lecture.title}</option>
                ))}
              </select>
            </label>
            <label>
              <span>시험 차시</span>
              <select
                value={sessionId ?? ""}
                disabled={lectureId == null || sessionsQuery.isLoading}
                onChange={(event) => setSessionId(Number(event.target.value) || null)}
              >
                <option value="">차시를 선택하세요</option>
                {availableSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.display_label ?? `${session.order}차시`} · {session.title}
                  </option>
                ))}
              </select>
              {lectureId != null && !sessionsQuery.isLoading && availableSessions.length === 0 && (
                <small>추가할 수 있는 미연결 차시가 없습니다.</small>
              )}
            </label>
            <label>
              <span>이 강의 귀가 기준</span>
              <div className={styles.scoreInput}>
                <input
                  type="number"
                  min={0}
                  max={maxScore}
                  step="0.5"
                  value={passScore}
                  onChange={(event) => setPassScore(Number(event.target.value))}
                />
                <b>점</b>
              </div>
              <small>이 값은 다른 강의의 기준을 바꾸지 않습니다.</small>
            </label>
          </div>
        </ModalBody>
        <ModalFooter
          right={(
            <>
              <Button type="button" intent="secondary" onClick={() => setOpen(false)}>취소</Button>
              <Button
                type="button"
                intent="primary"
                loading={attachMutation.isPending}
                disabled={sessionId == null || !Number.isFinite(passScore) || passScore < 0 || passScore > maxScore}
                onClick={() => attachMutation.mutate()}
              >
                강의 연결
              </Button>
            </>
          )}
        />
      </AdminModal>
    </section>
  );
}


function LectureLane({
  examId,
  maxScore,
  assignment,
}: {
  examId: number;
  maxScore: number;
  assignment: ExamLectureAssignment;
}) {
  const queryClient = useQueryClient();
  const [score, setScore] = useState(assignment.pass_score);
  useEffect(() => setScore(assignment.pass_score), [assignment.pass_score]);

  const mutation = useMutation({
    mutationFn: () => updateExamLectureCutoff(examId, {
      lecture_id: assignment.lecture_id,
      pass_score: score,
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.examLectureAssignments(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamResultsRoot(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamSummary(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamDetailRoot(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.sessionScoresRoot() }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.clinicTargetsRoot() }),
      ]);
      feedback.success(`${assignment.lecture_title} 기준 점수를 저장했습니다.`);
    },
    onError: (error) => feedback.error(
      extractApiError(error, "기준 점수를 저장하지 못했습니다."),
    ),
  });

  const chip = assignment.lecture_chip_label?.trim()
    || assignment.lecture_title.trim().slice(0, 2);

  return (
    <article className={styles.lane} style={{ "--lane-color": assignment.lecture_color || "var(--color-primary)" } as CSSProperties}>
      <div className={styles.laneIdentity}>
        <span className={styles.lectureChip}>{chip}</span>
        <div>
          <h3>{assignment.lecture_title}</h3>
          <p>{assignment.sessions.map((session) => session.section_label
            ? `${session.session_label} ${session.section_label}반`
            : session.session_label).join(" · ")}</p>
        </div>
      </div>
      <div className={styles.laneCounts}>
        <Badge tone="neutral">명단 {assignment.selected_count}/{assignment.roster_count}명</Badge>
      </div>
      <div className={styles.cutoffEditor}>
        <Target size={ICON.sm} aria-hidden />
        <label>
          <span>귀가 기준</span>
          <input
            type="number"
            min={0}
            max={maxScore}
            step="0.5"
            value={score}
            aria-label={`${assignment.lecture_title} 귀가 기준 점수`}
            onChange={(event) => setScore(Number(event.target.value))}
          />
        </label>
        <b>점</b>
        <Button
          type="button"
          intent="secondary"
          size="sm"
          loading={mutation.isPending}
          disabled={!Number.isFinite(score) || score < 0 || score > maxScore || score === assignment.pass_score}
          onClick={() => mutation.mutate()}
        >
          저장
        </Button>
      </div>
    </article>
  );
}

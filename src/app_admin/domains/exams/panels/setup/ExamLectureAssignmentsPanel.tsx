import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, School, Target, Users } from "lucide-react";

import { fetchLectures, fetchSessions } from "@/shared/api/contracts/sessions";
import LectureChipLabel from "@/shared/ui/chips/LectureChipLabel";
import { Badge, Button, EmptyState, ICON, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import AdminModal from "@/shared/ui/modal/AdminModal";
import ModalBody from "@/shared/ui/modal/ModalBody";
import ModalFooter from "@/shared/ui/modal/ModalFooter";
import ModalHeader from "@/shared/ui/modal/ModalHeader";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import { formatSessionLabel } from "@/shared/product/sessions/sessionOrdering";
import {
  attachExamSession,
  fetchExamLectureAssignments,
  updateExamLectureCutoff,
  type ExamLectureAssignment,
} from "../../api/examLectureAssignments";
import { adminExamsQueryKeys } from "../../queryKeys";
import styles from "./ExamLectureAssignmentsPanel.module.css";

type QueuedLink = { lectureId: number; sessionId: number; passScore: number; label: string };

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
  const [selectedSessionIds, setSelectedSessionIds] = useState<number[]>([]);
  const [passScore, setPassScore] = useState<number | "">(0);
  const [pendingLinks, setPendingLinks] = useState<QueuedLink[]>([]);
  const [lectureSearch, setLectureSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  const assignmentsQuery = useQuery({
    queryKey: adminExamsQueryKeys.examLectureAssignments(examId),
    queryFn: () => fetchExamLectureAssignments(examId),
    enabled: examId > 0,
  });
  const lecturesQuery = useQuery({
    queryKey: adminExamsQueryKeys.examAssignmentLectures(),
    queryFn: () => fetchLectures({ is_active: true }),
    enabled: open,
  });
  const sessionsQuery = useQuery({
    queryKey: adminExamsQueryKeys.examAssignmentSessions(lectureId),
    queryFn: () => fetchSessions(lectureId!),
    enabled: open && lectureId != null,
  });

  const existingSessionIds = useMemo(
    () => new Set(
      (assignmentsQuery.data?.assignments ?? []).flatMap((assignment) =>
        assignment.sessions.map((session) => session.session_id)),
    ),
    [assignmentsQuery.data?.assignments],
  );
  const availableSessions = useMemo(
    () => lectureId == null ? [] : (sessionsQuery.data ?? []).filter((session) =>
      !existingSessionIds.has(session.id) && !pendingLinks.some((link) => link.sessionId === session.id)),
    [existingSessionIds, lectureId, pendingLinks, sessionsQuery.data],
  );

  useEffect(() => {
    const availableIds = new Set(availableSessions.map((session) => session.id));
    setSelectedSessionIds((current) => current.filter((id) => availableIds.has(id)));
  }, [availableSessions]);

  const lectures = lecturesQuery.data ?? [];
  const selectedLecture = lectures.find((lecture) => lecture.id === lectureId);
  const search = lectureSearch.trim().toLocaleLowerCase();
  const visibleLectures = lectures.filter((lecture) =>
    [lecture.title, lecture.name, lecture.chip_label].some((text) => text?.toLocaleLowerCase().includes(search)));
  const validCurrentScore = passScore !== "" && Number.isFinite(passScore) && passScore >= 0 && passScore <= maxScore;
  const currentLinks: QueuedLink[] = selectedLecture && validCurrentScore ? availableSessions
    .filter((session) => selectedSessionIds.includes(session.id))
    .map((session) => ({
      lectureId: selectedLecture.id,
      sessionId: session.id,
      passScore,
      label: `${selectedLecture.title} · ${formatSessionLabel(session)}`,
    })) : [];
  const queued = currentLinks.length > 0 && validCurrentScore
    ? pendingLinks.map((link) => link.lectureId === lectureId ? { ...link, passScore } : link)
    : pendingLinks;
  const linksToAttach = [...queued, ...currentLinks];
  const canAttach = linksToAttach.length > 0 && (selectedSessionIds.length === 0 || validCurrentScore);

  const queueCurrentLinks = () => {
    if (!validCurrentScore || currentLinks.length === 0) return;
    setPendingLinks(linksToAttach);
    setSelectedSessionIds([]);
    setLectureId(null);
    setLectureSearch("");
    setPassScore(assignmentsQuery.data?.default_pass_score ?? 0);
  };

  const attachMutation = useMutation({
    mutationFn: async () => {
      const completed: QueuedLink[] = [];
      const failed: QueuedLink[] = [];
      let lastError: unknown;
      for (const link of linksToAttach) {
        try {
          await attachExamSession(examId, { session_id: link.sessionId, pass_score: link.passScore });
          completed.push(link);
        } catch (error) {
          failed.push(link);
          lastError = error;
        }
      }
      return { completed, failed, lastError };
    },
    onSuccess: async ({ completed, failed, lastError }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.examLectureAssignments(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamResultsRoot(examId) }),
        queryClient.invalidateQueries({ queryKey: adminExamsQueryKeys.examEnrollmentRoot(examId) }),
      ]);
      if (failed.length > 0) {
        setPendingLinks(failed);
        setSelectedSessionIds([]);
        setLectureId(null);
        feedback.error(`${completed.length}개 차시 연결 완료, ${failed.length}개 실패. ${extractApiError(lastError, "실패한 차시를 다시 시도해 주세요.")}`);
        return;
      }
      feedback.success(`${completed.length}개 차시를 연결하고 현재 활성 명단을 시험 대상에 합쳤습니다.`);
      setPendingLinks([]);
      setOpen(false);
    },
  });

  const openAddModal = () => {
    setLectureId(null);
    setSelectedSessionIds([]);
    setPendingLinks([]);
    setLectureSearch("");
    setPassScore(assignmentsQuery.data?.default_pass_score ?? 0);
    setOpen(true);
  };

  const chooseLecture = (nextId: number) => {
    if (selectedSessionIds.length > 0 && !validCurrentScore) return;
    if (currentLinks.length > 0) {
      setPendingLinks(linksToAttach);
    }
    const previous = pendingLinks.find((link) => link.lectureId === nextId);
    const existing = assignmentsQuery.data?.assignments.find((item) => item.lecture_id === nextId);
    setPassScore(previous?.passScore ?? existing?.pass_score ?? assignmentsQuery.data?.default_pass_score ?? 0);
    setSelectedSessionIds([]);
    setLectureId(nextId);
  };

  const payload = assignmentsQuery.data;

  return (
    <section id="assessment-lecture-assignments" className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>시험을 보는 강의</h2>
          <p>문제와 답안은 하나로 두고, 강의별 명단과 귀가 기준 점수만 따로 운영합니다.</p>
        </div>
        <Button
          type="button"
          intent="primary"
          size="sm"
          leftIcon={<Plus size={ICON_FOR_BUTTON.sm} />}
          disabled={!assignmentsQuery.isSuccess}
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
          if (searchInput.current && document.activeElement === searchInput.current) return;
          if (canAttach && !attachMutation.isPending) attachMutation.mutate();
        }}
      >
        <ModalHeader
          title="이 시험에 강의 추가"
          description="강의를 고른 뒤 시험 차시를 여러 개 선택할 수 있습니다. 연결하면 활성 수강생이 시험 대상에 합쳐집니다."
        />
        <ModalBody>
          <fieldset className={styles.formGrid} disabled={attachMutation.isPending}>
            <fieldset className={styles.lectureSelect}>
              <legend>강의 선택</legend>
              {lectures.length > 5 && (
                <input ref={searchInput} type="search" aria-label="강의 검색" placeholder="강의명 또는 딱지로 검색"
                  value={lectureSearch} onChange={(event) => setLectureSearch(event.target.value)} />
              )}
              <div className={styles.lectureList}>
                {visibleLectures.map((lecture) => (
                  <label key={lecture.id} className={styles.lectureOption}>
                    <input type="radio" name={`exam-${examId}-lecture`} aria-label={lecture.title}
                      checked={lectureId === lecture.id} onChange={() => chooseLecture(lecture.id)} />
                    <LectureChipLabel lectureName={lecture.title} chipLabel={lecture.chip_label} color={lecture.color} />
                  </label>
                ))}
              </div>
              {lecturesQuery.isLoading && <small role="status">강의 목록을 불러오는 중입니다.</small>}
              {lecturesQuery.isError && <Button type="button" intent="secondary" size="sm" onClick={() => void lecturesQuery.refetch()}>강의 다시 불러오기</Button>}
              {lecturesQuery.isSuccess && visibleLectures.length === 0 && (
                <small role="status">{search ? "검색한 강의가 없습니다." : "추가할 수 있는 활성 강의가 없습니다."}</small>
              )}
            </fieldset>
            <div className={styles.sessionSelect} role="group" aria-label="시험 차시 선택">
              <div className={styles.sessionSelectHeader}>
                <strong>시험 차시 <small>{selectedSessionIds.length}개 선택</small></strong>
                {availableSessions.length > 1 && (
                  <Button type="button" intent="ghost" size="sm" onClick={() => setSelectedSessionIds(
                    selectedSessionIds.length === availableSessions.length ? [] : availableSessions.map((session) => session.id)
                  )}>
                    {selectedSessionIds.length === availableSessions.length ? "전체 해제" : "전체 선택"}
                  </Button>
                )}
              </div>
              {lectureId === null && <small>강의를 선택하면 연결할 차시가 표시됩니다.</small>}
              {lectureId !== null && sessionsQuery.isLoading && <small role="status">차시를 불러오는 중입니다.</small>}
              {sessionsQuery.isError && <Button type="button" intent="secondary" size="sm" onClick={() => void sessionsQuery.refetch()}>차시 다시 불러오기</Button>}
              {availableSessions.map((session) => (
                <label key={session.id} className={styles.sessionOption}>
                  <input type="checkbox" checked={selectedSessionIds.includes(session.id)} onChange={() => setSelectedSessionIds((current) =>
                    current.includes(session.id) ? current.filter((id) => id !== session.id) : [...current, session.id]
                  )} />
                  <span>{formatSessionLabel(session)}</span>
                </label>
              ))}
              {lectureId != null && sessionsQuery.isSuccess && availableSessions.length === 0 && (
                <small>추가할 수 있는 미연결 차시가 없습니다.</small>
              )}
            </div>
            {selectedLecture && (
              <label>
                <span>{selectedLecture.title} 귀가 기준</span>
                <div className={styles.scoreInput}>
                  <input type="number" min={0} max={maxScore} step="0.5" value={passScore}
                    onChange={(event) => setPassScore(event.target.value === "" ? "" : event.target.valueAsNumber)} />
                  <b>점</b>
                </div>
                {!validCurrentScore && <small role="alert">0점에서 {maxScore}점 사이로 입력해 주세요.</small>}
              </label>
            )}
            {currentLinks.length > 0 && (
              <Button type="button" intent="secondary" size="sm" disabled={!validCurrentScore} onClick={queueCurrentLinks}>
                선택한 차시 담고 다른 강의 고르기
              </Button>
            )}
            {pendingLinks.length > 0 && (
              <div className={styles.queue} role="list" aria-label="연결 예정 차시">
                <strong>연결 예정 · {pendingLinks.length}개 차시</strong>
                {queued.map((link) => (
                  <div key={link.sessionId} role="listitem">
                    <span>{link.label} · 귀가 기준 {link.passScore}점</span>
                    <Button type="button" intent="ghost" size="sm" onClick={() => setPendingLinks((current) => current.filter((item) => item.sessionId !== link.sessionId))}>제외</Button>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
        </ModalBody>
        <ModalFooter
          right={(
            <>
              <Button type="button" intent="secondary" disabled={attachMutation.isPending} onClick={() => setOpen(false)}>취소</Button>
              <Button
                type="button"
                intent="primary"
                loading={attachMutation.isPending}
                disabled={!canAttach}
                onClick={() => attachMutation.mutate()}
              >
                {linksToAttach.length}개 차시 연결
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

  return (
    <article className={styles.lane} style={{ "--lane-color": assignment.lecture_color || "var(--color-primary)" } as CSSProperties}>
      <div className={styles.laneIdentity}>
        <h3 aria-label={assignment.lecture_title}>
          <LectureChipLabel lectureName={assignment.lecture_title} chipLabel={assignment.lecture_chip_label} color={assignment.lecture_color} />
        </h3>
        <p>{assignment.sessions.map((session) => session.section_label
          ? `${session.session_label} ${session.section_label}반`
          : session.session_label).join(" · ")}</p>
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

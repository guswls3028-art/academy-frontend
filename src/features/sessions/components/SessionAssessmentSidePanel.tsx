// PATH: src/features/sessions/components/SessionAssessmentSidePanel.tsx

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import { fetchAdminSessionExams } from "@/features/results/api/adminSessionExams";

import CreateRegularExamModal
  from "@/features/exams/components/create/CreateRegularExamModal";

import CreateHomeworkModal
  from "@/features/homework/components/CreateHomeworkModal";

import { deleteSessionExam }
  from "@/features/sessions/api/deleteSessionExam";
import { deleteSessionHomework }
  from "@/features/sessions/api/deleteSessionHomework";

type Props = {
  lectureId: number;
  sessionId: number;
};

type HomeworkItem = {
  id: number;
  title: string;
  status?: string;
};

export default function SessionAssessmentSidePanel({
  lectureId,
  sessionId,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ===============================
  // 선택 단일 진실
  // ===============================
  const examId = useMemo(() => {
    const v = Number(searchParams.get("examId"));
    return Number.isFinite(v) ? v : null;
  }, [searchParams]);

  const homeworkId = useMemo(() => {
    const v = Number(searchParams.get("homeworkId"));
    return Number.isFinite(v) ? v : null;
  }, [searchParams]);

  const clearQuery = (key: "examId" | "homeworkId") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      return next;
    });
  };

  // ===============================
  // 시험 목록 (results 단일진실)
  // ===============================
  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["admin-session-exams", sessionId],
    queryFn: () => fetchAdminSessionExams(sessionId),
    enabled: !!sessionId,
  });

  // ===============================
  // 과제 목록
  // ===============================
  const { data: homeworks = [], isLoading: hwLoading } = useQuery({
    queryKey: ["session-homeworks", sessionId],
    queryFn: async (): Promise<HomeworkItem[]> => {
      const res = await api.get("/homeworks/", {
        params: { session_id: sessionId },
      });

      const arr =
        res.data?.results ??
        res.data?.items ??
        res.data ??
        [];

      return arr.map((x: any) => ({
        id: Number(x.id),
        title: String(x.title ?? ""),
        status: x.status,
      }));
    },
    enabled: !!sessionId,
  });

  // ===============================
  // 생성 모달 상태
  // ===============================
  const [openCreateExam, setOpenCreateExam] = useState(false);
  const [openCreateHomework, setOpenCreateHomework] = useState(false);

  const base = `/admin/lectures/${lectureId}/sessions/${sessionId}`;

  const invalidateExams = () =>
    qc.invalidateQueries({ queryKey: ["admin-session-exams", sessionId] });

  const invalidateHomeworks = () =>
    qc.invalidateQueries({ queryKey: ["session-homeworks", sessionId] });

  const onSelectExam = (id: number) => {
    navigate({
      pathname: `${base}/exams`,
      search: `?examId=${id}`,
    });
  };

  const onSelectHomework = (id: number) => {
    navigate({
      pathname: `${base}/assignments`,
      search: `?homeworkId=${id}`,
    });
  };

  const handleDeleteExam = async (id: number) => {
    await deleteSessionExam(id);
    if (examId === id) clearQuery("examId");
    invalidateExams();
  };

  const handleDeleteHomework = async (id: number) => {
    await deleteSessionHomework(id);
    if (homeworkId === id) clearQuery("homeworkId");
    invalidateHomeworks();
  };

  return (
    <aside className="w-[220px] shrink-0 space-y-4 rounded border bg-white p-3">

      {/* ================= Exams ================= */}
      <Section title="시험" onAdd={() => setOpenCreateExam(true)}>

        {examsLoading && <Empty>불러오는 중...</Empty>}
        {!examsLoading && exams.length === 0 && <Empty>시험 없음</Empty>}

        {exams.map((exam: any) => {
          const active =
            examId != null &&
            Number(exam.exam_id) === examId;

          return (
            <ItemRow
              key={exam.exam_id}
              active={active}
              label={exam.title}
              sub={`exam_id: ${exam.exam_id}`}
              onClick={() => onSelectExam(Number(exam.exam_id))}
              onDelete={() => handleDeleteExam(Number(exam.exam_id))}
            />
          );
        })}
      </Section>

      {/* ================= Homework ================= */}
      <Section title="과제" onAdd={() => setOpenCreateHomework(true)}>

        {hwLoading && <Empty>불러오는 중...</Empty>}
        {!hwLoading && homeworks.length === 0 && <Empty>과제 없음</Empty>}

        {homeworks.map((hw) => {
          const active = homeworkId === hw.id;

          return (
            <ItemRow
              key={hw.id}
              active={active}
              label={hw.title}
              sub={hw.status ? `상태: ${hw.status}` : undefined}
              onClick={() => onSelectHomework(hw.id)}
              onDelete={() => handleDeleteHomework(hw.id)}
            />
          );
        })}
      </Section>

      {/* ================= Modals ================= */}

      <CreateRegularExamModal
        open={openCreateExam}
        onClose={() => setOpenCreateExam(false)}
        sessionId={sessionId}
        onCreated={(id) => {
          invalidateExams();
          onSelectExam(id);
        }}
      />

      <CreateHomeworkModal
        open={openCreateHomework}
        onClose={() => setOpenCreateHomework(false)}
        sessionId={sessionId}
        onCreated={(id) => {
          invalidateHomeworks();
          onSelectHomework(id);
        }}
      />
    </aside>
  );
}

/* ================= UI ================= */

function Section({
  title,
  onAdd,
  children,
}: any) {
  return (
    <div>
      <div className="mb-2 flex justify-between">
        <div className="text-xs font-semibold text-gray-500">
          {title}
        </div>

        <button
          onClick={onAdd}
          className="rounded bg-gray-100 px-2 py-1 text-xs"
        >
          + 추가
        </button>
      </div>

      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ItemRow({
  label,
  sub,
  onClick,
  onDelete,
  active,
}: any) {
  return (
    <div
      className={`flex rounded ${
        active ? "bg-blue-50" : "hover:bg-gray-50"
      }`}
    >
      <button
        onClick={onClick}
        className="flex-1 px-2 py-2 text-left"
      >
        <div className="text-sm">{label}</div>
        {sub && (
          <div className="text-xs text-gray-500">{sub}</div>
        )}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="px-2 text-red-500"
      >
        ✕
      </button>
    </div>
  );
}

function Empty({ children }: any) {
  return (
    <div className="px-2 py-2 text-xs text-gray-400">
      {children}
    </div>
  );
}

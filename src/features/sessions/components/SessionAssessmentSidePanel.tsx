// PATH: src/features/sessions/components/SessionAssessmentSidePanel.tsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/shared/api/axios";
import { fetchAdminSessionExams } from "@/features/results/api/adminSessionExams";

import CreateRegularExamModal from "@/features/exams/components/create/CreateRegularExamModal";
import CreateHomeworkModal from "@/features/homework/components/CreateHomeworkModal";

import { deleteSessionExam } from "@/features/sessions/api/deleteSessionExam";
import { deleteSessionHomework } from "@/features/sessions/api/deleteSessionHomework";

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

  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["admin-session-exams", sessionId],
    queryFn: () => fetchAdminSessionExams(sessionId),
    enabled: !!sessionId,
  });

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
    <aside
      style={{
        width: 220,
        borderRadius: 14,
        border: "1px solid var(--color-border-divider)",
        background: "var(--color-bg-surface)",
        padding: 12,
        display: "grid",
        gap: 16,
      }}
    >
      <PanelSection
        title="시험"
        onAdd={() => setOpenCreateExam(true)}
      >
        {examsLoading && <Empty>불러오는 중…</Empty>}
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
      </PanelSection>

      <PanelSection
        title="과제"
        onAdd={() => setOpenCreateHomework(true)}
      >
        {hwLoading && <Empty>불러오는 중…</Empty>}
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
      </PanelSection>

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

function PanelSection({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div
          className="text-xs font-extrabold"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {title}
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-semibold"
          style={{ color: "var(--color-primary)" }}
        >
          + 추가
        </button>
      </div>

      <div className="grid gap-2">{children}</div>
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
      className="flex items-center rounded"
      style={{
        background: active
          ? "var(--state-selected-bg)"
          : undefined,
      }}
    >
      <button
        onClick={onClick}
        className="flex-1 px-2 py-2 text-left"
        style={{ color: "var(--color-text-primary)" }}
      >
        <div className="text-sm font-medium">{label}</div>
        {sub && (
          <div
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {sub}
          </div>
        )}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="px-2 text-xs"
        style={{ color: "var(--color-error)" }}
      >
        ✕
      </button>
    </div>
  );
}

function Empty({ children }: any) {
  return (
    <div
      className="px-2 py-2 text-xs"
      style={{ color: "var(--color-text-muted)" }}
    >
      {children}
    </div>
  );
}

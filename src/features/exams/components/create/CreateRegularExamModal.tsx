// PATH: src/features/exams/components/create/CreateRegularExamModal.tsx
// ------------------------------------------------------------
// 시험 추가 모달 — 과제 생성 모달과 동일한 단순 플로우
// 템플릿 선택 + 시험 제목(+ 설명) 입력 후 바로 생성. 합격점·공개·마감은 생성 후 시험 상세에서 설정.
// ------------------------------------------------------------

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { updateAdminExam } from "@/features/exams/api/adminExam";
import { AdminModal, ModalHeader, ModalBody, ModalFooter, MODAL_WIDTH } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";

type ExamTemplate = {
  id: number;
  title: string;
  subject: string;
  hasAnswerKey?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  lectureId?: number;
  onCreated: (examId: number) => void;
};

async function checkAnswerKey(examId: number): Promise<boolean> {
  try {
    const res = await api.get("/exams/answer-keys/", { params: { exam: examId } });
    const d = res.data;
    const list = Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : d?.items ?? [];
    return list.length > 0;
  } catch {
    return false;
  }
}

function toLocalDatetime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function fromLocalDatetime(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function CreateRegularExamModal({
  open,
  onClose,
  sessionId,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [openAt, setOpenAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [passScore, setPassScore] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["exam-templates-with-answerkey"],
    queryFn: async (): Promise<ExamTemplate[]> => {
      const res = await api.get("/exams/", { params: { exam_type: "template" } });
      const data = res.data;
      const raw = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      const list = raw.map((t: any) => ({
        id: Number(t.id),
        title: String(t.title ?? ""),
        subject: String(t.subject ?? ""),
      }));
      const withKey = await Promise.all(
        list.map(async (t: ExamTemplate) => ({ ...t, hasAnswerKey: await checkAnswerKey(t.id) }))
      );
      return withKey;
    },
    enabled: open,
  });

  const selectableTemplates = templates.filter((t) => t.hasAnswerKey);
  const hasAnySelectable = selectableTemplates.length > 0;

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setTemplateId(null);
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setOpenAt(toLocalDatetime(now));
    setCloseAt(toLocalDatetime(end));
    setPassScore(60);
    setError(null);
    setSubmitting(false);
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("시험 제목을 입력하세요.");
      return;
    }
    if (!templateId) {
      setError("시험 템플릿을 선택하세요.");
      return;
    }
    if (!sessionId) {
      setError("세션 정보가 없습니다.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/exams/", {
        title: title.trim(),
        description: description.trim(),
        exam_type: "regular",
        template_exam_id: templateId,
        session_id: sessionId,
      });
      const newExamId = Number(res.data?.id);
      if (!newExamId) throw new Error("생성 후 ID를 받지 못했습니다.");

      const openDate = fromLocalDatetime(openAt);
      const closeDate = fromLocalDatetime(closeAt);
      await updateAdminExam(newExamId, {
        pass_score: passScore,
        allow_retake: false,
        max_attempts: 1,
        ...(openDate && { open_at: openDate.toISOString() }),
        ...(closeDate && { close_at: closeDate.toISOString() }),
      });

      await qc.invalidateQueries({ queryKey: ["exam-templates-with-answerkey"] });
      onCreated(newExamId);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "시험 생성 실패. 입력값을 확인하세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || !title.trim() || !templateId || !(sessionId > 0);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !disabled) {
        e.preventDefault();
        handleSubmit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, disabled]);

  if (!open) return null;

  return (
    <AdminModal open onClose={onClose} type="action" width={MODAL_WIDTH.default}>
      <ModalHeader
        type="action"
        title="시험 생성"
        description="이 차시에 배포할 시험의 템플릿과 제목을 입력하세요. 합격점·공개·마감은 생성 후 시험 상세에서 변경할 수 있습니다."
      />

      <ModalBody>
        <div className="modal-scroll-body modal-scroll-body--compact">
          {error && (
            <div className="modal-hint modal-hint--block" style={{ color: "var(--color-error)", fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div className="modal-form-group">
            <label className="modal-section-label">시험 템플릿 (필수)</label>
            <select
              className="ds-select"
              value={templateId ?? ""}
              onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : null)}
              aria-label="시험 템플릿 선택"
            >
              <option value="">
                {isLoading ? "불러오는 중…" : hasAnySelectable ? "선택하세요" : "사용 가능한 템플릿 없음"}
              </option>
              {selectableTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} {t.subject ? `(${t.subject})` : ""}
                </option>
              ))}
            </select>
            {!isLoading && templates.length === 0 && (
              <p className="modal-hint modal-hint--block">
                템플릿이 없습니다. 시험지 관리(자료 &gt; 시험지)에서 먼저 템플릿을 만드세요.
              </p>
            )}
          </div>

          <div className="modal-form-group">
            <label className="modal-section-label">시험 제목 (필수)</label>
            <input
              className="ds-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 3월 모의고사"
              autoFocus
              aria-label="시험 제목"
            />
            <label className="modal-section-label">설명 (선택)</label>
            <textarea
              className="ds-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="설명"
              aria-label="시험 설명"
            />
          </div>

          <div className="modal-form-group modal-form-group--neutral">
            <span className="modal-section-label">기본 운영 설정</span>
            <div className="modal-form-row modal-form-row--2">
              <div>
                <label className="modal-section-label">공개 일시</label>
                <input
                  type="datetime-local"
                  value={openAt}
                  onChange={(e) => setOpenAt(e.target.value)}
                  className="ds-input w-full"
                  aria-label="공개 일시"
                />
              </div>
              <div>
                <label className="modal-section-label">마감 일시</label>
                <input
                  type="datetime-local"
                  value={closeAt}
                  onChange={(e) => setCloseAt(e.target.value)}
                  className="ds-input w-full"
                  aria-label="마감 일시"
                />
              </div>
            </div>
            <div>
              <label className="modal-section-label">합격 점수</label>
              <input
                type="number"
                min={0}
                max={100}
                value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value) || 0)}
                className="ds-input"
                style={{ width: 80 }}
                aria-label="합격 점수"
              />
            </div>
          </div>

          <p className="modal-hint modal-hint--block">session_id: {sessionId}</p>
        </div>
      </ModalBody>

      <ModalFooter
        right={
          <>
            <Button intent="secondary" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            <Button intent="primary" onClick={handleSubmit} disabled={disabled}>
              {submitting ? "생성 중…" : "시험 생성"}
            </Button>
          </>
        }
      />
    </AdminModal>
  );
}

// PATH: src/features/exams/components/create/CreateRegularExamModal.tsx
// ------------------------------------------------------------------
// Regular Exam Create Modal (Production Grade - FINAL)
// ------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";

type ExamTemplate = {
  id: number;
  title: string;
  subject: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: number;
  onCreated: (examId: number) => void;
};

export default function CreateRegularExamModal({
  open,
  onClose,
  sessionId,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // -----------------------------------
  // ✅ Template 목록 조회 (핵심 수정)
  // -----------------------------------
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["exam-templates"],
    queryFn: async (): Promise<ExamTemplate[]> => {
      const res = await api.get("/exams/", {
        params: { exam_type: "template" },
      });

      const data = res.data;

      // 🔥 DRF pagination 대응
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.results)) return data.results;

      return [];
    },
    enabled: open,
  });

  // -----------------------------------
  // 초기화
  // -----------------------------------
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setTemplateId(null);
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  // -----------------------------------
  // 검증
  // -----------------------------------
  const validate = () => {
    if (!title.trim()) return "시험 제목을 입력하세요.";
    if (!templateId) return "템플릿 시험을 선택하세요.";
    if (!sessionId) return "세션 정보가 없습니다.";
    return null;
  };

  // -----------------------------------
  // 생성
  // -----------------------------------
  const handleSubmit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await api.post("/exams/", {
        title: title.trim(),
        description: description.trim(),
        exam_type: "regular",
        template_exam_id: templateId,
        session_id: sessionId,
      });

      const newExamId = res.data?.id;

      if (!newExamId) {
        throw new Error("생성은 되었으나 ID 반환 없음");
      }

      onCreated(Number(newExamId));
      onClose();
    } catch (e: any) {
      console.error(e);

      const msg =
        e?.response?.data?.detail ||
        "시험 생성 실패. 입력값을 확인하세요.";

      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------
  // UI
  // -----------------------------------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[480px] rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">
          운영 시험 생성
        </h2>

        <div className="space-y-4">
          {/* 제목 */}
          <div>
            <label className="text-sm font-medium">시험 제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="예: 3월 모의고사"
            />
          </div>

          {/* 템플릿 선택 */}
          <div>
            <label className="text-sm font-medium">
              시험 템플릿 (필수)
            </label>

            <select
              value={templateId ?? ""}
              onChange={(e) =>
                setTemplateId(Number(e.target.value))
              }
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">
                {isLoading ? "불러오는 중..." : "선택하세요"}
              </option>

              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.subject})
                </option>
              ))}
            </select>

            <p className="mt-1 text-xs text-gray-500">
              ※ 과목(subject)은 템플릿 시험 값을 따릅니다.
            </p>
          </div>

          {/* 설명 */}
          <div>
            <label className="text-sm font-medium">
              설명 (선택)
            </label>
            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          {/* 에러 */}
          {error && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded border px-4 py-2 text-sm"
              disabled={submitting}
            >
              취소
            </button>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitting ? "생성 중..." : "생성"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

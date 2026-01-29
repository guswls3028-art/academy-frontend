// PATH: src/features/results/components/WrongNotePanel.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchWrongNotes,
  createWrongNotePDF,
  fetchWrongNotePDFStatus,
  WrongNotePDFCreateResponse,
} from "../api/wrongNotes";

type Props = {
  enrollmentId: number;
  examId?: number;
};

export default function WrongNotePanel({ enrollmentId, examId }: Props) {
  const { data } = useQuery({
    queryKey: ["wrong-notes", enrollmentId, examId],
    queryFn: () =>
      fetchWrongNotes({
        enrollment_id: enrollmentId,
        exam_id: examId,
      }),
    enabled: Number.isFinite(enrollmentId),
  });

  // ==============================
  // PDF 생성 상태 관리
  // ==============================
  const [pdfJob, setPdfJob] =
    useState<WrongNotePDFCreateResponse | null>(null);
  const [pdfFileUrl, setPdfFileUrl] = useState<string>("");
  const [pdfError, setPdfError] = useState<string>("");

  const pdfMutation = useMutation({
    mutationFn: () =>
      createWrongNotePDF({
        enrollment_id: enrollmentId,
        exam_id: examId,
      }),
    onSuccess: (res) => {
      setPdfJob(res);
      setPdfFileUrl("");
      setPdfError("");
    },
    onError: (e: any) => {
      setPdfError(String(e?.message || "PDF 생성 요청 실패"));
    },
  });

  // ==============================
  // PDF 상태 polling
  // ==============================
  useEffect(() => {
    if (!pdfJob?.job_id) return;

    let stopped = false;
    const jobId = pdfJob.job_id;

    const tick = async () => {
      try {
        const st = await fetchWrongNotePDFStatus(jobId);

        if (st.status === "DONE") {
          if (!stopped) {
            setPdfFileUrl(st.file_url || "");
            setPdfError("");
          }
          return;
        }

        if (st.status === "FAILED") {
          if (!stopped) {
            setPdfError(st.error_message || "PDF 생성 실패");
          }
          return;
        }

        if (!stopped) {
          setTimeout(tick, 1500);
        }
      } catch (err: any) {
        if (!stopped) {
          setPdfError(
            String(err?.message || "PDF 상태 조회 실패")
          );
          setTimeout(tick, 2000);
        }
      }
    };

    tick();
    return () => {
      stopped = true;
    };
  }, [pdfJob]);

  const wrongList = useMemo(
    () => data?.results ?? [],
    [data]
  );

  return (
    <div className="mt-4 rounded border bg-gray-50 p-3">
      <div className="mb-2 text-sm font-semibold">
        오답노트
      </div>

      {!data || wrongList.length === 0 ? (
        <div className="text-xs text-gray-400">
          오답이 없습니다.
        </div>
      ) : (
        <ul className="space-y-1 text-xs">
          {wrongList.map((it) => (
            <li
              /**
               * 🔥 FIX: key에 index 사용 제거
               * - attempt_id + question_id 조합은 도메인적으로 유니크
               * - polling / refetch / pagination 에서도 안전
               */
              key={`${it.attempt_id}-${it.question_id}`}
            >
              Q{it.question_number ?? it.question_id} :{" "}
              {it.student_answer} → {it.correct_answer}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          className="rounded bg-purple-600 px-3 py-1 text-xs text-white disabled:opacity-50"
          onClick={() => pdfMutation.mutate()}
          disabled={pdfMutation.isPending}
        >
          {pdfMutation.isPending
            ? "요청 중..."
            : "PDF 생성"}
        </button>

        {pdfJob && !pdfFileUrl && !pdfError && (
          <span className="text-xs text-gray-500">
            PDF 생성 중... ({pdfJob.status})
          </span>
        )}

        {pdfError && (
          <span className="text-xs text-red-600">
            {pdfError}
          </span>
        )}

        {pdfFileUrl && (
          <a
            className="text-xs text-blue-600 underline"
            href={pdfFileUrl}
            target="_blank"
            rel="noreferrer"
          >
            PDF 다운로드
          </a>
        )}
      </div>
    </div>
  );
}

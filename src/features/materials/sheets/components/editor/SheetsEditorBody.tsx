// ====================================================================================================
// FILE: src/features/materials/sheets/components/editor/SheetsEditorBody.tsx
// ====================================================================================================
// SSOT ALIGN:
// - Materials(Sheets) 화면은 template Exam.id를 기준으로 편집한다.
// - Submissions 도메인 연동(제출 목록/수동수정/재시도)을 "Sheet 탭" 안에서 운영자가 처리할 수 있게 한다.
// - Submissions list: GET /submissions/exams/<exam_id>/
// - Manual edit: POST /submissions/submissions/<submission_id>/manual-edit/
// - Retry: POST /submissions/submissions/<submission_id>/retry/

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/shared/ui/feedback";
import {
  getSheetApi,
  getSheetQuestionsApi,
  getSheetAnswerKeyApi,
  patchSheetQuestionScoreApi,
  upsertSheetAnswerKeyApi,
  listExamAssetsApi,
  generateOmrSheetAssetApi,
  autoGenerateQuestionsApi,
  type SheetQuestionEntity,
} from "../../sheets.api";

import SheetsSubmissionsTab from "../submissions/SheetsSubmissionsTab";

const CHOICES = ["A", "B", "C", "D", "E"] as const;
const QUESTION_COUNTS = [10, 20, 30] as const;

type TabKey = "editor" | "submissions";

export default function SheetsEditorBody({ sheetId }: { sheetId: number }) {
  const id = Number(sheetId); // ✅ 실제로는 template Exam.id
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>("editor");

  const sheetQ = useQuery({
    queryKey: ["materials-sheet", id],
    queryFn: () => getSheetApi(id),
    enabled: id > 0,
  });

  const qQ = useQuery({
    queryKey: ["materials-sheet-questions", id],
    queryFn: () => getSheetQuestionsApi(id),
    enabled: id > 0,
  });

  const akQ = useQuery({
    queryKey: ["materials-sheet-answerkey", id],
    queryFn: () => getSheetAnswerKeyApi(id),
    enabled: id > 0,
  });

  const assetsQ = useQuery({
    queryKey: ["materials-sheet-assets", id],
    queryFn: () => listExamAssetsApi(id),
    enabled: id > 0,
  });

  const questions = useMemo(
    () => (qQ.data ?? []).slice().sort((a, b) => a.number - b.number),
    [qQ.data]
  );

  // ✅ AnswerKey payload: key=ExamQuestion.id (string)
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // ✅ 서버에서 내려온 answer key를 최초/재조회 시 반영 (사용자 입력을 덮어쓰지 않도록 단순 merge)
  useEffect(() => {
    const server = akQ.data?.answers;
    if (!server || typeof server !== "object") return;

    setAnswers((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const [k, v] of Object.entries(server)) {
        if (next[k] == null || String(next[k]).length === 0) {
          next[String(k)] = String(v);
        }
      }
      return next;
    });
  }, [akQ.data?.id]);

  const [omrQuestionCount, setOmrQuestionCount] = useState<(typeof QUESTION_COUNTS)[number]>(20);

  const scoreMut = useMutation({
    mutationFn: patchSheetQuestionScoreApi,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials-sheet-questions", id] }),
    onError: (e: any) => alert(e?.message || "배점 저장 실패"),
  });

  const answerKeyMut = useMutation({
    mutationFn: upsertSheetAnswerKeyApi,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials-sheet-answerkey", id] }),
    onError: (e: any) => alert(e?.message || "정답 저장 실패"),
  });

  const autoGenMut = useMutation({
    mutationFn: autoGenerateQuestionsApi,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials-sheet-questions", id] }),
    onError: (e: any) => alert(e?.message || "문항 자동 복구 실패"),
  });

  const genOmrMut = useMutation({
    mutationFn: generateOmrSheetAssetApi,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials-sheet-assets", id] }),
    onError: (e: any) => alert(e?.message || "OMR 생성 실패"),
  });

  if (id <= 0) {
    return <EmptyState title="잘못된 접근" message="유효하지 않은 시험지입니다." />;
  }

  if (sheetQ.isLoading || qQ.isLoading) {
    return <div className="p-4 text-sm">불러오는 중...</div>;
  }

  if (sheetQ.isError || qQ.isError) {
    return (
      <div className="p-4">
        <EmptyState title="불러오기 실패" message="시험지 정보를 불러오지 못했습니다." />
      </div>
    );
  }

  const assets = assetsQ.data ?? [];
  const omr = assets.find((a) => a.asset_type === "omr_sheet");
  const problem = assets.find((a) => a.asset_type === "problem_pdf");

  return (
    <div className="p-6 space-y-6">
      {/* TOP HEADER */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-lg font-bold">{sheetQ.data?.title}</div>
          <div className="text-xs text-gray-500">과목: {sheetQ.data?.subject}</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">OMR 문항수</span>
            <div className="flex gap-2">
              {QUESTION_COUNTS.map((qc2) => (
                <button
                  key={qc2}
                  type="button"
                  className={`btn ${omrQuestionCount === qc2 ? "bg-black text-white" : ""}`}
                  onClick={() => setOmrQuestionCount(qc2)}
                >
                  {qc2}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn"
            disabled={autoGenMut.isPending}
            onClick={() =>
              autoGenMut.mutate({
                templateExamId: id,
                questionCount: omrQuestionCount,
              })
            }
          >
            {autoGenMut.isPending ? "복구 중..." : "문항 자동 복구"}
          </button>

          <button
            className="btn-primary"
            disabled={genOmrMut.isPending}
            onClick={() =>
              genOmrMut.mutate({
                templateExamId: id,
                questionCount: omrQuestionCount,
              })
            }
          >
            {genOmrMut.isPending ? "생성 중..." : "OMR 생성"}
          </button>
        </div>
      </div>

      {/* LOCAL TABS */}
      <div className="flex items-center gap-2 border-b pb-2">
        <button
          type="button"
          className={`btn ${tab === "editor" ? "bg-black text-white" : ""}`}
          onClick={() => setTab("editor")}
        >
          편집
        </button>
        <button
          type="button"
          className={`btn ${tab === "submissions" ? "bg-black text-white" : ""}`}
          onClick={() => setTab("submissions")}
        >
          제출
        </button>
      </div>

      {/* TAB: SUBMISSIONS */}
      {tab === "submissions" && (
        <div className="surface p-4 rounded-xl border">
          <SheetsSubmissionsTab
            examId={id}
            sheetTitle={String(sheetQ.data?.title || "")}
            questions={questions}
          />
        </div>
      )}

      {/* TAB: EDITOR */}
      {tab === "editor" && (
        <div className="space-y-8">
          {/* QUESTIONS */}
          <div className="space-y-3">
            <div className="text-sm font-semibold">문항 / 배점 / 정답</div>

            {questions.length === 0 && (
              <div className="text-xs text-gray-500">
                문항이 없습니다. 상단의 “문항 자동 복구”로 question ROI 기반 문항을 생성하세요.
              </div>
            )}

            {questions.map((q: SheetQuestionEntity) => {
              const key = String(q.id);
              return (
                <div key={q.id} className="flex items-center gap-3 border rounded px-3 py-2">
                  <div className="w-12 text-sm font-semibold">#{q.number}</div>

                  <input
                    type="number"
                    className="w-20 input"
                    defaultValue={q.score}
                    onBlur={(e) =>
                      scoreMut.mutate({
                        questionId: q.id,
                        score: Number(e.target.value),
                      })
                    }
                  />

                  <div className="flex gap-1">
                    {CHOICES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`px-2 py-1 border rounded ${answers[key] === c ? "bg-black text-white" : ""}`}
                        onClick={() => setAnswers((prev) => ({ ...prev, [key]: c }))}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ANSWER KEY */}
          <div className="flex justify-end">
            <button
              className="btn-primary"
              disabled={answerKeyMut.isPending}
              onClick={() =>
                answerKeyMut.mutate({
                  sheetId: id, // historical name: 실제로는 examId
                  existingId: akQ.data?.id,
                  answers,
                })
              }
            >
              {answerKeyMut.isPending ? "저장 중..." : "정답 저장"}
            </button>
          </div>

          {/* ASSETS */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">생성된 자산</div>

            {assetsQ.isLoading && <div className="text-xs text-gray-500">불러오는 중...</div>}

            {!assetsQ.isLoading && assets.length === 0 && (
              <div className="text-xs text-gray-500">아직 생성된 자산이 없습니다.</div>
            )}

            {omr?.download_url && (
              <div className="text-xs">
                <span className="text-gray-600">OMR:</span>{" "}
                <a className="underline" href={omr.download_url} target="_blank" rel="noreferrer">
                  다운로드
                </a>
              </div>
            )}

            {problem?.download_url && (
              <div className="text-xs">
                <span className="text-gray-600">문제 PDF:</span>{" "}
                <a className="underline" href={problem.download_url} target="_blank" rel="noreferrer">
                  다운로드
                </a>
              </div>
            )}

            {assets.map((a) => (
              <div key={a.id} className="text-xs">
                {a.asset_type} — {a.file_key}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

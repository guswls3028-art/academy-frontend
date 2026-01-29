// PATH: src/features/materials/sheets/SheetsEditPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageSection } from "@/shared/ui/page";
import { EmptyState } from "@/shared/ui/feedback";

import {
  getSheetApi,
  getSheetQuestionsApi,
  getSheetAnswerKeyApi,
  patchSheetQuestionScoreApi,
  upsertSheetAnswerKeyApi,
  fetchOmrObjectiveV1Meta,
  type SheetQuestionEntity,
  type OmrObjectiveV1Meta,
} from "./sheets.api";

const CHOICES = ["A", "B", "C", "D", "E"] as const;
type Choice = (typeof CHOICES)[number];

function clampInt(v: number) {
  return Math.max(0, Math.floor(Number.isFinite(v) ? v : 0));
}

function toQuestionCount(n: number): 10 | 20 | 30 {
  if (n <= 10) return 10;
  if (n <= 20) return 20;
  return 30;
}

function groupByFive<T extends { number: number }>(items: T[]) {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += 5) groups.push(items.slice(i, i + 5));
  return groups;
}

export default function SheetsEditPage() {
  const { sheetId } = useParams();
  const navigate = useNavigate();
  const id = Number(sheetId);
  const qc = useQueryClient();

  const sheetQ = useQuery({
    queryKey: ["materials-sheet", id],
    queryFn: () => getSheet(id),
    enabled: id > 0,
  });

  const qQ = useQuery({
    queryKey: ["materials-sheet-questions", id],
    queryFn: () => getSheetQuestions(id),
    enabled: id > 0,
  });

  const akQ = useQuery({
    queryKey: ["materials-sheet-answerkey", id],
    queryFn: () => getSheetAnswerKey(id),
    enabled: id > 0,
  });

  const questions = useMemo(() => {
    const list = (qQ.data ?? []) as SheetQuestionEntity[];
    return [...list].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  }, [qQ.data]);

  const questionCount = useMemo(() => toQuestionCount(questions.length || 20), [questions.length]);

  const metaQ = useQuery({
    queryKey: ["materials-omr-meta", questionCount],
    queryFn: () => fetchOmrObjectiveV1Meta(questionCount),
    enabled: questionCount === 10 || questionCount === 20 || questionCount === 30,
    staleTime: 60_000,
  });

  const [currentScore, setCurrentScore] = useState(0);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [answers, setAnswers] = useState<Record<number, Choice | "">>({});
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (questions.length === 0) return;
    if (qQ.isLoading || akQ.isLoading) return;

    const nextScores: Record<number, number> = {};
    for (const q of questions) nextScores[q.id] = clampInt(Number(q.score ?? 0));

    const nextAnswers: Record<number, Choice | ""> = {};
    const ak = akQ.data as any;
    const akAnswers: Record<string, string> = (ak?.answers ?? {}) as any;
    Object.entries(akAnswers || {}).forEach(([k, v]) => {
      const key = Number(k);
      if (!Number.isFinite(key)) return;
      const vv = String(v || "").toUpperCase();
      if (CHOICES.includes(vv as any)) nextAnswers[key] = vv as Choice;
    });

    setScores(nextScores);
    setAnswers(nextAnswers);
    initializedRef.current = true;
  }, [questions, qQ.isLoading, akQ.isLoading, akQ.data]);

  const totalScore = useMemo(() => {
    let t = 0;
    for (const q of questions) t += clampInt(scores[q.id] ?? (q.score ?? 0));
    return t;
  }, [questions, scores]);

  const groups = useMemo(() => groupByFive(questions), [questions]);

  const columns = useMemo(() => {
    const col1: SheetQuestionEntity[][] = [];
    const col2: SheetQuestionEntity[][] = [];
    const col3: SheetQuestionEntity[][] = [];

    const g = groups;
    if (questionCount === 10) {
      col1.push(...g.slice(0, 1));
      col2.push(...g.slice(1, 2));
      col3.push(...g.slice(2, 2));
    } else if (questionCount === 20) {
      col1.push(...g.slice(0, 2));
      col2.push(...g.slice(2, 4));
      col3.push(...g.slice(4, 4));
    } else {
      col1.push(...g.slice(0, 2));
      col2.push(...g.slice(2, 4));
      col3.push(...g.slice(4, 6));
    }

    return [col1, col2, col3];
  }, [groups, questionCount]);

  const saveMut = useMutation({
    mutationFn: async () => {
      for (const q of questions) {
        const next = clampInt(scores[q.id] ?? (q.score ?? 0));
        if (next !== clampInt(Number(q.score ?? 0))) {
          await patchSheetQuestionScore({
            questionId: q.id,
            score: next,
          });
        }
      }

      const payload: Record<string, string> = {};
      Object.entries(answers).forEach(([k, v]) => {
        const key = String(k);
        const vv = String(v || "").toUpperCase();
        if (CHOICES.includes(vv as any)) payload[key] = vv;
      });

      await upsertSheetAnswerKey({
        sheetId: id,
        existingId: (akQ.data as any)?.id ?? null,
        answers: payload,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      alert("저장 완료");
    },
    onError: (e: any) => {
      alert(e?.message || "저장 실패");
    },
  });

  const ScorePill = ({ value }: { value: number }) => {
    const active = currentScore === value;
    return (
      <button
        type="button"
        tabIndex={-1}
        className={[
          "px-3 py-2 rounded-full border text-sm font-semibold transition select-none",
          active ? "border-[var(--color-primary)] text-[var(--color-primary)] bg-white shadow-sm" : "bg-white hover:bg-[var(--bg-surface-soft)]",
        ].join(" ")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setCurrentScore(value)}
      >
        {value}점
      </button>
    );
  };

  const AddPill = ({ add }: { add: number }) => (
    <button
      type="button"
      tabIndex={-1}
      className="px-3 py-2 rounded-full border text-sm font-semibold bg-white hover:bg-[var(--bg-surface-soft)] transition select-none"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setCurrentScore((p) => clampInt(p + add))}
    >
      +{add}
    </button>
  );

  const Bubble = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: Choice;
    onClick: () => void;
  }) => (
    <button
      type="button"
      tabIndex={-1}
      className={[
        "w-7 h-7 rounded-full border text-[11px] font-semibold transition select-none",
        active ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm" : "bg-white hover:bg-[var(--bg-surface-soft)]",
      ].join(" ")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      onKeyDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {label}
    </button>
  );

  const QuestionRow = ({ q }: { q: SheetQuestionEntity }) => {
    const score = clampInt(scores[q.id] ?? (q.score ?? 0));
    const a = (answers[q.id] ?? "") as Choice | "";

    return (
      <div
        className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-white/80 px-2.5 py-2 shadow-[0_1px_0_rgba(0,0,0,0.04)] cursor-pointer select-none"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setScores((m) => ({ ...m, [q.id]: clampInt(currentScore) }))}
      >
        <div className="flex items-center gap-2 min-w-[92px]">
          <div className="w-9 text-right font-extrabold text-sm tracking-tight">{q.number}.</div>
          <div className="inline-flex items-center rounded-full border border-black/10 bg-[var(--bg-surface-soft)] px-2 py-0.5 text-[11px] font-semibold">
            {score}점
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {CHOICES.map((c) => (
            <Bubble
              key={c}
              label={c}
              active={a === c}
              onClick={() =>
                setAnswers((m) => ({
                  ...m,
                  [q.id]: c,
                }))
              }
            />
          ))}
        </div>
      </div>
    );
  };

  const Column = ({ title, blocks }: { title: string; blocks: SheetQuestionEntity[][] }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-extrabold tracking-[0.18em] text-black/55 uppercase">{title}</div>
        <div className="h-px flex-1 bg-black/10 ml-3" />
      </div>

      <div className="space-y-4">
        {blocks.map((block, idx) => (
          <div key={idx} className="rounded-xl border border-black/10 bg-white/55 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <div className="grid grid-cols-1 gap-2">
              {block.map((q) => (
                <QuestionRow key={q.id} q={q} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const Paper = ({ meta }: { meta?: OmrObjectiveV1Meta | null }) => {
    const ratio = 297 / 210;
    const w = 1100;
    const h = Math.round(w / ratio);

    return (
      <div className="w-full overflow-x-auto">
        <div
          className="mx-auto rounded-[24px] border border-black/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(252,252,252,0.92))] shadow-[0_14px_40px_rgba(0,0,0,0.08)]"
          style={{ width: w, minHeight: h }}
        >
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[13px] font-extrabold tracking-[0.22em] text-black/60">OMR OBJECTIVE v1</div>
                <div className="text-xl font-black leading-tight">{String(sheetQ.data?.title ?? "시험지")}</div>
                <div className="text-xs text-black/50">
                  A4 · Landscape · {questionCount}문항 · 5지선다 (A–E) {meta?.units ? `· units: ${meta.units}` : ""}
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                <div className="text-[11px] font-bold text-black/55 tracking-[0.22em] uppercase">IDENTIFIER</div>
                <div className="mt-1 text-xs font-semibold text-black/70">휴대폰 번호 뒤 8자리</div>
                <div className="mt-2 grid grid-cols-8 gap-1.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-8 h-10 rounded-lg border border-black/10 bg-[var(--bg-surface-soft)] flex items-center justify-center text-[11px] font-black text-black/50"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 h-px bg-black/10" />
          </div>

          <div className="px-6 pb-6">
            <div className="grid grid-cols-3 gap-4">
              <Column title="SECTION A" blocks={columns[0]} />
              <Column title="SECTION B" blocks={columns[1]} />
              <Column title="SECTION C" blocks={columns[2]} />
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-black/15 bg-white/60 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-black/70">정답/배점은 이 시험지의 단일 진실입니다.</div>
                <div className="text-[11px] font-bold text-black/45 tracking-[0.2em] uppercase">
                  objective_v1 · {questionCount}Q
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (id <= 0) {
    return (
      <EmptyState
        title="잘못된 접근"
        message="유효하지 않은 시험지입니다."
      />
    );
  }

  if (qQ.isLoading || sheetQ.isLoading) {
    return <div className="p-4 text-sm">불러오는 중...</div>;
  }

  if (qQ.isError || sheetQ.isError) {
    return (
      <div className="surface p-4">
        <EmptyState title="불러오기 실패" message="시험지 정보를 불러오지 못했습니다." />
      </div>
    );
  }

  if (questions.length === 0) {
    return <EmptyState title="문항 없음" message="문항 데이터가 없습니다." />;
  }

  return (
    <PageSection title="정답 · 배점 설정" description="종이 시험지 위에서 마킹하듯 정답과 배점을 설정합니다.">
      <div className="sticky top-0 z-40 -mx-4 px-4 pt-2 pb-3 bg-[var(--bg-page)]/95 backdrop-blur border-b border-black/5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-xs font-extrabold tracking-[0.18em] text-black/55 uppercase mr-1">SCORE</div>
            <ScorePill value={0} />
            <AddPill add={1} />
            <AddPill add={2} />
            <AddPill add={3} />
            <AddPill add={4} />
            <AddPill add={5} />
            <AddPill add={10} />
            <button
              type="button"
              tabIndex={-1}
              className="px-3 py-2 rounded-full border text-sm font-semibold bg-white hover:bg-[var(--bg-surface-soft)] transition select-none"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCurrentScore(0)}
            >
              초기화
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full border bg-white px-4 py-2 text-sm font-extrabold shadow-sm">
              총 배점: {totalScore}점
            </div>
            <button className="btn" onClick={() => navigate("/admin/materials/sheets")}>
              목록
            </button>
            <button className="btn-primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-black/45">
          현재 선택 배점: <span className="font-bold text-black/65">{currentScore}점</span> · 문항을 클릭하면 배점 적용 · 버블을 클릭하면 정답 선택
        </div>
      </div>

      <div className="surface p-4 space-y-4">
        <div className="rounded-2xl border bg-[var(--bg-surface-soft)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-extrabold">시험지 상품 제작실</div>
              <div className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                OMR v1은 규격이 고정된 실상품입니다. 종이 위에 마킹하듯 정답과 배점을 설정하세요.
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold text-black/45 tracking-[0.2em] uppercase">OMR META</div>
              <div className="mt-1 text-xs font-semibold text-black/70">
                {metaQ.isLoading ? "불러오는 중..." : metaQ.isError ? "meta 조회 실패" : `${metaQ.data?.version ?? "objective_v1"} · ${questionCount}Q`}
              </div>
            </div>
          </div>
        </div>

        <Paper meta={metaQ.data} />
      </div>
    </PageSection>
  );
}

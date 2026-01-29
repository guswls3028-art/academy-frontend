// PATH: src/features/materials/sheets/SheetsListPage.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageSection } from "@/shared/ui/page";
import { EmptyState } from "@/shared/ui/feedback";

import {
  listSheetsApi,
  getSheetQuestionsApi,
  type SheetQuestionEntity
} from "./sheets.api";

function sumScores(questions: SheetQuestionEntity[]) {
  let t = 0;
  for (const q of questions) t += Number(q?.score ?? 0);
  return t;
}

function UsageBadge() {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] bg-[var(--bg-surface)]">
        재사용 가능
      </span>
      <span className="text-xs text-[var(--text-muted)]">연결된 시험 없음</span>
    </div>
  );
}

function QuestionStatCell({ sheetId }: { sheetId: number }) {
  const q = useQuery({
    queryKey: ["materials-sheets-questions", sheetId],
    queryFn: () => getSheetQuestionsApi(sheetId),
    enabled: Number.isFinite(sheetId) && sheetId > 0,
    staleTime: 10_000,
  });

  if (q.isLoading) return <span className="text-xs text-[var(--text-muted)]">불러오는 중...</span>;
  if (q.isError) return <span className="text-xs text-red-600">조회 실패</span>;

  const list = q.data ?? [];
  const totalQ = list.length;
  const totalScore = sumScores(list);

  const chip = (label: string) => (
    <span className="inline-flex items-center rounded-full border bg-[var(--bg-surface)] px-2 py-1 text-[11px]">
      {label}
    </span>
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {chip(`${totalQ}문항`)}
        {chip(`총 ${totalScore}점`)}
      </div>
      <div className="text-[11px] text-[var(--text-muted)]">정답/배점 기준은 이 시험지의 단일 진실입니다.</div>
    </div>
  );
}

function SheetRowTitle({ title, createdAt }: { title?: any; createdAt?: any }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold">{String(title ?? "-")}</div>
      <div className="text-xs text-[var(--text-muted)]">생성일 {createdAt ? String(createdAt) : "-"}</div>
    </div>
  );
}

export default function SheetsListPage() {
  const navigate = useNavigate();

  const sheetsQ = useQuery({
    queryKey: ["materials-sheets"],
    queryFn: () => listSheetsApi(),
  });


  const items = useMemo(() => sheetsQ.data ?? [], [sheetsQ.data]);

  return (
    <PageSection
      title="시험지"
      description="시험 전에 미리 제작되는 ‘시험지 상품’ 목록"
      right={
        <button className="btn-primary" onClick={() => navigate("/admin/materials/sheets/new")}>
          + 시험지 생성
        </button>
      }
    >
      <div className="surface p-4 space-y-4">
        <div className="rounded border bg-[var(--bg-surface-soft)] p-3">
          <div className="text-sm font-semibold">시험지 상품 제작실</div>
          <div className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
            시험지는 시험보다 먼저 만들어지는 자산이며, 여러 시험에서 재사용될 수 있습니다.
            <br />
            여기서 저장한 정답/배점 기준이 채점의 단일 진실로 사용됩니다.
          </div>
        </div>

        {sheetsQ.isLoading && <div className="text-sm text-[var(--text-muted)]">목록 불러오는 중...</div>}

        {sheetsQ.isError && <div className="text-sm text-red-600">목록을 불러오지 못했습니다.</div>}

        {!sheetsQ.isLoading && !sheetsQ.isError && items.length === 0 && (
          <EmptyState title="시험지가 없습니다" message="시험 전에 사용할 시험지를 먼저 제작하세요." />
        )}

        {items.length > 0 && (
          <div className="rounded border overflow-hidden bg-[var(--bg-surface)]">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>ID</th>
                  <th>시험지 이름</th>
                  <th style={{ width: 280 }}>문항 / 총점</th>
                  <th style={{ width: 220 }}>사용 현황</th>
                  <th style={{ width: 120 }}>편집</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s: any) => (
                  <tr key={s.id}>
                    <td className="text-sm text-[var(--text-muted)]">#{s.id}</td>
                    <td>
                      <SheetRowTitle title={s.title} createdAt={s.created_at} />
                    </td>
                    <td>
                      <QuestionStatCell sheetId={Number(s.id)} />
                    </td>
                    <td>
                      <UsageBadge />
                    </td>
                    <td>
                      <button className="btn" onClick={() => navigate(`/admin/materials/sheets/${s.id}/edit`)}>
                        편집
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageSection>
  );
}

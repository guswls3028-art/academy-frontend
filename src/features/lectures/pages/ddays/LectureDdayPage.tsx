// PATH: src/features/lectures/pages/ddays/LectureDdayPage.tsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { fetchDdays, deleteDday, type Dday } from "@/features/lectures/api/ddays";
import DdayModal from "@/features/lectures/components/DdayModal";
import { EmptyState, Button } from "@/shared/ui/ds";

const TH_STYLE = {
  background:
    "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface-hover))",
  color:
    "color-mix(in srgb, var(--color-brand-primary) 55%, var(--color-text-secondary))",
};

export default function LectureDdayPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);

  const { data: ddays = [], isLoading } = useQuery<Dday[]>({
    queryKey: ["ddays", lectureIdNum],
    queryFn: () => fetchDdays(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDday(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ddays", lectureIdNum] }),
  });

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button intent="primary" onClick={() => setShowModal(true)}>
          D-Day 추가
        </Button>
        <span className="ml-auto text-sm font-semibold text-[var(--color-text-muted)]">
          {isLoading ? "불러오는 중…" : `${ddays.length}개`}
        </span>
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : ddays.length === 0 ? (
        <EmptyState scope="panel" title="등록된 D-Day가 없습니다." />
      ) : (
        <div style={{ overflow: "hidden", borderRadius: 14, border: "1px solid var(--color-border-divider)" }}>
          <table className="w-full" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th
                  className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                  style={{ textAlign: "left", whiteSpace: "nowrap", ...TH_STYLE }}
                >
                  제목
                </th>
                <th
                  className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                  style={{ textAlign: "center", whiteSpace: "nowrap", width: 220, ...TH_STYLE }}
                >
                  날짜
                </th>
                <th
                  className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                  style={{ textAlign: "center", whiteSpace: "nowrap", width: 120, ...TH_STYLE }}
                >
                  관리
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border-divider)]">
              {ddays.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--color-bg-surface-soft)]">
                  <td className="px-4 py-3 text-left text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                    {d.title}
                  </td>
                  <td className="px-4 py-3 text-center text-[14px] text-[var(--color-text-secondary)] truncate">
                    {new Date(d.date).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      intent="danger"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm("삭제하시겠습니까?")) deleteMutation.mutate(d.id);
                      }}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <DdayModal lectureId={lectureIdNum} onClose={() => setShowModal(false)} />}
    </>
  );
}

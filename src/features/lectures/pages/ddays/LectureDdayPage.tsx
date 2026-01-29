// src/features/lectures/pages/ddays/LectureDdayPage.tsx

import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  fetchDdays,
  deleteDday,
  type Dday,
} from "@/features/lectures/api/ddays";

import DdayModal from "@/features/lectures/components/DdayModal";
import { PageSection } from "@/shared/ui/page";

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ddays", lectureIdNum] });
    },
  });

  if (!Number.isFinite(lectureIdNum)) {
    return (
      <PageSection title="D-Day 설정">
        <div className="text-sm text-red-500">잘못된 강의 ID</div>
      </PageSection>
    );
  }

  return (
    <PageSection
      title="D-Day 설정"
      actions={
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm text-white"
        >
          D-Day 추가
        </button>
      }
    >
      {isLoading ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          불러오는 중…
        </div>
      ) : ddays.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          등록된 D-Day가 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded border">
          <table className="w-full text-sm">
            <thead className="border-b bg-[var(--bg-surface-soft)]">
              <tr>
                <th className="px-4 py-2 text-left">제목</th>
                <th className="px-4 py-2 text-left">날짜</th>
                <th className="px-4 py-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {ddays.map((d) => (
                <tr key={d.id} className="border-b">
                  <td className="px-4 py-2">{d.title}</td>
                  <td className="px-4 py-2">
                    {new Date(d.date).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm("삭제하시겠습니까?")) {
                          deleteMutation.mutate(d.id);
                        }
                      }}
                      className="text-sm text-[var(--text-muted)] hover:underline"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <DdayModal
          lectureId={lectureIdNum}
          onClose={() => setShowModal(false)}
        />
      )}
    </PageSection>
  );
}

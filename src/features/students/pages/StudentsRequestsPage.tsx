// PATH: src/features/students/pages/StudentsRequestsPage.tsx
// 선생용: 학생 가입 신청 목록 → 승인 시 즉시 학생 등록

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchRegistrationRequests,
  approveRegistrationRequest,
  type ClientRegistrationRequest,
} from "../api/students";
import { Button, EmptyState } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

function formatDate(s: string | null) {
  if (!s) return "-";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export default function StudentsRequestsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["students", "registration_requests"],
    queryFn: () => fetchRegistrationRequests({ status: "pending", page: 1, page_size: 100 }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveRegistrationRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", "registration_requests"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      feedback.success("승인되었습니다. 학생이 등록되었습니다.");
    },
    onError: (e: Error) => {
      feedback.error(e.message || "승인 처리에 실패했습니다.");
    },
  });

  const list = data?.data ?? [];
  const pendingList = list.filter((r) => r.status === "pending");

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[200px]">
        <span className="text-[var(--color-text-muted)]">불러오는 중...</span>
      </div>
    );
  }

  if (pendingList.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="대기 중인 가입 신청이 없습니다"
          description="학생이 로그인 페이지에서 회원가입을 요청하면 여기에 표시됩니다."
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
              <th className="px-4 py-3 font-semibold">이름</th>
              <th className="px-4 py-3 font-semibold">학부모 전화</th>
              <th className="px-4 py-3 font-semibold">학생 전화</th>
              <th className="px-4 py-3 font-semibold">구분</th>
              <th className="px-4 py-3 font-semibold">학교/학년</th>
              <th className="px-4 py-3 font-semibold">주소</th>
              <th className="px-4 py-3 font-semibold">신청일시</th>
              <th className="px-4 py-3 font-semibold w-[100px]">동작</th>
            </tr>
          </thead>
          <tbody>
            {pendingList.map((r: ClientRegistrationRequest) => (
              <tr
                key={r.id}
                className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)]"
              >
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">{r.parentPhone || "-"}</td>
                <td className="px-4 py-3">{r.phone || "-"}</td>
                <td className="px-4 py-3">{r.schoolType === "HIGH" ? "고등" : "중등"}</td>
                <td className="px-4 py-3">
                  {r.highSchool || r.middleSchool || "-"}
                  {r.grade != null ? ` ${r.grade}학년` : ""}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.address || "-"}</td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(r.id)}
                  >
                    {approveMutation.isPending && approveMutation.variables === r.id
                      ? "처리 중..."
                      : "승인"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// PATH: src/features/lectures/pages/sessions/LectureSessionsPage.tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchSessions } from "../../api/sessions";
import SessionCreateModal from "../../components/SessionCreateModal";
import { EmptyState, Button } from "@/shared/ui/ds";

const TH_STYLE = {
  background:
    "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface-hover))",
  color:
    "color-mix(in srgb, var(--color-brand-primary) 55%, var(--color-text-secondary))",
};

export default function LectureSessionsPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lecId = Number(lectureId);

  const [open, setOpen] = useState(false);

  const { data: sessions = [], isLoading, isError } = useQuery({
    queryKey: ["lecture-sessions", lecId],
    queryFn: () => fetchSessions(lecId),
    enabled: Number.isFinite(lecId),
  });

  if (!Number.isFinite(lecId)) {
    return <div className="p-2 text-sm" style={{ color: "var(--color-error)" }}>잘못된 강의 ID</div>;
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button intent="primary" onClick={() => setOpen(true)}>
          + 차시 추가
        </Button>
        <span className="ml-auto text-sm font-semibold text-[var(--color-text-muted)]">
          {isLoading ? "불러오는 중…" : `${sessions.length}개`}
        </span>
      </div>

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : isError ? (
        <EmptyState scope="panel" tone="error" title="차시 데이터를 불러올 수 없습니다." />
      ) : sessions.length === 0 ? (
        <EmptyState scope="panel" title="등록된 차시가 없습니다." description="차시를 추가하면 여기에 표시됩니다." />
      ) : (
        <div style={{ overflow: "hidden", borderRadius: 14, border: "1px solid var(--color-border-divider)" }}>
          <table className="w-full" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]" style={{ textAlign: "left", ...TH_STYLE }}>
                  차시
                </th>
                <th className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]" style={{ textAlign: "left", ...TH_STYLE }}>
                  제목
                </th>
                <th className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]" style={{ textAlign: "center", width: 160, ...TH_STYLE }}>
                  날짜
                </th>
                <th className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]" style={{ textAlign: "center", width: 120, ...TH_STYLE }}>
                  ID
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border-divider)]">
              {sessions.map((s: any) => (
                <tr key={s.id} className="hover:bg-[var(--color-bg-surface-soft)]">
                  <td className="px-4 py-3 text-left text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                    <Link to={`${s.id}`} style={{ color: "inherit", textDecoration: "none", fontWeight: 950 }}>
                      {s.order ?? "-"}차시
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-left text-[14px] text-[var(--color-text-secondary)] truncate">
                    {s.title || "-"}
                  </td>
                  <td className="px-4 py-3 text-center text-[14px] text-[var(--color-text-secondary)] truncate">
                    {s.date || "-"}
                  </td>
                  <td className="px-4 py-3 text-center text-[13px] font-semibold text-[var(--color-text-muted)] truncate">
                    {s.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <SessionCreateModal lectureId={lecId} onClose={() => setOpen(false)} />}
    </>
  );
}

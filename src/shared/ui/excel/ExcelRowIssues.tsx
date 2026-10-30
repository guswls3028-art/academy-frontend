import { useState } from "react";
import { Button } from "@/shared/ui/ds";

type Issue = { row: number; name: string; reason: string };

/** Bound the rendered list without hiding the total or losing access to any issue. */
export default function ExcelRowIssues({ issues }: { issues: Issue[] }) {
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(issues.length / 50) - 1);
  const currentPage = Math.min(page, lastPage);
  if (!issues.length) return null;
  return (
    <div className="min-w-0 text-sm" aria-label="엑셀 입력 확인 목록">
      <ul className="max-h-48 overflow-y-auto break-words space-y-1" aria-live="polite">
        {issues.slice(currentPage * 50, (currentPage + 1) * 50).map((issue) => (
          <li key={issue.row}>{issue.row}행 · {issue.name}: {issue.reason}</li>
        ))}
      </ul>
      {lastPage > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button intent="ghost" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>이전 오류</Button>
          <span>{currentPage + 1} / {lastPage + 1}쪽 · 전체 {issues.length}행</span>
          <Button intent="ghost" size="sm" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>다음 오류</Button>
        </div>
      )}
    </div>
  );
}

import type { PendingSubmissionPage } from "@/shared/api/contracts/submissions";
import { Button } from "@/shared/ui/ds";

export default function SubmissionInboxPager({ data, onPage, disabled = false }: {
  data: PendingSubmissionPage;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  return (
    <nav aria-label="제출 목록 페이지" className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
      <Button className="h-11" disabled={disabled || !data.has_previous} onClick={() => onPage(data.page - 1)} aria-label="이전 페이지">이전</Button>
      <span aria-live="polite">전체 {data.count}건 · {data.page} / {data.pages} 페이지</span>
      <Button className="h-11" disabled={disabled || !data.has_next} onClick={() => onPage(data.page + 1)} aria-label="다음 페이지">다음</Button>
    </nav>
  );
}

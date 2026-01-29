// PATH: src/features/homework/panels/HomeworkAssetsPanel.tsx
/**
 * HomeworkAssetsPanel
 *
 * ✅ exams/panels/ExamAssetsPanel UX 복제
 *
 * ⚠️ Homework asset API는 아직 미확정 → UI 슬롯만 제공
 */

export default function HomeworkAssetsPanel({
  homeworkId,
}: {
  homeworkId: number;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
        <div className="border-b border-[var(--border-divider)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            자산
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            과제에 연결된 파일/자료를 관리합니다.
          </div>
        </div>

        <div className="space-y-3 p-4 text-sm text-[var(--text-primary)]">
          <div className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] p-3 text-xs text-[var(--text-muted)]">
            ⚠️ Homework asset API가 아직 확정되지 않아 UI 슬롯만 제공합니다.
            <div className="mt-2 text-xs">
              연결 후보:
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>GET /homeworks/{`{id}`}/assets/</li>
                <li>POST /homeworks/{`{id}`}/assets/ (multipart)</li>
              </ul>
            </div>
          </div>

          <div className="text-xs text-[var(--text-muted)]">
            homeworkId: {homeworkId}
          </div>

          <button
            type="button"
            className="rounded border border-[var(--border-divider)] px-3 py-2 text-sm hover:bg-[var(--bg-surface-soft)]"
            onClick={() => alert("asset 업로드는 API 확정 후 연결")}
          >
            + 자산 업로드
          </button>
        </div>
      </section>
    </div>
  );
}

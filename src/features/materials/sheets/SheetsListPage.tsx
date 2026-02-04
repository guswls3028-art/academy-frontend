// ======================================================================================
// FILE: src/features/materials/sheets/SheetsListPage.tsx
// ======================================================================================
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageSection } from "@/shared/ui/page";
import { EmptyState } from "@/shared/ui/feedback";
import { listSheetsApi, type SheetEntity } from "./sheets.api";
import { SheetsEditorModal } from "./components/editor/SheetsEditorModal";
import { SheetsCreateModal } from "./components/SheetsCreateModal";

export default function SheetsListPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const sheetsQ = useQuery({
    queryKey: ["materials-sheets"],
    queryFn: listSheetsApi,
  });

  const items = useMemo(() => sheetsQ.data ?? [], [sheetsQ.data]);

  return (
    <PageSection
      title="시험지"
      description="시험 전에 미리 제작되는 시험지 상품 목록 (template exam)"
      right={
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          + 시험지 생성
        </button>
      }
    >
      <div className="surface p-4">
        {items.length === 0 && !sheetsQ.isLoading && (
          <EmptyState title="시험지가 없습니다" message="시험지를 먼저 생성하세요." />
        )}

        {items.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>시험지 이름</th>
                <th>편집</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s: SheetEntity) => (
                <tr key={s.id}>
                  <td>#{s.id}</td>
                  <td>{s.title}</td>
                  <td>
                    <button className="btn" onClick={() => setEditingId(s.id)}>
                      편집
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ✅ 생성 모달 */}
      <SheetsCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(sheet) => {
          qc.invalidateQueries({ queryKey: ["materials-sheets"] });
          setCreateOpen(false);
          setEditingId(sheet.id);
        }}
      />

      {/* ✅ 편집 모달 */}
      {editingId !== null && (
        <SheetsEditorModal
          open
          sheetId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
    </PageSection>
  );
}

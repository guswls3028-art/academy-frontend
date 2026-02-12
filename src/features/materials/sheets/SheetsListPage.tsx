// PATH: src/features/materials/sheets/SheetsListPage.tsx
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, EmptyState, Panel, Section } from "@/shared/ui/ds";
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
    <Section>
      <Panel>
        <div className="panel-body space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">시험지</div>
              <div className="text-xs text-[var(--text-muted)]">
                시험 전에 제작되는 템플릿 시험지 목록
              </div>
            </div>

            <Button type="button" intent="primary" size="md" onClick={() => setCreateOpen(true)}>
              + 시험지 생성
            </Button>
          </div>

          {items.length === 0 && !sheetsQ.isLoading && (
            <EmptyState
              title="시험지가 없습니다"
              description="시험지를 먼저 생성하세요."
            />
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
                      <Button type="button" intent="secondary" size="sm" onClick={() => setEditingId(s.id)}>
                        편집
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      <SheetsCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(sheet) => {
          qc.invalidateQueries({ queryKey: ["materials-sheets"] });
          setCreateOpen(false);
          setEditingId(sheet.id);
        }}
      />

      {editingId !== null && (
        <SheetsEditorModal
          open
          sheetId={editingId}
          onClose={() => setEditingId(null)}
        />
      )}
    </Section>
  );
}

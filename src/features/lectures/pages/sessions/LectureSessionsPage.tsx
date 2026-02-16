// PATH: src/features/lectures/pages/sessions/LectureSessionsPage.tsx
import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchSessions, sortSessionsByDateDesc, type Session } from "../../api/sessions";
import SessionCreateModal from "../../components/SessionCreateModal";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable, TABLE_COL } from "@/shared/ui/domain";

export default function LectureSessionsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { lectureId } = useParams<{ lectureId: string }>();
  const lecId = Number(lectureId);

  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: rawSessions = [], isLoading, isError } = useQuery<Session[]>({
    queryKey: ["lecture-sessions", lecId],
    queryFn: () => fetchSessions(lecId),
    enabled: Number.isFinite(lecId),
  });
  const sessions = useMemo(() => sortSessionsByDateDesc(rawSessions), [rawSessions]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(() => sessions.map((s) => s.id), [sessions]);
  const allSelected = useMemo(
    () => sessions.length > 0 && allIds.length > 0 && allIds.every((id) => selectedIds.includes(id)),
    [sessions.length, allIds, selectedIds]
  );

  const toggleSelect = useCallback(
    (id: number) => {
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          return prev.filter((x) => x !== id);
        } else {
          return [...prev, id];
        }
      });
    },
    []
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (allSelected) {
        return [];
      } else {
        return [...allIds];
      }
    });
  }, [allSelected, allIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const selectionBar = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2 pl-1">
        <span
          className="text-[13px] font-semibold"
          style={{
            color: selectedIds.length > 0 ? "var(--color-primary)" : "var(--color-text-muted)",
          }}
        >
          {selectedIds.length}개 선택됨
        </span>
        <span className="text-[var(--color-border-divider)]">|</span>
        <Button intent="secondary" size="sm" onClick={handleClearSelection} disabled={selectedIds.length === 0}>
          선택 해제
        </Button>
      </div>
    ),
    [selectedIds.length, handleClearSelection]
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["lecture-sessions", lecId] });
  }, [qc, lecId]);

  if (!Number.isFinite(lecId)) {
    return <div className="p-2 text-sm" style={{ color: "var(--color-error)" }}>잘못된 강의 ID</div>;
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : isError ? (
          <EmptyState scope="panel" tone="error" title="차시 데이터를 불러올 수 없습니다." />
        ) : sessions.length === 0 ? (
          <EmptyState
            scope="panel"
            tone="empty"
            title="등록된 차시가 없습니다."
            description="차시를 추가하면 여기에 표시됩니다."
            actions={
              <Button intent="primary" onClick={() => setOpen(true)}>
                + 차시 추가
              </Button>
            }
          />
        ) : (
          <>
            <DomainListToolbar
              totalLabel={`총 ${sessions.length}개`}
              searchSlot={null}
              primaryAction={
                <Button intent="primary" onClick={() => setOpen(true)}>
                  + 차시 추가
                </Button>
              }
              belowSlot={selectionBar}
            />
            <DomainTable
              tableClassName="ds-table--flat"
              tableStyle={{
                tableLayout: "fixed",
                width:
                  TABLE_COL.checkbox + TABLE_COL.mediumAlt + TABLE_COL.title + TABLE_COL.timeRange + TABLE_COL.tag,
              }}
            >
              <colgroup>
                <col style={{ width: TABLE_COL.checkbox }} />
                <col style={{ width: TABLE_COL.mediumAlt }} />
                <col style={{ width: TABLE_COL.title }} />
                <col style={{ width: TABLE_COL.timeRange }} />
                <col style={{ width: TABLE_COL.tag }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="ds-checkbox-cell" style={{ width: TABLE_COL.checkbox }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="전체 선택"
                      className="cursor-pointer"
                    />
                  </th>
                  <th scope="col">차시</th>
                  <th scope="col">제목</th>
                  <th scope="col">날짜</th>
                  <th scope="col">ID</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className={`cursor-pointer hover:bg-[var(--color-bg-surface-hover)] ${selectedSet.has(s.id) ? "ds-row-selected" : ""}`}
                    onClick={() => navigate(`/admin/lectures/${lectureId}/sessions/${s.id}`)}
                  >
                    <td className="ds-checkbox-cell" style={{ width: TABLE_COL.checkbox }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${s.title} 선택`}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="text-[15px] font-bold text-[var(--color-text-primary)] truncate">
                      <Link
                        to={`/admin/lectures/${lectureId}/sessions/${s.id}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.order ?? "-"}차시
                      </Link>
                    </td>
                    <td className="text-[14px] text-[var(--color-text-secondary)] truncate">
                      {s.title || "-"}
                    </td>
                    <td className="text-[14px] text-[var(--color-text-secondary)] truncate text-center">
                      {s.date || "-"}
                    </td>
                    <td className="text-[13px] font-semibold text-[var(--color-text-muted)] truncate text-center">
                      {s.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DomainTable>
          </>
        )}
      </div>

      {open && <SessionCreateModal lectureId={lecId} onClose={handleClose} />}
    </>
  );
}

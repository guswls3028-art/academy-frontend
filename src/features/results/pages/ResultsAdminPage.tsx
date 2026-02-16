/**
 * 성적 (사이드바) — 강의별 성적 진입점 · 차시 내 성적은 각 강의 > 차시에서 운영
 * Design SSOT: students 도메인 (DomainLayout, DomainListToolbar, DomainTable ds-table--flat)
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchLectures } from "@/features/lectures/api/sessions";
import { DomainLayout } from "@/shared/ui/layout";
import { DomainListToolbar, DomainTable, TABLE_COL, STATUS_ACTIVE_COLOR, STATUS_INACTIVE_COLOR } from "@/shared/ui/domain";
import { Button, EmptyState } from "@/shared/ui/ds";

export default function ResultsAdminPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data: lectures = [], isLoading } = useQuery({
    queryKey: ["admin-results-lectures"],
    queryFn: () => fetchLectures({ is_active: undefined }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return lectures;
    const k = search.trim().toLowerCase();
    return lectures.filter(
      (l) =>
        (l.title && l.title.toLowerCase().includes(k)) ||
        (l.name && l.name.toLowerCase().includes(k)) ||
        (l.subject && l.subject.toLowerCase().includes(k))
    );
  }, [lectures, search]);

  const totalWidth = TABLE_COL.title + TABLE_COL.subject + TABLE_COL.medium + TABLE_COL.status + TABLE_COL.actions;

  return (
    <DomainLayout
      title="성적"
      description="강의·시험 단위 성적을 통합 조회합니다. 차시별 채점·성적은 각 강의 > 차시에서 확인하세요."
    >
      <div className="flex flex-col gap-4">
        <DomainListToolbar
          totalLabel={isLoading ? "…" : `총 ${filtered.length}개 강의`}
          searchSlot={
            <input
              className="ds-input"
              placeholder="강의명 · 과목 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={() => setSearch(searchInput)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              style={{ maxWidth: 280 }}
            />
          }
          primaryAction={
            <Button intent="primary" onClick={() => navigate("/admin/lectures")}>
              강의 목록
            </Button>
          }
        />

        {isLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : !filtered.length ? (
          <EmptyState
            scope="panel"
            tone="empty"
            title="강의가 없습니다"
            description="강의를 추가한 뒤, 각 강의 > 차시 > 성적 탭에서 시험·과제 성적을 관리할 수 있습니다."
            actions={
              <Button intent="primary" onClick={() => navigate("/admin/lectures")}>
                강의 목록
              </Button>
            }
          />
        ) : (
          <DomainTable tableClassName="ds-table--flat" tableStyle={{ tableLayout: "fixed", width: totalWidth }}>
            <colgroup>
              <col style={{ width: TABLE_COL.title }} />
              <col style={{ width: TABLE_COL.subject }} />
              <col style={{ width: TABLE_COL.medium }} />
              <col style={{ width: TABLE_COL.status }} />
              <col style={{ width: TABLE_COL.actions }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">강의명</th>
                <th scope="col">과목</th>
                <th scope="col">기간</th>
                <th scope="col">상태</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="cursor-pointer hover:bg-[var(--color-bg-surface-hover)]"
                  onClick={() => navigate(`/admin/lectures/${l.id}`)}
                >
                  <td className="font-semibold text-[var(--color-text-primary)] truncate" title={l.title || l.name}>
                    {l.title || l.name || "—"}
                  </td>
                  <td className="text-[var(--color-text-secondary)] truncate">{l.subject || "—"}</td>
                  <td className="text-[var(--color-text-muted)]">
                    {l.start_date && l.end_date
                      ? `${l.start_date} ~ ${l.end_date}`
                      : l.start_date || "—"}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: l.is_active ? STATUS_ACTIVE_COLOR : STATUS_INACTIVE_COLOR,
                      }}
                    >
                      {l.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <Button
                      intent="primary"
                      size="sm"
                      onClick={() => navigate(`/admin/lectures/${l.id}`)}
                    >
                      성적 보기
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DomainTable>
        )}
      </div>
    </DomainLayout>
  );
}

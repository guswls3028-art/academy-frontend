/**
 * 시험 (사이드바) — 전체 시험 목록 · 강의·차시 단위 시험 통합 조회
 * Design SSOT: students 도메인 (DomainLayout, DomainListToolbar, DomainTable ds-table--flat)
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchExams } from "../api/exams";
import { DomainLayout } from "@/shared/ui/layout";
import { DomainListToolbar, DomainTable, TABLE_COL, STATUS_ACTIVE_COLOR, STATUS_INACTIVE_COLOR } from "@/shared/ui/domain";
import { Button, EmptyState } from "@/shared/ui/ds";

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
}

export default function ExamAdminPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["admin-exams"],
    queryFn: () => fetchExams(),
  });

  // 클라이언트 검색: 시험명·과목
  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const k = search.trim().toLowerCase();
    return list.filter(
      (e) =>
        (e.title && e.title.toLowerCase().includes(k)) ||
        (e.subject && e.subject.toLowerCase().includes(k))
    );
  }, [list, search]);

  const totalWidth =
    TABLE_COL.title + TABLE_COL.subject + TABLE_COL.medium + TABLE_COL.short + TABLE_COL.status + TABLE_COL.medium + TABLE_COL.actions;

  return (
    <DomainLayout
      title="시험"
      description="강의·차시 단위 시험을 한 화면에서 조회합니다. 시험 생성·관리는 각 강의 > 차시에서 진행하세요."
    >
      <div className="flex flex-col gap-4">
        <DomainListToolbar
          totalLabel={isLoading ? "…" : `총 ${filtered.length}건`}
          searchSlot={
            <input
              className="ds-input"
              placeholder="시험명 · 과목 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={() => setSearch(searchInput)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              style={{ maxWidth: 280 }}
            />
          }
          primaryAction={
            <Button intent="primary" onClick={() => navigate("/admin/lectures")}>
              강의로 이동
            </Button>
          }
        />

        {isLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : !filtered.length ? (
          <EmptyState
            scope="panel"
            tone="empty"
            title="시험이 없습니다"
            description="각 강의 > 차시에서 시험을 추가하고 운영할 수 있습니다."
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
              <col style={{ width: TABLE_COL.short }} />
              <col style={{ width: TABLE_COL.status }} />
              <col style={{ width: TABLE_COL.medium }} />
              <col style={{ width: TABLE_COL.actions }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">시험명</th>
                <th scope="col">과목</th>
                <th scope="col">유형</th>
                <th scope="col">재응시</th>
                <th scope="col">상태</th>
                <th scope="col">개설일</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="cursor-pointer hover:bg-[var(--color-bg-surface-hover)]"
                  onClick={() => navigate("/admin/lectures")}
                >
                  <td className="font-semibold text-[var(--color-text-primary)] truncate" title={e.title}>
                    {e.title || "—"}
                  </td>
                  <td className="text-[var(--color-text-secondary)] truncate">{e.subject || "—"}</td>
                  <td className="text-[var(--color-text-secondary)]">
                    {e.exam_type === "template" ? "템플릿" : "일반"}
                  </td>
                  <td className="text-[var(--color-text-secondary)]">
                    {e.allow_retake ? `최대 ${e.max_attempts}회` : "불가"}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: e.is_active ? STATUS_ACTIVE_COLOR : STATUS_INACTIVE_COLOR,
                      }}
                    >
                      {e.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="text-[var(--color-text-muted)]">{formatDate(e.created_at)}</td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <Button
                      intent="ghost"
                      size="sm"
                      onClick={() => navigate("/admin/lectures")}
                    >
                      관리
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

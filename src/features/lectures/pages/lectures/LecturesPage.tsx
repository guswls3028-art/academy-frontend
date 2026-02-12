// PATH: src/features/lectures/pages/lectures/LecturesPage.tsx
// Design SSOT — students 도메인 패턴 준수

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import api from "@/shared/api/axios";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable, DEFAULT_PRESET_COLOR } from "@/shared/ui/domain";
import LectureCreateModal from "../../components/LectureCreateModal";

type LecturesPageProps = {
  tab?: "active" | "past";
};

type LectureItem = {
  id: number;
  title: string;
  subject?: string | null;
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  lecture_time?: string | null;
  color?: string | null;
  is_active?: boolean;
};

type TabKey = "active" | "past";

function isPastLecture(lec: LectureItem) {
  const activeFlag =
    typeof lec.is_active === "boolean" ? lec.is_active : undefined;
  if (activeFlag === false) return true;
  if (!lec.end_date) return false;

  const end = new Date(lec.end_date);
  if (Number.isNaN(end.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return end.getTime() < today.getTime();
}

export default function LecturesPage({ tab = "active" }: LecturesPageProps = {}) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data = [], isLoading, error, isFetching } = useQuery({
    queryKey: ["lectures"],
    queryFn: async (): Promise<LectureItem[]> => {
      const res = await api.get("/lectures/lectures/");
      const list = (res.data?.results ?? res.data) as LectureItem[] | any;
      return Array.isArray(list) ? list : [];
    },
  });

  const { activeLectures, pastLectures } = useMemo(() => {
    const active: LectureItem[] = [];
    const past: LectureItem[] = [];

    for (const lec of data) {
      if (isPastLecture(lec)) past.push(lec);
      else active.push(lec);
    }

    const toTime = (v?: string | null) => {
      if (!v) return 0;
      const t = new Date(v).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    active.sort((a, b) => toTime(b.start_date) - toTime(a.start_date));
    past.sort((a, b) => toTime(b.end_date) - toTime(a.end_date));

    return { activeLectures: active, pastLectures: past };
  }, [data]);

  function isLightColor(hex: string): boolean {
  const c = String(hex || "").toLowerCase();
  return ["#eab308", "#06b6d4"].includes(c);
}

  const list = useMemo(() => {
    const base = tab === "active" ? activeLectures : pastLectures;
    const keyword = q.trim().toLowerCase();
    if (!keyword) return base;

    return base.filter((lec) =>
      [
        lec.title,
        lec.subject ?? "",
        lec.name ?? "",
        lec.lecture_time ?? "",
        lec.start_date ?? "",
        lec.end_date ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [tab, activeLectures, pastLectures, q]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allIds = useMemo(() => list.map((l) => l.id), [list]);
  const allSelected = list.length > 0 && allIds.every((id) => selectedSet.has(id));

  function toggleSelect(id: number) {
    if (selectedSet.has(id)) setSelectedIds(selectedIds.filter((x) => x !== id));
    else setSelectedIds([...selectedIds, id]);
  }
  function toggleSelectAll() {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds([...allIds]);
  }

  const selectionBar = (
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
      <Button intent="secondary" size="sm" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
        선택 해제
      </Button>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        <DomainListToolbar
          totalLabel={
            isLoading ? "…" : isFetching ? "동기화 중…" : `총 ${list.length}개`
          }
          searchSlot={
            <input
              className="ds-input"
              placeholder="강의 검색 (강의명/과목/강사/기간)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: 360 }}
            />
          }
          primaryAction={
            <Button intent="primary" onClick={() => setShowModal(true)}>
              강의 추가
            </Button>
          }
          belowSlot={selectionBar}
        />

        <div>
          {isLoading ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
          ) : error ? (
            <EmptyState scope="panel" tone="error" title="에러가 발생했습니다." />
          ) : list.length === 0 ? (
            <EmptyState scope="panel" tone="empty" title="표시할 강의가 없습니다." />
          ) : (
            <div style={{ width: "fit-content" }}>
              <DomainTable tableClassName="ds-table--flat" tableStyle={{ tableLayout: "auto" }}>
                <colgroup>
                  <col style={{ width: 48 }} />
                  <col style={{ width: 192 }} />
                  <col />
                  <col />
                  <col style={{ width: 160 }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="ds-checkbox-cell" style={{ width: 48 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="전체 선택"
                        className="cursor-pointer"
                      />
                    </th>
                    <th scope="col">강의 이름</th>
                    <th scope="col">과목</th>
                    <th scope="col">강사</th>
                    <th scope="col">강의 시간</th>
                    <th scope="col">기간</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((lec) => (
                    <tr
                      key={lec.id}
                      onClick={() => navigate(`/admin/lectures/${lec.id}`)}
                      tabIndex={0}
                      role="button"
                      className={`cursor-pointer ${selectedSet.has(lec.id) ? "ds-row-selected" : ""}`}
                    >
                      <td className="ds-checkbox-cell" style={{ width: 48 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(lec.id)}
                          onChange={() => toggleSelect(lec.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`${lec.title} 선택`}
                          className="cursor-pointer"
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              flexShrink: 0,
                              display: "grid",
                              placeItems: "center",
                              fontSize: 12,
                              fontWeight: 800,
                              letterSpacing: "-0.02em",
                              color: isLightColor(lec.color || "") ? "#1a1a1a" : "#fff",
                              background: lec.color || DEFAULT_PRESET_COLOR,
                              border: "none",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                              textShadow: "0 0 1px rgba(0,0,0,0.2)",
                            }}
                          >
                            {(lec.title || "??").slice(0, 2)}
                          </span>
                          {lec.title}
                        </span>
                      </td>
                      <td>{lec.subject || "-"}</td>
                      <td>{lec.name || "-"}</td>
                      <td>{lec.lecture_time || "-"}</td>
                      <td style={{ fontWeight: 600 }}>
                        {lec.start_date && lec.end_date
                          ? `${lec.start_date} ~ ${lec.end_date}`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DomainTable>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <LectureCreateModal
          isOpen
          onClose={() => setShowModal(false)}
          usedColors={data?.map((l) => l.color).filter(Boolean) ?? []}
        />
      )}
    </>
  );
}

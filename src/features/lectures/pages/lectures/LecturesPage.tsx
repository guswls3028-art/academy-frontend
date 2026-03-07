// PATH: src/features/lectures/pages/lectures/LecturesPage.tsx
// Design: docs/DESIGN_SSOT.md (강의 관리만 체크박스 없음 — 유일 예외)

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";

import api from "@/shared/api/axios";
import { EmptyState, Button } from "@/shared/ui/ds";
import { DomainListToolbar, DomainTable, DEFAULT_PRESET_COLOR, TABLE_COL } from "@/shared/ui/domain";
import LectureCreateModal from "../../components/LectureCreateModal";
import LectureSettingsModal from "../../components/LectureSettingsModal";

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

/** 지난 강의 = is_active === false 인 경우만. 종료일 자동 이동 로직 없음. */
function isPastLecture(lec: LectureItem) {
  return lec.is_active === false;
}

export default function LecturesPage({ tab = "active" }: LecturesPageProps = {}) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [q, setQ] = useState("");

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
    past.sort((a, b) => toTime(b.start_date) - toTime(a.start_date));

    return { activeLectures: active, pastLectures: past };
  }, [data]);

  const [settingsLecture, setSettingsLecture] = useState<LectureItem | null>(null);
  const qc = useQueryClient();

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
              <DomainTable
                tableClassName="ds-table--flat"
                tableStyle={{
                  tableLayout: "fixed",
                  width: TABLE_COL.title + TABLE_COL.subject + TABLE_COL.medium + TABLE_COL.timeRange + TABLE_COL.dateRange + 56,
                }}
              >
                <colgroup>
                  <col style={{ width: TABLE_COL.title }} />
                  <col style={{ width: TABLE_COL.subject }} />
                  <col style={{ width: TABLE_COL.medium }} />
                  <col style={{ width: TABLE_COL.timeRange }} />
                  <col style={{ width: TABLE_COL.dateRange }} />
                  <col style={{ width: 56 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">강의 이름</th>
                    <th scope="col">과목</th>
                    <th scope="col">강사</th>
                    <th scope="col">강의 시간</th>
                    <th scope="col">기간</th>
                    <th scope="col" aria-label="설정" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((lec) => (
                    <tr
                      key={lec.id}
                      onClick={() => navigate(`/admin/lectures/${lec.id}`)}
                      tabIndex={0}
                      role="button"
                      className="cursor-pointer"
                    >
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
                          : lec.start_date
                            ? `${lec.start_date} ~`
                            : "-"}
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ verticalAlign: "middle", padding: "4px 8px" }}>
                        <button
                          type="button"
                          className="flex items-center justify-center w-9 h-9 rounded border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSettingsLecture(lec);
                          }}
                          aria-label="설정"
                        >
                          <Settings size={18} strokeWidth={2} />
                        </button>
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

      {settingsLecture && (
        <LectureSettingsModal
          open
          onClose={() => setSettingsLecture(null)}
          lecture={settingsLecture}
          isPast={tab === "past"}
          onEdit={(id) => {
            setSettingsLecture(null);
            navigate(`/admin/lectures/${id}`);
          }}
          onAfterEnd={() => {
            qc.invalidateQueries({ queryKey: ["lectures"] });
            navigate("/admin/lectures/past");
          }}
          onAfterRestore={() => qc.invalidateQueries({ queryKey: ["lectures"] })}
          onAfterDelete={() => qc.invalidateQueries({ queryKey: ["lectures"] })}
        />
      )}
    </>
  );
}

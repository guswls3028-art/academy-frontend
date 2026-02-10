// PATH: src/features/lectures/pages/lectures/LecturesPage.tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import api from "@/shared/api/axios";
import { EmptyState, Button } from "@/shared/ui/ds";
import LectureCreateModal from "../../components/LectureCreateModal";

type LectureItem = {
  id: number;
  title: string;
  subject?: string | null;
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
};

type TabKey = "active" | "past";

const TH_STYLE = {
  background:
    "color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface-hover))",
  color:
    "color-mix(in srgb, var(--color-brand-primary) 55%, var(--color-text-secondary))",
};

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

export default function LecturesPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [tab] = useState<TabKey>("active"); // UI 없이 내부 필터로만 사용
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
    past.sort((a, b) => toTime(b.end_date) - toTime(a.end_date));

    return { activeLectures: active, pastLectures: past };
  }, [data]);

  const list = useMemo(() => {
    const base = tab === "active" ? activeLectures : pastLectures;
    const keyword = q.trim().toLowerCase();
    if (!keyword) return base;

    return base.filter((lec) =>
      [
        lec.title,
        lec.subject ?? "",
        lec.name ?? "",
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
      {/* CARD HEADER (Students와 동일: 제목 + 검색만) */}
      <div className="px-5 py-4 border-b border-[var(--border-divider)]">
        <div className="text-base font-semibold mb-2">강의 목록</div>

        <input
          className="ds-input"
          placeholder="강의 검색 (강의명/과목/강사/기간)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* CARD ACTIONS (강의 추가 + 카운트만) */}
      <div className="px-5 py-3 flex items-center gap-2 border-b border-[var(--border-divider)]">
        <Button intent="primary" onClick={() => setShowModal(true)}>
          강의 추가
        </Button>

        <span className="ml-auto text-sm font-semibold text-[var(--color-text-muted)]">
          {isLoading
            ? "불러오는 중…"
            : isFetching
            ? "동기화 중…"
            : `${list.length}개`}
        </span>
      </div>

      {/* CARD BODY */}
      <div className="p-4">
        {isLoading ? (
          <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
        ) : error ? (
          <EmptyState scope="panel" tone="error" title="에러가 발생했습니다." />
        ) : list.length === 0 ? (
          <EmptyState scope="panel" tone="empty" title="표시할 강의가 없습니다." />
        ) : (
          <div
            style={{
              overflow: "hidden",
              borderRadius: 14,
              border: "1px solid var(--color-border-divider)",
            }}
          >
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th
                    className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                    style={{ textAlign: "left", ...TH_STYLE }}
                  >
                    강의 이름
                  </th>
                  <th
                    className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                    style={{ textAlign: "center", width: 140, ...TH_STYLE }}
                  >
                    과목
                  </th>
                  <th
                    className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                    style={{ textAlign: "center", width: 140, ...TH_STYLE }}
                  >
                    강사
                  </th>
                  <th
                    className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                    style={{ textAlign: "center", width: 240, ...TH_STYLE }}
                  >
                    기간
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--color-border-divider)]">
                {list.map((lec) => (
                  <tr
                    key={lec.id}
                    onClick={() => navigate(`/admin/lectures/${lec.id}`)}
                    tabIndex={0}
                    role="button"
                    className="cursor-pointer hover:bg-[var(--color-bg-surface-soft)]"
                  >
                    <td className="px-4 py-3 text-[15px] font-bold truncate">
                      {lec.title}
                    </td>
                    <td className="px-4 py-3 text-center text-[14px] truncate">
                      {lec.subject || "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-[14px] truncate">
                      {lec.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-[13px] font-semibold truncate">
                      {lec.start_date && lec.end_date
                        ? `${lec.start_date} ~ ${lec.end_date}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <LectureCreateModal
          isOpen
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

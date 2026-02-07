// PATH: src/features/lectures/pages/lectures/LecturesPage.tsx

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import api from "@/shared/api/axios";
import { PageHeader, Section, Panel } from "@/shared/ui/ds";

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
  const [tab, setTab] = useState<TabKey>("active");
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

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">
        로딩중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-500">
        에러가 발생했습니다.
      </div>
    );
  }

  return (
    <Section>
      <PageHeader
        title="강의 관리"
        description="강의 목록과 진행 상태를 관리합니다."
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-[var(--color-primary)] text-white"
          >
            강의 추가
          </button>
        }
      />

      <Panel>
        <div className="mb-4">
          <div className="flex gap-2 border-b border-[var(--border-divider)]">
            {(["active", "past"] as TabKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={[
                  "relative px-4 py-2 text-sm font-semibold rounded-t-lg",
                  tab === key
                    ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                {key === "active" ? "강의목록" : "지난강의"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <input
            className="w-72 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] px-3 py-2 text-sm"
            placeholder="강의 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {isFetching && (
            <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" />
          )}
        </div>

        {list.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--text-muted)]">
            표시할 강의가 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-[var(--bg-surface-soft)]">
              <tr>
                <th className="px-4 py-3 text-left">강의 이름</th>
                <th className="px-4 py-3 text-center">과목</th>
                <th className="px-4 py-3 text-center">강사</th>
                <th className="px-4 py-3 text-center">기간</th>
              </tr>
            </thead>
            <tbody>
              {list.map((lec) => (
                <tr
                  key={lec.id}
                  onClick={() => navigate(`${lec.id}`)}
                  className="cursor-pointer hover:bg-[var(--bg-surface-soft)]"
                >
                  <td className="px-4 py-3 font-semibold">{lec.title}</td>
                  <td className="px-4 py-3 text-center">{lec.subject || "-"}</td>
                  <td className="px-4 py-3 text-center">{lec.name || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    {lec.start_date && lec.end_date
                      ? `${lec.start_date} ~ ${lec.end_date}`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {showModal && (
        <LectureCreateModal onClose={() => setShowModal(false)} />
      )}
    </Section>
  );
}

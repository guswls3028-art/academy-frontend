// PATH: src/features/lectures/pages/lectures/LecturesPage.tsx

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import api from "@/shared/api/axios";
import { Page, PageHeader, PageSection } from "@/shared/ui/page";

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
  // ✅ 실무 기준: end_date가 과거면 past
  // + is_active가 false면 past 취급(서버가 내려주는 경우 대비)
  const activeFlag =
    typeof lec.is_active === "boolean" ? lec.is_active : undefined;

  if (activeFlag === false) return true;

  if (!lec.end_date) return false;

  const end = new Date(lec.end_date);
  if (Number.isNaN(end.getTime())) return false;

  // 날짜 비교(시간 영향 최소화)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return end.getTime() < today.getTime();
}

export default function LecturesPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  // ✅ 2중 구조 탭: 강의목록 | 지난강의
  const [tab, setTab] = useState<TabKey>("active");

  // ✅ 실무 UX: 로컬 검색(탭 내에서만 필터)
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

    // ✅ 정렬: 진행중은 최신 시작일(내림), 지난강의는 종료일 최신(내림)
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

    return base.filter((lec) => {
      const hay = [
        lec.title,
        lec.subject ?? "",
        lec.name ?? "",
        lec.start_date ?? "",
        lec.end_date ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(keyword);
    });
  }, [tab, activeLectures, pastLectures, q]);

  if (isLoading) return <Page>로딩중...</Page>;
  if (error) return <Page>에러가 발생했습니다.</Page>;

  const tabBtn = (key: TabKey, label: string, count: number) => {
    const active = tab === key;

    return (
      <button
        type="button"
        onClick={() => setTab(key)}
        className={[
          "relative px-4 py-2 text-sm font-semibold rounded-t-lg",
          "transition-all duration-200",
          active
            ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        ].join(" ")}
      >
        <span className="flex items-center gap-2">
          {label}
          <span
            className={[
              "inline-flex items-center justify-center",
              "min-w-[22px] h-[18px] px-1.5",
              "text-[11px] font-semibold rounded-full",
              active
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                : "bg-[var(--bg-surface-soft)] text-[var(--text-muted)] border border-[var(--border-divider)]",
            ].join(" ")}
          >
            {count}
          </span>
        </span>

        {active && (
          <span
            className="
              absolute left-0 right-0 -bottom-[1px]
              h-[2px] bg-[var(--color-primary)]
              rounded-full
            "
          />
        )}
      </button>
    );
  };

  return (
    <Page>
      <PageHeader
        title="강의 관리"
        description="강의 목록과 진행 상태를 관리합니다."
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="
              px-4 py-2 rounded-md text-sm font-semibold
              bg-[var(--color-primary)]
              text-white
              hover:opacity-90
              shadow-sm
            "
          >
            강의 추가
          </button>
        }
      />

      {/* ✅ 상단 탭 + 검색 (학생/클리닉 모티브) */}
      <PageSection
        className="
          rounded-2xl border border-[var(--border-divider)]
          bg-[var(--bg-surface)]
          overflow-hidden
        "
      >
        {/* 탭 헤더 */}
        <div className="px-4 pt-4">
          <div className="flex gap-2 border-b border-[var(--border-divider)]">
            {tabBtn("active", "강의목록", activeLectures.length)}
            {tabBtn("past", "지난강의", pastLectures.length)}
          </div>

          <div
            className="
              h-[3px] w-full
              bg-gradient-to-r
              from-[var(--color-primary)]/40
              via-transparent
              to-transparent
            "
          />
        </div>

        {/* 툴바 */}
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="
                flex items-center
                rounded-lg
                border border-[var(--border-divider)]
                bg-[var(--bg-app)]
                px-3
                focus-within:ring-1
                focus-within:ring-[var(--color-primary)]
              "
            >
              <input
                className="
                  w-72 max-w-full py-2 text-sm font-medium
                  bg-transparent
                  text-[var(--text-primary)]
                  placeholder:text-[var(--text-secondary)]
                  focus:outline-none
                "
                placeholder={
                  tab === "active"
                    ? "진행중 강의 검색 (강의명/과목/강사)"
                    : "지난 강의 검색 (강의명/과목/강사)"
                }
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              {isFetching && (
                <span className="ml-2 w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" />
              )}
            </div>

            <div className="text-xs text-[var(--text-muted)]">
              {tab === "active"
                ? "종료일이 지나지 않은 강의(또는 진행중)만 표시"
                : "종료일이 지난 강의 또는 비활성 강의만 표시"}
            </div>
          </div>
        </div>
      </PageSection>

      {/* ✅ 목록 카드 */}
      <PageSection
        className="
          mt-4
          rounded-2xl border border-[var(--border-divider)]
          bg-[var(--bg-surface)]
          overflow-hidden
        "
      >
        {list.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {tab === "active" ? "표시할 강의가 없습니다." : "지난 강의가 없습니다."}
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              {q.trim()
                ? "검색 조건을 변경해 보세요."
                : "강의를 추가하거나 기간/상태를 확인해 보세요."}
            </div>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border-divider)] bg-[var(--bg-surface-soft)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3 text-left">강의 이름</th>
                  <th className="px-4 py-3 text-center">과목</th>
                  <th className="px-4 py-3 text-center">강사</th>
                  <th className="px-4 py-3 text-center">기간</th>
                  <th className="px-4 py-3 text-center">상태</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--border-divider)]">
                {list.map((lec) => {
                  const past = isPastLecture(lec);

                  return (
                    <tr
                      key={lec.id}
                      onClick={() => navigate(`${lec.id}`)}
                      className="
                        cursor-pointer
                        hover:bg-[var(--bg-surface-soft)]
                        transition
                      "
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--text-primary)]">
                          {lec.title}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                          ID: {lec.id}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                        {lec.subject || "-"}
                      </td>

                      <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                        {lec.name || "-"}
                      </td>

                      <td className="px-4 py-3 text-center text-[var(--text-muted)]">
                        {lec.start_date && lec.end_date
                          ? `${lec.start_date} ~ ${lec.end_date}`
                          : lec.start_date && !lec.end_date
                          ? `${lec.start_date} ~`
                          : "-"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={[
                            "inline-flex items-center justify-center",
                            "px-2.5 py-1 rounded-full text-xs font-semibold",
                            past
                              ? "border border-[var(--border-divider)] bg-[var(--bg-surface-soft)] text-[var(--text-muted)]"
                              : "border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 text-[var(--color-success)]",
                          ].join(" ")}
                        >
                          {past ? "종료" : "진행중"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      {showModal && <LectureCreateModal onClose={() => setShowModal(false)} />}
    </Page>
  );
}

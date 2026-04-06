// PATH: src/features/lectures/components/SectionGroupedSessionList.tsx
/**
 * section_mode=true일 때 차시 ���록.
 *
 * 차시 번호가 섹션 구분 배너로 쓰이고,
 * 각 배너 아래에 A반/B반 블록이 나란히 표시.
 *
 * ── 1차시 ──────────────────
 *  [A반 04/08 수]  [B반 04/09 목]
 *
 * ── 2차시 ──────────────────
 *  [A반 04/15 수]  [B반 04/16 목]
 */
import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchSessions, type Session } from "../api/sessions";
import { fetchSections, type Section as SectionType } from "../api/sections";
import { EmptyState } from "@/shared/ui/ds";

const SECTION_TYPE_TABS = [
  { key: "CLASS", label: "수업" },
  { key: "CLINIC", label: "클리닉" },
] as const;

type SectionTypeFilter = "CLASS" | "CLINIC";

interface OrderGroup {
  order: number;
  title: string;
  /** 반 label 순으로 정렬된 세션 */
  sessions: Session[];
}

export default function SectionGroupedSessionList() {
  const navigate = useNavigate();
  const { lectureId } = useParams<{ lectureId: string }>();
  const lecId = Number(lectureId);

  const [typeFilter, setTypeFilter] = useState<SectionTypeFilter>("CLASS");

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<SectionType[]>({
    queryKey: ["lecture-sections", lecId],
    queryFn: () => fetchSections(lecId),
    enabled: Number.isFinite(lecId),
  });

  const { data: rawSessions = [], isLoading, isError } = useQuery<Session[]>({
    queryKey: ["lecture-sessions", lecId],
    queryFn: () => fetchSessions(lecId),
    enabled: Number.isFinite(lecId),
  });

  // 현재 타입의 반 목록 (label 순, 스케줄 참조용)
  const activeSections = useMemo(() => {
    return sections
      .filter((s) => s.section_type === typeFilter && s.is_active)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sections, typeFilter]);

  // 반 ID → Section 메타 맵
  const sectionMeta = useMemo(() => {
    const map = new Map<number, SectionType>();
    for (const s of sections) map.set(s.id, s);
    return map;
  }, [sections]);

  // order 기준 그룹핑 (현재 typeFilter에 해당하는 세션만)
  const groups = useMemo(() => {
    const filtered = rawSessions.filter((s) => {
      if (!s.section) return false;
      const meta = sectionMeta.get(s.section);
      return meta?.section_type === typeFilter;
    });

    const map = new Map<number, OrderGroup>();
    for (const s of filtered) {
      let g = map.get(s.order);
      if (!g) {
        g = { order: s.order, title: s.title, sessions: [] };
        map.set(s.order, g);
      }
      g.sessions.push(s);
    }

    const sorted = Array.from(map.values()).sort((a, b) => a.order - b.order);
    for (const g of sorted) {
      g.sessions.sort((a, b) =>
        (a.section_label ?? "").localeCompare(b.section_label ?? ""),
      );
    }
    return sorted;
  }, [rawSessions, sectionMeta, typeFilter]);

  // 반 수 (블록 그리드 폭 결정)
  const sectionCount = activeSections.length;

  if (!Number.isFinite(lecId)) {
    return (
      <div className="p-2 text-sm" style={{ color: "var(--color-error)" }}>
        강의 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const loading = isLoading || sectionsLoading;

  return (
    <div className="flex flex-col gap-4">
      {/* 수업 / 클리닉 탭 + 반 범례 */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-1 rounded-lg p-0.5"
          style={{ background: "var(--color-bg-surface-sunken)" }}
        >
          {SECTION_TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key as SectionTypeFilter)}
              className="px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors"
              style={{
                background:
                  typeFilter === tab.key
                    ? "var(--color-bg-surface)"
                    : "transparent",
                color:
                  typeFilter === tab.key
                    ? "var(--color-primary)"
                    : "var(--color-text-secondary)",
                boxShadow:
                  typeFilter === tab.key
                    ? "0 1px 2px rgba(0,0,0,0.06)"
                    : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 반 범례 */}
        {activeSections.length > 0 && (
          <div className="flex items-center gap-2">
            {activeSections.map((sec) => (
              <span
                key={sec.id}
                className="text-[12px] px-2 py-0.5 rounded-md"
                style={{
                  background: "var(--color-bg-surface-sunken)",
                  color: "var(--color-text-muted)",
                }}
              >
                {sec.label}반 · {sec.day_of_week_display}{" "}
                {sec.start_time?.slice(0, 5)} · {sec.assignment_count}명
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 콘텐츠 */}
      {loading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중..." />
      ) : isError ? (
        <EmptyState
          scope="panel"
          tone="error"
          title="차시 데이터를 불러올 수 없습니다."
        />
      ) : groups.length === 0 ? (
        <EmptyState
          scope="panel"
          tone="empty"
          title="등록된 차시가 없습니다."
          description="반별 차시를 추가하면 여기에 표시됩니다."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => (
            <div key={group.order}>
              {/* ── N차시 ──── 배너 */}
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="h-px flex-1"
                  style={{ background: "var(--color-border-divider)" }}
                />
                <span
                  className="text-[13px] font-bold whitespace-nowrap px-2"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {group.order}차시
                </span>
                {group.title !== `${group.order}차시` && (
                  <span
                    className="text-[12px] whitespace-nowrap"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {group.title}
                  </span>
                )}
                <div
                  className="h-px flex-1"
                  style={{ background: "var(--color-border-divider)" }}
                />
              </div>

              {/* 반별 블록 나란히 */}
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${sectionCount}, 1fr)`,
                }}
              >
                {/* activeSections 순서대로 매칭 — 없는 반은 빈 슬롯 */}
                {activeSections.map((sec) => {
                  const session = group.sessions.find(
                    (s) => s.section === sec.id,
                  );
                  if (!session) {
                    return (
                      <div
                        key={sec.id}
                        className="rounded-lg px-4 py-3 text-center text-[12px]"
                        style={{
                          border: "1px dashed var(--color-border-divider)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {sec.label}반 미등록
                      </div>
                    );
                  }
                  return (
                    <div
                      key={session.id}
                      onClick={() =>
                        navigate(
                          `/admin/lectures/${lectureId}/sessions/${session.id}`,
                        )
                      }
                      className="rounded-lg px-4 py-3 cursor-pointer transition-all hover:shadow-sm"
                      style={{
                        border: "1px solid var(--color-border-default)",
                        background: "var(--color-bg-surface)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor =
                          "var(--color-primary)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor =
                          "var(--color-border-default)")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* 반 뱃지 */}
                        <span
                          className="text-[13px] font-bold"
                          style={{ color: "var(--color-primary)" }}
                        >
                          {sec.label}반
                        </span>
                        {/* 날짜 */}
                        <span
                          className="text-[12px]"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {session.date || "-"}
                        </span>
                      </div>
                      {/* 요일 + 시간 */}
                      <div
                        className="text-[12px] mt-1"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {sec.day_of_week_display}{" "}
                        {sec.start_time?.slice(0, 5)}
                        {sec.end_time ? ` ~ ${sec.end_time.slice(0, 5)}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

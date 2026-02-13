// PATH: src/features/community/pages/MaterialsBoardPage.tsx
// 커뮤니티 자료실 — scope에 따라 목록

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCommunityScope } from "../context/CommunityScopeContext";
import {
  fetchCommunityMaterials,
  fetchCommunityMaterialCategories,
  type Material,
  type MaterialCategory,
} from "../api/community.api";
import { fetchLectures } from "@/features/lectures/api/sessions";
import { EmptyState, Button } from "@/shared/ui/ds";

export default function MaterialsBoardPage() {
  const { scope, sessionId, effectiveLectureId } = useCommunityScope();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const scopeParams = {
    scope,
    lectureId: effectiveLectureId ?? undefined,
    sessionId: sessionId ?? undefined,
  };

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures-list"],
    queryFn: () => fetchLectures({ is_active: true }),
  });

  const { data: categories = [] } = useQuery<MaterialCategory[]>({
    queryKey: ["community-material-categories", scope, effectiveLectureId, sessionId],
    queryFn: () => fetchCommunityMaterialCategories(scopeParams),
    enabled: true,
  });

  const { data: materials = [], isLoading } = useQuery<Material[]>({
    queryKey: ["community-materials", scope, effectiveLectureId, sessionId, selectedCategoryId],
    queryFn: () =>
      fetchCommunityMaterials({
        ...scopeParams,
        categoryId: selectedCategoryId ?? undefined,
      }),
    enabled: scope === "all" || (scope === "lecture" && effectiveLectureId != null) || (scope === "session" && sessionId != null),
  });

  const lectureTitleMap = useMemo(() => {
    const m = new Map<number, string>();
    lectures.forEach((l) => m.set(l.id, l.title));
    return m;
  }, [lectures]);

  if ((scope === "lecture" && effectiveLectureId == null) || (scope === "session" && (!effectiveLectureId || sessionId == null))) {
    return (
      <EmptyState
        scope="panel"
        title={scope === "session" ? "강의·차시를 선택하세요" : "강의를 선택하세요"}
        description={
          scope === "session"
            ? "노출 범위를 '세션별'로 두고 강의와 차시를 선택하면 해당 차시 자료를 볼 수 있습니다."
            : "노출 범위를 '강의별'로 두고 위에서 강의를 선택하면 해당 강의의 자료실을 관리할 수 있습니다."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-title)",
            color: "var(--color-text-muted)",
          }}
        >
          {scope === "all" ? "전체 자료" : scope === "session" ? "해당 차시 자료" : "해당 강의 자료"} · {materials.length}개
        </span>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            intent={selectedCategoryId === null ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedCategoryId(null)}
          >
            전체
          </Button>
          {categories.map((c) => (
            <Button
              key={c.id}
              intent={selectedCategoryId === c.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategoryId(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
      ) : materials.length === 0 ? (
        <EmptyState
          scope="panel"
          title="등록된 자료가 없습니다."
          description="강의별 또는 세션별 노출 범위에서 자료를 추가하거나, 통합 자료실에 자료를 등록할 수 있습니다."
        />
      ) : (
        <ul className="flex flex-col gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {materials.map((m) => (
            <li
              key={m.id}
              style={{
                padding: "var(--space-4)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border-divider)",
                background: "var(--color-bg-surface)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div
                    style={{
                      fontSize: "var(--text-md)",
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {m.title}
                  </div>
                  {m.description && (
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        color: "var(--color-text-secondary)",
                        marginTop: 4,
                      }}
                    >
                      {m.description}
                    </div>
                  )}
                  {scope === "all" && m.lecture != null && m.lecture && (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-muted)",
                        marginTop: 4,
                        display: "inline-block",
                      }}
                    >
                      {lectureTitleMap.get(m.lecture) ?? `강의 #${m.lecture}`}
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-muted)",
                      marginTop: 6,
                    }}
                  >
                    {new Date(m.created_at).toLocaleDateString("ko-KR")}
                    {m.file && (
                      <a
                        href={m.file}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2"
                        style={{ color: "var(--color-primary)" }}
                      >
                        파일
                      </a>
                    )}
                    {m.url && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2"
                        style={{ color: "var(--color-primary)" }}
                      >
                        링크
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

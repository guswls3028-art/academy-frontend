// PATH: src/features/lectures/pages/materials/MaterialsPage.tsx
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  fetchMaterialCategories,
  fetchMaterials,
  MaterialCategory,
  Material,
} from "../../api/materials";

import MaterialCategoryModal from "../../components/MaterialCategoryModal";
import MaterialUploadModal from "../../components/MaterialUploadModal";

import { EmptyState, Button } from "@/shared/ui/ds";

const TH_STYLE = {
  background: "color-mix(in srgb, var(--color-primary) 12%, var(--bg-surface))",
  color: "var(--color-text-muted)",
};

export default function MaterialsPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { data: categories = [], isLoading: loadingCats } = useQuery<MaterialCategory[]>({
    queryKey: ["material-categories", lectureIdNum],
    queryFn: () => fetchMaterialCategories(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  const { data: materials = [], isLoading: loadingMaterials } = useQuery<Material[]>({
    queryKey: ["materials", lectureIdNum, selectedCategory ?? "all"],
    queryFn: () =>
      fetchMaterials({
        lecture: lectureIdNum,
        category: selectedCategory ?? undefined,
      }),
    enabled: Number.isFinite(lectureIdNum),
  });

  const currentCategoryName = useMemo(() => {
    return selectedCategory === null
      ? "전체 자료"
      : categories.find((c) => c.id === selectedCategory)?.name ?? "전체 자료";
  }, [selectedCategory, categories]);

  return (
    <>
      {/* 상단 액션바 (중첩 카드 없이 단일 블록) */}
      <div className="flex items-center gap-2 mb-3">
        <Button intent="secondary" onClick={() => setShowCategoryModal(true)}>
          카테고리 추가
        </Button>
        <Button intent="primary" onClick={() => setShowUploadModal(true)}>
          자료 추가
        </Button>

        <span className="ml-auto text-sm font-semibold text-[var(--color-text-muted)]">
          {loadingMaterials ? "불러오는 중…" : `${materials.length}개`}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
        {/* LEFT */}
        <div
          style={{
            borderRadius: 18,
            padding: 12,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-muted)" }}>
              자료 분류
            </span>
            <Button intent="ghost" size="sm" onClick={() => setShowCategoryModal(true)}>
              + 추가
            </Button>
          </div>

          {loadingCats ? (
            <EmptyState mode="embedded" scope="panel" tone="loading" title="불러오는 중…" />
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              <Button
                intent={selectedCategory === null ? "secondary" : "ghost"}
                size="md"
                aria-pressed={selectedCategory === null}
                onClick={() => setSelectedCategory(null)}
                style={{ justifyContent: "flex-start" }}
              >
                전체 자료
              </Button>

              {categories.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <Button
                    key={cat.id}
                    intent={active ? "secondary" : "ghost"}
                    size="md"
                    aria-pressed={active}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{ justifyContent: "flex-start" }}
                  >
                    {cat.name}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div
          style={{
            borderRadius: 18,
            padding: 12,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-divider)",
            overflow: "hidden",
          }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text-secondary)" }}>
              {currentCategoryName}
            </div>
            <div style={{ fontSize: 11, fontWeight: 850, color: "var(--color-text-muted)" }}>
              {loadingMaterials ? "불러오는 중…" : `${materials.length}개`}
            </div>
          </div>

          {loadingMaterials ? (
            <EmptyState scope="panel" tone="loading" title="불러오는 중…" />
          ) : materials.length === 0 ? (
            <EmptyState
              title="등록된 자료가 없습니다."
              description="자료를 업로드하면 여기에 표시됩니다."
              scope="panel"
            />
          ) : (
            <div style={{ overflow: "hidden", borderRadius: 14, border: "1px solid var(--color-border-divider)" }}>
              <table className="w-full" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th
                      className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                      style={{ textAlign: "left", whiteSpace: "nowrap", ...TH_STYLE }}
                    >
                      제목
                    </th>
                    <th
                      className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                      style={{ textAlign: "center", whiteSpace: "nowrap", width: 160, ...TH_STYLE }}
                    >
                      등록자
                    </th>
                    <th
                      className="px-4 py-3 text-sm font-semibold border-b border-[var(--color-border-divider)]"
                      style={{ textAlign: "center", whiteSpace: "nowrap", width: 140, ...TH_STYLE }}
                    >
                      등록일
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-border-divider)]">
                  {materials.map((m) => (
                    <tr key={m.id} className="hover:bg-[var(--color-bg-surface-soft)]">
                      <td className="px-4 py-3 text-left text-[15px] font-bold truncate">
                        <a
                          href={m.file || m.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--color-primary)", fontWeight: 900 }}
                        >
                          {m.title}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-center text-[14px] text-[var(--color-text-secondary)] truncate">
                        {m.uploader_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-center text-[13px] font-semibold text-[var(--color-text-muted)] truncate">
                        {m.created_at?.slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCategoryModal && (
        <MaterialCategoryModal lectureId={lectureIdNum} onClose={() => setShowCategoryModal(false)} />
      )}

      {showUploadModal && (
        <MaterialUploadModal
          lectureId={lectureIdNum}
          categoryId={selectedCategory}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </>
  );
}

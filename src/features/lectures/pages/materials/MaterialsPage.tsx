// PATH: src/features/lectures/pages/materials/MaterialsPage.tsx

import { useState } from "react";
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

import { PageHeader, Section, Panel, EmptyState } from "@/shared/ui/ds";

export default function MaterialsPage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const lectureIdNum = Number(lectureId);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { data: categories = [] } = useQuery<MaterialCategory[]>({
    queryKey: ["material-categories", lectureIdNum],
    queryFn: () => fetchMaterialCategories(lectureIdNum),
    enabled: Number.isFinite(lectureIdNum),
  });

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["materials", lectureIdNum, selectedCategory ?? "all"],
    queryFn: () =>
      fetchMaterials({
        lecture: lectureIdNum,
        category: selectedCategory ?? undefined,
      }),
    enabled: Number.isFinite(lectureIdNum),
  });

  const currentCategoryName =
    selectedCategory === null
      ? "전체 자료"
      : categories.find((c) => c.id === selectedCategory)?.name ?? "전체 자료";

  return (
    <Section>
      <PageHeader
        title="강의 자료실"
        actions={
          <button
            onClick={() => setShowUploadModal(true)}
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm text-white"
          >
            자료 추가
          </button>
        }
      />

      <Panel>
        <div className="flex gap-6">
          {/* LEFT */}
          <div className="w-60 shrink-0 rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4 text-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                자료 분류
              </span>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                + 추가
              </button>
            </div>

            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full rounded-md px-3 py-2 text-left ${
                    selectedCategory === null
                      ? "bg-[var(--bg-surface-soft)] font-semibold text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
                  }`}
                >
                  전체 자료
                </button>
              </li>

              {categories.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full rounded-md px-3 py-2 text-left ${
                      selectedCategory === cat.id
                        ? "bg-[var(--bg-surface-soft)] font-semibold text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]"
                    }`}
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT */}
          <div className="flex-1 rounded-xl border border-[var(--border-divider)] bg-[var(--bg-surface)] p-6">
            <div className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
              {currentCategoryName}
            </div>

            {materials.length === 0 ? (
              <EmptyState
                title="등록된 자료가 없습니다."
                description="자료를 업로드하면 여기에 표시됩니다."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border border-[var(--border-divider)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-surface-soft)]">
                    <tr>
                      <th className="px-4 py-2 text-left">제목</th>
                      <th className="px-4 py-2 text-left">등록자</th>
                      <th className="px-4 py-2 text-left">등록일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => (
                      <tr
                        key={m.id}
                        className="border-t border-[var(--border-divider)] hover:bg-[var(--bg-surface-soft)]"
                      >
                        <td className="px-4 py-2">
                          <a
                            href={m.file || m.url || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-[var(--color-primary)] hover:underline"
                          >
                            {m.title}
                          </a>
                        </td>
                        <td className="px-4 py-2">
                          {m.uploader_name || "-"}
                        </td>
                        <td className="px-4 py-2">
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
      </Panel>

      {showCategoryModal && (
        <MaterialCategoryModal
          lectureId={lectureIdNum}
          onClose={() => setShowCategoryModal(false)}
        />
      )}

      {showUploadModal && (
        <MaterialUploadModal
          lectureId={lectureIdNum}
          categoryId={selectedCategory}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </Section>
  );
}

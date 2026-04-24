// PATH: src/app_admin/domains/clinic/components/ClinicSectionFilter.tsx
// section_mode=true 환경에서 클리닉 페이지에 표시하는 반 필터 드롭다운

import { useQuery } from "@tanstack/react-query";
import { useSectionMode } from "@/shared/hooks/useSectionMode";
import { fetchAllSections, type Section } from "@admin/domains/lectures/api/sections";

type Props = {
  value: number | null;
  onChange: (sectionId: number | null) => void;
};

export default function ClinicSectionFilter({ value, onChange }: Props) {
  const { sectionMode } = useSectionMode();

  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: ["all-sections"],
    queryFn: () => fetchAllSections(),
    enabled: sectionMode,
    staleTime: 60_000,
  });

  if (!sectionMode || sections.length === 0) return null;

  // 반 label 기준으로 정렬 (CLASS + CLINIC 모두 표시)
  const sorted = [...sections]
    .filter((s) => s.is_active)
    .sort((a, b) => {
      if (a.section_type !== b.section_type) return a.section_type === "CLASS" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

  return (
    <select
      className="clinic-section-filter"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">전체 반</option>
      {sorted.map((s) => (
        <option key={s.id} value={s.id}>
          {s.section_type === "CLINIC" ? "클리닉" : "수업"} {s.label}반
        </option>
      ))}
    </select>
  );
}

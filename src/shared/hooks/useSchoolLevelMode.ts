// PATH: src/shared/hooks/useSchoolLevelMode.ts
import { useMemo } from "react";
import { useProgram } from "@/shared/program";

export type SchoolType = "ELEMENTARY" | "MIDDLE" | "HIGH";
export type SchoolLevelMode = "middle_high" | "elementary_middle";

const MODE_CONFIG = {
  middle_high: {
    schoolTypes: ["MIDDLE", "HIGH"] as SchoolType[],
    defaultSchoolType: "HIGH" as SchoolType,
    labels: { MIDDLE: "중등", HIGH: "고등" } as Record<SchoolType, string>,
  },
  elementary_middle: {
    schoolTypes: ["ELEMENTARY", "MIDDLE"] as SchoolType[],
    defaultSchoolType: "MIDDLE" as SchoolType,
    labels: { ELEMENTARY: "초등", MIDDLE: "중등" } as Record<SchoolType, string>,
  },
} as const;

const GRADE_RANGES: Record<SchoolType, number[]> = {
  ELEMENTARY: [1, 2, 3, 4, 5, 6],
  MIDDLE: [1, 2, 3],
  HIGH: [1, 2, 3],
};

export function useSchoolLevelMode() {
  const { program } = useProgram();

  return useMemo(() => {
    const raw = program?.feature_flags?.school_level_mode;
    const mode: SchoolLevelMode =
      raw === "elementary_middle" ? "elementary_middle" : "middle_high";
    const config = MODE_CONFIG[mode];

    return {
      mode,
      schoolTypes: config.schoolTypes,
      defaultSchoolType: config.defaultSchoolType,
      labels: config.labels,
      /** school_type별 허용 학년 배열 반환 */
      gradeRange: (schoolType: SchoolType): number[] =>
        GRADE_RANGES[schoolType] ?? [1, 2, 3],
      /** 학교급 라벨 반환 (e.g., "고등", "초등") */
      getLabel: (schoolType: SchoolType): string =>
        config.labels[schoolType] ?? schoolType,
      /** 해당 school_type에 계열(track) 표시 여부 */
      showTrack: (schoolType: SchoolType): boolean => schoolType === "HIGH",
      /** 해당 school_type에 출신중학교 표시 여부 */
      showOriginMiddleSchool: (schoolType: SchoolType): boolean => schoolType === "HIGH",
    };
  }, [program]);
}

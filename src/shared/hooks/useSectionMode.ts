// PATH: src/shared/hooks/useSectionMode.ts
import { useMemo } from "react";
import { useProgram } from "@/shared/program";

export type ClinicMode = "remediation" | "regular";

export function useSectionMode() {
  const { program } = useProgram();

  return useMemo(() => {
    const sectionMode = Boolean(program?.feature_flags?.section_mode);
    const clinicMode: ClinicMode =
      program?.feature_flags?.clinic_mode === "regular" ? "regular" : "remediation";

    return {
      sectionMode,
      clinicMode,
    };
  }, [program]);
}

import { useState } from "react";
import { useAssessmentEditGuard } from "./AssessmentEditGuard";

export type WorkStep = "audience" | "materials" | "policy" | "submissions" | "results";
export type WorkSelection = { step: WorkStep | null; action?: string; focus?: boolean };

export function initialAssessmentStep(audience: number | undefined, material: string | undefined): WorkSelection {
  if (audience === 0) return { step: "audience" };
  if (material && ["processing", "review_required", "failed", "conversion_required"].includes(material)) {
    return { step: "materials" };
  }
  return { step: audience === undefined ? null : "submissions" };
}

export function useAssessmentWorklist(context: string, initial: WorkSelection) {
  const [view, setView] = useState<{ context: string; selection: WorkSelection } | null>(null);
  const { confirmDiscard } = useAssessmentEditGuard();
  const selection = view?.context === context ? view.selection : initial;

  async function select(next: WorkSelection) {
    if (next.step === selection.step && next.action === selection.action) return;
    if (await confirmDiscard()) setView({ context, selection: { ...next, focus: true } });
  }

  return { selection, select };
}

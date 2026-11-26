import { useState } from "react";
import { useAssessmentEditGuard } from "./AssessmentEditGuard";

export type WorkStep = "audience" | "materials" | "policy" | "submissions" | "results";
export type WorkSelection = { step: WorkStep | null; action?: string };

export function useAssessmentWorklist(context: string, initial: WorkSelection) {
  const [view, setView] = useState<{ context: string; selection: WorkSelection } | null>(null);
  const { confirmDiscard } = useAssessmentEditGuard();
  const selection = view?.context === context ? view.selection : initial;

  async function select(next: WorkSelection) {
    if (next.step === selection.step && next.action === selection.action) return;
    if (await confirmDiscard()) setView({ context, selection: next });
  }

  return { selection, select };
}

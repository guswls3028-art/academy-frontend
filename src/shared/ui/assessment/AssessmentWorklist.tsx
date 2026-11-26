import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button, ICON } from "@/shared/ui/ds";
import type { WorkSelection, WorkStep } from "./useAssessmentWorklist";
import styles from "./AssessmentWorklist.module.css";

export type WorkStage = {
  id: WorkStep;
  title: string;
  summary: string;
  actions: { id: string; label: string; content: ReactNode }[];
};

export default function AssessmentWorklist({ label, stages, selection, select }: {
  label: string;
  stages: WorkStage[];
  selection: WorkSelection;
  select: (next: WorkSelection) => void;
}) {
  const id = useId();
  return (
    <nav aria-label={label} className={styles.workspace}>
      <ol className={styles.list}>
        {stages.map((stage, index) => {
          const open = selection.step === stage.id;
          const active = open ? stage.actions.find(action => action.id === selection.action) : undefined;
          const headingId = id + "-" + stage.id;
          return (
            <li key={stage.id} data-stage={stage.id} className={styles.row} data-open={open}>
              <h3 className={styles.heading}>
                <button type="button" id={headingId} className={styles.toggle}
                  data-testid={"assessment-step-" + stage.id} aria-expanded={open} aria-controls={headingId + "-body"}
                  onClick={() => select({ step: open ? null : stage.id })}>
                  <span className={styles.number} aria-hidden>{index + 1}</span>
                  <span className={styles.copy}>
                    <span className={styles.name}>{stage.title}<ChevronDown size={ICON.sm} aria-hidden /></span>
                    <span className={styles.summary}>{stage.summary}</span>
                  </span>
                </button>
              </h3>
              <div id={headingId + "-body"} hidden={!open} role="region" aria-labelledby={headingId}>
                {open && <>
                  <div className={styles.actions}>
                    {stage.actions.map(action => (
                      <Button key={action.id} type="button" size="sm"
                        data-testid={"assessment-action-" + action.id}
                        intent={active?.id === action.id ? "primary" : "secondary"}
                        aria-pressed={active?.id === action.id}
                        onClick={() => select({ step: stage.id, action: action.id })}>
                        {action.label}
                      </Button>
                    ))}
                  </div>
                  {active && <div className={styles.detail}>{active.content}</div>}
                </>}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

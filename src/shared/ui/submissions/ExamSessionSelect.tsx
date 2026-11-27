import type { PendingSubmissionRow } from "@/shared/api/contracts/submissions";

type Choice = NonNullable<PendingSubmissionRow["session_choices"]>[number];

export default function ExamSessionSelect({ choices, selectedId, label, onSelect }: {
  choices: Choice[]; selectedId?: number | null; label: string; onSelect: (choice: Choice | undefined) => void;
}) {
  return <select aria-label={label} value={selectedId ?? ""} className="max-w-full text-xs"
    onChange={event => onSelect(choices.find(choice => choice.session_id === Number(event.target.value)))}>
    <option value="">{label} 선택</option>
    {choices.map(choice => <option key={choice.session_id} value={choice.session_id}>
      {choice.lecture_title} · {choice.session_title}
    </option>)}
  </select>;
}

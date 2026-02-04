// PATH: src/features/exams/panels/TemplateExamPanel.tsx
import { TemplateEditor } from "../components/TemplateEditor";

interface Props {
  examId: number;
}

export default function TemplateExamPanel({ examId }: Props) {
  return (
    <div className="max-w-4xl mx-auto">
      <TemplateEditor examId={examId} />
    </div>
  );
}

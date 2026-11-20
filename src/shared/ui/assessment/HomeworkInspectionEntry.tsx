import { lazy, Suspense, useState } from "react";
import { Button } from "@/shared/ui/ds";

const HomeworkInspectionPanel = lazy(() => import("./HomeworkInspectionPanel"));

export default function HomeworkInspectionEntry({ sessionId, homeworkId, title }: {
  sessionId: number; homeworkId: number; title: string;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" intent="secondary" onClick={() => setOpen(true)}>과제 검사</Button>
    {open && <Suspense fallback={<p role="status">과제 검사를 여는 중…</p>}>
      <HomeworkInspectionPanel sessionId={sessionId} homeworkId={homeworkId} title={title} onClose={() => setOpen(false)} />
    </Suspense>}
  </>;
}

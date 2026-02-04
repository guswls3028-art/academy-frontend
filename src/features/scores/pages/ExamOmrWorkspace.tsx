import { useState } from "react";
import SessionScoresPanel from "../panels/SessionScoresPanel";
import OmrSubmissionPanel from "../panels/OmrSubmissionPanel";

export default function ExamOmrWorkspace({
  sessionId,
}: {
  sessionId: number;
}) {
  const [submissionId, setSubmissionId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {submissionId && (
        <OmrSubmissionPanel submissionId={submissionId} />
      )}

      <SessionScoresPanel sessionId={sessionId} />
    </div>
  );
}

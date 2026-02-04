// components/ManualIdentifyForm.tsx
import { useState } from "react";
import { manualIdentifySubmission } from "../api/submissions";

export default function ManualIdentifyForm({
  submissionId,
}: {
  submissionId: number;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex gap-2">
      <input
        className="w-32 rounded border px-2 py-1 text-sm"
        placeholder="enrollment_id"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        className="rounded bg-black px-3 py-1 text-sm text-white"
        onClick={() =>
          manualIdentifySubmission(submissionId, Number(value))
        }
      >
        식별
      </button>
    </div>
  );
}

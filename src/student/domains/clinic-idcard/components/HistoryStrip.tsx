// PATH: src/student/domains/clinic-idcard/components/HistoryStrip.tsx

import type { ClinicIdcardHistoryItem as ClinicHistoryItem } from "../api/idcard";

export default function HistoryStrip({
  histories,
}: {
  histories: ClinicHistoryItem[];
}) {
  return (
    <div className="history-strip">
      {histories.map((h, idx) => (
        <div
          key={idx}
          className={`history-item ${h.clinic_required ? "fail" : "success"}`}
        >
          {h.session_order}차
        </div>
      ))}
    </div>
  );
}

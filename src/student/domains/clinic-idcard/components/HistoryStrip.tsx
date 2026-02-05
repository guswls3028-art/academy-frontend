// PATH: src/student/domains/clinic-idcard/components/HistoryStrip.tsx

import { ClinicHistoryItem } from "../pages/ClinicIDCardPage";

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
          className={`history-item ${h.result.toLowerCase()}`}
        >
          {h.week}차
        </div>
      ))}
    </div>
  );
}

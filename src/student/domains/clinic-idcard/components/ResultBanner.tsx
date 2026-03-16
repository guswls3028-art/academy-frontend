// PATH: src/student/domains/clinic-idcard/components/ResultBanner.tsx

import type { ClinicIdcardResult as ClinicResult } from "../api/idcard";

export default function ResultBanner({ result }: { result: ClinicResult }) {
  return (
    <div className={`result-banner ${result.toLowerCase()}`}>
      {result === "SUCCESS" ? "합격" : "클리닉 대상"}
    </div>
  );
}

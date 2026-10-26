const REASON_LABEL: Record<string, string> = {
  answer_blank_or_multi: "빈칸 또는 중복 마킹을 확인해 주세요.",
  answer_low_confidence: "마킹이 흐려 답안 확인이 필요합니다.",
  answer_score_ambiguous: "답안 표시가 겹쳐 있어 확인이 필요합니다.",
  answer_status_not_ok: "읽지 못한 답안을 확인해 주세요.",
  answer_count_mismatch: "읽은 문항 수가 시험과 다릅니다.",
  identifier_no_match: "학생 연결이 필요합니다.",
  identifier_no_enrollment_match: "학생 연결이 필요합니다.",
  identifier_incomplete: "식별번호를 확인하고 학생을 연결해 주세요.",
  identifier_missing: "식별번호를 확인하고 학생을 연결해 주세요.",
  identifier_invalid: "식별번호 형식을 확인하고 학생을 연결해 주세요.",
  identifier_fuzzy_match: "비슷한 학생이 있어 연결 대상을 확인해 주세요.",
  identifier_ambiguous_digit: "식별번호 한 자리가 불분명합니다.",
  duplicate_enrollment: "같은 학생의 답안지가 여러 장입니다.",
  alignment_failed: "답안지 방향을 맞추지 못했습니다. 다시 읽어 주세요.",
};

export function reasonLabel(reason: string): string {
  const raw = String(reason || "").trim();
  return REASON_LABEL[raw.toLowerCase()]
    || (/^[A-Z][A-Z0-9_:-]+$/.test(raw) ? "판독 결과 확인이 필요합니다." : raw)
    || "판독 결과 확인이 필요합니다.";
}

export function actionableReviewReasons(required: boolean | undefined, reasons: unknown): string[] {
  return required === true && Array.isArray(reasons)
    ? reasons.filter((reason): reason is string => typeof reason === "string" && reason.trim() !== "")
    : [];
}


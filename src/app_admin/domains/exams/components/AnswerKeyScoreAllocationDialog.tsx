import { useState } from "react";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";
import "./AnswerKeyScoreAllocationDialog.css";

export type ScoreGroup = "objective" | "subjective";
export type ScoreAllocationPlan =
  | { group: ScoreGroup; scores: number[]; adjustment: number }
  | { group: ScoreGroup; target: number | null };

type Group = {
  group: ScoreGroup;
  label: string;
  count: number;
  total: number;
  manualTarget?: number;
};
type Method = "integer" | "decimal" | "decimal-with-base" | "manual" | "keep";
type GroupDraft = { method: Method; total: string };

function previewAllocation(group: Group, { method, total }: GroupDraft, formatScore: (score: number) => string) {
  if (!group.count || method === "keep") return {};
  const manual = method === "manual";
  const input = total.trim();
  if (!input) {
    return manual ? { plan: { group: group.group, target: null } } : {};
  }

  const precision = manual ? 100 : method === "integer" ? 1 : 10;
  const target = Number(input);
  const units = Math.round(target * precision);
  if (!/^\d*(?:\.\d*)?$/.test(input) || !Number.isSafeInteger(units) || target < 0) {
    return { error: "0 이상의 숫자로 입력해 주세요." };
  }
  if (Math.abs(units / precision - target) > 1e-9) {
    const unitLabel = manual ? "소수 둘째 자리" : "소수 첫째 자리";
    return { error: precision === 1 ? "정수 총점을 입력하거나 소수 배점을 선택해 주세요." : `${unitLabel}까지 입력해 주세요.` };
  }
  if (manual) return { plan: { group: group.group, target } };

  const base = Math.floor(units / group.count);
  const remainder = units % group.count;
  const useBaseScore = method === "decimal-with-base";
  const higherCount = useBaseScore ? 0 : remainder;
  const lowerCount = group.count - higherCount;
  const adjustment = useBaseScore ? remainder / precision : 0;
  const scores = Array.from({ length: group.count }, (_, index) =>
    (base + (index >= lowerCount ? 1 : 0)) / precision,
  );
  return {
    plan: { group: group.group, scores, adjustment },
    target,
    breakdown: [
      `${lowerCount}문항 × ${formatScore(base / precision)}점`,
      ...(higherCount ? [`${higherCount}문항 × ${formatScore((base + 1) / precision)}점`] : []),
      ...(adjustment ? [`기본점수 ${formatScore(adjustment)}점`] : []),
    ].join(" + "),
    zeroCount: base === 0 ? lowerCount : 0,
  };
}

export default function AnswerKeyScoreAllocationDialog({
  groups,
  examMaxScore,
  disabled,
  formatScore,
  onClose,
  onApply,
}: {
  groups: Group[];
  examMaxScore: number;
  disabled: boolean;
  formatScore: (score: number) => string;
  onClose: () => void;
  onApply: (plans: ScoreAllocationPlan[]) => void;
}) {
  const [draft, setDraft] = useState<Record<string, GroupDraft>>(() => Object.fromEntries(
    groups.map(({ group, manualTarget }) => [
      group,
      { method: manualTarget === undefined ? "integer" : "manual", total: manualTarget === undefined ? "" : formatScore(manualTarget) },
    ]),
  ));
  const previews = groups.map((group) => previewAllocation(group, draft[group.group], formatScore));
  const plans = previews.flatMap(({ plan }) => plan ? [plan] : []);
  const nextTotal = groups.reduce((sum, group, index) => sum + (previews[index].target ?? group.total), 0);
  const hasMax = Number.isFinite(examMaxScore) && examMaxScore > 0;
  const hasAllocation = previews.some(({ target }) => target !== undefined);
  const maxMismatch = hasMax && Math.abs(examMaxScore - nextTotal) > 0.01;
  const canApply = !disabled && plans.length > 0 && !previews.some(({ error }) => error);

  return (
    <AdminModal open onClose={onClose} width={MODAL_WIDTH.form} zIndex={1050} noMinimize trapFocus>
      <ModalHeader
        title="자동 배점 설정"
        description="목표 총점을 입력한 유형에 배점을 나눕니다. 편집기에 적용한 뒤 답안을 저장하세요."
        noIcon
      />
      <ModalBody>
        <div className="answer-key-allocation">
          {groups.map(({ group, label, count, total }, index) => {
            const { method, total: target } = draft[group];
            const { error, breakdown, zeroCount } = previews[index];
            return (
              <fieldset className="answer-key-allocation__group" key={group} disabled={disabled}>
                <legend>{label} <span>{count}문항 · 현재 {formatScore(total)}점</span></legend>
                {count === 0 ? (
                  <p>문항 수를 적용하면 배점을 설정할 수 있습니다.</p>
                ) : (
                  <>
                    <div className="answer-key-allocation__fields">
                      <label className="answer-key-field">
                        <span className="answer-key-field__label">배점 방식</span>
                        <select
                          className="ds-select"
                          aria-label={`${label} 배점 방식`}
                          value={method}
                          onChange={(event) => setDraft((prev) => ({
                            ...prev, [group]: { ...prev[group], method: event.target.value as Method },
                          }))}
                        >
                          <option value="integer">정수로 나누기</option>
                          <option value="decimal">소수 1자리로 나누기</option>
                          <option value="decimal-with-base">같은 배점 + 기본점수</option>
                          <option value="manual">직접 배점 · 목표만 설정</option>
                          <option value="keep">현재 배점 유지</option>
                        </select>
                      </label>
                      {method !== "keep" && (
                        <label className="answer-key-field">
                          <span className="answer-key-field__label">목표 총점</span>
                          <input
                            className="ds-input"
                            aria-label={`${label} 목표 총점`}
                            aria-invalid={Boolean(error)}
                            aria-describedby={`answer-key-allocation-${group}-preview`}
                            inputMode="decimal"
                            placeholder={method === "manual" ? "선택 입력" : "비워두면 유지"}
                            value={target}
                            onChange={(event) => setDraft((prev) => ({
                              ...prev, [group]: { ...prev[group], total: event.target.value },
                            }))}
                          />
                        </label>
                      )}
                    </div>
                    <div id={`answer-key-allocation-${group}-preview`} className="answer-key-allocation__preview" aria-live="polite">
                      {error && <p className="answer-key-allocation__error">{error}</p>}
                      {breakdown && <p><strong>{breakdown}</strong></p>}
                      {Boolean(zeroCount) && <p>0점 문항이 {zeroCount}개 생깁니다.</p>}
                      {method === "manual" && <p>편집기에서 문항별로 점수를 입력하고 목표 총점에 맞춰 저장합니다.</p>}
                      {method === "decimal-with-base" && <p>남는 점수는 정답 여부와 관계없이 기본점수로 부여합니다.</p>}
                      {method === "keep" && <p>이 유형의 문항 배점과 기본점수를 유지합니다.</p>}
                    </div>
                  </>
                )}
              </fieldset>
            );
          })}
          <div className="answer-key-allocation__summary" aria-live="polite">
            <strong>{hasAllocation ? "적용 후 합계" : "현재 합계"} {formatScore(nextTotal)}점</strong>
            {hasMax && <span>시험 만점 {formatScore(examMaxScore)}점</span>}
            {hasAllocation && maxMismatch && <p>적용 후 배점 합계가 시험 만점과 다릅니다.</p>}
            {hasAllocation && <p>자동 배점하는 유형의 기존 배점과 기본점수가 바뀝니다.</p>}
          </div>
        </div>
      </ModalBody>
      <ModalFooter right={(
        <>
          <Button intent="secondary" onClick={onClose}>취소</Button>
          <Button intent="primary" disabled={!canApply} onClick={() => onApply(plans)}>편집기에 적용</Button>
        </>
      )} />
    </AdminModal>
  );
}

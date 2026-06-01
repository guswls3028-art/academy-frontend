export const CHOICE_LABELS = ["1", "2", "3", "4", "5"];

const CIRCLED_CHOICE_MAP: Record<string, string> = {
  "①": "1",
  "②": "2",
  "③": "3",
  "④": "4",
  "⑤": "5",
};

const ALTERNATIVE_SEPARATOR_RE = /\s*(?:[|]|또는|혹은|\bor\b)\s*/i;
const REQUIRED_SET_SEPARATOR_RE = /\s*(?:[,;&+])\s*/;

function normalizeChoiceToken(value: string): string {
  const token = String(value ?? "").trim();
  return CIRCLED_CHOICE_MAP[token] ?? token;
}

function uniqueChoiceTokens(tokens: string[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    if (CHOICE_LABELS.includes(token) && !out.includes(token)) out.push(token);
  }
  return out;
}

export function requiredChoiceTokens(value: string): string[] {
  return uniqueChoiceTokens(
    String(value ?? "")
      .split(REQUIRED_SET_SEPARATOR_RE)
      .map(normalizeChoiceToken),
  );
}

export function choiceAnswerSets(value: string): string[][] {
  const text = String(value ?? "").trim();
  if (!text) return [];
  return text
    .split(ALTERNATIVE_SEPARATOR_RE)
    .map(requiredChoiceTokens)
    .filter((tokens) => tokens.length > 0);
}

export function choiceTokens(value: string): string[] {
  return uniqueChoiceTokens(choiceAnswerSets(value).flat());
}

export function isChoiceAnswer(value: string): boolean {
  return choiceAnswerSets(value).length > 0;
}

export function formatChoiceAnswer(tokens: string[]): string {
  const selected = new Set(tokens);
  return CHOICE_LABELS.filter((choice) => selected.has(choice)).join(",");
}

export function choiceAnswerMatches(answer: string, correct: string): boolean {
  const answerSet = requiredChoiceTokens(answer);
  if (answerSet.length === 0) return false;

  const answerKey = formatChoiceAnswer(answerSet);
  return choiceAnswerSets(correct).some((correctSet) => (
    formatChoiceAnswer(correctSet) === answerKey
  ));
}

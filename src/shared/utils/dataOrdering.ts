const koreanTextCollator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});

export function compareKoreanText(left: string | null | undefined, right: string | null | undefined) {
  return koreanTextCollator.compare(String(left ?? "").trim(), String(right ?? "").trim());
}

export function compareNullableNumbers(
  left: number | null | undefined,
  right: number | null | undefined,
  direction: "asc" | "desc" = "asc",
) {
  const leftValue = typeof left === "number" && Number.isFinite(left) ? left : null;
  const rightValue = typeof right === "number" && Number.isFinite(right) ? right : null;
  if (leftValue == null && rightValue == null) return 0;
  if (leftValue == null) return 1;
  if (rightValue == null) return -1;
  return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
}

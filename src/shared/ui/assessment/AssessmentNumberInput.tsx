import type { InputHTMLAttributes } from "react";

/** Keep Windows IME in a text context when moving between titles and scores.
 * Chromium maps both type=number and inputMode=decimal/numeric to a numeric
 * Windows TSF input scope, so changing the input type alone is insufficient.
 */
export function AssessmentNumberInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode">,
) {
  const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.platform);
  return <input {...props} type="text" inputMode={isWindows ? "text" : "decimal"} />;
}

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export default function ResourceFormula({ text }: { text: string }) {
  const html = useMemo(() => katex.renderToString(text.slice(0, 20000), {
    throwOnError: false, trust: false, strict: "ignore", maxExpand: 1000, maxSize: 10,
    output: "htmlAndMathml", displayMode: false,
  }), [text]);
  // KaTeX escapes the input and forbids trusted HTML/link/image commands above.
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

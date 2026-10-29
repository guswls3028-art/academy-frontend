/** Editable rows use student-specific variables; no canned message is supplied. */
export function scoreMessageItems(values: Record<string, string> = {}) {
  return Object.keys(values)
    .map(key => key.match(/^(시험|과제)(\d+)명$/))
    .filter((match): match is RegExpMatchArray => Boolean(match && values[match[0]]))
    .sort((a, b) => (a[1] === b[1] ? Number(a[2]) - Number(b[2]) : a[1] === "시험" ? -1 : 1))
    .map(match => ({
      kind: match[1],
      number: Number(match[2]),
      name: values[match[0]],
      text: `#{${match[1]}${match[2]}명}: #{${match[1]}${match[2]}결과}`,
    }));
}

/** Open existing saved aggregate blocks as editable rows, without writing the saved template. */
export function expandScoreMessageBlocks(body: string, values: Record<string, string> = {}): string {
  const items = scoreMessageItems(values);
  if (!items.length) return body;
  const exams = items.filter(item => item.kind === "시험").map(item => item.text).join("\n");
  const homework = items.filter(item => item.kind === "과제").map(item => item.text).join("\n");
  const replacements: Record<string, string> = {
    시험목록: exams, 시험이력: exams, 과제목록: homework,
    시험성적: [exams && `[시험]\n${exams}`, homework && `[과제]\n${homework}`, "[요약]\n#{전체요약}"].filter(Boolean).join("\n\n"),
  };
  return body.replace(/#\{(시험성적|시험목록|시험이력|과제목록)\}/g, (_, name: string) => replacements[name]);
}

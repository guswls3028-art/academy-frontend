const GRADES_ENVELOPE_CONTEXT_KEYS = ["강의명", "차시명"] as const;

function extractTemplateVars(body: string): string[] {
  const matches = body.match(/#\{([^}]+)\}/g) ?? [];
  return [...new Set(matches.map((match) => match.slice(2, -1)))];
}

export function compactGradesPayloadVars(
  body: string,
  vars?: Record<string, string>,
): Record<string, string> | undefined {
  if (!vars) return undefined;
  const requiredKeys = new Set([...GRADES_ENVELOPE_CONTEXT_KEYS, ...extractTemplateVars(body)]);
  const compact = Object.fromEntries(
    Object.entries(vars).filter(([key]) => requiredKeys.has(key)),
  );
  return Object.keys(compact).length > 0 ? compact : undefined;
}

export function compactGradesPerStudentPayloadVars(
  body: string,
  vars?: Record<number, Record<string, string>>,
): Record<number, Record<string, string>> | undefined {
  if (!vars) return undefined;
  const requiredKeys = new Set(extractTemplateVars(body));
  const compact = Object.fromEntries(
    Object.entries(vars).map(([studentId, studentVars]) => {
      const substitutedBody = studentVars._body_subst;
      const compactStudentVars = substitutedBody
        ? { _body_subst: substitutedBody }
        : Object.fromEntries(
            Object.entries(studentVars).filter(([key]) => requiredKeys.has(key)),
          );
      return [studentId, compactStudentVars];
    }),
  ) as Record<number, Record<string, string>>;
  return Object.keys(compact).length > 0 ? compact : undefined;
}

import ts from 'typescript';

// One audited synchronous page-exit transport lives in the central API owner.
// Additional calls, different paths, functions or files remain refactor debt.
export function approvedEmptyScoreExitFetchCount(relativePath, text) {
  if (relativePath !== 'src/shared/api/axios.ts') return 0;
  const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true);
  let allowed = 0;
  for (const statement of source.statements) {
    if (!ts.isFunctionDeclaration(statement) || statement.name?.text !== 'releaseEmptyScoreDraftOnPageExit') continue;
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch'
        && node.arguments[0]?.getText(source) === '`${API_BASE}/api/v1/results/admin/sessions/${sessionId}/score-draft/commit/`') allowed++;
      ts.forEachChild(node, visit);
    };
    visit(statement);
  }
  return Math.min(allowed, 1);
}

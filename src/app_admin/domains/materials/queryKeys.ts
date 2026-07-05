// PATH: src/app_admin/domains/materials/queryKeys.ts

export const adminMaterialsQueryKeys = {
  sheets: ["materials-sheets"] as const,
  sheet: (sheetId: number) => ["materials-sheet", sheetId] as const,
  sheetQuestions: (sheetId: number) => ["materials-sheet-questions", sheetId] as const,
  sheetAnswerKey: (sheetId: number) => ["materials-sheet-answerkey", sheetId] as const,
  sheetAssets: (sheetId: number) => ["materials-sheet-assets", sheetId] as const,
  submissions: (examId: number) => ["materials-submissions", examId] as const,
};

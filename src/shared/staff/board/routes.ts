export const boardRoot = "/workspace/staff-board";
export const mobileBoardRoot = "/workspace/mobile/staff-board";
export const boardSearchLimit = 100;

export function boardListParams(q: string, page = 1) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return params;
}

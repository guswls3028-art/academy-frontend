export function examEntrySession(raw: string | null): number | undefined {
  const id = Number(raw);
  return raw && /^\d+$/.test(raw) && Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export function entrySessionSearch(sessionId?: number | null): string {
  return sessionId && Number.isSafeInteger(sessionId) && sessionId > 0 ? `?entry_session_id=${sessionId}` : "";
}

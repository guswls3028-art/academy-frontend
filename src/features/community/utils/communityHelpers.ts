// PATH: src/features/community/utils/communityHelpers.ts
// Shared helper functions for community pages (Board, Materials, Notice, QnA)

/**
 * Strip HTML tags and return plain text content.
 */
export function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

/**
 * Extract initials from a name for avatar display.
 * Single-word names return first 2 chars; multi-word returns first + last initial.
 */
export function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[parts.length - 1][0];
}

/**
 * Deterministic avatar color slot (0–4) based on name hash.
 */
export function getAvatarSlot(name: string): number {
  return [...(name ?? "")].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5;
}

/**
 * Relative time string in Korean (e.g. "3분 전", "2시간 전", "5일 전").
 */
export function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
  if (diff < 60) return `${Math.max(1, Math.floor(diff))}분 전`;
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
  return `${Math.floor(diff / 1440)}일 전`;
}

/**
 * Format byte count into human-readable size (B / KB / MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

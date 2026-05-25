// PATH: src/app_admin/domains/community/utils/communityHelpers.ts
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
  const ts = new Date(dateStr).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = (Date.now() - ts) / 60000;
  if (diff < 60) return `${Math.max(1, Math.floor(diff))}분 전`;
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
  return `${Math.floor(diff / 1440)}일 전`;
}

/**
 * Normalize student display name — raw IDs or empty → "학생".
 */
export function normalizeStudentName(name: string | null | undefined): string {
  if (!name || !name.trim()) return "학생";
  const trimmed = name.trim();
  // 숫자만 (예: "알테44" 같은 자동생성 이름은 허용, 순수 숫자 ID만 차단)
  if (/^\d+$/.test(trimmed)) return "학생";
  return trimmed;
}

export function communityAuthorContextQueryKey(studentId: number | null | undefined) {
  return ["community-author-context", studentId] as const;
}

export function toLectureChips(enrollments?: Array<{
  lectureName?: string | null;
  lectureColor?: string | null;
  lectureChipLabel?: string | null;
}>) {
  return enrollments?.map((en) => ({
    lectureName: en.lectureName,
    color: en.lectureColor,
    chipLabel: en.lectureChipLabel,
  }));
}

export function summarizeLectureNames(enrollments?: Array<{ lectureName?: string | null }>) {
  const names = Array.from(new Set(
    enrollments
      ?.map((en) => en.lectureName?.trim())
      .filter((name): name is string => Boolean(name)) ?? [],
  ));
  if (names.length === 0) return null;
  const visible = names.slice(0, 3).join(" · ");
  return names.length > 3 ? `${visible} 외 ${names.length - 3}개` : visible;
}

/**
 * Format byte count into human-readable size (B / KB / MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

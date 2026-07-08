import type { StudentVideoListItem } from "../api/video.api";

const NUMBERED_SUFFIX_RE = /^(.+?)\s*(?:-|–|—)\s*(\d{1,6})\s*$/;

function parseNumberedSuffix(title: string | null | undefined): { baseKey: string; number: number } | null {
  const match = (title || "").trim().match(NUMBERED_SUFFIX_RE);
  if (!match) return null;
  const base = match[1].trim();
  if (!base) return null;
  return { baseKey: base.toLocaleLowerCase("ko-KR"), number: Number(match[2]) };
}

export function sortStudentVideos(items: StudentVideoListItem[]): StudentVideoListItem[] {
  const anchors = new Map<string, { order: number; title: string; id: number }>();

  for (const item of items) {
    const parsed = parseNumberedSuffix(item.title);
    if (!parsed) continue;
    const anchor = {
      order: item.order ?? 0,
      title: (item.title || "").toLocaleLowerCase("ko-KR"),
      id: item.id ?? 0,
    };
    const current = anchors.get(parsed.baseKey);
    if (
      !current ||
      anchor.order < current.order ||
      (anchor.order === current.order && anchor.title.localeCompare(current.title, "ko") < 0) ||
      (anchor.order === current.order && anchor.title === current.title && anchor.id < current.id)
    ) {
      anchors.set(parsed.baseKey, anchor);
    }
  }

  return [...items].sort((a, b) => {
    const pa = parseNumberedSuffix(a.title);
    const pb = parseNumberedSuffix(b.title);
    const ka = playlistKey(a, pa, anchors);
    const kb = playlistKey(b, pb, anchors);
    for (let i = 0; i < ka.length; i++) {
      const av = ka[i];
      const bv = kb[i];
      if (typeof av === "string" || typeof bv === "string") {
        const cmp = String(av).localeCompare(String(bv), "ko");
        if (cmp !== 0) return cmp;
      } else if (av !== bv) {
        return Number(av) - Number(bv);
      }
    }
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

function playlistKey(
  item: StudentVideoListItem,
  parsed: { baseKey: string; number: number } | null,
  anchors: Map<string, { order: number; title: string; id: number }>
): Array<number | string> {
  const order = item.order ?? 0;
  const title = (item.title || "").toLocaleLowerCase("ko-KR");
  const id = item.id ?? 0;
  if (parsed) {
    const anchor = anchors.get(parsed.baseKey) ?? { order, title, id };
    return [anchor.order, anchor.title, 0, parsed.number, order, id];
  }
  return [order, title, 1, 0, order, id];
}

export type SiteType = "hakwonplus" | "limglish";

export function getSiteType(): SiteType {
  const host = window.location.hostname;

  if (
    host === "limglish.kr" ||
    host === "www.limglish.kr"
  ) {
    return "limglish";
  }

  return "hakwonplus";
}

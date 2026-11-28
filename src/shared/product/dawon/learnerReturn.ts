export function dawonStudyReturn(menu: "exam" | "video" | "notices" | "clinic", params = new URLSearchParams(window.location.search)) {
  if (window.location.hostname !== "demo.hakwonplus.com") return null;
  const guardian = params.get("preview") === "guardian";
  if (guardian && menu !== "exam") return null;
  const from = params.get("from");
  if (from === "menu") return "/learn/" + menu + (guardian ? "?preview=guardian" : "");
  const date = params.get("date") ?? "";
  if (from !== "home" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) return null;
  return (guardian ? "/guardian" : "/") + "?view=" + (params.get("period") === "month" ? "month" : "week") + "&date=" + date + "#dw-home-calendar";
}

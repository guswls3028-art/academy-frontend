export type DawonClassKind = "union" | "school";
export const dawonUnionTracks = ["1%", "HYPER", "SKY"] as const;

export type ClassType = "" | DawonClassKind | (typeof dawonUnionTracks)[number];
export type DawonClassOption = { id: number; name: string; kind: DawonClassKind; track: string };

export function matchesDawonClassType(group: DawonClassOption | undefined, type: string) {
  if (type === "") return true;
  if (type === "union" || type === "school") return group?.kind === type;
  return group?.kind === "union" && group.track === type;
}

export function readDawonClassType(value: string | null): ClassType {
  if (value === "union" || value === "school") return value;
  return dawonUnionTracks.find((track) => track === value) ?? "";
}

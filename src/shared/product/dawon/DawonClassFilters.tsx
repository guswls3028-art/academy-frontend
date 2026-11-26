import LectureChipLabel from "@/shared/ui/chips/LectureChipLabel";
import { Badge } from "@/shared/ui/ds";
import { dawonUnionTracks, type DawonClassKind } from "./classTypes";

type ClassType = "" | DawonClassKind | (typeof dawonUnionTracks)[number];
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

export function DawonClassTypeSelect({value, onChange}: {value: string; onChange: (value: ClassType) => void}) {
  const union=value==="union" || dawonUnionTracks.some(track=>track===value);
  return <><label>반 구분 <select className="ds-select" value={union?"union":value} onChange={e=>onChange(readDawonClassType(e.target.value))}>
    <option value="">전체</option><option value="union">연합반</option><option value="school">내신반</option>
  </select></label>
  {union && <label>연합반 과정 <select className="ds-select" value={value} onChange={e=>onChange(readDawonClassType(e.target.value))}>
    <option value="union">전체 과정</option>{dawonUnionTracks.map(track=><option key={track}>{track}</option>)}
  </select></label>}</>;
}

export function DawonClassSelect({groups, value, onChange, required=false, unassigned=false}: {
  groups: DawonClassOption[]; value: string; onChange: (value: string) => void; required?: boolean; unassigned?: boolean;
}) {
  return <label>반 선택 <select className="ds-select" value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">{required ? "조회할 반 선택" : "전체 반"}</option>
    {unassigned && <option value="null">미편성</option>}
    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
  </select></label>;
}

const unionTones = { "1%": "info", HYPER: "teal", SKY: "complement" } as const;

export function DawonClassBadge({group}: {group: DawonClassOption}) {
  const track = dawonUnionTracks.find((option) => option === group.track);
  const tone = group.kind === "school" ? "warning" : track ? unionTones[track] : "neutral";
  return <Badge tone={tone}>
    {group.kind === "union" ? (group.track || "연합반") : "학교별 내신반"}
  </Badge>;
}


const classColors=["#8d451c","#27664e","#385e91","#6e4988","#8a5434","#356670","#814756"];
export function DawonClassLabel({group}:{group:Pick<DawonClassOption,"id"|"name">}) {
  return <LectureChipLabel lectureName={group.name} color={classColors[group.id % classColors.length]} chipLabel={String(group.id)} />;
}

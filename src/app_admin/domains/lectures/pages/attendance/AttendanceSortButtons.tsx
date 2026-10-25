import { Button } from "@/shared/ui/ds";
import { DEFAULT_ATTENDANCE_SORT, type AttendanceSort } from "./attendanceSort";

export default function AttendanceSortButtons({ sort, onChange }: {
  sort: AttendanceSort;
  onChange: (sort: AttendanceSort) => void;
}) {
  return <>
    <Button
      type="button"
      intent={sort === "name" ? "primary" : "secondary"}
      size="sm"
      aria-pressed={sort === "name"}
      title="이름 뒤 A·B도 포함해 가나다순으로 표시합니다."
      onClick={() => onChange(DEFAULT_ATTENDANCE_SORT)}
    >
      가나다순
    </Button>
    <Button
      type="button"
      intent={sort === "not_arrived" ? "primary" : "secondary"}
      size="sm"
      aria-pressed={sort === "not_arrived"}
      title="미입력·결석 학생을 먼저 표시합니다. 출결을 저장하면 순서가 갱신됩니다."
      onClick={() => onChange(sort === "not_arrived" ? DEFAULT_ATTENDANCE_SORT : "not_arrived")}
    >
      미도착 우선
    </Button>
  </>;
}

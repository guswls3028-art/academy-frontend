import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { dawonQueryKeys } from "./queryKeys";

type Summary = {
  id: number; name: string; lesson_count: number; total: number; marked: number;
  unset: number; missing: number; absent: number;
};
type Lesson = {
  id: number; title: string; order: number; course_id:number; course: string;
  students: { enrollment: number; name: string; status: string | null }[];
};
type Attendance = {
  groups: Summary[]; group_name: string | null; lessons: Lesson[]; status_labels: Record<string, string>;
};
export const todayInSeoul = () => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export function useDawonDailyAttendance(day: string, group: string | null) {
  const request: Record<string, string> = {view: "attendance", date: day};
  if (group !== null) request.group = group;
  return useQuery({
    queryKey: dawonQueryKeys.adminLearning(request),
    queryFn: async ({signal}) => (await api.get<Attendance>("/students/demo-operations/", {params: request, signal})).data,
  });
}

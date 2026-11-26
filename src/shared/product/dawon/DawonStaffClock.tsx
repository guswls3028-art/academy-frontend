import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { Button } from "@/shared/ui/ds";
import styles from "./DawonStaff.module.css";

const endpoint = "/students/demo-staff/clock/";
const staffDetailKey = ["dawon","admin","staff-directory"] as const;
const payrollKey = ["dawon","admin","payroll"] as const;
const clockKey = ["dawon","teacher","own-clock"] as const;
type Clock = {staff: string; current: {id: number; date: string; start_time: string} | null};

export default function DawonStaffClock({staff}: {staff?: {id: number; name: string}} = {}) {
  const url = staff ? "/students/demo-staff/" + staff.id + "/clock/" : endpoint;
  const key = staff ? ["dawon", "admin", "staff-clock", staff.id] : clockKey;
  const title = staff ? staff.name + " 출퇴근" : "내 출퇴근";
  const client = useQueryClient();
  const query = useQuery({queryKey: key, queryFn: async ({signal}) => (await api.get<Clock>(url,{signal})).data});
  const mutation = useMutation({mutationFn: async (record: number | null) => (await api.post<Clock>(url,
    record === null ? {action:"start"} : {action:"end",record})).data,
    onSuccess: data => {
      client.setQueryData(key, data);
      if (staff) {
        void client.invalidateQueries({queryKey: staffDetailKey});
        void client.invalidateQueries({queryKey: payrollKey});
      }
    },
    onError: () => {void query.refetch();}});
  const current = query.data?.current;
  return <section aria-label={title} className={styles.clock}><h2>{title}</h2>
    {query.isPending ? <p role="status">출근 기록을 확인하는 중입니다.</p> : query.isError || !query.data ?
      <p role="alert">근태를 불러오지 못했습니다. <Button onClick={() => void query.refetch()}>다시 시도</Button></p> :
      <><span role="status">{current ? current.date + " " + current.start_time.slice(0,5) + " 출근 · 근무 중" : "근무 중인 기록이 없습니다."}</span>
      <Button disabled={mutation.isPending} onClick={() => mutation.mutate(current?.id ?? null)}>{current ? "퇴근하기" : "출근하기"}</Button></>}
    {mutation.isSuccess && !mutation.data.current && <p role="status">퇴근을 기록했습니다.</p>}
    {mutation.isError && <p role="alert">{getApiErrorMessage(mutation.error,"근태를 저장하지 못했습니다. 다시 시도해 주세요.")}</p>}
  </section>;
}

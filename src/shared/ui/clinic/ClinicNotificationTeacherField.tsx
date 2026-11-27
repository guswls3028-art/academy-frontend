import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { clinicNotificationTeachersQuery } from "@/shared/api/clinicNotificationTeachers";
import styles from "./ClinicNotificationTeacherField.module.css";

type Props = { value: number | null; onChange: (value: number | null) => void };

export default function ClinicNotificationTeacherField({ value, onChange }: Props) {
  const id = useId();
  const teachers = useQuery(clinicNotificationTeachersQuery());
  return <div className={styles.field}>
    <label htmlFor={id}>예약 알림을 받을 담당 선생님 (선택)</label>
    <select id={id} value={value ?? ""} aria-describedby={id + "-hint"}
      disabled={teachers.isLoading || teachers.isError} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">지정 안 함</option>
      {value !== null && !teachers.data?.some((teacher) => teacher.id === value) && <option value={value}>기존 담당 선생님</option>}
      {teachers.data?.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
    </select>
    <small id={id + "-hint"}>{teachers.isLoading ? "선생님 목록을 불러오는 중…" : teachers.isError
      ? <span role="alert">선생님 목록을 불러오지 못했습니다. <button type="button" onClick={() => void teachers.refetch()}>선생님 목록 다시 불러오기</button></span>
      : teachers.data?.length ? "학원 자동발송과 클리닉 예약 알림톡이 켜져 있으면 지정한 선생님도 예약 안내를 받습니다." : "알림을 받을 휴대폰 번호가 등록된 선생님이 없습니다."}</small>
  </div>;
}

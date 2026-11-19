import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScanLine } from "lucide-react";
import { fetchLectures } from "@/shared/api/contracts/sessions";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import styles from "./AttendanceQrManager.module.css";

const Manager = lazy(() => import("./AttendanceQrManager").then(module => ({ default: module.QrManagerDialog })));

export default function DashboardAttendanceQr() {
  const [open, setOpen] = useState(false);
  const [lectureId, setLectureId] = useState<number | null>(null);
  const [showCode, setShowCode] = useState(false);
  const lectures = useQuery({
    queryKey: ["attendance-qr", "active-lectures"],
    queryFn: () => fetchLectures({ is_active: true }),
    enabled: open,
  });
  const options = lectures.data?.filter(row => row.is_active && !row.is_system) ?? [];
  const selected = options.find(row => row.id === lectureId) ?? (options.length === 1 ? options[0] : undefined);
  return <div>
    <Button leftIcon={<ScanLine size={ICON_FOR_BUTTON.md} />} onClick={() => { setShowCode(false); setOpen(true); }}>수업 출석 QR</Button>
    {open && (showCode && selected ? <Suspense fallback={<p role="status">QR을 여는 중…</p>}>
      <Manager kind="class" lectureId={selected.id} lectureTitle={selected.title || selected.name} onClose={() => setOpen(false)} />
    </Suspense> : <AdminModal open onClose={() => setOpen(false)} width={460} noMinimize trapFocus>
      <ModalHeader title="수업 출석 QR" description="강의를 선택해 학생에게 QR을 보여 주거나 인쇄하세요." />
      <ModalBody>{lectures.isPending ? <p role="status">강의를 불러오는 중…</p> : lectures.isError ? <div role="alert">강의 목록을 불러오지 못했습니다. <Button onClick={() => void lectures.refetch()}>다시 시도</Button></div>
        : options.length ? <label className={styles.field}>출석할 강의<select value={selected?.id ?? ""} onChange={e => setLectureId(Number(e.target.value))}>
          <option value="">강의 선택</option>{options.map(row => <option key={row.id} value={row.id}>{row.title || row.name}</option>)}
        </select></label> : <p>출석 QR을 발급할 운영 중인 강의가 없습니다.</p>}</ModalBody>
      <ModalFooter right={<Button intent="primary" disabled={!selected || lectures.isError} onClick={() => setShowCode(true)}>QR 열기</Button>} />
    </AdminModal>)}
  </div>;
}

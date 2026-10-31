import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCode } from "antd";
import { Printer, ScanLine } from "lucide-react";
import api from "@/shared/api/axios";
import { qrUrl, type QrKind, type QrPoint } from "@/shared/api/contracts/attendanceQr";
import { Button, ICON_FOR_BUTTON } from "@/shared/ui/ds";
import { AdminModal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/modal";
import { useConfirm } from "@/shared/ui/confirm";
import { extractApiError } from "@/shared/utils/extractApiError";
import styles from "./AttendanceQrManager.module.css";

type Props = { kind: QrKind; lectureId?: number };
const endpoint = "/lectures/attendance-qr/";

export default function AttendanceQrManager({ kind, lectureId }: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <Button size="sm" leftIcon={<ScanLine size={ICON_FOR_BUTTON.sm} />} onClick={() => setOpen(true)}>출결 QR 출력</Button>
    {open && <QrManagerDialog kind={kind} lectureId={lectureId} onClose={() => setOpen(false)} />}
  </>;
}

function QrManagerDialog({ kind, lectureId, onClose }: Props & { onClose: () => void }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const poster = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState(kind === "clinic" ? "클리닉 등원·하원" : "수업 출석");
  const [location, setLocation] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const queryKey = ["attendance-qr", kind, lectureId];
  const points = useQuery({
    queryKey,
    queryFn: async () => (await api.get<QrPoint[]>(endpoint, { params: { kind, lecture_id: lectureId } })).data,
  });
  const selected = points.data?.find((point) => point.id === selectedId) ?? points.data?.[0];
  const mutation = useMutation({
    mutationFn: async ({ mode, point }: { mode: "create" | "rotate" | "toggle"; point?: QrPoint }) => {
      if (mode === "create") return (await api.post<QrPoint>(endpoint, {
        label: label.trim(), kind, lecture_id: kind === "class" ? lectureId : null,
        location: kind === "clinic" ? location.trim() : "",
      })).data;
      if (!point) throw new Error("QR을 먼저 선택해 주세요.");
      return mode === "rotate"
        ? (await api.post<QrPoint>(`${endpoint}${point.id}/rotate/`)).data
        : (await api.patch<QrPoint>(`${endpoint}${point.id}/`, { active: !point.active })).data;
    },
    onSuccess: async (point) => {
      setSelectedId(point.id); setError("");
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => setError(extractApiError(err, "QR을 저장하지 못했습니다. 입력을 확인하고 다시 시도해 주세요.")),
  });

  const print = () => {
    if (!poster.current || !selected?.active) return;
    const frame = document.createElement("iframe");
    frame.title = "출결 QR 인쇄";
    frame.style.cssText = "position:fixed;width:1px;height:1px;right:0;bottom:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    if (!doc || !view) { frame.remove(); setError("인쇄창을 열지 못했습니다. 브라우저에서 다시 시도해 주세요."); return; }
    doc.title = `${selected.label} 출결 QR`;
    const style = doc.createElement("style");
    style.textContent = "@page{size:A4;margin:20mm}body{font-family:Arial,sans-serif;color:#111;text-align:center}main{padding:20mm 0}h2{font-size:32px;margin:0 0 16px}p{font-size:18px;line-height:1.8}svg{width:85mm!important;height:85mm!important}main>div{margin:12mm auto!important;width:fit-content!important;padding:8mm!important;background:white!important}small{display:block;font-size:14px;margin-top:10mm}";
    doc.head.appendChild(style);
    const main = doc.createElement("main");
    main.append(...Array.from(poster.current.childNodes).map((node) => doc.importNode(node, true)));
    doc.body.appendChild(main);
    view.addEventListener("afterprint", () => frame.remove(), { once: true });
    void doc.fonts.ready.then(() => {
      view.focus(); view.print();
      window.setTimeout(() => frame.remove(), 120_000);
    }).catch(() => { frame.remove(); setError("인쇄 준비에 실패했습니다. 다시 시도해 주세요."); });
  };

  const changePoint = async (mode: "rotate" | "toggle") => {
    if (!selected) return;
    const accepted = await confirm({
      title: mode === "rotate" ? "새 QR로 교체" : selected.active ? "QR 사용 중지" : "QR 다시 사용",
      message: mode === "rotate"
        ? `‘${selected.label}’의 기존 인쇄물은 사용할 수 없게 됩니다. 새 QR을 출력해 교체해 주세요.`
        : selected.active ? `‘${selected.label}’로 새 출석을 기록할 수 없게 됩니다. 기존 출결 기록은 보존됩니다.` : `‘${selected.label}’ 인쇄물을 다시 사용할 수 있게 됩니다.`,
      confirmText: mode === "rotate" ? "새 QR 발급" : selected.active ? "사용 중지" : "다시 사용",
    });
    if (accepted) mutation.mutate({ mode, point: selected });
  };

  return <AdminModal open onClose={onClose} width={680} noMinimize trapFocus closeDisabled={mutation.isPending}>
    <ModalHeader title="출결 QR 출력" description={kind === "clinic" ? "확정된 클리닉 예약의 등원·하원을 학생이 직접 기록합니다." : "이 강의의 당일 등록 차시에 학생이 직접 출석합니다."} />
    <ModalBody><div className={styles.content}>
      {points.isPending ? <p role="status">QR을 불러오는 중…</p> : points.isError ? <div role="alert"><p>QR 목록을 불러오지 못했습니다.</p><Button onClick={() => { void points.refetch(); }}>다시 불러오기</Button></div> : <>
        {Boolean(points.data?.length) && <label className={styles.field}>발급한 QR<select value={selected?.id ?? ""} onChange={(event) => setSelectedId(Number(event.target.value))}>
          {points.data?.map((point) => <option key={point.id} value={point.id}>{point.label}{point.location ? ` · ${point.location}` : ""}{!point.active ? " (사용 중지)" : ""}</option>)}
        </select></label>}
        {selected ? <>
          <div ref={poster} className={styles.poster} aria-label="출결 QR 인쇄 미리보기">
            <h2>{selected.label}</h2>
            <p>{kind === "clinic" ? (selected.location || "전체 클리닉 장소") : "오늘 수업 출석"}</p>
            {selected.active ? <QRCode type="svg" value={qrUrl(selected.token)} size={240} bordered={false} level="M" /> : <p>사용이 중지된 QR입니다.</p>}
            <p>학생앱 로그인 → QR 출석 → 카메라 스캔</p>
            <p>{kind === "clinic" ? "들어올 때 등원 · 나갈 때 하원" : "출석 완료 화면을 확인하고 입실해 주세요."}</p>
            <small>학생 본인 계정으로 이용해 주세요.</small>
          </div>
          <div className={styles.actions}>
            <Button intent="primary" disabled={!selected.active || mutation.isPending} leftIcon={<Printer size={ICON_FOR_BUTTON.md} />} onClick={print}>QR 인쇄·PDF 저장</Button>
            <Button disabled={mutation.isPending} onClick={() => { void changePoint("rotate"); }}>새 QR로 교체</Button>
            <Button disabled={mutation.isPending} onClick={() => { void changePoint("toggle"); }}>{selected.active ? "사용 중지" : "다시 사용"}</Button>
          </div>
        </> : <p>QR을 발급한 뒤 출력해 교실 문에 붙여 주세요.</p>}
        <details open={!selected} className={styles.create}><summary>새 출결 QR 만들기</summary>
          <form onSubmit={(event) => { event.preventDefault(); setError(""); mutation.mutate({ mode: "create" }); }}>
            <label className={styles.field}>인쇄할 이름<input required maxLength={100} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="예: 301호 수업 출석" /></label>
            {kind === "clinic" && <label className={styles.field}>클리닉 장소<input maxLength={100} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="비우면 모든 클리닉 장소" /><small>일정에 등록된 장소 이름과 정확히 같게 입력해 주세요. 비우면 이 학원의 모든 장소에서 사용할 수 있습니다.</small></label>}
            <Button type="submit" intent="primary" loading={mutation.isPending} disabled={!label.trim()}>QR 발급</Button>
          </form>
        </details>
        <p className={styles.note}>이 QR은 매일 다시 출력할 필요가 없습니다. 수업은 당일 차시 등록, 클리닉은 확정 예약과 이용 시간을 확인합니다. 교사가 입력한 출결과 학습 완료는 덮어쓰지 않습니다. 인쇄된 QR은 공유될 수 있으므로 실제 현장 확인이 필요한 경우 출결표와 함께 확인해 주세요.</p>
      </>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div></ModalBody>
    <ModalFooter right={<Button disabled={mutation.isPending} onClick={onClose}>닫기</Button>} />
  </AdminModal>;
}

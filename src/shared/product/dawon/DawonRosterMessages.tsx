import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { Button } from "@/shared/ui/ds";
import { AdminModal, ModalBody, ModalFooter, ModalHeader, MODAL_WIDTH } from "@/shared/ui/modal";

type Template = { id: string; name: string; body: string };
type Audience = "student" | "parent";
type Receipt = { id: number; batch_id: string; template_name: string; body: string; recipient_count: number; audience: Audience; created_at: string };
type Mailbox = { templates: Template[]; receipts: Receipt[] };
const endpoint = "/students/demo-messages/";
const queryKey = ["dawon", "admin", "demo-messages"] as const;
const formatTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });

export default function DawonRosterMessages({ students }: { students: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"compose" | "history">("compose");
  const [choice, setChoice] = useState("");
  const [audience, setAudience] = useState<Audience>("parent");
  const [recent, setRecent] = useState("");
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const client = useQueryClient();
  const mailbox = useQuery({ queryKey, enabled: open, queryFn: async ({signal}) =>
    (await api.get<Mailbox>(endpoint, {signal})).data });
  const template = mailbox.data?.templates.find(t => t.id === choice) ?? mailbox.data?.templates[0];
  const send = useMutation({ mutationFn: async () => {
    if (!students.length || !template) throw new Error("학생과 양식을 선택하세요.");
    const ids = students.map(s => s.id).sort((a, b) => a - b);
    const key = JSON.stringify([ids, audience, template.id]);
    const batch = attempt.current?.key === key ? attempt.current : { key, id: crypto.randomUUID() };
    attempt.current = batch;
    return (await api.post<Receipt>(endpoint, { request_id: batch.id, student_ids: ids, template_id: template.id, audience })).data;
  }, onSuccess: async receipt => {
    setRecent(receipt.batch_id);
    attempt.current = null;
    setTab("history");
    await client.invalidateQueries({queryKey});
  }});
  return <>
    <Button onClick={() => { send.reset(); setRecent(""); setTab(students.length ? "compose" : "history"); setOpen(true); }}>알림톡</Button>
    {open && <AdminModal open trapFocus noMinimize width={MODAL_WIDTH.md} closeDisabled={send.isPending} onClose={() => setOpen(false)}>
      <ModalHeader title="알림톡" description="체험용 발송은 다원 데모 내역에 저장됩니다."/>
      <ModalBody><div className="flex gap-2 mb-4">
        <Button aria-pressed={tab === "compose"} onClick={() => setTab("compose")} disabled={send.isPending}>발송 작성</Button>
        <Button aria-pressed={tab === "history"} onClick={() => setTab("history")} disabled={send.isPending}>발송 내역</Button>
      </div>
      {mailbox.isPending ? <p role="status">양식과 내역을 불러오는 중입니다.</p> : mailbox.isError ?
        <p role="alert">발송 정보를 불러오지 못했습니다. <Button onClick={() => void mailbox.refetch()}>다시 시도</Button></p> :
        tab === "compose" ? <div className="grid gap-3">
          <p>{students.length ? students[0].name + (students.length > 1 ? " 외 " + (students.length - 1) + "명" : "") : "학생 명단에서 수신할 학생을 먼저 선택하세요."}</p>
          <label>수신 대상<select className="ds-select" value={audience} onChange={e => setAudience(e.target.value as Audience)}><option value="parent">학부모</option><option value="student">학생</option></select></label>
          <label>알림톡 양식<select className="ds-select" value={template?.id ?? ""} onChange={e => setChoice(e.target.value)}>
            {mailbox.data.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          {template && <section aria-label="본문 미리보기"><strong>본문 미리보기</strong><p className="whitespace-pre-line">{template.body}</p></section>}
        </div> : <div className="grid gap-3">
          {recent && <p role="status">데모 발송을 기록했습니다.</p>}
          {mailbox.data.receipts.length ? mailbox.data.receipts.map(r => <details key={r.batch_id} className="border-b pb-2">
            <summary>{r.template_name} · {r.audience === "student" ? "학생" : "학부모"} {r.recipient_count}명 · {formatTime.format(new Date(r.created_at))}</summary>
            <p className="whitespace-pre-line">{r.body}</p>
          </details>) : <p>아직 기록된 데모 발송이 없습니다.</p>}
        </div>}
        {send.isError && <p role="alert">{getApiErrorMessage(send.error, "발송 기록을 저장하지 못했습니다. 다시 시도하세요.")}</p>}
      </ModalBody>
      <ModalFooter right={tab === "compose" && students.length > 0 ? <Button intent="primary" loading={send.isPending} disabled={!template || mailbox.isError} onClick={() => send.mutate()}>{students.length}명에게 데모 발송</Button> :
        <Button onClick={() => setOpen(false)}>{tab === "compose" ? "학생 선택하기" : "닫기"}</Button>}/>
    </AdminModal>}
  </>;
}

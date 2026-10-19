import { useQuery } from "@tanstack/react-query";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { extractApiError } from "@/shared/utils/extractApiError";
import { isFixedAlimtalkContent } from "@/shared/messaging/alimtalkEnvelope";
import { messageTemplateEditorQueryKey } from "@/shared/notifications/messageTemplateQueryKey";
import { fetchMessageTemplate } from "../api/messages.api";
import TemplateEditModal, { type TemplateEditModalProps } from "./TemplateEditModal";

/** One mounted session per open. List snapshots are never editable source data. */
export default function TemplateLibraryEditor(props: TemplateEditModalProps) {
  const id = props.initial?.id;
  const source = useQuery({
    queryKey: messageTemplateEditorQueryKey("admin", id),
    queryFn: () => fetchMessageTemplate(id!),
    enabled: id != null,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  if (id != null && (!source.data || source.isFetching || source.isError)) {
    return <AdminModal open onClose={props.onClose} width={560} trapFocus>
      <ModalHeader title="문구 불러오기" />
      <ModalBody>
        {source.isError
          ? <p role="alert">{extractApiError(source.error, "현재 저장된 문구를 불러오지 못했습니다.")}</p>
          : <p role="status">현재 저장된 문구를 불러오는 중입니다…</p>}
      </ModalBody>
      <ModalFooter right={<>
        <Button intent="secondary" onClick={props.onClose}>닫기</Button>
        {source.isError && <Button onClick={() => void source.refetch()}>다시 불러오기</Button>}
      </>} />
    </AdminModal>;
  }
  const template = source.data;
  const fixed = isFixedAlimtalkContent(template?.category, template?.name);
  return <TemplateEditModal {...props} initial={template ?? null}
    readOnly={props.readOnly || Boolean(fixed && !props.copy)}
    heading={fixed && !props.copy ? "안내 내용 보기" : props.heading}
    onDuplicate={fixed ? undefined : props.onDuplicate}
    description={fixed && !props.copy
      ? "이 알림은 승인된 고정 안내문으로 발송합니다. 이전에 저장된 본문은 발송 문구에 반영되지 않습니다."
      : props.description} />;
}

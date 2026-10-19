import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminModal, ModalBody, ModalFooter, ModalHeader } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { extractApiError } from "@/shared/utils/extractApiError";
import {
  AUTO_SEND_TRIGGER_LABELS,
  createMessageTemplate,
  fetchAutoSendConfigs,
  fetchMessageTemplate,
  updateAutoSendConfigs,
  updateMessageTemplate,
  type MessageTemplateItem,
  type MessageTemplatePayload,
} from "../api/messages.api";
import { getAlimtalkTemplateType, isAlimtalkTemplateBodyEditable } from "../constants/alimtalkEnvelope";
import { messageQueryKeys } from "../queryKeys";
import { AUTO_SEND_SECTIONS } from "./AutoSendSectionTree";
import TemplateEditModal from "./TemplateEditModal";

/** Mounted for one editing session. Never initialize from the template-list cache. */
export default function AutoSendTemplateEditor({ trigger, onClose }: {
  trigger: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // Retain a successfully created copy if connecting it fails, so retry never
  // creates a second copy or claims that the old automatic body was replaced.
  const savedCopy = useRef<MessageTemplateItem | null>(null);
  const title = AUTO_SEND_TRIGGER_LABELS[trigger] ?? "자동발송";
  const source = useQuery({
    queryKey: ["auto-send-template-editor", trigger],
    gcTime: 0,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    queryFn: async () => {
      const configs = await fetchAutoSendConfigs();
      const config = configs.find((item) => item.trigger === trigger);
      if (!config) throw new Error("현재 자동발송 설정을 찾을 수 없습니다.");
      const template = config.template ? await fetchMessageTemplate(config.template) : null;
      return { config, template, configs };
    },
  });
  const templateType = getAlimtalkTemplateType(trigger);
  const editable = Boolean(templateType && isAlimtalkTemplateBodyEditable(templateType));
  const sourceTemplate = source.data?.template ?? null;
  const copy = editable && Boolean(sourceTemplate?.is_system);
  const save = useMutation({
    mutationFn: async (payload: MessageTemplatePayload) => {
      if (!source.data || !editable) throw new Error("수정할 수 있는 안내문을 먼저 불러와 주세요.");
      let saved: MessageTemplateItem;
      if (savedCopy.current) {
        saved = await updateMessageTemplate(savedCopy.current.id, payload);
        savedCopy.current = saved;
      } else if (sourceTemplate && !copy) {
        saved = await updateMessageTemplate(sourceTemplate.id, payload);
      } else {
        saved = await createMessageTemplate(payload);
        savedCopy.current = saved;
      }
      if (source.data.config.template !== saved.id) {
        const configs = await updateAutoSendConfigs([{ trigger, template: saved.id }]);
        if (!configs.some((config) => config.trigger === trigger && config.template === saved.id)) {
          throw new Error("자동발송에 연결된 문구를 확인하지 못했습니다. 다시 저장해 주세요.");
        }
      }
      return saved;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: messageQueryKeys.templates }),
        qc.invalidateQueries({ queryKey: messageQueryKeys.autoSend }),
      ]);
      feedback.success(`${title}에 보낼 문구를 저장했습니다.`);
      onClose();
    },
    onError: () => {
      // Also refresh consumers when saving succeeded but connecting failed.
      void qc.invalidateQueries({ queryKey: messageQueryKeys.templates });
      void qc.invalidateQueries({ queryKey: messageQueryKeys.autoSend });
    },
  });

  if (!source.data || source.isFetching || source.isError) {
    return <AdminModal open onClose={onClose} width={560}>
      <ModalHeader title={`${title} 문구`} />
      <ModalBody>
        {source.isError
          ? <p role="alert">{extractApiError(source.error, "현재 연결된 문구를 불러오지 못했습니다.")}</p>
          : <p role="status">현재 자동발송에 연결된 문구를 불러오는 중입니다…</p>}
      </ModalBody>
      <ModalFooter right={<>
        <Button intent="secondary" onClick={onClose}>닫기</Button>
        {source.isError && <Button onClick={() => void source.refetch()}>다시 불러오기</Button>}
      </>} />
    </AdminModal>;
  }

  const otherUses = sourceTemplate && !copy
    ? source.data.configs.filter((config) => config.template === sourceTemplate.id && config.trigger !== trigger)
      .map((config) => AUTO_SEND_TRIGGER_LABELS[config.trigger] ?? "다른 자동발송")
    : [];
  const description = editable
    ? `저장하면 ‘${title}’에 이 안내문을 사용합니다. ${copy ? "기본 문구는 보존하고 수정본을 연결합니다. " : ""}저장만으로 알림톡을 보내지는 않습니다.`
      + (otherUses.length ? ` 같은 문구를 쓰는 ${otherUses.join(", ")}에도 변경 내용이 반영됩니다.` : "")
    : "이 알림은 승인된 고정 안내문으로 발송합니다. 이름과 계정·일정 정보는 발송할 때 자동으로 채워집니다.";
  return <TemplateEditModal
    open
    onClose={onClose}
    category={sourceTemplate?.category ?? AUTO_SEND_SECTIONS.find((section) => section.triggers.includes(trigger))?.id ?? "default"}
    initial={sourceTemplate}
    copy={copy}
    readOnly={!editable}
    heading={`${title} ${editable ? "문구 수정" : "내용 보기"}`}
    description={description}
    errorMessage={save.isError
      ? `${savedCopy.current ? "문구는 저장됐지만 자동발송 연결을 완료하지 못했습니다. 기존 발송 문구를 확인한 뒤 다시 저장해 주세요. " : ""}${extractApiError(save.error, "저장하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.")}`
      : undefined}
    submitLabel="저장하고 적용"
    onSubmit={(payload) => save.mutate(payload)}
    isPending={save.isPending}
    trigger={trigger}
  />;
}

import { useQuery } from "@tanstack/react-query";
import BottomSheet from "@teacher/shared/ui/BottomSheet";
import { EmptyActionButton } from "@teacher/shared/ui/EmptyActionButton";
import KakaoAlimtalkPreview from "@/shared/ui/notifications/KakaoAlimtalkPreview";
import { getAlimtalkTemplateType, isAccountAlimtalkTrigger, stripInternalAlimtalkMemoToken } from "@/shared/messaging/alimtalkEnvelope";
import { renderAlimtalkFullPreview } from "@/shared/messaging/alimtalkPreview";
import { renderPlainMessagePreview } from "@/shared/messaging/templateBlocks";
import { extractApiError } from "@/shared/utils/extractApiError";
import { fetchAutoSendConfigs } from "../api";
import { teacherCommsQueryKeys } from "../queryKeys";
import styles from "./MessagingSettingsPage.module.css";

export default function AutoSendPreviewSheet({ trigger, onClose }: { trigger: string; onClose: () => void }) {
  const source = useQuery({
    queryKey: teacherCommsQueryKeys.autoSendPreview(trigger),
    queryFn: async () => {
      const current = (await fetchAutoSendConfigs()).find((config) => config.trigger === trigger);
      if (!current) throw new Error("현재 자동발송 설정을 찾을 수 없습니다.");
      return current;
    },
    staleTime: 0, gcTime: 0, refetchOnMount: "always",
    refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false,
  });
  const config = source.data;
  const template = config && typeof config.template === "object" ? config.template : null;
  const type = getAlimtalkTemplateType(trigger);
  const body = stripInternalAlimtalkMemoToken(config?.template_body ?? template?.body ?? "");
  return <BottomSheet open onClose={onClose} title="템플릿 미리보기">
    <div className={`${styles.sheetContent} flex flex-col gap-2`}>
      {source.isError ? <div role="alert">
        <p>{extractApiError(source.error, "현재 연결된 문구를 불러오지 못했습니다.")}</p>
        <EmptyActionButton onClick={() => void source.refetch()}>다시 불러오기</EmptyActionButton>
      </div> : !config || source.isFetching ? <p role="status">현재 연결된 문구를 불러오는 중입니다…</p> : <>
        <div className={`${styles.previewValue} text-sm font-semibold`}>{config.template_name || template?.name || "정해진 알림톡"}</div>
        {isAccountAlimtalkTrigger(trigger) ? <p role="note">
          계정 안내는 발송 시점의 아이디·계정 정보와 승인된 양식으로 작성합니다.
          보관함에 남아 있는 예전 본문은 이 안내의 미리보기로 사용하지 않습니다.
        </p> : body || type ? <>
          <p className={`${styles.mutedText} text-[11px]`}>발송 형태 예시 · 학원·학생·일정 정보는 발송할 때 채워집니다.</p>
          <KakaoAlimtalkPreview>{renderPlainMessagePreview(renderAlimtalkFullPreview(type, body))}</KakaoAlimtalkPreview>
        </> : <p>현재 연결된 안내 문구가 없습니다.</p>}
      </>}
    </div>
  </BottomSheet>;
}

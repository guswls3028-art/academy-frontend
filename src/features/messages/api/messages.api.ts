// PATH: src/features/messages/api/messages.api.ts
// 알림톡 잔액 · 충전 · 카카오 연동 · 발송 로그 (Backend 연동 대비)

import api from "@/shared/api/axios";

const PREFIX = "/messaging";

// ----------------------------------------
// 타입 (1~4단계 백엔드 스키마와 맞춤)
// ----------------------------------------

export interface TenantMessagingInfo {
  /** 학원 개별 카카오 프로필 ID (연동 시 저장) */
  kakao_pfid: string | null;
  /** 테넌트별 SMS/알림톡 발신번호 (예: 01031217466) */
  messaging_sender: string | null;
  /** 선불 충전 잔액 */
  credit_balance: string;
  /** 알림톡 기능 활성화 여부 */
  is_active: boolean;
  /** 건당 발송 단가 (학원별 책정) */
  base_price: string;
}

export interface NotificationLogItem {
  id: number;
  sent_at: string;
  /** 성공 여부 */
  success: boolean;
  /** 차감 금액 */
  amount_deducted: string;
  /** 수신자 수 또는 요약 */
  recipient_summary?: string;
  /** 템플릿/제목 요약 */
  template_summary?: string;
  /** 실패 시 사유 */
  failure_reason?: string | null;
}

export interface NotificationLogParams {
  page?: number;
  page_size?: number;
}

export interface NotificationLogResponse {
  results: NotificationLogItem[];
  count: number;
}

// ----------------------------------------
// API
// ----------------------------------------

/** 테넌트 메시징 정보 (잔액, PFID, 활성화, 단가) */
export async function fetchMessagingInfo(): Promise<TenantMessagingInfo> {
  const res = await api.get<TenantMessagingInfo>(`${PREFIX}/info/`);
  return res.data;
}

/** 크레딧 충전 (결제 완료 후 호출) */
export async function chargeCredits(amount: string): Promise<{ credit_balance: string }> {
  const res = await api.post<{ credit_balance: string }>(`${PREFIX}/charge/`, {
    amount,
  });
  return res.data;
}

/** 카카오 PFID 저장/연동 */
export async function updateKakaoPfid(pfid: string): Promise<TenantMessagingInfo> {
  const res = await api.patch<TenantMessagingInfo>(`${PREFIX}/info/`, { kakao_pfid: pfid });
  return res.data;
}

/** 발신번호가 솔라피에 등록된 번호인지 인증 */
export async function verifySender(phoneNumber: string): Promise<{
  verified: boolean;
  message: string;
}> {
  const res = await api.post<{ verified: boolean; message: string }>(
    `${PREFIX}/verify-sender/`,
    { phone_number: phoneNumber }
  );
  return res.data;
}

/** 메시징 설정 일부 수정 (발신번호, PFID 등) */
export async function updateMessagingInfo(
  payload: Partial<Pick<TenantMessagingInfo, "kakao_pfid" | "messaging_sender">>
): Promise<TenantMessagingInfo> {
  const res = await api.patch<TenantMessagingInfo>(`${PREFIX}/info/`, payload);
  return res.data;
}

/** 채널 공유 확인 (파트너 등록 여부) — 4단계 */
export async function checkChannelShared(): Promise<{ shared: boolean; message?: string }> {
  const res = await api.get<{ shared: boolean; message?: string }>(`${PREFIX}/channel-check/`);
  return res.data;
}

/** 발송 로그 목록 */
export async function fetchNotificationLog(
  params?: NotificationLogParams
): Promise<NotificationLogResponse> {
  const res = await api.get<NotificationLogResponse>(`${PREFIX}/log/`, { params });
  return res.data;
}

// ----------------------------------------
// 메시지 템플릿 (양식 저장)
// ----------------------------------------

export type MessageTemplateCategory = "default" | "lecture" | "clinic";

export type SolapiStatus = "" | "PENDING" | "APPROVED" | "REJECTED";

export interface MessageTemplateItem {
  id: number;
  category: MessageTemplateCategory;
  name: string;
  subject: string;
  body: string;
  /** 솔라피에서 발급된 템플릿 ID (검수 신청 후) */
  solapi_template_id?: string;
  /** 검수 상태: 미신청 / PENDING / APPROVED / REJECTED */
  solapi_status?: SolapiStatus;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplatePayload {
  category: MessageTemplateCategory;
  name: string;
  subject?: string;
  body: string;
}

export async function fetchMessageTemplates(
  category?: MessageTemplateCategory
): Promise<MessageTemplateItem[]> {
  const params = category ? { category } : {};
  const res = await api.get<MessageTemplateItem[]>(`${PREFIX}/templates/`, { params });
  return res.data;
}

export async function createMessageTemplate(
  payload: MessageTemplatePayload
): Promise<MessageTemplateItem> {
  const res = await api.post<MessageTemplateItem>(`${PREFIX}/templates/`, payload);
  return res.data;
}

export async function updateMessageTemplate(
  id: number,
  payload: Partial<MessageTemplatePayload>
): Promise<MessageTemplateItem> {
  const res = await api.patch<MessageTemplateItem>(`${PREFIX}/templates/${id}/`, payload);
  return res.data;
}

export async function deleteMessageTemplate(id: number): Promise<void> {
  await api.delete(`${PREFIX}/templates/${id}/`);
}

/** 템플릿 검수 신청 (솔라피 알림톡 템플릿 등록 → 카카오 검수 대기) */
export async function submitMessageTemplateReview(
  id: number
): Promise<{ detail: string; template: MessageTemplateItem }> {
  const res = await api.post<{ detail: string; template: MessageTemplateItem }>(
    `${PREFIX}/templates/${id}/submit-review/`
  );
  return res.data;
}

// ----------------------------------------
// 메시지 발송 (공용 모달에서 사용)
// ----------------------------------------

export type SendToType = "student" | "parent";

export interface SendMessagePayload {
  student_ids: number[];
  send_to: SendToType;
  template_id?: number | null;
  raw_body?: string;
  raw_subject?: string;
}

export interface SendMessageResponse {
  detail: string;
  enqueued: number;
  skipped_no_phone: number;
}

export async function sendMessage(payload: SendMessagePayload): Promise<SendMessageResponse> {
  const res = await api.post<SendMessageResponse>(`${PREFIX}/send/`, payload);
  return res.data;
}

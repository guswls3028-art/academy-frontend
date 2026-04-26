// PATH: src/app_admin/domains/messages/api/messages.api.ts
// 알림톡 잔액 · 충전 · 카카오 연동 · 발송 로그 (Backend 연동 대비)

import api from "@/shared/api/axios";

const PREFIX = "/messaging";

// ----------------------------------------
// 타입 (1~4단계 백엔드 스키마와 맞춤)
// ----------------------------------------

/** 메시징 공급자 (솔라피 또는 뿌리오) */
export type MessagingProvider = "solapi" | "ppurio";

export interface TenantMessagingInfo {
  /** 학원 개별 카카오 프로필 ID (연동 시 저장) */
  kakao_pfid: string | null;
  /** 테넌트별 SMS/알림톡 발신번호 (예: 01031217466) */
  messaging_sender: string | null;
  /** 문자(SMS) 발송 허용 여부 (OWNER_TENANT_ID 전용 정책). API 응답 기준만 사용 */
  sms_allowed?: boolean;
  /** 알림톡 채널 출처: 시스템 기본 채널 vs 학원 자체 연동 채널 */
  channel_source?: "system_default" | "tenant_override";
  /** 알림톡 발송 가능 여부 (PFID + 승인 템플릿 존재). API 응답 기준만 사용 */
  alimtalk_available?: boolean;
  /** 메시징 공급자: solapi(기본) 또는 ppurio(뿌리오) */
  messaging_provider?: MessagingProvider;
  /** 자체 솔라피 API Key (마스킹됨, 읽기용) */
  own_solapi_api_key?: string;
  /** 자체 솔라피 API Secret (마스킹됨, 읽기용) */
  own_solapi_api_secret?: string;
  /** 자체 뿌리오 API Key (마스킹됨, 읽기용) */
  own_ppurio_api_key?: string;
  /** 자체 뿌리오 계정 ID */
  own_ppurio_account?: string;
  /** 자체 연동 키가 설정되어 있는지 여부 */
  has_own_credentials?: boolean;
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
  /** 실제 발송된 메시지 본문 */
  message_body?: string;
  /** 발송 방식 */
  message_mode?: string;
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

/** 메시징 설정 일부 수정 (발신번호, PFID, 공급자, 자체 연동 키 등) */
export async function updateMessagingInfo(
  payload: Partial<Pick<TenantMessagingInfo, "kakao_pfid" | "messaging_sender" | "messaging_provider">> & {
    own_solapi_api_key?: string;
    own_solapi_api_secret?: string;
    own_ppurio_api_key?: string;
    own_ppurio_account?: string;
  }
): Promise<TenantMessagingInfo> {
  const res = await api.patch<TenantMessagingInfo>(`${PREFIX}/info/`, payload);
  return res.data;
}

/** 채널 공유 확인 (파트너 등록 여부) — 4단계 */
export async function checkChannelShared(): Promise<{ shared: boolean; message?: string }> {
  const res = await api.get<{ shared: boolean; message?: string }>(`${PREFIX}/channel-check/`);
  return res.data;
}

/** 공급자 연동 키 테스트 */
export interface TestCredentialsCheck {
  test: string;
  ok: boolean;
  message: string;
  sender_numbers?: string[];
}

export interface TestCredentialsResult {
  provider: string;
  checks: TestCredentialsCheck[];
  all_ok: boolean;
  summary: string;
}

export async function testCredentials(): Promise<TestCredentialsResult> {
  const res = await api.post<TestCredentialsResult>(`${PREFIX}/test-credentials/`);
  return res.data;
}

/** 발송 로그 목록 */
export async function fetchNotificationLog(
  params?: NotificationLogParams
): Promise<NotificationLogResponse> {
  const res = await api.get<NotificationLogResponse>(`${PREFIX}/log/`, { params });
  return res.data;
}

/** 발송 로그 단건 상세 */
export async function fetchNotificationLogDetail(
  id: number
): Promise<NotificationLogItem> {
  const res = await api.get<NotificationLogItem>(`${PREFIX}/log/${id}/`);
  return res.data;
}

// ----------------------------------------
// 메시지 템플릿 (양식 저장)
// ----------------------------------------

export type MessageTemplateCategory =
  | "default"
  | "signup"
  | "attendance"
  | "lecture"
  | "exam"
  | "assignment"
  | "grades"
  | "clinic"
  | "payment"
  | "notice"
  | "community"
  | "staff";

export type SolapiStatus = "" | "PENDING" | "APPROVED" | "REJECTED";

export interface MessageTemplateItem {
  id: number;
  category: MessageTemplateCategory;
  name: string;
  subject: string;
  body: string;
  /** 시스템 기본 양식 여부 — true이면 수정/삭제 불가 */
  is_system: boolean;
  /** 사용자가 해당 카테고리에서 기본으로 지정한 양식 */
  is_user_default: boolean;
  /** 솔라피에서 발급된 템플릿 ID (검수 신청 후) */
  solapi_template_id?: string;
  /** 검수 상태: 미신청 / PENDING / APPROVED / REJECTED */
  solapi_status?: SolapiStatus;
  /** 본문에 #{내용} 변수 포함 여부 — true면 자유양식 발송 가능 */
  has_content_var?: boolean;
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
  category?: MessageTemplateCategory,
  /** true이면 오너 테넌트의 승인 알림톡 템플릿도 포함 (시스템 기본 채널 폴백용) */
  includeSystem?: boolean,
): Promise<MessageTemplateItem[]> {
  const params: Record<string, string> = {};
  if (category) params.category = category;
  if (includeSystem) params.include_system = "true";
  const res = await api.get<MessageTemplateItem[]>(`${PREFIX}/templates/`, { params });
  return res.data;
}

export async function fetchMessageTemplate(id: number): Promise<MessageTemplateItem> {
  const res = await api.get<MessageTemplateItem>(`${PREFIX}/templates/${id}/`);
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

/** 기본 양식 지정/해제 토글 */
export async function setTemplateDefault(id: number): Promise<MessageTemplateItem> {
  const res = await api.post<MessageTemplateItem>(`${PREFIX}/templates/${id}/set-default/`);
  return res.data;
}

/** 양식 복제 (시스템 양식 → 내 양식) */
export async function duplicateMessageTemplate(
  id: number,
  name?: string
): Promise<MessageTemplateItem> {
  const res = await api.post<MessageTemplateItem>(`${PREFIX}/templates/${id}/duplicate/`, { name });
  return res.data;
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

export type SendToType = "student" | "parent" | "staff";

/** alimtalk=알림톡만 */
export type MessageMode = "alimtalk";

export interface SendMessagePayload {
  student_ids?: number[];
  staff_ids?: number[];
  send_to: SendToType;
  /** alimtalk */
  message_mode?: MessageMode;
  template_id?: number | null;
  raw_body?: string;
  raw_subject?: string;
  /** 알림톡 추가 치환 변수 (성적 발송 등) */
  alimtalk_extra_vars?: Record<string, string>;
  /** 학생별 개별 치환 변수 — key: student_id (대량 성적 발송 등) */
  alimtalk_extra_vars_per_student?: Record<number, Record<string, string>>;
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

// ----------------------------------------
// 자동발송 설정 — SSOT: backend/docs/AUTO-SEND-EVENT-SPEC.md
// ----------------------------------------

export type AutoSendTrigger =
  | "registration_approved_student"
  | "registration_approved_parent"
  | "withdrawal_complete"
  | "lecture_session_reminder"
  | "check_in_complete"
  | "absent_occurred"
  | "exam_scheduled_days_before"
  | "exam_start_minutes_before"
  | "exam_not_taken"
  | "exam_score_published"
  | "retake_assigned"
  | "assignment_registered"
  | "assignment_due_hours_before"
  | "assignment_not_submitted"
  | "monthly_report_generated"
  | "clinic_reminder"
  | "clinic_reservation_created"
  | "clinic_reservation_changed"
  | "clinic_cancelled"
  | "clinic_check_in"
  | "clinic_check_out"
  | "clinic_absent"
  | "clinic_self_study_completed"
  | "clinic_result_notification"
  | "counseling_reservation_created"
  | "payment_complete"
  | "payment_due_days_before"
  // 영상
  | "video_encoding_complete"
  // urgent_notice: 카카오 알림톡 정책 위반으로 제거
  // 커뮤니티 자동발송
  | "qna_answered"
  | "counsel_answered"
  // 직원 자동발송
  | "staff_attendance_summary"
  | "staff_expense_report"
  | "staff_month_close"
  | "staff_payroll_snapshot"
  | "staff_payroll_report";

export type PolicyMode = "SYSTEM_AUTO" | "AUTO_DEFAULT" | "MANUAL_DEFAULT" | "DISABLED";

export type DelayMode = "immediate" | "delay_minutes" | "scheduled_hour";

export interface AutoSendConfigItem {
  id: number | null;
  trigger: string;
  template: number | null;
  template_name: string;
  template_subject: string;
  template_body: string;
  template_solapi_status: string;
  enabled: boolean;
  message_mode: MessageMode;
  /** N분 전/후 발송 (null = 이벤트 시점). 사용자 설정 가능. */
  minutes_before: number | null;
  /** 발송 시점 모드: immediate=즉시, delay_minutes=N분 후, scheduled_hour=지정 시각 */
  delay_mode?: DelayMode;
  /** delay_minutes: 지연 분 수 / scheduled_hour: 시각(0-23) */
  delay_value?: number | null;
  /** 클리닉 출석/결석: ITEM_LIST 시간에 실제 버튼 누른 시각 표시 */
  show_actual_time?: boolean;
  created_at: string | null;
  updated_at: string | null;
  /** 정책 분류: SYSTEM_AUTO / AUTO_DEFAULT / MANUAL_DEFAULT / DISABLED */
  policy_mode?: PolicyMode;
}

export const AUTO_SEND_TRIGGER_LABELS: Record<string, string> = {
  registration_approved_student: "가입 안내(학생)",
  registration_approved_parent: "가입 안내(학부모)",
  withdrawal_complete: "퇴원 처리 완료",
  lecture_session_reminder: "수업 시작 N분 전",
  check_in_complete: "입실 완료",
  absent_occurred: "결석 발생",
  exam_scheduled_days_before: "시험 예정 N일 전",
  exam_start_minutes_before: "시험 시작 N분 전",
  exam_not_taken: "시험 미응시",
  exam_score_published: "성적 공개",
  retake_assigned: "재시험 대상 지정",
  assignment_registered: "과제 등록",
  assignment_due_hours_before: "과제 마감 N시간 전",
  assignment_not_submitted: "과제 미제출",
  monthly_report_generated: "월간 성적 리포트 발송",
  clinic_reminder: "클리닉 시작 N분 전",
  clinic_reservation_created: "클리닉 예약 완료",
  clinic_reservation_changed: "클리닉 예약 변경",
  clinic_cancelled: "클리닉 예약 취소",
  clinic_check_in: "참석(입실)",
  clinic_absent: "결석",
  clinic_self_study_completed: "클리닉 완료(하원)",
  clinic_result_notification: "클리닉 결과 안내",
  counseling_reservation_created: "상담 예약 완료",
  payment_complete: "결제 완료",
  payment_due_days_before: "납부 예정일 N일 전",
  // 영상
  video_encoding_complete: "영상 인코딩 완료",
  // urgent_notice: 카카오 알림톡 정책 위반으로 제거
  // 커뮤니티
  qna_answered: "QnA 답변 등록",
  counsel_answered: "상담 답변 등록",
  // 직원
  staff_attendance_summary: "근태 요약 발송",
  staff_expense_report: "비용/경비 리포트 발송",
  staff_month_close: "월 마감 완료 안내",
  staff_payroll_snapshot: "급여 스냅샷 발송",
  staff_payroll_report: "급여 명세서 발송",
};

export async function fetchAutoSendConfigs(): Promise<AutoSendConfigItem[]> {
  const res = await api.get<AutoSendConfigItem[]>(`${PREFIX}/auto-send/`);
  return res.data;
}

export async function updateAutoSendConfigs(configs: Partial<AutoSendConfigItem>[]): Promise<AutoSendConfigItem[]> {
  const payload = configs.map((c) => ({
    trigger: c.trigger,
    template_id: c.template,
    enabled: c.enabled,
    message_mode: c.message_mode,
    minutes_before: c.minutes_before ?? undefined,
    delay_mode: c.delay_mode ?? undefined,
    delay_value: c.delay_value ?? undefined,
    show_actual_time: c.show_actual_time ?? undefined,
  }));
  const res = await api.patch<AutoSendConfigItem[]>(`${PREFIX}/auto-send/`, {
    configs: payload,
  });
  return res.data;
}

export interface ProvisionDefaultsResult {
  created_templates: number;
  created_configs: number;
  reset_templates: number;
  linked: number;
  total_templates: number;
  total_configs: number;
  /** 자동 검수 신청된 자유양식 템플릿 수 */
  submitted_reviews?: number;
  /** 검수 신청 실패 목록 */
  review_errors?: string[];
  /** 검수 신청 결과 안내 */
  review_note?: string;
}

export async function provisionDefaultTemplates(): Promise<ProvisionDefaultsResult> {
  const res = await api.post<ProvisionDefaultsResult>(`${PREFIX}/provision-defaults/`);
  return res.data;
}

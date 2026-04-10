// PATH: src/features/messages/components/AlimtalkTemplateInfoPanel.tsx
// 통합 알림톡 템플릿 — 자동 채움 변수 안내 + #{내용} 편집 가이드
// 솔라피 리스트형 템플릿의 하드코딩 구조를 선생님에게 시각적으로 보여줌

import { getBlockColor, type TemplateBlock } from "../constants/templateBlocks";

// ── 템플릿 타입별 자동 채움 변수 ──

type AlimtalkTemplateType = "clinic_info" | "clinic_change" | "score" | "attendance" | null;

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  clinic_info: "클리닉 안내",
  clinic_change: "클리닉 일정 변경",
  score: "성적 안내",
  attendance: "출석 안내",
};

const TEMPLATE_TYPE_DESCRIPTIONS: Record<string, string> = {
  clinic_info: "학원이름, 학생이름, 장소, 날짜, 시간이 자동으로 표시됩니다. 아래 본문에는 안내 문구만 작성하세요.",
  clinic_change: "학원이름, 학생이름, 기존일정, 변동사항, 수정자가 자동으로 표시됩니다. 아래 본문에는 안내 문구만 작성하세요.",
  score: "학원이름, 학생이름, 강의명, 차시명이 자동으로 표시됩니다. 아래 본문에는 안내 문구만 작성하세요.",
  attendance: "학원이름, 학생이름, 강의명, 차시명, 날짜, 시간이 자동으로 표시됩니다. 아래 본문에는 안내 문구만 작성하세요.",
};

type AutoVar = { label: string; example: string; color: string; bg: string; border: string };

const TEMPLATE_AUTO_VARS: Record<string, AutoVar[]> = {
  clinic_info: [
    { label: "학원이름", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "홍길동", ...getBlockColor("student_name") },
    { label: "클리닉 장소", example: "3층 세미나실", ...getBlockColor("clinic_place") },
    { label: "클리닉 날짜", example: "2026-04-06", ...getBlockColor("clinic_date") },
    { label: "클리닉 시간", example: "14:00", ...getBlockColor("clinic_time") },
  ],
  clinic_change: [
    { label: "학원이름", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "홍길동", ...getBlockColor("student_name") },
    { label: "기존일정", example: "4/6(일) 14:00 3층", ...getBlockColor("clinic_old_sched") },
    { label: "변동사항", example: "4/7(월) 15:00으로 변경", ...getBlockColor("clinic_changes") },
    { label: "수정자", example: "김선생님", ...getBlockColor("clinic_modifier") },
  ],
  score: [
    { label: "학원이름", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "홍길동", ...getBlockColor("student_name") },
    { label: "강의명", example: "수학 심화반", ...getBlockColor("lecture_name") },
    { label: "차시명", example: "3회차", ...getBlockColor("session_name") },
  ],
  attendance: [
    { label: "학원이름", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "홍길동", ...getBlockColor("student_name") },
    { label: "강의명", example: "수학 심화반", ...getBlockColor("lecture_name") },
    { label: "차시명", example: "3회차", ...getBlockColor("session_name") },
    { label: "날짜", example: "2026-04-06", ...getBlockColor("date") },
    { label: "시간", example: "14:00", ...getBlockColor("time") },
  ],
};

/** 트리거명으로 알림톡 템플릿 타입 판별 */
export function getAlimtalkTemplateType(trigger?: string): AlimtalkTemplateType {
  if (!trigger) return null;
  const CLINIC_INFO = [
    "clinic_reservation_created", "clinic_reminder", "clinic_check_in", "clinic_check_out",
    "clinic_absent", "clinic_self_study_completed", "clinic_result_notification",
    "counseling_reservation_created",
  ];
  const CLINIC_CHANGE = ["clinic_reservation_changed", "clinic_cancelled"];
  const ATTENDANCE = ["check_in_complete", "absent_occurred", "lecture_session_reminder"];
  const SCORE = [
    "exam_scheduled_days_before", "exam_start_minutes_before", "exam_not_taken",
    "exam_score_published", "retake_assigned",
    "assignment_registered", "assignment_due_hours_before", "assignment_not_submitted",
    "monthly_report_generated",
    "video_encoding_complete",
  ];
  if (CLINIC_INFO.includes(trigger)) return "clinic_info";
  if (CLINIC_CHANGE.includes(trigger)) return "clinic_change";
  if (ATTENDANCE.includes(trigger)) return "attendance";
  if (SCORE.includes(trigger)) return "score";
  return null;
}

/** 알림톡 미리보기용 전체 메시지 렌더링 */
export function renderAlimtalkFullPreview(
  templateType: AlimtalkTemplateType,
  contentBody: string,
  siteUrl?: string,
  trigger?: string,
): string {
  // 실제 테넌트 URL 사용 (없으면 도메인에서 추출)
  let url = siteUrl || "";
  if (!url) {
    try {
      const host = window.location.hostname;
      url = host === "localhost" || host === "127.0.0.1" ? "https://학원사이트.com" : `https://${host}`;
    } catch { url = "https://학원사이트.com"; }
  }
  if (templateType === "clinic_info") {
    return (
      `학원플러스입니다.\n\n` +
      `홍길동학생님.\n\n` +
      `클리닉 안내 드립니다.\n` +
      `장소\n3층 세미나실\n\n` +
      `날짜\n2026-04-06\n\n` +
      `시간\n14:00\n\n` +
      `${contentBody || "(안내 문구를 작성하세요)"}\n` +
      url
    );
  }
  if (templateType === "clinic_change") {
    return (
      `학원플러스입니다.\n\n` +
      `홍길동학생님. 클리닉 일정이 변경되었습니다.\n\n` +
      `일정 변경 안내 드립니다.\n` +
      `기존일정\n4/6(일) 14:00 3층\n\n` +
      `변동사항\n4/7(월) 15:00으로 변경\n\n` +
      `수정자\n김선생님\n\n` +
      `${contentBody || "(안내 문구를 작성하세요)"}\n` +
      url
    );
  }
  if (templateType === "attendance") {
    return (
      `학원플러스입니다.\n\n` +
      `홍길동학생님.\n\n` +
      `출석 안내 드립니다.\n` +
      `강의\n수학 심화반\n\n` +
      `차시\n3회차\n\n` +
      `날짜\n2026-04-06\n\n` +
      `시간\n14:00\n\n` +
      `${contentBody || "(안내 문구를 작성하세요)"}\n` +
      url
    );
  }
  if (templateType === "score") {
    const isVideo = trigger === "video_encoding_complete";
    const recipientLabel = isVideo ? "김선생님." : "홍길동학생님.";
    const introLabel = isVideo ? "영상 인코딩 안내 드립니다." : "성적표 안내 드립니다.";
    return (
      `학원플러스입니다.\n\n` +
      `${recipientLabel}\n\n` +
      `${introLabel}\n` +
      `강의\n수학 심화반\n\n` +
      `차시\n3회차\n\n` +
      `${contentBody || "(안내 문구를 작성하세요)"}\n` +
      url
    );
  }
  return contentBody || "";
}

export default function AlimtalkTemplateInfoPanel({
  templateType,
  disabled,
}: {
  templateType: AlimtalkTemplateType;
  disabled?: boolean;
}) {
  if (!templateType) return null;

  const autoVars = TEMPLATE_AUTO_VARS[templateType] || [];
  const description = TEMPLATE_TYPE_DESCRIPTIONS[templateType] || "";
  const typeLabel = TEMPLATE_TYPE_LABELS[templateType] || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* 템플릿 타입 뱃지 */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: 8,
        background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-surface))",
        border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
        fontSize: 12, fontWeight: 700, color: "var(--color-primary)",
        alignSelf: "flex-start",
      }}>
        알림톡 · {typeLabel}
      </div>

      {/* 설명 */}
      <p style={{
        fontSize: 11, lineHeight: 1.5,
        color: "var(--color-text-muted)",
        margin: 0,
      }}>
        {description}
      </p>

      {/* 자동 채움 변수 */}
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: "var(--color-text-muted)",
        letterSpacing: "0.3px",
        marginTop: 4,
      }}>
        자동 채움 항목
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {autoVars.map((v) => (
          <div
            key={v.label}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "4px 10px", borderRadius: 6,
              background: v.bg, border: `1px solid ${v.border}`,
              fontSize: 11,
            }}
          >
            <span style={{ fontWeight: 700, color: v.color, minWidth: 60 }}>{v.label}</span>
            <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>{v.example}</span>
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div style={{
        marginTop: 4, padding: "6px 10px", borderRadius: 6,
        background: "color-mix(in srgb, var(--color-status-info, #2563eb) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-status-info, #2563eb) 15%, transparent)",
        fontSize: 10, lineHeight: 1.5,
        color: "var(--color-status-info, #2563eb)",
      }}>
        위 항목은 발송 시 자동으로 채워집니다.<br />
        본문에는 안내 문구만 직접 작성하세요. (카카오톡에서 <strong>내용</strong> 영역에 표시됩니다)
      </div>
    </div>
  );
}

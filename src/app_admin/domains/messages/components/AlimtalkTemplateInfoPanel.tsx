// PATH: src/app_admin/domains/messages/components/AlimtalkTemplateInfoPanel.tsx
// 통합 알림톡 템플릿 — 자동 채움 변수 안내 + #{내용} 편집 가이드
// 솔라피 리스트형 템플릿의 하드코딩 구조를 선생님에게 시각적으로 보여줌

/* eslint-disable react-refresh/only-export-components, no-restricted-syntax -- helper 함수 + 컴포넌트 한 파일 SSOT + 안내 패널 inline style (2026-05-14 baseline shift fix) */

import { getBlockColor } from "../constants/templateBlocks";
import {
  getAlimtalkTemplateLabel,
  getAlimtalkTemplateType,
  getAlimtalkTemplateTypeFromCategory,
  isAlimtalkTemplateBodyEditable,
  type AlimtalkTemplateType,
} from "../constants/alimtalkEnvelope";

export {
  getAlimtalkTemplateLabel,
  getAlimtalkTemplateType,
  getAlimtalkTemplateTypeFromCategory,
  isAlimtalkTemplateBodyEditable,
};
export type { AlimtalkTemplateType };

// ── 템플릿 타입별 자동 채움 변수 ──

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  clinic_info: "클리닉 안내",
  clinic_change: "클리닉 일정 변경",
  score: "성적 안내",
  attendance: "출석 안내",
  notice_withdrawal: "퇴원 처리 안내",
  notice_payment: "결제 완료 안내",
};

const TEMPLATE_TYPE_DESCRIPTIONS: Record<string, string> = {
  clinic_info: "학원이름, 학생이름, 장소, 날짜, 시간이 자동으로 표시됩니다. 본문에 안내 문구를 작성하고, 필요 시 아래 변수를 삽입할 수 있습니다.",
  clinic_change: "학원이름, 학생이름, 기존일정, 변동사항, 수정자가 자동으로 표시됩니다. 본문에 안내 문구를 작성하세요.",
  score: "학원이름, 학생이름, 강의명, 차시명이 자동으로 표시됩니다. 본문에 안내 문구를 작성하고, 필요 시 아래 변수를 삽입할 수 있습니다.",
  attendance: "학원이름, 학생이름, 강의명, 차시명, 날짜, 시간이 자동으로 표시됩니다. 본문에 안내 문구를 작성하세요.",
  notice_withdrawal: "학원명과 학생 이름이 자동으로 표시되는 고정 안내입니다. 카카오 승인 본문에는 별도 안내 문구 영역이 없습니다.",
  notice_payment: "학원명, 학생 이름, 사이트 링크가 자동으로 표시되는 고정 안내입니다. 카카오 승인 본문에는 별도 안내 문구 영역이 없습니다.",
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
  notice_withdrawal: [
    { label: "학원명", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "길동", ...getBlockColor("student_name_2") },
  ],
  notice_payment: [
    { label: "학원명", example: "학원플러스", ...getBlockColor("academy_name") },
    { label: "학생이름", example: "길동", ...getBlockColor("student_name_2") },
    { label: "사이트 링크", example: "https://academy.example", ...getBlockColor("site_link") },
  ],
};

/** 알림톡 자동 채움 변수의 block ID 목록 — 본문 변수 삽입에서 중복 제거용 */
const AUTO_VAR_BLOCK_IDS: Record<string, Set<string>> = {
  clinic_info: new Set(["academy_name", "student_name", "clinic_place", "clinic_date", "clinic_time"]),
  clinic_change: new Set(["academy_name", "student_name", "clinic_old_sched", "clinic_changes", "clinic_modifier"]),
  score: new Set(["academy_name", "student_name", "lecture_name", "session_name"]),
  attendance: new Set(["academy_name", "student_name", "lecture_name", "session_name", "date", "time"]),
  notice_withdrawal: new Set(["academy_name", "student_name_2"]),
  notice_payment: new Set(["academy_name", "student_name_2", "site_link"]),
};

export function getAutoFillBlockIds(templateType: AlimtalkTemplateType | null): Set<string> {
  if (!templateType) return new Set();
  return AUTO_VAR_BLOCK_IDS[templateType] ?? new Set();
}

/** 알림톡 미리보기용 전체 메시지 렌더링 */
export function renderAlimtalkFullPreview(
  templateType: AlimtalkTemplateType | null,
  contentBody: string,
  siteUrl?: string,
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
    return (
      `학원플러스입니다.\n\n` +
      `홍길동학생님.\n\n` +
      `성적표 안내 드립니다.\n` +
      `강의\n수학 심화반\n\n` +
      `차시\n3회차\n\n` +
      `${contentBody || "(안내 문구를 작성하세요)"}\n` +
      url
    );
  }
  if (templateType === "notice_withdrawal") {
    return (
      `안녕하세요, 학원플러스입니다.\n\n` +
      `길동학생님, 퇴원 처리가 완료되었습니다.\n\n` +
      `그동안 학원을 이용해 주셔서 감사합니다.\n` +
      `재등록을 원하시면 언제든 문의해 주세요.`
    );
  }
  if (templateType === "notice_payment") {
    return (
      `안녕하세요, 학원플러스입니다.\n\n` +
      `길동학생님, 결제가 완료되었습니다.\n\n` +
      `수업·결제 내역은 아래 링크에서 확인하실 수 있습니다.\n` +
      url
    );
  }
  return contentBody || "";
}

export default function AlimtalkTemplateInfoPanel({
  templateType,
}: {
  templateType: AlimtalkTemplateType;
  /** caller 호환 — 본 컴포넌트는 readonly 안내라 비활성 상태 표시 안 함 */
  disabled?: boolean;
}) {
  if (!templateType) return null;

  const autoVars = TEMPLATE_AUTO_VARS[templateType] || [];
  const description = TEMPLATE_TYPE_DESCRIPTIONS[templateType] || "";
  const typeLabel = TEMPLATE_TYPE_LABELS[templateType] || getAlimtalkTemplateLabel(templateType);
  const bodyEditable = isAlimtalkTemplateBodyEditable(templateType);

  return (
     
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* 템플릿 타입 뱃지 */}
      { }
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
      { }
      <p style={{
        fontSize: 11, lineHeight: 1.5,
        color: "var(--color-text-muted)",
        margin: 0,
      }}>
        {description}
      </p>

      {/* 자동 채움 변수 */}
      { }
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: "var(--color-text-muted)",
        letterSpacing: "0.3px",
        marginTop: 4,
      }}>
        자동 채움 항목
      </div>
      { }
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
            { }
            <span style={{ fontWeight: 700, color: v.color, minWidth: 60 }}>{v.label}</span>
            { }
            <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>{v.example}</span>
          </div>
        ))}
      </div>

      {/* 안내 */}
      { }
      <div style={{
        marginTop: 4, padding: "6px 10px", borderRadius: 6,
        background: "color-mix(in srgb, var(--color-status-info, #2563eb) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-status-info, #2563eb) 15%, transparent)",
        fontSize: 10, lineHeight: 1.5,
        color: "var(--color-status-info, #2563eb)",
      }}>
        {bodyEditable ? (
          <>
            위 항목은 발송 시 자동으로 채워집니다.<br />
            본문에 안내 문구를 작성하세요. (카카오톡에서 <strong>내용</strong> 영역에 표시됩니다)
          </>
        ) : (
          <>
            위 항목만 발송 시 자동으로 채워집니다.<br />
            이 봉투는 카카오 승인 본문이 고정되어 별도 본문 문구를 표시하지 않습니다.
          </>
        )}
      </div>
    </div>
  );
}
